# คู่มือเชื่อมต่อ MasterCacheAPI — สำหรับทีม Dev ที่พัฒนา Web App

**เวอร์ชัน:** 1.0  
**อัปเดตล่าสุด:** 2026-08-26  
**เจ้าของระบบ:** Pingly (System Owner)

---

## 1. MasterCacheAPI คืออะไร?

เป็น **Central Web App** (Google Apps Script) ทำหน้าที่เป็น **API กลาง** สำหรับ cache ข้อมูล master data (เช่น รายชื่อ Site, Route ฯลฯ) ให้ทุก Web App ในระบบเรียกใช้ร่วมกัน

### สถาปัตยกรรม 3-Layer Cache

```
[Browser localStorage]  →miss→  [Central API (CacheService)]  →miss→  [Google Sheet]
    TTL 24 ชม.                       TTL 6 ชม.                         Source of Truth
    (แยกตามแต่ละแอป)                  (ก้อนเดียว ใช้ร่วมกันทุกแอป)        (Central API เป็นคนอ่าน)
```

**ประโยชน์สำหรับแอปของคุณ:**
- 99%+ ของ page load ตอบจาก localStorage ทันที (ไม่มี network call)
- ไม่ต้องเขียน logic cache เอง — copy ไฟล์ 2 ตัววางแล้วใช้ได้เลย
- ถ้า Central API ล่ม แอปของคุณ **ยังทำงานได้** (fallback ไป Sheet ตรง)

---

## 2. ข้อมูลการเชื่อมต่อ

| รายการ | ค่า |
|--------|-----|
| **Central API URL** | `https://script.google.com/macros/s/AKfycbwhbYUFPHlMq5KrtHRZUNTjeHsKtSF2IW0bEzJZwL-hqBhzFx3gXR4ijL83ajPs0zcQDA/exec` |
| **Method** | `POST` (JSON body) |
| **Authentication** | Shared-secret token (ขอจาก System Owner) |
| **GAS Project ID** | `1uUZrvVVjd3d8r5amtVuARiVd_0vgVIcSJVyKvdS2m1-GgZL23rhfnWA3` |

### Dataset Keys ที่ใช้ได้

| datasetKey | ข้อมูล | การใช้งาน / Actions | สถานะ |
|------------|--------|-------------------|--------|
| `site` | รายชื่อ Site/สาขา (Active) | `getList` (Master dropdown) | ✅ พร้อมใช้ |
| `users_profile` | โปรไฟล์ผู้ใช้, สิทธิ์หน้าจอ, รายชื่อผู้อนุมัติ | `verifyAccess`, `getApproveList`, `registerUser` | ✅ พร้อมใช้ |
| `route` | รายชื่อ Route | `getList` | 🔜 เพิ่มเร็วๆ นี้ |

> **หมายเหตุ:** แอปของคุณรู้แค่ `datasetKey` (string) เท่านั้น — ไม่ต้องรู้ว่าข้อมูลอยู่ Sheet ไหน คอลัมน์ไหน ถ้ามีการย้าย Sheet หรือเปลี่ยนโครงสร้าง จะแก้ที่ Central API จุดเดียว ไม่กระทบแอปของคุณเลย

---

## 3. วิธี Setup ในแอปของคุณ (ทำครั้งเดียว)

### 3.1 ตั้ง Script Properties

สามารถตั้งค่าได้ 2 วิธี:
- **วิธีที่ 1 (แนะนำ - สะดวกที่สุด):** ใน `CacheClientServer.gs` แก้ค่าในฟังก์ชัน `setupClientProps()` แล้วกด **Run** จาก Apps Script Editor ได้เลย
- **วิธีที่ 2:** ไปที่ ⚙️ **Project Settings** → **Script Properties** → เพิ่มค่าด้วยตนเอง:

| Property | Value | บังคับ |
|----------|-------|--------|
| `CENTRAL_APP_URL` | URL ของ Central API (ดูข้อ 2) | ✅ |
| `SHARED_TOKEN` | token ที่ได้จาก System Owner | ✅ |
| `ENABLE_SHEET_FALLBACK` | `false` (ปิด fallback/เห็น error) หรือ `true` (เปิด fallback) | ❌ (default: false) |

