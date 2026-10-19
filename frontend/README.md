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

Only implemented routes are exposed: `#/logs`, `#/logs/:id`, `#/account`. Dashboard, alert/rule screens, admin management and password change remain for subsequent increments. Admin-only controls are not implemented yet; backend remains authoritative for all permissions.

## Checks

```powershell
npm test
npm run lint
npm run build
```

Node tests cover the API client's cookie/204/401/cancellation/error behavior and timezone formatting. They are not browser integration tests.

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
