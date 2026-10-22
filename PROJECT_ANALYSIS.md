# PresenceHub — Project Analysis

## Purpose

PresenceHub is a static portfolio demo of an **attendance intelligence** product for hybrid teams:

- **Admin console** (`index.html`) — live presence overview, employee directory, per-employee profile, directory (LDAP/AD) sync settings, reports/exports and the delivery roadmap.
- **Employee self-service view** (`user.html`) — today's status and timer, personal attendance history, presence score and notifications.

There is no backend. All data is mock JSON; all "actions" (simulate check-in, sync, check-in/out, mark read) change in-memory state only. CSV exports are generated in the browser.

## Stack

| Layer | Choice |
|---|---|
| Markup | Static HTML5, three pages (`login.html`, `index.html`, `user.html`) |
| Styling | Tailwind CSS browser build `@tailwindcss/browser@4.1.11` + DaisyUI `5.0.43` (jsDelivr, pinned, SRI) with custom themes `presence-light` / `presence-dark` in `css/app.css` |
| Charts | Chart.js `4.4.1` (cdnjs, pinned, SRI) |
| Fonts | Google Fonts: Plus Jakarta Sans, JetBrains Mono |
| Scripts | Vanilla ES5-style IIFEs in `js/` (no build step), event listeners only |
| Auth | WebCrypto PBKDF2-SHA256 (310 000 iterations, 16-byte salt) against hashes in `js/auth-config.js`; session in `sessionStorage` |
| Data | `data/*.json` loaded by `js/data.js`; `js/data.bundle.js` fallback for `file://` |
| Tooling | Node 18+ scripts in `tools/` (bundle builder, password hasher) |

## How to run

```
npx serve .            # then open http://localhost:3000/login.html
node tools/build-data-bundle.mjs   # after editing data/*.json
```

Credentials are in `CREDENTIALS.md` (not committed).

## File map

```
login.html            entry point / sign-in
index.html            admin console (guarded)
user.html             employee view (guarded)
css/app.css           DaisyUI custom themes, heatmap, timeline rail, focus/motion rules
assets/favicon.svg    logo mark
js/boot.js            <head> script: theme before paint + session guard/redirect
js/auth-config.js     account hashes (no plaintext)
js/login.js           PBKDF2 verification, throttling, safe redirect
js/ui.js              shared DOM builder, icons, KPI tile, badges, toasts, chart + CSV helpers, role gating
js/data.js            data loader (fetch -> bundle fallback)
js/data.bundle.js     GENERATED from data/*.json
js/admin.js           admin console views
js/employee.js        employee views
data/*.json           mock datasets
tools/build-data-bundle.mjs   regenerates js/data.bundle.js
tools/hash-password.mjs       creates an auth-config entry (random 14-char password if none given)
CREDENTIALS.md        plaintext demo credentials (git-ignored)
```

## Screens

**Login** — brand panel + form; friendly messages for sign-in required / expired / signed out; secure-context check.

**Admin console** (hash routes, sidebar drawer):

| Route | Job | Content |
|---|---|---|
| `#overview` | Overview (bento) | 4 KPI tiles · check-ins/outs by hour (bar) · live activity feed · department attendance (horizontal bar) · presence status (doughnut + legend) · *Simulate check-in* |
| `#employees?dept=&status=&q=` | List | Filter bar synced to URL · sortable, paged table · *Sync directory* |
| `#profile/<id>` | Detail | Entity header + employee picker · 4 KPIs · tabs: timeline / app usage / 30-day calendar heatmap |
| `#directory` | Settings (admin only) | Integration steps · sync status · sample config (placeholder `example.local`) · *Run sync now* |
| `#reports` | Analytics | 30-day attendance-rate trend (line) · 4 CSV exports · monthly overview table |
| `#roadmap` | Info | Phase timeline · reference stack |

