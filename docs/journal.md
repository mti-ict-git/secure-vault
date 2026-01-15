# Journal

## 2025-12-29
- Fix snapshot save to derive and cache missing vault keys when absent.
- Prevent "No vault key for vault" during team credential save.
- Ran ESLint and TypeScript no-emit checks; both passed with no errors.
- Fix TS errors in getVaultKeyByVaultId by removing unsafe casting and
  reordering helper declarations to avoid TDZ issues.
- Add on-demand /vaults refresh when key missing to fetch latest records
  and derive vault key before snapshot encryption.
- Instrument snapshot save logs with status, record presence, and derivation errors.
- Add DialogDescription to bulk move dialog to satisfy accessibility requirement.
- Add DialogDescription to Command dialog to satisfy accessibility requirement.
- Show toast when key derivation fails due to mismatched public key.
- Backend: Join latest team_members row in listVaultsForUser to avoid stale wrapped key selection.
- A11y: Add DialogDescription to add-entry and new-folder dialogs.
- Fix ReferenceError by importing DialogDescription where used (VaultSidebar, AddEntryDialog).

## 2025-12-29 20:25:53 +08:00
- Add theme_preference column to users via migration.
- Expose theme_preference on GET /me and add PATCH /me to update theme.
- Persist theme toggle to profile when authenticated.
- Load and apply user theme on login and session restore.
- Update validators, repo, and UI ThemeToggle accordingly.
- Ran ESLint and TypeScript no-emit checks; both completed successfully.

## 2025-12-29 20:28:39 +08:00
- Executed SQL migrations including 003_user_theme_preference.sql; all applied successfully.

## 2025-12-29 20:32:56 +08:00
- Persist theme on change automatically when authenticated (AuthContext effect).
- Added optimistic update of user.theme_preference after successful PATCH /me.

## 2025-12-28 09:03:18 +08:00
- Added `dev:full` script to run frontend and backend together.
- Updated backend dev script to watch mode for auto-restart.
- Added LDAP sign-in UI, JWT storage, and route protection in the frontend.
- Improved LDAP auth behavior and error mapping (`invalid_credentials`, `user_not_found`, `ldap_unavailable`).
- Migrated backend LDAP client usage to `ldapts` and removed explicit `any`.
- Improved login error messaging in the UI.
- Fixed lint/type issues in auth flow and JWT signing types.

## 2025-12-28 09:05:26 +08:00
- Fixed TypeScript narrowing for `LoginResult` in auth context.

## 2025-12-28 10:33:11 +08:00
- Enforced backend auth guard ordering so routes require JWT by default.
- Tightened team RBAC for invites, role changes, and member removals.
- Added soft-revoke semantics for team members and safer team deletion cleanup.
- Enforced vault access checks for blob list/download/upload and vault sharing.
- Filtered sync SSE events to only emit vault/team-relevant events per user.

## 2025-12-28 18:50:21 +08:00
- Replaced demo teams hook with backend API integration (teams, members, invites).
- Aligned frontend team roles with backend roles (owner/admin/editor/viewer).
- Kept Manage Members dialog synced to latest teams state.

## 2026-01-15 08:20:49 +0700
- Added Refresh button in VaultDashboard to re-fetch shared data without reload.
- Implemented refresh in useVault to decrypt latest vault snapshots using current keys.
- Wired refresh from Index page; validated with npx tsc and npm run lint.

## 2026-01-15 08:50:11 +0700
- Added global user role column via migration and backend role checks.
- Implemented admin-only GET /admin/audit with server-side filters.
- Enriched audit list with actor display names.
- Included user.role in GET /me; updated frontend auth types and routing.
- Added Administration page with Shadcn UI, filters, and audit display.
- Added Administration link in sidebar for admin users.
- Normalized ActivityView to accept backend items and underscore actions.
- Logged events: LDAP login success/failure, unlock success/failure, password/username copy.
- Ran eslint and TypeScript no-emit checks; both completed successfully.

## 2025-12-28 18:58:05 +08:00
- Fixed TypeScript TS5076 by adding parentheses around mixed nullish/OR fallback.

## 2025-12-28 19:23:43 +08:00
- Fixed first-time key setup flow to match backend keys API contract.
- Store encrypted private key as JSON string and validate/parse on unlock.

## 2025-12-28 19:35:23 +08:00
- Fixed auth state desync when API requests return 401.
- Dispatch global unauthorized event to clear JWT and return to login.
- Suppressed team-loading toasts during unauthorized state.

## 2025-12-28 19:44:39 +08:00
- Validate stored JWT with /me before marking session authenticated.
- Prevent initial render from calling protected APIs with invalid/stale token.

