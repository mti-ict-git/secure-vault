import sodium from "libsodium-wrappers-sumo";

export type Sodium = typeof sodium;

let ready: Promise<Sodium> | null = null;

export const getSodium = async (): Promise<Sodium> => {
  if (!ready) {
    ready = sodium.ready.then(() => sodium);
  }
  return ready;
};

