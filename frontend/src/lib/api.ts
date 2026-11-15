import type { AuthResponse } from './types';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:7860';

const RT_KEY = 'heychat.session';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

/** Called when the session is gone for good (refresh failed). */
export function onSessionLost(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readRefresh(): string | null {
  try {
    return localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(token: string | null) {
  try {
    if (token) localStorage.setItem(RT_KEY, token);
    else localStorage.removeItem(RT_KEY);
  } catch {
    /* storage unavailable (private mode): session lives only in memory */
  }
}

export function hasStoredSession() {
  return Boolean(readRefresh());
}

export function adoptSession(res: AuthResponse) {
  accessToken = res.accessToken;
  accessExpiresAt = Date.now() + (res.accessTokenExpiresIn - 30) * 1000;
  writeRefresh(res.refreshToken);
}

export function clearSession() {
  accessToken = null;
  accessExpiresAt = 0;
  writeRefresh(null);
}

export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < accessExpiresAt) return accessToken;
  const ok = await refreshSession();
  return ok ? accessToken : null;
}

/**
 * Rotates the refresh token. Serialised across tabs with the Web Locks API so two tabs
 * never present the same refresh token (which the server treats as theft).
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const doRefresh = async (): Promise<boolean> => {
    const rt = readRefresh();
    if (!rt) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (res.status === 401) {
        // Another tab may have rotated the token while we waited; only drop it if unchanged.
        if (readRefresh() === rt) clearSession();
        return false;
      }
      if (!res.ok) return false;
      adoptSession((await res.json()) as AuthResponse);
      return true;
    } catch {
      return false;
    }
  };
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  refreshing = (locks ? locks.request('heychat-refresh', doRefresh) : doRefresh()).finally(() => {
    refreshing = null;
  }) as Promise<boolean>;
  return refreshing;
}

async function toError(res: Response): Promise<ApiError> {
  let code = 'http_error';
  let message = `Request failed (${res.status}).`;
  try {
    const body = await res.json();
    code = body?.error?.code ?? code;
    message = body?.error?.message ?? message;
  } catch {
    /* non-JSON error */
  }
  if (res.status === 502 || res.status === 503) message = 'The server is waking up. Try again in a few seconds.';
  return new ApiError(res.status, code, message);
}

interface Opts {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opts;
  const send = async () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = await getAccessToken();
      if (!token) throw new ApiError(401, 'no_session', 'Please sign in.');
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && auth) {
      accessToken = null;
      if (await refreshSession()) res = await send();
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) listeners.forEach((l) => l());
      throw err;
    }
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Cannot reach HeyChat. Check your connection.');
  }
  if (res.status === 401 && auth) {
    clearSession();
    listeners.forEach((l) => l());
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Multipart upload with progress, using XHR (fetch has no upload progress). */
export async function uploadForm<T>(path: string, form: FormData, onProgress?: (p: number) => void): Promise<T> {
  const attempt = (token: string) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () => reject(new ApiError(0, 'network', 'Upload failed. Check your connection.'));
      xhr.send(form);
    });
  let token = await getAccessToken();
  if (!token) throw new ApiError(401, 'no_session', 'Please sign in.');
  let res = await attempt(token);
  if (res.status === 401 && (await refreshSession())) {
    token = await getAccessToken();
    if (token) res = await attempt(token);
  }
  let parsed: any = null;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    /* ignore */
  }
  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(res.status, parsed?.error?.code ?? 'http_error', parsed?.error?.message ?? `Upload failed (${res.status}).`);
  }
  return parsed as T;
}

export async function logoutRequest() {
  const rt = readRefresh();
  clearSession();
  if (rt) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => undefined);
  }
}
