-- Migration 0005 (identity): identity document at sign-up (FR-ID-06, decision of 12 Nov 2026).
-- Append-only: 0001–0004 are never edited.
--
-- Why: to document contracts and project records with the owner's identity.
-- Rule: a Libyan gives the national number, a non-Libyan gives a passport number; one account per number.
-- Libyan national number (Law No. 8 of 2014, art. 2): 12 digits, first digit 1 (male) or 2 (female).
--
-- Where: columns on profiles, NOT a new table. profiles is already private to its owner (policy own_profile),
-- so the numbers are readable only by the person they belong to: not by project members, not in shared
-- reports, not in weekly_report_v. If profiles ever becomes readable by others (e.g. to show members'
-- names), expose names through a view; never open these columns.

alter table public.profiles
  add column nationality text check (nationality in ('libyan', 'foreign')),
  add column national_id text check (national_id ~ '^[12][0-9]{11}$'),
  add column passport_number text check (passport_number ~ '^[A-Z0-9]{6,20}$'),
  -- Exactly the one document that matches the nationality (all null only for rows created before 0005).
  add constraint profiles_identity_document_matches_nationality check (
       (nationality is null and national_id is null and passport_number is null)
    or (nationality = 'libyan'  and national_id is not null and passport_number is null)
    or (nationality = 'foreign' and passport_number is not null and national_id is null)
  );

-- One account per number.
create unique index profiles_national_id_key on public.profiles (national_id) where national_id is not null;
create unique index profiles_passport_number_key on public.profiles (passport_number) where passport_number is not null;

-- The numbers are written once, at sign-up, by the trigger below. A user may change only their name:
-- otherwise anyone could replace the number that documents their contracts.
-- (Supabase grants every table privilege to anon/authenticated by default; RLS alone cannot limit columns.)
do $$ begin
  revoke insert, update on public.profiles from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke insert, update on public.profiles from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke insert, update on public.profiles from authenticated;
    grant update (full_name) on public.profiles to authenticated;
  end if;
end $$;

-- Sign-up trigger, new version (first version: 0003). Now also stores the identity document and REFUSES a
-- sign-up without one, so nobody can bypass the form by calling Supabase Auth directly with the public key.
-- If the number is already registered, the unique index aborts the whole sign-up: no user without a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nationality text := nullif(btrim(meta ->> 'nationality'), '');
  v_national_id text := nullif(regexp_replace(coalesce(meta ->> 'national_id', ''), '[\s-]', '', 'g'), '');
  v_passport text := nullif(upper(regexp_replace(coalesce(meta ->> 'passport_number', ''), '[\s-]', '', 'g')), '');
begin
  if v_nationality is null then
    raise exception 'identity document is required at sign-up (FR-ID-06)' using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, full_name, nationality, national_id, passport_number)
  values (
    new.id,
    nullif(btrim(meta ->> 'full_name'), ''),
    v_nationality,
    case when v_nationality = 'libyan' then v_national_id end,   -- keep only the matching document
    case when v_nationality = 'foreign' then v_passport end
  )
  on conflict (id) do nothing;  -- only a replay of the same user is ignored; a duplicate number still fails
  return new;
end;
$$;
