# PresenceHub — Remote Work Attendance Tracker

An attendance and activity platform for remote and hybrid teams. It has two views: an admin console for managers and a self-service page for employees. It's a static demo with no build step, running on mock JSON data.

## Features

### Admin console (`index.html`)
- Live overview: who's online, hourly activity, department breakdown and activity feed.
- Employee directory with filters, sorting and paging.
- Employee profile with daily timeline, app usage and a 30-day attendance calendar.
- Directory-sync settings page (sample configuration).
- Reports with trend charts and CSV export.

### Employee view (`user.html`)
- Today: live clock, work timer, check-in/out and timeline.
- My attendance: weekly grid and full history.
- My score: productivity ring, 30-day trend and comparison with the department.
- Notifications.

## Run

```bash
npx serve .
# open http://localhost:3000/login.html
```

Use localhost or https, because the login uses the browser's WebCrypto API. In Chrome, the pages also work when opened directly from disk.

After editing anything in `data/`, rebuild the offline bundle:

```bash
node tools/build-data-bundle.mjs
```

## Demo access
There are two roles: `admin` (full access) and `viewer` (read-only). Ask the project owner for the credentials.

> With no backend, the login is a demo access gate rather than production security.

## Tech
HTML · vanilla JavaScript modules · Tailwind CSS · DaisyUI · Chart.js · Content-Security-Policy with SRI-pinned CDNs · PBKDF2-hashed credentials (WebCrypto)
