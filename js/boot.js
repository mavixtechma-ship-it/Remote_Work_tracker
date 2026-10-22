// PresenceHub boot: runs synchronously in <head> on every page.
// 1) applies the saved / preferred colour theme before first paint
// 2) session guard: protected pages redirect to login.html when there is no valid session
// Client-side only: this is a demo access gate, not a security boundary.
(function () {
  'use strict';

  var SESSION_KEY = 'ph.session';
  var THEME_KEY = 'ph.theme';
  var THEMES = { light: 'presence-light', dark: 'presence-dark' };
  var ALLOWED_PAGES = ['index.html', 'user.html'];
  var root = document.documentElement;

  // ---- theme ----
  var mode = null;
  try { mode = localStorage.getItem(THEME_KEY); } catch (e) { /* storage blocked */ }
  if (mode !== 'light' && mode !== 'dark') {
    mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', THEMES[mode]);
  root.setAttribute('data-mode', mode);

  // ---- session ----
  function readSession() {
    var raw = null;
    try { raw = sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || typeof s.user !== 'string' || (s.role !== 'admin' && s.role !== 'viewer')) return null;
      if (typeof s.exp !== 'number' || s.exp <= Date.now()) {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
        return null;
      }
      return Object.freeze({ user: s.user, role: s.role, exp: s.exp });
    } catch (e) {
      return null;
    }
  }

  var page = root.getAttribute('data-page');
  var session = readSession();

  if (page === 'login') {
    if (session) location.replace('index.html');
  } else if (!session) {
    var file = location.pathname.split('/').pop() || 'index.html';
    if (file.indexOf('.') < 0) file += '.html'; // servers with "clean URLs" (e.g. /user)
    var next = ALLOWED_PAGES.indexOf(file) >= 0 ? file : 'index.html';
    location.replace('login.html?next=' + encodeURIComponent(next) + '&reason=signin');
  }
  // Only reveal the app shell when the page is allowed to render.
  if (page === 'login' ? !session : !!session) root.classList.add('ph-ready');

  window.PH_BOOT = Object.freeze({
    SESSION_KEY: SESSION_KEY,
    THEME_KEY: THEME_KEY,
    THEMES: THEMES,
    ALLOWED_PAGES: ALLOWED_PAGES,
    session: session,
    readSession: readSession,
  });
})();
