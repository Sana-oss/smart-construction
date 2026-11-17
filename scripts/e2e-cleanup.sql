-- Deletes the throwaway accounts created by the end-to-end tests (tests/e2e), and everything they own.
-- STAGING ONLY (rakeeza-staging). Run it in the Supabase SQL editor of the staging project, never on a real project.
--
-- An account is a test account only if BOTH are true (see tests/e2e/helpers.ts):
--   - its internal login name is 2189500XXXXX@phone.rakeeza.invalid (phone 09500XXXXX), and
--   - its full name is exactly 'حساب اختبار آلي'.
-- Deleting the auth user cascades to the profile, its project, phases, expenses and the rest (0001: on delete
-- cascade). outbox_events and audit_log keep only plain uuids (weak references), so their rows are deleted here.

begin;

create temporary table e2e_users on commit drop as
  select id from auth.users
  where email like '2189500%@phone.rakeeza.invalid'
    and raw_user_meta_data->>'full_name' = 'حساب اختبار آلي';

create temporary table e2e_projects on commit drop as
  select id from public.projects where owner_id in (select id from e2e_users);

delete from public.outbox_events where project_id in (select id from e2e_projects);
delete from public.audit_log where project_id in (select id from e2e_projects) or actor_id in (select id from e2e_users);
delete from auth.users where id in (select id from e2e_users);

-- How many test accounts were removed (0 is fine).
select count(*) as deleted_test_accounts from e2e_users;

commit;
