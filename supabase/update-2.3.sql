-- =====================================================================
--  הילד מהשכונה (hayeled) - update 2.3: leaderboard + funnel analytics
--  Run AFTER supabase/schema.sql (and preferably after update-2.1.sql and update-2.2.sql):
--  Supabase -> SQL Editor -> paste the WHOLE file -> Run.
--  Idempotent: safe to run again. Never deletes data.
--
--  What it adds:
--    * ONE new table: public.hy_leaderboard (one row per career = device + careerId). The hy_ prefix
--      keeps it apart from any "leaderboard" table another app in this shared project might own.
--      RLS on, NO policies, no table privileges for anon / authenticated: only the functions below touch it.
--    * Player RPCs (anon may call ONLY these two, plus the 2.0 heartbeat / track_events / submit_feedback):
--        submit_career(p_device, p_career, p_name, p_gender, p_nation, p_club,
--                      p_ovr, p_goals, p_trophies, p_ballon, p_legacy)
--             -> {ok:true, id, rank, masked} | {ok:false, error:'bad_device'|'bad_career'|'bad_name'|'rate_limited'|'too_many'|'busy'}
--             upsert of the career's row; counters (goals, trophies, ballon, legacy) never go down;
--             name <= 30 chars, control / bidi / zero-width characters stripped, light profanity filter
--             (a bad name is replaced by 'שחקן מהשכונה' / 'שחקנית מהשכונה' and the row is flagged for the admin).
--             rate limits: one submit per career per 20 s, at most 10 new careers per device per day,
--             50 careers per device in total, 300 new rows per minute in the whole table.
--        get_leaderboard(p_kind 'legacy'|'goals'|'ballon', p_period 'all'|'week', p_limit 1..50,
--                        p_device, p_career)   (the last two are optional: "where am I")
--             -> {ok, kind, period, total, generated_at, rows:[{rank, name, gender, nation, club, ovr, goals,
--                 trophies, ballon, legacy, updated_at, mine}], me:{rank, ...}|null}
--             NEVER returns device ids or career ids. Hidden rows are never returned.
--    * Admin RPCs (each checks public.is_admin() first; authenticated only):
--        admin_funnel(p_days, p_tz)        -> funnel (visitors -> onboarding -> career -> first match -> weeks),
--                                             retention D1 / D7 (returning devices), 2.3 engagement counters
--        admin_leaderboard(p_limit, p_offset, p_search, p_filter)  -> moderation list (incl. hidden rows)
--        admin_leaderboard_hide(p_id, p_hidden)                    -> hide / show one row
--
--  Event shapes the 2.3 game sends (js/core/telemetry.js):
--    onboarding_step {step}      step: open | gender | name | random | advanced | kickoff (free text <= 24)
--    first_match_done {}         the debut match is over
--    week_reached {n}            n in 1, 3, 5, 10, 20, 40 (other values are never sent)
--    daily_reward {day, streak}  day 1..7 of the 7-day calendar
--    achievement {id, tier}      objective_done {id, kind}
--    share {kind, method}        leaderboard_view {kind, period}      challenge_open {valid}
--
--  Scope: this project is shared with other apps. Everything below touches ONLY the game's own
--  objects (events, sessions, devices, admins via is_admin()) and the new hy_leaderboard table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Guard: if some other app already owns a table called public.hy_leaderboard, stop here
--    instead of touching it.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.hy_leaderboard') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'hy_leaderboard' and column_name = 'career_id') then
    raise exception 'public.hy_leaderboard exists but is not the game''s table - update-2.3.sql stopped (nothing was changed)';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. The leaderboard table (one row per career)
