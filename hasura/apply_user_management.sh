#!/usr/bin/env bash
# ==============================================================
# Apply User Management — migration + Hasura permissions
# ==============================================================
#
# PR 1/2 Infrastructure: applies migration 014 and user_plants
# permissions to Hasura metadata.
#
# Prerequisites:
#   - Hasura CLI installed (https://hasura.io/docs/latest/hasura-cli/install/)
#   - NHOST_ADMIN_SECRET set in environment
#   - NHOST_BACKEND_URL set in environment (e.g. https://<subdomain>.auth.<region>.nhost.run/v1)
#   - HASURA_GRAPHQL_ENDPOINT set (e.g. https://<subdomain>.graphql.<region>.nhost.run/v1/graphql)
#
# Usage:
#   export NHOST_ADMIN_SECRET="your-admin-secret"
#   export NHOST_BACKEND_URL="https://<subdomain>.auth.<region>.nhost.run/v1"
#   export HASURA_GRAPHQL_ENDPOINT="https://<subdomain>.graphql.<region>.nhost.run/v1/graphql"
#   bash hasura/apply_user_management.sh
#
# Rollback:
#   bash hasura/apply_user_management.sh rollback
# ==============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="${1:-apply}"

# ─── Guard: env vars ──────────────────────────────────────────

: "${NHOST_ADMIN_SECRET:?Must set NHOST_ADMIN_SECRET}"
: "${NHOST_BACKEND_URL:?Must set NHOST_BACKEND_URL}"
: "${HASURA_GRAPHQL_ENDPOINT:?Must set HASURA_GRAPHQL_ENDPOINT}"

# ─── Apply mode ───────────────────────────────────────────────

apply_changes() {
  echo "=== Applying migration 014: user_plants admin RLS ==="

  # Run migration via Hasura CLI (manages migration state)
  if command -v hasura &> /dev/null; then
    cd "$PROJECT_DIR"
    hasura migrate apply --version 014 --skip-execution false \
      --endpoint "$HASURA_GRAPHQL_ENDPOINT" \
      --admin-secret "$NHOST_ADMIN_SECRET"
    echo "✓ Migration 014 applied via Hasura CLI"
  else
    # Fallback: apply raw SQL via Hasura GraphQL API
    echo "Hasura CLI not found — applying via GraphQL API..."
    SQL=$(cat "$PROJECT_DIR/migrations/014_user_plants_admin_rls.sql")
    curl -s -X POST "$HASURA_GRAPHQL_ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "x-hasura-admin-secret: $NHOST_ADMIN_SECRET" \
      -d "{\"type\":\"run_sql\",\"args\":{\"source\":\"default\",\"sql\":$(echo "$SQL" | jq -Rs .)}}"
    echo ""
    echo "✓ Migration 014 SQL executed"
  fi

  echo ""
  echo "=== Applying Hasura permissions: user_plants ==="

  curl -s -X POST "$HASURA_GRAPHQL_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "x-hasura-admin-secret: $NHOST_ADMIN_SECRET" \
    -d @"$SCRIPT_DIR/permissions_user_plants.json"
  echo ""
  echo "✓ user_plants permissions applied"

  echo ""
  echo "=== Applying Hasura permissions: operator_profiles (update) ==="

  curl -s -X POST "$HASURA_GRAPHQL_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "x-hasura-admin-secret: $NHOST_ADMIN_SECRET" \
    -d @"$SCRIPT_DIR/permissions_operator_profiles.json"
  echo ""
  echo "✓ operator_profiles permissions updated"

  echo ""
  echo "=== All changes applied successfully ==="
}

# ─── Rollback mode ────────────────────────────────────────────

rollback_changes() {
  echo "=== Rolling back user_plants permissions ==="

  curl -s -X POST "$HASURA_GRAPHQL_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "x-hasura-admin-secret: $NHOST_ADMIN_SECRET" \
    -d @"$SCRIPT_DIR/drop_user_plants_permissions.json"
  echo ""
  echo "✓ user_plants permissions dropped"

  echo ""
  echo "=== Restoring operator_profiles permissions ==="
  echo "NOTE: Use git checkout to restore the previous version:"
  echo "  git checkout HEAD~1 -- hasura/permissions_operator_profiles.json"
  echo "Then re-run this script to apply the restored file."

  echo ""
  echo "=== Rollback complete ==="
}

# ─── Main ─────────────────────────────────────────────────────

case "$MODE" in
  apply)
    apply_changes
    ;;
  rollback)
    rollback_changes
    ;;
  *)
    echo "Usage: $0 [apply|rollback]"
    exit 1
    ;;
esac
