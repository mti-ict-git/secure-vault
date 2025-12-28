# Secure Vault – UX Guide

## Goal
Help end users understand how to use Secure Vault to store and share encrypted secrets and files. This guide is written from a user experience perspective and maps each screen and action to what the system does behind the scenes.

## Audience
- Employees with an LDAP/Active Directory account
- People who need to create personal or team vaults, upload encrypted blobs, and share access securely

## Key Concepts
- Vault: A container of encrypted content (entries, attachments, KDBX files). Each vault has an encrypted vault key that is wrapped for authorized users/teams.
- Blobs: Opaque encrypted files stored in the vault (attachments, snapshots).
- Keys: Client-generated public keys and an encrypted private key registered to your account.
- Teams: Groups of users with roles. Each team has a team key wrapped per member.
- Shares: Adds permissions to a vault for a user or a team by wrapping the vault key to them.
- Audit: A chronological list of actions performed (create vault, invite, upload).

## Prerequisites
1. Your account exists in LDAP/AD.
2. Frontend is running on `http://localhost:8080`.
3. Backend is running on `http://localhost:8082`.

## Screens and Flows

### 1. Sign In
- Action: Enter your LDAP username and password and press Sign In.
- Behavior: The app calls `POST /auth/ldap/login`, receives a JWT, and stores it in memory/local storage for subsequent API calls.
- Outcome: You see the dashboard with your vaults and teams.

### 2. First-Time Key Setup
- Action: If prompted, generate keys (sign/enc) client-side and protect your private key with a passphrase; then press Register Keys.
- Behavior: The app calls `POST /keys/register` with:
  - `public_sign_key`, `public_enc_key`, `encrypted_private_key` (your private key encrypted client-side).
- Outcome: Keys are linked to your account for shares and team membership.

### 3. Dashboard
- Panels:
  - My Vaults: Lists vaults you own or have access to.
  - My Teams: Lists teams you are part of.
  - Recent Activity: Shows audit events.
- Behavior:
  - `GET /vaults` returns your accessible vaults.
  - `GET /audit` returns your recent activity.

### 4. Create Vault
- Action: Click Create Vault, select Personal or Team, choose version, and provide the wrapped vault key (client-side encrypted for owner/team).
- Behavior: Calls `POST /vaults` with:
  - `kind`, optional `team_id`, `version`, `vault_key_wrapped`.
- Outcome: New vault appears in the list. An audit entry is recorded.

### 5. Upload Content (Blobs)
- Action: Open a vault, click Upload, select a file (attachment or encrypted KDBX) and provide metadata (blob type, content hash).
- Behavior: Calls `POST /vaults/:id/blobs` multipart:
  - Field `meta` with JSON describing `blob_type`, `content_sha256`, `size_bytes`.
  - Field `file` with your encrypted file.
- Outcome: The encrypted file is stored and listed under the vault’s Blobs. An audit entry is recorded.
- Related views:
  - `GET /vaults/:id/blobs` lists blobs with their metadata.
  - `GET /vaults/:id/blobs/:blobId` streams the file for client-side decryption.

### 6. Create Team and Invite Members
- Action: Open Teams, click Create Team, enter a team name. Then Invite Member, select user, role, and include the member’s wrapped team key.
- Behavior:
  - `POST /teams` creates the team.
  - `POST /teams/:id/invite` invites a user with a role and wrapped team key.
- Outcome: The user appears as a member with the selected role. Audit entries record team creation and invitation.
- Update role or remove member:
  - `POST /teams/:id/members/:memberId/role` updates the role.
  - `DELETE /teams/:id/members/:memberId` removes the member.

### 7. Share a Vault
- Action: Open the vault, click Share, choose user or team, permissions (read/write), and provide wrapped key for the target.
- Behavior: Calls `POST /shares` with:
  - `source_vault_id`, `target_user_id` or `target_team_id`, `wrapped_key`, `permissions`.
- Outcome: Target gains access. Audit entry records the share action.

### 8. Live Updates
- Action: Keep the app open; the vault list and activity panel update in near real time.
- Behavior: The app connects to `GET /sync/events` via Server-Sent Events (SSE) and updates UI when it receives events.
- Outcome: You see changes shortly after actions happen.

### 9. Activity and Compliance
- Action: Open Activity or Audit and filter by time or actor.
- Behavior: Calls `GET /audit` (optionally filtered client-side).
- Outcome: See a list of all important actions you performed or have access to view.

## Security Model
- All vault content is encrypted client-side. The server never sees plaintext.
- Server stores ciphertext and metadata, manages membership, and distributes wrapped keys.
- Keys and membership changes are audited for traceability.

## Error Handling and Tips
- Unauthorized: If you see authorization errors, ensure your JWT is present; sign in again.
- CORS: If the browser blocks requests, confirm `.env` includes `http://localhost:8080` in `CORS_ORIGIN`.
- Uploads: Make sure uploads conform to allowed MIME types; the app will show a hint if unsupported.
- LDAP: In development, login is mocked. In production, bind/search will require correct LDAP settings.

## Developer Shortcuts for UX Testing
- Sign In: Use username `demo` and password `demo` in development.
- Keys: If your client doesn’t generate keys yet, you can register placeholder test keys for flow testing.
- Migrations: `npm run migrate` to initialize DB for testing flows.

## Navigation Summary
- Sign In → Dashboard
- Dashboard → Create Vault → Vault Details → Upload
- Dashboard → Create Team → Invite → Share Vault to Team
- Dashboard → Activity/Audit → Review actions

