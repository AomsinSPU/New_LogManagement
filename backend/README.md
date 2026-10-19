# โครงสร้าง Backend

โครงสร้างปัจจุบันภายใต้ `e:\Port\New_LogManagement\backend` (ไม่แสดง dependencies ใน node_modules)

```text
e:\Port\New_LogManagement\backend
├── db/
│   ├── migrations/
│   │   ├── 000_create_migration_history.sql
│   │   ├── 001_create_tenants.sql
│   │   ├── 002_create_users.sql
│   │   ├── 003_create_user_sessions.sql
│   │   ├── 004_create_ingest_keys.sql
│   │   ├── 005_create_ingestion_batches.sql
│   │   ├── 006_create_logs.sql
│   │   ├── 007_create_alert_rules.sql
│   │   ├── 008_create_alerts.sql
│   │   └── 009_add_search_indexes.sql
│   └── seeds/
│       └── 001_demo_tenants.sql
├── scripts/
│   ├── create-admin.js
│   ├── migrate.js
│   ├── run-sql.js
│   └── seed.js
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── env.js
│   ├── db/
│   │   └── pool.js
│   ├── jobs/
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── authorize.js
│   │   ├── body-parser.js
│   │   ├── cors.js
│   │   ├── csrf.js
│   │   ├── error-handler.js
│   │   ├── http-error.js
│   │   ├── ingest-auth.js
│   │   ├── not-found.js
│   │   ├── security.js
│   │   └── validate.js
│   ├── modules/
│   │   ├── auth/
│   │   │   └── auth.routes.js
│   │   └── ingest-keys/
│   │       ├── ingest-keys.routes.js
│   │       ├── ingest-keys.controller.js
│   │       ├── ingest-keys.service.js
│   │       ├── ingest-keys.repository.js
│   │       └── ingest-keys.schema.js
│   └── normalizers/
├── tests/
│   ├── auth.integration.js
│   ├── ingest-keys.integration.js
│   ├── ingest-keys.test.js
│   ├── middleware.test.js
│   ├── schema.sql
│   ├── seeds.sql
│   └── setup.test.js
├── package.json
├── package-lock.json
└── README.md
```

## Database

โฟลเดอร์ `e:\Port\New_LogManagement\backend\db\migrations` เก็บ SQL สำหรับสร้างและเปลี่ยนโครงสร้างฐานข้อมูล เรียงตามเลขนำหน้าชื่อไฟล์

| ไฟล์ในโฟลเดอร์ migrations | หน้าที่ |
| --- | --- |
| 000_create_migration_history.sql | ตารางประวัติ migrations และฟังก์ชันอัปเดตเวลาแก้ไขข้อมูล |
| 001_create_tenants.sql | บริษัท/ลูกค้าเจ้าของข้อมูล |
| 002_create_users.sql | บัญชีผู้ใช้และ role Admin/Viewer |
| 003_create_user_sessions.sql | Session สำหรับการเข้าสู่ระบบ |
| 004_create_ingest_keys.sql | กุญแจสำหรับโปรแกรมส่ง log |
| 005_create_ingestion_batches.sql | ผลนำเข้าไฟล์หรือข้อมูลเป็นชุด |
| 006_create_logs.sql | ตาราง log กลางสำหรับทุก source |
| 007_create_alert_rules.sql | เงื่อนไขแจ้งเตือน |
| 008_create_alerts.sql | ผลการแจ้งเตือน |
| 009_add_search_indexes.sql | Indexes สำหรับค้นหา log, ตรวจ alert และ retention |

ไฟล์ `e:\Port\New_LogManagement\backend\db\seeds\001_demo_tenants.sql` เก็บข้อมูลตัวอย่างที่สัมพันธ์กันครบทุกตารางหลัก แม้ชื่อไฟล์จะกล่าวถึง tenants เท่านั้น บัญชีและ credentials ในชุดนี้ไม่สามารถใช้ login หรือส่ง log จริงได้

## Scripts

| ตำแหน่งไฟล์ | หน้าที่ที่เตรียมไว้ |
| --- | --- |
| `e:\Port\New_LogManagement\backend\scripts\migrate.js` | รัน migrations ตามลำดับและข้ามไฟล์ที่บันทึกใน history แล้ว ผ่าน npm run db:migrate |
| `e:\Port\New_LogManagement\backend\scripts\create-admin.js` | สร้าง Admin จาก ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TENANT_SLUG ใน environment; hash ด้วย Argon2id ไม่เขียนทับบัญชีเดิม |
| `e:\Port\New_LogManagement\backend\scripts\seed.js` | รัน demo seed แบบ insert-only ผ่าน npm run db:seed หลัง migrations ครบ; ไม่อนุญาตเมื่อ NODE_ENV=production |
| `e:\Port\New_LogManagement\backend\scripts\run-sql.js` | ตัวรัน SQL ร่วม ใช้ connection เดียวและ advisory lock กัน migrations/seed รันพร้อมกัน; ใช้ transaction ในไฟล์ SQL เดิม ไม่มี checksum ตรวจการแก้ไฟล์ที่เคยรันแล้ว |

