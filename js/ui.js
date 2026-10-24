// PresenceHub shared UI helpers (DOM builders, icons, theme, session, formatting, charts).
// All data is rendered with createElement/textContent — never HTML strings.
(function () {
  'use strict';

  var BOOT = window.PH_BOOT;

  // ---------------------------------------------------------------- DOM builder
  // h('div', { class: 'card', text: 'x', attrs: { 'aria-label': 'y' }, dataset: {...}, on: { click: fn } }, child...)
  function h(tag, opts) {
    var el = document.createElement(tag);
    opts = opts || {};
    if (opts.class) el.className = opts.class;
    if (opts.text != null) el.textContent = String(opts.text);
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (k) {
        if (/^on/i.test(k)) return; // never set inline handlers
        var v = opts.attrs[k];
        if (v === false || v == null) return;
        el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    if (opts.dataset) Object.keys(opts.dataset).forEach(function (k) { el.dataset[k] = String(opts.dataset[k]); });
    if (opts.on) Object.keys(opts.on).forEach(function (k) { el.addEventListener(k, opts.on[k]); });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(parent, c); }); return; }
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ---------------------------------------------------------------- Icons (Lucide-style, trusted constants)
  var ICONS = {
    overview: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
    key: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z M16.5 7.5h.01',
    report: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z M14 2v4a2 2 0 0 0 2 2h4 M16 13H8 M16 17H8 M10 9H8',
    flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
    sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41',
    moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
    login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3',
    play: 'M6 3l14 9-14 9z',
    stop: 'M6 6h12v12H6z',
    refresh: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16 M16 16h5v5',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    clock: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20 M12 6v6l4 2',
    calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
    bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
    home: 'M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
    lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4',
    search: 'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16 M21 21l-4.3-4.3',
    alert: 'M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    check: 'M20 6L9 17l-5-5',
    monitor: 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8 21h8 M12 17v4',
    pause: 'M6 4h4v16H6z M14 4h4v16h-4z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    building: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2 M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2 M10 6h4 M10 10h4 M10 14h4 M10 18h4',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
    trend: 'M22 7l-8.5 8.5-5-5L2 17 M16 7h6v6',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
    chevronLeft: 'M15 18l-6-6 6-6',
    chevronRight: 'M9 18l6-6-6-6',
    x: 'M18 6L6 18 M6 6l12 12',
    external: 'M7 17L17 7 M7 7h10v10',
    info: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20 M12 16v-4 M12 8h.01',
  };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(name, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', cls || 'size-5');
    (ICONS[name] || ICONS.info).split(' M').forEach(function (d, i) {
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', i === 0 ? d : 'M' + d);
      svg.appendChild(p);
    });
    return svg;
  }
  // <span data-icon="users" data-icon-class="size-4"></span> -> inline SVG
  function hydrateIcons(root) {
    $$('[data-icon]', root).forEach(function (el) {
      el.replaceChildren(icon(el.dataset.icon, el.dataset.iconClass || 'size-5'));
      el.removeAttribute('data-icon');
    });
  }

  // ---------------------------------------------------------------- Formatting
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function minutesLabel(m) {
    if (!m) return '0m';
    var hh = Math.floor(m / 60), mm = m % 60;
    return hh ? hh + 'h ' + pad(mm) + 'm' : mm + 'm';
  }
  function hoursDecimal(m) { return (m / 60).toFixed(1) + 'h'; }
  function toMinutes(hhmm) { if (!hhmm) return null; var p = hhmm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function fromMinutes(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function relative(minutesAgo) {
    if (minutesAgo < 1) return 'just now';
    if (minutesAgo < 60) return minutesAgo + ' min ago';
    var hrs = Math.floor(minutesAgo / 60);
    return hrs + (hrs === 1 ? ' hr ago' : ' hrs ago');
  }
  function dateLabel(iso, opts) {
    var d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short' });
  }
  var nf = new Intl.NumberFormat('en-GB');

  // ---------------------------------------------------------------- Session & roles
  var session = BOOT && BOOT.session;
  var ROLE_LABEL = { admin: 'Administrator', viewer: 'Viewer (read-only)' };
  function role() { return session ? session.role : null; }
  function can(action) {
    // admin: everything. viewer: read-only (no simulate/export/sync/check-in/edit, no directory settings).
    if (!session) return false;
    if (session.role === 'admin') return true;
    return action === 'view';
  }
  function logout() {
    try { sessionStorage.removeItem(BOOT.SESSION_KEY); } catch (e) { /* ignore */ }
    location.replace('login.html?reason=signedout');
  }
  function watchExpiry() {
    setInterval(function () {
      if (!BOOT.readSession()) location.replace('login.html?reason=expired');
    }, 30000);
  }
  // Disable action controls / remove admin-only items for read-only sessions.
  function applyRole(root) {
    if (can('edit')) return;
    $$('[data-admin-only]', root).forEach(function (el) { el.remove(); });
    $$('[data-requires="edit"]', root).forEach(function (el) {
      el.setAttribute('disabled', '');
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('title', 'Read-only account: this action is disabled');
    });
  }
  // Wrap a handler so it is a no-op (with a toast) for read-only sessions.
  function guarded(fn) {
    return function () {
      if (!can('edit')) { toast('Read-only account: this action is disabled.', 'warning'); return; }
      return fn.apply(this, arguments);
    };
  }

  // ---------------------------------------------------------------- Shell (user chip, theme, logout)
  var themeListeners = [];
  function currentMode() { return document.documentElement.getAttribute('data-mode') === 'dark' ? 'dark' : 'light'; }
  function setMode(mode) {
    var rootEl = document.documentElement;
    rootEl.setAttribute('data-theme', BOOT.THEMES[mode]);
    rootEl.setAttribute('data-mode', mode);
    try { localStorage.setItem(BOOT.THEME_KEY, mode); } catch (e) { /* ignore */ }
    syncThemeButtons();
    themeListeners.forEach(function (fn) { fn(mode); });
  }
  function syncThemeButtons() {
    var mode = currentMode();
    $$('[data-action="toggle-theme"]').forEach(function (b) {
      b.replaceChildren(icon(mode === 'dark' ? 'sun' : 'moon'));
      b.setAttribute('aria-label', mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      b.setAttribute('title', mode === 'dark' ? 'Light theme' : 'Dark theme');
    });
  }
  function onThemeChange(fn) { themeListeners.push(fn); }

  function initShell() {
    hydrateIcons(document);
    syncThemeButtons();
    $$('[data-action="toggle-theme"]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(currentMode() === 'dark' ? 'light' : 'dark'); });
    });
    $$('[data-action="logout"]').forEach(function (b) { b.addEventListener('click', logout); });
    initOwner();
    if (session) {
      $$('[data-bind="session-user"]').forEach(function (el) { el.textContent = session.user; });
      $$('[data-bind="session-role"]').forEach(function (el) { el.textContent = ROLE_LABEL[session.role]; });
      $$('[data-bind="session-initial"]').forEach(function (el) { el.textContent = session.user.charAt(0).toUpperCase(); });
    }
    applyRole(document);
    watchExpiry();
    // Close mobile drawer after picking a nav link
    var drawer = $('#nav-drawer');
    if (drawer) $$('.drawer-side a').forEach(function (a) { a.addEventListener('click', function () { drawer.checked = false; }); });
  }

  // ---------------------------------------------------------------- Toasts
  function toast(message, kind) {
    var host = $('#toast-host');
    if (!host) return;
    var cls = { success: 'alert-success', warning: 'alert-warning', error: 'alert-error', info: 'alert-info' }[kind || 'info'];
    var item = h('div', { class: 'alert ' + cls + ' shadow-sm text-sm ph-fade', attrs: { role: 'status' } },
      icon(kind === 'success' ? 'check' : kind === 'warning' || kind === 'error' ? 'alert' : 'info', 'size-4'),
      h('span', { text: message }));
    host.appendChild(item);
    setTimeout(function () { item.remove(); }, 3500);
  }

  // ---------------------------------------------------------------- Components
  function avatar(initials, size) {
    return h('span', { class: 'grid place-items-center shrink-0 aspect-square rounded-full bg-primary/15 text-primary font-semibold ' + (size || 'w-9 text-xs'), attrs: { 'aria-hidden': 'true' } },
      initials);
  }
  var STATUS = {
    online: { cls: 'badge-success', label: 'Online' },
    away: { cls: 'badge-warning', label: 'Away' },
    offline: { cls: 'badge-ghost', label: 'Offline' },
  };
  function statusBadge(status) {
    var s = STATUS[status] || STATUS.offline;
    return h('span', { class: 'badge badge-soft badge-sm gap-1.5 ' + s.cls },
      h('span', { class: 'status status-xs ' + (status === 'online' ? 'status-success' : status === 'away' ? 'status-warning' : 'status-neutral'), attrs: { 'aria-hidden': 'true' } }),
      s.label);
  }
  var BEHAVIOUR = {
    active: { cls: 'badge-success', label: 'Active' },
    idle: { cls: 'badge-warning', label: 'Idle' },
    'checked-out': { cls: 'badge-ghost', label: 'Checked out' },
    absent: { cls: 'badge-error', label: 'Not checked in' },
  };
  function behaviourBadge(b, idleMinutes) {
    var x = BEHAVIOUR[b] || BEHAVIOUR.active;
    return h('span', { class: 'badge badge-soft badge-sm ' + x.cls, text: b === 'idle' ? 'Idle ' + idleMinutes + 'm' : x.label });
  }
  // KPI tile: { label, value, sub, icon, tone }
  function kpiTile(o) {
    return h('div', { class: 'card bg-base-100 border border-base-300' },
      h('div', { class: 'card-body p-4 gap-1' },
        h('div', { class: 'flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted' },
          h('span', { text: o.label }),
          o.icon ? h('span', { class: 'text-primary' }, icon(o.icon, 'size-4')) : null),
        h('div', { class: 'text-2xl font-bold num ' + (o.tone || ''), text: o.value, dataset: o.bind ? { bind: o.bind } : undefined }),
        o.sub ? h('div', { class: 'text-xs text-muted', text: o.sub }) : null));
  }
  function emptyState(message, iconName) {
    return h('div', { class: 'flex flex-col items-center justify-center gap-2 py-10 text-center text-muted' },
      icon(iconName || 'info', 'size-8 opacity-60'), h('p', { class: 'text-sm', text: message }));
  }
  function errorState(message, onRetry) {
    return h('div', { class: 'alert alert-error alert-soft', attrs: { role: 'alert' } },
      icon('alert'), h('span', { text: message }),
      onRetry ? h('button', { class: 'btn btn-sm', text: 'Retry', on: { click: onRetry } }) : null);
  }
  function skeleton(lines) {
    var wrap = h('div', { class: 'flex flex-col gap-3', attrs: { 'aria-busy': 'true' } });
    for (var i = 0; i < (lines || 3); i++) wrap.appendChild(h('div', { class: 'skeleton h-4 ' + (i % 2 ? 'w-3/4' : 'w-full') }));
    return wrap;
  }

  // ---------------------------------------------------------------- Charts (Chart.js)
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function alpha(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function palette() {
    return {
      primary: cssVar('--color-primary'),
      accent: cssVar('--color-accent'),
      success: cssVar('--color-success'),
      warning: cssVar('--color-warning'),
      error: cssVar('--color-error'),
      secondary: cssVar('--color-secondary'),
      text: cssVar('--color-base-content'),
      muted: cssVar('--ph-muted'),
      grid: cssVar('--ph-grid'),
      surface: cssVar('--color-base-100'),
    };
  }
  var charts = [];
  // build: function(palette) -> Chart.js config. Rebuilt on theme change.
  function chart(canvas, build) {
    if (!window.Chart) {
      canvas.replaceWith(errorState('Chart library failed to load.'));
      return null;
    }
    var entry = { canvas: canvas, build: build, instance: null };
    entry.render = function () {
      if (entry.instance) entry.instance.destroy();
      var p = palette();
      window.Chart.defaults.font.family = cssVar('--font-sans') || 'sans-serif';
      window.Chart.defaults.color = p.muted;
      window.Chart.defaults.borderColor = p.grid;
      entry.instance = new window.Chart(canvas, build(p));
    };
    entry.render();
    charts.push(entry);
    return entry;
  }
  onThemeChange(function () { charts.forEach(function (c) { if (c.canvas.isConnected) c.render(); }); });

  // ---------------------------------------------------------------- CSV export (with formula-injection guard)
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadCsv(filename, header, rows) {
    var text = [header].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    var a = h('a', { attrs: { href: url, download: filename } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------------------------------------------------------------- Owner branding (Mavix Tech)
  // Copy/paths come from js/owner.js (window.PH_OWNER). Logos are same-origin <img> files (CSP img-src 'self').
  var OWNER = window.PH_OWNER;
  // Light + dark variants; css/app.css shows the one matching html[data-mode].
  function themedImg(light, dark, cls, alt) {
    return h('span', { class: 'ph-mx-img inline-flex shrink-0' },
      h('img', { class: 'ph-mx-light ' + cls, attrs: { src: light, alt: alt, decoding: 'async' } }),
      h('img', { class: 'ph-mx-dark ' + cls, attrs: { src: dark, alt: alt, decoding: 'async' } }));
  }
  function ownerLink(cls, children, label) {
    return h('a', { class: cls, attrs: { href: OWNER.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': label || null } }, children);
  }
  // Login page: "Built by Mavix Tech" block.
  function ownerCredit() {
    return h('div', { class: 'ph-mx-credit flex flex-col items-center gap-2 text-center' },
      h('span', { class: 'text-xs text-muted', text: 'Built by' }),
      ownerLink('inline-flex', themedImg(OWNER.logo, OWNER.logoDark, 'h-8 w-auto', OWNER.name), OWNER.name + ' website (opens in a new tab)'),
      h('p', { class: 'text-xs text-muted', text: OWNER.tagline }),
      ownerLink('link link-hover text-xs font-semibold ph-mx-accent inline-flex items-center gap-1',
        ['Visit website', icon('external', 'size-3.5')], 'Visit the ' + OWNER.name + ' website (opens in a new tab)'));
  }
  // Sidebar bottom: compact "Powered by" badge; a collapsed (narrow) sidebar shows the mark only + tooltip.
  function ownerBadge() {
    return ownerLink('ph-mx-badge flex items-center gap-2.5 rounded-box px-2 py-1.5 hover:bg-base-200 transition-colors',
      [themedImg(OWNER.mark, OWNER.markDark, 'size-7', ''),
        h('span', { class: 'ph-mx-badge-text flex flex-col leading-tight min-w-0' },
          h('span', { class: 'text-[0.65rem] uppercase tracking-wide text-muted', text: 'Powered by' }),
          h('span', { class: 'text-sm font-bold ph-mx-ink truncate', text: OWNER.name }))],
      'Powered by ' + OWNER.name + ' (opens in a new tab)');
  }
  var aboutDialog = null;
  function buildAbout() {
    var close = function () { aboutDialog.close(); };
    aboutDialog = h('dialog', { class: 'modal', attrs: { 'aria-labelledby': 'ph-about-title' } },
      h('div', { class: 'modal-box max-w-md' },
        h('button', { class: 'btn btn-sm btn-circle btn-ghost absolute right-3 top-3', attrs: { type: 'button', 'aria-label': 'Close' }, on: { click: close } }, icon('x', 'size-4')),
        h('h3', { id: 'ph-about-title', class: 'text-lg font-bold', text: 'PresenceHub' }),
        h('p', { class: 'text-sm text-muted', text: 'Demo system · mock data only' }),
        h('div', { class: 'divider my-3' }),
        h('div', { class: 'flex flex-col items-center gap-3 text-center' },
          themedImg(OWNER.logo, OWNER.logoDark, 'h-12 w-auto', OWNER.name),
          h('p', { class: 'text-sm font-semibold ph-mx-accent', text: OWNER.tagline }),
          h('p', { class: 'text-sm', text: OWNER.description }),
          h('p', { class: 'text-sm font-semibold', text: OWNER.cta })),
        h('div', { class: 'modal-action' },
          h('button', { class: 'btn btn-ghost btn-sm', text: 'Close', attrs: { type: 'button' }, on: { click: close } }),
          ownerLink('btn btn-sm ph-mx-btn', ['Visit website', icon('external', 'size-4')], 'Visit the ' + OWNER.name + ' website (opens in a new tab)'))),
      h('div', { class: 'modal-backdrop' },
        h('button', { text: 'close', attrs: { type: 'button', tabindex: '-1' }, on: { click: close } })));
    document.body.appendChild(aboutDialog);
  }
  function openAbout() {
    if (!aboutDialog) buildAbout();
    if (typeof aboutDialog.showModal === 'function') aboutDialog.showModal();
    else aboutDialog.setAttribute('open', '');
  }
  function initOwner() {
    if (!OWNER) return;
    $$('[data-owner="login"]').forEach(function (el) { el.replaceChildren(ownerCredit()); });
    $$('[data-owner="sidebar"]').forEach(function (el) {
      var badge = ownerBadge();
      badge.setAttribute('title', 'Powered by ' + OWNER.name + ' · ' + OWNER.tagline);
      el.replaceChildren(badge);
    });
    $$('[data-action="about"]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // close the DaisyUI dropdown
        openAbout();
      });
    });
  }

  window.PH_UI = Object.freeze({
    h: h, $: $, $$: $$, icon: icon, hydrateIcons: hydrateIcons,
    minutesLabel: minutesLabel, hoursDecimal: hoursDecimal, toMinutes: toMinutes, fromMinutes: fromMinutes,
    relative: relative, dateLabel: dateLabel, nf: nf, pad: pad,
    session: session, role: role, can: can, guarded: guarded, applyRole: applyRole, logout: logout,
    initShell: initShell, onThemeChange: onThemeChange, toast: toast,
    avatar: avatar, statusBadge: statusBadge, behaviourBadge: behaviourBadge, kpiTile: kpiTile,
    emptyState: emptyState, errorState: errorState, skeleton: skeleton,
    chart: chart, alpha: alpha, palette: palette, downloadCsv: downloadCsv,
    openAbout: openAbout,
  });
})();