### 3.2 Copy ไฟล์ 2 ตัวมาวางในแอปของคุณ

#### ไฟล์ที่ 1: `CacheClientServer.gs` (ฝั่ง server)

สร้างไฟล์ใหม่ในแอปของคุณ ชื่อ `CacheClientServer.gs` แล้ว copy โค้ดด้านล่างไปวาง:

```js
var _clientProps = PropertiesService.getScriptProperties().getProperties();
var CENTRAL_APP_URL = _clientProps['CENTRAL_APP_URL'] || '';
var SHARED_TOKEN = _clientProps['SHARED_TOKEN'] || '';

// สวิตช์ fallback: false = throw error ให้เห็นทันที (แนะนำช่วงแรก), true = สลับไปอ่าน Sheet ตรง
var ENABLE_SHEET_FALLBACK = _clientProps['ENABLE_SHEET_FALLBACK'] === 'true' || false;

// === Wrapper Functions (เปิดให้ UI เรียกผ่าน google.script.run) ===

function getSiteList() {
  return callCentralCache('site', false);
}

function getSiteListForceFresh() {
  return callCentralCache('site', true);
}

// เพิ่ม dataset อื่น:
// function getRouteList() { return callCentralCache('route', false); }
// function getRouteListForceFresh() { return callCentralCache('route', true); }

// === Core: เรียก Central API + Fallback ===

function callCentralCache(datasetKey, forceFresh, fetcher) {
  fetcher = fetcher || defaultFetcher;
  try {
    var resText = fetcher(CENTRAL_APP_URL, {
      action: 'getList',
      datasetKey: datasetKey,
      forceFresh: forceFresh,
      token: SHARED_TOKEN
    });
    var json = JSON.parse(resText);
    if (!json.ok) throw new Error(json.error || 'Central App returned ok:false');
    return json.data;
  } catch (err) {
    Logger.log('[CacheClient] Central App call failed: ' + String(err));
    if (ENABLE_SHEET_FALLBACK) {
      Logger.log('[CacheClient] Fallback is ON: reading sheet directly for ' + datasetKey);
      return readSheetDirectly(datasetKey);
    }
    throw new Error('[CacheClient] Error fetching ' + datasetKey + ' from Central App: ' + (err.message || err));
  }
}

function defaultFetcher(url, payloadObj) {
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payloadObj),
    muteHttpExceptions: true
  });
  return res.getContentText();
}

// === Fallback: อ่าน Sheet ตรง (เมื่อ Central API ล่ม) ===

function readSheetDirectly(datasetKey) {
  var fallbackConfigs = {
    site: {
      spreadsheetId: '1CNTlNGn7w5rRDWundhnNgFaUII9kQvAEBUmWe0lpWGw',
      sheetName: 'Master_Site',
      valueColIdx: 1,    // B = index 1
      activeColIdx: 2    // C = index 2
    }
  };

  var cfg = fallbackConfigs[datasetKey];
  if (!cfg) { Logger.log('[CacheClient] No fallback for: ' + datasetKey); return []; }

  try {
    var ss = SpreadsheetApp.openById(cfg.spreadsheetId);
    var sheet = ss.getSheetByName(cfg.sheetName);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var isActive = data[i][cfg.activeColIdx];
      if (isActive === true || String(isActive).toUpperCase() === 'TRUE') {
        var val = data[i][cfg.valueColIdx];
        if (val !== '' && val !== null && val !== undefined) result.push(String(val).trim());
      }
    }
    result.sort(function(a, b) { return a.localeCompare(b, 'th'); });
    return result;
  } catch (e) {
    Logger.log('[CacheClient] Fallback FAILED: ' + String(e));
    return [];
  }
}

// === Helper Functions (รันจาก Editor) ===

function setupClientProps() {
  PropertiesService.getScriptProperties().setProperties({
    CENTRAL_APP_URL: 'https://script.google.com/macros/s/AKfycbwhbYUFPHlMq5KrtHRZUNTjeHsKtSF2IW0bEzJZwL-hqBhzFx3gXR4ijL83ajPs0zcQDA/exec',
    SHARED_TOKEN: 'YOUR_SHARED_TOKEN_HERE',
    ENABLE_SHEET_FALLBACK: 'false'
  });
  viewClientProps();
}

function viewClientProps() {
  var props = PropertiesService.getScriptProperties().getProperties();
  Logger.log('📋 Script Properties: ' + JSON.stringify(props, null, 2));
}

function enableFallback() {
  PropertiesService.getScriptProperties().setProperty('ENABLE_SHEET_FALLBACK', 'true');
  Logger.log('🔄 ปรับ ENABLE_SHEET_FALLBACK = true (เปิด Fallback)');
}

function disableFallback() {
  PropertiesService.getScriptProperties().setProperty('ENABLE_SHEET_FALLBACK', 'false');
  Logger.log('🔄 ปรับ ENABLE_SHEET_FALLBACK = false (ปิด Fallback)');
}
```