## Source code

ไฟล์ตั้งต้นที่พร้อมใช้งาน:

| ตำแหน่งไฟล์ | หน้าที่ |
| --- | --- |
| `e:\Port\New_LogManagement\backend\src\config\env.js` | โหลด environment จาก root ของโปรเจกต์และตรวจค่าด้วย Zod โดยไม่แสดง secrets |
| `e:\Port\New_LogManagement\backend\src\db\pool.js` | สร้าง PostgreSQL pool ตรวจ connection และปิด pool |
| `e:\Port\New_LogManagement\backend\src\app.js` | ประกอบ middleware, health/readiness endpoints, JSON 404 และ error handler |
| `e:\Port\New_LogManagement\backend\src\server.js` | ตรวจ database ก่อนเปิด server และจัดการ shutdown |

หน้าที่ของโฟลเดอร์ source (jobs และ normalizers ยังว่าง):

| ตำแหน่งโฟลเดอร์ | โค้ดที่จะเก็บ |
| --- | --- |
| `e:\Port\New_LogManagement\backend\src\config` | โหลดและตรวจ configuration/environment variables |
| `e:\Port\New_LogManagement\backend\src\db` | Connection pool และตัวช่วยเชื่อมต่อ PostgreSQL ไม่ใช่ไฟล์สร้างตาราง |
| `e:\Port\New_LogManagement\backend\src\jobs` | งานเบื้องหลัง เช่น ตรวจ alert และลบ log ที่หมดอายุ |
| `e:\Port\New_LogManagement\backend\src\middleware` | ตรวจตัวตน สิทธิ์ และจัดการข้อผิดพลาดของ request |
| `e:\Port\New_LogManagement\backend\src\modules` | แยกฟีเจอร์ เช่น auth, ingest, logs, dashboard และ alerts |
| `e:\Port\New_LogManagement\backend\src\normalizers` | แปลง log จากแต่ละ source ให้เป็น schema กลาง |

ไฟล์ `e:\Port\New_LogManagement\backend\src\modules\auth\auth.routes.js` ประกอบ POST /auth/login, GET /auth/me และ POST /auth/logout พร้อม validation, Argon2 verification, session cookie และ process-local login limiter (10 ครั้งต่อ IP ใน 15 นาที)
ตอนนี้ auth logic ยังรวมในไฟล์ routes; เมื่อขยาย module ค่อยแยก controller/service/repository
Login ใช้ session cookie ชื่อ session, HttpOnly, SameSite=Lax และ Secure เมื่อ NODE_ENV=production
remember=true ตั้งอายุ cookie/session 7 วัน; ค่า false ใช้ browser-session cookie กับ server expiry 8 ชั่วโมง ทั้งสองแบบยังมี idle timeout 30 นาทีตาม middleware
POST endpoints ต้องส่ง Origin ตรง FRONTEND_ORIGIN ส่วน frontend fetch ต้องส่ง credentials: include
Limiter เก็บใน memory ต่อ process และยังไม่ตั้ง trust proxy; ต้องออกแบบ proxy/shared limiter ก่อน deploy หลาย replicas หรือหลัง reverse proxy

## Middleware

ไฟล์ทั้งหมดในตารางนี้อยู่ภายใต้ `e:\Port\New_LogManagement\backend\src\middleware`

| ไฟล์ | หน้าที่ |
| --- | --- |
| security.js | Helmet security headers ใช้งานใน app แล้ว |
| cors.js | อนุญาต frontend origin ที่กำหนดและ credentials ใช้งานใน app แล้ว |
| body-parser.js | JSON limit 1 MB และ cookie parser ใช้งานใน app แล้ว |
| not-found.js | JSON 404 ใช้งานท้าย routes ใน app แล้ว |
| error-handler.js | ตอบ error โดยไม่เผย stack trace หรือ database details ใช้งานใน app แล้ว |
| http-error.js | ตัวช่วยสร้าง error พร้อม HTTP status |
| auth.js | ตรวจ session cookie กับฐานข้อมูล รวม expiry, revocation, idle timeout 30 นาที และสถานะ user/tenant |
| authorize.js | ตรวจ Admin/Viewer หลัง session authentication ไม่ยอมรับ ingest identity |
| ingest-auth.js | ตรวจ Bearer ingest key และสิทธิ์ source หลัง validation |
| csrf.js | ตรวจ Origin ให้ตรง FRONTEND_ORIGIN สำหรับคำขอเปลี่ยนข้อมูลใน browser/session routes; ปฏิเสธ Origin ที่หายหรือไม่ตรง |
| validate.js | ตรวจ Zod schemas แล้วเก็บผลที่ request.validated โดยไม่แก้ request.query |

