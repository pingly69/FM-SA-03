/**
 * FormMasterRepo.js - Repository สำหรับอ่านและจัดการ FORM_MASTER
 * ตามข้อกำหนด v1.2 (Decision D5 & หมวด 5.1.2):
 * - อ่านจากแท็บ FORM_MASTER ในไฟล์ Spreadsheet เดียวกับ Transaction
 * - Cache ด้วย CacheService.getScriptCache() อายุ 6 ชม. (21,600 วินาที)
 * - มีฟังก์ชัน refreshFormMasterCache() สำหรับ Trigger และ Manual Refresh
 */

var FormMasterRepo = (function() {
  var CACHE_KEY = 'FORM_MASTER_CACHE_V2';
  var CACHE_TTL = 21600; // 6 ชั่วโมง (สูงสุดที่ Google Apps Script อนุญาต)
  var SHEET_NAME = 'FORM_MASTER';

  /**
   * อ่านข้อมูล FORM_MASTER ผ่าน Cache (Lazy Refresh เมื่อ Cache Miss)
   * @returns {Array<Object>} รายการคำถามทั้งหมด
   */
  function getFormMasterCached() {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        Logger.log('[FormMasterRepo] Error parsing cached data, falling back to sheet: ' + e);
      }
    }

    var data = readFormMasterFromSheet_();
    try {
      cache.put(CACHE_KEY, JSON.stringify(data), CACHE_TTL);
    } catch (e) {
      Logger.log('[FormMasterRepo] Warning: Failed to put in cache (data might exceed 100KB): ' + e);
    }
    return data;
  }

  /**
   * บังคับล้างและเขียน Cache ใหม่ (สำหรับ Time-driven Trigger หรือ Admin Action)
   */
  function refreshFormMasterCache() {
    var cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY);
    var data = readFormMasterFromSheet_();
    try {
      cache.put(CACHE_KEY, JSON.stringify(data), CACHE_TTL);
      Logger.log('[FormMasterRepo] Cache refreshed successfully. Total items: ' + data.length);
    } catch (e) {
      Logger.log('[FormMasterRepo] Cache refresh warning: ' + e);
    }
    return data;
  }

  /**
   * อ่านข้อมูลสดจาก Google Sheet โดยตรง
   * ใช้ getDisplayValues() เพื่อรักษาฟอร์แมตเลขข้อ เช่น "1.10", "1.11" ให้ครบถ้วน ไม่ถูกตัดเป็น float
   * @private
   */
  function readFormMasterFromSheet_() {
    var ssId = Config.getSpreadsheetId();
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('ไม่พบชีต ' + SHEET_NAME + ' ใน Spreadsheet ID: ' + ssId);
    }

    var values = sheet.getDataRange().getDisplayValues();
    if (values.length <= 1) {
      return [];
    }

    var headers = values.shift();
    // Normalize headers to lowercase
    var colMap = {};
    headers.forEach(function(h, idx) {
      colMap[String(h).trim().toLowerCase()] = idx;
    });

    var items = [];
    values.forEach(function(row) {
      var recordId = row[colMap['record_id']];
      var itemName = row[colMap['item_name']];
      var headerFlag = String(row[colMap['header_flag']] || 'N').trim().toUpperCase();
      var score = Number(row[colMap['score']] || 0);

      if (recordId !== '' && recordId !== null && recordId !== undefined) {
        items.push({
          record_id: String(recordId).trim(),
          item_name: String(itemName || '').trim(),
          header_flag: headerFlag === 'Y' ? 'Y' : 'N',
          score: isNaN(score) ? 0 : score
        });
      }
    });

    // คงลำดับจากบนลงล่างตามที่ผู้ดูแลระบบจัดเรียงไว้ในชีต FORM_MASTER โดยตรง
    return items;
  }

  return {
    getFormMasterCached: getFormMasterCached,
    refreshFormMasterCache: refreshFormMasterCache
  };
})();

/**
 * Global wrapper function for Time-driven Trigger
 */
function refreshFormMasterCache() {
  return FormMasterRepo.refreshFormMasterCache();
}
