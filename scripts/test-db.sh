#!/usr/bin/env bash
# Runs the migrations and the RLS/constraint tests against a THROWAWAY database.
# Usage: DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run test:db
# Never point this at a real or production database: it creates roles and seed data.
#
# Files are found by name, not listed by hand, so a new migration (0007_...) or a new test (rls_0007.test.sql)
# is picked up automatically and cannot be forgotten (NFR-MNT-03).
# Order: the auth stub, every migration in number order, then every test (rls.test.sql first).
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a throwaway database}"
export LC_ALL=C # fixed sort order on every machine: 0001 < 0002 < ..., and "rls.test.sql" before "rls_0002.test.sql"

files=(tests/db/stub_auth.sql supabase/migrations/*.sql tests/db/*.test.sql)
args=()
for f in "${files[@]}"; do
  [ -f "$f" ] || { echo "Missing file: $f" >&2; exit 1; }
  args+=(-f "$f")
done

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "${args[@]}"
echo "DB tests passed (${#files[@]} files)."