**Employee view**: `#today` (greeting, live clock, worked-today timer, check in/out, KPIs, activity timeline, app-usage doughnut), `#attendance` (KPIs, week cards with prev/next, daily log table), `#score` (radial score + breakdown, 30-day score line vs department average, you-vs-department grouped bars), `#notifications` (unread markers, mark read / mark all read).

## Data shapes (`data/*.json`)

| File | Shape |
|---|---|
| `meta.json` | `{ product, asOf, asOfTime, featuredEmployeeId, directory: { domain, ldapPath, serviceAccount, syncIntervalMinutes, lastSyncMinutesAgo, usersSynced, usersTotal, groupsMapped, groupsTotal } }` |
| `employees.json` | 40 × `{ id, name, initials, title, departmentId, email, directoryAccount, status: online/away/offline, checkIn, checkOut, minutesToday, behaviour: active/idle/checked-out/absent, idleMinutes, score, month: { daysPresent, workingDays, avgCheckIn, avgHours, idlePct } }` |
| `departments.json` | 6 × `{ id, name, headcount, presentToday, attendancePct }` |
| `hourly.json` | `{ hours[], checkIns[], checkOuts[] }` (07:00–18:00) |
| `activities.json` | `[{ id, type: check-in/check-out/idle/resume/sync, employeeId|null, text, minutesAgo }]` |
| `timeline.json` | `{ [employeeId]: [{ type: check-in/active/idle/locked/check-out, label, start, end|null }] }` |
| `app-usage.json` | `{ [employeeId]: [{ app, pct }] }` |
| `attendance-history.json` | `{ [employeeId]: 30 × { date, status: present/late/absent/leave/weekend/today, checkIn, checkOut, minutes, idleMinutes } }` |
| `notifications.json` | `[{ id, unread, kind: success/warning/info/milestone/policy, title, body, at }]` |
| `scores.json` | `{ employeeId, current, departmentAverage, trend: [{date, score}], breakdown: [{key, label, value, lowerIsBetter?}], comparisons: [{label, you, department}] }` |

All names are generated fictional combinations (e.g. "Gideon Coldbrook"); emails use `example.com`, directory accounts use `EXAMPLE\`.

## BEFORE findings (original state)

1. **Branding / identity traces** — product called "RemoteTrack"; a real-looking personal name was hard-coded as the profile and self-service user, with a matching company email and a `DOMAIN\user` account; other realistic personal names throughout the tables, feed and simulate list.
2. **Infrastructure-looking sample** — appsettings snippet used a corporate-style domain, LDAP DN and a named service account.
3. **XSS sinks** — about 18 places built HTML with template strings and assigned them to the element's inner-HTML property (tables, feeds, timelines, toasts, notifications); the admin toast rendered its message as HTML.
4. **Inline handlers** — inline click attributes on nearly every button, preventing a strict CSP.
5. **Global `event` bug** — the admin tab switcher read the implicit global `event` (fails in Firefox / strict contexts).
6. **No access control** — anyone opening the files saw everything; no roles.
7. **Hard-coded data** — all data inline in `<script>` blocks; heatmaps used `Math.random()` on each load (non-deterministic).
8. **No CSP, no SRI, unpinned fonts**; one large inline `<style>` + `<script>` per page; no favicon.
9. **UX** — no dark/light toggle, no responsive layout (fixed 4-column grids), no loading/empty/error states, decorative emoji icons, colour-only status, "Export" buttons that did nothing, stale dates (2025).

## Transformation (completed)

**Identity / traces**
- Renamed to **PresenceHub** everywhere (titles, logo, docs, CSV filenames); new inline SVG logo + `assets/favicon.svg`.
- All personal names replaced with generated fictional names from `data/employees.json`; `example.com` emails; `EXAMPLE\` accounts; AD sample now `example.local` / `LDAP://DC=example,DC=local` / `svc_presencehub` with a `<from secret store>` password placeholder.

