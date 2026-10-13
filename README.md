# Untitled Judge

A self-hosted online judge for **C17**, **C++17**, and **Python 3**, built for a programming class. Students browse problem sets, read PDF statements, submit code, and get per-testcase verdicts from a sandboxed grader — plus accounts, points, profiles, friends, and a forum.

Live instance: <https://untitledjudgeweb.duckdns.org>

- **Zero dependencies** — plain Node.js (`node:http`, built-in `node:sqlite`) with a vanilla HTML/CSS/JS frontend.
- **Sandboxed grading** — every compile and testcase runs in a disposable, network-less Podman container.
- **Folder-based problems** — drop problem folders next to the server and they're indexed on startup.

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Adding problems](#adding-problems)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Security model](#security-model)
- [Project layout](#project-layout)
- [Credits](#credits)

## Features

**Problems & judging**
- Browse and search problems by their original module folders, inspect public samples, and open the supplied PDF statements.
- The `DP P1 all` folder is indexed as an additional PDF archive. Its statements are browseable; entries with verified testcase pairs can also be submitted to the judge.
- Submit from the separate **Submit Code** page. Type a problem code to select an exact match, or pick from matching judgeable problems when the code is partial or ambiguous (PDF-only archive entries are excluded).
- Submissions enter a FIFO queue: one job runs at a time, at most ten wait, with at most two outstanding per account.
- The judge reports a verdict for each matching `.in` / `.ans` pair, including secret tests. Hidden inputs and answers are never sent to the browser. Output comparison ignores whitespace between tokens.

**Accounts, points & profiles**
- Sign up or log in with **Google (Firebase Authentication)**, or create an account with a username, email, and password.
- When logging in without Google, the server sends an **email confirmation** (a 6-digit login code via SMTP, or a Firebase Email Link if SMTP is not configured). Registration logs you in immediately without blocking on email verification.
- Accepted solutions award points once per problem. Archive points rise with module number and set letter; FP problems are worth 300 points; administrators can assign custom problems 50–1000 points. Wrong answers and repeat accepts never subtract or add points.
- Public profiles show a Codeforces-inspired title (Newbie → Grandmaster), admin status, profile picture, friend count, per-set progress, points rank, and the latest 100 submissions.
- Upload a PNG, JPEG, GIF, or WebP profile picture (up to 1 MB). The account page shows creation date, activity totals, and lets existing users update their login email or link their Google account.
- Send, accept, decline, or cancel friend requests; remove friends from the account page.

**Community**
- Rate each problem 1–5 stars. Average ratings and counts appear in the archive table and on problem pages.
- A dedicated forum page with per-thread URLs and inline replies. Signed-in users can attach up to three images (1 MB each) per topic or reply; images are stored in SQLite and visible to anyone who can read the forum.

**UI**
- Light and dark themes, following the OS by default and remembered per browser.
- Code drafts are kept in the browser's local storage.

## Quick start

**Requirements**

- Node.js **22.13+** (for the built-in, unflagged `node:sqlite`)
- [Podman](https://podman.io/) (rootless recommended)

```bash
git clone https://github.com/Zal2024/judge.git
cd judge

# Build the grading sandbox image (gcc, g++, python3 on Ubuntu 24.04)
podman build -t untitled-judge-sandbox:latest judge-sandbox

# Start the server
node server.js
# → Untitled Judge Web is ready at http://127.0.0.1:4173
```

> [!NOTE]
> Problem sets are **not** included in this repository (secret testcases must stay private). Add your own as described below; the server starts fine with zero problems.

## Adding problems

The server scans its own directory on startup. Any folder containing a `problem.yaml` is treated as a problem:

```text
Modul 1/                     ← module (top-level folder)
└── A/                       ← set / group
    └── SetA1/               ← problem code
        ├── problem.yaml     ← must contain a  name: ...  line
        ├── problem.pdf      ← statement (required for the problem to be judgeable)
        └── data/
            ├── sample/      ← public samples, shown on the problem page
            │   ├── 1.in
            │   └── 1.ans
            └── secret/      ← hidden tests, judged but never sent to the browser
                ├── 1.in
                └── 1.ans
FP/<code>/...                ← "FP" practice problems (300 points each)
DP P1 all/
├── prob-Some Title.pdf      ← PDF-only archive entry
└── prob-Some Title/data/... ← optional testcases make it judgeable
```

Folders starting with `.` are skipped. Every `.in` needs a matching `.ans` in the same folder. Administrators can also create problems from the web UI; these are stored in the database.

## Configuration

Settings can be provided as environment variables, and **Firebase + SMTP** can also be configured live from the **Admin** tab in the web UI (persisted in SQLite):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | HTTP port (the server always binds to `127.0.0.1`) |
| `DATA_DIR` | `./.site-data` | Location of `untitled-judge.db` |
| `CONTAINER_RUNTIME` | `podman` | Container runtime binary |
| `JUDGE_SANDBOX_IMAGE` | `untitled-judge-sandbox:latest` | Image used for compiling and running submissions |
| `PUBLIC_ORIGIN` | _(empty)_ | Exact public origin, e.g. `https://judge.example.org` |
| `COOKIE_SECURE` | `false` | Set to `true` when served over HTTPS |
| `FIREBASE_API_KEY` | _(empty)_ | Firebase Web API key (enables Google Sign-In & Firebase Email Link) |
| `FIREBASE_AUTH_DOMAIN` | _(empty)_ | Firebase Auth domain, e.g. `your-app.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | _(empty)_ | Firebase Project ID (verified on the backend against Google's X.509 keys) |
| `FIREBASE_APP_ID` | _(empty)_ | Optional Firebase Web App ID |
| `SMTP_HOST` | _(empty)_ | SMTP server host for 6-digit login confirmation emails (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | `587` | SMTP port (`587` STARTTLS or `465` implicit TLS) |
| `SMTP_USER` | _(empty)_ | SMTP username / email address |
| `SMTP_PASS` | _(empty)_ | SMTP password or Gmail 16-character App Password |
| `SMTP_FROM` | `SMTP_USER` | Optional `From:` header (e.g. `Untitled Judge <you@gmail.com>`) |

The SQLite database stores accounts and profile pictures, friendships, progress, ratings, admin-created problems, forum content, submissions, login challenges, auth settings, and hashed login sessions. It persists across restarts and is git-ignored.

## Deployment

[`deploy/untitled-judge.service`](deploy/untitled-judge.service) is a hardened systemd unit (dedicated `judgeapp` user, `ProtectSystem=strict`, `UMask=0077`, …) for running the app from `/opt/untitled-judge` with data in `/var/lib/untitled-judge`.

The reference deployment runs on an Azure VM:

- **Caddy** terminates HTTPS and reverse-proxies to the app on loopback.
- `PUBLIC_ORIGIN` is set to the exact public origin and `COOKIE_SECURE=true`.
- Only ports 80 and 443 are open to the internet; SSH is restricted to the administrator's IP.

## Security model

Compilation and each testcase run in a disposable container with:

- no network, a read-only root filesystem, no Linux capabilities, `no-new-privileges`
- a 512 MiB memory limit, a one-CPU quota, a 32-process limit
- bounded temporary storage, output limits, and a wall-clock timeout

Testcase input is supplied only through standard input; expected answers remain on the host. Each container is removed after use. Passwords are hashed with scrypt and sessions are stored as SHA-256 token hashes.

> [!WARNING]
> These controls are a safer baseline for a **private class pilot**, not a guarantee against Linux kernel or container-runtime vulnerabilities. Keep Podman rootless, keep the host patched, and never give the site account sudo or access to a rootful container socket. For department-wide or public service, use a separately isolated judge worker and a stronger sandbox such as gVisor or Firecracker, with monitoring, backups, and an operational review.

## Project layout

```text
server.js            HTTP server, API, SQLite schema, judge queue
index.html           Single-page frontend shell
app.js               Frontend logic
styles.css           Styles (light/dark themes)
assets/icons/        Navigation and account icons
judge-sandbox/       Dockerfile for the grading container image
deploy/              systemd unit for production
```

## Credits

Navigation and account icons are `.ico` files from the [Fruitiger Aero icon set](https://www.rw-designer.com/icon-set/fruitiger-aero) by [ITotallyEatCrayons](https://www.rw-designer.com/user/143248), marked **Release to Public Domain** (published June 15, 2026). The files are served from `assets/icons/`, and the site links back to the set for attribution.