Auth, CSRF และ validation ผูกกับ auth routes แล้ว; role ผูกกับ ingest-key management แล้ว ส่วน ingest authentication ยังรอ ingestion route
ลำดับ session route ที่เสนอ: authenticate → csrfProtection สำหรับ mutation → authorize → validate → controller
Login ใช้ csrfProtection แม้ยังไม่มี session และมี process-local rate limiting
ลำดับ ingest route: authenticateIngest → validate → authorizeSource → controller

Session cookie ใช้ชื่อ session โดยค่าเริ่มต้น; session token และ Bearer ingest key ต้องเป็น random 32 bytes ในรูป lowercase hex 64 ตัวอักษร
ตัวสร้าง credentials ในอนาคตต้องเก็บ SHA-256 hex digest ให้ตรงกับ middleware; ไม่ใช้รูปแบบนี้แทน password hashing
Identity ที่ตรวจแล้วอยู่ที่ request.auth และ tenant_id ต้องมาจาก identity นี้ ไม่ใช่ body/header ของ client
สำหรับ batch แบบ source เดียว controller ต้องตรวจว่า records ทุกตัวตรงกับ source ที่ผ่านสิทธิ์แล้ว
Middleware ไม่ได้เพิ่ม tenant filters ให้ query อัตโนมัติ และไม่ได้แทน RLS หรือ repository authorization
Origin check ไม่ใช่ตัวพิสูจน์ตัวตน; Postman ที่เรียก session mutation ต้องส่ง Origin ที่อนุญาตด้วย ส่วน ingest route ไม่ใช้ cookie/CSRF middleware

## Ingest-key module

ไฟล์ภายใต้ `e:\Port\New_LogManagement\backend\src\modules\ingest-keys`:

| ไฟล์ | หน้าที่ |
| --- | --- |
| ingest-keys.routes.js | GET/POST /ingest-keys และ DELETE /ingest-keys/:id พร้อม session, CSRF และ Admin guard |
| ingest-keys.controller.js | รับ validated input และส่ง HTTP response |
| ingest-keys.service.js | สร้าง secret 32 random bytes, SHA-256 hash, pagination และผลการเพิกถอน |
| ingest-keys.repository.js | Parameterized SQL ที่ระบุ tenant ทุกครั้งและเลือกเฉพาะ columns ที่เปิดเผยได้ |
| ingest-keys.schema.js | Zod validation: name, allowed_sources, optional expires_at, UUID และ limit/offset |

POST รับ name และ allowed_sources (ไม่ซ้ำกัน); expires_at เป็น RFC3339 ในอนาคต หรือ null/ไม่ส่งเพื่อไม่กำหนดหมดอายุ
ไม่รับ tenant_id/created_by จาก client แต่ใช้ session; response 201 มี key metadata และ secret ซึ่งแสดงเฉพาะครั้งสร้าง
GET ส่ง data และ pagination (limit เริ่มต้น 20 สูงสุด 100, offset, has_more) รวม key ที่ revoked/expired แต่ไม่มี hash หรือ secret
DELETE เป็นการ revoke ไม่ลบแถว ตอบ 204 แม้ถูก revoke แล้ว; key ต่าง tenant หรือไม่มีอยู่ตอบ 404 เหมือนกัน
ทุกรายการใช้ Admin ของ tenant ตัวเองเท่านั้น; Viewer ตอบ 403; mutations ต้องมี Origin ตรง FRONTEND_ORIGIN
เก็บ secret ไว้นอก source control และใช้ Authorization: Bearer ใน ingestion API ที่จะพัฒนาต่อ

## HTTP ingestion module

โฟลเดอร์ `e:\Port\New_LogManagement\backend\src\modules\ingest` มี ingest.routes.js, ingest.controller.js,
ingest.service.js, ingest.repository.js และ ingest.schema.js แยก routing, response, normalization flow,
parameterized INSERT และ Zod validation ตามลำดับ

ไฟล์ `e:\Port\New_LogManagement\backend\src\normalizers\common-json.js` แปลง common JSON event:
@timestamp → event_timestamp (UTC), user → actor_user และเพิ่ม timestamp_inferred เมื่อไม่มีเวลา
POST /ingest รับ object เดี่ยวแบบ common schema ด้วย Content-Type: application/json และ Bearer ingest secret
ไม่ใช้ session cookie หรือ CSRF; ไม่ต้องส่ง Origin สำหรับ machine client
ต้องมี source และ event_type; รองรับ message, outcome, severity, network/user/host fields, metadata และ tags
tenant_id และ ingest_key_id มาจาก key ที่ตรวจแล้ว; ไม่รับฟิลด์เหล่านี้จาก client
ตอบ 201 หลัง INSERT สำเร็จ พร้อม data.id, source, event_timestamp, ingested_at
body-parser เก็บ original decoded JSON text ไว้เป็น raw ก่อน normalize เฉพาะ /ingest
ไม่รับ raw จาก client; JSON limit 1 MB, metadata 64 KB, tags สูงสุด 32 รายการ

