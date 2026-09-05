/**
 * Utils.js - ยูทิลิตี้ส่วนกลางสำหรับระบบ FormSA03
 * ประกอบด้วย IdGenerator, DateUtils, ResponseUtils, TagUtils
 */

var IdGenerator = {
  /**
   * สร้าง TRANS_RECORD_ID แบบ Non-sequential O(1)
   * ตามสเปกหมวด 10: epoch ms (13 หลัก) + random 3 หลัก = รวม 16 หลัก
   * อยู่ในช่วง JavaScript Safe Integer (< 2^53 ≈ 9.007e15)
   */
  generateTransRecordId: function() {
    var ms = new Date().getTime().toString();
    var rand = Utilities.formatString('%03d', Math.floor(Math.random() * 1000));
    return Number(ms + rand);
  }
};

var DateUtils = {
  TIMEZONE: 'Asia/Bangkok',

  /**
   * คืนค่าวันที่วันนี้ใน Timezone Asia/Bangkok รูปแบบ yyyy-MM-dd
   */
  todayBangkok: function() {
    return Utilities.formatDate(new Date(), this.TIMEZONE, 'yyyy-MM-dd');
  },

  /**
   * คืนค่าวันเวลาปัจจุบันใน Timezone Asia/Bangkok รูปแบบ yyyy-MM-dd HH:mm:ss
   */
  nowBangkok: function() {
    return Utilities.formatDate(new Date(), this.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  },

  /**
   * จัดรูปแบบ Date object ตาม pattern ใน Timezone Asia/Bangkok
   */
  formatBangkok: function(date, pattern) {
    if (!date) return '';
    return Utilities.formatDate(new Date(date), this.TIMEZONE, pattern || 'yyyy-MM-dd HH:mm:ss');
  },

  /**
   * ตรวจสอบว่า string อยู่ในรูปแบบ yyyy-MM-dd หรือไม่
   */
  isValidDateString: function(str) {
    if (!str || typeof str !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(str);
  }
};

var ResponseUtils = {
  /**
   * ห่อหุ้ม Response กรณีสำเร็จตาม API Contract หมวด 9.1
   */
  ok: function(data) {
    return {
      success: true,
      ok: true,
      data: data !== undefined ? data : null
    };
  },

  /**
   * ห่อหุ้ม Response กรณีผิดพลาดตาม API Contract หมวด 9.1
   */
  fail: function(code, message, details) {
    return {
      success: false,
      ok: false,
      error: {
        code: code || 'SYSTEM_ERROR',
        message: message || 'เกิดข้อผิดพลาดในการประมวลผล',
        details: details || null
      }
    };
  }
};

var TagUtils = {
  /**
   * Parse JSON Tag อย่างปลอดภัย รองรับทั้ง JSON Array และ Comma-separated string
   * ตามข้อกำหนดใน spec-users-profile-api.md หัวข้อ 2.3
   */
  parseJsonTags: function(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    var str = String(val).trim();
    if (!str) return [];
    try {
      var parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(function(item) { return String(item).trim(); }).filter(Boolean);
      }
    } catch (e) {
      // Fallback กรณีข้อความไม่ใช่ JSON เช่น "จป.วิชาชีพ, SA03"
    }
    return str.split(',').map(function(item) {
      return item.replace(/[\[\]"']/g, '').trim();
    }).filter(Boolean);
  }
};
