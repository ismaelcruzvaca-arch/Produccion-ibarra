#!/usr/bin/env bash
# shellcheck shell=bash
#
# run_migrations.sh — Apply, verify, rollback, and re-apply PostgreSQL migrations
#
# Usage:
#   ./run_migrations.sh                          # uses PG* env vars
#   ./run_migrations.sh --db-url <postgresql://> # connection URL
#   ./run_migrations.sh --single 007             # run only migration 007

set -euo pipefail

MIGRATIONS="007 008"
DB_URL=""
SINGLE=""

# --- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --db-url)
            DB_URL="$2"
            shift 2
            ;;
        --single)
            SINGLE="$2"
            shift 2
            ;;
        *)
            echo "❌ Usage: $0 [--db-url <url>] [--single <NNN>]"
            exit 1
            ;;
    esac
done

if [[ -n "$SINGLE" ]]; then
    MIGRATIONS="$SINGLE"
fi

# --- psql command builder ----------------------------------------------------
psql_cmd() {
    if [[ -n "$DB_URL" ]]; then
        psql --echo-errors "$DB_URL" -f "$1"
    else
        psql --echo-errors -f "$1"
    fi
}

# --- Step runner -------------------------------------------------------------
failed=0

run_step() {
    local step="$1"   # apply | verify | rollback | re-apply | re-verify
    local file="$2"
    local label="$3"

    if [[ ! -f "$file" ]]; then
        echo "❌ ${step}: ${label}: file not found (${file})"
        failed=1
        return
    fi

    if psql_cmd "$file"; then
        echo "✅ ${step}: ${label}"
    else
        local rc=$?
        echo "❌ ${step}: ${label}: psql exited with code ${rc}"
        failed=1
    fi
}

# --- Find migration files by numeric prefix ----------------------------------
find_migration_file() {
    local prefix="$1"
    local dir="$2"
    # dir is empty for the base migrations/ directory, or "verify"/"rollback"
    local search_dir="migrations"
    if [[ -n "$dir" ]]; then
        search_dir="migrations/${dir}"
    fi
    # shellcheck disable=SC2012
    ls -1 "${search_dir}/${prefix}"_*.sql 2>/dev/null | head -1 || true
}

# --- Main loop ---------------------------------------------------------------
for num in $MIGRATIONS; do
    mig_file=$(find_migration_file "$num" "")
    ver_file=$(find_migration_file "$num" "verify")
    rol_file=$(find_migration_file "$num" "rollback")

    if [[ -z "$mig_file" ]]; then
        echo "❌ apply: Migration file ${num}_*.sql not found in migrations/"
        failed=1
        continue
    fi
    if [[ -z "$ver_file" ]]; then
        echo "❌ verify: Verify file ${num}_*.sql not found in migrations/verify/"
        failed=1
        continue
    fi
    if [[ -z "$rol_file" ]]; then
        echo "❌ rollback: Rollback file ${num}_*.sql not found in migrations/rollback/"
        failed=1
        continue
    fi

    label=$(basename "$mig_file" .sql)

    run_step "apply"     "$mig_file" "$label"
    run_step "verify"    "$ver_file" "$label"
    run_step "rollback"  "$rol_file" "$label"
    run_step "re-apply"  "$mig_file" "$label"
    run_step "re-verify" "$ver_file" "$label"
done

exit "$failed"
