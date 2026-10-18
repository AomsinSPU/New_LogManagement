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
│   ├── modules/
│   └── normalizers/
├── tests/
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

หน้าที่ของโฟลเดอร์ source (jobs, middleware, modules และ normalizers ยังว่าง):

| ตำแหน่งโฟลเดอร์ | โค้ดที่จะเก็บ |
| --- | --- |
| `e:\Port\New_LogManagement\backend\src\config` | โหลดและตรวจ configuration/environment variables |
| `e:\Port\New_LogManagement\backend\src\db` | Connection pool และตัวช่วยเชื่อมต่อ PostgreSQL ไม่ใช่ไฟล์สร้างตาราง |
| `e:\Port\New_LogManagement\backend\src\jobs` | งานเบื้องหลัง เช่น ตรวจ alert และลบ log ที่หมดอายุ |
| `e:\Port\New_LogManagement\backend\src\middleware` | ตรวจตัวตน สิทธิ์ และจัดการข้อผิดพลาดของ request |
| `e:\Port\New_LogManagement\backend\src\modules` | แยกฟีเจอร์ เช่น auth, ingest, logs, dashboard และ alerts |
| `e:\Port\New_LogManagement\backend\src\normalizers` | แปลง log จากแต่ละ source ให้เป็น schema กลาง |

ภายในแต่ละ module วางแผนแยกเป็น routes (กำหนด endpoint), controller (รับ request/ส่ง response), service (กฎการทำงาน) และ repository (query ฐานข้อมูล) โดยยังไม่ได้สร้างไฟล์เหล่านี้

## Tests และไฟล์จัดการโปรเจกต์

| ตำแหน่งไฟล์ | หน้าที่ |
| --- | --- |
| `e:\Port\New_LogManagement\backend\tests\schema.sql` | ตรวจ constraints, ความสัมพันธ์ และการทำงานของ schema ด้วย SQL |
| `e:\Port\New_LogManagement\backend\tests\seeds.sql` | ตรวจจำนวนและความสัมพันธ์ของข้อมูล demo seeds |
| `e:\Port\New_LogManagement\backend\tests\setup.test.js` | ทดสอบ environment, health/readiness, CORS และ HTTP errors ด้วย Node test runner |
| `e:\Port\New_LogManagement\backend\package.json` | รายละเอียด package, dependencies และ npm scripts |
| `e:\Port\New_LogManagement\backend\package-lock.json` | บันทึกเวอร์ชัน dependencies ที่ resolve สำหรับการติดตั้งซ้ำ |
| `e:\Port\New_LogManagement\backend\README.md` | อธิบายโครงสร้างไฟล์ backend |

หมายเหตุ: server มีเฉพาะ endpoints ตรวจสถานะ ยังไม่มี authentication หรือ business APIs และยังไม่ได้รัน migrations/seed อัตโนมัติ
