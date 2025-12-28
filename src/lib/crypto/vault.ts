import { aeadDecrypt, aeadEncrypt, type AeadPayloadV1 } from "@/lib/crypto/aead";
import { bytesToBase64, base64ToBytes, bytesToUtf8, utf8ToBytes } from "@/lib/crypto/encoding";

export type VaultSnapshotV1 = {
  v: 1;
  entries: unknown[];
  folders: unknown[];
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

export const serializeSealedVaultKey = (vaultKey: Uint8Array): string => bytesToBase64(vaultKey);

export const parseSealedVaultKey = (b64: string): Uint8Array => base64ToBytes(b64);