## 2025-12-28 19:49:25 +08:00
- Include backend 401 reason (unauthorized/invalid_token/session_revoked) in auth reset event.
- Validate freshly issued login token with /me before redirecting to app.

## 2025-12-28 19:51:24 +08:00
- Force /me validation to send explicit Authorization header after login.

## 2025-12-28 19:54:39 +08:00
- Allow CORS preflight OPTIONS requests to bypass JWT guard.

## 2025-12-28 19:58:55 +08:00
- Add LDAP fallback lookup by mail attribute when username is an email.

## 2025-12-28 20:02:52 +08:00
- Construct fetch headers via Headers() to ensure Authorization is sent.

## 2025-12-28 20:16:27
- Fix LDAP attribute parsing to avoid non-string mail/UPN values.
- Escape LDAP filter values and normalize LDAP unavailability errors.
- Map invalid_credentials correctly from LDAP login endpoint.

## 2025-12-28 20:28:36
- Fix JWT guard to accept trimmed/case-insensitive Bearer header.
- Refactor auth guard installation to avoid encapsulation issues.
- Update backend API test script to accept env credentials and validate /me.

## 2025-12-28 20:31:42
- Fix ESLint no-control-regex by rewriting LDAP filter escaping.

## 2025-12-28 20:36:13
- Improve unlock screen messaging to clarify master passphrase vs LDAP.
- Add keys reset endpoint and UI confirmation flow.

## 2025-12-28 20:40:55 +08:00
- Fix vault list response parsing and use per-user wrapped vault key.
- Normalize /keys/reset request string quoting.

## 2025-12-28 20:45:50 +08:00
- Fix vault blob list response parsing so snapshots load on refresh.
- Store snapshots as blob_type "snapshot" and auto-create personal vault when missing.

## 2025-12-28 20:55:56 +08:00
- Fix blob upload 415 by normalizing allowed MIME types.
- Accept wildcard upload types and compare MIME types case-insensitively.

## 2025-12-28 21:00:11
- Added application/octet-stream to UPLOAD_ALLOWED_TYPES to allow snapshot uploads.

## 2025-12-28 21:25:34
- Wired sidebar Import/Export actions to open KeePass dialog.
- Allow opening KeePass dialog directly to Import or Export tab.

## 2025-12-28 21:33:48
- Fix KDBX import to preserve folder hierarchy and entry-to-folder mapping.

## 2025-12-28 21:47:24
- Fix TS2448 by reordering hook helpers so dependencies are declared first.

## 2025-12-28 21:57:03
- Add nested personal folders tree with expand/collapse and hover delete.
- Add personal folder create dialog with optional parent folder.
- Add folder picker to entry add/edit dialog.

## 2025-12-28 21:59:43
- Fix CSS order so @import precedes Tailwind directives.

## 2025-12-28 22:19:22
- Added always-visible entry checkboxes for bulk selection.
- Added bulk actions toolbar (delete, move, toggle favorite, export CSV/JSON).
- Cleared selection after bulk actions and when switching vault context.

## 2025-12-28 22:21:26
- Fix CSV export regex to avoid invalid Unicode escape.

## 2025-12-28 22:24:40
- Add Select all / Deselect all button for current filtered list.

## 2025-12-28 22:46:53 +08:00
- Added DB-backed storage option for vault blobs.
- Added migration to store blob binary data in the database.
- Added and ran a script to migrate existing filesystem blobs into the database.
- Fixed SQL migration execution by avoiding compile-time column references.
- Fixed lint error in the blob migration script.

## 2025-12-28 22:53:09 +08:00
- Added a report mode to verify all blobs are DB-backed before cleanup.

## 2025-12-28 23:01:31 +08:00
- Added Dockerfiles for backend and frontend.
- Added docker-compose.yml to run both services with DB upload storage.
- Added nginx reverse proxy to route /api to backend and serve SPA.

## 2025-12-28 23:08:11 +08:00
- Ignored .env files and removed tracked .env from git index.

## 2025-12-28 23:34:04 +08:00
- Made backend container startup resilient by making migrations optional via RUN_MIGRATIONS.

## 2025-12-28 23:48:11 +08:00
- Fixed nginx /api upstream port to match backend container port 8084.

## 2025-12-28 23:53:53 +08:00
- Fixed production CORS mismatch by allowing hostname-based origins and avoiding 500 on deny.

## 2025-12-29 00:15:32
- Removed previous generator branding and tagger integration.
- Updated app title and social metadata to SecureVault.
- Added light/dark green favicon SVGs and wired them in index.html.
- Adjusted primary green tokens for light and dark themes.

