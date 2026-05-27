#!/usr/bin/env bash
# apply_quality_rls.sh — Apply quality RLS (migration 020 + Hasura metadata)
# Usage: bash hasura/apply_quality_rls.sh --endpoint <url> --admin-secret <secret> [--db-url <url>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENDPOINT="${HASURA_ENDPOINT:-http://localhost:8080}"
ADMIN_SECRET="${HASURA_ADMIN_SECRET:-}"
DB_URL="${DATABASE_URL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --endpoint) ENDPOINT="$2"; shift 2 ;;
    --admin-secret) ADMIN_SECRET="$2"; shift 2 ;;
    --db-url) DB_URL="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

if [[ -z "$ADMIN_SECRET" ]]; then
  echo "ERROR: HASURA_ADMIN_SECRET not set"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   QUALITY RLS — Migration 020 + Hasura _exists filters  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

apply_metadata() {
  local desc="$1" json="$2"
  echo "--- $desc ---"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT/v1/metadata" \
    -H "Content-Type: application/json" \
    -H "X-Hasura-Admin-Secret: $ADMIN_SECRET" \
    -d @"$json")
  HTTP=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  if [[ "$HTTP" -ge 200 && "$HTTP" -lt 300 ]]; then
    echo "  ✅ (HTTP $HTTP)"
  elif [[ "$HTTP" -eq 400 ]]; then
    echo "  ⚠  Skipped: $BODY"
  else
    echo "  ❌ (HTTP $HTTP): $BODY"
    exit 1
  fi
  echo ""
}

# Step 1: PostgreSQL migration
echo "=== STEP 1: Migration 020 (RLS + line_id columns) ==="
if [[ -n "$DB_URL" ]]; then
  psql "$DB_URL" -f "$PROJECT_ROOT/migrations/020_quality_rls.sql"
  psql "$DB_URL" -f "$PROJECT_ROOT/migrations/020_quality_rls.verify.sql"
  echo "  ✅ Migration 020 applied + verified"
else
  echo "  ⚠  --db-url not provided. Run manually:"
  echo "    psql \$DB_URL -f migrations/020_quality_rls.sql"
  echo "    psql \$DB_URL -f migrations/020_quality_rls.verify.sql"
fi
echo ""

# Step 2: Drop old Hasura permissions
echo "=== STEP 2: Drop old quality permissions ==="
apply_metadata "Drop old permissions" "$SCRIPT_DIR/drop_quality_permissions.json"

# Step 3: Apply new permissions with _exists
echo "=== STEP 3: Apply new permissions (_exists RLS) ==="
apply_metadata "Quality CRUD with _exists filters" "$SCRIPT_DIR/quality_permissions.json"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ QUALITY RLS COMPLETE                                 ║"
echo "║  Migration 020: line_id + RLS policies                    ║"
echo "║  Hasura: _exists filters for operator role                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "⚠  If line_id column doesn't appear in Hasura Console:"
echo "   Hasura Console → Data → quality_inspections → Modify → Track"
echo "   Then repeat for defect_logs and weight_logs"
echo ""
echo "Next: verify triggers → bash migrations/verify_019_outbox_triggers.sql"
echo "Then: npx expo start"