#### ไฟล์ที่ 2: `cache-client.html` (ฝั่ง browser)

สร้างไฟล์ HTML ใหม่ชื่อ `cache-client` แล้ว copy โค้ดด้านล่างไปวาง:

```html
<script>
var CacheClient = {
  getList: function(datasetKey, schemaVersion, serverFnName, ttlHours) {
    ttlHours = ttlHours || 24;
    var key = 'mcache_' + datasetKey + '_v' + schemaVersion;
    try {
      var raw = localStorage.getItem(key);
      if (raw) {
        var cached = JSON.parse(raw);
        if (cached && cached.expiresAt && Date.now() < cached.expiresAt) {
          return Promise.resolve(cached.data);
        }
      }
    } catch (e) { /* ข้ามไปเรียก server */ }

    var self = this;
    return new Promise(function(resolve, reject) {
      google.script.run
        .withSuccessHandler(function(data) {
          self.writeLocal(datasetKey, schemaVersion, data, ttlHours);
          resolve(data);
        })
        .withFailureHandler(reject)
        [serverFnName]();
    });
  },

  writeLocal: function(datasetKey, schemaVersion, data, ttlHours) {
    try {
      var key = 'mcache_' + datasetKey + '_v' + schemaVersion;
      localStorage.setItem(key, JSON.stringify({
        data: data, savedAt: Date.now(),
        expiresAt: Date.now() + (ttlHours * 3600 * 1000)
      }));
    } catch (e) { console.warn('localStorage write failed', e); }
  },

  clearLocal: function(datasetKey, schemaVersion) {
    try { localStorage.removeItem('mcache_' + datasetKey + '_v' + schemaVersion); }
    catch (e) { /* ไม่เป็นไร */ }
  }
};
</script>
```

### 3.3 Manifest (appsscript.json)

แอปของคุณต้องมี oauthScopes เหล่านี้:
```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

---

## 4. วิธีเรียกใช้งาน

### 4.1 ฝั่ง Server (.gs) — เรียกตรงๆ

```js
// ดึงรายชื่อ site
var sites = getSiteList();
// → ["สาขา A", "สาขา B", "สาขา C", ...]

// ดึงแบบ force fresh (ข้าม cache ทุกชั้น อ่าน Sheet ตรง)
var freshSites = getSiteListForceFresh();
```

### 4.2 ฝั่ง Browser (HTML) — ใช้ CacheClient

```html
<!-- Include cache-client ในหน้า HTML ของแอป -->
<?!= HtmlService.createHtmlOutputFromFile('cache-client').getContent(); ?>

<select id="siteSelect"></select>
<button id="btnRefresh">🔄 โหลดข้อมูลใหม่</button>

<script>
// โหลดตอนเปิดหน้า
async function loadSites() {
  var siteList = await CacheClient.getList('site', 1, 'getSiteList');
  var select = document.getElementById('siteSelect');
  select.innerHTML = '';
  siteList.forEach(function(name) {
    var opt = document.createElement('option');
    opt.value = name;
    opt.text = name;
    select.appendChild(opt);
  });
}

// ปุ่ม Refresh
document.getElementById('btnRefresh').onclick = async function() {
  CacheClient.clearLocal('site', 1);
  var fresh = await CacheClient.getList('site', 1, 'getSiteListForceFresh');
  // ... render fresh data
};

