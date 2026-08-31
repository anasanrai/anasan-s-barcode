export interface AuthSession {
  role: "owner" | "manager";
  token: string;
  storeId?: string;
  storeName?: string;
  storeBranch?: string;
}

const AUTH_KEY = "hs_auth";

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed.role !== "owner" && parsed.role !== "manager") return null;
    if (!parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}