นี่คือ common JSON ingestion ไม่ใช่ vendor-native parsers: แม้ source ระบุ ad/aws ได้ ข้อมูลต้องอยู่ใน common schema
Single-event endpoint ไม่รับ array; ใช้ batch/import endpoints ด้านล่างสำหรับหลาย records ยังไม่มี Syslog หรือ deduplication
ไฟล์ `e:\Port\New_LogManagement\backend\tests\ingest.test.js` ตรวจ normalization/validation
ไฟล์ `e:\Port\New_LogManagement\backend\tests\ingest-keys.integration.js` ตรวจ HTTP ingest กับ PostgreSQL เพิ่มเติม
รวม raw preservation, tenant/key provenance, revoked keys, source permissions และ rejected records ที่ไม่ถูกบันทึก

## Logs module

โฟลเดอร์ `e:\Port\New_LogManagement\backend\src\modules\logs` แยก logs.routes.js,
logs.controller.js, logs.service.js, logs.repository.js และ logs.schema.js
ทำหน้าที่ routing/สิทธิ์, HTTP response, pagination/404, SQL ที่จำกัด tenant และ validation ตามลำดับ

GET /logs และ GET /logs/:id ใช้ session cookie สำหรับ Admin/Viewer เท่านั้น ไม่ใช้ ingest key
List รองรับ from (รวมขอบล่าง), to (ไม่รวมขอบบน) ตาม event_timestamp, source, src_ip, dst_ip,
user (actor_user), event_type, outcome, severity แบบตรงค่า และ q สำหรับ full-text search เฉพาะ message
q ใช้ plainto_tsquery/simple ไม่ใช่ substring search ของ raw/metadata และไม่รับ tenant_id จาก client
limit เริ่มต้น 20 สูงสุด 100; offset เริ่มต้น 0 สูงสุด 100000; response มี data และ pagination.has_more
เรียง event_timestamp DESC,id DESC; offset pagination อาจเลื่อนเมื่อมี insert/delete ระหว่างเปลี่ยนหน้า
ไม่จำกัดช่วงเวลาเริ่มต้น เพื่อให้ค้นพบ seed เก่าได้; ไม่มี total count ใน response
List ไม่ส่ง raw/metadata ส่วน detail ส่งข้อมูลเหล่านี้ด้วยและไม่ส่ง search_vector
ID ที่ไม่มีหรือเป็นของ tenant อื่นตอบ 404 เหมือนกัน; UUID/query ผิดตอบ 400

ไฟล์ `e:\Port\New_LogManagement\backend\tests\logs.test.js` ตรวจ query validation และ parameterized filters
ไฟล์ `e:\Port\New_LogManagement\backend\tests\ingest-keys.integration.js` ทดสอบ ingest → list/detail
พร้อม filters, full-text search, pagination, Viewer access และ cross-tenant isolation บน PostgreSQL จริง

## Batch และ JSON file import

ไฟล์ `e:\Port\New_LogManagement\backend\src\modules\ingest\batch.service.js` ตรวจ envelope และ records
ใช้ normalization/repository เดิมร่วมกัน สร้าง batch และบันทึก accepted records ใน transaction เดียว
POST /ingest/batch ใช้ Bearer key; source ต้องอยู่ใน allowed_sources
ไฟล์ `e:\Port\New_LogManagement\backend\src\modules\imports\imports.routes.js` มี POST /imports และ GET /imports/:id
ใช้ Admin session และ Origin สำหรับ POST; จำกัด batch detail ด้วย tenant จาก session

ทั้งสอง POST รับ application/json รูปแบบ { source, filename (optional), records: [...] }
records แต่ละตัวต้องเป็น common-schema event หรือ vendor envelope ที่รองรับ และ source ตรงกับ batch; ไม่เติม source ให้อัตโนมัติ
ขนาด body สูงสุด 1 MB และ 1–500 records; ไม่รองรับ multipart, CSV, ZIP หรือไฟล์ export เต็มก้อนของ vendor โดยตรง
อัปโหลดไฟล์ JSON โดยส่ง bytes ของไฟล์เป็น body application/json (Postman binary พร้อมตั้ง Content-Type)
filename เป็น label เท่านั้น ไม่อ่าน path หรือเขียนไฟล์ลง server
ตัวอย่างไฟล์: `e:\Port\New_LogManagement\samples\api\batch.json`

