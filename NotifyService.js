/**
 * NotifyService.js - บริการส่งการแจ้งเตือนผ่าน LINE Push Message
 * Fail-safe: ป้องกันไม่ให้ข้อผิดพลาดในการแจ้งเตือนส่งผลกระทบต่อ Database Transaction
 */

var NotifyService = (function() {
  var PUSH_URL = 'https://api.line.me/v2/bot/message/push';

  function sendPush_(toLineUid, messages) {
    if (!toLineUid || !toLineUid.startsWith('U')) {
      Logger.log('[NotifyService] Invalid or empty LINE UID: ' + toLineUid);
      return false;
    }

    var token = Config.getLineChannelAccessToken();
    if (!token) {
      Logger.log('[NotifyService] Warning: LINE_CHANNEL_ACCESS_TOKEN is not set.');
      return false;
    }

    var payload = {
      to: toLineUid,
      messages: Array.isArray(messages) ? messages : [messages]
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      var res = UrlFetchApp.fetch(PUSH_URL, options);
      var code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        Logger.log('[NotifyService] Push message sent to ' + toLineUid);
        return true;
      } else {
        Logger.log('[NotifyService] Push failed (' + code + '): ' + res.getContentText());
        return false;
      }
    } catch (e) {
      Logger.log('[NotifyService] Exception during push: ' + e);
      return false;
    }
  }

  return {
    /**
     * แจ้งเตือนผู้อนุมัติระดับ 2 เมื่อ L1 กดอนุมัติแล้ว
     */
    notifyL2Pending: function(l2LineUid, l1ApproverName, project, transDate, count) {
      var text = '🔔 แจ้งเตือนรายการรออนุมัติระดับ 2 (FM-SA-03)\n' +
        '• โครงการ: ' + (project || 'ไม่ระบุ') + '\n' +
        '• วันที่ตรวจสอบ: ' + (transDate || '') + '\n' +
        '• ผ่านการอนุมัติระดับ 1 โดย: ' + (l1ApproverName || '') + '\n' +
        '• จำนวน: ' + (count || 1) + ' รายการ\n\n' +
        '👉 กรุณาเปิดระบบเพื่อตรวจสอบและพิจารณาอนุมัติ';

      return sendPush_(l2LineUid, {
        type: 'text',
        text: text
      });
    },

    /**
     * แจ้งเตือนผู้ตรวจ (Requester) เมื่อรายการถูกปฏิเสธ (ตีกลับให้แก้ไข)
     */
    notifyRequesterRejected: function(requesterLineUid, rejectorName, level, reason, project, transDate) {
      var text = '⚠️ รายการตรวจสอบความปลอดภัย (FM-SA-03) ถูกตีกลับ\n' +
        '• โครงการ: ' + (project || 'ไม่ระบุ') + '\n' +
        '• วันที่ตรวจสอบ: ' + (transDate || '') + '\n' +
        '• ผู้ปฏิเสธ: ' + (rejectorName || '') + ' (ระดับ ' + level + ')\n' +
        '• เหตุผล: ' + (reason || 'ไม่ระบุเหตุผล') + '\n\n' +
        '👉 กรุณาเปิดระบบเพื่อแก้ไขข้อมูลและส่งอนุมัติใหม่อีกครั้ง';

      return sendPush_(requesterLineUid, {
        type: 'text',
        text: text
      });
    },

    /**
     * แจ้งเตือนผู้ตรวจเมื่อรายการได้รับการอนุมัติสมบูรณ์ (L2 Approve)
     */
    notifyRequesterApproved: function(requesterLineUid, l2ApproverName, project, transDate) {
      var text = '✅ รายการตรวจสอบความปลอดภัย (FM-SA-03) อนุมัติสมบูรณ์\n' +
        '• โครงการ: ' + (project || 'ไม่ระบุ') + '\n' +
        '• วันที่ตรวจสอบ: ' + (transDate || '') + '\n' +
        '• ผู้อนุมัติระดับ 2: ' + (l2ApproverName || '') + '\n' +
        '• สถานะ: อนุมัติสมบูรณ์ (Approved) เรียบร้อยแล้ว';

      return sendPush_(requesterLineUid, {
        type: 'text',
        text: text
      });
    },

    /**
     * รวบรวมสรุปข้อมูลรายการสำหรับส่งข้อความแจ้งเตือนรวมยอด (Batch Summary)
     */
    buildBatchSummary: function(items) {
      if (!items || items.length === 0) {
        return { totalCount: 0, dateRangeStr: '-', projectsStr: '-' };
      }
      var projectSet = {};
      var dates = [];
      for (var i = 0; i < items.length; i++) {
        var p = String(items[i].project || '').trim();
        if (p) projectSet[p] = true;
        if (items[i].transDate) dates.push(items[i].transDate);
      }
      var projects = Object.keys(projectSet);
      var projectsStr = projects.join(', ');
      if (projects.length > 2) {
        projectsStr = projects.slice(0, 2).join(', ') + ' และอื่นๆ (รวม ' + projects.length + ' โครงการ)';
      }

      dates.sort();
      var dateRangeStr = '';
      if (dates.length === 1 || dates[0] === dates[dates.length - 1]) {
        dateRangeStr = dates[0] || '-';
      } else {
        dateRangeStr = dates[0] + ' ถึง ' + dates[dates.length - 1];
      }

      return {
        totalCount: items.length,
        dateRangeStr: dateRangeStr,
        projectsStr: projectsStr || 'ไม่ระบุ'
      };
    },

    /**
     * แจ้งเตือนผู้อนุมัติระดับ 2 แบบรวมยอดใน 1 ข้อความ (L1 Batch Approval)
     */
    notifyL2PendingBatch: function(l2LineUid, l1ApproverName, summary) {
      var countText = summary.totalCount > 1 ? summary.totalCount + ' รายการ' : '1 รายการ';
      var text = '🔔 แจ้งเตือน: มีรายการรออนุมัติระดับ 2 (FM-SA-03)\n' +
        '• จำนวน: ' + countText + '\n' +
        '• โครงการ: ' + (summary.projectsStr || 'ไม่ระบุ') + '\n' +
        '• วันที่ตรวจ: ' + (summary.dateRangeStr || '-') + '\n' +
        '• ผ่านการอนุมัติระดับ 1 โดย: ' + (l1ApproverName || '') + '\n' +
        '• สถานะ: รอท่านพิจารณาอนุมัติระดับ 2\n\n' +
        '👉 กรุณาเปิดระบบเพื่อตรวจสอบและพิจารณาอนุมัติ';

      return sendPush_(l2LineUid, {
        type: 'text',
        text: text
      });
    },

    /**
     * แจ้งเตือนผู้ตรวจ (Requester) แบบรวมยอดเมื่อ L2 อนุมัติสมบูรณ์ (L2 Batch Approval)
     */
    notifyRequesterApprovedBatch: function(requesterLineUid, l2ApproverName, summary) {
      var countText = summary.totalCount > 1 ? summary.totalCount + ' รายการ' : '1 รายการ';
      var text = '✅ รายการตรวจความปลอดภัย (FM-SA-03) อนุมัติสมบูรณ์แล้ว\n' +
        '• จำนวน: ' + countText + '\n' +
        '• โครงการ: ' + (summary.projectsStr || 'ไม่ระบุ') + '\n' +
        '• วันที่ตรวจ: ' + (summary.dateRangeStr || '-') + '\n' +
        '• ผู้อนุมัติระดับ 2: ' + (l2ApproverName || '') + '\n' +
        '• สถานะ: อนุมัติสมบูรณ์ (Approved) เรียบร้อยแล้วทุกรายการ';

      return sendPush_(requesterLineUid, {
        type: 'text',
        text: text
      });
    },

    /**
     * แจ้งเตือนผู้ตรวจ (Requester) แบบรวมยอดเมื่อถูกปฏิเสธ/ตีกลับ (Batch Reject)
     */
    notifyRequesterRejectedBatch: function(requesterLineUid, rejectorName, level, reason, summary) {
      var countText = summary.totalCount > 1 ? summary.totalCount + ' รายการ' : '1 รายการ';
      var text = '⚠️ รายการตรวจความปลอดภัย (FM-SA-03) ถูกตีกลับให้แก้ไข\n' +
        '• จำนวน: ' + countText + '\n' +
        '• โครงการ: ' + (summary.projectsStr || 'ไม่ระบุ') + '\n' +
        '• วันที่ตรวจ: ' + (summary.dateRangeStr || '-') + '\n' +
        '• ผู้ปฏิเสธ: ' + (rejectorName || '') + ' (ระดับ ' + level + ')\n' +
        '• เหตุผล: ' + (reason || 'ไม่ระบุเหตุผล') + '\n\n' +
        '👉 กรุณาเปิดระบบเพื่อแก้ไขข้อมูลและส่งอนุมัติใหม่อีกครั้ง';

      return sendPush_(requesterLineUid, {
        type: 'text',
        text: text
      });
    }
  };
})();
