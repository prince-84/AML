export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const TOKEN_KEY = "cs_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, params?: Params): string {
  const url = new URL(
    path.startsWith("http") ? path : `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`
  );
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Core request helper. Returns the envelope's `data`. Throws ApiError on failure. */
export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; params?: Params } = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(buildUrl(path, opts.params), {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  let json: Envelope<T> | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !json || json.success === false) {
    throw new ApiError(
      json?.message || `Request failed (${res.status}). Please try again.`,
      res.status
    );
  }
  return json.data;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  lastPage: number;
  perPage: number;
}

/** Fetch a Laravel-paginated list endpoint and normalise the shape. */
export async function apiPage<T>(path: string, params?: Params): Promise<Page<T>> {
  const data = await api<unknown>(path, { params });
  if (Array.isArray(data)) {
    return { items: data as T[], total: data.length, page: 1, lastPage: 1, perPage: data.length };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  const items = (d.data as T[]) || (d.items as T[]) || [];
  return {
    items,
    total: Number(d.total ?? items.length),
    page: Number(d.current_page ?? d.page ?? 1),
    lastPage: Number(d.last_page ?? d.lastPage ?? 1),
    perPage: Number(d.per_page ?? d.perPage ?? (items.length || 15)),
  };
}

/** Fetch endpoints that may return either a plain array or a wrapped list. */
export async function apiList<T>(path: string, params?: Params): Promise<T[]> {
  const data = await api<unknown>(path, { params });
  if (Array.isArray(data)) return data as T[];
  const d = (data ?? {}) as Record<string, unknown>;
  if (Array.isArray(d.data)) return d.data as T[];
  if (Array.isArray(d.items)) return d.items as T[];
  if (Array.isArray(d.rows)) return d.rows as T[];
  for (const key of ["providers", "users", "rules", "fields", "form_fields", "assessments", "entries", "logs", "records", "results"]) {
    if (Array.isArray(d[key])) return d[key] as T[];
  }
  const firstArray = Object.values(d).find((v) => Array.isArray(v));
  if (Array.isArray(firstArray)) return firstArray as T[];
  return [];
}

/** Download a file (e.g. goAML XML) with the auth header attached. */
export async function apiDownload(path: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(buildUrl(path), {
    headers: {
      Accept: "application/xml, text/xml, */*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    setToken(null);
    if (typeof window !== "undefined") window.location.assign("/login");
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  if (!res.ok) throw new ApiError(`Download failed (${res.status}).`, res.status);
  return res.blob();
}
