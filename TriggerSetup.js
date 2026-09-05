/**
 * TriggerSetup.js - การตั้งค่า Time-driven Triggers สำหรับโปรเจกต์
 * ตามข้อกำหนด v1.2 หมวด 5.1.2
 */

function setupFormMasterCacheTrigger() {
  // ลบ Trigger เดิมของฟังก์ชันนี้ก่อนเพื่อป้องกัน Trigger ซ้ำซ้อน
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'refreshFormMasterCache') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // สร้าง Trigger ใหม่: ทำงานทุกวัน เวลา 05:00 น.
  ScriptApp.newTrigger('refreshFormMasterCache')
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .inTimezone('Asia/Bangkok')
    .create();

  Logger.log('⏰ ตั้งค่า Trigger refreshFormMasterCache ทุกวันเวลา 05:00 น. เรียบร้อยแล้ว');
}
