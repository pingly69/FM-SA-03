/**
 * ChecklistService.js - Business Logic การบันทึกและแก้ไขแบบฟอร์มตรวจสอบ
 * ควบคุมกฎ BR-1, BR-2, BR-3, BR-4 และ Validation Rules ทั้งหมด
 */

var ChecklistService = (function() {

  /**
   * ตรวจสอบว่าคำตอบครบทุกข้อตาม BR-3 หรือไม่
   */
  function validateAllQuestionsAnswered_(questions, answers) {
    if (!answers || typeof answers !== 'object') {
      return { valid: false, missingId: null };
    }

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      if (q.header_flag === 'N') {
        var ans = answers[q.record_id];
        if (ans !== 'Y' && ans !== 'N' && ans !== '-') {
          return { valid: false, missingId: q.record_id, itemName: q.item_name };
        }
      }
    }
    return { valid: true };
  }

  return {
    /**
     * ดึงข้อมูลสำหรับเรนเดอร์หน้าจอ Checklist:
     * - ชุดคำถามจาก FORM_MASTER (ผ่าน Cache)
     * - รายชื่อโครงการ (จาก Central API)
     * - รายชื่อผู้อนุมัติระดับ 1 (จาก Central API Tag "จป.วิชาชีพ")
     * - ข้อมูลเดิมที่เคยบันทึกไว้ในวันนั้น (ถ้ามี)
     */
    getChecklistFormData: function(lineUid, transDate) {
      var targetDate = transDate || DateUtils.todayBangkok();
      var questions = FormMasterRepo.getFormMasterCached();
      var projects = CentralApiService.getProjectList();
      var l1Approvers = CentralApiService.getApproveList(Config.getApproveTagL1());

      var existingTx = null;
      var isEditable = true;
      var lockReason = '';

      if (lineUid) {
        existingTx = TransactionRepo.findByUserAndDate(lineUid, targetDate);
        if (existingTx) {
          if (existingTx.status === 'APPROVED') {
            isEditable = false;
            lockReason = 'รายการของวันนี้ได้รับการอนุมัติสมบูรณ์แล้ว (ล็อกการแก้ไข)';
          } else if (existingTx.status === 'PENDING_L2') {
            isEditable = false;
            lockReason = 'รายการกำลังอยู่ระหว่างการพิจารณาอนุมัติระดับ 2 (ล็อกการแก้ไข)';
          }
        }
      }

      return {
        transDate: targetDate,
        questions: questions,
        projects: projects,
        l1Approvers: l1Approvers,
        transaction: existingTx,
        isEditable: isEditable,
        lockReason: lockReason
      };
    },

    /**
     * บันทึกข้อมูลแบบฟอร์มตรวจสอบ (Create หรือ Update)
     * บังคับใช้ BR-1, BR-2, BR-3
     */
    saveChecklist: function(payload) {
      var lineUid = String(payload.lineUid || '').trim();
      var transDate = String(payload.transDate || '').trim();
      var project = String(payload.project || '').trim();
      var approveProfile1 = String(payload.approveProfile1 || '').trim();
      var answers = payload.answers || {};

      if (!lineUid) throw new Error('ไม่พบ LINE UID ของผู้ใช้งาน');
      if (!transDate || !DateUtils.isValidDateString(transDate)) throw new Error('รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น yyyy-MM-dd)');
      if (!project) throw new Error('กรุณาเลือกโครงการ');
      if (!approveProfile1) throw new Error('กรุณาเลือกผู้อนุมัติระดับ 1');

      // V-1 / BR-3: ตรวจสอบว่าตอบครบทุกข้อคำถาม
      var questions = FormMasterRepo.getFormMasterCached();
      var valRes = validateAllQuestionsAnswered_(questions, answers);
      if (!valRes.valid) {
        throw new Error('กรุณาตอบคำถามให้ครบทุกข้อ (ข้อที่ยังไม่ตอบ: ' + (valRes.itemName || valRes.missingId) + ')');
      }

      // ตรวจสอบข้อมูลเดิมตาม BR-1 และ BR-2
      var existing = TransactionRepo.findByUserAndDate(lineUid, transDate);

      if (existing) {
        // BR-2: ถ้าอยู่ใน PENDING_L2 หรือ APPROVED ห้ามแก้ไขเด็ดขาด
        if (existing.status === 'APPROVED') {
          throw new Error('รายการของวันนี้อนุมัติสมบูรณ์แล้ว ไม่สามารถแก้ไขได้');
        }
        if (existing.status === 'PENDING_L2') {
          throw new Error('รายการอยู่ระหว่างรออนุมัติระดับ 2 ไม่สามารถแก้ไขได้');
        }

        // กรณีเป็นสถานะ REJECTED หรือ PENDING_L1 สามารถอัปเดตได้
        var updates = {
          project: project,
          approveProfile1: approveProfile1,
          answers: answers,
          updateDatetime: DateUtils.nowBangkok()
        };

        // ถ้าสถานะเดิมคือ REJECTED ให้ปรับใช้กฎ BR-4
        if (existing.status === 'REJECTED') {
          updates.status = 'PENDING_L1';
          updates.approve1Result = '';
          updates.approve1Datetime = '';
          updates.approve2Result = '';
          updates.approve2Datetime = '';
          updates.approveProfile2 = '';
          updates.rejectReason = '';
          updates.resubmitCount = (existing.resubmitCount || 0) + 1;
        }

        var updated = TransactionRepo.update(existing.transRecordId, updates);
        return updated;
      } else {
        // สร้าง Record ใหม่
        var newRecord = {
          transRecordId: IdGenerator.generateTransRecordId(),
          transDate: transDate,
          project: project,
          lineUid: lineUid,
          createDatetime: DateUtils.nowBangkok(),
          updateDatetime: '',
          approveProfile1: approveProfile1,
          approveProfile2: '',
          status: 'PENDING_L1',
          approve1Datetime: '',
          approve1Result: '',
          approve2Datetime: '',
          approve2Result: '',
          rejectReason: '',
          resubmitCount: 0,
          answers: answers
        };

        var saved = TransactionRepo.insert(newRecord);
        return saved;
      }
    },

    /**
     * ส่งอนุมัติใหม่จากสถานะ REJECTED ตาม BR-4
     */
    resubmitChecklist: function(payload) {
      if (!payload.transRecordId) {
        throw new Error('จำเป็นต้องระบุ transRecordId ในการส่งอนุมัติใหม่');
      }
      return this.saveChecklist(payload);
    }
  };
})();
