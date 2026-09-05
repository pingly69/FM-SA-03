# SPEC: FormSA03 Checklist WebApp (LINE LIFF + Google Apps Script)
**เอกสาร System Analysis & Development Specification**
**เวอร์ชัน:** 1.3 | **วันที่จัดทำ:** 2026-09-05 | **สถานะ:** อัปเดตตาม Requirement หน้างานและการทดสอบจริง (Decisions D6 - D11)

> เอกสารนี้เขียนขึ้นเพื่อให้ทีม Dev (รวมถึง AI dev) ตัดสินใจเรื่อง business logic ให้น้อยที่สุด ทุกจุดที่ผู้ให้โจทย์ระบุมาไม่ครบถ้วน จะถูกเติมเต็มด้วย "สมมติฐานของ SA" ที่ระบุไว้ชัดเจนว่าเป็นสมมติฐาน ไม่ใช่ requirement ดั้งเดิม — ทีม Dev ต้องยึดตามเอกสารนี้เป็นหลัก ไม่ต้องเดาเพิ่ม หากพบจุดที่ยังคลุมเครือระหว่างพัฒนา ให้กลับมาถามผู้ให้โจทย์ ไม่ใช่สมมติเอง

> **Changelog v1.3 (2026-09-05):** อัปเดตข้อกำหนดตามผลการทดสอบหน้างานจริงและการปรับปรุงระบบ:
> 1. **[D6] ปรับคำของปุ่มตัวเลือก Checklist บน UI:** เปลี่ยนจาก `"ปลอดภัย / มี (Y)"`, `"ไม่ปลอดภัย / ไม่มี (N)"`, `"ไม่เกี่ยวข้อง (-)"` ➡️ เป็น **`"✅ ผ่าน"`**, **`"❌ ไม่ผ่าน"`**, **`"➖ ไม่ตรวจ"`** เพื่อความกระชับและอ่านง่ายบนมือถือ (ส่วนข้อมูลที่บันทึกลงชีตและ JSON ยังคงเป็น `'Y'`, `'N'`, `'-'` เช่นเดิม 100%)
> 2. **[D7] ระบุ Role ผู้อนุมัติและ Security Token:** ยืนยันผู้อนุมัติระดับ 1 = `"จป.วิชาชีพ"` (`APPROVE_TAG_L1`), ผู้อนุมัติระดับ 2 = `"จป.บริหาร"` (`APPROVE_TAG_L2`) และ Shared Token = `"secret-token-12345"` กำหนดผ่าน Script Properties (ห้าม hardcode) พร้อมตัวช่วย `Setup.initProperties()`
> 3. **[D8] ปรับปรุงประสิทธิภาพ Config (In-Memory Caching):** ปรับ `Config.gs` ให้อ่าน Script Properties ด้วย `PropertiesService.getScriptProperties().getProperties()` **เพียงรอบเดียวต่อ 1 Execution** และแคชไว้ใน RAM (`_loadedProps`) เพื่อลด Latency สูงสุด แทนการยิง remote อ่านทีละ property ซ้ำๆ
> 4. **[D9] สถาปัตยกรรม Dual-Deployment (GitHub Pages + GAS):** รองรับการรันแบบ Standalone Web App บน GitHub Pages (`https://pingly69.github.io/FM-SA-03/`) เรียก Web API ไปยัง GAS ผ่าน POST/GET เพื่อแก้ปัญหา iframe ติดขัดใน LINE LIFF ควบคู่กับการรันแบบ Native GAS Web App
> 5. **[D10] การกำหนดสิทธิ์การ Deploy ใน `appsscript.json`:** ตั้งค่า `"access": "ANYONE_ANONYMOUS"` (ทุกคน แม้ไม่มีบัญชี Google) และ `"executeAs": "USER_DEPLOYING"` (รันในนามเจ้าของ) เพื่อให้ผู้ใช้ภายนอก/โฟร์แมนเปิดผ่าน LINE LIFF ได้ทันทีโดยไม่ติด Google Login Wall
> 6. **[D11] การปรับปรุง UI/UX & Visual Hierarchy:**
>    - นำป้าย `Safety Checklist` ออกจาก Navbar Header และเพิ่ม `white-space: nowrap;` ป้องกันข้อความไตเติลตกบรรทัดบนจอมือถือ
>    - ปรับขนาดและน้ำหนักตัวอักษรของหัวข้อคำถามตรวจให้โดดเด่น: ขยายเป็น `1.05rem` Bold 700 สี `#0F172A` และหมายเลขข้อ `1.15rem` Extra-bold 800 สี `#2563EB`
>    - ปรับขนาดปุ่มคำตอบให้พอดี `0.90rem` เพื่อให้หัวข้อการตรวจเด่นชัดกว่าปุ่มคำตอบ
>    - แก้ไข Bug CSS Focus/Hover Contrast บนหน้าจอมือถือ ที่ทำให้ข้อความกลายเป็นสีขาวบนพื้นขาวเมื่อกดเลือก

> **Changelog v1.2:** เปลี่ยนสถาปัตยกรรมการเก็บ/อ่าน `FORM_MASTER` จากการพิจารณาใช้ External `MasterCacheAPI` (ตาม OI-7 เดิม) มาเป็น **เก็บเป็น Sheet Tab ในไฟล์ Spreadsheet เดียวกับ `FMSA03_TRANSACTION`** พร้อมใช้ `CacheService` ของ Apps Script เอง (อายุ cache สูงสุด 6 ชม. ตามข้อจำกัดของ Google) และแยกฟังก์ชัน Clear/Write cache ไว้ต่างหากสำหรับ Time-driven Trigger เรียกทำงานทุกวัน — ดูรายละเอียดที่ D5, หมวด 4, หมวด 5.1.2, หมวด 6, OI-7 (ปิดแล้ว)

---

## สารบัญ
0. Decision Log (คำตอบที่ยืนยันแล้วจาก Stakeholder)
1. ภาพรวมระบบและวัตถุประสงค์
2. Actors / บทบาทผู้ใช้งาน
3. สถาปัตยกรรมระบบ (Architecture)
4. โครงสร้างไฟล์โปรเจกต์ Google Apps Script
5. Data Dictionary (ตารางข้อมูลทั้งหมด)
6. Configuration / Script Properties
7. Business Rules & Workflow (State Machine การอนุมัติ)
8. Function Spec รายหน้าจอ
9. API Contract (Server Functions / Endpoints)
10. การสร้าง TRANS_RECORD_ID (Non-sequential Unique ID)
11. Timezone & Date Handling
12. Validation Rules & Error Handling
13. Open Items — ต้องยืนยันกับผู้ให้โจทย์ก่อนขึ้น Production
14. UI/UX Requirements (Mobile-first)
15. ภาคผนวก: ขั้นตอนเพิ่มข้อคำถามใหม่ในอนาคต

---

## 0. Decision Log (คำตอบที่ยืนยันแล้วจาก Stakeholder)

