-- Jin-Woo Build: accounts, offline sync and read-only coach access.
-- Safe to re-run in the SQL editor: tables use "if not exists", functions are replaced,
-- policies and triggers are dropped and recreated.
--
-- Sync model: the client owns `updated_at` (last-write-wins stamp from the device clock).
-- `synced_at` is set by the server on every write and is the only column used as a pull cursor,
-- so rows pushed late by a device that was offline are still picked up by other devices.

-- ---------- Profiles ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'athlete' check (role in ('athlete', 'coach')),
  coach_code text unique,
  created_at timestamptz not null default now()
);

create or replace function public.new_coach_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.coach_code = code);
  end loop;
  return code;
end
$$;

alter table public.profiles alter column coach_code set default public.new_coach_code();
update public.profiles set coach_code = public.new_coach_code() where coach_code is null;
alter table public.profiles alter column coach_code set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;

-- Column grants already block this; the trigger also covers roles that were granted full UPDATE.
create or replace function public.protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.role is distinct from old.role or new.coach_code is distinct from old.coach_code or new.id is distinct from old.id) then
    raise exception 'Only an admin can change role or coach code' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- Coach links ----------

create table if not exists public.coach_athletes (
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_id, athlete_id),
  check (coach_id <> athlete_id)
);

create index if not exists coach_athletes_athlete_idx on public.coach_athletes (athlete_id);

-- A link only grants access while the linking profile is still a coach.
create or replace function public.is_coach_of(athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_athletes ca
    join public.profiles p on p.id = ca.coach_id
    where ca.coach_id = auth.uid() and ca.athlete_id = athlete and p.role = 'coach'
  );
$$;

-- ---------- Synced data ----------

create table if not exists public.sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  day_id text,
  date timestamptz,
  finished_at timestamptz,
  notes text,
  entries jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.checkins (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  week date,
  weight numeric,
  waist numeric,
  kcal numeric,
  protein numeric,
  steps numeric,
  sleep numeric,
  creatine boolean not null default false,
  perf_down boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.user_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  draft jsonb,
  swaps jsonb,
  settings jsonb,
  draft_at timestamptz,
  swaps_at timestamptz,
  settings_at timestamptz,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists sessions_user_updated_idx on public.sessions (user_id, updated_at);
create index if not exists sessions_user_synced_idx on public.sessions (user_id, synced_at);
create index if not exists checkins_user_updated_idx on public.checkins (user_id, updated_at);
create index if not exists checkins_user_synced_idx on public.checkins (user_id, synced_at);
create index if not exists user_state_updated_idx on public.user_state (user_id, updated_at);

-- Last write wins: an upsert carrying an older stamp than the stored row is skipped (returns no row).
-- Stamps more than 5 minutes ahead of the server are clamped so a device with a wrong clock cannot win forever.
create or replace function public.sync_row_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(coalesce(new.updated_at, now()), now() + interval '5 minutes');
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at := now();
  return new;
end
$$;

drop trigger if exists sessions_stamp on public.sessions;
create trigger sessions_stamp
  before insert or update on public.sessions
  for each row execute function public.sync_row_stamp();

drop trigger if exists checkins_stamp on public.checkins;
create trigger checkins_stamp
  before insert or update on public.checkins
  for each row execute function public.sync_row_stamp();

-- user_state merges per field: draft, swaps and settings each keep the value with the newest stamp.
create or replace function public.merge_user_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap constant timestamptz := now() + interval '5 minutes';
begin
  new.draft_at := least(new.draft_at, cap);
  new.swaps_at := least(new.swaps_at, cap);
  new.settings_at := least(new.settings_at, cap);
  if tg_op = 'UPDATE' then
    if new.draft_at is null or new.draft_at < coalesce(old.draft_at, '-infinity') then
      new.draft := old.draft;
      new.draft_at := old.draft_at;
    end if;
    if new.swaps_at is null or new.swaps_at < coalesce(old.swaps_at, '-infinity') then
      new.swaps := old.swaps;
      new.swaps_at := old.swaps_at;
    end if;
    if new.settings_at is null or new.settings_at < coalesce(old.settings_at, '-infinity') then
      new.settings := old.settings;
      new.settings_at := old.settings_at;
    end if;
  end if;
  new.updated_at := coalesce(greatest(new.draft_at, new.swaps_at, new.settings_at), now());
  new.synced_at := now();
  return new;
end
$$;

drop trigger if exists user_state_merge on public.user_state;
create trigger user_state_merge
  before insert or update on public.user_state
  for each row execute function public.merge_user_state();

-- ---------- Row level security ----------

alter table public.profiles enable row level security;
alter table public.coach_athletes enable row level security;
alter table public.sessions enable row level security;
alter table public.checkins enable row level security;
alter table public.user_state enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_coach_of(id)
    or exists (select 1 from public.coach_athletes ca where ca.athlete_id = (select auth.uid()) and ca.coach_id = profiles.id)
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists coach_athletes_read on public.coach_athletes;
create policy coach_athletes_read on public.coach_athletes for select to authenticated
  using (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()));