ตอบ 201 หมายถึงสร้างผล batch แล้ว ไม่ได้หมายความว่าทุก record สำเร็จ ต้องอ่าน data.status และ counters:
completed = สำเร็จทั้งหมด, partial = ถูกบางส่วน, failed = ทุก record ถูกปฏิเสธ
error_summary เก็บสูงสุด 50 ข้อผิดพลาด โดย index เริ่มที่ 0 และไม่สะท้อน raw/secrets
Validation errors ไม่หยุด records อื่น แต่ database error ทำให้ rollback ทั้ง batch และตอบ 500
raw ของแต่ละ record เก็บ JSON.stringify ของ object ต้นฉบับก่อน normalize ไม่เก็บ whitespace เดิมของไฟล์
ระบบไม่เก็บไฟล์ทั้งก้อน; ส่งซ้ำจะเกิด batch/log ใหม่ ไม่ใช่ idempotent upload
ไม่มีการรัน migrations หรือปรับ schema เพิ่มในงานนี้

ไฟล์ `e:\Port\New_LogManagement\backend\tests\batch.test.js` ตรวจขนาด envelope และ rollback
Integration tests ใน `e:\Port\New_LogManagement\backend\tests\ingest-keys.integration.js` ครอบคลุม
partial/completed/failed, tenant, role, source permission และ batch/log provenance

## Vendor JSON adapters

`e:\Port\New_LogManagement\backend\src\normalizers\vendor-json.js` ตรวจ envelope และแปลงข้อมูลเป็น common schema ก่อนบันทึก
ใช้ได้กับ POST /ingest, POST /ingest/batch และ POST /imports; common JSON เดิมยังใช้ได้
รูปแบบ record คือ `{ "format": "vendor", "source": "ad", "data": { "EventID": 4625 } }`
ใน batch ให้ใส่ envelope นี้เป็นสมาชิกของ records และระบุ source ชั้นนอกให้ตรงกัน

ขอบเขตที่ทดสอบเป็น JSON subsets ไม่ใช่ parser ของ vendor exports ทุกแบบ:
- AD: flat JSON EventID 4624/4625, TimeCreated, TargetUserName, IpAddress, Computer; ไม่รับ Windows XML หรือ nested EventData
- AWS: CloudTrail record เดี่ยวที่มี eventName; ConsoleLogin ใช้ responseElements.ConsoleLogin/errorCode หา outcome; ไม่แกะ Records wrapper ให้อัตโนมัติ
- M365: Operation, CreationTime, UserId, ClientIP, ResultStatus; CreationTime ISO ที่ไม่มี timezone ตีความเป็น UTC; ไม่แกะ AuditData string
- CrowdStrike: synthetic DetectionSummary fixture ของโปรเจกต์เท่านั้น ไม่ใช่การรับรอง Falcon native export; severity ต้องอยู่ช่วง 0–10
- IP ที่ไม่ใช่ literal IPv4/IPv6 ไม่ใส่ src_ip แต่เก็บไว้ใน metadata.original และติด tag non_ip_source_address
- ไม่ทราบ outcome ใช้ unknown; ไม่อนุมานว่าไม่มี error แล้วสำเร็จเสมอ
- ไม่มี timestamp ใช้เวลารับและ timestamp_inferred; timestamp ผิดรูปแบบถูกปฏิเสธ
- metadata.original เก็บ payload เดิม; raw เก็บ envelope ต้นฉบับตาม pipeline เดิม

ตัวอย่างไฟล์อยู่ที่ `e:\Port\New_LogManagement\samples\ad\batch.json`,
`e:\Port\New_LogManagement\samples\aws\batch.json`,
`e:\Port\New_LogManagement\samples\m365\batch.json` และ
`e:\Port\New_LogManagement\samples\crowdstrike\batch.json`
ทั้งหมดเป็นข้อมูลจำลอง ไม่ใช่ข้อมูลลูกค้าจริง และตั้งใจเว้นเวลาเพื่อใช้ทดสอบกับเวลาปัจจุบัน
`e:\Port\New_LogManagement\backend\tests\vendor-json.test.js` ตรวจ mappings/invalid input;
integration tests ตรวจการบันทึกทั้งสี่ sources พร้อม tenant, raw และ metadata ในฐานข้อมูลชั่วคราว

## Syslog collector (local demo)

- `e:\Port\New_LogManagement\backend\src\normalizers\syslog.js`: RFC5424 subset version 1, structured-data ต้องเป็น `-`; ไม่รองรับ RFC3164, XML, quoted key/value หรือ vendor-specific formats
- `e:\Port\New_LogManagement\backend\src\collectors\syslog.js`: UDP IPv4 receiver -> common JSON -> POST /ingest; ไม่เขียนฐานข้อมูลตรง
- `e:\Port\New_LogManagement\backend\scripts\syslog-collector.js`: โหลด root .env และเริ่ม collector ด้วย `npm run collector:syslog`
- `e:\Port\New_LogManagement\backend\tests\syslog.test.js`: parser และ UDP/HTTP tests; PostgreSQL end-to-end อยู่ใน ingest-keys.integration.js
- ตัวอย่างอยู่ใน `e:\Port\New_LogManagement\samples\firewall\syslog.txt` และ `e:\Port\New_LogManagement\samples\network\syslog.txt`