| # | ประเด็น | คำตอบที่ยืนยันแล้ว |
|---|---|---|
| D1 | ตาราง `FORM_MASTER` ใช้ร่วมหลายฟอร์มหรือไม่ | **ใช้เฉพาะฟอร์ม SA03 เท่านั้น** — ไม่ต้องมีคอลัมน์ `FORM_NO` ไม่ต้อง filter ชุดคำถามตามฟอร์ม |
| D2 | การกำหนดผู้อนุมัติระดับ 2 (`approve_profile2`) | **ผู้อนุมัติระดับ 1 เป็นผู้เลือกเองทุกครั้งตอนกดอนุมัติ** (ไม่ใช่ค่าตายตัวจาก config) |
| D3 | เมื่อกด "ปฏิเสธ" (ระดับ 1 หรือ 2) | **ตีกลับสถานะให้ผู้บันทึกแก้ไข แล้วส่งเข้าอนุมัติใหม่ได้** (ไม่ใช่ปิดรายการถาวร) |
| D4 | วิธีเก็บคำตอบ checklist ใน `FMSA03_TRANSACTION` | **เก็บเป็น JSON คอลัมน์เดียว (`ANSWERS_JSON`)** คีย์ = `record_id` ของ `FORM_MASTER` ไม่ใช้วิธีแยกคอลัมน์ `FMSA03_1...N` ตามที่เสนอไว้เดิม |
| D5 (v1.2) | วิธีเข้าถึงข้อมูล `FORM_MASTER` (แทน OI-7 เดิม) | **ไม่เรียกผ่าน External API/MasterCacheAPI** แต่เก็บเป็น **Sheet Tab ในไฟล์ Spreadsheet เดียวกัน** กับ `FMSA03_TRANSACTION` (ใช้ `SPREADSHEET_ID` ตัวเดียวกัน) และอ่านผ่าน `CacheService.getScriptCache()` อายุ **6 ชั่วโมงเต็ม (21,600 วินาที)** พร้อมแยกฟังก์ชัน Clear/Write cache ให้ Trigger รายวันปลุกทำงาน |
| **D6 (ใหม่ v1.3)** | ข้อความตัวเลือกคำตอบ Checklist บน UI | แสดงผลเป็น **"✅ ผ่าน"**, **"❌ ไม่ผ่าน"**, **"➖ ไม่ตรวจ"** (ส่วนค่าที่บันทึกใน `ANSWERS_JSON` ยังคงเป็น `'Y'`, `'N'`, `'-'` เช่นเดิม 100%) |
| **D7 (ใหม่ v1.3)** | บทบาทผู้อนุมัติระดับ 1 และ 2 | ผู้อนุมัติระดับ 1 = **"จป.วิชาชีพ"**, ผู้อนุมัติระดับ 2 = **"จป.บริหาร"** ดึงจาก Central API ผ่าน Tag `APPROVE_TAG_L1` และ `APPROVE_TAG_L2` พร้อม Token = `secret-token-12345` ผ่าน Script Properties |
| **D8 (ใหม่ v1.3)** | ประสิทธิภาพการอ่าน Script Properties | โหลดแบบ **Single Network Call + In-Memory Caching** ครั้งเดียวต่อ execution context (`_loadedProps`) ลด network latency ซ้ำซ้อน |
| **D9 (ใหม่ v1.3)** | สถาปัตยกรรมการแสดงผล Web App | รองรับ **Dual-Mode**: ทั้ง Standalone Single Page App บน **GitHub Pages** (แก้ปัญหา LIFF iframe) และ Native **Google Apps Script Web App** |
| **D10 (ใหม่ v1.3)** | สิทธิ์การเข้าถึง Web App (`appsscript.json`) | กำหนด `"access": "ANYONE_ANONYMOUS"` (ทุกคน) + `"executeAs": "USER_DEPLOYING"` (ฉัน) เพื่อให้เปิดใน LINE LIFF ได้โดยไม่ต้องล็อกอิน Google |
| **D11 (ใหม่ v1.3)** | สัดส่วน Visual Hierarchy ของหัวข้อตรวจ | หัวข้อคำถามต้องใหญ่และเด่นกว่าปุ่มคำตอบ (`1.05rem` Bold 700 vs `0.90rem` บนปุ่ม) และนำป้าย Safety Checklist ออกจาก Navbar Header |

ทีม Dev ยึดตาม Decision Log นี้เป็นอันดับแรกในกรณีที่เนื้อหาส่วนอื่นของเอกสารดูขัดแย้งกัน

---

## 1. ภาพรวมระบบและวัตถุประสงค์

ระบบ **FormSA03 Checklist WebApp** เป็น Web App บน Google Apps Script (GAS) เชื่อมต่อผ่าน **LINE LIFF** ให้ผู้ใช้งาน (ผู้ตรวจสอบหน้างาน) กรอกแบบฟอร์มตรวจสอบ (checklist) แบบ Yes/No ต่อโครงการ (Project) รายวัน โดยหัวข้อคำถามทั้งหมดถูกกำหนดจากตาราง `FORM_MASTER` แบบไดนามิก (เพิ่ม/ลด/แก้ไขหัวข้อคำถามได้โดยไม่ต้องแก้โค้ด)

ผลการตรวจสอบแต่ละรายการต้องผ่านกระบวนการอนุมัติ 2 ระดับ (ผู้อนุมัติระดับ 1 → ผู้อนุมัติระดับ 2) ก่อนถือว่าสมบูรณ์ โดยใช้ Web App หน้าจอ "อนุมัติ" ตัวเดียวกันสำหรับทั้งสองระดับ (แยกพฤติกรรมภายในตามสิทธิ์ผู้ใช้ที่ login เข้ามา)

ระบบมี 2 หน้าจอหลัก:
1. **หน้าจอบันทึกตรวจสอบ (Checklist Entry)** — ผู้ตรวจใช้กรอกผลตรวจต่อวัน/ต่อโครงการ
2. **หน้าจออนุมัติ (Approval Queue)** — ผู้อนุมัติระดับ 1 และ 2 ใช้ร่วมกัน

---

## 2. Actors / บทบาทผู้ใช้งาน

| Role | คำอธิบาย | เข้าหน้าจอใด |
|---|---|---|
| **ผู้ตรวจ (Requester)** | ผู้กรอกผลตรวจสอบประจำวัน ระบุตัวตนผ่าน LINE UID | Checklist Entry |
| **ผู้อนุมัติระดับ 1 (Approver L1)** | รายชื่อต้องปรากฏใน lookup `approve_profile1`; อนุมัติเป็นรอบเดือน, เลือกผู้อนุมัติระดับ 2 ให้แต่ละครั้งที่อนุมัติ | Approval Queue (โหมด L1) |
| **ผู้อนุมัติระดับ 2 (Approver L2)** | ถูกกำหนดโดย Approver L1 ตอนอนุมัติแต่ละครั้ง (ไม่ตายตัว); เป็นผู้อนุมัติปิดท้าย | Approval Queue (โหมด L2) |

**หมายเหตุสำคัญ:** คนคนเดียวกันอาจเป็นได้ทั้ง L1 (สำหรับบางรายการ) และ L2 (สำหรับอีกบางรายการ) ในเวลาเดียวกัน ระบบต้องรวมคิวทั้งสองแบบและแสดงแยกกันชัดเจนในหน้าจอเดียว (ดูหมวด 8.2)

---

## 3. สถาปัตยกรรมระบบ (Architecture)

```
[LINE App] -> LIFF (frontend HTML/JS on GAS Web App)
                 |
                 +-- liff.init() -> ได้ LINE profile / idToken
                 |
                 v
        [GAS Web App: doGet / doPost]  (Router.gs)
                 |
        +--------+---------------------+
        v        v                     v
  Auth.gs   Controllers/*.gs      (external HTTP)
   |              |
   v              v
proxy_url_master   Services/*.gs -- Repositories/*.gs -- Google Sheets
(ยืนยันตัวตน,      (business logic)   (CRUD)              - FORM_MASTER
คืนค่า users_profile)                                      - FMSA03_TRANSACTION
        |
        v
  getUsers API / getApprove API / getProjects API  (external, มีอยู่แล้ว)
```

