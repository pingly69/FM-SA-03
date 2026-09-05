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
    }
  };
})();
