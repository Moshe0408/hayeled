-- =====================================================================
--  הילד מהשכונה (hayeled) - update 2.3: ליגת חברים (friends leagues)
--  Run AFTER supabase/schema.sql (needs public.is_admin()). Independent of update-2.1/2.2/2.3.sql.
--  Supabase -> SQL Editor -> paste the WHOLE file -> Run.
--  Idempotent: safe to run again. Never deletes data.
--
--  What it adds:
--    * TWO new tables: public.friend_leagues (one row per league) and public.friend_league_members
--      (one row per league + device + career). RLS on, NO policies, no table privileges for
--      anon / authenticated: only the functions below touch them.
--    * Player RPCs (anon + authenticated):
--        fl_create(p_device, p_name, p_career?, p_summary?)
--             -> {ok, code, name, joined} | {ok:false, error:'bad_device'|'bad_name'|'too_many'|'rate_limited'|'busy'}
--             max 10 leagues owned per device; code = 6 chars of A-Z 2-9 without I O 0 1 (base32, from
--             gen_random_bytes). With p_career + p_summary the owner joins the league right away.
--        fl_join(p_code, p_device, p_career, p_summary)
--             -> {ok, code, name, members, already} | {ok:false, error:'bad_code'|'not_found'|'full'|'too_many'|...}
--             max 50 members per league, max 30 memberships per device.
--        fl_sync(p_device, p_career, p_summary) -> {ok, updated}  updates EVERY membership of that device + career
--        fl_get(p_code, p_device?) -> {ok, code, name, count, max, week_key, is_owner, is_member, members:[...], week_king}
--             members never carry device / career ids: "hash" (10 hex chars, per league) is the handle for
--             the owner's fl_remove. p_device only marks "me" / "is_owner".
--        fl_mine(p_device) -> {ok, leagues:[{code, name, role, career_id, members}]}   (restores the local list)
--        fl_leave(p_code, p_device, p_career?) -> {ok, removed, deleted, owner_moved}
--             the owner leaving hands the league to the earliest remaining member; an empty league is deleted.
--        fl_rename(p_code, p_device, p_name) -> {ok, name}            owner only
--        fl_remove(p_code, p_device, p_member_hash) -> {ok, removed}  owner only (never the owner's own rows)
--    * Admin RPC (authenticated, checks public.is_admin()):
--        admin_fl_overview() -> counts (leagues, members, devices, active / created in 7 days, top leagues)
--
--  Summary json (p_summary) the game sends (js/core/friends.js, from game.getCareerSummaryForBoard()):
--    {name, gender, nation, clubId, clubHe, ovr, goals, trophies, ballon, legacy}
--    name <= 30 chars (control / bidi / zero-width stripped, light profanity filter -> 'שחקן מהשכונה'),
--    numbers clamped: ovr 0-99, goals 0-5000, trophies 0-500, ballon 0-50, legacy 0-1000000.
--    Counters (goals, trophies, ballon, legacy) never go down; week_goals is computed HERE from the goals
--    delta between syncs (an Israeli week: Sunday to Saturday, Asia/Jerusalem).
--
--  Scope: this project is shared with other apps. Everything below touches ONLY the two new tables
--  (and reads public.admins through public.is_admin()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Guard: if some other app already owns a table with one of these names, stop here.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.friend_leagues') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'friend_leagues' and column_name = 'owner_device') then
    raise exception 'public.friend_leagues exists but is not the game''s table - update-2.3-friends.sql stopped (nothing was changed)';
  end if;
  if to_regclass('public.friend_league_members') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'friend_league_members' and column_name = 'week_goals') then
    raise exception 'public.friend_league_members exists but is not the game''s table - update-2.3-friends.sql stopped (nothing was changed)';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.friend_leagues (
  code         text primary key check (code ~ '^[A-Z2-9]{6,8}$'),
  name         text not null check (char_length(name) between 2 and 24),
  owner_device text not null,
  created_at   timestamptz not null default now(),
  renamed_at   timestamptz
);

create table if not exists public.friend_league_members (
  code       text not null references public.friend_leagues(code) on delete cascade,
  device_id  text not null,
  career_id  text not null,
  name       text not null check (char_length(name) between 1 and 30),
  gender     text not null default 'm' check (gender in ('m', 'f')),
  nation     text check (nation is null or char_length(nation) <= 8),
  club_id    text check (club_id is null or char_length(club_id) <= 24),
  club_he    text check (club_he is null or char_length(club_he) <= 60),
  ovr        int not null default 0,
  goals      int not null default 0,
  trophies   int not null default 0,
  ballon     int not null default 0,
  legacy     int not null default 0,
  week_goals int not null default 0,
  week_key   text,
  flagged    boolean not null default false,
  joined_at  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (code, device_id, career_id)
);

create index if not exists friend_leagues_owner_idx        on public.friend_leagues (owner_device, created_at);
create index if not exists friend_leagues_created_idx      on public.friend_leagues (created_at);
create index if not exists friend_league_members_dev_idx   on public.friend_league_members (device_id, career_id);
create index if not exists friend_league_members_upd_idx   on public.friend_league_members (updated_at);

alter table public.friend_leagues        enable row level security;
alter table public.friend_league_members enable row level security;
-- intentionally NO policies: anon / authenticated can never read or write the tables directly
revoke all on table public.friend_leagues, public.friend_league_members from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Helpers (granted to nobody; used inside the fl_* functions, which run as their owner)
-- ---------------------------------------------------------------------

-- display text: control, zero-width and bidi-override characters removed, whitespace collapsed, trimmed, cut
create or replace function public.hy_fl_clean(p text, p_max int default 30)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select nullif(btrim(left(btrim(regexp_replace(
           regexp_replace(coalesce(p, ''), '[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]', '', 'g'),
           '\s+', ' ', 'g')), greatest(coalesce(p_max, 30), 1))), '');
$$;

-- light profanity filter (Hebrew + English, a few leetspeak swaps): the public leaderboard's list + Hebrew prefixes
create or replace function public.hy_fl_bad(p text)
returns boolean
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v  text := lower(translate(coalesce(p, ''), '0134@$5!|', 'oieaassii'));
  vc text;
  t  text;
begin
  vc := regexp_replace(v, '[^a-zא-ת]', '', 'g');
  if vc ~ '(fuck|fuk|phuck|shit|cunt|nigg|whore|slut|porn|bitch|pussy|penis|vagina|hitler|nazi|wank|bastard|asshole|dildo)' then
    return true;
  end if;
  if vc ~ '(כוסאמ|כוסעמ|כוסאוחת|כוסאחת|כוסית|בנזונ|בןזונ|שרמוט|מזדיינ|מזדיין|לזיינ|לזיין|זיונים|מניאק|היטלר|נאצי|פורנו|קוקסינל|לאנוס|תמצוץ)' then
    return true;
  end if;
  foreach t in array regexp_split_to_array(btrim(regexp_replace(v, '[^a-zא-ת]+', ' ', 'g')), ' ')
  loop
    if t in ('זין', 'זיין', 'כוס', 'חרא', 'סקס', 'זונה', 'זונות', 'זיון', 'אנס', 'ass', 'sex', 'dick', 'cock', 'fag', 'tits', 'xxx', 'kkk', 'rape') then
      return true;
    end if;
    -- a Hebrew prefix letter (ה ו ב ל מ ש כ) in front of the words that never hide in ordinary words ("הזונות")
    if char_length(t) >= 4 and left(t, 1) in ('ה', 'ו', 'ב', 'ל', 'מ', 'ש', 'כ')
       and substr(t, 2) in ('זונה', 'זונות', 'זיון', 'זיונים', 'חרא', 'סקס') then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- a json number -> clamped int (null / string / NaN / 1e30 never fail the call)
create or replace function public.hy_fl_int(p jsonb, p_min int, p_max int)
returns int
language sql immutable
set search_path = public, pg_temp
as $$
  select (case when jsonb_typeof(p) = 'number'
               then least(greatest(round((p #>> '{}')::numeric), p_min), p_max)
               else p_min end)::int;
$$;

-- the Israeli week (Sunday..Saturday, Asia/Jerusalem): 'IYYY-Www' of the day after
create or replace function public.hy_fl_week()
returns text
language sql stable
set search_path = public, pg_temp
as $$
  select to_char(((now() at time zone 'Asia/Jerusalem')::date + 1), 'IYYY-"W"IW');
$$;

-- per-league member handle (no device / career id ever leaves the server)
create or replace function public.hy_fl_hash(p_code text, p_device text, p_career text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select left(md5(coalesce(p_code, '') || '|' || coalesce(p_device, '') || '|' || coalesce(p_career, '')), 10);
$$;

-- a new random league code: base32 without the ambiguous I O 0 1 (32 symbols -> byte & 31 is uniform)
create or replace function public.hy_fl_code(p_len int default 6)
returns text
language plpgsql volatile
set search_path = public, pg_temp
as $$
declare
  v_abc   constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_len   int := least(greatest(coalesce(p_len, 6), 6), 8);
  v_bytes bytea;
  v_out   text := '';
  i       int;
begin
  begin
    if to_regproc('extensions.gen_random_bytes') is not null then
      execute 'select extensions.gen_random_bytes($1)' into v_bytes using v_len;
    elsif to_regproc('public.gen_random_bytes') is not null then
      execute 'select public.gen_random_bytes($1)' into v_bytes using v_len;
    end if;
  exception when others then
    v_bytes := null;
  end;
  if v_bytes is null then
    -- pgcrypto missing: gen_random_uuid() (core since PostgreSQL 13) is also a CSPRNG
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  end if;
  for i in 0 .. v_len - 1 loop
    v_out := v_out || substr(v_abc, (get_byte(v_bytes, i) & 31) + 1, 1);
  end loop;
  return v_out;
end;
$$;

-- p_summary -> the cleaned member fields (or null when unusable)
create or replace function public.hy_fl_summary(p_summary jsonb)
returns jsonb
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  s        jsonb := p_summary;
  v_gender text;
  v_raw    text;
  v_bad    boolean;
  v_club   text;
  v_badc   boolean;
  v_nation text;
  v_clubid text;
begin
  if s is null or jsonb_typeof(s) <> 'object' or octet_length(s::text) > 4096 then
    return null;
  end if;
  v_raw := public.hy_fl_clean(s->>'name', 30);
  if v_raw is null then
    return null;
  end if;
  v_gender := case when lower(coalesce(s->>'gender', '')) in ('f', 'female', 'girl', 'w') then 'f' else 'm' end;
  v_bad := public.hy_fl_bad(v_raw);
  v_club := public.hy_fl_clean(coalesce(s->>'clubHe', s->>'club_he'), 60);
  v_badc := v_club is not null and public.hy_fl_bad(v_club);
  v_nation := lower(coalesce(s->>'nation', ''));
  v_clubid := lower(coalesce(s->>'clubId', s->>'club_id', s->>'club', ''));
  return jsonb_build_object(
    'name', case when v_bad then (case when v_gender = 'f' then 'שחקנית מהשכונה' else 'שחקן מהשכונה' end) else v_raw end,
    'flagged', v_bad or v_badc,
    'gender', v_gender,
    'nation', case when v_nation ~ '^[a-z0-9_]{2,8}$' then v_nation else null end,
    'club_id', case when v_clubid ~ '^[a-z0-9_]{1,24}$' then v_clubid else null end,
    'club_he', case when v_badc then null else v_club end,
    'ovr', public.hy_fl_int(s->'ovr', 0, 99),
    'goals', public.hy_fl_int(s->'goals', 0, 5000),
    'trophies', public.hy_fl_int(s->'trophies', 0, 500),
    'ballon', public.hy_fl_int(s->'ballon', 0, 50),
    'legacy', public.hy_fl_int(s->'legacy', 0, 1000000)
  );
end;
$$;

-- normalise a code typed / pasted by a player ("abc-123 " -> 'ABC123'); null when it cannot be a code
create or replace function public.hy_fl_norm_code(p text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select case when upper(regexp_replace(coalesce(p, ''), '[\s-]', '', 'g')) ~ '^[A-Z2-9]{6,8}$'
              then upper(regexp_replace(coalesce(p, ''), '[\s-]', '', 'g')) else null end;
$$;

-- ---------------------------------------------------------------------
-- 3. fl_create(): a new league owned by this device (optionally joining it with a career right away)
-- ---------------------------------------------------------------------
create or replace function public.fl_create(p_device text, p_name text, p_career text default null, p_summary jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name   text := public.hy_fl_clean(p_name, 24);
  v_code   text;
  v_n      int;
  v_try    int := 0;
  v_join   jsonb;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;
  if v_name is null or char_length(v_name) < 2 or public.hy_fl_bad(v_name) then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;
  select count(*) into v_n from public.friend_leagues where owner_device = p_device;
  if v_n >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;
  select count(*) into v_n from public.friend_leagues where owner_device = p_device and created_at > now() - interval '1 hour';
  if v_n >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  select count(*) into v_n from public.friend_leagues where created_at > now() - interval '1 minute';
  if v_n >= 120 then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;

  loop
    v_try := v_try + 1;
    v_code := public.hy_fl_code(case when v_try <= 4 then 6 when v_try <= 8 then 7 else 8 end);
    insert into public.friend_leagues (code, name, owner_device)
    values (v_code, v_name, p_device)
    on conflict (code) do nothing;
    exit when found;
    if v_try >= 12 then
      return jsonb_build_object('ok', false, 'error', 'busy');
    end if;
  end loop;

  if p_career is not null and p_summary is not null then
    v_join := public.fl_join(v_code, p_device, p_career, p_summary);
  end if;
  return jsonb_build_object('ok', true, 'code', v_code, 'name', v_name,
                            'joined', coalesce((v_join->>'ok')::boolean, false),
                            'join_error', v_join->>'error');
end;
$$;

-- ---------------------------------------------------------------------
-- 4. fl_join(): add (or refresh) this device + career in a league
-- ---------------------------------------------------------------------
create or replace function public.fl_join(p_code text, p_device text, p_career text, p_summary jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := public.hy_fl_norm_code(p_code);
  v_s    jsonb;
  v_lg   public.friend_leagues%rowtype;
  v_n    int;
  v_wk   text := public.hy_fl_week();
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;
  if p_career is null or p_career !~ '^[A-Za-z0-9_-]{4,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_career');
  end if;
  if v_code is null then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  v_s := public.hy_fl_summary(p_summary);
  if v_s is null then
    return jsonb_build_object('ok', false, 'error', 'bad_summary');
  end if;
  -- the league row lock serialises joins, so the 50 cap holds under parallel calls
  select * into v_lg from public.friend_leagues where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if exists (select 1 from public.friend_league_members where code = v_code and device_id = p_device and career_id = p_career) then
    update public.friend_league_members m
       set name = v_s->>'name', flagged = (v_s->>'flagged')::boolean, gender = v_s->>'gender',
           nation = coalesce(v_s->>'nation', m.nation), club_id = v_s->>'club_id', club_he = v_s->>'club_he',
           ovr = (v_s->>'ovr')::int,
           week_goals = case when m.week_key = v_wk then m.week_goals else 0 end
                        + least(greatest((v_s->>'goals')::int - m.goals, 0), 200),
           week_key = v_wk,
           goals = greatest(m.goals, (v_s->>'goals')::int),
           trophies = greatest(m.trophies, (v_s->>'trophies')::int),
           ballon = greatest(m.ballon, (v_s->>'ballon')::int),
           legacy = greatest(m.legacy, (v_s->>'legacy')::int),
           updated_at = now()
     where m.code = v_code and m.device_id = p_device and m.career_id = p_career;
    select count(*) into v_n from public.friend_league_members where code = v_code;
    return jsonb_build_object('ok', true, 'code', v_code, 'name', v_lg.name, 'members', v_n, 'already', true,
                              'owner', v_lg.owner_device = p_device);
  end if;

  select count(*) into v_n from public.friend_league_members where code = v_code;
  if v_n >= 50 then
    return jsonb_build_object('ok', false, 'error', 'full');
  end if;
  select count(*) into v_n from public.friend_league_members where code = v_code and device_id = p_device;
  if v_n >= 3 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;
  select count(*) into v_n from public.friend_league_members where device_id = p_device;
  if v_n >= 30 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;

  insert into public.friend_league_members (code, device_id, career_id, name, flagged, gender, nation, club_id, club_he,
                                            ovr, goals, trophies, ballon, legacy, week_goals, week_key)
  values (v_code, p_device, p_career, v_s->>'name', (v_s->>'flagged')::boolean, v_s->>'gender', v_s->>'nation',
          v_s->>'club_id', v_s->>'club_he', (v_s->>'ovr')::int, (v_s->>'goals')::int, (v_s->>'trophies')::int,
          (v_s->>'ballon')::int, (v_s->>'legacy')::int, 0, v_wk)
  on conflict (code, device_id, career_id) do nothing;

  select count(*) into v_n from public.friend_league_members where code = v_code;
  return jsonb_build_object('ok', true, 'code', v_code, 'name', v_lg.name, 'members', v_n, 'already', false,
                            'owner', v_lg.owner_device = p_device);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. fl_sync(): the career's latest summary -> every league this device + career is in
-- ---------------------------------------------------------------------
create or replace function public.fl_sync(p_device text, p_career text, p_summary jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_s  jsonb;
  v_n  int;
  v_wk text := public.hy_fl_week();
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;
  if p_career is null or p_career !~ '^[A-Za-z0-9_-]{4,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_career');
  end if;
  v_s := public.hy_fl_summary(p_summary);
  if v_s is null then
    return jsonb_build_object('ok', false, 'error', 'bad_summary');
  end if;
  if exists (select 1 from public.friend_league_members
             where device_id = p_device and career_id = p_career and updated_at > now() - interval '10 seconds') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  update public.friend_league_members m
     set name = v_s->>'name', flagged = (v_s->>'flagged')::boolean, gender = v_s->>'gender',
         nation = coalesce(v_s->>'nation', m.nation), club_id = v_s->>'club_id', club_he = v_s->>'club_he',
         ovr = (v_s->>'ovr')::int,
         week_goals = case when m.week_key = v_wk then m.week_goals else 0 end
                      + least(greatest((v_s->>'goals')::int - m.goals, 0), 200),
         week_key = v_wk,
         goals = greatest(m.goals, (v_s->>'goals')::int),
         trophies = greatest(m.trophies, (v_s->>'trophies')::int),
         ballon = greatest(m.ballon, (v_s->>'ballon')::int),
         legacy = greatest(m.legacy, (v_s->>'legacy')::int),
         updated_at = now()
   where m.device_id = p_device and m.career_id = p_career;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'updated', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. fl_get(): the league table. Anyone with the code may read it (the code is the invitation).
--    rank = row_number by legacy, trophies, goals, ovr, then who joined first (no shared medals).
-- ---------------------------------------------------------------------
create or replace function public.fl_get(p_code text, p_device text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := public.hy_fl_norm_code(p_code);
  v_dev  text := case when p_device ~ '^[A-Za-z0-9-]{8,64}$' then p_device else null end;
  v_lg   public.friend_leagues%rowtype;
  v_wk   text := public.hy_fl_week();
  v_res  jsonb;
begin
  if v_code is null then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  select * into v_lg from public.friend_leagues where code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  with r as (
    select m.*,
           case when m.week_key = v_wk then m.week_goals else 0 end as wg,
           row_number() over (order by m.legacy desc, m.trophies desc, m.goals desc, m.ovr desc, m.joined_at asc, m.career_id asc) as rk,
           coalesce(m.device_id = v_dev, false) as me,
           m.device_id = v_lg.owner_device as own
    from public.friend_league_members m
    where m.code = v_code
  ),
  k as (
    select r.* from r where r.wg > 0 order by r.wg desc, r.rk asc limit 1
  )
  select jsonb_build_object(
    'ok', true,
    'code', v_lg.code,
    'name', v_lg.name,
    'created_at', v_lg.created_at,
    'count', (select count(*) from r),
    'max', 50,
    'week_key', v_wk,
    'is_owner', coalesce(v_lg.owner_device = v_dev, false),
    'is_member', exists (select 1 from r where r.me),
    'generated_at', now(),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
                  'rank', r.rk, 'hash', public.hy_fl_hash(r.code, r.device_id, r.career_id),
                  'name', r.name, 'gender', r.gender, 'nation', r.nation, 'club_id', r.club_id, 'club_he', r.club_he,
                  'ovr', r.ovr, 'goals', r.goals, 'trophies', r.trophies, 'ballon', r.ballon, 'legacy', r.legacy,
                  'week_goals', r.wg, 'me', r.me, 'owner', r.own, 'updated_at', r.updated_at) order by r.rk)
                from r), '[]'::jsonb),
    'week_king', (select jsonb_build_object('hash', public.hy_fl_hash(k.code, k.device_id, k.career_id), 'name', k.name,
                                            'gender', k.gender, 'week_goals', k.wg, 'me', k.me) from k)
  ) into v_res;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. fl_mine(): the leagues of this device (owned or joined) - restores the local list on a new install
-- ---------------------------------------------------------------------
create or replace function public.fl_mine(p_device text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;
  return jsonb_build_object('ok', true, 'leagues', coalesce((
    select jsonb_agg(jsonb_build_object(
             'code', l.code, 'name', l.name,
             'role', case when l.owner_device = p_device then 'owner' else 'member' end,
             'career_id', (select m.career_id from public.friend_league_members m
                            where m.code = l.code and m.device_id = p_device order by m.updated_at desc limit 1),
             'members', (select count(*) from public.friend_league_members m where m.code = l.code)
           ) order by l.created_at)
    from public.friend_leagues l
    where l.owner_device = p_device
       or exists (select 1 from public.friend_league_members m where m.code = l.code and m.device_id = p_device)
  ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- 8. fl_leave(): remove this device's membership(s); hand over / delete the league when needed
-- ---------------------------------------------------------------------
create or replace function public.fl_leave(p_code text, p_device text, p_career text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code  text := public.hy_fl_norm_code(p_code);
  v_lg    public.friend_leagues%rowtype;
  v_n     int;
  v_next  text;
  v_moved boolean := false;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;
  if v_code is null then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  select * into v_lg from public.friend_leagues where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', true, 'removed', 0, 'deleted', false, 'owner_moved', false);
  end if;
  delete from public.friend_league_members
   where code = v_code and device_id = p_device
     and (p_career is null or career_id = p_career);
  get diagnostics v_n = row_count;

  if v_lg.owner_device = p_device
     and (p_career is null
          or not exists (select 1 from public.friend_league_members where code = v_code and device_id = p_device)) then
    select device_id into v_next from public.friend_league_members
     where code = v_code and device_id <> p_device
     order by joined_at asc, career_id asc limit 1;
    if v_next is null then
      delete from public.friend_leagues where code = v_code;   -- nobody else is left: the league goes away
      return jsonb_build_object('ok', true, 'removed', v_n, 'deleted', true, 'owner_moved', false);
    end if;
    update public.friend_leagues set owner_device = v_next where code = v_code;
    v_moved := true;
  elsif not exists (select 1 from public.friend_league_members where code = v_code) then
    delete from public.friend_leagues where code = v_code;
    return jsonb_build_object('ok', true, 'removed', v_n, 'deleted', true, 'owner_moved', false);
  end if;
  return jsonb_build_object('ok', true, 'removed', v_n, 'deleted', false, 'owner_moved', v_moved);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. fl_rename() / fl_remove(): owner only
-- ---------------------------------------------------------------------
create or replace function public.fl_rename(p_code text, p_device text, p_name text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := public.hy_fl_norm_code(p_code);
  v_name text := public.hy_fl_clean(p_name, 24);
  v_own  text;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;
  if v_code is null then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  select owner_device into v_own from public.friend_leagues where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_own <> p_device then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if v_name is null or char_length(v_name) < 2 or public.hy_fl_bad(v_name) then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;
  update public.friend_leagues set name = v_name, renamed_at = now() where code = v_code;
  return jsonb_build_object('ok', true, 'code', v_code, 'name', v_name);
end;
$$;

create or replace function public.fl_remove(p_code text, p_device text, p_member text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := public.hy_fl_norm_code(p_code);
  v_own  text;
  v_n    int;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;
  if v_code is null then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  if p_member is null or p_member !~ '^[0-9a-f]{10}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_member');
  end if;
  select owner_device into v_own from public.friend_leagues where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_own <> p_device then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if exists (select 1 from public.friend_league_members
             where code = v_code and device_id = p_device and public.hy_fl_hash(code, device_id, career_id) = p_member) then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;
  delete from public.friend_league_members
   where code = v_code and device_id <> p_device and public.hy_fl_hash(code, device_id, career_id) = p_member;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  return jsonb_build_object('ok', true, 'removed', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. admin_fl_overview(): counts for the dashboard
-- ---------------------------------------------------------------------
create or replace function public.admin_fl_overview()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with sizes as (
    select l.code, l.name, l.created_at, count(m.career_id) as n, max(m.updated_at) as last_active
    from public.friend_leagues l
    left join public.friend_league_members m on m.code = l.code
    group by l.code, l.name, l.created_at
  )
  select jsonb_build_object(
    'generated_at', now(),
    'leagues', (select count(*) from public.friend_leagues),
    'members', (select count(*) from public.friend_league_members),
    'devices', (select count(distinct device_id) from public.friend_league_members),
    'owners', (select count(distinct owner_device) from public.friend_leagues),
    'created_7d', (select count(*) from public.friend_leagues where created_at > now() - interval '7 days'),
    'joins_7d', (select count(*) from public.friend_league_members where joined_at > now() - interval '7 days'),
    'active_7d', (select count(*) from sizes where last_active > now() - interval '7 days'),
    'empty', (select count(*) from sizes where n = 0),
    'full', (select count(*) from sizes where n >= 50),
    'avg_members', coalesce((select round(avg(n)::numeric, 1) from sizes where n > 0), 0),
    'flagged', (select count(*) from public.friend_league_members where flagged),
    'top', coalesce((select jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name, 'members', t.n,
                                                         'created_at', t.created_at, 'last_active', t.last_active)
                                      order by t.n desc, t.last_active desc nulls last)
                     from (select * from sizes order by n desc, last_active desc nulls last limit 10) t), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Function privileges (Supabase auto-grants EXECUTE to anon: revoke everything, then grant exactly)
-- ---------------------------------------------------------------------
revoke execute on function public.hy_fl_clean(text, int) from public, anon, authenticated;
revoke execute on function public.hy_fl_bad(text) from public, anon, authenticated;
revoke execute on function public.hy_fl_int(jsonb, int, int) from public, anon, authenticated;
revoke execute on function public.hy_fl_week() from public, anon, authenticated;
revoke execute on function public.hy_fl_hash(text, text, text) from public, anon, authenticated;
revoke execute on function public.hy_fl_code(int) from public, anon, authenticated;
revoke execute on function public.hy_fl_summary(jsonb) from public, anon, authenticated;
revoke execute on function public.hy_fl_norm_code(text) from public, anon, authenticated;
revoke execute on function public.fl_create(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fl_join(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fl_sync(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fl_get(text, text) from public, anon, authenticated;
revoke execute on function public.fl_mine(text) from public, anon, authenticated;
revoke execute on function public.fl_leave(text, text, text) from public, anon, authenticated;
revoke execute on function public.fl_rename(text, text, text) from public, anon, authenticated;
revoke execute on function public.fl_remove(text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_fl_overview() from public, anon, authenticated;

grant execute on function public.fl_create(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.fl_join(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.fl_sync(text, text, jsonb) to anon, authenticated;
grant execute on function public.fl_get(text, text) to anon, authenticated;
grant execute on function public.fl_mine(text) to anon, authenticated;
grant execute on function public.fl_leave(text, text, text) to anon, authenticated;
grant execute on function public.fl_rename(text, text, text) to anon, authenticated;
grant execute on function public.fl_remove(text, text, text) to anon, authenticated;
grant execute on function public.admin_fl_overview() to authenticated;
-- hy_fl_*: granted to nobody (used only inside the functions above, which run as their owner).

-- Ask PostgREST to reload its schema cache so the new functions are visible immediately.
notify pgrst, 'reload schema';
