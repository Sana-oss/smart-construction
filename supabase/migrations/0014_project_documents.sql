-- 0014: project documents (FR-DOC-01, NFR-SEC-03, design S30.1/S30.2/S10.4; stage 2 of the plan of 18 Nov 2026).
-- The table exists since 0001 (id, project_id, kind, storage_path, created_at) with RLS (member reads, writer
-- writes), and is empty. This adds the design's fields and the same protections as photos (0013):
--
-- 1. title (2–120), phase_id (optional, a phase of the same project), version (optional, ≤ 20), content_type
--    (PDF, JPEG or PNG) and size_bytes (≤ 10 MB, the bucket limit).
-- 2. kind: the kinds of FR-DOC-01 plus "other".
-- 3. storage_path: inside the project's documents folder, with the extension of its content type; one row per file.
-- 4. A guard trigger: the phase belongs to the same project; a document never moves to another project.
-- Files live in the private bucket "project-files" of 0013, whose policies already cover "<project id>/documents/".

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.documents
  add column title text not null check (char_length(btrim(title)) between 2 and 120),
  add column phase_id uuid references public.phases(id) on delete set null,
  add column version text check (version is null or char_length(version) between 1 and 20),
  add column content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  add column size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760);

-- 2. -------------------------------------------------------------------------------------------------------------
alter table public.documents
  add constraint documents_kind check (kind in ('plan', 'invoice', 'contract', 'warranty', 'permit', 'structural_assessment', 'other'));

-- 3. -------------------------------------------------------------------------------------------------------------
alter table public.documents
  -- A regex match is never NULL for a non-null path (a NULL check result would let the row through).
  add constraint documents_path_in_project check (
    storage_path ~ ('^' || project_id::text || '/documents/[0-9a-f-]{36}\.'
      || case content_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'x^' end
      || '$')
  ),
  add constraint documents_path_unique unique (storage_path);

create index documents_project_idx on public.documents (project_id, created_at desc);
create index documents_phase_idx on public.documents (phase_id);

-- 4. -------------------------------------------------------------------------------------------------------------
create function private.documents_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'a document cannot move to another project' using errcode = 'check_violation';
  end if;
  if new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.documents_guard() from public;

create trigger documents_guard
  before insert or update on public.documents
  for each row execute function private.documents_guard();
