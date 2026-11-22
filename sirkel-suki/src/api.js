async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  let data = null;
  try {
    data = await response.json();
  } catch {
    // respons tanpa body JSON, abaikan
  }
  return { ok: response.ok, status: response.status, data };
}

export async function getSession() {
  const { data } = await request('/api/session');
  return data?.authenticated === true;
}

export const login = (username, password) =>
  request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

export const logout = () => request('/api/logout', { method: 'POST' });

export const getPhotos = () => request('/api/photos');
