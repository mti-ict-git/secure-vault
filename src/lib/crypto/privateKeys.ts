import { DEFAULT_ARGON2ID_PARAMS, deriveMasterKey, deserializeKdfRecord, randomSalt, serializeKdfRecord, type Argon2idKdfRecord } from "@/lib/crypto/argon2";
import { aeadDecrypt, aeadEncrypt, type AeadPayloadV1 } from "@/lib/crypto/aead";
import { bytesToUtf8, utf8ToBytes } from "@/lib/crypto/encoding";

export type EncryptedPrivateKeysV1 = {
  v: 1;
  kdf: Argon2idKdfRecord;
  enc: AeadPayloadV1;
};

export type PrivateKeysPlain = {
  sign_sk_b64: string;
  enc_sk_b64: string;
  sign_pk_b64: string;
  enc_pk_b64: string;
};

export const encryptPrivateKeys = async (password: string, plain: PrivateKeysPlain): Promise<EncryptedPrivateKeysV1> => {
  const salt = randomSalt();
  const kdf = serializeKdfRecord(salt, DEFAULT_ARGON2ID_PARAMS);
  const masterKey = await deriveMasterKey(password, salt, DEFAULT_ARGON2ID_PARAMS);
  const enc = await aeadEncrypt(masterKey, utf8ToBytes(JSON.stringify(plain)));
  return { v: 1, kdf, enc };
};

export const decryptPrivateKeys = async (password: string, encrypted: EncryptedPrivateKeysV1): Promise<PrivateKeysPlain> => {
  const { salt, params } = deserializeKdfRecord(encrypted.kdf);
  const masterKey = await deriveMasterKey(password, salt, params);
  const plainBytes = await aeadDecrypt(masterKey, encrypted.enc);
  const json = bytesToUtf8(plainBytes);
  const parsed = JSON.parse(json) as PrivateKeysPlain;
  return parsed;
};

