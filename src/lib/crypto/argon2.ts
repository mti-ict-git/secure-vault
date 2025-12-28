import { argon2id } from "hash-wasm";
import { bytesToBase64, base64ToBytes, utf8ToBytes } from "@/lib/crypto/encoding";

export type Argon2idParams = {
  iterations: number;
  memorySize: number;
  parallelism: number;
  hashLength: number;
};

export const DEFAULT_ARGON2ID_PARAMS: Argon2idParams = {
  iterations: 3,
  memorySize: 64 * 1024,
  parallelism: 1,
  hashLength: 32,
};

export const randomSalt = (): Uint8Array => crypto.getRandomValues(new Uint8Array(16));

export const deriveMasterKey = async (password: string, salt: Uint8Array, params: Argon2idParams): Promise<Uint8Array> => {
  const key = await argon2id({
    password: utf8ToBytes(password),
    salt,
    iterations: params.iterations,
    memorySize: params.memorySize,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    outputType: "binary",
  });
  return key;
};

export type Argon2idKdfRecord = Argon2idParams & { name: "argon2id"; salt_b64: string };

export const serializeKdfRecord = (salt: Uint8Array, params: Argon2idParams): Argon2idKdfRecord => ({
  name: "argon2id",
  salt_b64: bytesToBase64(salt),
  iterations: params.iterations,
  memorySize: params.memorySize,
  parallelism: params.parallelism,
  hashLength: params.hashLength,
});

export const deserializeKdfRecord = (kdf: Argon2idKdfRecord): { salt: Uint8Array; params: Argon2idParams } => ({
  salt: base64ToBytes(kdf.salt_b64),
  params: {
    iterations: kdf.iterations,
    memorySize: kdf.memorySize,
    parallelism: kdf.parallelism,
    hashLength: kdf.hashLength,
  },
});

