#!/usr/bin/env bash
# Full real-stack run: fresh Postgres database -> Spring API (seed profile) -> Next build/start -> Playwright -> teardown.
#   web/scripts/e2e-real.sh [playwright args...]
# Env: E2E_DB_NAME (default clearpath_e2e), PGHOST/PGPORT/PGUSER/PGPASSWORD (default localhost:5432 clearpath/clearpath),
#      API_PORT / WEB_PORT (default: random free ports), SHOTS_DIR (screenshots), E2E_LOG_DIR (default a temp dir).
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$WEB_DIR/../api"

export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-clearpath}" PGPASSWORD="${PGPASSWORD:-clearpath}"
DB_NAME="${E2E_DB_NAME:-clearpath_e2e}"
LOG_DIR="${E2E_LOG_DIR:-$(mktemp -d -t clearpath-e2e-XXXXXX)}"
mkdir -p "$LOG_DIR"

free_port() {
  python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'
}
API_PORT="${API_PORT:-$(free_port)}"
WEB_PORT="${WEB_PORT:-$(free_port)}"

PIDS=()
cleanup() {
  local code=$?
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill -- "-$pid" 2>/dev/null || true
  done
  if [ -n "${API_PORT:-}" ]; then
    pids=$(lsof -t -i ":$API_PORT" -sTCP:LISTEN 2>/dev/null || true)
    [ -n "$pids" ] && kill $pids 2>/dev/null || true
  fi
  echo "logs: $LOG_DIR"
  exit $code
}
trap cleanup EXIT INT TERM

wait_for() {
  local url="$1" name="$2" tries="${3:-120}"
  for _ in $(seq "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "timed out waiting for $name ($url); see $LOG_DIR" >&2
  return 1
}

echo "==> database $DB_NAME"
psql postgres -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" \
  -c "CREATE DATABASE \"$DB_NAME\""

echo "==> api on :$API_PORT (seed profile)"
(
  cd "$API_DIR"
  SPRING_DATASOURCE_URL="jdbc:postgresql://$PGHOST:$PGPORT/$DB_NAME" \
  SPRING_DATASOURCE_USERNAME="$PGUSER" SPRING_DATASOURCE_PASSWORD="$PGPASSWORD" \
  SERVER_PORT="$API_PORT" SESSION_SECRET="e2e-session-secret" \
    exec setsid ./gradlew bootRun --args='--spring.profiles.active=seed' >"$LOG_DIR/api.log" 2>&1
) &
PIDS+=($!)
wait_for "http://localhost:$API_PORT/api/health" "api" 300

echo "==> web build (API_URL baked in at build time) and start on :$WEB_PORT"
(
  cd "$WEB_DIR"
  unset NEXT_PUBLIC_API_MOCKS
  API_URL="http://localhost:$API_PORT" npm run build >"$LOG_DIR/web-build.log" 2>&1
)
(
  cd "$WEB_DIR"
  unset NEXT_PUBLIC_API_MOCKS
  API_URL="http://localhost:$API_PORT" exec setsid npm run start -- -p "$WEB_PORT" >"$LOG_DIR/web.log" 2>&1
) &
PIDS+=($!)
wait_for "http://localhost:$WEB_PORT/login" "web" 60

echo "==> playwright against http://localhost:$WEB_PORT"
cd "$WEB_DIR"
E2E_BASE_URL="http://localhost:$WEB_PORT" npx playwright test "$@"
