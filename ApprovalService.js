/**
 * ApprovalService.js - จัดการ State Machine และ Workflow ของการอนุมัติ
 * ดูแลกระบวนการอนุมัติระดับ 1, ระดับ 2, การตีกลับ และ Server-side Authorization (V-6, V-7)
 */

var ApprovalService = (function() {

  /**
   * ตรวจสอบตัวตนและดึงชื่อผู้อนุมัติจาก Central IAM
   */
  function getApproverUser_(lineUid) {
    var authRes = CentralApiService.verifyAccess(lineUid, Config.getScreenTag());
    if (!authRes || !authRes.ok || !authRes.authorized || !authRes.user) {
      throw new Error('ไม่พบสิทธิ์การใช้งานสำหรับ LINE UID นี้ หรือบัญชีถูกระงับ (AUTH_FAILED)');
    }
    return authRes.user;
  }

  return {
    /**
     * ดึงคิวรออนุมัติทั้งระดับ 1 และระดับ 2 ของผู้ใช้งานที่ล็อกอิน
     */
    getApprovalQueue: function(lineUid, monthFilter) {
      var user = getApproverUser_(lineUid);
      var approverName = String(user.users_name || '').trim();

      var asL1 = TransactionRepo.findPendingL1Queue(approverName, monthFilter);
      var asL2 = TransactionRepo.findPendingL2Queue(approverName);
      var l2Approvers = CentralApiService.getApproveList(Config.getApproveTagL2());
      var questions = FormMasterRepo.getFormMasterCached();

      // ดึง Map รายชื่อผู้ใช้เพื่อแปลง lineUid เป็นชื่อผู้ตรวจ (userName) โดยดึงจากแคชความเร็วสูง
      var userMap = CentralApiService.getUserMapByLineUid();
      for (var i = 0; i < asL1.length; i++) {
        var u1 = asL1[i].lineUid;
        asL1[i].userName = userMap[u1] || u1;
      }
      for (var j = 0; j < asL2.length; j++) {
        var u2 = asL2[j].lineUid;
        asL2[j].userName = userMap[u2] || u2;
      }

      return {
        user: user,
        approverName: approverName,
        asL1: asL1,
        asL2: asL2,
        l2Approvers: l2Approvers,
        questions: questions
      };
    },

    /**
     * ดำเนินการอนุมัติ (Approve Action)
     * @param {string} lineUid LINE UID ของผู้อนุมัติ
     * @param {number} level 1 หรือ 2
     * @param {Array<number>} transRecordIds รายการ ID ที่ต้องการอนุมัติ
     * @param {string} [approveProfile2] ชื่อผู้อนุมัติระดับ 2 (จำเป็นเมื่อ level=1)
     */
    approveAction: function(lineUid, level, transRecordIds, approveProfile2) {
      var user = getApproverUser_(lineUid);
      var approverName = String(user.users_name || '').trim();

      if (!Array.isArray(transRecordIds) || transRecordIds.length === 0) {
        throw new Error('กรุณาเลือกอย่างน้อย 1 รายการที่ต้องการอนุมัติ');
      }

      var lvl = Number(level);
      if (lvl === 1 && !approveProfile2) {
        throw new Error('กรุณาระบุผู้อนุมัติระดับ 2 ก่อนยืนยันการอนุมัติ (V-6)');
      }

      var now = DateUtils.nowBangkok();

      // 1. ดึงข้อมูลทุกรายการที่เลือกในรอบเดียว (Single Read Batch - ตัด N+1 Sheet Query)
      var txList = TransactionRepo.findByIds(transRecordIds);
      if (txList.length === 0) {
        throw new Error('ไม่พบข้อมูลรายการที่เลือก');
      }

      // 2. Validate รายการทั้งหมดใน RAM ก่อนดำเนินการ
      var updatesList = [];
      var validTxList = [];

      for (var i = 0; i < txList.length; i++) {
        var tx = txList[i];
        if (lvl === 1) {
          if (tx.approveProfile1 !== approverName) {
            throw new Error('คุณไม่มีสิทธิ์อนุมัติรายการรหัส ' + tx.transRecordId + ' (ชื่อผู้อนุมัติ L1 ไม่ตรงกัน)');
          }
          if (tx.status !== 'PENDING_L1') {
            throw new Error('รายการรหัส ' + tx.transRecordId + ' ไม่อยู่ในสถานะรออนุมัติระดับ 1');
          }
          updatesList.push({
            transRecordId: tx.transRecordId,
            updates: {
              status: 'PENDING_L2',
              approve1Result: 'APPROVED',
              approve1Datetime: now,
              approveProfile2: approveProfile2,
              updateDatetime: now
            }
          });
          validTxList.push(tx);
        } else if (lvl === 2) {
          if (tx.approveProfile2 !== approverName) {
            throw new Error('คุณไม่มีสิทธิ์อนุมัติรายการรหัส ' + tx.transRecordId + ' (ชื่อผู้อนุมัติ L2 ไม่ตรงกัน)');
          }
          if (tx.status !== 'PENDING_L2') {
            throw new Error('รายการรหัส ' + tx.transRecordId + ' ไม่อยู่ในสถานะรออนุมัติระดับ 2');
          }
          updatesList.push({
            transRecordId: tx.transRecordId,
            updates: {
              status: 'APPROVED',
              approve2Result: 'APPROVED',
              approve2Datetime: now,
              updateDatetime: now
            }
          });
          validTxList.push(tx);
        }
      }

      // 3. บันทึกการอัปเดตลง Google Sheets ในรอบเดียว (Single Write Batch with Lock)
      // รับประกัน Database-First: บันทึกลง Sheet ให้เสร็จสมบูรณ์ก่อนเริ่มส่ง LINE
      var updatedRows = TransactionRepo.batchUpdate(updatesList);
      var updatedCount = updatedRows.length;

      // 4. ส่งการแจ้งเตือน LINE แบบรวมยอด (Batch Notification) 1 ข้อความต่อ 1 ผู้รับ
      // ทำงานใน try...catch เพื่อไม่ให้ข้อผิดพลาดของ LINE กระทบต่อผลการอนุมัติใน Google Sheets
      try {
        if (lvl === 1) {
          // ค้นหา line_uid ของผู้อนุมัติ L2 จาก Central API
          var l2List = CentralApiService.getApproveList(Config.getApproveTagL2());
          var l2User = null;
          for (var k = 0; k < l2List.length; k++) {
            if (l2List[k].users_name === approveProfile2) {
              l2User = l2List[k];
              break;
            }
          }
          if (l2User && l2User.line_uid) {
            var summaryL2 = NotifyService.buildBatchSummary(validTxList);
            NotifyService.notifyL2PendingBatch(l2User.line_uid, approverName, summaryL2);
          }
        } else if (lvl === 2) {
          // จัดกลุ่มรายการตาม lineUid ของผู้ตรวจ (Requester) แล้วส่งสรุปรวม 1 ข้อความต่อ 1 ผู้ตรวจ
          var txByRequester = {};
          for (var r = 0; r < validTxList.length; r++) {
            var reqUid = validTxList[r].lineUid;
            if (reqUid) {
              if (!txByRequester[reqUid]) txByRequester[reqUid] = [];
              txByRequester[reqUid].push(validTxList[r]);
            }
          }
          for (var uidKey in txByRequester) {
            if (txByRequester.hasOwnProperty(uidKey)) {
              var reqItems = txByRequester[uidKey];
              var summaryReq = NotifyService.buildBatchSummary(reqItems);
              NotifyService.notifyRequesterApprovedBatch(uidKey, approverName, summaryReq);
            }
          }
        }
      } catch (errNotify) {
        Logger.log('[ApprovalService] Batch notify failed: ' + errNotify);
      }

      return {
        updatedCount: updatedCount,
        level: lvl
      };
    },

    /**
     * ดำเนินการปฏิเสธ (Reject Action - ตีกลับให้ผู้ตรวจแก้ไข)
     * รองรับ Batch Reject ในรอบเดียว พร้อมแจ้งเตือนสรุปใน 1 ข้อความ
     * @param {string} lineUid LINE UID ของผู้ปฏิเสธ
     * @param {number} level 1 หรือ 2
     * @param {Array<number>} transRecordIds รายการ ID
     * @param {string} [reason] เหตุผลในการปฏิเสธ
     */
    rejectAction: function(lineUid, level, transRecordIds, reason) {
      var user = getApproverUser_(lineUid);
      var approverName = String(user.users_name || '').trim();

      if (!Array.isArray(transRecordIds) || transRecordIds.length === 0) {
        throw new Error('กรุณาเลือกอย่างน้อย 1 รายการที่ต้องการปฏิเสธ');
      }

      var lvl = Number(level);
      var now = DateUtils.nowBangkok();
      var cleanReason = String(reason || '').trim();

      // 1. ดึงข้อมูลทุกรายการที่เลือกในรอบเดียว (Single Read Batch)
      var txList = TransactionRepo.findByIds(transRecordIds);
      if (txList.length === 0) {
        throw new Error('ไม่พบข้อมูลรายการที่เลือก');
      }

      var updatesList = [];
      var validTxList = [];

      for (var i = 0; i < txList.length; i++) {
        var tx = txList[i];
        if (lvl === 1) {
          if (tx.approveProfile1 !== approverName) {
            throw new Error('คุณไม่มีสิทธิ์ปฏิเสธรายการรหัส ' + tx.transRecordId);
          }
          updatesList.push({
            transRecordId: tx.transRecordId,
            updates: {
              status: 'REJECTED',
              approve1Result: 'REJECTED',
              approve1Datetime: now,
              rejectReason: cleanReason,
              updateDatetime: now
            }
          });
          validTxList.push(tx);
        } else if (lvl === 2) {
          if (tx.approveProfile2 !== approverName) {
            throw new Error('คุณไม่มีสิทธิ์ปฏิเสธรายการรหัส ' + tx.transRecordId);
          }
          updatesList.push({
            transRecordId: tx.transRecordId,
            updates: {
              status: 'REJECTED',
              approve2Result: 'REJECTED',
              approve2Datetime: now,
              rejectReason: cleanReason,
              updateDatetime: now
            }
          });
          validTxList.push(tx);
        }
      }

      // 2. บันทึกการอัปเดตลง Google Sheets ในรอบเดียว (Single Write Batch)
      var updatedRows = TransactionRepo.batchUpdate(updatesList);
      var updatedCount = updatedRows.length;

      // 3. ส่งการแจ้งเตือน LINE แบบรวมยอด (Batch Notification)
      try {
        var txByRequester = {};
        for (var r = 0; r < validTxList.length; r++) {
          var reqUid = validTxList[r].lineUid;
          if (reqUid) {
            if (!txByRequester[reqUid]) txByRequester[reqUid] = [];
            txByRequester[reqUid].push(validTxList[r]);
          }
        }
        for (var uidKey in txByRequester) {
          if (txByRequester.hasOwnProperty(uidKey)) {
            var reqItems = txByRequester[uidKey];
            var summaryReq = NotifyService.buildBatchSummary(reqItems);
            NotifyService.notifyRequesterRejectedBatch(uidKey, approverName, lvl, cleanReason, summaryReq);
          }
        }
      } catch (errNotify) {
        Logger.log('[ApprovalService] Batch reject notify failed: ' + errNotify);
      }

      return {
        updatedCount: updatedCount,
        level: lvl
      };
    }
  };
})();
