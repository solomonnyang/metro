const TOKEN_KEY = 'metroAdminToken';

export const isAuthenticated = () => !!localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const request = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['x-admin-token'] = token;

  const res = await fetch(`/api/admin${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
  return data;
};

export const login = async (username, password) => {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'Invalid username or password');
  return data.token;
};

export const getStats = () => request('/stats');

export const getUsers = ({ page = 1, limit = 10, search = '' } = {}) =>
  request(`/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);

export const getUserDetail = (id) => request(`/users/${id}`);

export const patchUser = (id, fields) =>
  request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });

export const deleteUser = (id) => request(`/users/${id}`, { method: 'DELETE' });