**หลักการออกแบบ:**
- แยกโค้ดเป็นหลายไฟล์ตามหน้าที่ (ห้ามรวมทุกอย่างใน `Code.gs`) — ดูโครงสร้างเต็มในหมวด 4
- ทุก Controller เรียกผ่าน Service layer เท่านั้น ห้ามอ่าน/เขียน Sheet ตรงจาก Controller
- ทุก Config (URL, token) เก็บใน Script Properties ผ่าน `Config.gs` เท่านั้น ห้าม hardcode ค่าคงที่ปนในไฟล์ business logic
- Response ทุก endpoint เป็นรูปแบบ JSON มาตรฐานเดียวกันทั้งระบบ (ดูหมวด 9.1)

---

## 4. โครงสร้างไฟล์โปรเจกต์ Google Apps Script

```
Config.gs                      - อ่าน/ห่อหุ้ม Script Properties ทั้งหมด
Router.gs                      - doGet(e), doPost(e): จุดเข้าเดียว, dispatch ตาม action, try/catch ครอบ, คืน JSON มาตรฐาน
Auth.gs                        - verifyLineProfile(token/uid): เรียก proxy_url_master, คืน users_profile หรือ throw AuthError

Controllers/
  ChecklistController.gs       - handleGetChecklistForm, handleGetMyTransaction, handleSaveChecklist
  ApprovalController.gs        - handleGetApprovalQueue, handleApproveAction, handleRejectAction

Services/
  ChecklistService.gs          - business rule: unique 1 record/วัน/user, edit-lock, map FORM_MASTER -> คอลัมน์คำตอบ
  ApprovalService.gs           - state machine การอนุมัติ, ตรวจสอบสิทธิ์ผู้อนุมัติ, trigger การแจ้งเตือน
  NotifyService.gs             - sendLineNotify(lineUid, message): ส่ง LINE push message

Repositories/
  FormMasterRepo.gs            - [แก้ไข v1.2] อ่าน FORM_MASTER จาก Sheet Tab ในไฟล์เดียวกับ Transaction
                                  ผ่าน CacheService (getFormMasterCached()) ตาม D5/หมวด 5.1.2
                                  + มีฟังก์ชัน refreshFormMasterCache() แยกสำหรับ Trigger เรียก clear/write cache ใหม่ทุกวัน
  TransactionRepo.gs           - CRUD บน FMSA03_TRANSACTION, ค้นหาด้วย Line_UID+วันที่, ค้นหาคิวอนุมัติ

Utils/
  IdGenerator.gs               - generateTransRecordId(): สร้าง PK แบบ non-sequential (หมวด 10)
  DateUtils.gs                 - todayBangkok(), formatDateBangkok(), isValidDateString()
  ResponseUtils.gs             - ok(data), fail(code, message): ห่อ JSON response มาตรฐาน

Triggers/
  TriggerSetup.gs              - [เพิ่มใหม่ v1.2] setupFormMasterCacheTrigger(): สร้าง Time-driven Trigger
                                  เรียก refreshFormMasterCache() ทุกวัน (ดูหมวด 5.1.2)

Client (HtmlService templates):
  Index.html                   - LIFF bootstrap: liff.init(), ตรวจ role, route ไปหน้าที่ถูกต้อง
  ChecklistView.html            - หน้าจอกรอกตรวจสอบ (ใช้ include CSS_Common, JS_Common, JS_Checklist)
  ApprovalView.html             - หน้าจออนุมัติ (ใช้ include CSS_Common, JS_Common, JS_Approval)
  CSS_Common.html               - style ใช้ร่วมทุกหน้า (mobile-first)
  JS_Common.html                 - liff init helper, wrapper เรียก google.script.run, toast/loading UI
  JS_Checklist.html              - logic เฉพาะหน้ากรอกตรวจสอบ
  JS_Approval.html               - logic เฉพาะหน้าอนุมัติ
```

**กติกา:** ทุกไฟล์ `.gs` มีความรับผิดชอบเดียว (single responsibility) Controller ห้ามมี business logic เกิน "รับ input -> validate รูปแบบเบื้องต้น -> เรียก Service -> ห่อ response" Service ห้ามยุ่งกับ Sheet API โดยตรง (เรียกผ่าน Repository เท่านั้น)

---

## 5. Data Dictionary

### 5.1 Sheet: `FORM_MASTER` (ชุดคำถาม — เฉพาะฟอร์ม SA03 ตาม D1)

> **[อัปเดต v1.2 — ตาม D5]** `FORM_MASTER` เป็น **Sheet Tab อยู่ในไฟล์ Google Spreadsheet เดียวกัน** กับ `FMSA03_TRANSACTION` (ใช้ `SPREADSHEET_ID` เดียวกันจาก `Config.gs` — ไม่ต้องสร้างไฟล์แยก ไม่ต้องเรียก External API) การอ่านข้อมูลต้องผ่าน `FormMasterRepo.gs` เท่านั้น (ห้าม Controller/Service เรียก `getRange()` ตรงจาก Sheet) รายละเอียดกลไก Cache ดูหมวด 5.1.2

| Column | Field | Type | Nullable | คำอธิบาย |
|---|---|---|---|---|
| A | `record_id` | numeric (PK) | No | เลขหัวข้อ เรียงจาก 1...N ตามลำดับที่สร้าง (numeric, sequential) |
| B | `item_name` | text | No | ชื่อรายการตรวจ / ชื่อหัวข้อ |
| C | `header_flag` | text (`Y`/`N`) | No | `Y` = เป็นหัวข้อ/หมวดหมู่ (section header, ไม่ต้องตอบ) · `N` = เป็นคำถามที่ต้องตอบ Yes/No/`-` |
| D | `score` | numeric | No (default 0) | คะแนนของข้อนั้น `0` = ไม่กำหนดคะแนน (สำรองไว้อนาคต ดู OI-3) |

#### 5.1.1 การอ้างอิงคำตอบ (แก้ไขตาม Decision D4)

**ยกเลิกแนวทาง `answer_column_no`** ที่เคยเสนอไว้ เนื่องจากเปลี่ยนวิธีเก็บคำตอบเป็น JSON แบบ key-value แล้ว จึงใช้ **`record_id` ของ `FORM_MASTER` เป็น key ในการอ้างอิงคำตอบโดยตรง** — วิธีนี้ทนทานต่อการแก้ไข/แทรก/ลบ/สลับลำดับแถวใน `FORM_MASTER` โดยธรรมชาติ เพราะแต่ละคำตอบใน JSON ระบุ `record_id` กำกับตัวเองอยู่แล้ว ไม่ได้อ้างอิงตามตำแหน่ง

#### 5.1.2 [ใหม่ v1.2] สถาปัตยกรรมการเก็บและ Cache ของ `FORM_MASTER`

แทนที่การพิจารณาใช้ `MasterCacheAPI` ภายนอก (ตาม OI-7 เดิม) ตัดสินใจแล้วตาม D5 ว่าจะ**เก็บ `FORM_MASTER` เป็น Sheet ในไฟล์เดียวกับ Transaction** และจัดการ cache เองภายใน Apps Script Project นี้ ด้วยเหตุผล: ลด external dependency, ลด network round-trip, แก้ไขคำถามได้ทันทีผ่าน Sheet โดยตรง

**กลไก Cache:**

