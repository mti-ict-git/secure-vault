const BASE = import.meta.env.VITE_API_BASE_URL || "";

export type ApiResponse<T = unknown> = { ok: boolean; status: number; body: T };

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
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  } as Record<string, string>;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem("sv.jwt");
  }
  return parse(res) as Promise<ApiResponse<T>>;
};

export const get = <T = unknown>(path: string) => request<T>(path);
export const post = <T = unknown>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
