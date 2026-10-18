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
records แต่ละตัวต้องเป็น common-schema event และ source ตรงกับ envelope; ไม่เติม source ให้อัตโนมัติ
ขนาด body สูงสุด 1 MB และ 1–500 records; ไม่รองรับ multipart, CSV, ZIP หรือ vendor-native JSON ในขั้นนี้
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

หมายเหตุ: server มี health/readiness, auth, ingest-key management, single-event JSON ingestion และ log search/detail แล้ว ยังไม่มี dashboard APIs และไม่รัน migrations/seed อัตโนมัติ
