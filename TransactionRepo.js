/**
 * TransactionRepo.js - จัดการข้อมูลการตรวจสอบในชีต FMSA03_TRANSACTION
 * รองรับการค้นหา, เพิ่ม, แก้ไข และค้นหาคิวรออนุมัติ พร้อม LockService ป้องกัน Concurrency
 */

var TransactionRepo = (function() {
  var SHEET_NAME = 'FMSA03_TRANSACTION';

  var COLS = [
    'TRANS_RECORD_ID',
    'TRANS_DATE',
    'PROJECT',
    'Line_UID',
    'CREATE_DATETIME',
    'UPDATE_DATETIME',
    'approve_profile1',
    'approve_profile2',
    'STATUS',
    'APPROVE1_DATETIME',
    'APPROVE1_RESULT',
    'APPROVE2_DATETIME',
    'APPROVE2_RESULT',
    'REJECT_REASON',
    'RESUBMIT_COUNT',
    'ANSWERS_JSON'
  ];

  function getSheet_() {
    var ssId = Config.getSpreadsheetId();
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('ไม่พบชีต ' + SHEET_NAME + ' ใน Spreadsheet ID: ' + ssId);
    }
    return sheet;
  }

  function normalizeDate_(val) {
    if (!val) return '';
    if (val instanceof Date) {
      return DateUtils.formatBangkok(val, 'yyyy-MM-dd');
    }
    var str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      return DateUtils.formatBangkok(d, 'yyyy-MM-dd');
    }
    return str;
  }

  function rowToObject_(row, rowIndex) {
    if (!row || row.length === 0 || !row[0]) return null;

    var answers = {};
    var answersJson = String(row[15] || '').trim();
    if (answersJson) {
      try {
        answers = JSON.parse(answersJson);
      } catch (e) {
        Logger.log('[TransactionRepo] Failed to parse ANSWERS_JSON for ID ' + row[0] + ': ' + e);
      }
    }

    return {
      rowIndex: rowIndex,
      transRecordId: Number(row[0]),
      transDate: normalizeDate_(row[1]),
      project: String(row[2] || '').trim(),
      lineUid: String(row[3] || '').trim(),
      createDatetime: String(row[4] || ''),
      updateDatetime: String(row[5] || ''),
      approveProfile1: String(row[6] || '').trim(),
      approveProfile2: String(row[7] || '').trim(),
      status: String(row[8] || '').trim(),
      approve1Datetime: String(row[9] || ''),
      approve1Result: String(row[10] || '').trim(),
      approve2Datetime: String(row[11] || ''),
      approve2Result: String(row[12] || '').trim(),
      rejectReason: String(row[13] || '').trim(),
      resubmitCount: Number(row[14] || 0),
      answersJson: answersJson,
      answers: answers
    };
  }

  return {
    /**
     * ค้นหารายการตาม Line UID และ วันที่ตรวจ (yyyy-MM-dd)
     */
    findByUserAndDate: function(lineUid, transDate) {
      if (!lineUid || !transDate) return null;
      var sheet = getSheet_();
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return null;

      var targetDateStr = String(transDate).trim();
      var targetUidStr = String(lineUid).trim();

      // ค้นหาย้อนจากล่างขึ้นบนเพื่อให้ได้ข้อมูลล่าสุด
      for (var i = data.length - 1; i >= 1; i--) {
        var row = data[i];
        var rowDate = normalizeDate_(row[1]);
        var rowUid = String(row[3] || '').trim();

        if (rowDate === targetDateStr && rowUid === targetUidStr) {
          return rowToObject_(row, i + 1);
        }
      }
      return null;
    },

    /**
     * ค้นหารายการตาม TRANS_RECORD_ID (PK)
     */
    findById: function(transRecordId) {
      if (!transRecordId) return null;
      var targetId = Number(transRecordId);
      var sheet = getSheet_();
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return null;

      for (var i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === targetId) {
          return rowToObject_(data[i], i + 1);
        }
      }
      return null;
    },

    /**
     * บันทึกรายการใหม่ลงชีต (Insert)
     */
    insert: function(record) {
      var lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000); // รอ lock สูงสุด 10 วินาที
        var sheet = getSheet_();

        var rowData = [
          Number(record.transRecordId),
          String(record.transDate),
          String(record.project || ''),
          String(record.lineUid),
          String(record.createDatetime || DateUtils.nowBangkok()),
          String(record.updateDatetime || ''),
          String(record.approveProfile1 || ''),
          String(record.approveProfile2 || ''),
          String(record.status || 'PENDING_L1'),
          String(record.approve1Datetime || ''),
          String(record.approve1Result || ''),
          String(record.approve2Datetime || ''),
          String(record.approve2Result || ''),
          String(record.rejectReason || ''),
          Number(record.resubmitCount || 0),
          typeof record.answers === 'object' ? JSON.stringify(record.answers) : String(record.answersJson || '{}')
        ];

        sheet.appendRow(rowData);
        return record;
      } finally {
        lock.releaseLock();
      }
    },

    /**
     * อัปเดตข้อมูลรายการเดิมตาม TRANS_RECORD_ID
     */
    update: function(transRecordId, updates) {
      var lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
        var sheet = getSheet_();
        var data = sheet.getDataRange().getValues();
        var targetId = Number(transRecordId);

        var targetRowIndex = -1;
        for (var i = 1; i < data.length; i++) {
          if (Number(data[i][0]) === targetId) {
            targetRowIndex = i + 1; // 1-indexed for Sheet API
            break;
          }
        }

        if (targetRowIndex === -1) {
          throw new Error('ไม่พบข้อมูลรายการ ID: ' + transRecordId);
        }

        var row = data[targetRowIndex - 1];

        // Apply updates
        if (updates.project !== undefined) row[2] = updates.project;
        if (updates.approveProfile1 !== undefined) row[6] = updates.approveProfile1;
        if (updates.approveProfile2 !== undefined) row[7] = updates.approveProfile2;
        if (updates.status !== undefined) row[8] = updates.status;
        if (updates.approve1Datetime !== undefined) row[9] = updates.approve1Datetime;
        if (updates.approve1Result !== undefined) row[10] = updates.approve1Result;
        if (updates.approve2Datetime !== undefined) row[11] = updates.approve2Datetime;
        if (updates.approve2Result !== undefined) row[12] = updates.approve2Result;
        if (updates.rejectReason !== undefined) row[13] = updates.rejectReason;
        if (updates.resubmitCount !== undefined) row[14] = updates.resubmitCount;
        if (updates.answers !== undefined) {
          row[15] = typeof updates.answers === 'object' ? JSON.stringify(updates.answers) : String(updates.answers);
        }

        row[5] = updates.updateDatetime || DateUtils.nowBangkok(); // UPDATE_DATETIME

        var range = sheet.getRange(targetRowIndex, 1, 1, row.length);
        range.setValues([row]);

        return rowToObject_(row, targetRowIndex);
      } finally {
        lock.releaseLock();
      }
    },

    /**
     * ค้นหารายการคอยอนุมัติระดับ 1 (PENDING_L1) ที่ระบุ approve_profile1
     * @param {string} approverName ชื่อผู้อนุมัติ
     * @param {string} [monthFilter] กรองเดือน เช่น "2026-09"
     */
    findPendingL1Queue: function(approverName, monthFilter) {
      var sheet = getSheet_();
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return [];

      var queue = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var status = String(row[8] || '').trim();
        var apv1 = String(row[6] || '').trim();
        var tDate = normalizeDate_(row[1]);

        if (status === 'PENDING_L1' && apv1 === approverName) {
          if (!monthFilter || tDate.indexOf(monthFilter) === 0) {
            queue.push(rowToObject_(row, i + 1));
          }
        }
      }

      // เรียงจากวันที่ใหม่สุดมาเก่าสุด
      queue.sort(function(a, b) {
        return b.transDate.localeCompare(a.transDate) || b.transRecordId - a.transRecordId;
      });

      return queue;
    },

    /**
     * ค้นหารายการคอยอนุมัติระดับ 2 (PENDING_L2) ที่ระบุ approve_profile2
     * @param {string} approverName ชื่อผู้อนุมัติ
     */
    findPendingL2Queue: function(approverName) {
      var sheet = getSheet_();
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return [];

      var queue = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var status = String(row[8] || '').trim();
        var apv2 = String(row[7] || '').trim();

        if (status === 'PENDING_L2' && apv2 === approverName) {
          queue.push(rowToObject_(row, i + 1));
        }
      }

      queue.sort(function(a, b) {
        return b.transDate.localeCompare(a.transDate) || b.transRecordId - a.transRecordId;
      });

      return queue;
    },

    /**
     * ลบรายการตาม TRANS_RECORD_ID (ต้องเป็นเจ้าของ lineUid)
     */
    delete: function(transRecordId, lineUid) {
      var lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
        var sheet = getSheet_();
        var data = sheet.getDataRange().getValues();
        var targetId = Number(transRecordId);

        var targetRowIndex = -1;
        var rowUid = '';
        var rowStatus = '';

        for (var i = 1; i < data.length; i++) {
          if (Number(data[i][0]) === targetId) {
            targetRowIndex = i + 1;
            rowUid = String(data[i][3] || '').trim();
            rowStatus = String(data[i][8] || '').trim();
            break;
          }
        }

        if (targetRowIndex === -1) {
          throw new Error('ไม่พบข้อมูลรายการ ID: ' + transRecordId);
        }

        if (lineUid && rowUid !== String(lineUid).trim()) {
          throw new Error('ไม่มีสิทธิ์ลบรายการนี้ (ไม่ใช่เจ้าของข้อมูล)');
        }

        if (rowStatus === 'APPROVED' || rowStatus === 'PENDING_L2') {
          throw new Error('ไม่สามารถลบรายการที่ผ่านการอนุมัติหรืออยู่ระหว่างการอนุมัติระดับ 2 ได้');
        }

        sheet.deleteRow(targetRowIndex);
        return { success: true, deletedId: targetId };
      } finally {
        lock.releaseLock();
      }
    }
  };
})();