ตั้ง SYSLOG_INGEST_KEY เป็น secret ของ key ที่อนุญาต source ที่เลือกใน environment (ห้าม commit secret)
ค่าที่ปรับได้: SYSLOG_HOST=127.0.0.1, SYSLOG_PORT=5514, SYSLOG_SOURCE=firewall,
SYSLOG_ALLOWED_SENDERS=127.0.0.1 (comma-separated exact IPv4), SYSLOG_INGEST_URL=http://localhost:3000/ingest
tenant มาจาก ingest key; หนึ่ง collector configuration ต่อ source/tenant ไม่เชื่อ tenant ในข้อความ
ข้อความ MSG แบบ demo รับ src_ip,dst_ip,src_port,dst_port,protocol,action,user เป็น key=value ไม่มีช่องว่างในค่า
severity mapping ของแอปจาก Syslog 0..7 เป็น [10,9,8,7,5,3,1,0]; outcome คง unknown เพราะ deny ไม่เท่ากับ authentication failure
เวลาที่เป็น `-` ใช้ timestamp_inferred; เก็บ datagram ต้นฉบับใน metadata.syslog.raw ส่วน logs.raw เป็น JSON ที่ collector ส่ง

ขอบเขตความทนทาน: จำกัด datagram 8192 bytes และ in-flight 100 requests, timeout 5 วินาที,
ไม่มี persistent queue/retry; HTTP fail, overload และ shutdown อาจทำให้ข้อมูลสูญหาย จึงเป็น demo ไม่ใช่ reliable delivery
UDP sender allowlist ไม่ใช่การพิสูจน์ตัวตน; อย่าเปิด receiver สู่อินเทอร์เน็ต ใช้ trusted network/firewall เท่านั้น
collector บังคับ HTTPS นอก loopback, ไม่ตาม HTTP redirects, ไม่พิมพ์ secret/raw ลง error logs
ยังไม่ได้เพิ่ม Docker service หรือ UDP cloud exposure; backend ต้องเปิดอยู่ก่อนเริ่มส่งข้อมูล

## Simulator

- `e:\Port\New_LogManagement\backend\src\simulator\simulator.js`: generate common JSON and demo Syslog, bounded sequential sending and summary
- `e:\Port\New_LogManagement\backend\scripts\simulate.js`: CLI via `npm run simulate -- ...`; loads root .env
- `e:\Port\New_LogManagement\backend\tests\simulator.test.js`: validation, HTTP, denied key, cancellation and UDP -> collector -> HTTP tests

Run from `e:\Port\New_LogManagement\backend`. Set SIMULATOR_INGEST_KEY in root .env or process environment for HTTP (source permission required).
No key argument is accepted, to avoid putting secrets in command history.

```powershell
npm run simulate -- --source api --count 20 --interval 1000
npm run simulate -- --source ad --scenario failed-login --count 5 --interval 1000
npm run simulate -- --transport udp --source firewall --count 10 --interval 500 --host 127.0.0.1 --port 5514
```

Options: transport=http|udp, source=api|ad|aws|m365|crowdstrike|firewall|network,
scenario=mixed|failed-login, count=1..10000 (default 20), interval=10..60000 milliseconds (default 1000).
HTTP URL defaults to http://localhost:3000/ingest; --url accepts HTTPS or loopback HTTP only, no credentials/query/fragment or redirects.
All HTTP events are synthetic common-schema JSON, not native vendor fixtures. Time is generated per event.
Failed-login uses one IP (203.0.113.10) and user, and only supports api/ad/aws/m365.
Tags/metadata include simulator/run ID/sequence; repeated runs create additional logs, not idempotent records.
HTTP accepted means response 201. UDP sent only means the local send succeeded, NOT persistence at the server.
UDP supports firewall/network mixed only; the collector configuration determines stored source/tenant, so set it to match.
Syslog run ID/sequence remain in the raw message. UDP port must point to a running collector, not the HTTP server.
Summary reports attempted/accepted/sent/failed; Ctrl+C aborts waiting or HTTP requests and closes sockets.
No retry or durable queue. Common client/auth errors and HTTP 429 stop the run; other failures count and continue.
HTTP timeout is 5 seconds. Count is bounded; interval is a delay after each send, not a guaranteed rate.
These commands create real demo logs in the target tenant. Do not run on production data by accident.
Simulator only generates events; alert creation still requires the not-yet-implemented worker.

