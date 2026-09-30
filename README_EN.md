![LibreSpeed Logo](https://github.com/librespeed/speedtest/blob/master/.logo/logo3.png?raw=true)

# LibreSpeed

[简体中文](README.md) ｜ **English** 👈

---

## About This Fork (Campus Network Customization)

This repository is a fork of **LibreSpeed v6.0.2** that adds a **site customization system**: all branding and deployment settings (site name, bilingual titles, footer, logo, privacy policy email, campus network segment labels, speed test node list) are driven by a **single mounted `site-config.json`** — no code changes, no image rebuilds. The image ships blank and generic; any school can deploy it by mounting their own config directory.

**Key design:**

- Built-in **blank template** (`docker/default-site/`) — no school-specific text or images; the site runs with generic branding when no config is mounted
- One directory per school: copy the template → fill in `site-config.json` → drop in the logo → mount it → restart the container
- **Config mistakes never crash the site**: JSON syntax errors automatically fall back to the last-good config (or built-in defaults); invalid CIDR entries are skipped with a warning in the startup log
- Extra features: campus network segment labels (Chinese label shown next to the client IP after a test), multi-node server selection with auto-pick, recent tests table

### Quick Start (Docker)

```bash
# 1. Copy the blank template to your own directory (or see docker/site-config.example.json for a filled example)
cp -r docker/default-site docker/site

# 2. Edit docker/site/site-config.json with your organization info; put your logos in the same directory (logo.png / icon.png)

# 3. Replace the placeholder passwords in docker/test/docker-compose.yml, then build and start
cd docker/test
docker compose -p speedtest up -d --build

# 4. After every config change, just restart (no image rebuild needed)
docker compose -p speedtest restart speedtest-debian-pg
```

### site-config.json fields

```json
{
  "default": {
    "name": "Example Institution",
    "titleZh": "Example Institution Network Speed Test",
    "titleEn": "Example Institution Network Speed Test",
    "footerZh": "This speed test server is provided by Example Institution.",
    "footerEn": "This speed test server is provided by Example Institution.",
    "logo": "logo.png",
    "icon": "icon.png"
  },
  "privacyEmail": "netadmin@example.edu.cn",
  "ipSegments": [
    { "cidr": "192.0.2.0/24", "zh": "Campus Network A", "en": "Campus Network A" }
  ],
  "recentColumns": ["time", "clientIp", "node", "dl", "ul", "ping", "jitter"],
  "serverList": [
    { "name": "Chongqing node", "server": "http://speedtest-chq-001.sec.edu.cn/backend" },
    { "name": "Local node", "server": "/backend" }
  ]
}
```

| Field | Required | Purpose |
|---|---|---|
| `default.name` | ✅ | Organization display name (logo alt, etc.) |
| `default.titleZh` | ✅ | Chinese title (page heading, browser tab) |
| `default.titleEn` | optional | English title; falls back to `titleZh` |
| `default.footerZh` / `footerEn` | optional | Footer notice (ZH/EN); empty = hidden |
| `default.logo` / `icon` | optional | Header logo / browser icon, relative path inside the site directory; empty = not shown |
| `privacyEmail` | optional | Privacy policy contact email |
| `ipSegments` | optional | Campus network segment labels: `{ cidr, zh, en }` list (IPv4/IPv6, bare IPs treated as `/32`); shown next to the client IP after a test |
| `recentColumns` | optional | Recent tests table columns; allowed: `time`/`clientIp`/`node`/`dl`/`ul`/`ping`/`jitter`; `node` is auto-hidden when there is a single test node |
| `serverList` | optional | Test node list `[{ "name": node name, "server": backend URL }]`; `server` accepts full URL, protocol-relative (`//host/backend`) or local relative path (`/backend`); per-node `dlURL`/`ulURL`/`pingURL`/`getIpURL` override the default script paths; empty = local single node |

### Multiple network segments (multi-campus)

List every campus segment in `ipSegments`; after a test the matching Chinese label is shown next to the client IP:

```json
"ipSegments": [
  { "cidr": "10.10.0.0/16",     "zh": "Campus A", "en": "Campus A" },
  { "cidr": "10.20.0.0/16",     "zh": "Campus B", "en": "Campus B" },
  { "cidr": "2001:db8:10::/48", "zh": "IPv6 Campus", "en": "IPv6 Campus" }
]
```

Notes:

- `cidr` supports IPv4 / IPv6 and bare IPs (treated as `/32` or `/128`)
- Entries are independent (no priority); a malformed entry (e.g. `10.0.0.256/24`) is skipped with a warning in the startup log and does **not** affect other segments or the page
- Labels are display-only: they never restrict who can test or change results

### Multiple speed test nodes

List every node (e.g. a local node plus remote nodes) in `serverList`. The frontend pings all nodes at startup, auto-selects the best one, and the user can switch manually via the "Server" dropdown:

```json
"serverList": [
  { "name": "Chongqing node", "server": "http://speedtest-chq-001.sec.edu.cn/backend" },
  { "name": "Local node",     "server": "/backend" }
]
```

Notes:

- `server` supports three forms: full URL (`http://host/backend`), protocol-relative (`//host/backend`), or local relative path (`/backend`, resolved against the current site)
- Remote nodes must run the same image (`MODE=backend` or full mode); standard script paths (`garbage.php`/`empty.php`/`getIP.php`) are used by default — no extra setup needed
- The "Server" dropdown is hidden automatically when only one node is configured
- **Restart the container** after changing `serverList` (the `server-list.json` is regenerated at startup; the log prints "N speed test nodes")
- The node name and host are stored in test records; add `node` to `recentColumns` to show them in the table

### Environment variables

| Variable | Default | Origin | Purpose |
|---|---|---|---|
| `TELEMETRY` | `false` | upstream | Enable storing test results (requires the DB_* variables below) |
| `DB_TYPE` / `DB_HOSTNAME` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | — | upstream | Telemetry database (postgresql / mysql / sqlite / mssql) |
| `ENABLE_STATS` | `false` | **this fork** | Enable the online stats page `/results/stats.php` (login via `PASSWORD`) |
| `PASSWORD` | `password` | upstream | Login password for protected pages |
| `TITLE` | `LibreSpeed` | upstream | Page title (single language) |
| `TITLE_ZH` / `TITLE_EN` | empty | **this fork** | Bilingual titles (used by the classic page language switch); take precedence over `TITLE` |
| `FOOTER_NOTICE` / `FOOTER_NOTICE_ZH` / `FOOTER_NOTICE_EN` | empty | **this fork** | Footer notice (ZH/EN) |
| `MODE` | `standalone` | upstream | Deployment mode: `standalone` / `frontend` / `backend` / `dual` |
| `WEBPORT` | `8080` | upstream | Apache listen port |
| `USE_NEW_DESIGN` | `false` | upstream | Keep the default: the classic test page is the entry (all fork customization targets this page) |

> Origin note: **upstream** = LibreSpeed v6.0.2 variables; **this fork** = added by this repository. `TITLE_ZH`/`TITLE_EN`/`FOOTER_NOTICE_*` are only fallback values when no `site-config.json` is mounted — use `site-config.json` for normal customization.

### Further reading

- [简体中文版说明](README.md)
- `docker/test/README.md` — full deployment guide (Chinese; multi-node setup, validation, troubleshooting)
- `docker/site-config.example.json` — complete example config (can be copied and modified)
- Upstream docs: `doc_docker.md` (Docker), `doc.md` (manual PHP setup), `DEVELOPMENT.md` (development)

---

## Upstream LibreSpeed Documentation

No Flash, No Java, No Websocket, No Bullshit.

This is a very lightweight speed test implemented in Javascript, using XMLHttpRequest and Web Workers.

### Try it

[Take a speed test](https://librespeed.org)

### Compatibility

All modern browsers are supported: IE11, latest Edge, latest Chrome, latest Firefox, latest Safari.
Works with mobile versions too.

### Features

* Download
* Upload
* Ping
* Jitter
* IP Address, ISP, distance from server (optional)
* Telemetry (optional)
* Results sharing (optional)
* Multiple Points of Test (optional)

![Screenrecording of a running Speedtest](https://speedtest.fdossena.com/mpot_v7.gif)

### Server requirements

* A reasonably fast web server with Apache 2 (nginx, IIS also supported)
* PHP 5.4 or newer (other backends also available)
* MariaDB or MySQL database to store test results (optional, Microsoft SQL Server, PostgreSQL and SQLite also supported)
* A fast! internet connection

### Installation

Assuming you have PHP and a web server installed, the installation steps are quite simple.

1. Download the source code and extract it
1. Copy the following files to your web server's shared folder (ie. /var/www/html/speedtest for Apache): index.html, speedtest.js, speedtest_worker.js, favicon.ico and the backend folder
1. Optionally, copy the results folder too, and set up the database using the config file in it.
1. Be sure your permissions allow execute (755).
1. Visit YOURSITE/speedtest/index.html and voila!

#### Installation Video

This video shows the installation process of a standalone LibreSpeed server: [Quick start installation guide for Debian 12](https://fdossena.com/?p=speedtest/quickstart_deb12.frag)

More videos will be added later.

### Android app

A template to build an Android client for your LibreSpeed installation is available [here](https://github.com/librespeed/speedtest-android).

### CLI client

A command line client is available [here](https://github.com/librespeed/speedtest-cli).

### .NET client

A .NET client library is available in the [`LibreSpeed.NET`](https://github.com/Memphizzz/LibreSpeed.NET) repo ([NuGet](https://www.nuget.org/packages/LibreSpeed.NET)), maintained by [MemphiZ](https://github.com/Memphizzz).

### Development

If you want to contribute or develop with LibreSpeed, see [DEVELOPMENT.md](DEVELOPMENT.md) for information about using npm for development tasks, linting, and formatting.

### Design switch

LibreSpeed supports both the classic and modern UI. The root `index.html` acts as a lightweight switcher and redirects to `index-classic.html` or `index-modern.html` based on `config.json` (`useNewDesign`) or URL overrides (`?design=new` / `?design=old`). For architecture and deployment details (including Docker behavior), see [DESIGN_SWITCH.md](DESIGN_SWITCH.md).

### Docker

A docker image is available on [GitHub](https://github.com/librespeed/speedtest/pkgs/container/speedtest), check our [docker documentation](doc_docker.md) for more info about it.
The image is built every week to include an updated version of the ipinfo-DB used for ISP detection. Also this ensures, that the latest security patches in PHP are installed. Therefore we recommend to use the `latest` image.

### Go backend

A Go implementation is available in the [`speedtest-go`](https://github.com/librespeed/speedtest-go) repo, maintained by [Maddie Zhan](https://github.com/maddie).

### Rust backend

A Rust implementation is available in the [`speedtest-rust`](https://github.com/librespeed/speedtest-rust) repo, maintained by [Sudo Dios](https://github.com/sudodios).

### Node.js backend

A partial Node.js implementation is available in the `node` branch, developed by [dunklesToast](https://github.com/dunklesToast). It's not recommended to use at the moment.

### Donate

[![Donate with Liberapay](https://liberapay.com/assets/widgets/donate.svg)](https://liberapay.com/fdossena/donate)
[Donate with PayPal](https://www.paypal.me/sineisochronic)

### License

Copyright (C) 2016-2024 Federico Dossena

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/lgpl>.