-- ---------------------------------------------------------------------
create table if not exists public.hy_leaderboard (
  id          bigint generated always as identity primary key,
  device_id   text not null,
  career_id   text not null,
  name        text not null check (char_length(name) between 1 and 30),
  raw_name    text check (raw_name is null or char_length(raw_name) <= 30),   -- only for flagged rows (what was typed)
  gender      text not null default 'm' check (gender in ('m', 'f')),
  nation      text check (nation is null or char_length(nation) <= 8),
  club        text check (club is null or char_length(club) <= 60),
  ovr         int not null default 0,
  goals       int not null default 0,
  trophies    int not null default 0,
  ballon      int not null default 0,
  legacy      int not null default 0,
  submissions int not null default 1,
  flagged     boolean not null default false,
  hidden      boolean not null default false,
  hidden_at   timestamptz,
  hidden_by   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint hy_leaderboard_device_career_key unique (device_id, career_id)
);

create index if not exists hy_leaderboard_legacy_idx  on public.hy_leaderboard (legacy desc, id) where not hidden;
create index if not exists hy_leaderboard_goals_idx   on public.hy_leaderboard (goals desc, id)  where not hidden;
create index if not exists hy_leaderboard_ballon_idx  on public.hy_leaderboard (ballon desc, id) where not hidden;
create index if not exists hy_leaderboard_updated_idx on public.hy_leaderboard (updated_at);
create index if not exists hy_leaderboard_created_idx on public.hy_leaderboard (created_at);
create index if not exists hy_leaderboard_device_idx  on public.hy_leaderboard (device_id, created_at);

-- the funnel reads events per (name, device); same index as update-2.2.sql (re-created here if 2.2 was skipped)
create index if not exists events_name_device_created_idx on public.events (name, device_id, created_at);

alter table public.hy_leaderboard enable row level security;
-- intentionally NO policies: anon / authenticated can never read or write the table directly
revoke all on table public.hy_leaderboard from public, anon, authenticated;
revoke all on sequence public.hy_leaderboard_id_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Helpers (granted to nobody; used inside the functions below, which run as their owner)
-- ---------------------------------------------------------------------

-- a display name / club name: control, zero-width and bidi-override characters removed,
-- whitespace collapsed, trimmed, cut to p_max characters
create or replace function public.hy_clean_text(p text, p_max int default 30)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select nullif(btrim(left(btrim(regexp_replace(
           regexp_replace(coalesce(p, ''), '[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]', '', 'g'),
           '\s+', ' ', 'g')), greatest(coalesce(p_max, 30), 1))), '');
$$;

-- light profanity filter (Hebrew + English, a few leetspeak swaps). Errs on the side of letting names through.
create or replace function public.hy_bad_name(p text)
returns boolean
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v  text := lower(translate(coalesce(p, ''), '0134@$5!|', 'oieaassii'));
  vc text;
  t  text;
begin
  vc := regexp_replace(v, '[^a-zא-ת]', '', 'g');     -- letters only ("f.u.c.k" -> "fuck", "כוס אמא" -> "כוסאמא")
  -- substrings of the letters-only form (only stems that do not hide inside ordinary names / words)
  if vc ~ '(fuck|fuk|phuck|shit|cunt|nigg|whore|slut|porn|bitch|pussy|penis|vagina|hitler|nazi|wank|bastard|asshole|dildo)' then
    return true;
  end if;
  if vc ~ '(כוסאמ|כוסעמ|כוסאוחת|כוסאחת|כוסית|בנזונ|בןזונ|שרמוט|מזדיינ|מזדיין|לזיינ|לזיין|זיונים|מניאק|היטלר|נאצי|פורנו|קוקסינל|לאנוס|תמצוץ)' then
    return true;
  end if;
  -- whole words only (these hide inside ordinary words: "חזיון", "אמזונה", "אנסטסיה", "grape")
  foreach t in array regexp_split_to_array(btrim(regexp_replace(v, '[^a-zא-ת]+', ' ', 'g')), ' ')
  loop
    if t in ('זין', 'זיין', 'כוס', 'חרא', 'סקס', 'זונה', 'זונות', 'זיון', 'אנס', 'ass', 'sex', 'dick', 'cock', 'fag', 'tits', 'xxx', 'kkk', 'rape') then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- a client number -> clamped int (null / NaN / huge values never fail the call)
