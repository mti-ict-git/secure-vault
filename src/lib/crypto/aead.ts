import { bytesToBase64, base64ToBytes } from "@/lib/crypto/encoding";
import { getSodium } from "@/lib/crypto/sodium";

export type AeadPayloadV1 = {
  v: 1;
  alg: "xchacha20poly1305_ietf";
  nonce_b64: string;
  cipher_b64: string;
  ad_b64?: string;
};

export const aeadEncrypt = async (key: Uint8Array, plaintext: Uint8Array, aad?: Uint8Array): Promise<AeadPayloadV1> => {
  const s = await getSodium();
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const cipher = s.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad ?? null, null, nonce, key);
  return {
    v: 1,
    alg: "xchacha20poly1305_ietf",
    nonce_b64: bytesToBase64(nonce),
    cipher_b64: bytesToBase64(cipher),
    ad_b64: aad ? bytesToBase64(aad) : undefined,
  };
};

export const aeadDecrypt = async (key: Uint8Array, payload: AeadPayloadV1): Promise<Uint8Array> => {
  const s = await getSodium();
  const nonce = base64ToBytes(payload.nonce_b64);
  const cipher = base64ToBytes(payload.cipher_b64);
  const aad = payload.ad_b64 ? base64ToBytes(payload.ad_b64) : null;
  const plain = s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, cipher, aad, nonce, key);
  return plain;
};

