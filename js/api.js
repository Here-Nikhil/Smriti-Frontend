const API_BASE = "https://smriti-backend-3yf8.onrender.com";

function getToken() {
  return localStorage.getItem('smriti_token');
}

// Central fetch wrapper -- every authenticated call goes through here so the
// Authorization header and the "token expired, kick back to login" logic
// only live in one place.
async function apiFetch(path, options = {}) {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('smriti_token');
    window.location.href = 'index.html';
    return;
  }

  return res;
}