create or replace function public.hy_clamp_int(p numeric, p_min int, p_max int)
returns int
language sql immutable
set search_path = public, pg_temp
as $$
  select (case when p is null or p = 'NaN'::numeric then p_min
               else least(greatest(round(p), p_min), p_max) end)::int;
$$;

-- ---------------------------------------------------------------------
-- 3. submit_career(): the game sends the career's summary at every season end (and at retirement).
--    Upsert by (device, careerId). Counters never go down (an older backup re-opened later cannot
--    erase a record); ovr / name / club / nation are the latest values.
-- ---------------------------------------------------------------------
create or replace function public.submit_career(
  p_device text, p_career text, p_name text, p_gender text default 'm', p_nation text default null,
  p_club text default null, p_ovr numeric default 0, p_goals numeric default 0, p_trophies numeric default 0,
  p_ballon numeric default 0, p_legacy numeric default 0)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name   text;
  v_raw    text;
  v_bad    boolean := false;
  v_badc   boolean := false;
  v_gender text := case when lower(coalesce(p_gender, '')) in ('f', 'female', 'girl', 'w') then 'f' else 'm' end;
  v_nation text := case when lower(coalesce(p_nation, '')) ~ '^[a-z0-9_]{2,8}$' then lower(p_nation) else null end;
  v_club   text := public.hy_clean_text(p_club, 40);
  v_ovr    int := public.hy_clamp_int(p_ovr, 0, 99);
  v_goals  int := public.hy_clamp_int(p_goals, 0, 1500);
  v_troph  int := public.hy_clamp_int(p_trophies, 0, 100);
  v_ballon int := public.hy_clamp_int(p_ballon, 0, 15);
  v_legacy int := public.hy_clamp_int(p_legacy, 0, 3000);
  v_id     bigint;
  v_upd    timestamptz;
  v_hidden boolean;
  v_leg    int;
  v_n      int;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;
  if p_career is null or p_career !~ '^[A-Za-z0-9_-]{4,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_career');
  end if;
  v_raw := public.hy_clean_text(p_name, 30);
  if v_raw is null then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;
  -- numbers no real career reaches are rejected (not clamped): a forged row never tops the board
  if coalesce(p_ovr, 0) > 99 or coalesce(p_goals, 0) > 1500 or coalesce(p_trophies, 0) > 100 or coalesce(p_ballon, 0) > 15
     or coalesce(p_legacy, 0) > 3000 or least(coalesce(p_ovr, 0), coalesce(p_goals, 0), coalesce(p_trophies, 0),
                                              coalesce(p_ballon, 0), coalesce(p_legacy, 0)) < 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_stats');
  end if;
  -- only a device the game itself registered (telemetry start): it exists in public.devices and has a session,
  -- or was first seen more than 2 minutes ago. Made-up device ids cannot skip the per-device limits.
  if not exists (select 1 from public.devices d
                  where d.id = p_device
                    and (d.first_seen < now() - interval '2 minutes'
                         or exists (select 1 from public.sessions s where s.device_id = d.id))) then
    return jsonb_build_object('ok', false, 'error', 'unknown_device');
  end if;
  -- the club is a club name from the game: letters, digits, spaces and a few marks. No links, no addresses.
  if v_club is not null and (v_club !~ '^[A-Za-z0-9 ''"א-ת׳״.()-]{2,40}$'
                             or v_club ~* '(www|http|://|@|\.(com|net|org|io|co|ly|me|xyz|ru|il|info|biz)\M)') then
    v_club := null;
  end if;
  v_badc := v_club is not null and public.hy_bad_name(v_club);
  if v_badc then
    v_club := null;            -- the club is the game's own Hebrew club name; a bad one is simply dropped
  end if;
  v_bad := public.hy_bad_name(v_raw);
  v_name := case when v_bad then (case when v_gender = 'f' then 'שחקנית מהשכונה' else 'שחקן מהשכונה' end) else v_raw end;

  select id, updated_at into v_id, v_upd
  from public.hy_leaderboard
  where device_id = p_device and career_id = p_career
  for update;

  if found then
    if v_upd > now() - interval '20 seconds' then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
    update public.hy_leaderboard
       set name = v_name,
           raw_name = case when v_bad then v_raw else null end,
           flagged = v_bad or v_badc,
           gender = v_gender,
           nation = coalesce(v_nation, nation),
           club = v_club,
           ovr = v_ovr,
           goals = greatest(goals, v_goals),
           trophies = greatest(trophies, v_troph),
           ballon = greatest(ballon, v_ballon),
           legacy = greatest(legacy, v_legacy),
           submissions = least(submissions + 1, 1000000),
           updated_at = now()
     where id = v_id;
  else
    -- a new career on this device: per-device and global flood limits
    select count(*) into v_n from public.hy_leaderboard
     where device_id = p_device and created_at > now() - interval '1 day';
    if v_n >= 10 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
    select count(*) into v_n from public.hy_leaderboard where device_id = p_device;
    if v_n >= 50 then
      return jsonb_build_object('ok', false, 'error', 'too_many');
    end if;
    select count(*) into v_n from public.hy_leaderboard where created_at > now() - interval '1 minute';
    if v_n >= 60 then
      return jsonb_build_object('ok', false, 'error', 'busy');
    end if;
    insert into public.hy_leaderboard (device_id, career_id, name, raw_name, flagged, gender, nation, club,
                                       ovr, goals, trophies, ballon, legacy)
    values (p_device, p_career, v_name, case when v_bad then v_raw else null end, v_bad or v_badc, v_gender, v_nation, v_club,
            v_ovr, v_goals, v_troph, v_ballon, v_legacy)
    on conflict (device_id, career_id) do nothing
    returning id into v_id;
    if v_id is null then
      -- the same career was inserted by a parallel call a moment ago
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
  end if;

  select hidden, legacy into v_hidden, v_leg from public.hy_leaderboard where id = v_id;
  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'masked', v_bad,
    'name', v_name,
    -- all-time legacy rank (ties share a rank); null while an admin has hidden the row
    'rank', case when v_hidden then null
                 else (select count(*) + 1 from public.hy_leaderboard where not hidden and legacy > v_leg) end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. get_leaderboard(): the public table. kind 'legacy' (default) | 'goals' | 'ballon';
