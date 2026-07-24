/**
 * Thin API client for the Smart Wardrobe backend.
 * Keeps all fetch/JWT plumbing in one place so app.js stays about UI, not HTTP.
 */
const API_BASE = window.localStorage ? (window.__API_BASE__ || 'http://127.0.0.1:8001/api') : 'http://127.0.0.1:8001/api';

const Auth = {
  access: null,
  refresh: null,
  username: null,

  isLoggedIn() {
    return !!this.access;
  },

  setTokens(access, refresh) {
    this.access = access;
    this.refresh = refresh;
  },

  clear() {
    this.access = null;
    this.refresh = null;
    this.username = null;
  },
};

async function request(path, options = {}) {
  const headers = options.headers || {};
  if (Auth.access && !options.noAuth) {
    headers['Authorization'] = 'Bearer ' + Auth.access;
  }
  const res = await fetch(API_BASE + path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body, e.g. 204 */ }
  if (!res.ok) {
    const err = new Error((data && (data.detail || JSON.stringify(data))) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const Api = {
  async register(username, email, password) {
    return request('/auth/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
      noAuth: true,
    });
  },

  async login(username, password) {
    const data = await request('/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      noAuth: true,
    });
    Auth.setTokens(data.access, data.refresh);
    Auth.username = username;
    return data;
  },

  async logout() {
    try {
      if (Auth.refresh) {
        await request('/auth/logout/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: Auth.refresh }),
        });
      }
    } finally {
      Auth.clear();
    }
  },

  async listItems(filters = {}) {
    const params = new URLSearchParams(filters);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await request(`/items/${qs}`);
    return data.results || data;
  },

  async createItem(formValues, imageFile) {
    const formData = new FormData();
    Object.entries(formValues).forEach(([k, v]) => formData.append(k, v));
    if (imageFile) formData.append('image', imageFile);
    return request('/items/', { method: 'POST', body: formData });
  },

  async deleteItem(id) {
    return request(`/items/${id}/`, { method: 'DELETE' });
  },

  async leastWorn() {
    return request('/items/least-worn/');
  },

  async suggestOutfit({ occasion = 'any', lat, lon } = {}) {
    let path = `/outfits/suggest/?occasion=${occasion}`;
    if (lat && lon) path += `&lat=${lat}&lon=${lon}`;
    return request(path);
  },

  async logWorn(itemIds, occasion, wornOn) {
    return request('/outfits/worn/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemIds, occasion, worn_on: wornOn }),
    });
  },

  async wearHistory() {
    const data = await request('/outfits/history/');
    return data.results || data;
  },

  async deleteHistoryEntry(id) {
    return request(`/outfits/history/${id}/`, { method: 'DELETE' });
  },
};
