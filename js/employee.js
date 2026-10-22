// PresenceHub employee self-service view (user.html).
(function () {
  'use strict';

  var UI = window.PH_UI;
  var h = UI.h, $ = UI.$, $$ = UI.$$;

  var VIEWS = { today: 'Today', attendance: 'My attendance', score: 'My score', notifications: 'Notifications' };
  var D = null, me = null, hist = [], weeks = [], weekIdx = 0;
  var workedSeconds = 0, checkedIn = false;
  var charts = {};

  // ------------------------------------------------------------ routing
  function route() {
    var v = location.hash.replace(/^#/, '');
    var view = VIEWS[v] ? v : 'today';
    $$('[data-view]').forEach(function (s) { s.hidden = s.dataset.view !== view; });
    $$('[data-nav]').forEach(function (a) {
      var on = a.dataset.nav === view;
      a.classList.toggle('menu-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#page-title').textContent = VIEWS[view];
    $('#crumb').textContent = VIEWS[view];
    document.title = VIEWS[view] + ' · PresenceHub';
    Object.keys(charts).forEach(function (k) { if (charts[k] && charts[k].instance) charts[k].instance.resize(); });
    window.scrollTo(0, 0);
  }

  function setBind(name, value) { $$('[data-bind="' + name + '"]').forEach(function (el) { el.textContent = value; }); }
  function firstName() { return me.name.split(' ')[0]; }

  // ------------------------------------------------------------ today
  function greeting() {
    var m = UI.toMinutes(D.meta.asOfTime);
    return (m < 720 ? 'Good morning' : m < 1080 ? 'Good afternoon' : 'Good evening') + ', ' + firstName();
  }
  function renderStatus() {
    var pill = checkedIn
      ? h('span', { class: 'badge badge-success badge-soft gap-1.5' }, h('span', { class: 'live-dot', attrs: { 'aria-hidden': 'true' } }), 'Working · checked in ' + me.checkIn)
      : h('span', { class: 'badge badge-ghost gap-1.5' }, h('span', { class: 'status status-neutral', attrs: { 'aria-hidden': 'true' } }), me.checkOut ? 'Checked out ' + me.checkOut : 'Not checked in');
    $('#work-status').replaceChildren(pill);
    var btn = $('#btn-check');
    btn.className = 'btn ' + (checkedIn ? 'btn-outline btn-error' : 'btn-primary');
    btn.replaceChildren(UI.icon(checkedIn ? 'stop' : 'play', 'size-4'), checkedIn ? 'Check out' : 'Check in');
  }
  function tickTimer() {
    if (checkedIn) workedSeconds += 1;
    var s = workedSeconds;
    $('#work-timer').textContent = UI.pad(Math.floor(s / 3600)) + ':' + UI.pad(Math.floor((s % 3600) / 60)) + ':' + UI.pad(s % 60);
  }
  function tickClock() {
    var now = new Date();
    $('#clock').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    $('#clock-date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · local time';
  }
  function toggleCheck() {
    var t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    checkedIn = !checkedIn;
    if (checkedIn) { me.checkIn = me.checkIn || t; me.checkOut = null; } else { me.checkOut = t; }
    renderStatus();
    UI.toast((checkedIn ? 'Checked in at ' : 'Checked out at ') + t + ' (demo only, not saved).', 'success');
  }

  function weekToDateMinutes() {
    var today = hist[hist.length - 1];
    var d = new Date(today.date + 'T12:00:00');
    var dow = (d.getDay() + 6) % 7;
    return hist.slice(hist.length - 1 - dow).reduce(function (s, x) { return s + x.minutes; }, 0);
  }

  var TL_STYLE = {
    'check-in': ['login', 'bg-success text-success-content'],
    active: ['monitor', 'bg-primary text-primary-content'],
    idle: ['pause', 'bg-warning text-warning-content'],
    locked: ['lock', 'bg-base-300 text-base-content'],
    'check-out': ['logout', 'bg-secondary text-secondary-content'],
  };
  function renderToday() {
    setBind('today-date', UI.dateLabel(D.meta.asOf, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    $('#greeting').textContent = greeting();
    $('#emp-role').textContent = me.title + ' · ' + D.departments.find(function (d) { return d.id === me.departmentId; }).name;
    renderStatus();
    tickTimer();

    var late = UI.toMinutes(me.checkIn) > 9 * 60 + 30;
    $('#today-kpis').replaceChildren(
      UI.kpiTile({ label: 'Check-in', value: me.checkIn || '—', sub: me.checkIn ? (late ? 'Late arrival' : 'On time') : 'Not yet', icon: 'login', tone: late ? 'text-warning' : '' }),
      UI.kpiTile({ label: 'Idle today', value: me.idleMinutes + ' min', sub: 'Idle periods over 5 min', icon: 'pause' }),
      UI.kpiTile({ label: 'Week to date', value: UI.hoursDecimal(weekToDateMinutes()), sub: 'Target 40h', icon: 'calendar' }),
      UI.kpiTile({ label: "Today's score", value: String(me.score), sub: 'Department avg ' + D.scores.departmentAverage, icon: 'star' }));

    var tl = D.timeline[me.id] || [];
    $('#today-timeline').replaceChildren.apply($('#today-timeline'), tl.length ? tl.map(function (t) {
      var st = TL_STYLE[t.type] || TL_STYLE.active;
      var when = t.end ? t.start + ' – ' + t.end : (t.type === 'active' ? 'since ' + t.start : t.start);
      var dur = t.end ? UI.minutesLabel(UI.toMinutes(t.end) - UI.toMinutes(t.start)) : null;
      return h('li', { class: 'relative flex gap-4' },
        h('span', { class: 'relative z-10 grid place-items-center size-8 rounded-full shrink-0 ' + st[1] }, UI.icon(st[0], 'size-4')),
        h('div', { class: 'pt-1' }, h('p', { class: 'text-sm font-semibold', text: t.label }), h('p', { class: 'text-xs text-muted num', text: when + (dur ? ' · ' + dur : '') })));
    }) : [UI.emptyState('No activity recorded today.', 'clock')]);

    var apps = D.appUsage[me.id] || [];
    charts.apps = UI.chart($('#chart-apps'), function (p) {
      var colors = [p.primary, UI.alpha(p.primary, 0.6), p.accent, p.secondary, UI.alpha(p.secondary, 0.5), UI.alpha(p.muted, 0.3)];
      return {
        type: 'doughnut',
        data: { labels: apps.map(function (a) { return a.app; }), datasets: [{ data: apps.map(function (a) { return a.pct; }), backgroundColor: colors, borderColor: p.surface, borderWidth: 2 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: function (c) { return c.label + ': ' + c.parsed + '%'; } } } },
        },
      };
    });
  }

  // ------------------------------------------------------------ attendance
  var STATUS_BADGE = {
    present: ['Present', 'badge-success'], late: ['Late', 'badge-warning'], absent: ['Absent', 'badge-error'],
    leave: ['Leave', 'badge-info'], today: ['Today', 'badge-primary'], weekend: ['Weekend', 'badge-ghost'], upcoming: ['Upcoming', 'badge-ghost'],
  };
  function badgeFor(status) {
    var b = STATUS_BADGE[status] || STATUS_BADGE.present;
    return h('span', { class: 'badge badge-soft badge-sm ' + b[1], text: b[0] });
  }

  function buildWeeks() {
    var out = [], cur = null;
    hist.forEach(function (d) {
      var dt = new Date(d.date + 'T12:00:00');
      if (!cur || (dt.getDay() + 6) % 7 === 0) { cur = []; out.push(cur); }
      cur.push(d);
    });
    // pad the last week with upcoming days
    var last = out[out.length - 1];
    while (last.length < 7) {
      var prev = new Date(last[last.length - 1].date + 'T12:00:00');
      prev.setDate(prev.getDate() + 1);
      var iso = prev.getFullYear() + '-' + UI.pad(prev.getMonth() + 1) + '-' + UI.pad(prev.getDate());
      var dow = prev.getDay();
      last.push({ date: iso, status: dow === 0 || dow === 6 ? 'weekend' : 'upcoming', checkIn: null, checkOut: null, minutes: 0, idleMinutes: 0 });
    }
    return out;
  }

  function renderWeek() {
    var w = weeks[weekIdx];
    $('#week-label').textContent = UI.dateLabel(w[0].date, { day: 'numeric', month: 'short' }) + ' – ' + UI.dateLabel(w[w.length - 1].date, { day: 'numeric', month: 'short' });
    $('#week-prev').disabled = weekIdx === 0;
    $('#week-next').disabled = weekIdx === weeks.length - 1;
    $('#week-grid').replaceChildren.apply($('#week-grid'), w.map(function (d) {
      var dim = d.status === 'weekend' || d.status === 'upcoming';
      return h('div', { class: 'rounded-box border p-3 text-center ' + (d.status === 'today' ? 'border-primary bg-primary/5' : 'border-base-300') + (dim ? ' opacity-60' : '') },
        h('p', { class: 'text-xs uppercase tracking-wide text-muted', text: UI.dateLabel(d.date, { weekday: 'short' }) }),
        h('p', { class: 'text-2xl font-bold num my-1', text: String(Number(d.date.slice(8))) }),
        badgeFor(d.status),
        h('p', { class: 'text-xs text-muted num mt-1.5', text: d.minutes ? UI.minutesLabel(d.minutes) + (d.status === 'today' ? ' so far' : '') : (d.checkIn ? d.checkIn : ' ') }));
    }));
  }

  function renderAttendance() {
    var work = hist.filter(function (d) { return d.status !== 'weekend'; });
    var attended = work.filter(function (d) { return ['present', 'late', 'today'].indexOf(d.status) >= 0; });
    var counted = work.filter(function (d) { return d.status !== 'leave'; });
    var totalMin = hist.reduce(function (s, d) { return s + d.minutes; }, 0);
    var ins = attended.map(function (d) { return UI.toMinutes(d.checkIn); });
    var avgIn = ins.length ? Math.round(ins.reduce(function (a, b) { return a + b; }, 0) / ins.length) : 0;
    $('#att-kpis').replaceChildren(
      UI.kpiTile({ label: 'Days attended', value: attended.length + ' / ' + counted.length, sub: 'Working days, last 30 days', icon: 'calendar' }),
      UI.kpiTile({ label: 'Total hours', value: Math.round(totalMin / 60) + 'h', sub: 'Last 30 days', icon: 'clock' }),
      UI.kpiTile({ label: 'Avg check-in', value: UI.fromMinutes(avgIn), sub: 'Core hours start 10:00', icon: 'login' }),
      UI.kpiTile({ label: 'Attendance rate', value: Math.round((attended.length / counted.length) * 100) + '%', sub: 'Leave days excluded', icon: 'trend' }));

    weeks = buildWeeks();
    weekIdx = weeks.length - 1;
    renderWeek();

    var tbody = $('#log-tbody');
    tbody.replaceChildren.apply(tbody, work.slice().reverse().map(function (d) {
      return h('tr', {},
        h('td', { class: 'font-medium', text: UI.dateLabel(d.date, { weekday: 'short', day: 'numeric', month: 'short' }) }),
        h('td', { class: 'text-right num', text: d.checkIn || '—' }),
        h('td', { class: 'text-right num', text: d.checkOut || '—' }),
        h('td', { class: 'text-right num font-semibold', text: d.minutes ? UI.minutesLabel(d.minutes) : '—' }),
        h('td', { class: 'text-right num', text: d.idleMinutes ? d.idleMinutes + 'm' : '—' }),
        h('td', {}, badgeFor(d.status)));
    }));
  }

  // ------------------------------------------------------------ score
  function renderScore() {
    var s = D.scores;
    var radial = h('div', { class: 'radial-progress text-primary font-extrabold text-3xl num', attrs: { role: 'progressbar', 'aria-valuenow': s.current, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Presence score' } }, String(s.current));
    radial.style.setProperty('--value', String(s.current));
    radial.style.setProperty('--size', '9rem');
    radial.style.setProperty('--thickness', '0.75rem');
    var diff = s.current - s.departmentAverage;
    $('#score-hero').replaceChildren(
      radial,
      h('h2', { class: 'text-lg font-bold mt-3', text: diff >= 0 ? 'Great work, ' + firstName() : 'Keep going, ' + firstName() }),
      h('p', { class: 'text-sm text-muted', text: 'Department average is ' + s.departmentAverage + ' (' + (diff >= 0 ? '+' : '') + diff + ').' }),
      h('ul', { class: 'w-full mt-4 space-y-3 text-left' }, s.breakdown.map(function (b) {
        return h('li', {},
          h('div', { class: 'flex justify-between text-sm mb-1' }, h('span', { text: b.label + (b.lowerIsBetter ? ' (lower is better)' : '') }), h('span', { class: 'num font-semibold', text: b.value + '%' })),
          h('progress', { class: 'progress w-full ' + (b.lowerIsBetter ? 'progress-warning' : 'progress-primary'), attrs: { value: b.value, max: 100, 'aria-label': b.label } }));
      })));

    charts.score = UI.chart($('#chart-score'), function (p) {
      return {
        type: 'line',
        data: {
          labels: s.trend.map(function (t) { return UI.dateLabel(t.date, { day: 'numeric', month: 'short' }); }),
          datasets: [
            { label: 'Your score', data: s.trend.map(function (t) { return t.score; }), borderColor: p.primary, backgroundColor: UI.alpha(p.primary, 0.12), fill: true, tension: 0.3, pointRadius: 2 },
            { label: 'Department average', data: s.trend.map(function () { return s.departmentAverage; }), borderColor: p.muted, borderDash: [6, 4], pointRadius: 0, fill: false },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } },
          scales: { y: { suggestedMin: 60, max: 100, grid: { color: p.grid } }, x: { grid: { display: false } } },
        },
      };
    });
    charts.compare = UI.chart($('#chart-compare'), function (p) {
      return {
        type: 'bar',
        data: {
          labels: s.comparisons.map(function (c) { return c.label; }),
          datasets: [
            { label: 'You', data: s.comparisons.map(function (c) { return c.you; }), backgroundColor: p.primary, borderRadius: 4, maxBarThickness: 14 },
            { label: 'Department', data: s.comparisons.map(function (c) { return c.department; }), backgroundColor: UI.alpha(p.secondary, 0.4), borderRadius: 4, maxBarThickness: 14 },
          ],
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + c.parsed.x + '%'; } } } },
          scales: { x: { min: 0, max: 100, ticks: { callback: function (v) { return v + '%'; } }, grid: { color: p.grid } }, y: { grid: { display: false } } },
        },
      };
    });
  }

  // ------------------------------------------------------------ notifications
  var NOTIF_STYLE = { success: ['check', 'bg-success/15 text-success'], warning: ['alert', 'bg-warning/15 text-warning'], info: ['report', 'bg-info/15 text-info'], milestone: ['star', 'bg-accent/40 text-accent-content'], policy: ['bell', 'bg-base-300 text-base-content'] };
  function renderNotifications() {
    var unread = D.notifications.filter(function (n) { return n.unread; }).length;
    setBind('unread-count', unread ? String(unread) : '');
    $('#notif-summary').textContent = unread ? unread + ' unread of ' + D.notifications.length : 'All caught up';
    var list = $('#notif-list');
    list.replaceChildren.apply(list, D.notifications.map(function (n) {
      var st = NOTIF_STYLE[n.kind] || NOTIF_STYLE.info;
      var when = new Date(n.at);
      var item = h('li', {},
        h('button', { class: 'w-full text-left flex gap-3 py-3 px-2 rounded-box hover:bg-base-200', attrs: { type: 'button', 'aria-label': (n.unread ? 'Unread: ' : '') + n.title } },
          h('span', { class: 'mt-2 size-2 rounded-full shrink-0 ' + (n.unread ? 'bg-primary' : 'bg-transparent'), attrs: { 'aria-hidden': 'true' } }),
          h('span', { class: 'grid place-items-center size-9 rounded-lg shrink-0 ' + st[1] }, UI.icon(st[0], 'size-4')),
          h('span', { class: 'flex-1 min-w-0' },
            h('span', { class: 'block text-sm ' + (n.unread ? 'font-semibold' : ''), text: n.title }),
            h('span', { class: 'block text-sm text-muted', text: n.body }),
            h('time', { class: 'block text-xs text-muted mt-1', text: when.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), attrs: { datetime: n.at } }))));
      item.firstChild.addEventListener('click', UI.guarded(function () {
        if (!n.unread) return;
        n.unread = false;
        renderNotifications();
      }));
      return item;
    }));
  }

  // ------------------------------------------------------------ tabs
  function bindTabs() {
    $$('#att-tabs [data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('#att-tabs [data-tab]').forEach(function (t) { var on = t === tab; t.classList.toggle('tab-active', on); t.setAttribute('aria-selected', String(on)); });
        $$('[data-view="attendance"] [data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== tab.dataset.tab; });
        $('#week-nav').classList.toggle('invisible', tab.dataset.tab !== 'week');
      });
    });
    $('#week-prev').addEventListener('click', function () { if (weekIdx > 0) { weekIdx -= 1; renderWeek(); } });
    $('#week-next').addEventListener('click', function () { if (weekIdx < weeks.length - 1) { weekIdx += 1; renderWeek(); } });
  }

  // ------------------------------------------------------------ boot
  function start(data) {
    D = data;
    me = D.employees.find(function (e) { return e.id === D.meta.featuredEmployeeId; });
    if (!me) throw new Error('Featured employee missing');
    hist = D.attendanceHistory[me.id] || [];
    checkedIn = !!me.checkIn && !me.checkOut;
    workedSeconds = me.minutesToday * 60;
    setBind('emp-name', me.name);

    renderToday();
    renderAttendance();
    renderScore();
    renderNotifications();
    bindTabs();

    $('#btn-check').addEventListener('click', UI.guarded(toggleCheck));
    $('#btn-mark-all').addEventListener('click', UI.guarded(function () {
      D.notifications.forEach(function (n) { n.unread = false; });
      renderNotifications();
      UI.toast('All notifications marked as read.', 'success');
    }));

    tickClock();
    setInterval(tickClock, 1000);
    setInterval(tickTimer, 1000);
    window.addEventListener('hashchange', route);
    route();
  }

  UI.initShell();
  if (!UI.can('edit')) {
    $('#role-banner').replaceChildren(h('div', { class: 'alert alert-info alert-soft mb-6 text-sm', attrs: { role: 'status' } },
      UI.icon('eye', 'size-4'), h('span', { text: 'Read-only account: check-in/out and notification changes are disabled.' })));
  }
  var state = $('#load-state');
  state.replaceChildren(UI.skeleton(5));
  window.PH_DATA.load().then(function (data) {
    state.replaceChildren();
    start(data);
  }).catch(function () {
    state.replaceChildren(UI.errorState('Could not load the demo data.', function () { location.reload(); }));
  });
})();
