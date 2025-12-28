import { bytesToBase64, base64ToBytes } from "@/lib/crypto/encoding";
import { getSodium } from "@/lib/crypto/sodium";

export type SigningKeyPair = { publicKey_b64: string; secretKey_b64: string };
export type EncryptionKeyPair = { publicKey_b64: string; secretKey_b64: string };

export const generateSigningKeyPair = async (): Promise<SigningKeyPair> => {
  const s = await getSodium();
  const kp = s.crypto_sign_keypair();
  return { publicKey_b64: bytesToBase64(kp.publicKey), secretKey_b64: bytesToBase64(kp.privateKey) };
};

export const generateEncryptionKeyPair = async (): Promise<EncryptionKeyPair> => {
  const s = await getSodium();
  const kp = s.crypto_box_keypair();
  return { publicKey_b64: bytesToBase64(kp.publicKey), secretKey_b64: bytesToBase64(kp.privateKey) };
};

export const sealToRecipient = async (recipientPublicKey_b64: string, plaintext: Uint8Array): Promise<string> => {
  const s = await getSodium();
  const pk = base64ToBytes(recipientPublicKey_b64);
  const cipher = s.crypto_box_seal(plaintext, pk);
  return bytesToBase64(cipher);
};

export const openSealed = async (cipher_b64: string, recipientPublicKey_b64: string, recipientSecretKey_b64: string): Promise<Uint8Array> => {
  const s = await getSodium();
  const cipher = base64ToBytes(cipher_b64);
  const pk = base64ToBytes(recipientPublicKey_b64);
  const sk = base64ToBytes(recipientSecretKey_b64);
  const plain = s.crypto_box_seal_open(cipher, pk, sk);
  return plain;
};