## 2025-12-29 10:45:24
- Generated SecureVault favicon.ico, apple-touch-icon.png, and og.png.
- Added OG image tags to improve WhatsApp link previews.

## 2025-12-29 13:33:48
- Updated Favorites view to include both personal and team entries.

## 2025-12-29 13:50:29+08:00
- Fixed vault snapshot persistence so entry updates save to the correct personal/team vault.
- Deduplicated vault snapshot load to prefer team vault data over personal fallback.
- Ensured imported entries set undo metadata and snapshots save across all vaults.

## 2026-01-15 08:57:38 +0700
- Created docs/offline_implementation.md outlining offline mode plan.
- Scope: personal editable offline; team view-only; blocked team actions.
- Added UX flow, components, storage model, endpoints, accessibility, compliance.

## 2026-01-15 08:59:22 +0700
- Added phase-by-phase checkpoints to offline implementation plan.
- Defined deliverables and acceptance checks per phase (1–6).
- Implemented SSE live updates: fixed client event types to match backend.
- Exposed refreshTeams from useTeams; wired SSE in Index to refresh vaults/teams.
- Validated with npm run lint and npx tsc --noEmit.
- Implemented Share Vault flow in UI.
- Updated ShareVaultDialog to use email lookup (/users/lookup) and fetch recipient public keys (/users/:id/public-keys).
- Implemented team sharing by wrapping vault key to joined team members individually for compatibility with current vault listing logic.
- Added Share button to VaultDashboard header and wired dialog with current vault id/key.
- Passed vault key helpers from Index to VaultDashboard.
- Ran npm run lint and npx tsc --noEmit; both succeeded.

## 2025-12-29 13:57:56+08:00
- Fixed snapshot save race caused by relying on side effects from React state updaters.
- Show toast error when snapshot save fails (helps diagnose permissions/API issues).

## 2025-12-29 14:10:23+08:00
## 2025-12-29 20:49:27 +08:00
- Removed forced dark mode class from Index to respect next-themes.
- Added bulk "Copy to Team" action with dialog and permission check.
- Ran TypeScript no-emit and ESLint; no errors introduced.
- Fixed 415 unsupported_type for snapshot uploads by relaxing MIME checks for encrypted blob types.

## 2025-12-29 14:26:47 +08:00
- Fixed blob upload 404 by correcting the POST /vaults/:id/blobs route path.
## Thu Jan 15 08:05:37 WIB 2026
- Scanned repository structure and mapped frontend/backend directories.
- Identified stack: Vite+React (Shadcn UI, Tailwind) and Fastify backend.
- Cataloged config: JWT guard, CORS, rate limit, MSSQL, LDAP, uploads.
- Reviewed Docker/Nginx routing (/api → backend:8084) and compose setup.
- Installed dependencies; ran ESLint and TypeScript no-emit successfully.
- Documented env categories (DB, LDAP, API base, uploads) without secrets.
## Thu Jan 15 08:14:13 WIB 2026
- Suppress external favicon fetch for internal/private hosts to avoid 404 noise.
- Added image onError fallback to show initial avatar when favicon missing.
- Ran ESLint and TypeScript no-emit; no errors introduced.
## Thu Jan 15 08:16:48 WIB 2026
255→- Added global setting VITE_DISABLE_EXTERNAL_FAVICONS to disable external favicon requests.
256→- Implemented per-domain favicon failure caching to prevent repeated fetches.
257→- Ran ESLint and TypeScript no-emit; both succeeded.
## 2026-01-15 09:08:30 +0700
- Verified server-side audit logging, including keys registration events.
- Confirmed Activity filters (since, until, action) and Admin filters (actor, date).
- Ensured action normalization (underscore to dot) and actor display enrichment.
- Ran npm run lint and npx tsc --noEmit; both passed.
## 2026-01-15 09:12:39 +0700
- Improved LDAP login error handling to distinguish invalid credentials vs unavailability.
- After admin bind failure, attempt candidate user binds and map errors:
  - Invalid credentials → 401
  - Unavailable/connection errors → 503
