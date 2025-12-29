const BASE = import.meta.env.VITE_API_BASE_URL || "";

export type ApiResponse<T = unknown> = { ok: boolean; status: number; body: T };

export type ApiBinaryResponse = { ok: boolean; status: number; data: Uint8Array };

const parse = async (res: Response): Promise<ApiResponse> => {
  const text = await res.text();
  let body: unknown = undefined;
  try {
    body = JSON.parse(text);
  } catch {
    body = { text };
  }
  return { ok: res.ok, status: res.status, body };
};

type UnauthorizedEventDetail = {
  path: string;
  status: 401;
  error?: string;
};

const notifyUnauthorized = (path: string, error?: string) => {
  localStorage.removeItem("sv.jwt");
  const detail: UnauthorizedEventDetail = { path, status: 401, error };
  window.dispatchEvent(new CustomEvent<UnauthorizedEventDetail>("sv:unauthorized", { detail }));
};

const getErrorString = (body: unknown): string | undefined => {
  if (typeof body !== "object" || body === null) return undefined;
  const r = body as Record<string, unknown>;
  const e = r.error;
  return typeof e === "string" ? e : undefined;
};

export const request = async <T = unknown>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> => {
  const token = localStorage.getItem("sv.jwt");
  const body = init.body;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  const hasBody = body !== undefined && body !== null;
  const initHeaders: Record<string, string> = (() => {
    const h = init.headers;
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(Array.from(h.entries()));
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h as Record<string, string>;
  })();
  const baseHeaders: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const contentTypeHeaders = hasBody && !(isForm || isBlob) ? { "Content-Type": "application/json" } : {};
  const headers = {
    ...contentTypeHeaders,
    ...baseHeaders,
    ...initHeaders,
  } as Record<string, string>;
  const fetchHeaders = new Headers();
  for (const [k, v] of Object.entries(headers)) {
    fetchHeaders.set(k, v);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers: fetchHeaders });
  const parsed = (await parse(res)) as ApiResponse<T>;
  if (res.status === 401) {
    notifyUnauthorized(path, getErrorString(parsed.body));
  }
  return parsed;
};

export const get = <T = unknown>(path: string) => request<T>(path);
export const post = <T = unknown>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const postForm = async <T = unknown>(path: string, form: FormData): Promise<ApiResponse<T>> =>
  request<T>(path, { method: "POST", body: form });

export const getBinary = async (path: string, init: RequestInit = {}): Promise<ApiBinaryResponse> => {
  const token = localStorage.getItem("sv.jwt");
  const initHeaders: Record<string, string> = (() => {
    const h = init.headers;
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(Array.from(h.entries()));
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h as Record<string, string>;
  })();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...initHeaders,
  } as Record<string, string>;
  const fetchHeaders = new Headers();
  for (const [k, v] of Object.entries(headers)) {
    fetchHeaders.set(k, v);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers: fetchHeaders });
  if (res.status === 401) {
    notifyUnauthorized(path);
  }
  const buf = await res.arrayBuffer();
  return { ok: res.ok, status: res.status, data: new Uint8Array(buf) };
};
