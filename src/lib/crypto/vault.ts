import { aeadDecrypt, aeadEncrypt, type AeadPayloadV1 } from "@/lib/crypto/aead";
import { bytesToUtf8, utf8ToBytes } from "@/lib/crypto/encoding";

export type VaultEntryRecordV1 = {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  folderId?: string;
  teamId?: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  createdBy?: string;
};

export type VaultFolderRecordV1 = {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
  teamId?: string;
};

export type VaultSnapshotV1 = {
  v: 1;
  entries: VaultEntryRecordV1[];
  folders: VaultFolderRecordV1[];
};

export type EncryptedVaultSnapshotV1 = {
  v: 1;
  kind: "vault_snapshot";
  enc: AeadPayloadV1;
};

export const encryptVaultSnapshot = async (vaultKey: Uint8Array, snapshot: VaultSnapshotV1, aad?: Uint8Array): Promise<EncryptedVaultSnapshotV1> => {
  const enc = await aeadEncrypt(vaultKey, utf8ToBytes(JSON.stringify(snapshot)), aad);
  return { v: 1, kind: "vault_snapshot", enc };
};

export const decryptVaultSnapshot = async (vaultKey: Uint8Array, encrypted: EncryptedVaultSnapshotV1): Promise<VaultSnapshotV1> => {
  const plainBytes = await aeadDecrypt(vaultKey, encrypted.enc);
  const json = bytesToUtf8(plainBytes);
  return JSON.parse(json) as VaultSnapshotV1;
};

export const serializeEncryptedSnapshot = (enc: EncryptedVaultSnapshotV1): Uint8Array => {
  const json = JSON.stringify(enc);
  return utf8ToBytes(json);
};

export const deserializeEncryptedSnapshot = (bytes: Uint8Array): EncryptedVaultSnapshotV1 => {
  const json = bytesToUtf8(bytes);
  return JSON.parse(json) as EncryptedVaultSnapshotV1;
};
