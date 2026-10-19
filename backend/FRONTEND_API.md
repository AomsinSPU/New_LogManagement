# Frontend integration contract

Local API: `http://localhost:3000`. Frontend origin: `http://localhost:5173`.
Always use `credentials: 'include'` for session endpoints. Do not put session tokens in localStorage.
Browser sends Origin automatically. Postman mutations require Origin equal to FRONTEND_ORIGIN.
Use localhost consistently. Cookie is HttpOnly, SameSite=Lax; production requires HTTPS and same-site deployment.

## Endpoints

| Method/path | Access | Request / result |
|---|---|---|
| POST /auth/login | Public, Origin | email,password,remember -> {user}; sets cookie |
| GET /auth/me | Session | {user} |
| POST /auth/logout | Origin | 204; clears cookie |
| POST /auth/change-password | Session, Origin | current_password,new_password -> 204; invalidates ALL user's sessions, login again |
| GET /users | Admin | limit,offset -> {data,pagination} |
| POST /users | Admin, Origin | email,display_name,password,role -> 201 {data} |
| PATCH /users/:id | Admin, Origin | display_name,role,is_active -> {data}; role change/disable revokes sessions |
| GET /ingest-keys | Admin | limit,offset -> list |
| POST /ingest-keys | Admin, Origin | name,allowed_sources,expires_at? -> {key,secret}; secret shown once |
| DELETE /ingest-keys/:id | Admin, Origin | revoke -> 204 |
| POST /ingest | Bearer ingest key | common JSON/vendor envelope -> 201 {data} |
| POST /ingest/batch | Bearer ingest key | source,records,filename? -> 201 {data} |
| POST /imports | Admin, Origin | same JSON as batch, not multipart -> 201 {data} |
| GET /imports/:id | Admin | {data} |
| GET /imports | Admin | limit,offset,source?,status? -> {data,pagination}; includes both file imports and machine batches |
| GET /logs | Admin/Viewer | filters + limit,offset -> {data,pagination} |
| GET /logs/:id | Admin/Viewer | {data} including raw/metadata |
| GET /dashboard/summary | Admin/Viewer | filters + top -> {data,range} |
| GET /dashboard/timeline | Admin/Viewer | filters + interval -> {data,range,interval} |
| GET /alert-rules | Admin/Viewer | limit,offset -> {data,pagination} |
| POST /alert-rules | Admin, Origin | name,threshold,window_seconds,cooldown_seconds,severity,is_enabled? -> 201 {data} |
| PATCH /alert-rules/:id | Admin, Origin | changed fields only -> {data} |
| GET /alerts | Admin/Viewer | limit,offset,status? -> {data,pagination} |
| GET /alerts/:id | Admin/Viewer | {data} |
| PATCH /alerts/:id | Admin, Origin | status=acknowledged or resolved -> {data} |
| GET /health, /ready | Public | status; readiness can return 503 |

## UI rules

- Login and Me include user.tenant={id,name,slug}, in addition to the existing user.tenant_id. No tenant switch endpoint.
- Logs and Dashboard additionally accept batch_id (UUID); it is always combined with session tenant filtering.
- Import history is ordered by created_at/id descending; list omits error_summary, fetch detail to see errors. No total count.

- No request may choose its tenant. Cross-tenant resource IDs return 404.
- New passwords: 12–128 characters; existing passwords remain unchanged. No reset-password/admin password override implemented.
- Email is globally unique and immutable via PATCH; duplicate -> 409.
- Last active admin cannot be demoted/disabled -> 409. User create/patch and password changes limited to 20 attempts per user/15 min per process.
- Lists use offset pagination with has_more, not total pages. Default limit 20, maximum 100.
- Log filters: from,to,source,src_ip,dst_ip,user,event_type,outcome,severity,q. q searches message with full-text semantics.
- Time: from inclusive, to exclusive, based on event_timestamp. Dashboard defaults to last 24h, maximum 90 days.
- Use identical explicit from/to for Logs/Dashboard. Timeline maximum 1000 buckets; minute/hour/day, anchored to from, zeros filled.
- Import has maximum 500 records and 1 MB body. A 201 may have status partial/failed: display counters and error_summary.
- Role controls UI visibility, but server is authoritative. Viewer cannot mutate rules/alerts or manage users/keys/imports.
- Resolved alerts cannot reopen. Worker must run separately to generate alerts. Only latest rolling ingestion window is evaluated.
- Session idle timeout is 30 minutes, absolute lifetime 8 hours or 7 days with remember; handle 401 centrally.
- 204 has no JSON body. Errors: {"error":{"message":"..."}}. Validation currently returns generic 400, not field-level errors.
- Handle 401 login required, 403 forbidden, 404 missing, 409 conflict, 413 body too large, 429 retry later, 500 server failure.
- Do not assume a failed POST is safe to retry: ingestion has no idempotency key.

## Local acceptance commands

From `e:\Port\New_LogManagement\backend`:
```powershell
npm test
npm run test:integration
npm run dev
npm run worker:alerts
npm run db:retention
```
Retention defaults to dry-run. `npm run db:retention -- --apply` explicitly deletes expired logs/sessions.
Run apply from a scheduler (e.g. hourly) only after reviewing the dry-run. Bounded batches may require multiple invocations.
Logs use tenant retention (minimum 7 days, ingested_at); sessions retain 7 days after expiry/revocation.
Alerts and ingestion batch history are intentionally retained indefinitely for this MVP; no automatic cascade cleanup.
Do not manually delete a Docker volume to implement retention.

## Remaining production gates (not a claim of production certification)

Runtime least-privilege DB accounts, Docker/cloud deployment, backup/restore rehearsal, load testing,
distributed rate limiting, reliable collector queue, browser E2E and native vendor format coverage remain separate work.
No credentials have been rotated as part of frontend readiness implementation.