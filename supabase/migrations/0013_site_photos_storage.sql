-- 0013: site photos and private file storage (FR-DOC-02, NFR-SEC-03, design S31.1/S31.2; plan of 18 Nov 2026).
--
-- 1. photos: created_at and size_bytes, a note limit, a storage path that must sit in the photo's own project
--    folder, and a guard trigger (phase of the same project; taken_on not after today in Libya).
-- 2. Storage (only where the Supabase storage schema exists; plain PostgreSQL in CI has none, and these parts are
--    tested end to end on staging instead):
--    - a PRIVATE bucket "project-files" (no public URLs; files are read through short-lived signed URLs), with a
--      size limit and the allowed file types (JPEG for photos; PNG and PDF are for the documents step);
--    - policies on storage.objects: the first folder of every path is the project id; a member reads, a writer
--      uploads and deletes; nobody updates (a file is replaced by a new one). Anyone else sees nothing.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.photos
  add column created_at timestamptz not null default now(),
  add column size_bytes integer check (size_bytes is null or size_bytes > 0),
  add constraint photos_note_length check (note is null or char_length(note) <= 500),
  add constraint photos_path_in_project check (
    storage_path ~ ('^' || project_id::text || '/photos/[0-9a-f-]{36}\.jpg$')
  ),
  add constraint photos_path_unique unique (storage_path);

create index photos_project_idx on public.photos (project_id, taken_on desc, created_at desc);

create function private.photos_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'a photo cannot move to another project' using errcode = 'check_violation';
  end if;
  if new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if new.taken_on > private.today_tripoli() then
    raise exception 'a photo cannot be taken after today' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.photos_guard() from public;

create trigger photos_guard
  before insert or update on public.photos
  for each row execute function private.photos_guard();

-- 2. -------------------------------------------------------------------------------------------------------------
-- The project id from a storage path "<project id>/...", or null when the first folder is not a uuid.
create function private.project_of_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
              then split_part(p_name, '/', 1)::uuid end
$$;

revoke all on function private.project_of_path(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function private.project_of_path(text) to authenticated;
  end if;
end $$;

do $outer$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage')
     or not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'storage' and c.relname = 'buckets') then
    raise notice 'storage schema not present: bucket and storage policies skipped (plain PostgreSQL)';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('project-files', 'project-files', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
  on conflict (id) do nothing;

  execute $p$
    create policy project_files_read on storage.objects for select to authenticated
      using (bucket_id = 'project-files' and private.is_member(private.project_of_path(name)))
  $p$;
  execute $p$
    create policy project_files_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'project-files' and private.can_write(private.project_of_path(name)))
  $p$;
  execute $p$
    create policy project_files_delete on storage.objects for delete to authenticated
      using (bucket_id = 'project-files' and private.can_write(private.project_of_path(name)))
  $p$;
end
$outer$;