| รายการ | ค่า / รายละเอียด |
|---|---|
| **Cache Store** | `CacheService.getScriptCache()` (Script-level cache ใช้ร่วมกันทุก user/session) |
| **Cache Key** | `FORM_MASTER_CACHE_V1` (มี version suffix กันชนเมื่อ schema เปลี่ยนในอนาคต) |
| **อายุ Cache** | `21600` วินาที (6 ชั่วโมง) — **ค่าสูงสุด** ที่ `CacheService.put()` ของ Google Apps Script รองรับ |
| **รูปแบบข้อมูล** | JSON string ของ array ข้อมูลทั้งชีต `FORM_MASTER` เช่น `[{record_id, item_name, header_flag, score}, ...]` |
| **ข้อจำกัดของ Google** | ค่าต่อ 1 key ห้ามเกิน 100 KB — ถ้าจำนวนคำถามมากจนเกิน ให้แตกเป็นหลาย chunk key (`FORM_MASTER_CACHE_V1_0`, `_1`, ...) — ดู OI-13 |
| **Fallback (lazy refresh)** | ถ้า cache หมดอายุหรือยังไม่เคยถูกเขียน (`cache.get()` คืน `null`) -> อ่านจาก Sheet สดทันที แล้วเขียนกลับเข้า cache ทันที |

**ฟังก์ชันหลัก (ใน `FormMasterRepo.gs`):**

    const CACHE_KEY  = 'FORM_MASTER_CACHE_V1';
    const CACHE_TTL  = 21600; // วินาที = 6 ชั่วโมง (ค่าสูงสุดของ Google)
    const SHEET_NAME = 'FORM_MASTER';

    function getFormMasterCached() {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(CACHE_KEY);
      if (cached) return JSON.parse(cached);

      const data = readFormMasterFromSheet_();
      cache.put(CACHE_KEY, JSON.stringify(data), CACHE_TTL);
      return data;
    }

    function refreshFormMasterCache() {
      const cache = CacheService.getScriptCache();
      cache.remove(CACHE_KEY);
      const data = readFormMasterFromSheet_();
      cache.put(CACHE_KEY, JSON.stringify(data), CACHE_TTL);
    }

    function readFormMasterFromSheet_() {
      const ss = SpreadsheetApp.openById(Config.getSpreadsheetId());
      const sheet = ss.getSheetByName(SHEET_NAME);
      const values = sheet.getDataRange().getValues();
      const headers = values.shift();
      return values.map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
    }

**Trigger Setup (ตั้งครั้งเดียวใน `TriggerSetup.gs`):**

    function setupFormMasterCacheTrigger() {
      ScriptApp.getProjectTriggers().forEach(t => {
        if (t.getHandlerFunction() === 'refreshFormMasterCache') {
          ScriptApp.deleteTrigger(t);
        }
      });
      ScriptApp.newTrigger('refreshFormMasterCache')
        .timeBased()
        .everyDays(1)
        .atHour(5)
        .create();
    }

> **หมายเหตุสำคัญ:** อายุ cache สูงสุดของ `CacheService` คือ 6 ชั่วโมง Google ไม่อนุญาตให้ตั้งนานกว่านี้ ถ้าต้องการให้ cache สดตลอด 24 ชม. โดยไม่มีช่วง cold-read เลย แนะนำตั้ง trigger มากกว่า 1 รอบ/วัน (เช่น 05:00 และ 11:00) — ดู OI-12b

### 5.2 Sheet: `FMSA03_TRANSACTION` (บันทึกผลตรวจสอบ)

| Column | Field | Type | Nullable | Default | คำอธิบาย |
|---|---|---|---|---|---|
| - | `TRANS_RECORD_ID` | numeric (PK) | No | generated | สร้างแบบ non-sequential ไม่อ่านข้อมูลเก่ามานับ (หมวด 10) |
| - | `TRANS_DATE` | date (yyyy-MM-dd) | No | วันนี้ (Asia/Bangkok) | วันที่ตรวจสอบ แก้ไขได้ (ทำย้อนหลังได้) |
| - | `PROJECT` | text | No | - | ชื่อโครงการ เลือกจาก lookup ผ่าน external API `getProjects` |
| - | `Line_UID` | text | No | จาก login | อ้างอิง `users_profile.line_id` ของผู้บันทึก (เจ้าของรายการ) |
| - | `CREATE_DATETIME` | datetime | No | ตอนสร้าง (Asia/Bangkok) | เวลาสร้างรายการครั้งแรก |
| - | `UPDATE_DATETIME` | datetime | Yes | - | เวลาที่แก้ไขล่าสุด (audit / concurrency) |
| - | `approve_profile1` | text | No | - | ชื่อผู้อนุมัติระดับ 1 ที่ผู้บันทึกเลือกจาก lookup `getApprove` |
| - | `approve_profile2` | text | Yes | ว่าง จนกว่า L1 จะอนุมัติ | ผู้อนุมัติระดับ 2 — ถูกกำหนดโดย Approver L1 ตอนกดอนุมัติ (ตาม D2) |
| - | `STATUS` | text (enum) | No | `PENDING_L1` | ดู state machine หมวด 7.1: `PENDING_L1` / `PENDING_L2` / `APPROVED` / `REJECTED` |
| - | `APPROVE1_DATETIME` | datetime | Yes | - | เวลาที่ L1 อนุมัติ/ปฏิเสธ |
| - | `APPROVE1_RESULT` | text | Yes | - | `APPROVED` / `REJECTED` |
| - | `APPROVE2_DATETIME` | datetime | Yes | - | เวลาที่ L2 อนุมัติ/ปฏิเสธ |
| - | `APPROVE2_RESULT` | text | Yes | - | `APPROVED` / `REJECTED` |
| - | `REJECT_REASON` | text | Yes | - | เหตุผลการปฏิเสธล่าสุด (ดู OI-4 เรื่อง history) |
| - | `RESUBMIT_COUNT` | numeric | No | 0 | จำนวนครั้งที่ถูกตีกลับแล้วส่งใหม่ |
| - | `ANSWERS_JSON` | text (JSON string) | No | - | คำตอบทั้งหมดของรายการนี้ เก็บเป็น JSON object เดียว รูปแบบ `{ "<record_id>": "Y"/"N"/"-" , ... }` เช่น `{"3":"Y","7":"N","12":"-"}` — คีย์คือ `record_id` ของ `FORM_MASTER` เฉพาะแถวที่ `header_flag='N'` เท่านั้น |

> **หมายเหตุประสิทธิภาพ:** การเก็บเป็น JSON คอลัมน์เดียวไม่ทำให้ระบบช้าลงเมื่อเทียบกับแยกคอลัมน์ เพราะต้นทุนหลักของ GAS/Sheets อยู่ที่จำนวนครั้งที่เรียก Sheets API ไม่ใช่จำนวนคอลัมน์ในแถว
>
> **ข้อแลกเปลี่ยนที่ต้องรู้:** วิธีนี้ทำให้เปิดชีตดูตรงๆ แล้วอ่าน/กรอง/ทำ pivot table รายข้อคำถามไม่ได้ทันทีเหมือนแบบแยกคอลัมน์ ถ้าในอนาคตต้องการรายงานแบบแยกคอลัมน์ ให้เพิ่มฟังก์ชัน "generate flattened report sheet" แยกต่างหาก

> **`FM-SA-03` ที่ปรากฏในโจทย์เดิม:** ตีความว่าหมายถึงชุดข้อมูล/ชีต `FORM_MASTER` ตัวเดียวกัน — หากผู้ให้โจทย์หมายถึงชีตอื่นจริง โปรดแจ้งทีม Dev ทันที (ดู OI-2)

### 5.3 External Lookup / API ที่มีอยู่แล้ว (ไม่ต้องพัฒนาใหม่)

