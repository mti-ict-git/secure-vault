# Zero‑Knowledge Backend Design

## Goals & Trust Model
- Zero‑knowledge: server never sees plaintext secrets or master password; only ciphertext and metadata.
- Client performs encryption/decryption and key management; server persists blobs, access control, audit, sync.
- Support personal vaults and team sharing with end‑to‑end encryption.
- KDBX import/export handled client‑side; server stores encrypted files as opaque blobs.

## Architecture Overview
- Runtime: Node.js (TypeScript) with Fastify (or NestJS) for structured modules.
- Database: MSSQL per `.env` (DB_*); use `kysely` + `tedious` or `typeorm`.
- Cache/rate limit: in‑memory for dev; Redis optional in prod.
- Storage: DB tables for metadata; encrypted blob storage in DB or filesystem (configurable). Optional Supabase storage if service key provided.
- Auth: JWT (`JWT_SECRET`, `JWT_EXPIRES_IN`) with LDAP login; optional local accounts.
- Sync: WebSocket or SSE for real‑time events (vault updates, team changes).
- Observability: file logging (`LOG_FILE`), structured JSON logs, audit trail.

## Security Model
- Master key: derived client‑side with Argon2id (parameters set in client; server does not derive).
- User keypair: Ed25519 (signing) and X25519 (encryption) generated client‑side.
- Private keys encrypted with a Key‑Encryption‑Key (KEK) from master password; stored server‑side as `encrypted_private_key` (ciphertext only).
- Per‑vault key: random AES‑GCM key encrypting vault data; wrapped by user key; stored server‑side as `vault_key_wrapped`.
- Team keys: each team has a symmetric key; wrapped to each member’s public key; server stores the wrapped keys and ACLs.
- Integrity: all payloads include version, nonce, and authenticated tags; clients verify signatures for shared updates.

## Data Model (MSSQL)
- `users`: id (uuid), email, display_name, ldap_dn (nullable), public_sign_key, public_enc_key, encrypted_private_key, created_at, last_login_at.
- `sessions`: id, user_id, user_agent, ip, created_at, revoked_at.
- `vaults`: id, owner_user_id (nullable for team), team_id (nullable), kind (personal|team), version, vault_key_wrapped, created_at, updated_at.
- `vault_blobs`: id, vault_id, blob_type (snapshot|delta|attachment|kdbx), content_sha256, storage_ref (path/url), size_bytes, created_by, created_at.
- `teams`: id, name, created_by, team_key_wrapped_for_creator, created_at.
- `team_members`: id, team_id, user_id, role (owner|admin|editor|viewer), invited_by, invited_at, joined_at, revoked_at.
- `shares`: id, source_vault_id, target_user_id or target_team_id, wrapped_key, permissions (read|write), created_at.
- `audit_logs`: id, actor_user_id, action, resource_type, resource_id, details_json, created_at.
- `rate_limits`: key, window_start, count (optional if using Redis).
- `uploads`: id, user_id, original_filename, mime_type, size_bytes, storage_ref, created_at.

## API Surface
- Auth
  - `POST /auth/ldap/login`: { username, password } → JWT, user bootstrap if first login.
  - `POST /auth/logout`: revoke session.
  - `POST /auth/refresh`: rotate JWT.
- Keys & Bootstrap
  - `POST /keys/register`: store `public_sign_key`, `public_enc_key`, `encrypted_private_key`.
  - `GET /keys/me`: fetch user public keys and encrypted private key.
- Vaults
  - `POST /vaults`: create personal or team vault; returns `vault_id`.
  - `GET /vaults`: list vaults for user.
  - `GET /vaults/:id`: metadata only.
- Blobs (opaque ciphertext)
  - `POST /vaults/:id/blobs`: upload encrypted blob (JSON or binary). Body: { blob_type, content_sha256, size_bytes } + binary; server verifies `UPLOAD_MAX_SIZE` and allowed types.
  - `GET /vaults/:id/blobs`: list blobs with pagination.
  - `GET /vaults/:id/blobs/:blobId`: stream/download blob.
