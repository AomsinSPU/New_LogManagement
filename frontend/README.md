# LogManage frontend

Thai-first React frontend. Uses existing React, Vite, CSS and Oxlint; no additional runtime dependencies.

## Run

From `e:\Port\New_LogManagement\frontend`:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173`. Start the backend separately. API defaults to `http://localhost:3000`; optionally set `VITE_API_URL` in an ignored local environment file. This value is public build-time configuration: never place keys or passwords in VITE variables.

Backend FRONTEND_ORIGIN must match the browser origin exactly. Use localhost consistently, not a mix of localhost and 127.0.0.1. Vite uses strict port 5173 to avoid accidental CORS failures. Production requires HTTPS, same-site cookie-compatible frontend/API deployment, and the correct backend origin configuration. Hash routes do not need server-side SPA fallback rules.

## Implemented increment

- Thai login, remember-session option, logout and session restoration.
- HttpOnly cookie-based API requests; no localStorage token or password storage.
- Central protected-request 401 handling; network errors distinct from expired sessions.
- Responsive dark sidebar/light content layout, actual tenant name and role.
- Logs with URL filters, offset pagination, details, metadata/raw and clipboard action.
- Bangkok timestamps with Gregorian years; datetime inputs explicitly interpreted as UTC+7.
- Read-only account information.

Implemented routes: `#/dashboard` (default), `#/logs`, `#/logs/:id`, `#/alerts`, `#/alerts/:id`, `#/alert-rules`, `#/account`. Dashboard includes outcome cards, an SVG timeline with an accessible data table, top IP/user/event-type lists, explicit shared time bounds, source filtering and drilldown to Logs. Ranges are limited to 90 days; bucket intervals adapt to stay within backend limits. Refresh reloads the displayed range; use the recent-period buttons to advance it to now. User management and password change remain for subsequent increments. Backend remains authoritative for all permissions.

Additional Admin-only routes: `#/imports`, `#/imports/:id` and `#/ingest-keys`. Import and ingest-key management are implemented; user management and password change remain.

## Ingest keys

- Admin-only list, creation and revocation. Viewer direct navigation does not fetch keys. Backend authorization is authoritative.
- Creation requires a name (1–100 characters) and at least one allowed source. Optional expiry is interpreted as Bangkok time and must be in the future. Blank expiry means no expiry.
- Full secret is held only in component memory after creation, never in localStorage, sessionStorage or URLs. Copy it securely before dismissing the panel, navigating away or reloading. The list exposes only the prefix and public metadata. A reload/close warning is registered while the secret panel is open; in-app navigation still clears it.
- Clipboard success/failure is reported; copying may leave the secret in the operating-system clipboard. The app does not claim to erase clipboard history or browser developer-tools network records.
- Revocation requires confirmation, supports the API's empty 204 response, and cannot be undone. Existing keys are never rotated or revoked automatically. Expiry labels reflect device time at render; refresh to update them.
- Network/server failure during creation blocks resubmission in that form because a key may already exist even if its secret response was lost. Close the form, refresh and inspect the list before creating again; revoke any confirmed unusable key deliberately.
- Fixture browser tests cover Viewer denial without API requests, source validation, cancelled creation/revocation, secret copying and dismissal, no browser-storage/URL persistence, revocation and uncertain creation. No real keys are created or revoked by these tests.

## Import and history

- Admin-only menu and route guard; Viewer direct navigation does not fetch import data. Backend authorization remains authoritative.
- Select a JSON envelope `{source, records, filename?}`. Supports 1–500 records, maximum 1 MiB for the file and serialized request including filename. This page does not convert CSV, JSONL or plain syslog files. Source-specific record validation is performed by the backend.
- Preview filename/source/count/bytes and confirm before sending application/json. No upload happens when merely selecting a file.
- Treat `201` completed/partial/failed distinctly. Display accepted/rejected counts and up to 50 record errors; backend zero-based error indices are displayed as one-based positions.
- History includes machine batches and user uploads, filters source/status, offset pagination, detail and links to Logs using batch_id.
- Duplicate clicks are locked while submitting. A network error or server failure makes the result uncertain: upload is blocked until the user checks history and explicitly acknowledges duplicate risk. There is no automatic POST retry or rollback.
- Browser fixture tests cover Viewer denial without API access, malformed JSON, cancelled confirmation, partial/failed `201`, detail-to-Logs drilldown, status filters and uncertain-result locking. No main-database import is executed by the smoke test.

## Alert behavior

- Alerts list supports status filters and offset pagination, retained in the detail return link.
- Detail shows evidence IDs, the recorded rule snapshot and sampled-evidence notice. Evidence may no longer exist after retention. The alert window is based on **ingested_at**, not event time; evidence links use log IDs, not an incorrect event-time filter.
- Only Admin sees acknowledge/resolve actions. Both require confirmation, prevent duplicate submissions and show errors without automatic mutation retries. Resolved alerts cannot reopen. On a 409 conflict, reload the latest status.
- Both roles can read rules. Admin can create/edit and enable/disable via the edit form. Only `failed_login_threshold` is supported. Window and cooldown inputs are explicitly in seconds. PATCH sends only changed fields.
- The backend does not accept empty/null descriptions on PATCH; the form explains and blocks clearing an existing description rather than silently keeping it.
- Workers must run separately. This UI does not start workers or claim that collectors/workers are online. No delete-rule or reopen-alert action is offered because there is no supporting contract.
- Browser smoke coverage additionally checks Viewer read-only controls, missing evidence, cancelled confirmation (no write), conflict/reload, acknowledge/resolve, empty filtered list and Admin rule create/edit/disable. All writes are synthetic fixture writes, never main-database writes.

## Checks

```powershell
npm test
npm run lint
npm run build
npm run test:browser
```

Node tests cover the API client, timezone formatting, dashboard bounds and drilldown filters. The browser smoke script runs the built app in an isolated headless Edge profile using Node's built-in WebSocket/CDP support (Node 24 tested), with no added dependencies. Set EDGE_PATH to override the browser executable. It uses synthetic API responses injected before app startup, never the real backend or existing credentials. It checks login errors, refresh/session restoration, dashboard, shared ranges, drilldown, details, pagination, empty/error/retry states, mobile layout, session expiry and logout. Temporary profiles and the local static server are cleaned up afterward. This does NOT certify real HttpOnly cookies, CORS, tenant isolation or backend integration; complete the checklist below against a running backend separately.

## Browser acceptance checklist (requires running backend and existing accounts)

1. Login using an existing account; refresh and verify tenant name/session restoration.
2. Invalid login displays a Thai error; offline API offers a retry without clearing the session.
3. Apply logs filters, open a detail, return, refresh and navigate browser history; filters persist in URL.
4. Empty result, invalid ID, missing log, failed request and pagination render correctly.
5. Raw JSON is text (never injected HTML); copy succeeds or shows a failure message.
6. Logout returns to login. An expired protected request returns to login with notice.
7. Verify Admin and Viewer access only permitted data; cross-tenant IDs are rejected by backend.
8. Test narrow viewport, keyboard focus and menu toggle.

Do not run seeds, retention apply, or production workers just to validate the frontend.