loadSites();
</script>
```

### 4.3 ฝั่ง Admin App — เมื่อแก้ไข Master Data แล้ว invalidate cache

```js
function onSaveSiteChanges() {
  // ... บันทึกลง Sheet ตามปกติ ...

  // แจ้ง Central API ให้ล้าง cache ทันที
  UrlFetchApp.fetch(
    PropertiesService.getScriptProperties().getProperty('CENTRAL_APP_URL'),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        action: 'clearCache',
        datasetKey: 'site',
        token: PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN')
      }),
      muteHttpExceptions: true
    }
  );
}
```

```

### 4.4 การตรวจสอบสิทธิ์เข้าใช้งานหน้าจอ (`verifyUserAccess`)

สำหรับหน้าจอ Web App ที่ต้องการตรวจสิทธิ์ก่อนแสดงผล หรือกรณี Login ผ่าน LINE LIFF / รหัสผ่าน:

#### ฝั่ง Server (.gs) ของ Web App:
```js
// ตรวจสอบผ่าน LINE UID (เช่น เข้าผ่าน LINE LIFF)
var result = verifyUserAccess({
  line_uid: 'U1234567890abcdef1234567890abcdef',
  screen_id: 1 // หมายเลขหน้าจอที่ต้องการเข้าใช้งาน
});

// หรือ ตรวจสอบผ่าน Username / Password
var result = verifyUserAccess({
  users_id: 'usr_m3k9xfk_7a9b2c',
  password: 'userPassword123',
  screen_id: 2
});

if (result.ok && result.authorized) {
  Logger.log('✅ อนุญาตให้เข้าใช้งาน: ' + result.user.users_name);
} else {
  Logger.log('❌ ปฏิเสธ: ' + result.statusCode + ' — ' + result.message);
}
```

#### ฝั่ง Browser UI (JavaScript):
```html
<script>
// ตัวอย่าง: ตรวจสิทธิ์เมื่อเปิดหน้าเว็บผ่าน LINE LIFF
async function checkAuthOnPageLoad() {
  await liff.init({ liffId: "YOUR_LIFF_ID" });
  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }
  
  var profile = await liff.getProfile();
  var lineUid = profile.userId;

  google.script.run
    .withSuccessHandler(function(res) {
      if (res.ok && res.authorized) {
        document.getElementById('welcomeText').innerText = 'ยินดีต้อนรับ ' + res.user.users_name;
        document.getElementById('appContent').style.display = 'block';
        // เก็บสิทธิ์ allowed_screens ไว้ใน sessionStorage เพื่อใช้ซ่อน/แสดงเมนู
        sessionStorage.setItem('allowed_screens', JSON.stringify(res.user.allowed_screens));
      } else {
        alert('ท่านไม่มีสิทธิ์เข้าใช้งานหน้าจอนี้: ' + res.message);
        document.getElementById('deniedContent').style.display = 'block';
      }
    })
    .withFailureHandler(function(err) {
      alert('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ' + err);
    })
    .verifyUserAccess({ line_uid: lineUid, screen_id: 1 });
}
</script>
```

---

### 4.5 การดึงรายชื่อผู้อนุมัติสำหรับ Dropdown (`getApproveUserList`)

สำหรับหน้าจอบันทึกคำขอที่ต้องการแสดง Dropdown ให้เลือกหัวหน้างาน / ผู้อนุมัติ:

```html
<label>เลือกผู้อนุมัติ:</label>
<select id="approverSelect">
  <option value="">-- กรุณาเลือกผู้อนุมัติ --</option>
</select>

<script>
// ดึงรายชื่อผู้อนุมัติกลุ่ม 1 (approve_list1)
google.script.run
  .withSuccessHandler(function(approvers) {
    var select = document.getElementById('approverSelect');
    approvers.forEach(function(u) {
      var opt = document.createElement('option');
      opt.value = u.users_id;
      // แสดงชื่อพร้อมรหัสพนักงาน
      opt.text = u.users_name + (u.emp_no ? ' (' + u.emp_no + ')' : '');
      // เก็บ line_uid ไว้สำหรับส่งข้อความแจ้งเตือน
      opt.setAttribute('data-line-uid', u.line_uid || '');
      select.appendChild(opt);
    });
  })
  .getApproveUserList(1);
</script>
```

