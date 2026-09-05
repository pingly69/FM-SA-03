/**
 * Router.js - จุดรับ Request กลางของ Web App (doGet & doPost)
 * จัดการการเรนเดอร์หน้าเว็บ LIFF และ API Router กลาง
 */

/**
 * ฟังก์ชันเรนเดอร์ Web App หน้าแรก
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.liffId = Config.getLiffId();
  template.screenTag = Config.getScreenTag();

  return template.evaluate()
    .setTitle('FM-SA-03 | แบบตรวจความปลอดภัย & อนุมัติ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper สำหรับ Include HTML partials เช่น CSS_Common, JS_Common
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * รับ POST Request สำหรับ Web API ภายนอก (ถ้ามี)
 */
function doPost(e) {
  try {
    var body = e.postData ? JSON.parse(e.postData.contents) : {};
    var action = body.action || '';
    var result = null;

    if (action === 'verifyUser') {
      result = apiVerifyUser(body.lineUid);
    } else if (action === 'getChecklistForm') {
      result = apiGetChecklistForm(body.lineUid, body.transDate);
    } else if (action === 'saveChecklist') {
      result = apiSaveChecklist(body);
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
