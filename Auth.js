/**
 * Auth.js - โมดูลตรวจสอบตัวตนและการอนุญาตเข้าถึงหน้าจอ
 * เรียกใช้ Central Access Control API ตาม spec-users-profile-api.md
 */

var Auth = {
  /**
   * ตรวจสอบสิทธิ์ผู้ใช้ผ่าน LINE UID
   * @param {string} lineUid
   * @returns {Object} User profile object
   */
  verifyLineProfile: function(lineUid) {
    if (!lineUid) {
      throw new Error('AUTH_FAILED: ไม่พบ LINE UID ของผู้ใช้งาน');
    }

    var result = CentralApiService.verifyAccess(lineUid, Config.getScreenTag());
    if (!result || !result.ok || !result.authorized) {
      var msg = (result && result.message) ? result.message : 'ท่านไม่มีสิทธิ์เข้าใช้งานระบบแบบฟอร์ม SA03';
      var err = new Error(msg);
      err.code = (result && result.statusCode) ? result.statusCode : 'AUTH_DENIED';
      throw err;
    }

    return result.user;
  }
};

/**
 * Endpoint ให้ UI เรียกตรวจสอบตัวตนตอนเปิดแอป
 */
function apiVerifyUser(lineUid) {
  try {
    var user = Auth.verifyLineProfile(lineUid);
    return ResponseUtils.ok(user);
  } catch (e) {
    return ResponseUtils.fail(e.code || 'AUTH_DENIED', e.message);
  }
}
