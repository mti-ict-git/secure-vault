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

export const request = async <T = unknown>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> => {
  const token = localStorage.getItem("sv.jwt");
  const body = init.body;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  const baseHeaders: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const contentTypeHeaders = isForm || isBlob ? {} : { "Content-Type": "application/json" };
  const headers = {
    ...contentTypeHeaders,
    ...baseHeaders,
    ...(init.headers || {}),
  } as Record<string, string>;
  const res = await fetch(`${BASE}${path}`, { ...init, headers: headers as HeadersInit });
  if (res.status === 401) {
    localStorage.removeItem("sv.jwt");
  }
  return parse(res) as Promise<ApiResponse<T>>;
};

export const get = <T = unknown>(path: string) => request<T>(path);
export const post = <T = unknown>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const postForm = async <T = unknown>(path: string, form: FormData): Promise<ApiResponse<T>> =>
  request<T>(path, { method: "POST", body: form });

export const getBinary = async (path: string, init: RequestInit = {}): Promise<ApiBinaryResponse> => {
  const token = localStorage.getItem("sv.jwt");
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  } as Record<string, string>;
  const res = await fetch(`${BASE}${path}`, { ...init, headers: headers as HeadersInit });
  if (res.status === 401) {
    localStorage.removeItem("sv.jwt");
  }
  const buf = await res.arrayBuffer();
  return { ok: res.ok, status: res.status, data: new Uint8Array(buf) };
};