---

## 5. API Reference

### 5.1 Request Formats

`POST` ไปยัง Central API URL

#### 1) Action `getList` (Master Data ทั่วไป เช่น `site`):
```json
{
  "action": "getList",
  "datasetKey": "site",
  "token": "<shared-secret token>",
  "forceFresh": false
}
```

#### 2) Action `verifyAccess` (ตรวจสอบสิทธิ์ผู้ใช้ & หน้าจอ):
```json
{
  "action": "verifyAccess",
  "datasetKey": "users_profile",
  "token": "<shared-secret token>",
  "line_uid": "U1234567890abcdef...",
  "users_id": "usr_m3k9xfk_7a9b2c",
  "password": "mypassword123",
  "screen_id": 1
}
```

#### 3) Action `getApproveList` (ดึงรายชื่อผู้อนุมัติ):
```json
{
  "action": "getApproveList",
  "datasetKey": "users_profile",
  "token": "<shared-secret token>",
  "approve_id": 1,
  "forceFresh": false
}
```

---

### 5.2 Response Formats — สำเร็จ

#### 1) Response `getList`:
```json
{
  "ok": true,
  "datasetKey": "site",
  "data": ["สาขา A", "สาขา B", "..."],
  "source": "cache",
  "schemaVersion": 1
}
```

#### 2) Response `verifyAccess` (ผ่านการอนุมัติ):
```json
{
  "ok": true,
  "authorized": true,
  "statusCode": "ACCESS_GRANTED",
  "message": "Access granted successfully",
  "user": {
    "users_id": "usr_m3k9xfk_7a9b2c",
    "users_name": "สมชาย มุ่งมั่น",
    "emp_no": "EMP0088",
    "email": "somchai.m@company.com",
    "line_uid": "U1234567890abcdef...",
    "active": "Y",
    "allowed_screens": [1, 2, 5],
    "approver_roles": [1]
  }
}
```

#### 3) Response `getApproveList`:
```json
{
  "ok": true,
  "approve_id": 1,
  "count": 2,
  "source": "cache",
  "data": [
    {
      "users_id": "usr_m3k9xfk_7a9b2c",
      "users_name": "กิตติศักดิ์ เจริญพร",
      "line_uid": "U9876543210fedcba...",
      "emp_no": "MGR001",
      "email": "kittisak.c@company.com"
    }
  ]
}
```

---

### 5.3 Error & Denial Codes

| Status / Error Code | สาเหตุ | แนวทางจัดการ |
|---|---|---|
| `USER_NOT_FOUND` | ไม่พบผู้ใช้จาก LINE UID ที่ส่งมา | นำทางไปหน้าผูกบัญชี / แจ้งติดต่อ Admin |
| `INVALID_CREDENTIALS` | รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง | ให้ตรวจสอบและกรอกรหัสผ่านใหม่ |
| `USER_INACTIVE` | บัญชีผู้ใช้ถูกระงับสิทธิ์ (`active != 'Y'`) | แจ้งติดต่อผู้ดูแลระบบ |
| `SCREEN_ACCESS_DENIED` | ไม่มีสิทธิ์ในหน้าจอนี้ (`Screen[N] != 'Y'`) | แสดงหน้าจอ Access Denied |
| `INVALID_SCREEN_ID` | หมายเลขหน้าจอไม่ถูกต้อง | ตรวจสอบพารามิเตอร์ `screen_id` |
| `invalid_token` | Token ที่ส่งมาไม่ตรงกับ Central API | ตรวจสอบ `SHARED_TOKEN` ใน Script Properties |
| `unknown_dataset` | datasetKey ไม่ถูกต้อง | ตรวจสอบชื่อ datasetKey |
{ "ok": false, "error": "sheet_read_failed", "message": "..." }
```

---

## 6. การทดสอบ (ก่อน Integration จริง)

### 6.1 ทดสอบด้วย Mock (ไม่ต้องมี Central API จริง)

Copy โค้ดด้านล่างไปวางในแอปของคุณ รันได้ทันทีวันแรก:

```js
// Mock Fetchers
function mockFetcher_success(dataArray) {
  return function(url, payloadObj) {
    return JSON.stringify({
      ok: true, datasetKey: payloadObj.datasetKey,
      data: dataArray, source: 'cache', schemaVersion: 1
    });
  };
}
function mockFetcher_networkFailure() {
  return function() { throw new Error('simulated network timeout'); };
}

