/* HazGuard Centralized REST API Client */

const getApiBase = () => {
  // If opened directly from file system or a different dev server port (e.g. 5500)
  if (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8000')) {
    return 'http://localhost:8000/api';
  }
  return '/api';
};

const API_BASE = getApiBase();

class ApiClient {
  static getAuthToken() {
    return localStorage.getItem('wg_token') || '';
  }

  static getHeaders(extraHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    };
    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Token ${token}`;
    }
    return headers;
  }

  static async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const config = {
      ...options,
      headers: this.getHeaders(options.headers || {})
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Auth token expired or invalid
        localStorage.removeItem('wg_token');
        localStorage.removeItem('wg_user');
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
          window.location.href = 'login.html';
        }
        throw new Error('Unauthorized session. Please log in again.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || errorData.detail || `Server returned error status ${response.status}`;
        throw new Error(message);
      }

      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null;
      }

      return await response.json();
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      if (typeof Components !== 'undefined') {
        Components.showToast(err.message || 'Network communication failure', 'error');
      }
      throw err;
    }
  }

  static get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  static post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  static put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  static patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  static delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}
