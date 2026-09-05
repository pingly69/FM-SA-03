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

      return {
        user: user,
        approverName: approverName,
        asL1: asL1,
        asL2: asL2,
        l2Approvers: l2Approvers
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
      var updatedCount = 0;

      for (var i = 0; i < transRecordIds.length; i++) {
        var txId = transRecordIds[i];
        var tx = TransactionRepo.findById(txId);
        if (!tx) {
          throw new Error('ไม่พบรายการรหัส ' + txId);
        }

        if (lvl === 1) {
          // V-7: ตรวจสอบสิทธิ์ผู้มีอำนาจอนุมัติ L1
          if (tx.approveProfile1 !== approverName) {
            throw new Error('คุณไม่มีสิทธิ์อนุมัติรายการรหัส ' + txId + ' (ชื่อผู้อนุมัติ L1 ไม่ตรงกัน)');
          }
          if (tx.status !== 'PENDING_L1') {
            throw new Error('รายการรหัส ' + txId + ' ไม่อยู่ในสถานะรออนุมัติระดับ 1');
          }

          TransactionRepo.update(txId, {
            status: 'PENDING_L2',
            approve1Result: 'APPROVED',
            approve1Datetime: now,
            approveProfile2: approveProfile2,
            updateDatetime: now
          });
          updatedCount++;

          // แจ้งเตือนไปยัง L2
          try {
            var l2List = CentralApiService.getApproveList(Config.getApproveTagL2());
            var l2User = null;
            for (var k = 0; k < l2List.length; k++) {
              if (l2List[k].users_name === approveProfile2) {
                l2User = l2List[k];
                break;
              }
            }
            if (l2User && l2User.line_uid) {
              NotifyService.notifyL2Pending(l2User.line_uid, approverName, tx.project, tx.transDate, 1);
            }
          } catch (errNotify) {
            Logger.log('[ApprovalService] Notify L2 failed: ' + errNotify);
          }

        } else if (lvl === 2) {
          // V-7: ตรวจสอบสิทธิ์ผู้มีอำนาจอนุมัติ L2
          if (tx.approveProfile2 !== approverName) {
            throw new Error('คุณไม่มีสิทธิ์อนุมัติรายการรหัส ' + txId + ' (ชื่อผู้อนุมัติ L2 ไม่ตรงกัน)');
          }
          if (tx.status !== 'PENDING_L2') {
            throw new Error('รายการรหัส ' + txId + ' ไม่อยู่ในสถานะรออนุมัติระดับ 2');
          }

          TransactionRepo.update(txId, {
            status: 'APPROVED',
            approve2Result: 'APPROVED',
            approve2Datetime: now,
            updateDatetime: now
          });
          updatedCount++;

          // แจ้งเตือนไปยัง Requester ว่าผ่านสมบูรณ์แล้ว
          try {
            if (tx.lineUid) {
              NotifyService.notifyRequesterApproved(tx.lineUid, approverName, tx.project, tx.transDate);
            }
          } catch (errNotify) {
            Logger.log('[ApprovalService] Notify Requester failed: ' + errNotify);
          }
        }
      }

      return {
        updatedCount: updatedCount,
        level: lvl
      };
    },

    /**
     * ดำเนินการปฏิเสธ (Reject Action - ตีกลับให้ผู้ตรวจแก้ไข)
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
      var updatedCount = 0;

      for (var i = 0; i < transRecordIds.length; i++) {
        var txId = transRecordIds[i];
        var tx = TransactionRepo.findById(txId);
        if (!tx) {
          throw new Error('ไม่พบรายการรหัส ' + txId);
        }

        var updates = {
          status: 'REJECTED',
          rejectReason: cleanReason,
          updateDatetime: now
        };

        if (lvl === 1) {
          if (tx.approveProfile1 !== approverName) {
            throw new Error('คุณไม่มีสิทธิ์ปฏิเสธรายการรหัส ' + txId);
          }
          updates.approve1Result = 'REJECTED';
          updates.approve1Datetime = now;
        } else if (lvl === 2) {
          if (tx.approveProfile2 !== approverName) {
            throw new Error('คุณไม่มีสิทธิ์ปฏิเสธรายการรหัส ' + txId);
          }
          updates.approve2Result = 'REJECTED';
          updates.approve2Datetime = now;
        }

        TransactionRepo.update(txId, updates);
        updatedCount++;

        // แจ้งเตือนเจ้าของรายการ (Requester)
        try {
          if (tx.lineUid) {
            NotifyService.notifyRequesterRejected(tx.lineUid, approverName, lvl, cleanReason, tx.project, tx.transDate);
          }
        } catch (errNotify) {
          Logger.log('[ApprovalService] Notify Requester rejected failed: ' + errNotify);
        }
      }

      return {
        updatedCount: updatedCount,
        level: lvl
      };
    }
  };
})();
