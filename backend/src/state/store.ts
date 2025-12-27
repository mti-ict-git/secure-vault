type UUID = string;

type User = {
  id: UUID;
  email?: string;
  display_name?: string;
  public_sign_key?: string;
  public_enc_key?: string;
  encrypted_private_key?: string;
};

type Session = { id: UUID; user_id: UUID; created_at: number; revoked_at?: number };

type Vault = {
  id: UUID;
  owner_user_id?: UUID;
  team_id?: UUID;
  kind: "personal" | "team";
  version: number;
  vault_key_wrapped: string;
  created_at: number;
  updated_at: number;
};

type Blob = {
  id: UUID;
  vault_id: UUID;
  blob_type: "snapshot" | "delta" | "attachment" | "kdbx";
  content_sha256: string;
  storage_ref: string;
  size_bytes: number;
  created_by: UUID;
  created_at: number;
};

type Team = { id: UUID; name: string; created_by: UUID; created_at: number };

type TeamMember = {
  id: UUID;
  team_id: UUID;
  user_id: UUID;
  role: "owner" | "admin" | "editor" | "viewer";
  invited_by: UUID;
  invited_at: number;
  joined_at?: number;
  revoked_at?: number;
  team_key_wrapped: string;
};

type Share = {
  id: UUID;
  source_vault_id: UUID;
  target_user_id?: UUID;
  target_team_id?: UUID;
  wrapped_key: string;
  permissions: "read" | "write";
  created_at: number;
};

export const store = {
  users: new Map<UUID, User>(),
  sessions: new Map<UUID, Session>(),
  vaults: new Map<UUID, Vault>(),
  blobs: new Map<UUID, Blob>(),
  teams: new Map<UUID, Team>(),
  team_members: new Map<UUID, TeamMember>(),
  shares: new Map<UUID, Share>(),
};

export const uid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
