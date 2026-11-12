#!/usr/bin/env bash
# Runs the migration and the RLS/constraint tests against a THROWAWAY database.
# Usage: DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run test:db
# Never point this at a real or production database: it creates roles and seed data.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a throwaway database}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -f tests/db/stub_auth.sql \
  -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_requirements_gaps.sql \
  -f supabase/migrations/0003_identity_profile_on_signup.sql \
  -f supabase/migrations/0004_private_access_helpers.sql \
  -f supabase/migrations/0005_identity_documents.sql \
  -f tests/db/rls.test.sql \
  -f tests/db/rls_0002.test.sql \
  -f tests/db/rls_0003.test.sql \
  -f tests/db/rls_0004.test.sql \
  -f tests/db/rls_0005.test.sql
echo "DB tests passed."