drop policy if exists coach_athletes_unlink on public.coach_athletes;
create policy coach_athletes_unlink on public.coach_athletes for delete to authenticated
  using (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()));

drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists sessions_coach_read on public.sessions;
create policy sessions_coach_read on public.sessions for select to authenticated
  using (public.is_coach_of(user_id));

drop policy if exists checkins_own on public.checkins;
create policy checkins_own on public.checkins for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists checkins_coach_read on public.checkins;
create policy checkins_coach_read on public.checkins for select to authenticated
  using (public.is_coach_of(user_id));

-- Coaches read athlete settings only through my_athletes(), never the draft or swaps.
drop policy if exists user_state_own on public.user_state;
create policy user_state_own on public.user_state for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- Grants ----------

revoke all on public.profiles, public.coach_athletes, public.sessions, public.checkins, public.user_state from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
revoke insert, update on public.coach_athletes from authenticated;
grant select, delete on public.coach_athletes to authenticated;
grant select, insert, update, delete on public.sessions, public.checkins, public.user_state to authenticated;

-- ---------- RPC ----------

create or replace function public.join_coach(code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.profiles;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select * into c from public.profiles p where p.coach_code = upper(trim(code)) and p.role = 'coach';
  if not found then
    raise exception 'No coach found with that code' using errcode = 'P0002';
  end if;
  if c.id = me then
    raise exception 'You cannot be your own coach' using errcode = '22023';
  end if;
  insert into public.coach_athletes (coach_id, athlete_id) values (c.id, me) on conflict do nothing;
  return json_build_object('coach_id', c.id, 'display_name', c.display_name);
end
$$;

create or replace function public.my_coaches()
returns table (coach_id uuid, display_name text, linked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ca.coach_id, p.display_name, ca.created_at
  from public.coach_athletes ca
  join public.profiles p on p.id = ca.coach_id
  where ca.athlete_id = auth.uid()
  order by ca.created_at;
$$;

create or replace function public.my_athletes()
returns table (athlete_id uuid, display_name text, linked_at timestamptz, settings jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select ca.athlete_id, p.display_name, ca.created_at, us.settings
  from public.coach_athletes ca
  join public.profiles me on me.id = ca.coach_id and me.role = 'coach'
  join public.profiles p on p.id = ca.athlete_id
  left join public.user_state us on us.user_id = ca.athlete_id
  where ca.coach_id = auth.uid()
  order by p.display_name;
$$;

revoke execute on function public.new_coach_code() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile() from public, anon, authenticated;
revoke execute on function public.sync_row_stamp() from public, anon, authenticated;
revoke execute on function public.merge_user_state() from public, anon, authenticated;
revoke execute on function public.is_coach_of(uuid) from public, anon;
revoke execute on function public.join_coach(text) from public, anon;
revoke execute on function public.my_coaches() from public, anon;
revoke execute on function public.my_athletes() from public, anon;
grant execute on function public.is_coach_of(uuid) to authenticated;
grant execute on function public.join_coach(text) to authenticated;
grant execute on function public.my_coaches() to authenticated;
grant execute on function public.my_athletes() to authenticated;

-- Promote a coach (run as admin in the SQL editor):
--   update public.profiles set role = 'coach' where id = (select id from auth.users where email = 'coach@example.com');
