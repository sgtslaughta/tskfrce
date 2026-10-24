#!/bin/sh
# Installer smoke test: installs from this checkout into a temp dir on side ports, checks health
# and .env, re-runs to prove .env is kept, then removes everything it created.
#   TEST_PORT / TEST_API_PORT override the side ports (default 3900 / 8900).
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TASK4CE_SRC="$ROOT"
TASK4CE_DIR="$(mktemp -d)"
export TASK4CE_DIR
export TASK4CE_PROJECT="task4ce-smoke-$$"
export TASK4CE_PORT="${TEST_PORT:-3900}"
export TASK4CE_API_PORT="${TEST_API_PORT:-8900}"
export TASK4CE_SUBNET="172.29.99.0/24"
export TASK4CE_FRONTEND_IP="172.29.99.10"
export TASK4CE_SKIP_BLOCKER=1 # never scan the real network from a test
export TASK4CE_YES=0

cleanup() {
  (cd "$TASK4CE_DIR" && docker compose -f docker-compose.prod.yml down -v --rmi local >/dev/null 2>&1) || true
  rm -rf "$TASK4CE_DIR"
}
trap cleanup EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }

sh "$ROOT/install.sh" || fail "install.sh failed"
curl -fsS "http://127.0.0.1:$TASK4CE_PORT/api/health" >/dev/null || fail "frontend not healthy"
curl -fsS "http://127.0.0.1:$TASK4CE_API_PORT/health" >/dev/null || fail "backend not healthy"
grep -Eq '^SECRET_KEY=[0-9a-f]{64}$' "$TASK4CE_DIR/.env" || fail ".env has no SECRET_KEY"
grep -Eq '^INTERNAL_TOKEN=[0-9a-f]{64}$' "$TASK4CE_DIR/.env" || fail ".env has no INTERNAL_TOKEN"
before="$(cksum <"$TASK4CE_DIR/.env")"

sh "$ROOT/install.sh" || fail "second run failed"
[ "$before" = "$(cksum <"$TASK4CE_DIR/.env")" ] || fail ".env changed on the second run"
curl -fsS "http://127.0.0.1:$TASK4CE_PORT/api/health" >/dev/null || fail "unhealthy after update"
echo "install smoke test passed"
