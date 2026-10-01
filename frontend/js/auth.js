/* HazGuard Auth & User Roles Manager */

class AuthManager {
  static getCurrentUser() {
    const data = localStorage.getItem('wg_user');
    if (data) {
      try { return JSON.parse(data); } catch(e) { return null; }
    }
    return null;
  }

  static isAuthenticated() {
    return !!localStorage.getItem('wg_token');
  }

  static checkAuthGuard() {
    const isPublicPage = window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    if (!this.isAuthenticated() && !isPublicPage) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  static async login(username, password) {
    const response = await ApiClient.post('/auth/login/', { username, password });
    if (response && response.token) {
      localStorage.setItem('wg_token', response.token);
      localStorage.setItem('wg_user', JSON.stringify(response.user));
      Components.showToast('Login successful. Redirecting to Dashboard...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 500);
      return response.user;
    }
    throw new Error('Authentication failed');
  }

  static async logout() {
    try {
      await ApiClient.post('/auth/logout/', {});
    } catch(e) {}
    localStorage.removeItem('wg_token');
    localStorage.removeItem('wg_user');
    window.location.href = 'login.html';
  }

  static renderUserNav() {
    const user = this.getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById('nav-user-name');
    const roleEl = document.getElementById('nav-user-role');
    const avatarEl = document.getElementById('nav-user-avatar');

    if (nameEl) nameEl.textContent = user.first_name ? `${user.first_name} ${user.last_name}` : user.username;
    if (roleEl) roleEl.textContent = user.role || 'OPERATOR';
    if (avatarEl) {
      const initial = (user.username || 'U').charAt(0).toUpperCase();
      avatarEl.textContent = initial;
    }

    // Role-based visibility enforcement in UI
    const role = user.role || 'OPERATOR';
    document.querySelectorAll('[data-role-min]').forEach(el => {
      const minRole = el.getAttribute('data-role-min');
      if (minRole === 'ADMIN' && role !== 'ADMIN') {
        el.style.display = 'none';
      } else if (minRole === 'SUPERVISOR' && !['ADMIN', 'SUPERVISOR'].includes(role)) {
        el.style.display = 'none';
      } else if (minRole === 'SAFETY_OFFICER' && !['ADMIN', 'SUPERVISOR', 'SAFETY_OFFICER'].includes(role)) {
        el.style.display = 'none';
      }
    });
  }
}

// Auto run auth check on script load
document.addEventListener('DOMContentLoaded', () => {
  AuthManager.checkAuthGuard();
  AuthManager.renderUserNav();
});