- Validated with npm run lint and npx tsc --noEmit.
## 2026-01-15 13:30:37 +0700
- Added /health/ldap endpoint to diagnose LDAP connectivity and admin bind status.
- Registered health routes and whitelisted /health/ldap in JWT guard.
- Ran npm run lint and npx tsc --noEmit; both succeeded.
## 2026-01-15 21:14:46 +0700
- Fixed Fastify duplicate route error by consolidating health endpoints.
- Kept existing /health and /health/db in server; added only /health/ldap in plugin.
- Ran npm run lint and npx tsc --noEmit; both successful.
## 2026-01-15 21:23:29 +0700
- Started backend dev server on port 8084 for local testing.
- Ran backend API test with username widji.santoso and password Orangef0x.
- Health endpoints OK; LDAP bind OK; login returned 401 invalid_credentials as expected.
- Executed npm run lint at project root; only warnings, no errors.
- Executed npx tsc --noEmit for frontend and backend; both succeeded.
## 2026-01-15 21:28:21 +0700
- Adjusted LDAP login to prefer sAMAccountName binds before admin search.
- Added domain-derived DOMAIN\\username candidate and plain username candidate.
- Verified type-checks and lint; both passed (warnings only).
- Retested API: health OK, LDAP OK, login returns 401 with provided credentials.
## 2026-01-15 21:34:24 +0700
- Enhanced /auth/ldap/login error responses to include LDAP error detail.
- Frontend now receives { error, detail: { name, message } } for debugging.
- Ran lint and type-check; both successful.
## 2026-01-15 21:38:24 +0700
- Added pre-search direct bind candidates: DOMAIN\\username and username.
- Kept DN bind after sAMAccountName search; avoided UPN/mail binds.
- Type-check passed; retested API, still 401 for given credentials.
## 2026-01-15 21:43:09 +0700
- Created LDAP bind test script and validated identifiers:
- DN: OK, UPN: OK, MBMA\\username: OK, sAMAccountName: 52e invalid credentials.
- Updated backend to try typed DOMAIN\\username first when provided.
## 2026-01-15 22:15:47 +0700
## 2026-01-15 22:52:05 +0700
- Adjusted backend CORS allowlist to always include localhost dev origins.
- Ensured SSE from http://localhost:8080 to http://localhost:8084 is allowed.
- Ran npm run lint and npx tsc --noEmit; both completed successfully.
## 2026-01-15 23:06:44 +0700
- Fixed Audit & Compliance panel sticking by closing it on navigation.
- Updated sidebar handlers to close audit view when selecting other menus.
- Validated with npm run lint and npx tsc --noEmit.
- Added admin role setup script and granted admin to provided DN.
- Verified login via UPN and /me shows role: admin.
- Admin link visible in sidebar; /admin route protected by server.
## Thu Jan 15 21:48:52 WIB 2026
- Reviewed backend AD login flow: pre-candidate binds, admin bind+search, DN bind.
- Added backend npm script `test:ldap` to run LDAP bind test quickly.
- Ran TypeScript no-emit in backend; completed successfully.
## Thu Jan 15 21:54:23 WIB 2026
- Executed LDAP bind test with provided identifiers:
- DN: OK, UPN: OK, MBMA\\widji.santoso: OK, plain sam: 52e invalid credentials.
- Ran migrations to add users.role column; resolved RequestError on login.
- Verified API login succeeds with SAM; issued JWT and fetched /me.
- Ran npm run lint and npx tsc --noEmit; both completed successfully.
## Thu Jan 15 22:02:07 WIB 2026
- Added print-users script to inspect dbo.users for AD login records.
- Verified new row for widji.santoso: email NULL, ldap_dn MBMA\\widji.santoso, role user.
## Thu Jan 15 22:07:15 WIB 2026
- Normalized LDAP login to resolve canonical DN and mail even for DOMAIN\\sam binds.
- Matched users by email or ldap_dn to reuse existing records and update last_login.
- Verified login now maps to existing widji.santoso row and keeps canonical DN.
## 2026-01-15 15:27:19 UTC
- Implemented hold-to-reveal password behavior on eye icons (UnlockScreen, AddEntryDialog, PasswordEntry).
- Verified clipboard auto-clear for copied passwords (30s) via copyToClipboard.
 - Logged copy events to audit and added user feedback toasts; ran npm run lint and npx tsc --noEmit.

## 2026-01-15 15:30:23 UTC
- Verified audit logging coverage for entry/folder CRUD, export (CSV/JSON), and KeePass import.
- Confirmed ActivityView icon/label mappings for new actions and API action normalization.
- Ran npm run lint (warnings only, no errors) and npx tsc --noEmit (passed).

## 2026-01-15 15:41:19 UTC
- Integrated Audit & Compliance into the main dashboard with sidebar toggle.
- Replaced /admin navigation with in-page panel for admins.
- Added reporting metrics: total events, shares, copies, top copied credentials.
- Enriched export/import audit details with filename and scope; added export.kdbx logging.
- Updated ActivityView labels/icons to include export.kdbx.
- Executed npm run lint and npx tsc --noEmit; both succeeded (warnings only).