- Teams & Sharing
  - `POST /teams`: create team; store `team_key_wrapped_for_creator`.
  - `POST /teams/:id/invite`: invite user; store per‑member `team_key_wrapped`.
  - `POST /teams/:id/members/:memberId/role`: update role.
  - `DELETE /teams/:id/members/:memberId`: remove member.
  - `POST /shares`: share vault or entry set to user/team; upload `wrapped_key`.
- Sync & Events
  - `GET /sync/events` (SSE) or `WS /sync`: subscribe to vault/team updates; server emits metadata only.
- Utilities
  - `GET /me`: current user profile.
  - `GET /audit`: list recent actions.

## KDBX Import/Export
- Client imports `.kdbx` using `kdbxweb`, maps to internal model, encrypts with per‑vault key, then uploads blobs.
- Export: client reconstructs `.kdbx` from local decrypted state, no server involvement beyond optional blob retrieval.
- Server may store raw `.kdbx` files as opaque blobs with `blob_type=kdbx`; content remains encrypted by KDBX format itself.

## Integration Points
- LDAP: use `.env` `LDAP_URL`, `LDAP_*` for bind/search; map LDAP user → `users` row; do not store LDAP password.
- CORS: from `.env` `CORS_ORIGIN`.
- Rate limiting: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` per IP/user.
- Logging: `LOG_LEVEL`, `LOG_FILE`; avoid logging secrets.
- OpenProject: optional webhook or scheduled sync to create tasks from audit events (e.g., “rotation required”); use `OPENPROJECT_*`. Disabled by default via `OPENPROJECT_SYNC_ENABLED`.
- Supabase: optional object storage; requires service key (not provided). With current anon key, only client uploads are safe; default to local storage.

## Request/Response Examples
- `POST /auth/ldap/login`
  - Req: { "username": "jdoe", "password": "..." }
  - Res: { "token": "JWT", "user": { id, email, public_keys_set: true } }
- `POST /vaults/:id/blobs`
  - Headers: `Content-Type: application/octet-stream`, `X-Blob-Meta: {"blob_type":"snapshot","content_sha256":"...","size_bytes":12345}`
  - Res: { id, vault_id, created_at }

## Security Hardening
- Strict input validation (zod) and MIME/type checks (`UPLOAD_ALLOWED_TYPES`).
- AES‑GCM/ChaCha20‑Poly1305 for payload encryption client‑side; X25519 for wrapping keys; Ed25519 signatures for shared updates.
- JWT with short expiry (`JWT_EXPIRES_IN`), refresh flow, device‑bound sessions.
- Rate‑limit sensitive endpoints; IP + user‑key.
- Audit all access and mutations; store minimal metadata.
- Secrets hygiene: rotate LDAP/OpenProject keys; never log PII or secrets.

## Configuration Mapping
- Ports: `PORT` (public API), `BACKEND_PORT` if splitting admin/internal.
- DB: `DB_*` settings for MSSQL connector; `DB_ENCRYPT`/`DB_TRUST_SERVER_CERTIFICATE` respected.
- CORS: `CORS_ORIGIN` exact allowlist.
- JWT: `JWT_SECRET`, `JWT_EXPIRES_IN`.
- Upload limits: `UPLOAD_MAX_SIZE`, `UPLOAD_ALLOWED_TYPES`.
- Logging: `LOG_LEVEL`, `LOG_FILE`.

## Implementation Phases
1. Scaffolding: Fastify/Nest, config loader, health, logging, CORS, rate‑limit, error handler.
2. Auth: LDAP login, JWT, sessions, `users` bootstrap.
3. Keys: register/fetch endpoints, data model.
4. Vaults: create/list/get; permissions.
5. Blobs: upload/download/list with storage adapters (DB/file system).
6. Teams/sharing: invites, roles, wrapped keys.
7. Sync: SSE/WS event bus.
8. Audit/logging: hooks on all mutations.
9. Optional integrations: OpenProject tasks from audits; Supabase storage.
10. E2E tests for API contracts; load tests for blob paths.

## Deliverables
- Backend repo skeleton, DB migrations, env example, API docs (OpenAPI), and test suite.
- Deployment notes (Windows/IIS node service or Docker).