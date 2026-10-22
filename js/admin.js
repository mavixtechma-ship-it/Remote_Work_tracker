// PresenceHub admin console (index.html).
(function () {
  'use strict';

  var UI = window.PH_UI;
  var h = UI.h, $ = UI.$, $$ = UI.$$;

  var VIEWS = {
    overview: 'Overview',
    employees: 'Employees',
    profile: 'Employee profile',
    directory: 'Directory sync',
    reports: 'Reports',
    roadmap: 'Roadmap',
  };
  var PAGE_SIZE = 12;

  var D = null;            // loaded data (mutable copy for the demo session)
  var deptName = {};
  var simClock = 0;        // minutes since midnight, advances with simulated events
  var charts = {};
  var empState = { q: '', dept: '', status: '', sort: 'name', dir: 1, page: 0 };
  var profileId = null;

  // ------------------------------------------------------------ routing
  function parseHash() {
    var raw = decodeURIComponent(location.hash.replace(/^#/, ''));
    var qIdx = raw.indexOf('?');
    var path = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    var params = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : '');
    var parts = path.split('/');
    return { view: parts[0] || 'overview', arg: parts[1] || null, params: params };
  }

  function route() {
    var r = parseHash();
    var view = VIEWS[r.view] ? r.view : 'overview';
    if (view === 'directory' && !UI.can('edit')) {
      UI.toast('Directory settings are available to administrators only.', 'warning');
      history.replaceState(null, '', '#overview');
      view = 'overview';
    }
    $$('[data-view]').forEach(function (s) { s.hidden = s.dataset.view !== view; });
    $$('[data-nav]').forEach(function (a) {
      var active = a.dataset.nav === view;
      a.classList.toggle('menu-active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#page-title').textContent = VIEWS[view];
    $('#crumb').textContent = VIEWS[view];
    document.title = VIEWS[view] + ' · PresenceHub';

    if (view === 'employees') {
      empState.q = r.params.get('q') || '';
      empState.dept = deptName[r.params.get('dept')] ? r.params.get('dept') : '';
      empState.status = ['online', 'away', 'offline'].indexOf(r.params.get('status')) >= 0 ? r.params.get('status') : '';
      $('#emp-search').value = empState.q;
      $('#emp-dept').value = empState.dept;
      $('#emp-status').value = empState.status;
      renderEmployees();
    }
    if (view === 'profile') {
      var id = r.arg && findEmp(r.arg) ? r.arg : (profileId || D.meta.featuredEmployeeId);
      renderProfile(id);
    }
    // Charts inside hidden sections need a resize once visible.
    Object.keys(charts).forEach(function (k) { if (charts[k] && charts[k].instance) charts[k].instance.resize(); });
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ helpers
  function findEmp(id) { return D.employees.find(function (e) { return e.id === id; }); }
  function counts() {
    var c = { online: 0, away: 0, offline: 0, checkedIn: 0, idle: 0 };
    D.employees.forEach(function (e) {
      c[e.status] += 1;
      if (e.checkIn) c.checkedIn += 1;
      if (e.behaviour === 'idle') c.idle += 1;
    });
    return c;
  }
  function deptStats() {
    return D.departments.map(function (d) {
      var members = D.employees.filter(function (e) { return e.departmentId === d.id; });
      var present = members.filter(function (e) { return e.checkIn; }).length;
      return { id: d.id, name: d.name, headcount: members.length, present: present, pct: members.length ? Math.round((present / members.length) * 100) : 0 };
    }).sort(function (a, b) { return b.pct - a.pct; });
  }
  function rateFromHistory(days) {
    var work = days.filter(function (d) { return d.status !== 'weekend' && d.status !== 'leave'; });
    var present = work.filter(function (d) { return d.status === 'present' || d.status === 'late' || d.status === 'today'; });
    return work.length ? Math.round((present.length / work.length) * 100) : 0;
  }
  function setBind(name, value) { $$('[data-bind="' + name + '"]').forEach(function (el) { el.textContent = value; }); }

  // ------------------------------------------------------------ overview
  function renderKpis() {
    var c = counts();
    var checked = D.employees.filter(function (e) { return e.checkIn; });
    var avg = checked.length ? Math.round(checked.reduce(function (s, e) { return s + e.minutesToday; }, 0) / checked.length) : 0;
    $('#ov-kpis').replaceChildren(
      UI.kpiTile({ label: 'Employees', value: UI.nf.format(D.employees.length), sub: 'Synced from directory', icon: 'users' }),
      UI.kpiTile({ label: 'Checked in today', value: UI.nf.format(c.checkedIn), sub: Math.round((c.checkedIn / D.employees.length) * 100) + '% of workforce', icon: 'login' }),
      UI.kpiTile({ label: 'Avg hours today', value: UI.hoursDecimal(avg), sub: 'Across checked-in staff · target 8h', icon: 'clock' }),
      UI.kpiTile({ label: 'Idle alerts', value: String(c.idle), sub: 'Idle for more than 15 min', icon: 'alert', tone: c.idle ? 'text-warning' : '' })
    );
    setBind('online-count', String(c.online));
  }

  var ACT_ICON = { 'check-in': ['login', 'bg-success/15 text-success'], 'check-out': ['logout', 'bg-base-300 text-base-content'], idle: ['pause', 'bg-warning/15 text-warning'], resume: ['activity', 'bg-primary/15 text-primary'], sync: ['refresh', 'bg-accent/40 text-accent-content'] };
  function renderActivity() {
    var list = $('#ov-activity');
    if (!D.activities.length) { list.replaceChildren(UI.emptyState('No activity yet today.', 'activity')); return; }
    list.replaceChildren.apply(list, D.activities.map(function (a) {
      var meta = ACT_ICON[a.type] || ACT_ICON.resume;
      var emp = a.employeeId ? findEmp(a.employeeId) : null;
      var stamp = UI.fromMinutes(Math.max(0, simClock - a.minutesAgo));
      return h('li', { class: 'flex items-center gap-3 py-2.5 px-1' },
        h('span', { class: 'grid place-items-center size-8 rounded-lg shrink-0 ' + meta[1] }, UI.icon(meta[0], 'size-4')),
        h('p', { class: 'text-sm flex-1 min-w-0' },
          emp ? h('a', { class: 'font-semibold link link-hover', text: emp.name, attrs: { href: '#profile/' + emp.id } }) : null,
          emp ? ' ' + a.text : h('span', { class: 'font-semibold', text: a.text })),
        h('time', { class: 'text-xs text-muted whitespace-nowrap', text: UI.relative(a.minutesAgo), attrs: { title: 'at ' + stamp } }));
    }));
  }

  function renderStatusLegend() {
    var c = counts();
    var total = D.employees.length;
    var rows = [['online', 'Online', 'status-success'], ['away', 'Away', 'status-warning'], ['offline', 'Offline', 'status-neutral']];
    $('#ov-status-legend').replaceChildren.apply($('#ov-status-legend'), rows.map(function (r) {
      return h('li', { class: 'flex items-center gap-2' },
        h('span', { class: 'status ' + r[2], attrs: { 'aria-hidden': 'true' } }),
        h('span', { class: 'flex-1', text: r[1] }),
        h('span', { class: 'font-semibold num', text: String(c[r[0]]) }),
        h('span', { class: 'text-xs text-muted num w-10 text-right', text: Math.round((c[r[0]] / total) * 100) + '%' }));
    }));
  }

  function buildCharts() {
    charts.hourly = UI.chart($('#chart-hourly'), function (p) {
      return {
        type: 'bar',
        data: {
          labels: D.hourly.hours,
          datasets: [
            { label: 'Check-ins', data: D.hourly.checkIns.slice(), backgroundColor: p.primary, borderRadius: 4, maxBarThickness: 22 },
            { label: 'Check-outs', data: D.hourly.checkOuts.slice(), backgroundColor: UI.alpha(p.secondary, 0.45), borderRadius: 4, maxBarThickness: 22 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: p.grid } } },
        },
      };
    });
    charts.depts = UI.chart($('#chart-depts'), function (p) {
      var s = deptStats();
      return {
        type: 'bar',
        data: { labels: s.map(function (d) { return d.name; }), datasets: [{ label: 'Present', data: s.map(function (d) { return d.pct; }), backgroundColor: p.primary, borderRadius: 4, maxBarThickness: 18 }] },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { var d = s[ctx.dataIndex]; return d.pct + '% present (' + d.present + ' of ' + d.headcount + ')'; } } } },
          scales: { x: { min: 0, max: 100, ticks: { callback: function (v) { return v + '%'; } }, grid: { color: p.grid } }, y: { grid: { display: false } } },
        },
      };
    });
    charts.status = UI.chart($('#chart-status'), function (p) {
      var c = counts();
      return {
        type: 'doughnut',
        data: { labels: ['Online', 'Away', 'Offline'], datasets: [{ data: [c.online, c.away, c.offline], backgroundColor: [p.success, p.warning, UI.alpha(p.muted, 0.45)], borderColor: p.surface, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
      };
    });
    charts.trend = UI.chart($('#chart-trend'), function (p) {
      var t = orgTrend();
      return {
        type: 'line',
        data: { labels: t.map(function (d) { return UI.dateLabel(d.date, { day: 'numeric', month: 'short' }); }), datasets: [{ label: 'Attendance rate', data: t.map(function (d) { return d.rate; }), borderColor: p.primary, backgroundColor: UI.alpha(p.primary, 0.12), fill: true, tension: 0.3, pointRadius: 2 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { return ctx.parsed.y + '% attended'; } } } },
          scales: { y: { suggestedMin: 60, max: 100, ticks: { callback: function (v) { return v + '%'; } }, grid: { color: p.grid } }, x: { grid: { display: false } } },
        },
      };
    });
  }

  function orgTrend() {
    var byDate = {};
    Object.keys(D.attendanceHistory).forEach(function (id) {
      D.attendanceHistory[id].forEach(function (d) {
        if (d.status === 'weekend') return;
        var b = byDate[d.date] || (byDate[d.date] = { work: 0, present: 0 });
        if (d.status === 'leave') return;
        b.work += 1;
        if (d.status !== 'absent') b.present += 1;
      });
    });
    return Object.keys(byDate).sort().map(function (date) {
      var b = byDate[date];
      return { date: date, rate: b.work ? Math.round((b.present / b.work) * 100) : 0 };
    });
  }

  function refreshLive() {
    renderKpis();
    renderActivity();
    renderStatusLegend();
    ['hourly', 'depts', 'status'].forEach(function (k) { if (charts[k]) charts[k].render(); });
    if (!$('[data-view="employees"]').hidden) renderEmployees();
  }

  function simulateCheckIn() {
    var waiting = D.employees.filter(function (e) { return !e.checkIn; });
    if (!waiting.length) { UI.toast('Everyone is already checked in.', 'info'); return; }
    var emp = waiting[Math.floor(Math.random() * waiting.length)];
    simClock += 1;
    var t = UI.fromMinutes(simClock);
    emp.status = 'online';
    emp.checkIn = t;
    emp.checkOut = null;
    emp.behaviour = 'active';
    emp.minutesToday = 0;
    var hourIdx = D.hourly.hours.indexOf(UI.pad(Math.floor(simClock / 60)) + ':00');
    if (hourIdx >= 0) D.hourly.checkIns[hourIdx] += 1;
    D.activities.forEach(function (a) { a.minutesAgo += 1; });
    D.activities.unshift({ id: 'SIM-' + Date.now(), type: 'check-in', employeeId: emp.id, text: 'checked in', minutesAgo: 0 });
    refreshLive();
    UI.toast(emp.name + ' checked in at ' + t + '.', 'success');
  }

  // ------------------------------------------------------------ employees table
  function filteredEmployees() {
    var q = empState.q.trim().toLowerCase();
    var list = D.employees.filter(function (e) {
      if (empState.dept && e.departmentId !== empState.dept) return false;
      if (empState.status && e.status !== empState.status) return false;
      if (q && (e.name + ' ' + e.title).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = empState.sort, dir = empState.dir;
    var STATUS_ORDER = { online: 0, away: 1, offline: 2 };
    list.sort(function (a, b) {
      var va, vb;
      if (key === 'department') { va = deptName[a.departmentId]; vb = deptName[b.departmentId]; }
      else if (key === 'status') { va = STATUS_ORDER[a.status]; vb = STATUS_ORDER[b.status]; }
      else if (key === 'checkIn') { va = a.checkIn || '99:99'; vb = b.checkIn || '99:99'; }
      else { va = a[key]; vb = b[key]; }
      return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
    });
    return list;
  }

  function writeFiltersToHash() {
    var p = new URLSearchParams();
    if (empState.q) p.set('q', empState.q);
    if (empState.dept) p.set('dept', empState.dept);
    if (empState.status) p.set('status', empState.status);
    var qs = p.toString();
    history.replaceState(null, '', '#employees' + (qs ? '?' + qs : ''));
  }

  function renderEmployees() {
    var list = filteredEmployees();
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    empState.page = Math.min(empState.page, pages - 1);
    var slice = list.slice(empState.page * PAGE_SIZE, (empState.page + 1) * PAGE_SIZE);
    var tbody = $('#emp-tbody');
    if (!slice.length) {
      tbody.replaceChildren(h('tr', {}, h('td', { attrs: { colspan: '8' } }, UI.emptyState('No employees match these filters.', 'search'))));
    } else {
      tbody.replaceChildren.apply(tbody, slice.map(function (e) {
        var tr = h('tr', { class: 'hover:bg-base-200 cursor-pointer' },
          h('td', {}, h('div', { class: 'flex items-center gap-3' }, UI.avatar(e.initials),
            h('div', { class: 'min-w-0' },
              h('a', { class: 'font-semibold link link-hover', text: e.name, attrs: { href: '#profile/' + e.id } }),
              h('div', { class: 'text-xs text-muted truncate', text: e.title })))),
          h('td', { text: deptName[e.departmentId] }),
          h('td', {}, UI.statusBadge(e.status)),
          h('td', { class: 'text-right num', text: e.checkIn || '—' }),
          h('td', { class: 'text-right num', text: e.checkOut || '—' }),
          h('td', { class: 'text-right num font-medium', text: e.checkIn ? UI.minutesLabel(e.minutesToday) : '—' }),
          h('td', {}, UI.behaviourBadge(e.behaviour, e.idleMinutes)),
          h('td', { class: 'text-right num font-semibold ' + (e.score >= 90 ? 'text-success' : e.score < 70 ? 'text-error' : ''), text: String(e.score) }));
        tr.addEventListener('click', function (ev) { if (!ev.target.closest('a')) location.hash = '#profile/' + e.id; });
        return tr;
      }));
    }
    $('#emp-count').textContent = list.length + ' of ' + D.employees.length + ' employees';
    $('#emp-page-label').textContent = 'Page ' + (empState.page + 1) + ' of ' + pages;
    $('#emp-prev').disabled = empState.page === 0;
    $('#emp-next').disabled = empState.page >= pages - 1;
    $$('.sort-btn').forEach(function (b) {
      var th = b.closest('th');
      if (b.dataset.sort === empState.sort) th.setAttribute('aria-sort', empState.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
      b.textContent = b.textContent.replace(/ [▲▼]$/, '') + (b.dataset.sort === empState.sort ? (empState.dir > 0 ? ' ▲' : ' ▼') : '');
    });
  }

  function bindEmployees() {
    var sel = $('#emp-dept');
    D.departments.forEach(function (d) { sel.appendChild(h('option', { text: d.name, attrs: { value: d.id } })); });
    $('#emp-filters').addEventListener('submit', function (e) { e.preventDefault(); });
    $('#emp-search').addEventListener('input', function (e) { empState.q = e.target.value.slice(0, 60); empState.page = 0; writeFiltersToHash(); renderEmployees(); });
    sel.addEventListener('change', function (e) { empState.dept = e.target.value; empState.page = 0; writeFiltersToHash(); renderEmployees(); });
    $('#emp-status').addEventListener('change', function (e) { empState.status = e.target.value; empState.page = 0; writeFiltersToHash(); renderEmployees(); });
    $$('.sort-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (empState.sort === b.dataset.sort) empState.dir *= -1; else { empState.sort = b.dataset.sort; empState.dir = 1; }
        renderEmployees();
      });
    });
    $('#emp-prev').addEventListener('click', function () { empState.page = Math.max(0, empState.page - 1); renderEmployees(); });
    $('#emp-next').addEventListener('click', function () { empState.page += 1; renderEmployees(); });
    $('#btn-sync').addEventListener('click', UI.guarded(runSync));
  }

  function runSync() {
    D.meta.directory.lastSyncMinutesAgo = 0;
    D.activities.unshift({ id: 'SYNC-' + Date.now(), type: 'sync', employeeId: null, text: 'Directory sync completed — ' + D.employees.length + ' accounts', minutesAgo: 0 });
    renderActivity();
    renderDirectory();
    UI.toast('Directory sync complete — ' + D.employees.length + ' accounts up to date.', 'success');
  }

  // ------------------------------------------------------------ profile
  var TL_STYLE = {
    'check-in': ['login', 'bg-success text-success-content'],
    active: ['monitor', 'bg-primary text-primary-content'],
    idle: ['pause', 'bg-warning text-warning-content'],
    locked: ['lock', 'bg-base-300 text-base-content'],
    'check-out': ['logout', 'bg-secondary text-secondary-content'],
  };
  function timelineItem(t) {
    var st = TL_STYLE[t.type] || TL_STYLE.active;
    var when = t.end ? t.start + ' – ' + t.end : (t.type === 'active' ? 'since ' + t.start : t.start);
    var dur = t.end ? UI.minutesLabel(UI.toMinutes(t.end) - UI.toMinutes(t.start)) : null;
    return h('li', { class: 'relative flex gap-4' },
      h('span', { class: 'relative z-10 grid place-items-center size-8 rounded-full shrink-0 ' + st[1] }, UI.icon(st[0], 'size-4')),
      h('div', { class: 'pt-1' },
        h('p', { class: 'text-sm font-semibold', text: t.label }),
        h('p', { class: 'text-xs text-muted num', text: when + (dur ? ' · ' + dur : '') })));
  }

  function heatCells(days) {
    var first = new Date(days[0].date + 'T12:00:00');
    var offset = (first.getDay() + 6) % 7; // Monday = 0
    var cells = [];
    for (var i = 0; i < offset; i++) cells.push(h('span', { class: 'heat-cell', dataset: { kind: 'blank' }, attrs: { 'aria-hidden': 'true' } }));
    days.forEach(function (d) {
      var lvl = d.minutes <= 0 ? 0 : d.minutes < 360 ? 1 : d.minutes < 450 ? 2 : d.minutes < 510 ? 3 : 4;
      var label = UI.dateLabel(d.date) + ': ' + (d.status === 'weekend' ? 'weekend' : d.status === 'absent' ? 'absent' : d.status === 'leave' ? 'on leave' : UI.minutesLabel(d.minutes) + (d.status === 'late' ? ' (late)' : d.status === 'today' ? ' (today, in progress)' : ''));
      cells.push(h('span', { class: 'heat-cell num', text: String(Number(d.date.slice(8))), dataset: { level: lvl, kind: d.status }, attrs: { role: 'img', 'aria-label': label, title: label } }));
    });
    return cells;
  }

  function renderProfile(id) {
    var e = findEmp(id);
    if (!e) return;
    profileId = id;
    var hist = D.attendanceHistory[id] || [];
    var picker = h('select', { class: 'select select-sm w-56', attrs: { 'aria-label': 'Choose employee' } },
      D.employees.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (x) {
        return h('option', { text: x.name, attrs: { value: x.id, selected: x.id === id } });
      }));
    picker.addEventListener('change', function () { location.hash = '#profile/' + picker.value; });

    $('#pf-header').replaceChildren(
      UI.avatar(e.initials, 'w-16 text-xl'),
      h('div', { class: 'flex-1 min-w-0' },
        h('div', { class: 'flex flex-wrap items-center gap-2' }, h('h2', { class: 'text-xl font-bold', text: e.name }), UI.statusBadge(e.status)),
        h('p', { class: 'text-sm text-muted', text: e.title + ' · ' + deptName[e.departmentId] }),
        h('div', { class: 'flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-muted' },
          h('span', { class: 'inline-flex items-center gap-1.5' }, UI.icon('mail', 'size-3.5'), e.email),
          h('span', { class: 'inline-flex items-center gap-1.5 code-block' }, UI.icon('key', 'size-3.5'), e.directoryAccount),
          h('span', { class: 'inline-flex items-center gap-1.5' }, UI.icon('clock', 'size-3.5'), e.checkIn ? 'Checked in ' + e.checkIn + (e.checkOut ? ' · out ' + e.checkOut : '') : 'Not checked in today'))),
      picker);

    $('#pf-kpis').replaceChildren(
      UI.kpiTile({ label: 'Hours today', value: e.checkIn ? UI.minutesLabel(e.minutesToday) : '—', sub: 'Target 8h', icon: 'clock' }),
      UI.kpiTile({ label: 'Idle today', value: e.idleMinutes + ' min', sub: e.behaviour === 'idle' ? 'Currently idle' : 'Recorded idle time', icon: 'pause', tone: e.idleMinutes >= 30 ? 'text-warning' : '' }),
      UI.kpiTile({ label: 'Attendance rate', value: rateFromHistory(hist) + '%', sub: 'Last 30 days', icon: 'calendar' }),
      UI.kpiTile({ label: 'Presence score', value: String(e.score), sub: 'Out of 100', icon: 'star' }));

    var tl = D.timeline[id] || [];
    $('#pf-timeline').replaceChildren.apply($('#pf-timeline'), tl.length ? tl.map(timelineItem) : [UI.emptyState('No activity recorded today.', 'clock')]);

    var apps = D.appUsage[id] || [];
    $('#pf-apps').replaceChildren.apply($('#pf-apps'), apps.length ? apps.map(function (a) {
      return h('div', {},
        h('div', { class: 'flex justify-between text-sm mb-1' }, h('span', { text: a.app }), h('span', { class: 'num font-semibold', text: a.pct + '%' })),
        h('progress', { class: 'progress progress-primary w-full', attrs: { value: a.pct, max: 100, 'aria-label': a.app + ' ' + a.pct + '%' } }));
    }) : [UI.emptyState('No application usage recorded today.', 'monitor')]);

    $('#pf-heat').replaceChildren.apply($('#pf-heat'), heatCells(hist));
  }

  function bindProfileTabs() {
    $$('#pf-tabs [data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('#pf-tabs [data-tab]').forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('tab-active', on);
          t.setAttribute('aria-selected', String(on));
        });
        $$('[data-view="profile"] [data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== tab.dataset.tab; });
      });
    });
  }

  // ------------------------------------------------------------ directory
  function renderDirectory() {
    var host = $('#dir-status');
    if (!host) return; // removed for read-only sessions
    var d = D.meta.directory;
    function row(label, done, total) {
      return h('div', {},
        h('div', { class: 'flex justify-between text-sm mb-1' }, h('span', { text: label }), h('span', { class: 'num font-semibold', text: done + ' / ' + total })),
        h('progress', { class: 'progress progress-primary w-full', attrs: { value: done, max: total } }));
    }
    host.replaceChildren(
      row('Accounts synced', d.usersSynced, d.usersTotal),
      row('Groups mapped', d.groupsMapped, d.groupsTotal),
      row('Departments', D.departments.length, D.departments.length),
      h('div', { class: 'alert alert-success alert-soft text-sm' }, UI.icon('check', 'size-4'),
        h('span', { text: 'Last sync ' + (d.lastSyncMinutesAgo ? d.lastSyncMinutesAgo + ' min ago' : 'just now') + ' · next in ' + (d.syncIntervalMinutes - d.lastSyncMinutesAgo) + ' min' })));
    var cfg = {
      Directory: { Domain: d.domain, LdapPath: d.ldapPath, UseLdaps: true, ServiceAccount: d.serviceAccount, ServicePassword: '<from secret store>', SyncIntervalMinutes: d.syncIntervalMinutes },
    };
    $('#dir-config').textContent = '// Program.cs — Windows authentication\nbuilder.Services\n  .AddAuthentication(NegotiateDefaults.AuthenticationScheme)\n  .AddNegotiate();\n\n// appsettings.json\n' + JSON.stringify(cfg, null, 2);
  }

  // ------------------------------------------------------------ reports
  function rating(e) {
    if (e.score >= 90) return ['Excellent', 'badge-success'];
    if (e.score >= 78) return ['Good', 'badge-info'];
    return ['Needs attention', 'badge-warning'];
  }
  function renderReports() {
    var tbody = $('#rep-tbody');
    tbody.replaceChildren.apply(tbody, D.employees.map(function (e) {
      var r = rating(e);
      return h('tr', {},
        h('td', {}, h('div', { class: 'flex items-center gap-2' }, UI.avatar(e.initials, 'w-7 text-[0.65rem]'), h('span', { class: 'font-medium', text: e.name }))),
        h('td', { text: deptName[e.departmentId] }),
        h('td', { class: 'text-right num', text: e.month.daysPresent + ' / ' + e.month.workingDays }),
        h('td', { class: 'text-right num', text: String(e.month.workingDays - e.month.daysPresent) }),
        h('td', { class: 'text-right num', text: e.month.avgCheckIn }),
        h('td', { class: 'text-right num', text: e.month.avgHours.toFixed(1) + 'h' }),
        h('td', { class: 'text-right num', text: e.month.idlePct + '%' }),
        h('td', {}, h('span', { class: 'badge badge-soft badge-sm ' + r[1], text: r[0] })));
    }));
  }
  var REPORTS = {
    daily: function () {
      return ['presencehub-daily-' + D.meta.asOf + '.csv', ['Employee', 'Department', 'Status', 'Check-in', 'Check-out', 'Minutes', 'Idle minutes'],
        D.employees.map(function (e) { return [e.name, deptName[e.departmentId], e.status, e.checkIn || '', e.checkOut || '', e.minutesToday, e.idleMinutes]; })];
    },
    monthly: function () {
      return ['presencehub-monthly-' + D.meta.asOf.slice(0, 7) + '.csv', ['Employee', 'Department', 'Days present', 'Working days', 'Avg check-in', 'Avg hours', 'Idle %', 'Score'],
        D.employees.map(function (e) { return [e.name, deptName[e.departmentId], e.month.daysPresent, e.month.workingDays, e.month.avgCheckIn, e.month.avgHours, e.month.idlePct, e.score]; })];
    },
    departments: function () {
      return ['presencehub-departments-' + D.meta.asOf + '.csv', ['Department', 'Headcount', 'Present today', 'Attendance %'],
        deptStats().map(function (d) { return [d.name, d.headcount, d.present, d.pct]; })];
    },
    late: function () {
      var rows = [];
      D.employees.forEach(function (e) {
        (D.attendanceHistory[e.id] || []).forEach(function (d) {
          if (d.status === 'late' || d.status === 'absent') rows.push([d.date, e.name, deptName[e.departmentId], d.status, d.checkIn || '']);
        });
      });
      rows.sort(function (a, b) { return a[0] < b[0] ? 1 : -1; });
      return ['presencehub-late-absences-' + D.meta.asOf + '.csv', ['Date', 'Employee', 'Department', 'Type', 'Check-in'], rows];
    },
  };
  function bindReports() {
    $$('[data-report]').forEach(function (b) {
      b.addEventListener('click', UI.guarded(function () {
        var spec = REPORTS[b.dataset.report];
        if (!spec) return;
        var r = spec();
        UI.downloadCsv(r[0], r[1], r[2]);
        UI.toast('Exported ' + r[0], 'success');
      }));
    });
  }

  // ------------------------------------------------------------ boot
  function start(data) {
    D = data;
    D.departments.forEach(function (d) { deptName[d.id] = d.name; });
    simClock = UI.toMinutes(D.meta.asOfTime);
    setBind('as-of', 'As of ' + UI.dateLabel(D.meta.asOf) + ' · ' + D.meta.asOfTime);

    renderKpis();
    renderActivity();
    renderStatusLegend();
    buildCharts();
    bindEmployees();
    bindProfileTabs();
    renderDirectory();
    renderReports();
    bindReports();

    var sim = $('#btn-simulate');
    sim.addEventListener('click', UI.guarded(simulateCheckIn));
    var syncNow = $('#btn-sync-now');
    if (syncNow) syncNow.addEventListener('click', UI.guarded(runSync));

    window.addEventListener('hashchange', route);
    route();
  }

  function load() {
    var state = $('#load-state');
    state.replaceChildren(h('div', { class: 'grid gap-4 md:grid-cols-2' }, UI.skeleton(4), UI.skeleton(4)));
    window.PH_DATA.load().then(function (data) {
      state.replaceChildren();
      start(data);
    }).catch(function () {
      state.replaceChildren(UI.errorState('Could not load the demo data.', function () { location.reload(); }));
    });
  }

  UI.initShell();
  if (!UI.can('edit')) {
    $('#role-banner').replaceChildren(h('div', { class: 'alert alert-info alert-soft mb-6 text-sm', attrs: { role: 'status' } },
      UI.icon('eye', 'size-4'), h('span', { text: 'Read-only account: dashboards are visible, actions such as simulate, sync and export are disabled.' })));
  }
  load();
})();
