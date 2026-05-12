// Default: same-origin '/api' — Next proxies to Nest via apps/web/src/app/api/[...path]/route.ts.
// Override with NEXT_PUBLIC_API_URL only if you're pointing the browser at a separate API URL.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function authHeader(role: 'user' | 'admin'): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.sessionStorage.getItem(role === 'admin' ? 'admin_token' : 'user_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T = any>(
  path: string,
  opts: RequestInit & { role?: 'user' | 'admin' } = {},
): Promise<T> {
  const { role, headers, ...rest } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(headers as any),
      ...(role ? authHeader(role) : {}),
    },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = await res.json();
      msg = body.message || JSON.stringify(body);
    } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return (await res.text()) as any;
}

export async function apiBlob(path: string, opts: RequestInit & { role?: 'user' | 'admin' } = {}): Promise<Blob> {
  const { role, headers, ...rest } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: { ...(headers as any), ...(role ? authHeader(role) : {}) },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch {}
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.blob();
}

export function saveToken(role: 'user' | 'admin', token: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(role === 'admin' ? 'admin_token' : 'user_token', token);
}

export function clearToken(role: 'user' | 'admin') {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(role === 'admin' ? 'admin_token' : 'user_token');
}