## Dashboard APIs

Module files under `e:\Port\New_LogManagement\backend\src\modules\dashboard`:
- dashboard.routes.js: session and Admin/Viewer authorization, validation
- dashboard.schema.js: shared log filters, date defaults and bounded queries
- dashboard.controller.js / dashboard.service.js: response and authenticated tenant
- dashboard.repository.js: tenant-scoped aggregates using the same buildLogFilter as Logs

GET /dashboard/summary returns data.total, failures, successes, unknown and top_ips/top_users/top_event_types.
Top lists contain {value,count}, exclude NULL values, sort count descending then value, and default to 10 items (-- query top=1..20).
All summary aggregates use one SQL statement/snapshot. No raw events or secrets are returned.
GET /dashboard/timeline returns data entries {bucket_start,bucket_end,count}, interval and range.
Both require session cookie and return Cache-Control: no-store; ingest keys cannot read dashboards.

Shared filters: from,to,source,src_ip,dst_ip,user,event_type,outcome,severity,q (message full-text).
No tenant_id or pagination parameters accepted. Tenant is derived from session.
Default range: last 24 hours. If only to is supplied, from is 24 hours before it; if only from is supplied, to is now.
Response includes resolved UTC range; use that same range on /logs to compare counts.
Range semantics: from <= event_timestamp < to; maximum 90 days.
Timeline interval=minute|hour|day (default hour), maximum 1000 buckets; choose a coarser interval for longer periods.
Buckets start at the exact from instant, not calendar boundaries, use fixed UTC durations, include zero counts, and clip the last bucket to to.
For synchronized summary/timeline requests supply explicit identical from/to values.

Examples: /dashboard/summary?source=api&top=5 and /dashboard/timeline?source=api&interval=hour
Tests: `e:\Port\New_LogManagement\backend\tests\dashboard.test.js`; PostgreSQL HTTP integration is included in ingest-keys.integration.js.
No migrations, dependencies or precomputed dashboard tables added. Query cost still depends on matching logs; load testing remains future work.

## Alert rules, alerts and worker

Files under `e:\Port\New_LogManagement\backend\src\modules\alerts`:
- alerts.schema.js: rule create/patch, pagination and status validation; PATCH never applies create defaults
- alerts.repository.js: tenant-scoped SQL and locked status transitions
- alerts.routes.js: Admin mutations, Admin/Viewer reads, session and Origin checks
- `e:\Port\New_LogManagement\backend\src\jobs\alert-job.js`: failed-login threshold evaluation
- `e:\Port\New_LogManagement\backend\scripts\alert-worker.js`: standalone worker process

Endpoints (session required; mutations also require configured Origin):
GET /alert-rules, POST /alert-rules, PATCH /alert-rules/:id
GET /alerts, GET /alerts/:id, PATCH /alerts/:id
Lists accept limit (1..100, default 20) and offset; alerts additionally accept status.
Cross-tenant IDs return 404. Viewer can read but cannot create/update rules or change alert status.

POST /alert-rules example:
```json
{"name":"Repeated failed login","threshold":5,"window_seconds":300,"cooldown_seconds":300,"severity":5}
```
PATCH a rule with {"is_enabled":false} to disable it; no delete endpoint is exposed.
PATCH an alert with {"status":"acknowledged"} or {"status":"resolved"}.
Open alerts may be acknowledged or resolved directly; acknowledged may resolve; resolved cannot reopen (409).
Repeating the current status is idempotent and retains original timestamps/actor.

From `e:\Port\New_LogManagement\backend`:
```powershell
npm run worker:alerts -- --once
npm run worker:alerts
```
Continuous mode waits 30 seconds after each completed evaluation. It is not started by npm run dev.
Use a supervised, always-running process for deployment; on database error it exits nonzero.
Ctrl+C/SIGTERM finishes the current evaluation, interrupts the wait and closes the pool.

Detection groups authentication/failure logs by tenant and non-NULL source IP across sources.
Time window uses ingested_at (not event_timestamp), includes start and excludes end; inactive tenants/disabled rules are skipped.
Only logs in the current rolling window are evaluated: this is not a historical catch-up engine after long downtime.
Rule row locks serialize evaluation across worker instances and configuration edits.
Cooldown is per tenant/rule/IP and applies even if the previous alert is resolved.
Latest sampled log ID prevents re-alerting unchanged evidence; a unique hash additionally prevents duplicate inserts.
After cooldown a qualifying window must have a different latest log before another alert is created.
Evidence keeps a rule snapshot and at most 20 newest IDs; event_count is the full count, not sample length.
Each rule uses a transaction; if one rule fails, earlier committed rules remain and the process exits.
No email/webhook delivery or retention job yet. No new migrations or dependencies.
Tests: `e:\Port\New_LogManagement\backend\tests\alerts.test.js` and PostgreSQL integration in ingest-keys.integration.js.

