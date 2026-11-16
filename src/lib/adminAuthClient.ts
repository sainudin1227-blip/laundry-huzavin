const TOKEN_STORAGE_KEY = 'huzavin_admin_session_token';
let inMemoryToken: string | null = null;

export function saveAdminSessionToken(token: string | null): void {
  inMemoryToken = token && token.trim() ? token.trim() : null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (inMemoryToken) {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, inMemoryToken);
      } else {
        window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage quota / strict privacy mode errors; in-memory token remains active
  }
}

export function getAdminSessionToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored && stored.trim()) {
        inMemoryToken = stored.trim();
        return inMemoryToken;
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const token = getAdminSessionToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export function getAdminStreamUrl(): string {
  const token = getAdminSessionToken();
  if (!token) return '/api/admin/stream';
  return `/api/admin/stream?token=${encodeURIComponent(token)}`;
}

export function getAdminProtectedAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  const token = getAdminSessionToken();
  if (!token || !url.startsWith('/api/admin/')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}
