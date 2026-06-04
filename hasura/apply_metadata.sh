#!/usr/bin/env bash
# apply_metadata.sh — Apply Hasura RLS permissions for OEE Phase 3
# Usage: bash hasura/apply_metadata.sh [--endpoint <hasura-endpoint>] [--admin-secret <secret>]
#
# Requires: hasura CLI v2.x installed
# Install: curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Parse args ---
ENDPOINT="${HASURA_ENDPOINT:-http://localhost:8080}"
ADMIN_SECRET="${HASURA_ADMIN_SECRET:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --endpoint)
      ENDPOINT="$2"
      shift 2
      ;;
    --admin-secret)
      ADMIN_SECRET="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$ADMIN_SECRET" ]]; then
  echo "ERROR: HASURA_ADMIN_SECRET not set and --admin-secret not provided."
  echo "Usage: bash hasura/apply_metadata.sh --endpoint <url> --admin-secret <secret>"
  exit 1
fi

echo "=== OEE Phase 3: Applying Hasura RLS Metadata ==="
echo "Endpoint: $ENDPOINT"
echo ""

# --- Helper function ---
apply_metadata() {
  local description="$1"
  local json_file="$2"

  echo "--- Applying: $description ---"

  if [[ ! -f "$json_file" ]]; then
    echo "ERROR: File not found: $json_file"
    exit 1
  fi

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$ENDPOINT/v1/metadata" \
    -H "Content-Type: application/json" \
    -H "X-Hasura-Admin-Secret: $ADMIN_SECRET" \
    -d @"$json_file")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
    echo "  ✅ Success (HTTP $HTTP_CODE)"
    if [[ "$BODY" != "{}" && -n "$BODY" ]]; then
      echo "  Response: $BODY"
    fi
  else
    echo "  ❌ Failed (HTTP $HTTP_CODE)"
    echo "  Response: $BODY"
    exit 1
  fi
  echo ""
}

# --- Apply permissions in order ---

# 1. oee_events permissions (bulk: SELECT, INSERT, UPDATE, DELETE for operator role)
apply_metadata \
  "oee_events: SELECT + INSERT + UPDATE + DELETE permissions (operator role)" \
  "$SCRIPT_DIR/rls_oee_events.json"

# 2. user_line_assignments permissions (bulk: SELECT, INSERT, DELETE for operator role)
apply_metadata \
  "user_line_assignments: SELECT + INSERT + DELETE permissions (operator role)" \
  "$SCRIPT_DIR/permissions_user_line_assignments.json"

# 3. telemetry_raw_staging + epicor_sync_queue: track tables + admin select permissions
apply_metadata \
  "telemetry_raw_staging + epicor_sync_queue: track tables + select permissions (admin role)" \
  "$SCRIPT_DIR/telemetry_permissions.json"

# 4. quality tables: product_weight_standards, quality_inspections, defect_logs, weight_logs
#    SELECT for operator/supervisor/admin | INSERT for operator/supervisor/admin | UPDATE for operator/supervisor/admin
apply_metadata \
  "quality tables: product_weight_standards, quality_inspections, defect_logs, weight_logs — full CRUD permissions (operator/supervisor/admin roles)" \
  "$SCRIPT_DIR/quality_permissions.json"

# 5. operator + shift_sessions: SELECT + INSERT + UPDATE + DELETE permissions
#    Updated to include planned_boxes and product_code columns from migration 013
apply_metadata \
  "operator + shift_sessions: full CRUD permissions with planned_boxes + product_code (operator/supervisor/admin roles)" \
  "$SCRIPT_DIR/operator_sessions_permissions.json"

# 6. Track 5 SQL views + re-track tables with new columns (planned_boxes, product_code, data_source)
apply_metadata \
  "Views analíticas: track 5 SQL views + SELECT permissions for supervisor/admin roles" \
  "$SCRIPT_DIR/track_views_and_columns.json"

# 7. REST endpoint: upsert_work_order_from_cmms
#    POST /api/rest/upsert_work_order_from_cmms
#    GraphQL mutation upsert work_orders by cmms_wo_id vía on_conflict
apply_metadata \
  "REST endpoint: upsert_work_order_from_cmms — upsert work_orders por cmms_wo_id" \
  "$SCRIPT_DIR/endpoint_upsert_work_order.json"

# --- Verify ---
echo "=== Verification ==="
echo "Checking applied permissions..."

VERIFY_RESPONSE=$(curl -s \
  -X POST "$ENDPOINT/v1/metadata" \
  -H "Content-Type: application/json" \
  -H "X-Hasura-Admin-Secret: $ADMIN_SECRET" \
  -d '{
    "type": "pg_get_table_permissions",
    "args": {
      "source": "default",
      "table": {
        "schema": "public",
        "name": "oee_events"
      }
    }
  }')

echo "oee_events permissions: $VERIFY_RESPONSE"
echo ""

VERIFY_RESPONSE=$(curl -s \
  -X POST "$ENDPOINT/v1/metadata" \
  -H "Content-Type: application/json" \
  -H "X-Hasura-Admin-Secret: $ADMIN_SECRET" \
  -d '{
    "type": "pg_get_table_permissions",
    "args": {
      "source": "default",
      "table": {
        "schema": "public",
        "name": "telemetry_raw_staging"
      }
    }
  }')

echo "telemetry_raw_staging permissions: $VERIFY_RESPONSE"
echo ""

VERIFY_RESPONSE=$(curl -s \
  -X POST "$ENDPOINT/v1/metadata" \
  -H "Content-Type: application/json" \
  -H "X-Hasura-Admin-Secret: $ADMIN_SECRET" \
  -d '{
    "type": "pg_get_table_permissions",
    "args": {
      "source": "default",
      "table": {
        "schema": "public",
        "name": "epicor_sync_queue"
      }
    }
  }')

echo "epicor_sync_queue permissions: $VERIFY_RESPONSE"
echo ""

echo "=== Post-Apply: Validar Triggers Epicor Outbox ==="
echo ""
echo "Ejecutar contra Postgres:"
echo "  psql -U <user> -d <database> -f $PROJECT_ROOT/migrations/verify_019_outbox_triggers.sql"
echo ""
echo "=== Done. RLS metadata applied successfully. ==="