## User management and retention

- `e:\Port\New_LogManagement\backend\src\modules\users\users.schema.js`: create/patch/password validation
- `e:\Port\New_LogManagement\backend\src\modules\users\users.service.js`: transactional user management, last-admin guard, password verification and session revocation
- `e:\Port\New_LogManagement\backend\src\modules\users\users.routes.js`: Admin user routes and authenticated password-change handlers
- `e:\Port\New_LogManagement\backend\src\jobs\retention-job.js`: tenant retention and expired/revoked session cleanup, advisory lock, bounded batches
- `e:\Port\New_LogManagement\backend\scripts\retention.js`: dry-run default; --apply opts into deletion
- `e:\Port\New_LogManagement\backend\tests\users-retention.integration.js`: disposable PostgreSQL tests including concurrent demotion
- `e:\Port\New_LogManagement\backend\FRONTEND_API.md`: frontend endpoint contract, errors, access and limitations

Run all integration suites with npm run test:integration. No new migrations required.
Retention is a one-shot command for an external scheduler; it is not automatically started with the API.
Existing passwords/secrets are not changed by adding these APIs. Password-change tests only modify temporary test users.

## Frontend readiness update

Login และ GET /auth/me ส่ง user.tenant {id,name,slug} สำหรับชื่อองค์กร โดยเก็บ tenant_id เดิมไว้
GET /imports แสดงประวัติทั้ง Admin imports และ machine batches ภายใน tenant; เฉพาะ Admin
รองรับ limit/offset/source/status; หน้า list ไม่ส่ง error_summary ให้เรียก detail เมื่อต้องการรายละเอียด
GET /logs รองรับ batch_id แบบ UUID เพื่อเปิดเหตุการณ์ของ batch โดยยังตรวจ tenant เสมอ
Dashboard ใช้ shared filters จึงรองรับ batch_id เช่นกัน
ไม่ต้องรัน migration ใหม่ และไม่มีการเปลี่ยนรหัสผ่านหรือ secrets
API contract ฉบับ frontend อยู่ใน `e:\Port\New_LogManagement\backend\FRONTEND_API.md`

ตรวจซ้ำด้วย npm test และ npm run test:integration (สร้าง/ลบฐานข้อมูลทดสอบแยก ไม่ใช้ข้อมูลหลัก)
ความพร้อมนี้หมายถึง local MVP APIs; production deployment, least-privilege DB roles, backup/load/browser tests ยังต้องทำแยก

## Tests และไฟล์จัดการโปรเจกต์

| ตำแหน่งไฟล์ | หน้าที่ |
| --- | --- |
| `e:\Port\New_LogManagement\backend\tests\schema.sql` | ตรวจ constraints, ความสัมพันธ์ และการทำงานของ schema ด้วย SQL |
| `e:\Port\New_LogManagement\backend\tests\seeds.sql` | ตรวจจำนวนและความสัมพันธ์ของข้อมูล demo seeds |
| `e:\Port\New_LogManagement\backend\tests\setup.test.js` | ทดสอบ environment, health/readiness, CORS และ HTTP errors ด้วย Node test runner |
| `e:\Port\New_LogManagement\backend\tests\middleware.test.js` | Unit tests สำหรับ session, roles, ingest source, validation และ CSRF โดยจำลอง database; npm test รัน JavaScript tests ทั้งหมด |
| `e:\Port\New_LogManagement\backend\tests\auth.integration.js` | ทดสอบ auth HTTP กับ PostgreSQL จริงในฐานข้อมูลชั่วคราวแล้วลบออก; รันแยกด้วย node tests/auth.integration.js ต้องใช้บัญชีที่สร้างฐานข้อมูลได้ |
| `e:\Port\New_LogManagement\backend\tests\ingest-keys.test.js` | Unit tests สำหรับ validation, secret hashing และ tenant จาก identity |
| `e:\Port\New_LogManagement\backend\tests\ingest-keys.integration.js` | HTTP/PostgreSQL tests ของ create/list/revoke, Viewer, cross-tenant, CSRF และ revoked credentials ในฐานข้อมูลชั่วคราว |
| `e:\Port\New_LogManagement\backend\package.json` | รายละเอียด package, dependencies และ npm scripts |
| `e:\Port\New_LogManagement\backend\package-lock.json` | บันทึกเวอร์ชัน dependencies ที่ resolve สำหรับการติดตั้งซ้ำ |
| `e:\Port\New_LogManagement\backend\README.md` | อธิบายโครงสร้างไฟล์ backend |

หมายเหตุ: server มี health/readiness, auth, users, ingest-key management, ingestion, logs, dashboard และ alert APIs แล้ว ไม่รัน migrations/seed อัตโนมัติ; alert worker และ retention ต้องรันแยก
