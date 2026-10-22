// PresenceHub login: verifies credentials against salted PBKDF2-SHA256 hashes with WebCrypto.
// crypto.subtle only exists in a secure context (https:// or http://localhost).
(function () {
  'use strict';

  var UI = window.PH_UI;
  var BOOT = window.PH_BOOT;
  var CONFIG = window.PH_AUTH_CONFIG;
  var FAIL_KEY = 'ph.loginFailures';
  var MAX_FAILS = 5;
  var LOCK_MS = 30000;

  var form = UI.$('#login-form');
  var userInput = UI.$('#username');
  var passInput = UI.$('#password');
  var submitBtn = UI.$('#login-submit');
  var msgHost = UI.$('#login-message');

  function showMessage(kind, text) {
    var cls = { error: 'alert-error', warning: 'alert-warning', info: 'alert-info', success: 'alert-success' }[kind];
    msgHost.replaceChildren(UI.h('div', { class: 'alert alert-soft text-sm ' + cls, attrs: { role: kind === 'error' ? 'alert' : 'status' } },
      UI.icon(kind === 'success' ? 'check' : kind === 'info' ? 'info' : 'alert', 'size-4'), UI.h('span', { text: text })));
  }

  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function equalBytes(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
  function derive(password, saltB64, iterations) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']).then(function (key) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(saltB64), iterations: iterations }, key, 256);
    }).then(function (bits) { return new Uint8Array(bits); });
  }

  function readFails() {
    try { return JSON.parse(sessionStorage.getItem(FAIL_KEY)) || { count: 0, until: 0 }; } catch (e) { return { count: 0, until: 0 }; }
  }
  function writeFails(v) { try { sessionStorage.setItem(FAIL_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  function safeNext() {
    var next = new URLSearchParams(location.search).get('next');
    return BOOT.ALLOWED_PAGES.indexOf(next) >= 0 ? next : 'index.html';
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.replaceChildren(busy ? UI.h('span', { class: 'loading loading-spinner loading-sm' }) : UI.icon('login', 'size-4'),
      busy ? 'Verifying…' : 'Sign in');
  }

  function init() {
    UI.initShell();

    var reasons = {
      signin: ['info', 'Please sign in to continue.'],
      expired: ['warning', 'Your session expired. Please sign in again.'],
      signedout: ['success', 'You have been signed out.'],
    };
    var reason = reasons[new URLSearchParams(location.search).get('reason')];
    if (reason) showMessage(reason[0], reason[1]);

    if (!window.isSecureContext || !window.crypto || !window.crypto.subtle) {
      showMessage('warning', 'Sign-in needs a secure context (WebCrypto). Serve this folder over http://localhost or https — for example run "npx serve ." in the project folder — instead of opening the file directly.');
      submitBtn.disabled = true;
      return;
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var fails = readFails();
      if (fails.until > Date.now()) {
        showMessage('warning', 'Too many attempts. Try again in ' + Math.ceil((fails.until - Date.now()) / 1000) + ' seconds.');
        return;
      }
      var username = userInput.value.trim().toLowerCase();
      var password = passInput.value;
      if (!username || !password) { showMessage('error', 'Enter a username and password.'); return; }

      var account = CONFIG.users.find(function (u) { return u.username === username; });
      // Unknown users are hashed against a decoy salt so timing does not reveal valid usernames.
      var target = account || { salt: 'AAAAAAAAAAAAAAAAAAAAAA==', iterations: 310000, hash: '' };

      setBusy(true);
      derive(password, target.salt, target.iterations).then(function (derived) {
        var ok = !!account && equalBytes(derived, b64ToBytes(target.hash));
        passInput.value = '';
        if (!ok) {
          fails.count += 1;
          if (fails.count >= MAX_FAILS) { fails = { count: 0, until: Date.now() + LOCK_MS }; }
          writeFails(fails);
          showMessage('error', 'Incorrect username or password.');
          setBusy(false);
          passInput.focus();
          return;
        }
        writeFails({ count: 0, until: 0 });
        var now = Date.now();
        sessionStorage.setItem(BOOT.SESSION_KEY, JSON.stringify({
          user: account.username, role: account.role, iat: now, exp: now + CONFIG.sessionMinutes * 60000,
        }));
        location.replace(safeNext());
      }).catch(function () {
        showMessage('error', 'Sign-in failed in this browser. Please try again.');
        setBusy(false);
      });
    });
  }

  init();
})();
