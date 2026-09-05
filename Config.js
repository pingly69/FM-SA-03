/**
 * Config.js - การตั้งค่าระบบ FormSA03 Checklist WebApp
 * จัดการและอ่านค่าจาก Script Properties ทั้งหมด ห้าม hardcode ใน business logic
 */

var Config = (function() {
  var DEFAULTS = {
    SPREADSHEET_ID: '1ZBy4XalB74HFWVKRo30OFJG48Gxe41FruBoDuLnuxF4',
    CENTRAL_APP_URL: 'https://script.google.com/macros/s/AKfycbwhbYUFPHlMq5KrtHRZUNTjeHsKtSF2IW0bEzJZwL-hqBhzFx3gXR4ijL83ajPs0zcQDA/exec',
    SHARED_TOKEN: 'secret-token-12345',
    LIFF_ID: '2009016720-NiJ6Jzhp',
    LINE_CHANNEL_ACCESS_TOKEN: 'K45XA5KmRF7LvubrCP62u0joB0MCNJWA0KjVd4EbKrtadLmFKOYSGLR/qsCo/UgY2v+pmcve5/hYyf0VQDo4RiU4nbYYjVFJ3Yik2qAWZaGF5UKlXhb1+vSLilGI2FiwfGUAy6H2LWubxOEmtnadkwdB04t89/1O/w1cDnyilFU=',
    APPROVE_TAG_L1: 'จป.วิชาชีพ',
    APPROVE_TAG_L2: 'จป.บริหาร',
    SCREEN_TAG: 'SA03',
    PROJECT_DATASET_KEY: 'site',
    ENABLE_SHEET_FALLBACK: 'false'
  };

  function getProp_(key) {
    try {
      var props = PropertiesService.getScriptProperties();
      var val = props.getProperty(key);
      if (val !== null && val !== undefined && val !== '') {
        return val;
      }
    } catch (e) {
      Logger.log('[Config] Error reading property ' + key + ': ' + e);
    }
    return DEFAULTS[key] || '';
  }

  return {
    getSpreadsheetId: function() {
      return getProp_('SPREADSHEET_ID');
    },
    getCentralAppUrl: function() {
      return getProp_('CENTRAL_APP_URL');
    },
    getSharedToken: function() {
      return getProp_('SHARED_TOKEN');
    },
    getLiffId: function() {
      return getProp_('LIFF_ID');
    },
    getLineChannelAccessToken: function() {
      return getProp_('LINE_CHANNEL_ACCESS_TOKEN');
    },
    getApproveTagL1: function() {
      return getProp_('APPROVE_TAG_L1');
    },
    getApproveTagL2: function() {
      return getProp_('APPROVE_TAG_L2');
    },
    getScreenTag: function() {
      return getProp_('SCREEN_TAG');
    },
    getProjectDatasetKey: function() {
      return getProp_('PROJECT_DATASET_KEY');
    },
    isSheetFallbackEnabled: function() {
      return getProp_('ENABLE_SHEET_FALLBACK') === 'true';
    },
    getAll: function() {
      var res = {};
      for (var k in DEFAULTS) {
        res[k] = getProp_(k);
      }
      return res;
    }
  };
})();
