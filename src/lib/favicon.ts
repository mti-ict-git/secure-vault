const toBool = (v: unknown): boolean => {
  if (typeof v !== "string") return false;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
};

const failed = new Set<string>();

const isPrivateIPv4 = (host: string): boolean => {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums: number[] = parts.map((p) => Number(p));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  if (nums[0] === 10) return true;
  if (nums[0] === 127) return true;
  if (nums[0] === 169 && nums[1] === 254) return true;
  if (nums[0] === 192 && nums[1] === 168) return true;
  if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;
  return false;
};

const isInternalHostname = (host: string): boolean => {
  const h = host.toLowerCase();
  if (h === "localhost") return true;
  if (isPrivateIPv4(h)) return true;
  if (h.endsWith(".local")) return true;
  if (h.endsWith(".lan")) return true;
  if (h.endsWith(".internal")) return true;
  return false;
};

export const isExternalFaviconsEnabled = (): boolean => {
  const disabled = toBool(import.meta.env.VITE_DISABLE_EXTERNAL_FAVICONS);
  return !disabled;
};

export const getFaviconUrlForDomain = (domain: string): string | null => {
  if (!isExternalFaviconsEnabled()) return null;
  if (isInternalHostname(domain)) return null;
  if (failed.has(domain)) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
};

export const registerFaviconFailure = (domain: string) => {
  if (!domain) return;
  failed.add(domain);
};

