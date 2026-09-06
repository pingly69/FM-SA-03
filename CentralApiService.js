/**
 * CentralApiService.js - ตัวเชื่อมต่อ MasterCacheAPI และ Access Control Service
 * อ้างอิงเอกสาร: spec-users-profile-api.md (SPEC-IAM-2026-V2.0) และ integration-guide.md
 */

var CentralApiService = (function() {
  function postRequest_(payload) {
    var url = Config.getCentralAppUrl();
    var token = Config.getSharedToken();
    payload.token = token;

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      var response = UrlFetchApp.fetch(url, options);
      var text = response.getContentText();
      return JSON.parse(text);
    } catch (e) {
      Logger.log('[CentralApiService] HTTP Error calling ' + url + ': ' + e);
      throw new Error('ไม่สามารถเชื่อมต่อ Central API: ' + (e.message || e));
    }
  }

  return {
    /**
     * ตรวจสอบตัวตนและสิทธิ์เข้าถึงหน้าจอตาม spec-users-profile-api.md หมวด 4.1
     * @param {string} lineUid LINE UID ของผู้ใช้งาน
     * @param {string} [screen] รหัสหน้าจอ (default: 'SA03')
     * @returns {Object} { ok, authorized, statusCode, message, user }
     */
    verifyAccess: function(lineUid, screen) {
      if (!lineUid) {
        return {
          ok: false,
          authorized: false,
          statusCode: 'MISSING_LINE_UID',
          message: 'ไม่ได้ระบุ LINE UID'
        };
      }

      // รองรับ Mock Testing เมื่อรันนอก LINE LIFF ในโหมด Development
      if (lineUid.indexOf('MOCK_') === 0) {
        Logger.log('[CentralApiService] Using MOCK profile for ' + lineUid);
        return {
          ok: true,
          authorized: true,
          statusCode: 'ACCESS_GRANTED',
          message: 'Access granted (Mock)',
          user: {
            users_id: 'usr_mock_dev',
            users_name: 'ผู้ทดสอบระบบ (Dev Tester)',
            emp_no: 'EMP9999',
            email: 'tester@company.com',
            line_uid: lineUid,
            active: 'Y',
            screen_tags: ['SA03'],
            approve_tags: ['จป.วิชาชีพ', 'จป.บริหาร']
          }
        };
      }

      var targetScreen = screen || Config.getScreenTag();
      var cache = CacheService.getScriptCache();
      var cacheKey = 'AUTH_VERIFY_' + encodeURIComponent(lineUid) + '_' + encodeURIComponent(targetScreen);
      var cached = cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }

      var payload = {
        action: 'verifyAccess',
        datasetKey: 'users_profile',
        line_uid: lineUid,
        screen: targetScreen,
        forceFresh: false
      };

      try {
        var res = postRequest_(payload);
        if (res && res.ok) {
          try {
            cache.put(cacheKey, JSON.stringify(res), 600); // แคช 10 นาที
          } catch (ce) {}
        }
        return res;
      } catch (err) {
        Logger.log('[CentralApiService] verifyAccess failed: ' + err);
        return {
          ok: false,
          authorized: false,
          statusCode: 'API_CONNECTION_ERROR',
          message: 'เชื่อมต่อระบบตรวจสอบสิทธิ์กลางล้มเหลว: ' + err.message
        };
      }
    },

    /**
     * ดึงรายชื่อผู้อนุมัติตาม Tag ตาม spec-users-profile-api.md หมวด 4.2
     * @param {string} approveTag เช่น "จป.วิชาชีพ" หรือ "จป.บริหาร"
     * @returns {Array<Object>} รายชื่อผู้อนุมัติ [{ users_id, users_name, line_uid, emp_no, email }]
     */
    getApproveList: function(approveTag) {
      if (!approveTag) return [];

      var cache = CacheService.getScriptCache();
      var cacheKey = 'APPROVE_LIST_' + encodeURIComponent(approveTag);
      var cached = cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }

      var payload = {
        action: 'getApproveList',
        datasetKey: 'users_profile',
        approve_tag: approveTag,
        forceFresh: false
      };

      try {
        var res = postRequest_(payload);
        if (res && res.ok && Array.isArray(res.data)) {
          // เก็บใน Cache 15 นาที เพื่อลด request ซ้ำ
          try {
            cache.put(cacheKey, JSON.stringify(res.data), 900);
          } catch (e) {}
          return res.data;
        }
        return [];
      } catch (e) {
        Logger.log('[CentralApiService] getApproveList failed for tag ' + approveTag + ': ' + e);
        return [];
      }
    },

    /**
     * ดึงรายชื่อโครงการ/สาขา จาก Central Cache (datasetKey: "site")
     * ตาม integration-guide.md
     * @returns {Array<string>} รายชื่อโครงการ
     */
    getProjectList: function() {
      var datasetKey = Config.getProjectDatasetKey() || 'site';
      var cache = CacheService.getScriptCache();
      var cacheKey = 'PROJECT_LIST_' + datasetKey;
      var cached = cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }

      var payload = {
        action: 'getList',
        datasetKey: datasetKey,
        forceFresh: false
      };

      try {
        var res = postRequest_(payload);
        if (res && res.ok && Array.isArray(res.data)) {
          cache.put(cacheKey, JSON.stringify(res.data), 1800); // แคช 30 นาที
          return res.data;
        }
      } catch (e) {
        Logger.log('[CentralApiService] getProjectList failed: ' + e);
      }

      // Fallback รายชื่อโครงการตัวอย่างกรณีระบบกลางขัดข้อง
      return [
        'สำนักงานใหญ่ (HQ)',
        'โครงการก่อสร้าง A (Bangkok)',
        'โรงงานผลิต 1 (Chonburi)',
        'คลังสินค้ากลาง (Rayong)',
        'ศูนย์กระจายสินค้า (Ayutthaya)'
      ];
    },

    /**
     * ดึง Map รายชื่อผู้ใช้ตาม LINE UID { [line_uid]: users_name }
     * เพื่อนำชื่อผู้ตรวจไปแสดงผลแทน LINE UID ในหน้าจออนุมัติ
     * แคชใน ScriptCache 30 นาที (1800 วินาที) ทำให้ไม่ต้องโหลดซ้ำ และไม่ทำให้ระบบช้าลง
     */
    getUserMapByLineUid: function() {
      var cache = CacheService.getScriptCache();
      var cacheKey = 'USER_MAP_BY_LINE_UID';
      var cached = cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }

      var payload = {
        action: 'getList',
        datasetKey: 'users_profile',
        forceFresh: false
      };

      try {
        var res = postRequest_(payload);
        if (res && res.ok && res.data && res.data.byLineUid) {
          var simpleMap = {
            'MOCK_LINE_UID_001': 'นายสมเกียรติ มั่นคง (ช่างเทคนิค)',
            'MOCK_USER_001': 'ผู้ทดสอบระบบ (Dev Tester)'
          };
          var rawMap = res.data.byLineUid;
          for (var uid in rawMap) {
            if (rawMap.hasOwnProperty(uid)) {
              var u = rawMap[uid];
              if (u && u.users_name) {
                simpleMap[uid] = u.users_name;
              }
            }
          }
          try {
            cache.put(cacheKey, JSON.stringify(simpleMap), 1800);
          } catch (ce) {}
          return simpleMap;
        }
      } catch (e) {
        Logger.log('[CentralApiService] getUserMapByLineUid failed: ' + e);
      }

      return {};
    }
  };
})();
