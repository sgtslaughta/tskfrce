#!/usr/bin/env bash
# Docker network lab driver. Run from repo root.
set -euo pipefail
cd "$(dirname "$0")/.."
export INTERNAL_TOKEN=labtoken
COMPOSE="docker compose -f lab/docker-compose.lab.yml"
API=http://10.99.0.3:8000
BLK=http://10.99.0.4:7777
USER_=labparent PASS_=labpassword1

_curl_parent() { $COMPOSE exec -T parent curl -s -m 10 "$@"; }

_mac_of() {
  case "$1" in
    kid1) echo 02:99:00:00:00:11 ;;
    kid2) echo 02:99:00:00:00:12 ;;
    parent) echo 02:99:00:00:00:13 ;;
    *) echo "unknown host: $1" >&2; return 2 ;;
  esac
}

_token() {
  _curl_parent -X POST "$API/api/v1/auth/login" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$USER_\",\"password\":\"$PASS_\"}" | jq -r .access_token
}

_devices() { _curl_parent -H "Authorization: Bearer $(_token)" "$API/api/v1/devices"; }

_id_of() {
  local mac; mac=$(_mac_of "$1")
  _devices | jq -r --arg m "$mac" '[.[] | select((.mac|ascii_downcase)==$m)][0].id // empty'
}

_need_id() {
  local id; id=$(_id_of "$1")
  [ -n "$id" ] || { echo "device $1 not found" >&2; exit 1; }
  echo "$id"
}

_post() { # path json
  _curl_parent -X POST -H "Authorization: Bearer $(_token)" -H 'Content-Type: application/json' -d "$2" "$API$1"
}

_wait_http() { # url
  for _ in $(seq 60); do
    [ "$(_curl_parent -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true)" = 200 ] && return 0
    sleep 1
  done
  echo "timeout waiting for $1" >&2; return 1
}

_up() {
  $COMPOSE up -d --build
  _wait_http "$API/health"
  _wait_http "$BLK/health"
  _curl_parent -o /dev/null -X POST "$API/api/v1/setup" -H 'Content-Type: application/json' \
    -d "{\"family_name\":\"Lab\",\"timezone\":\"UTC\",\"parent\":{\"username\":\"$USER_\",\"password\":\"$PASS_\",\"full_name\":\"Lab Parent\"}}" || true
  for _ in $(seq 30); do
    if [ -n "$(_id_of kid1 2>/dev/null || true)" ] && [ -n "$(_id_of kid2 2>/dev/null || true)" ]; then
      local id
      for id in $(_devices | jq -r '.[].id'); do
        _curl_parent -o /dev/null -X PATCH -H "Authorization: Bearer $(_token)" \
          -H 'Content-Type: application/json' -d '{"status":"guest"}' "$API/api/v1/devices/$id"
      done
      echo "lab up"; return 0
    fi
    sleep 2
  done
  echo "timeout waiting for device discovery" >&2; return 1
}

_portal() {
  local ip out
  ip=$($COMPOSE exec -T "$1" nslookup example.com 2>/dev/null | awk '/^Address/ && !/#/ {print $2}' | tail -1)
  [ "$ip" = 10.99.0.4 ] || { echo "dns: $ip" >&2; return 1; }
  out=$($COMPOSE exec -T "$1" curl -s -m 3 -o /dev/null -w '%{http_code} %{redirect_url}' http://example.com/ || true)
  echo "$out"
  [ "$out" = "302 http://task4ce.local/kid" ]
}

cmd=${1:-}; shift || true
case "$cmd" in
  up) _up ;;
  down) $COMPOSE down -v ;;
  token) _token ;;
  device-id) _need_id "$1" ;;
  block) _post "/api/v1/devices/$(_need_id "$1")/override" '{"action":"lock"}' >/dev/null ;;
  unblock) _post "/api/v1/devices/$(_need_id "$1")/override" '{"action":"unlock"}' >/dev/null ;;
  check) $COMPOSE exec -T "$1" sh -c 'curl -s -m 3 http://203.0.113.1/ | grep -q "fake internet"' && exit 0 || exit 1 ;;
  check6) $COMPOSE exec -T "$1" sh -c 'curl -s -m 3 "http://[2001:db8:1::1]/" | grep -q "fake internet"' && exit 0 || exit 1 ;;
  portal) _portal "$1" && exit 0 || exit 1 ;;
  resist)
    $COMPOSE exec -T "$1" ip neigh replace 10.99.0.2 lladdr 02:99:00:00:00:02 nud permanent dev eth0
    $COMPOSE exec -T "$1" ip -6 neigh replace fd00:99::2 lladdr 02:99:00:00:00:02 nud permanent dev eth0 ;;
  reset)
    $COMPOSE exec -T "$1" ip neigh flush dev eth0
    $COMPOSE exec -T "$1" ip -6 neigh flush dev eth0 ;;
  resisting)
    mac=$(_mac_of "$1")
    _devices | jq -r --arg m "$mac" '[.[] | select((.mac|ascii_downcase)==$m)][0].resisting // false' ;;
  test-block) _post "/api/v1/devices/$(_need_id "$1")/test-block" '{}' ;;
  *) echo "usage: $0 {up|down|token|device-id|block|unblock|check|check6|portal|resist|reset|resisting|test-block} [host]" >&2; exit 2 ;;
esac