--    period 'all' (default) | 'week' (careers submitted in the last 7 days).
--    'goals' lists careers with at least 1 goal, 'ballon' careers with at least 1 Ballon d''Or.
--    rank = rank() by the kind's number (ties share a rank). No device / career ids leave the server:
--    p_device + p_career only mark the caller's own row ("mine") and fill "me".
-- ---------------------------------------------------------------------
create or replace function public.get_leaderboard(p_kind text default 'legacy', p_period text default 'all',
                                                  p_limit int default 50, p_device text default null,
                                                  p_career text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_kind   text := case when p_kind in ('legacy', 'goals', 'ballon') then p_kind else 'legacy' end;
  v_period text := case when p_period = 'week' then 'week' else 'all' end;
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 50);
  v_since  timestamptz := case when p_period = 'week' then now() - interval '7 days' else '-infinity'::timestamptz end;
  v_dev    text := case when p_device ~ '^[A-Za-z0-9-]{8,64}$' then p_device else null end;
  v_car    text := case when p_career ~ '^[A-Za-z0-9_-]{4,64}$' then p_career else null end;
  v_res    jsonb;
begin
  with b as (
    select l.id, l.name, l.gender, l.nation, l.club, l.ovr, l.goals, l.trophies, l.ballon, l.legacy, l.updated_at,
           case v_kind when 'goals' then l.goals when 'ballon' then l.ballon else l.legacy end as metric,
           coalesce(v_dev is not null and v_car is not null and l.device_id = v_dev and l.career_id = v_car, false) as mine
    from public.hy_leaderboard l
    where not l.hidden
      and l.updated_at >= v_since
      and (v_kind <> 'goals' or l.goals > 0)
      and (v_kind <> 'ballon' or l.ballon > 0)
  ),
  r as (
    select b.*,
           rank() over (order by b.metric desc) as rk,
           row_number() over (order by b.metric desc, b.legacy desc, b.ballon desc, b.trophies desc, b.goals desc,
                                       b.updated_at asc, b.id asc) as rn
    from b
  ),
  obj as (
    select r.rn, r.mine,
           jsonb_build_object('rank', r.rk, 'name', r.name, 'gender', r.gender, 'nation', r.nation, 'club', r.club,
                              'ovr', r.ovr, 'goals', r.goals, 'trophies', r.trophies, 'ballon', r.ballon,
                              'legacy', r.legacy, 'updated_at', r.updated_at, 'mine', r.mine) as o
    from r
  )
  select jsonb_build_object(
    'ok', true,
    'kind', v_kind,
    'period', v_period,
    'generated_at', now(),
    'total', (select count(*) from obj),
    'rows', coalesce((select jsonb_agg(t.o order by t.rn) from (select o, rn from obj order by rn limit v_limit) t), '[]'::jsonb),
    'me', (select obj.o || jsonb_build_object('in_top', obj.rn <= v_limit) from obj where obj.mine limit 1)
  ) into v_res;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. admin_funnel(): where new players drop off, who comes back, what the 2.3 features do.
