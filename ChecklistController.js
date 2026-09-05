/**
 * ChecklistController.js - รับคำขอจาก Client ฝั่งหน้าจอ Checklist Entry
 * แปลง input, ตรวจสอบรูปแบบเบื้องต้น, เรียก Service, ห่อ Response
 */

function apiGetChecklistForm(lineUid, transDate) {
  try {
    var data = ChecklistService.getChecklistFormData(lineUid, transDate);
    return ResponseUtils.ok(data);
  } catch (e) {
    Logger.log('[ChecklistController] apiGetChecklistForm error: ' + e);
    return ResponseUtils.fail('GET_FORM_ERROR', e.message);
  }
}

function apiSaveChecklist(payload) {
  try {
    if (!payload || typeof payload !== 'object') {
      return ResponseUtils.fail('INVALID_PAYLOAD', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
    }
    var saved = ChecklistService.saveChecklist(payload);
    return ResponseUtils.ok(saved);
  } catch (e) {
    Logger.log('[ChecklistController] apiSaveChecklist error: ' + e);
    return ResponseUtils.fail('SAVE_ERROR', e.message);
  }
}

function apiResubmitChecklist(payload) {
  try {
    if (!payload || typeof payload !== 'object') {
      return ResponseUtils.fail('INVALID_PAYLOAD', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
    }
    var resubmitted = ChecklistService.resubmitChecklist(payload);
    return ResponseUtils.ok(resubmitted);
  } catch (e) {
    Logger.log('[ChecklistController] apiResubmitChecklist error: ' + e);
    return ResponseUtils.fail('RESUBMIT_ERROR', e.message);
  }
}
