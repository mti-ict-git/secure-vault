# Journal

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