| API | ใช้ทำอะไร | หมายเหตุ |
|---|---|---|
| `getUsers` | ดึงรายชื่อผู้ใช้ (สำหรับ auto-fill ชื่อผู้บันทึกจาก Line_UID) | Contract จริงต้องดูเอกสารอ้างอิง (ดู OI-5) |
| `getApprove` | ดึงรายชื่อผู้อนุมัติ สำหรับ dropdown `approve_profile1`/`approve_profile2` | ต้องมี LINE UID ผูกกับแต่ละชื่อ เพื่อใช้ส่ง notify และตรวจสิทธิ์ queue |
| `getProjects` (ชื่อสมมติ) | ดึงรายชื่อโครงการสำหรับ dropdown `PROJECT` | โจทย์ระบุว่ามีเอกสารอ้างอิงเพิ่มเติม (ดู OI-6) |
| `proxy_url_master` | ยืนยันตัวตนผู้ login (ส่ง Line UID ไป, ได้ `users_profile` กลับ) | URL/token ตัวอย่างที่ให้มาในโจทย์ให้ถือเป็น placeholder เก็บใน Script Properties เท่านั้น |

> **[หมายเหตุ v1.2]** `FORM_MASTER` **ไม่ใช่** External API อีกต่อไปตาม D5 — จึงไม่อยู่ในตารางนี้ อ่านผ่าน `FormMasterRepo.gs` + Cache ภายในโปรเจกต์เอง (ดูหมวด 5.1.2)

---

## 6. Configuration / Script Properties

| Key | คำอธิบาย | ค่าที่ใช้งานจริง (Configured) |
|---|---|---|
| `SPREADSHEET_ID` | ID ของ Google Sheet หลัก (ทั้ง `FORM_MASTER` และ `FMSA03_TRANSACTION`) | `1ZBy4XalB74HFWVKRo30OFJG48Gxe41FruBoDuLnuxF4` |
| `PROXY_URL_MASTER` | URL สำหรับ Central MasterCacheAPI (ยืนยันตัวตน, ดึงโปรไฟล์, ดึงผู้อนุมัติ) | `https://script.google.com/macros/s/AKfycbwhbYUFPHlMq5KrtHRZUNTjeHsKtSF2IW0bEzJZwL-hqBhzFx3gXR4ijL83ajPs0zcQDA/exec` |
| `SHARED_TOKEN` | Shared-Secret Token สำหรับความปลอดภัยระหว่าง Server-to-Server | `secret-token-12345` |
| `LIFF_ID` | LINE LIFF Application ID | `2009016720-NiJ6Jzhp` |
| `APPROVE_TAG_L1` | Role Tag ผู้อนุมัติระดับ 1 (จป.วิชาชีพ) | `จป.วิชาชีพ` |
| `APPROVE_TAG_L2` | Role Tag ผู้อนุมัติระดับ 2 (จป.บริหาร) | `จป.บริหาร` |
| `SCREEN_TAG` | รหัสหน้าจอสำหรับสิทธิ์เข้าใช้งาน | `SA03` |
| `PROJECT_DATASET_KEY` | Dataset Key สำหรับดึงรายชื่อโครงการจาก Central API | `project` |
| `ENABLE_SHEET_FALLBACK`| เปิดใช้ Sheet ตรงเมื่อ Central API ล่มหรือไม่ | `false` |
| `LINE_CHANNEL_ACCESS_TOKEN` | Token สำหรับส่ง LINE push message แจ้งเตือน | (กำหนดใน Script Properties เมื่อต้องการเปิดใช้งาน) |

> **[สถาปัตยกรรม Config v1.3 - In-Memory Caching]:**
> เพื่อแก้ไขปัญหา Latency ที่เกิดจากการเรียก `PropertiesService.getScriptProperties().getProperty(key)` ซ้ำๆ หลายครั้งใน 1 Request, ระบบได้ปรับให้ `Config.gs` ใช้กลไก **Single Network Call + In-Memory Caching**:
> - โหลด `getProperties()` เพียงรอบเดียวต่อ 1 Execution Context และเก็บผลลัพธ์ในตัวแปร RAM `_loadedProps`
> - การเรียกอ่านค่าผ่าน `Config.getXxx()` ในรอบถัดไปจะดึงจาก RAM ทันที (< 0.001 ms)
> - มีเมธอด `Config.clearCache()` เพื่อรองรับการ Reset แคชหลังจากฟังก์ชัน `Setup.initProperties()` บันทึกค่าใหม่

---

## 7. Business Rules & Workflow

### 7.1 State Machine ของ `STATUS`

```
        (บันทึกครั้งแรก)
              |
              v
        PENDING_L1  --------- L1 ปฏิเสธ ---------+
              |                                    |
       L1 อนุมัติ                                   v
   (เลือก approve_profile2 ตอนนี้)             REJECTED
              |                                    ^
              v                                    |
        PENDING_L2  --------- L2 ปฏิเสธ -----------+
              |
       L2 อนุมัติ
              |
              v
          APPROVED (จบกระบวนการ, ล็อกแก้ไขถาวร)

REJECTED --(ผู้บันทึกแก้ไขแล้วกด "ส่งอนุมัติใหม่")--> PENDING_L1  (RESUBMIT_COUNT +1)
```

### 7.2 กติกาการสร้าง/แก้ไขรายการ (Checklist Entry)

- **BR-1 (Unique key):** 1 รายการต่อ (`Line_UID` + `TRANS_DATE`) เท่านั้น — ผู้ใช้ 1 คน สร้างได้ 1 โครงการ/วัน **[สมมติฐาน SA — ดู OI-9]**
  - เมื่อผู้ใช้เปิดหน้าจอสำหรับวันที่ใดวันหนึ่ง: ถ้ามี record เดิมอยู่แล้วและ `STATUS != APPROVED` -> โหลดมาให้แก้ไข (รวมถึงกรณี `REJECTED` ซึ่งถือเป็นการแก้ไข+ส่งใหม่)
  - ถ้ามี record เดิมและ `STATUS = APPROVED` -> ห้ามสร้าง/แก้ไขซ้ำ แสดงข้อความแจ้งว่าวันที่นี้อนุมัติสมบูรณ์แล้ว
  - ถ้าไม่มี record เดิม -> สร้างใหม่ ค่าเริ่มต้น `STATUS = PENDING_L1`
- **BR-2 (Edit lock):** แก้ไขได้เฉพาะเมื่อ `STATUS` เป็น `PENDING_L1` หรือ `REJECTED` เท่านั้น เมื่อเข้าสู่ `PENDING_L2` หรือ `APPROVED` แล้ว **ห้ามแก้ไขทุกฟิลด์รวมถึงคำตอบ checklist** **[สมมติฐาน SA ดู OI-10]**
- **BR-3:** ทุกคำถามที่ `header_flag='N'` ต้องถูกตอบ (`Y`/`N`/`-`) ครบก่อนบันทึกจริง (submit) ห้ามมีค่าว่าง — ป้องกันด้วย validation ทั้งฝั่ง client และ server
- **BR-4:** การกด "ส่งอนุมัติใหม่" จากสถานะ `REJECTED` ต้อง reset `APPROVE1_RESULT`, `APPROVE1_DATETIME`, `APPROVE2_RESULT`, `APPROVE2_DATETIME`, `approve_profile2`, `REJECT_REASON` เป็นค่าว่าง และเพิ่ม `RESUBMIT_COUNT` ทีละ 1 ก่อนเปลี่ยน `STATUS` เป็น `PENDING_L1`

### 7.3 กติกาการอนุมัติระดับ 1 (Approver L1)

