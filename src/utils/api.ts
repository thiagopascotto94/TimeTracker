let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

  const headers = new Headers(init?.headers || {});
  if (token && url.startsWith('/api/') && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('cronos_active_workspace_id') : null;
  if (activeWorkspaceId && url.startsWith('/api/') && !headers.has('x-workspace-id')) {
    headers.set('x-workspace-id', activeWorkspaceId);
  }

  const userTimezone =
    typeof window !== 'undefined'
      ? localStorage.getItem('cronos_user_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
      : 'America/Sao_Paulo';
  if (userTimezone && url.startsWith('/api/') && !headers.has('x-timezone')) {
    headers.set('x-timezone', userTimezone);
  }

  const fetchFn = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;
  const res = await fetchFn(input, {
    ...init,
    headers,
  });

  // Check if token expired and needs refresh (401)
  const isAuthEndpoint =
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/register') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/forgot-password') ||
    url.includes('/api/auth/reset-password');

  if (res.status === 401 && !isAuthEndpoint && typeof window !== 'undefined') {
    const refreshToken = localStorage.getItem('refresh_token');

    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetchFn('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            if (data.token) {
              localStorage.setItem('jwt_token', data.token);
              if (data.refreshToken) {
                localStorage.setItem('refresh_token', data.refreshToken);
              }
              isRefreshing = false;
              onTokenRefreshed(data.token);

              // Replay current request with new token
              const retryHeaders = new Headers(init?.headers || {});
              retryHeaders.set('Authorization', `Bearer ${data.token}`);
              return fetchFn(input, {
                ...init,
                headers: retryHeaders,
              });
            }
          }
        } catch (e) {
          console.warn('Failed to auto-refresh token:', e);
        }

        // Refresh failed: clear storage
        isRefreshing = false;
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('refresh_token');
      } else {
        // Queue this request until refreshing completes
        return new Promise<Response>((resolve) => {
          addRefreshSubscriber(async (newToken: string) => {
            const retryHeaders = new Headers(init?.headers || {});
            retryHeaders.set('Authorization', `Bearer ${newToken}`);
            const retryRes = await fetchFn(input, {
              ...init,
              headers: retryHeaders,
            });
            resolve(retryRes);
          });
        });
      }
    } else {
      localStorage.removeItem('jwt_token');
    }
  }

  if (res.status === 403 && typeof window !== 'undefined') {
    try {
      const cloned = res.clone();
      cloned.json().then((data) => {
        if (data && data.code === 'WORKSPACE_LOCKED') {
          // If the currently saved workspace is locked, remove stale ID and trigger reset
          localStorage.removeItem('cronos_active_workspace_id');
          window.dispatchEvent(new CustomEvent('workspace-locked-detected', { detail: data }));
          window.dispatchEvent(new CustomEvent('workspace-changed', { detail: {} }));
        }
      }).catch(() => {});
    } catch {
      // ignore json/clone errors
    }
  }

  return res;
}