// Tests
function test_wrapperParsesSuccessResponse() {
  var result = callCentralCache('site', false, mockFetcher_success(['สาขา A', 'สาขา B']));
  Logger.log(result.length === 2 ? '✅ PASS: parse สำเร็จ' : '❌ FAIL');
}

function test_wrapperFallsBackOnNetworkFailure() {
  var result = callCentralCache('site', false, mockFetcher_networkFailure());
  Logger.log(Array.isArray(result) && result.length > 0
    ? '✅ PASS: fallback สำเร็จ' : '❌ FAIL: fallback ไม่ทำงาน');
}
```

### 6.2 ทดสอบ Integration จริง

เมื่อตั้ง `CENTRAL_APP_URL` และ `SHARED_TOKEN` แล้ว:

```js
function test_realGetSiteList() {
  var list = getSiteList();
  Logger.log('ได้ ' + list.length + ' รายการ:');
  list.forEach(function(s, i) { Logger.log('  [' + i + '] ' + s); });
}
```

---

## 7. Error Handling — สิ่งที่แอปของคุณต้องรู้

| สถานการณ์ | พฤติกรรม | แอปของคุณต้องทำอะไร |
|-----------|----------|---------------------|
| Central API ล่ม/timeout | `callCentralCache` จะ fallback ไปอ่าน Sheet ตรงอัตโนมัติ | **ไม่ต้องทำอะไร** — ระบบจัดการเอง |
| localStorage เขียนไม่ได้ (private mode) | ข้ามไป เรียก server ทุกครั้ง | **ไม่ต้องทำอะไร** |
| Token ผิด / dataset ไม่รู้จัก | fallback ไป Sheet ตรง + log warning | ตรวจ log — แก้ Script Properties |
| ผู้ใช้เห็นข้อมูลเก่า | ปกติ — local cache ยังไม่หมดอายุ | ให้กดปุ่ม 🔄 Refresh |

**หลักการ: แอปของคุณจะไม่มีวันพังเพราะ cache** — worst case คือช้าลงเพราะกลับไปอ่าน Sheet ตรง

---

## 8. Checklist ก่อนขึ้น Production

- [ ] ตั้ง `CENTRAL_APP_URL` ใน Script Properties ✅
- [ ] ตั้ง `SHARED_TOKEN` ใน Script Properties ✅
- [ ] Copy `CacheClientServer.gs` มาวางในแอป ✅
- [ ] Copy `cache-client.html` มาวางในแอป ✅
- [ ] เพิ่ม oauthScopes ที่จำเป็น ✅
- [ ] รัน mock tests ผ่าน (ข้อ 6.1) ✅
- [ ] รัน integration test ผ่าน (ข้อ 6.2) ✅
- [ ] มีปุ่ม 🔄 Refresh ในหน้า UI ✅
- [ ] ทดสอบ fallback: แก้ `CENTRAL_APP_URL` ให้ผิดชั่วคราว → แอปยังทำงานได้ ✅

---

## 9. เพิ่ม Dataset ใหม่

ถ้าต้องการใช้ dataset ใหม่ (เช่น `route`):

1. **แจ้ง System Owner** เพิ่ม config ใน Central API (ทำที่ `DatasetConfigs.gs` จุดเดียว)
2. เพิ่ม wrapper function สั้นๆ ในแอปของคุณ:
   ```js
   function getRouteList() { return callCentralCache('route', false); }
   function getRouteListForceFresh() { return callCentralCache('route', true); }
   ```
3. เพิ่ม fallback config ใน `readSheetDirectly()` (ถ้าต้องการ safety net)
4. เรียกใช้ในหน้า HTML:
   ```js
   var routes = await CacheClient.getList('route', 1, 'getRouteList');
   ```

**ไม่ต้องแก้อะไรที่ Central API เลย ยกเว้นเพิ่ม config บรรทัดเดียว**
