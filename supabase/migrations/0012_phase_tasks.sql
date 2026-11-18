-- 0012: phase tasks (FR-PRJ-04, design S10.2; 18 Nov 2026). The table exists since 0001 with RLS (is_member to
-- read, can_write to write); the app now writes it directly through PostgREST under those policies. This adds:
--
-- 1. created_at, so tasks keep the order they were added in.
-- 2. A title check: 2–120 characters after trimming (the TypeScript domain checks the same, validateNewTask).
-- 3. A guard trigger (private.tasks_guard), because foreign keys and RLS alone allow two wrong things:
--    - a task linked to a phase of ANOTHER project (the FK only checks that the phase exists). The guard looks the
--      phase up as the caller (security invoker), so a phase the caller cannot see is refused too;
--    - done_at disagreeing with status. The guard sets done_at when a task becomes done, and clears it otherwise,
--      so the client never sends it.
--    And a task never moves to another project.
-- 4. An index for reading a phase's tasks.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.tasks add column created_at timestamptz not null default now();

-- 2. -------------------------------------------------------------------------------------------------------------
alter table public.tasks
  add constraint tasks_title_length check (char_length(btrim(title)) between 2 and 120);

-- 3. -------------------------------------------------------------------------------------------------------------
create function private.tasks_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'a task cannot move to another project' using errcode = 'check_violation';
  end if;

  if new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;

  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status <> 'done' then new.done_at := now(); end if;
  else
    new.done_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.tasks_guard() from public;

create trigger tasks_guard
  before insert or update on public.tasks
  for each row execute function private.tasks_guard();

-- 4. -------------------------------------------------------------------------------------------------------------
create index tasks_phase_idx on public.tasks (phase_id, created_at);