- แสดงรายการที่ `STATUS = PENDING_L1` และ `approve_profile1` ตรงกับผู้ login (จับคู่ผ่าน LINE UID -> ชื่อผู้อนุมัติ ด้วยข้อมูลจาก `getApprove`)
- มี filter เลือกเดือน (ปีเดือนของ `TRANS_DATE`) แสดงรายการเฉพาะเดือนที่เลือก
- เลือกได้ทีละรายการ หรือ "เลือกทั้งหมด" แล้วกดปุ่มเดียว: **อนุมัติ** หรือ **ปฏิเสธ**
- ปุ่ม **อนุมัติ**: ต้องเลือก "ผู้อนุมัติระดับ 2" ก่อนยืนยัน (ค่าเดียวถูกใช้กับทุกรายการที่เลือกไว้ในการกดครั้งนี้ — **สมมติฐาน SA ดู OI-11**) -> set `STATUS = PENDING_L2`, `APPROVE1_RESULT = APPROVED`, `APPROVE1_DATETIME = now`, `approve_profile2 = <ที่เลือก>` -> ยิง notify ไปหา L2 ที่เลือก
- ปุ่ม **ปฏิเสธ**: ไม่ต้องเลือกผู้อนุมัติระดับ 2 มีช่องกรอกเหตุผล (optional หรือ required — OI-4) -> set `STATUS = REJECTED`, `APPROVE1_RESULT = REJECTED`, `APPROVE1_DATETIME = now`, `REJECT_REASON = <เหตุผล>` -> ยิง notify ไปหาเจ้าของรายการ (`Line_UID`)

### 7.4 กติกาการอนุมัติระดับ 2 (Approver L2)

- แสดงรายการที่ `STATUS = PENDING_L2` และ `approve_profile2` ตรงกับผู้ login
- **ไม่มี** ช่องเลือกผู้อนุมัติ (เพราะเป็นคนสุดท้าย) มีแค่ปุ่ม อนุมัติ / ปฏิเสธ + เลือกทีละรายการหรือทั้งหมดเช่นเดียวกับ L1
- ปุ่ม **อนุมัติ**: `STATUS = APPROVED`, `APPROVE2_RESULT = APPROVED`, `APPROVE2_DATETIME = now` (จบกระบวนการ ล็อกถาวร)
- ปุ่ม **ปฏิเสธ**: `STATUS = REJECTED`, `APPROVE2_RESULT = REJECTED`, `APPROVE2_DATETIME = now`, `REJECT_REASON = <เหตุผล>` -> notify เจ้าของรายการ

### 7.5 การแจ้งเตือน (Notification)

ผ่าน LINE push message (`NotifyService.gs`) ในสองจุด:
1. เมื่อ L1 อนุมัติ -> แจ้งผู้อนุมัติระดับ 2 ที่ถูกเลือก ว่ามีรายการรออนุมัติ
2. เมื่อ L1 หรือ L2 ปฏิเสธ -> แจ้งเจ้าของรายการว่าถูกตีกลับ พร้อมเหตุผล (ถ้ามี)

ข้อความ/เทมเพลตที่แน่นอนเป็น Open Item (OI-8)

---

## 8. Function Spec รายหน้าจอ

### 8.1 หน้าจอบันทึกตรวจสอบ (ChecklistView)

**ลำดับการทำงานเมื่อเปิดหน้าจอ:**
1. `liff.init()` -> ได้ LINE UID / idToken
2. เรียก `verifyLineProfile` ผ่าน `proxy_url_master` -> ได้ `users_profile` (ชื่อ, สิทธิ์) — ถ้าไม่ผ่าน ให้แสดงหน้า "ไม่มีสิทธิ์เข้าใช้งาน" และหยุด
3. โหลด `FORM_MASTER` **[อัปเดต v1.2]** ผ่าน `getFormMasterCached()` (ดูหมวด 5.1.2) -> render หัวข้อ/คำถามตามลำดับ `record_id`, ใช้ `header_flag` จัดกลุ่มเป็น section
4. เรียก `getMyTransaction(Line_UID, today)` -> ถ้ามี record วันนี้อยู่แล้วและแก้ไขได้ (BR-2) ให้เติมคำตอบเดิมลงฟอร์ม, ถ้า `STATUS=APPROVED` ให้เปิดโหมด read-only พร้อมข้อความแจ้ง
5. ผู้ใช้เลือกวันที่ (ถ้าต้องการทำย้อนหลัง) -> เรียก `getMyTransaction` ใหม่ตามวันที่ที่เลือกทุกครั้งที่เปลี่ยนวันที่
6. ผู้ใช้เลือก PROJECT (จาก `getProjects`), เลือก `approve_profile1` (จาก `getApprove`), ตอบคำถามทุกข้อ
7. กด "บันทึก" -> validate ครบ (BR-3) -> เรียก `saveChecklist` -> แสดงผลสำเร็จ/ error

### 8.2 หน้าจออนุมัติ (ApprovalView)

**ลำดับการทำงานเมื่อเปิดหน้าจอ:**
1. `liff.init()` + `verifyLineProfile` เช่นเดียวกับข้างต้น
2. เรียก `getApprovalQueue(Line_UID)` ซึ่ง server จะคืนค่าทั้งสองคิวมาพร้อมกัน:

    {
      "asL1": [ /* รายการที่ user นี้เป็น approve_profile1, STATUS=PENDING_L1 */ ],
      "asL2": [ /* รายการที่ user นี้เป็น approve_profile2, STATUS=PENDING_L2 */ ]
    }

3. UI แสดงเป็น 2 แท็บ: "รออนุมัติระดับ 1" และ "รออนุมัติระดับ 2" — แท็บใดไม่มีรายการให้ซ่อนแท็บนั้นหรือแสดง badge 0
4. แท็บ L1: มี filter เดือน, checkbox เลือกรายการ/เลือกทั้งหมด, ปุ่มอนุมัติ (เปิด modal เลือกผู้อนุมัติ L2) / ปฏิเสธ (เปิด modal กรอกเหตุผล)
5. แท็บ L2: checkbox เลือกรายการ/เลือกทั้งหมด, ปุ่มอนุมัติ (ยืนยันตรงๆ ไม่มี modal เลือกคน) / ปฏิเสธ (modal กรอกเหตุผล)
6. หลัง action สำเร็จ -> refresh queue ทันที

---

## 9. API Contract (Server Functions)

### 9.1 รูปแบบ Response มาตรฐาน

    // สำเร็จ
    { "success": true, "data": { } }
    // ผิดพลาด
    { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }

### 9.2 รายการ Endpoint

| Action | Input | Output (data) | คำอธิบาย |
|---|---|---|---|
| `getChecklistForm` | - | `{ questions: [{record_id, item_name, header_flag}] }` | โหลดโครงสร้างคำถามจาก FORM_MASTER (ผ่าน cache — ดู 5.1.2) |
| `getMyTransaction` | `{ lineUid, transDate }` | transaction object (รวม `answers` ที่ parse จาก `ANSWERS_JSON` แล้ว) หรือ `null` | ดึง record เดิมของวันนั้น (ถ้ามี) |
| `saveChecklist` | `{ lineUid, transDate, project, approveProfile1, answers: {"<record_id>": "Y"/"N"/"-"}, transRecordId? }` | transaction ที่บันทึกแล้ว | server `JSON.stringify(answers)` ก่อนเขียนลง `ANSWERS_JSON`; สร้างใหม่หรือแก้ไขของเดิม; ตรวจ BR-1, BR-2, BR-3 ก่อนเขียน |
| `resubmitChecklist` | เหมือน `saveChecklist` + `transRecordId` (required) | transaction ที่อัปเดตแล้ว | ใช้เมื่อ `STATUS=REJECTED` เท่านั้น ทำ BR-4 |
| `getApprovalQueue` | `{ lineUid }` | `{ asL1: [...], asL2: [...] }` | ดูหมวด 8.2 |
| `approveAction` | `{ lineUid, level: 1|2, transRecordIds: [...], approveProfile2? }` | `{ updatedCount }` | `approveProfile2` required เมื่อ `level=1` |
| `rejectAction` | `{ lineUid, level: 1|2, transRecordIds: [...], reason? }` | `{ updatedCount }` | ดู OI-4 ว่า `reason` บังคับหรือไม่ |

