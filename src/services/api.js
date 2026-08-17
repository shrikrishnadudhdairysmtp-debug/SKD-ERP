import { STORAGE_KEYS } from '../constants/defaults.js';

const BASE_URL = '/api';

async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    window.location.reload(); // Force re-login
    throw new Error('Unauthorized');
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      data = { error: text || `HTTP ${response.status} ${response.statusText}` };
    }
  } else {
    const text = await response.text();
    data = { error: text || `HTTP ${response.status} ${response.statusText}` };
  }

  if (!response.ok) {
    throw new Error(data.error || `API request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  get: (endpoint) => fetchWithAuth(endpoint),
  post: (endpoint, body) => fetchWithAuth(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => fetchWithAuth(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => fetchWithAuth(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, body) => fetchWithAuth(endpoint, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};
