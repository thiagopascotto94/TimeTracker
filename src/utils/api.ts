export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

  const headers = new Headers(init?.headers || {});
  if (token && url.startsWith('/api/') && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchFn = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;
  const res = await fetchFn(input, {
    ...init,
    headers,
  });

  if (res.status === 401 && url.startsWith('/api/auth/me')) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jwt_token');
    }
  }

  return res;
}