Server ต้อง**ตรวจสิทธิ์ซ้ำฝั่ง server เสมอ** (ห้ามเชื่อ client): ตรวจว่า `lineUid` ที่ยิง `approveAction`/`rejectAction` มาจริง ตรงกับ `approve_profile1`/`approve_profile2` (ตาม level) ของทุก `transRecordIds` ที่ส่งมา ก่อนอัปเดต ถ้ามีรายการใดไม่ตรงสิทธิ์ ให้ reject ทั้งชุดพร้อม error ชัดเจน (อย่าทำบางส่วนแล้ว silent skip)

---

## 10. การสร้าง TRANS_RECORD_ID (Non-sequential Unique ID)

ตามโจทย์ห้ามใช้วิธี count แถวเดิม (ลดเวลาประมวลผล) และต้องเป็น **numeric**

**อัลกอริทึม:**

    function generateTransRecordId() {
      var ms = new Date().getTime().toString();       // epoch milliseconds, ~13 หลัก
      var rand = Utilities.formatString('%03d', Math.floor(Math.random() * 1000)); // 3 หลักสุ่ม
      return Number(ms + rand);                          // รวม ~16 หลัก
    }

- รวมแล้วได้ตัวเลข ~16 หลัก ซึ่งยังอยู่ในช่วง safe integer ของ JavaScript/Google Sheets (สูงสุด 2^53 ≈ 9.007 × 10^15 = 16 หลัก) จึงไม่มีปัญหาเรื่อง floating-point precision
- โอกาสชนกันมีน้อยมาก — แนะนำเพิ่ม retry-once เมื่อเขียนแล้วเจอ duplicate key เป็น safety net เท่านั้น ไม่ต้อง query เช็คก่อนเขียนทุกครั้ง

---

## 11. Timezone & Date Handling

- ทุกการคำนวณ "วันนี้" และ `CREATE_DATETIME`/`UPDATE_DATETIME`/`APPROVE*_DATETIME` ต้องใช้ timezone **Asia/Bangkok (UTC+7)** โดยตรง ห้ามใช้ timezone ของ server เฉยๆ — ใช้ `Utilities.formatDate(date, "Asia/Bangkok", pattern)` เสมอ
- `TRANS_DATE` เก็บเป็น string รูปแบบ `yyyy-MM-dd` เพื่อเลี่ยงปัญหา timezone shift ตอนอ่าน/เขียน Google Sheets

---

## 12. Validation Rules & Error Handling

| # | กติกา | ระดับ |
|---|---|---|
| V-1 | ทุก `record_id` ที่ `header_flag='N'` ใน `FORM_MASTER` ต้องมี key ตรงกันใน `answers` (ค่า `Y`/`N`/`-`) ก่อนบันทึก ห้ามขาดข้อใดข้อหนึ่ง | client + server |
| V-2 | `PROJECT` ต้องเลือกจาก list ที่ได้จาก `getProjects` เท่านั้น (ห้ามพิมพ์อิสระ) | client + server |
| V-3 | `approve_profile1` ต้องเลือกจาก `getApprove` เท่านั้น | client + server |
| V-4 | ห้ามแก้ไข record ที่ `STATUS` เป็น `PENDING_L2` หรือ `APPROVED` (BR-2) | server (บังคับ แม้ client จะบัคก็ตาม) |
| V-5 | ห้ามสร้าง record ซ้ำสำหรับ `Line_UID` + `TRANS_DATE` เดียวกันถ้าตัวเดิม `STATUS=APPROVED` (BR-1) | server |
| V-6 | `approveAction` เมื่อ `level=1` ต้องมี `approveProfile2` เสมอ | server |
| V-7 | ตรวจสิทธิ์ผู้อนุมัติจริงกับ `approve_profile1`/`approve_profile2` ของ record ก่อนอนุมัติ/ปฏิเสธทุกครั้ง | server |

Error response ต้องระบุ `code` ที่ frontend ใช้ตัดสินใจแสดงข้อความได้ เช่น `NOT_ALL_ANSWERED`, `DUPLICATE_DATE`, `RECORD_LOCKED`, `UNAUTHORIZED_APPROVER`, `AUTH_FAILED`

---

## 13. Open Items — ต้องยืนยันกับผู้ให้โจทย์ก่อนขึ้น Production

| # | ประเด็น | ผลกระทบถ้าไม่ยืนยัน / สถานะล่าสุด |
|---|---|---|
| ~~OI-1~~ | ~~เพิ่มคอลัมน์ `answer_column_no`~~ | **ยกเลิกแล้ว** — เปลี่ยนไปใช้ JSON เก็บคำตอบตาม Decision D4 |
| OI-2 | `FM-SA-03` ในโจทย์เดิมหมายถึงชีตเดียวกับ `FORM_MASTER` จริงหรือไม่ | ใช้ชีต `FORM_MASTER` ใน Spreadsheet เดียวกัน |
| OI-3 | คอลัมน์ `score` ต้องคำนวณ/แสดงผลรวมคะแนนใน MVP นี้หรือไม่ | ยังไม่คำนวณคะแนนใน Phase 1 |
| OI-4 | ช่องเหตุผลตอนปฏิเสธ (`REJECT_REASON`) บังคับกรอกหรือไม่ | บังคับกรอกเมื่อกดปฏิเสธใน Modal |
| ~~OI-5~~ | ~~Contract จริงของ `getUsers` และ `getApprove` API~~ | **[ปิดแล้ว v1.3 — ตาม D7]** ใช้ Central MasterCacheAPI ดึงผ่าน Tag: L1 = `"จป.วิชาชีพ"`, L2 = `"จป.บริหาร"` และ Token = `"secret-token-12345"` |
| ~~OI-6~~ | ~~เอกสาร integration-guide.md ของ API รายชื่อโครงการ~~ | **[ปิดแล้ว v1.3]** เชื่อมต่อ Central API ดึง Dataset Key = `"project"` สำเร็จ |
| ~~OI-7~~ | ~~จะใช้ MasterCacheAPI หรืออ่านจากชีตตรงทุกครั้ง~~ | **[ปิดแล้ว v1.2 — ตาม D5]** เก็บ `FORM_MASTER` ในไฟล์เดียวกับ Transaction + ใช้ `CacheService` ภายในโปรเจกต์เอง อายุ 6 ชม. พร้อม Trigger รายวัน refresh |
| OI-8 | ข้อความเทมเพลตแจ้งเตือน LINE และ `LINE_CHANNEL_ACCESS_TOKEN` พร้อมใช้หรือยัง | ถ้ายังไม่กำหนด token ระบบจะข้ามการ push notification โดยไม่ error |
| OI-9 | ยืนยัน "1 project/วัน" หมายถึง 1 record ต่อ (ผู้ใช้ + วันที่) | 1 วัน ผู้ใช้สามารถเลือกวันที่ตรวจสอบได้ และบันทึก/แก้ไขตามวันนั้น |
| OI-10 | ยืนยันจุดล็อกการแก้ไข: ล็อกทันทีที่ L1 อนุมัติ หรือช้ากว่านั้น | ล็อกทันทีเมื่อ `STATUS` เป็น `PENDING_L2` หรือ `APPROVED` |
| OI-11 | ตอนกด "อนุมัติทั้งหมด" ผู้อนุมัติ L2 ที่เลือกใช้ร่วมกันทุกรายการในชุดนั้นใช่หรือไม่ | ใช่ ผู้อนุมัติระดับ 1 เลือกผู้อนุมัติ L2 ท่านเดียวสำหรับ batch นั้น |
| OI-12 | ควรห้ามเลือก `TRANS_DATE` เป็นวันที่ในอนาคตหรือไม่ | มี Datepicker กำหนดค่าเริ่มต้นเป็นวันปัจจุบัน |
| **OI-12b (v1.2)** | ตั้ง Trigger refresh cache รอบเดียว/วัน (05:00) | มีสคริปต์ `TriggerSetup.gs` รองรับ |
| **OI-13 (v1.2)** | ถ้า `FORM_MASTER` เกิน 100 KB ต่อ cache key | เฝ้าระวังขนาดคำถาม ปัจจุบันมี 20 ข้อ ขนาดประมาณ ~2 KB |

