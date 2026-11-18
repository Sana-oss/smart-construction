-- 0011: remove the anon role's execute right on update_phase_schedule (follow-up to 0010, 18 Nov 2026).
--
-- On Supabase, new functions in public get EXECUTE for anon through the platform's default privileges, so
-- "revoke ... from public" in 0010 was not enough. 0009 revoked anon explicitly for create_expense; 0010 forgot.
-- No harm was possible (the function refuses anyone not signed in, and RLS hides every phase from anon), but an
-- API role should not be able to call it at all. 0010 is already applied, so it is not edited (migrations are
-- append-only).

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.update_phase_schedule(uuid, text, date, date, date, date) from anon;
  end if;
end $$;