--    Cohort = devices first seen in the last p_days days (Israel calendar days by default).
--    Funnel steps are cumulative ("reached this step or a later one"), so the numbers never grow
--    down the funnel:
--      visitors     the device opened the game
--      onboarding   onboarding_step (2.3) or any later step
--      career       career_started or any later step (a returning player with an older career counts too)
--      first_match  first_match_done (2.3) or match_played or any later step
--      week_N       week_reached {n >= N} (2.3) or, for older builds, at least N match_played events
--    Retention (classic): D1 = active on the calendar day after the first visit, D7 = on day 7.
--    "returned" = active on any later day. Activity = public.sessions (heartbeats).
-- ---------------------------------------------------------------------
create or replace function public.admin_funnel(p_days int default 30, p_tz text default 'Asia/Jerusalem')
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_days  int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_tz    text := coalesce(p_tz, 'Asia/Jerusalem');
  v_today date;
  v_from  timestamptz;
  v_week  timestamptz := now() - interval '7 days';
  v_cdays int;
  v_funnel jsonb;
  v_ret    jsonb;
  v_coh    jsonb;
  v_steps  jsonb;
  v_eng    jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'Asia/Jerusalem';
  end if;
  v_today := (now() at time zone v_tz)::date;
  v_from  := ((v_today - (v_days - 1))::timestamp at time zone v_tz);   -- local midnight, v_days calendar days ago
  v_cdays := least(v_days, 14);

  -- ---- the funnel ----
  with coh as (
    select d.id from public.devices d where d.first_seen >= v_from
  ),
  ev as (
    select e.device_id,
           bool_or(e.name = 'onboarding_step') as onb,
           bool_or(e.name = 'career_started') as car,
           bool_or(e.name in ('first_match_done', 'match_played')) as m1,
           count(*) filter (where e.name = 'match_played') as mp,
           max(case when e.name = 'week_reached' and jsonb_typeof(e.props->'n') = 'number'
                    then least((e.props->>'n')::numeric, 100000) end) as wk
    from public.events e
    where e.name in ('onboarding_step', 'career_started', 'first_match_done', 'match_played', 'week_reached')
      and e.device_id in (select id from coh)
    group by e.device_id
  ),
  f as (
    select c.id,
           coalesce(e.onb, false) as onb_raw,
           coalesce(e.car, false) as car_raw,
           greatest(coalesce(e.wk, 0), coalesce(e.mp, 0)) as wk,
           coalesce(e.m1, false) or greatest(coalesce(e.wk, 0), coalesce(e.mp, 0)) >= 1 as s_m1
    from coh c left join ev e on e.device_id = c.id
  ),
  g as (
    select f.*, (f.car_raw or f.s_m1) as s_car, (f.onb_raw or f.car_raw or f.s_m1) as s_onb from f
  )
  select jsonb_build_object(
    'visitors',    count(*),
    'onboarding',  count(*) filter (where s_onb),
    'career',      count(*) filter (where s_car),
    'first_match', count(*) filter (where s_m1),
    'week_1',      count(*) filter (where wk >= 1),
    'week_3',      count(*) filter (where wk >= 3),
    'week_5',      count(*) filter (where wk >= 5),
    'week_10',     count(*) filter (where wk >= 10),
    'week_20',     count(*) filter (where wk >= 20),
    'week_40',     count(*) filter (where wk >= 40),
    'new_careers', count(*) filter (where car_raw),
    'returning_careers', count(*) filter (where s_m1 and not car_raw),
    'onboarding_raw', count(*) filter (where onb_raw))
  into v_funnel
  from g;

  -- which onboarding steps the cohort reached (distinct devices per step)
  select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'devices', t.c) order by t.c desc, t.k), '[]'::jsonb)
  into v_steps
  from (select coalesce(nullif(left(e.props->>'step', 24), ''), '?') as k, count(distinct e.device_id) as c
        from public.events e
        where e.name = 'onboarding_step'
          and e.device_id in (select d.id from public.devices d where d.first_seen >= v_from)
        group by 1 order by 2 desc, 1 limit 12) t;

  -- ---- retention ----
  with coh as (
    select d.id, (d.first_seen at time zone v_tz)::date as d0
    from public.devices d where d.first_seen >= v_from
  ),
  act as (
    select distinct s.device_id, (x.t at time zone v_tz)::date as day
    from public.sessions s
    cross join lateral (values (s.started_at), (s.last_seen)) as x(t)
    where s.device_id in (select id from coh)
  ),
  r as (
    select c.id, c.d0,
           coalesce(bool_or(a.day = c.d0 + 1), false) as d1,
           coalesce(bool_or(a.day = c.d0 + 7), false) as d7,
           coalesce(bool_or(a.day > c.d0), false) as back,
           coalesce(bool_or(a.day >= c.d0 + 7), false) as back7
    from coh c left join act a on a.device_id = c.id
    group by c.id, c.d0
  )
  select jsonb_build_object(
           'cohort',      (select count(*) from r),
           'eligible_d1', (select count(*) from r where d0 <= v_today - 1),
           'd1',          (select count(*) from r where d0 <= v_today - 1 and d1),
           'eligible_d7', (select count(*) from r where d0 <= v_today - 7),
           'd7',          (select count(*) from r where d0 <= v_today - 7 and d7),
           'returned',    (select count(*) from r where d0 <= v_today - 1 and back),
           'returned_7',  (select count(*) from r where d0 <= v_today - 7 and back7)),
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'day', to_char(g.d, 'YYYY-MM-DD'),
                    'new', (select count(*) from r where r.d0 = g.d),
                    'd1', case when g.d <= v_today - 1 then (select count(*) from r where r.d0 = g.d and r.d1) end,
                    'd7', case when g.d <= v_today - 7 then (select count(*) from r where r.d0 = g.d and r.d7) end)
                  order by g.d desc), '[]'::jsonb)
          from (select gs::date as d
                from generate_series((v_today - (v_cdays - 1))::timestamp, v_today::timestamp, interval '1 day') gs) g)
  into v_ret, v_coh;

  -- ---- 2.3 engagement (all time + last 7 days) ----
  with e as (
    select name, device_id, props, created_at
    from public.events
    where name in ('daily_reward', 'achievement', 'objective_done', 'share', 'leaderboard_view',
                   'challenge_open', 'first_match_done', 'week_reached', 'onboarding_step')
  )
  select jsonb_build_object(
    'daily_reward', jsonb_build_object(
      'total',    (select count(*) from e where name = 'daily_reward'),
      'total_7d', (select count(*) from e where name = 'daily_reward' and created_at > v_week),
      'devices',  (select count(distinct device_id) from e where name = 'daily_reward'),
      'max_streak', (select coalesce(max(least((props->>'streak')::numeric, 100000)), 0) from e
                     where name = 'daily_reward' and jsonb_typeof(props->'streak') = 'number'),
      'by_day', (select jsonb_object_agg(k.d::text, (select count(*) from e where name = 'daily_reward' and props->>'day' = k.d::text))
                 from generate_series(1, 7) as k(d))),
    'achievements', jsonb_build_object(
      'total',    (select count(*) from e where name = 'achievement'),
      'total_7d', (select count(*) from e where name = 'achievement' and created_at > v_week),
      'devices',  (select count(distinct device_id) from e where name = 'achievement'),
      'top', (select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c, 'devices', t.dv) order by t.c desc, t.k), '[]'::jsonb)
              from (select coalesce(nullif(left(props->>'id', 40), ''), '?') as k, count(*) as c, count(distinct device_id) as dv
                    from e where name = 'achievement' group by 1 order by 2 desc, 1 limit 15) t)),
    'objectives', jsonb_build_object(
      'total',    (select count(*) from e where name = 'objective_done'),
      'total_7d', (select count(*) from e where name = 'objective_done' and created_at > v_week),
      'devices',  (select count(distinct device_id) from e where name = 'objective_done'),
      'top', (select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
              from (select coalesce(nullif(left(props->>'id', 40), ''), '?') as k, count(*) as c
                    from e where name = 'objective_done' group by 1 order by 2 desc, 1 limit 10) t)),
    'share', jsonb_build_object(
      'total',    (select count(*) from e where name = 'share'),
      'total_7d', (select count(*) from e where name = 'share' and created_at > v_week),
      'devices',  (select count(distinct device_id) from e where name = 'share'),
      'by_kind', (select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
                  from (select coalesce(nullif(left(props->>'kind', 24), ''), '?') as k, count(*) as c
                        from e where name = 'share' group by 1 order by 2 desc, 1 limit 12) t),
      'by_method', (select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
                    from (select coalesce(nullif(left(props->>'method', 24), ''), '?') as k, count(*) as c
                          from e where name = 'share' group by 1 order by 2 desc, 1 limit 6) t)),
    'leaderboard_view', jsonb_build_object(
      'total',    (select count(*) from e where name = 'leaderboard_view'),
      'total_7d', (select count(*) from e where name = 'leaderboard_view' and created_at > v_week),
      'devices',  (select count(distinct device_id) from e where name = 'leaderboard_view')),
    'challenge_open', jsonb_build_object(
      'total',    (select count(*) from e where name = 'challenge_open'),
      'valid',    (select count(*) from e where name = 'challenge_open' and coalesce(props->>'valid', 'true') <> 'false'),
      'total_7d', (select count(*) from e where name = 'challenge_open' and created_at > v_week),
      'devices',  (select count(distinct device_id) from e where name = 'challenge_open')),
    'first_match_done', jsonb_build_object(
      'total',   (select count(*) from e where name = 'first_match_done'),
      'devices', (select count(distinct device_id) from e where name = 'first_match_done')),
    'week_reached', (select jsonb_agg(jsonb_build_object('n', k.n,
                       'devices', (select count(distinct device_id) from e
                                   where name = 'week_reached' and jsonb_typeof(props->'n') = 'number'
                                     and (props->>'n')::numeric >= k.n)) order by k.n)
                     from unnest(array[1, 3, 5, 10, 20, 40]) as k(n))
  ) into v_eng;

  return jsonb_build_object(
    'schema', '2.3',
    'generated_at', now(),
    'days', v_days,
    'tz', v_tz,
    'funnel', v_funnel,
    'onboarding_steps', v_steps,
    'retention', v_ret,
    'cohorts', v_coh,
    'engagement', v_eng,
    'leaderboard', (select jsonb_build_object(
                      'entries',     count(*),
                      'visible',     count(*) filter (where not hidden),
                      'hidden',      count(*) filter (where hidden),
                      'flagged',     count(*) filter (where flagged),
                      'devices',     count(distinct device_id),
                      'submissions', coalesce(sum(submissions), 0),
                      'new_7d',      count(*) filter (where created_at > v_week),
                      'updated_7d',  count(*) filter (where updated_at > v_week))
                    from public.hy_leaderboard)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. admin_leaderboard(): moderation list, newest activity first (hidden rows included).
--    p_filter: 'all' (default) | 'visible' | 'hidden' | 'flagged'
--    p_search: part of the name (case-insensitive; also matches the original name of a flagged row)
-- ---------------------------------------------------------------------
create or replace function public.admin_leaderboard(p_limit int default 50, p_offset int default 0,
                                                    p_search text default null, p_filter text default 'all')
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := least(greatest(coalesce(p_offset, 0), 0), 1000000);
  v_filter text := case when p_filter in ('all', 'visible', 'hidden', 'flagged') then p_filter else 'all' end;
  v_q      text := nullif(btrim(left(coalesce(p_search, ''), 60)), '');
  v_pat    text := null;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_q is not null then
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  return (
    with l as (
      select * from public.hy_leaderboard
      where (v_filter = 'all'
             or (v_filter = 'visible' and not hidden)
             or (v_filter = 'hidden' and hidden)
             or (v_filter = 'flagged' and flagged))
        and (v_pat is null or name ilike v_pat escape '\' or coalesce(raw_name, '') ilike v_pat escape '\')
    )
    select jsonb_build_object(
      'schema', '2.3',
      'generated_at', now(),
      'filter', v_filter,
      'limit', v_limit,
      'offset', v_offset,
      'total', (select count(*) from l),
      'counts', (select jsonb_build_object('all', count(*), 'visible', count(*) filter (where not hidden),
                                           'hidden', count(*) filter (where hidden), 'flagged', count(*) filter (where flagged))
                 from public.hy_leaderboard),
      'rows', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.updated_at desc, x.id desc)
        from (select id, device_id, career_id, name, raw_name, gender, nation, club, ovr, goals, trophies, ballon,
                     legacy, submissions, flagged, hidden, hidden_at, hidden_by, created_at, updated_at,
                     (select count(*) + 1 from public.hy_leaderboard o where not o.hidden and o.legacy > l.legacy) as legacy_rank
              from l
              order by updated_at desc, id desc
              limit v_limit offset v_offset) x), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. admin_leaderboard_hide(): hide (p_hidden = true, default) or show again one row
-- ---------------------------------------------------------------------
create or replace function public.admin_leaderboard_hide(p_id bigint, p_hidden boolean default true)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_h boolean := coalesce(p_hidden, true);
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.hy_leaderboard
     set hidden = v_h,
         hidden_at = case when v_h then now() else null end,
         hidden_by = case when v_h then left(auth.jwt()->>'email', 200) else null end
   where id = p_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0, 'id', p_id, 'hidden', v_h, 'updated', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Function privileges (Supabase auto-grants EXECUTE to anon: revoke everything, then grant exactly)
-- ---------------------------------------------------------------------
revoke execute on function public.hy_clean_text(text, int) from public, anon, authenticated;
revoke execute on function public.hy_bad_name(text) from public, anon, authenticated;
revoke execute on function public.hy_clamp_int(numeric, int, int) from public, anon, authenticated;
revoke execute on function public.submit_career(text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.get_leaderboard(text, text, int, text, text) from public, anon, authenticated;
revoke execute on function public.admin_funnel(int, text) from public, anon, authenticated;
revoke execute on function public.admin_leaderboard(int, int, text, text) from public, anon, authenticated;
revoke execute on function public.admin_leaderboard_hide(bigint, boolean) from public, anon, authenticated;

grant execute on function public.submit_career(text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric) to anon, authenticated;
grant execute on function public.get_leaderboard(text, text, int, text, text) to anon, authenticated;
grant execute on function public.admin_funnel(int, text) to authenticated;
grant execute on function public.admin_leaderboard(int, int, text, text) to authenticated;
grant execute on function public.admin_leaderboard_hide(bigint, boolean) to authenticated;
-- hy_clean_text, hy_bad_name, hy_clamp_int: granted to nobody (used only inside the functions above).

-- Ask PostgREST to reload its schema cache so the new functions are visible immediately.
notify pgrst, 'reload schema';
