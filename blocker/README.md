# t@sk4ce blocker

Standalone service for the home box. It finds devices on the LAN, reports them to the app, and pauses the ones the app says are blocked. It pauses by redirecting a device's traffic with ARP (IPv4) and NDP (IPv6), dropping it with nftables, and serving a captive portal. It holds no policy: the app decides.

Overview: [docs/engineering.md](../docs/engineering.md). Operator view: [docs/blocker.md](../docs/blocker.md).

## Config (env)

| Variable | Default | Meaning |
|---|---|---|
| `BACKEND_URL` | `http://backend:8000` | The app. Compose sets `http://127.0.0.1:8000` (host network) |
| `INTERNAL_TOKEN` | from `{DATA_DIR}/secrets.json` | Shared secret with the app. Required |
| `LAN_IFACE` | auto | Network interface to use, for example `eth0` |
| `DATA_DIR` | `/data` | State and `secrets.json` |
| `BLOCKER_PORT` / `BLOCKER_BIND` | `7777` / `127.0.0.1` | Local API the app pushes to |
| `BLOCKER_URL_HOST` | `blocker` | Host name used for the blocker's own URL |
| `SCAN_INTERVAL` | `20` s | Device scan |
| `RECONCILE_INTERVAL` | `30` s | Pull blocked list from the app |
| `RESIST_INTERVAL` | `15` s | Resistance check |
| `PORTAL_REDIRECT_URL` | `http://task4ce.local/kid` | Where the captive portal sends kids |

## Run and test

Normally it runs from compose (`network_mode: host`, caps `NET_ADMIN` and `NET_RAW`). By hand, as root on Linux: `python -m blocker`. Health: `GET /health`.

```bash
python -m pytest blocker/tests -q                          # unit tests
cd blocker && RUN_INTEGRATION=1 python -m pytest tests/lab -v   # Docker lab, see ../lab/README.md
ruff format --check backend blocker && ruff check backend blocker   # from the repo root; CI lints this
```

## Vendor lookup

`blocker/data/oui.csv` is a trimmed subset of the IEEE OUI registry (`PREFIX,Vendor`, 6 uppercase hex chars). Extend it by appending rows.