**Data**
- 10 JSON datasets in `data/` (40 employees, 6 departments, hourly, activities, per-employee timeline and app usage, 30-day history for every employee, notifications, scores, meta). Deterministic — no random values at render time.
- `js/data.js` fetches JSON over http(s); on `file://` or fetch failure it loads `js/data.bundle.js` (`window.__DATA__`). Regenerate with `node tools/build-data-bundle.mjs`.

**Auth**
- `login.html` is the entry; `js/boot.js` (first script in `<head>` of every page) redirects to login when the session is missing/expired, and reveals the app shell only after the check.
- Accounts `admin` and `viewer`, random 14-character passwords generated with Node `crypto`; only salt + PBKDF2-SHA256 (310 000 iterations) hashes in `js/auth-config.js`; plaintext only in git-ignored `CREDENTIALS.md`.
- Verification with WebCrypto `deriveBits`, constant-time compare, decoy hashing for unknown usernames, 5-attempt / 30-second lockout, `next` redirect restricted to an allow-list.
- Session `{ user, role, iat, exp }` in `sessionStorage`, 120-minute expiry, checked on load and every 30 s.
- **viewer** role: read-only. Directory page + nav item removed, `#directory` route redirected; simulate check-in, directory sync, CSV exports, check-in/out and notification changes are disabled (and their handlers re-check the role).
- Secure-context note: `crypto.subtle` needs https or http://localhost. Chrome/Edge also treat `file://` as secure, so the demo works when opened directly there; other browsers may not — the login page detects this and shows a friendly "serve the folder" message.

**UI (100 % new)**
- Tailwind 4 browser build + DaisyUI 5 with custom sky-blue / slate / soft-lime themes (light + dark), toggle stored in `localStorage` with `prefers-color-scheme` default, applied before paint.
- Drawer sidebar (collapses to off-canvas on mobile), sticky navbar with breadcrumb, theme toggle, account menu; page jobs per the portal-dashboard guidance: bento overview, table-first list with URL-synced filters/sort/paging, detail page with tabs, analytics page with trend + exports.
- Chart.js charts read theme tokens and re-render on theme change; ≥ 2 widget types per page; status shown as text + colour; skeleton / empty / error (with retry) states; focus rings; reduced-motion support; tabular numbers right-aligned.
- Shared components in `js/ui.js` (KPI tile, badges, avatar, toast, empty/error/skeleton, chart wrapper, CSV export).

**Security hardening**
- Every data value rendered with `createElement` / `textContent` / `setAttribute` (builder refuses `on*` attributes); containers reset with `replaceChildren()`; zero HTML-string sinks in the project.
- No inline scripts or handlers; all JS in external files using `addEventListener`; global `event` bug removed (hash router).
- CSP meta on every page: `default-src 'self'`; scripts only from self + `cdn.jsdelivr.net` (+ `cdnjs.cloudflare.com` on pages with charts); styles self + jsDelivr + Google Fonts; `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-src 'none'`.
- SRI (`sha384`) + `crossorigin="anonymous"` on the Tailwind, DaisyUI and Chart.js CDN files (exact pinned versions). Google Fonts CSS cannot carry SRI (response varies by user agent).
- `referrer` policy `no-referrer`; CSV export guards against spreadsheet formula injection; `URL.revokeObjectURL` after download.

**Known limits**
- `style-src 'unsafe-inline'` is required because the Tailwind browser build injects a generated `<style>` element (a production build would compile CSS ahead of time and drop it).
- `frame-ancestors` and other header-only protections cannot be set from a meta tag; add them as HTTP headers when hosting.
- Client-side auth is a demo access gate only: anyone can read the static files or edit `sessionStorage`.

**Verification**
- `node --check` on every `js/*.js` and `tools/*.mjs`: pass.
- Headless Chrome run over `npx serve` (admin and viewer: every route of both pages, simulate, theme toggle, logout, wrong password) and over `file://`: no console errors, warnings or failed requests.
- Grep for former names/hosts, inline click attributes and inner-HTML sinks: no hits.
