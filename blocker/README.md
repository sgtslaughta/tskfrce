# task4ce-blocker

Standalone service that discovers LAN devices and enforces the app's device-lock decisions.

Config (env): `BACKEND_URL`, `BLOCKER_URL_HOST`, `BLOCKER_PORT` (7777), `LAN_IFACE`, `DATA_DIR`,
`INTERNAL_TOKEN` (falls back to `{DATA_DIR}/secrets.json`), `SCAN_INTERVAL`, `RECONCILE_INTERVAL`,
`PORTAL_REDIRECT_URL`.

Run: `python -m blocker`. Health: `GET /health`. Test: `python -m pytest blocker/tests`.

Vendor lookup: `blocker/data/oui.csv` is a trimmed subset of the IEEE OUI registry (`PREFIX,Vendor`,
6 uppercase hex chars). Extend it by appending rows.
