# t@sk4ce network lab

Isolated Docker Compose lab for exercising the blocker (ARP/NDP, redirect, resist) without touching a real LAN.

| Service | Lab (10.99.0.0/24, fd00:99::/64) | WAN (203.0.113.0/24, 2001:db8:1::/64) | MAC |
|---|---|---|---|
| router | .2 / ::2 | .2 / ::2 | 02:99:00:00:00:02 |
| backend | .3 | - | - |
| blocker | .4 / ::4 | - | 02:99:00:00:00:04 |
| kid1 | .11 / ::11 | - | 02:99:00:00:00:11 |
| kid2 | .12 / ::12 | - | 02:99:00:00:00:12 |
| parent | .13 / ::13 | - | 02:99:00:00:00:13 |
| frontend (e2e profile) | .5 | - | - |
| e2e (Playwright, e2e profile) | .6 | - | - |
| fake-internet | - | 203.0.113.1 / 2001:db8:1::1 | - |

Both networks are `internal: true`; nothing reaches the real internet.

## Run

    export INTERNAL_TOKEN=labtoken   # needed to interpolate the parent compose file
    docker compose -f lab/docker-compose.lab.yml up -d --build
    docker compose -f lab/docker-compose.lab.yml exec kid1 curl -s -m 3 http://203.0.113.1/
    docker compose -f lab/docker-compose.lab.yml down -v

## Driver script and tests

`bash scripts/lab.sh up` builds the lab, runs first-time setup (user `labparent`) and marks the kid and parent containers as guests; `down` tears it down. `e2e` starts the frontend and runs the browser tests (screenshots land in `frontend/e2e-artifacts`). Helpers: `block|unblock|check|check6|portal|resist|reset|resisting|test-block <kid1|kid2|parent>`. Run it with no arguments for usage.

Journey tests (real ARP, nftables, portal): `cd blocker && RUN_INTEGRATION=1 python -m pytest tests/lab -v`. CI runs both, see [docs/engineering.md](../docs/engineering.md#testing).

Docker takes the first address of each subnet as gateway; on `wan` the gateway is moved to
203.0.113.254 / 2001:db8:1::ffff so `fake-internet` can own .1.

## IPv6 caveat

Needs Linux Docker. IPv6 on user-defined bridges may need `"ipv6": true` in `/etc/docker/daemon.json`
(with a restart), depending on Docker version. On the dev host a v6 curl from kid1 to
`[2001:db8:1::1]` failed, so v6 behaviour is unverified.
