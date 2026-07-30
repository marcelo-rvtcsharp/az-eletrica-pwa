// ── Configuração da API ────────────────────────────────────────────────────
const API_URL = 'https://web-production-a606c.up.railway.app';

function getToken() {
  return localStorage.getItem('az_token');
}

function setToken(token) {
  localStorage.setItem('az_token', token);
}

function clearToken() {
  localStorage.removeItem('az_token');
  localStorage.removeItem('az_usuario');
}

function getUsuario() {
  try { return JSON.parse(localStorage.getItem('az_usuario')); } catch { return null; }
}

function setUsuario(u) {
  localStorage.setItem('az_usuario', JSON.stringify(u));
}

async function api(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (res.status === 401) {
    clearToken();
    mostrarLogin();
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erro ${res.status}`);
  }

  return res.json();
}

const GET    = (path)        => api('GET',    path);
const POST   = (path, body)  => api('POST',   path, body);
const PUT    = (path, body)  => api('PUT',    path, body);
const DEL    = (path)        => api('DELETE', path);