---

## 14. UI/UX Requirements (Mobile-first)

- **Header / Navigation Bar:**
  - แสดงเฉพาะโลโก้และชื่อไตเติล `🛡️ FM-SA-03` ชัดเจนในบรรทัดเดียว (`white-space: nowrap;`)
  - นำป้าย Sub-badge `Safety Checklist` ออกเพื่อไม่ให้เบียดกับ Avatar และชื่อผู้ใช้งาน
- **หัวข้อการตรวจ (Inspection Questions Visual Hierarchy):**
  - ข้อความหัวข้อคำถามต้องเป็น **จุดนำสายตาหลัก (Primary Focus)** ที่ผู้ใช้ต้องอ่านก่อนกดเสมอ
  - ขนาดตัวอักษรหัวข้อคำถาม: **`1.05rem` (หนา Bold 700)** สีดำเข้ม `#0F172A` (Contrast สูง สบายตา อ่านง่ายในไซต์งานกลางแจ้ง)
  - หมายเลขข้อคำถาม (1., 2., ...): **`1.15rem` (Extra-Bold 800)** สีน้ำเงินสด `#2563EB`
  - กล่องการ์ดคำถาม (`.question-card`): ขอบมน `radius-sm` มีเงาบางเบาและเน้นกรอบซ้ายสีน้ำเงินเมื่อตอบแล้ว (`.answered`)
- **ปุ่มตัวเลือกคำตอบ (Segmented Control Buttons):**
  - มี 3 ตัวเลือกกระชับ: **`✅ ผ่าน`** (Y), **`❌ ไม่ผ่าน`** (N), **`➖ ไม่ตรวจ`** (-)
  - ขนาดตัวอักษร: **`0.90rem` (Semi-bold 600)** และ Padding **`10px 4px`** ปรับขนาดให้เป็น Action รอง ไม่แย่งความเด่นของหัวข้อ
  - ล็อกสีทึบชัดเจนเมื่อ Active (`!important`):
    - `✅ ผ่าน`: พื้นเขียว `#10B981` ตัวหนังสือขาว `#FFFFFF`
    - `❌ ไม่ผ่าน`: พื้นแดง `#EF4444` ตัวหนังสือขาว `#FFFFFF`
    - `➖ ไม่ตรวจ`: พื้นเทาเข้ม `#64748B` ตัวหนังสือขาว `#FFFFFF`
  - กำหนด `outline: none;` และ `-webkit-tap-highlight-color: transparent;` พร้อมสโคป `:not(.active-*)` เพื่อป้องกันบั๊ก Mobile Hover/Focus Contrast ที่ทำให้ตัวหนังสือขาวกลืนกับพื้นขาว
- **ความคืบหน้าและการบันทึก:**
  - แสดง Progress Bar ติดตามเปอร์เซ็นต์และจำนวนข้อที่ตอบแล้ว (เช่น "100% (20/20)")
  - ปุ่ม "💾 บันทึกผลการตรวจสอบ" เป็น Sticky Bottom Bar ตรึงด้านล่างจอเสมอ
- **หน้าจออนุมัติ (Approval View):**
  - แสดงแบบ Card List แยกแท็บ "รออนุมัติระดับ 1" และ "รออนุมัติระดับ 2"
  - มี Modal รายละเอียดข้อตรวจ แสดงสถานะเป็น Badge `✅ ผ่าน`, `❌ ไม่ผ่าน`, `➖ ไม่ตรวจ` ตรงกันทุกหน้าจอ

---

## 15. ภาคผนวก: ขั้นตอนเพิ่ม/แก้ไข/ลบข้อคำถามในอนาคต (Runbook สำหรับ Admin)

หลังเปลี่ยนมาเก็บคำตอบเป็น `ANSWERS_JSON` (Decision D4) ขั้นตอนนี้**ง่ายลงมาก** เพราะไม่ต้องแก้ schema ของ `FMSA03_TRANSACTION` อีกต่อไป:

- **เพิ่มคำถามใหม่:** เพิ่มแถวใหม่ใน `FORM_MASTER` (record_id ใหม่ตัวถัดไป, item_name, header_flag) แค่นั้นจบ — ไม่ต้องแตะ `FMSA03_TRANSACTION` เลย
- **ลบคำถามเดิม:** ลบแถวออกจาก `FORM_MASTER` (หรือ mark เป็น inactive) — record เก่าที่เคยมีคำตอบข้อนี้ใน `ANSWERS_JSON` จะยังมี key ค้างอยู่ ซึ่งไม่เป็นอันตราย
- **แก้ไขข้อความคำถาม:** แก้ `item_name` ตรงๆ ได้เลย ไม่กระทบ `ANSWERS_JSON` เพราะ key อ้างอิงด้วย `record_id` ไม่ใช่ข้อความ
- **สลับลำดับ/แทรกคำถามกลาง:** ทำได้อย่างปลอดภัย 100% เพราะ `ANSWERS_JSON` ไม่ได้อ้างอิงตามตำแหน่งแถวเลย — **ข้อควรระวังเดียว** คือห้ามนำ `record_id` เดิมที่เคยใช้ไปแล้วกลับมาใช้ซ้ำกับคำถามอื่น

> **[เพิ่มใหม่ v1.2 — สำคัญ]** เนื่องจาก `FORM_MASTER` อ่านผ่าน Cache แล้ว (หมวด 5.1.2) การแก้ไข/เพิ่ม/ลบคำถามข้างต้น**จะยังไม่แสดงผลทันที**ในแอป จนกว่าจะถึงเงื่อนไขใดเงื่อนไขหนึ่งต่อไปนี้:
> 1. Cache หมดอายุตามรอบ 6 ชม. เอง (ระบบจะ lazy-refresh ให้อัตโนมัติ)
> 2. Time-driven Trigger รายวันทำงาน (เรียก `refreshFormMasterCache()`)
> 3. Admin เรียกฟังก์ชัน `refreshFormMasterCache()` เอง (manual force-refresh) — แนะนำเพิ่มปุ่มนี้ใน Admin UI (ดู OI-12b)

---

*จบเอกสาร — กรุณาให้ผู้ให้โจทย์ยืนยัน Decision Log (หมวด 0) และ Open Items (หมวด 13) ก่อนทีม Dev เริ่มเขียนโค้ดจริง เพื่อลดรอบแก้งานย้อนหลัง*
