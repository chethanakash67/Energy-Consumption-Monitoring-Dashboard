/**
 * Thin API client.
 *
 * The token lives in `localStorage` and is attached to every request. A 401
 * clears it and bounces to /login, so an expired session can never leave the
 * UI in a half-authenticated state.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'voltiq.token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages keyed by form field name, for inline form errors. */
  get fieldErrors(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const detail of this.details ?? []) map[detail.path] = detail.message;
    return map;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the automatic redirect-to-login on 401 (used by the login form). */
  silent401?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, silent401, headers, ...rest } = options;
  const token = getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && !silent401) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return (await response.text()) as T;
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error ?? 'Something went wrong',
      payload.details,
    );
  }

  return payload as T;
}

/** SWR fetcher — takes the path directly as the cache key. */
export const fetcher = <T,>(path: string) => apiFetch<T>(path);

/**
 * Builds a query string from the dashboard's filter state, always attaching
 * the browser's IANA timezone so server-side day/hour buckets match what the
 * user sees on the axis.
 */
export function buildQuery(params: Record<string, string | number | string[] | undefined | null>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }

  if (!search.has('tz')) {
    search.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  }

  return search.toString();
}

/** Triggers a browser download for an authenticated endpoint. */
export async function downloadFile(path: string, filename: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!response.ok) throw new ApiError(response.status, 'Export failed');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
