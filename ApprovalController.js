/**
 * ApprovalController.js - รับคำขอจาก Client ฝั่งหน้าจอ Approval Queue
 * จัดการคิวอนุมัติระดับ 1 และ 2, สั่ง Approve / Reject
 */

function apiGetApprovalQueue(lineUid, monthFilter) {
  try {
    if (!lineUid) {
      return ResponseUtils.fail('MISSING_UID', 'ไม่ได้ระบุ LINE UID');
    }
    var queueData = ApprovalService.getApprovalQueue(lineUid, monthFilter);
    return ResponseUtils.ok(queueData);
  } catch (e) {
    Logger.log('[ApprovalController] apiGetApprovalQueue error: ' + e);
    return ResponseUtils.fail('QUEUE_ERROR', e.message);
  }
}

function apiApproveAction(payload) {
  try {
    if (!payload) return ResponseUtils.fail('INVALID_PAYLOAD', 'ข้อมูลไม่ถูกต้อง');
    var res = ApprovalService.approveAction(
      payload.lineUid,
      payload.level,
      payload.transRecordIds,
      payload.approveProfile2
    );
    return ResponseUtils.ok(res);
  } catch (e) {
    Logger.log('[ApprovalController] apiApproveAction error: ' + e);
    return ResponseUtils.fail('APPROVE_ERROR', e.message);
  }
}

function apiRejectAction(payload) {
  try {
    if (!payload) return ResponseUtils.fail('INVALID_PAYLOAD', 'ข้อมูลไม่ถูกต้อง');
    var res = ApprovalService.rejectAction(
      payload.lineUid,
      payload.level,
      payload.transRecordIds,
      payload.reason
    );
    return ResponseUtils.ok(res);
  } catch (e) {
    Logger.log('[ApprovalController] apiRejectAction error: ' + e);
    return ResponseUtils.fail('REJECT_ERROR', e.message);
  }
}
