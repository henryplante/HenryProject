#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8080}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

api() {
  local method="$1"
  local path="$2"
  shift 2
  curl -sS -X "$method" "${BASE_URL}${path}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$@"
}

echo "== ClearPath API smoke (BASE_URL=$BASE_URL) =="

echo "-- login (James / Legal)"
api POST /api/session/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"james.rivera@clearpath.example","password":"demo-demo"}' \
  | tee /tmp/smoke-login.json | grep -q 'james.rivera'

echo "-- tasks mine: walkthrough overdue"
TASKS="$(api GET '/api/tasks?tab=mine')"
echo "$TASKS" | grep -q 'Affiliate personal loan offer'
echo "$TASKS" | grep -q '"overdue":true'

MATERIAL_ID="$(echo "$TASKS" | python3 -c "import json,sys; t=json.load(sys.stdin); print(next(x['materialId'] for x in t if 'Affiliate personal loan' in x['title']))")"
echo "   materialId=$MATERIAL_ID"

echo "-- material detail v2 in review, Legal 0/2"
DETAIL="$(api GET "/api/materials/${MATERIAL_ID}")"
echo "$DETAIL" | grep -q '"status":"in_review"'
echo "$DETAIL" | grep -q '"currentVersionNumber":2'

LEGAL_GROUP="$(api GET /api/groups | python3 -c "import json,sys; g=json.load(sys.stdin); print(next(x['id'] for x in g if x['name']=='Legal'))")"

echo "-- approve as Legal (1/2)"
api POST "/api/materials/${MATERIAL_ID}/approvals" \
  -H 'Content-Type: application/json' \
  -d "{\"groupId\":\"${LEGAL_GROUP}\"}" \
  | grep -q '"have":1'

MAYA_ID="$(api GET /api/users | python3 -c "import json,sys; u=json.load(sys.stdin); print(next(x['id'] for x in u if x['email']=='maya.chen@clearpath.example'))")"

echo "-- switch to owner Maya"
api POST /api/session/switch \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"${MAYA_ID}\"}" \
  | grep -q 'maya.chen'

echo "-- upload v3 (multipart)"
printf '%%PDF-1.4 smoke-upload\n' > /tmp/smoke-v3.pdf
api POST "/api/materials/${MATERIAL_ID}/versions" \
  -F "file=@/tmp/smoke-v3.pdf;type=application/pdf" \
  | grep -q '"currentVersionNumber":3'

echo "-- library search"
api GET '/api/materials?q=Affiliate' | grep -q 'Affiliate personal loan'

echo "-- lazy expiry pass (list materials twice)"
api GET /api/materials >/dev/null
api GET /api/materials >/dev/null

echo "-- health"
api GET /api/health | grep -q '"status":"ok"'

echo "SMOKED OK"
