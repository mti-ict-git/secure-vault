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

