/**
 * Router.js - จุดรับ Request กลางของ Web App (doGet & doPost)
 * รองรับทั้งการเรนเดอร์ใน Apps Script และการเรียก Web API (JSON RPC) จาก GitHub Pages
 */

/**
 * ฟังก์ชันรับ GET Request
 * - หากมี query parameter ?action=... จะทำงานเป็น JSON API
 * - หากไม่มี จะเรนเดอร์ Web App HTML
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    var action = e.parameter.action;
    var result = null;
    try {
      if (action === 'verifyUser') {
        result = apiVerifyUser(e.parameter.lineUid);
      } else if (action === 'getChecklistForm') {
        result = apiGetChecklistForm(e.parameter.lineUid, e.parameter.transDate);
      } else if (action === 'getTransactionByDate') {
        result = apiGetTransactionByDate(e.parameter.lineUid, e.parameter.transDate);
      } else if (action === 'getApprovalQueue') {
        result = apiGetApprovalQueue(e.parameter.lineUid, e.parameter.monthFilter);
      } else {
        result = ResponseUtils.fail('INVALID_ACTION', 'Action ไม่ถูกต้อง: ' + action);
      }
    } catch (err) {
      result = ResponseUtils.fail('GET_ERROR', err.message);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // HTML Web App Mode
  var template = HtmlService.createTemplateFromFile('Index');
  template.liffId = Config.getLiffId();
  template.screenTag = Config.getScreenTag();

  return template.evaluate()
    .setTitle('FM-SA-03 | แบบตรวจความปลอดภัย & อนุมัติ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper สำหรับ Include HTML partials ใน Apps Script
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * รับ POST Request สำหรับ Web API จาก GitHub Pages หรือภายนอก
 */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (ex) {
        body = e.parameter || {};
      }
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    var action = body.action || '';
    var result = null;

    if (action === 'verifyUser') {
      result = apiVerifyUser(body.lineUid);
    } else if (action === 'getChecklistForm') {
      result = apiGetChecklistForm(body.lineUid, body.transDate);
    } else if (action === 'getTransactionByDate') {
      result = apiGetTransactionByDate(body.lineUid, body.transDate);
    } else if (action === 'saveChecklist') {
      result = apiSaveChecklist(body);
    } else if (action === 'resubmitChecklist') {
      result = apiResubmitChecklist(body);
    } else if (action === 'deleteChecklist') {
      result = apiDeleteChecklist(body);
    } else if (action === 'getApprovalQueue') {
      result = apiGetApprovalQueue(body.lineUid, body.monthFilter);
    } else if (action === 'approveAction') {
      result = apiApproveAction(body);
    } else if (action === 'rejectAction') {
      result = apiRejectAction(body);
    } else {
      result = ResponseUtils.fail('INVALID_ACTION', 'Action ไม่ถูกต้อง: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errResp = ResponseUtils.fail('SERVER_ERROR', err.message);
    return ContentService.createTextOutput(JSON.stringify(errResp))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
