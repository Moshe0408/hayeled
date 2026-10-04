-- =====================================================================
--  הילד מהשכונה (hayeled) - update 2.2 for the admin dashboard
--  Training load + coach talks (docs/SPEC-2.2-training-bench.md, section 8).
--  Run AFTER supabase/schema.sql (and preferably after update-2.1.sql):
--  Supabase -> SQL Editor -> paste the WHOLE file -> Run.
--  Idempotent: safe to run again. Adds functions + one index on public.events
--  (no new tables, no data changes).
--
--  New admin RPCs (both check public.is_admin() first):
--    admin_stats_v3(p_days, p_tz) -> v2.2 statistics: training intensity distribution, burnouts,
--                                    training injuries, coach talks by approach with success rate
--    admin_players(p_limit, p_offset, p_search, p_sort)
--                                 -> the "שחקנים" tab: latest career_snapshot per (device, careerId)
--                                    + device platform / first_seen / last_seen + match_played count
--  admin_stats() (2.0) and admin_stats_v2() (2.1) are NOT changed.
--
--  Event shapes the 2.2 game sends (js/core/telemetry.js batches them; n = rows merged into one):
--    training        {focus, intensity, n}   intensity: light | normal | hard | extreme
--                                            focus 'rest' = a rest week (counted apart from the intensities)
--    burnout         {n}
--    injury_training {n}
--    coach_talk      {approach, success, n}  approach: ask | demand | threat, success: true | false
--    career_snapshot {name, nick, gender, nation, pos, club, clubHe, league, ovr, age, season, seasons,
--                     apps, goals, stage, careerId, why}
--                    sent on career start, season end, retirement, coaching start and once per app
--                    session when a saved career is opened. name = the character name chosen in the game.
--                    stage: youth | pro | free | manager | retired
--    career_started  also carries {name, nick} from 2.2
--
--  Scope: this project is shared with other apps. Everything below touches ONLY the
--  game's own objects (events, admins via is_admin()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. helper: how many rows an event stands for (same body as update-2.1.sql; re-created here so
--    this file also works on a server where update-2.1.sql was not run yet)
-- ---------------------------------------------------------------------
create or replace function public.hy_event_n(p_props jsonb)
returns int
language sql immutable
set search_path = public, pg_temp
as $$
  -- clamp in numeric first and cast last: a huge client-supplied n (e.g. 1e20) must not overflow int
  select (case when jsonb_typeof(p_props->'n') = 'number'
               then least(greatest(floor((p_props->>'n')::numeric), 1), 500)
               else 1 end)::int;
$$;

-- ---------------------------------------------------------------------
-- 2. admin_stats_v3(): the 2.2 statistics
-- ---------------------------------------------------------------------
create or replace function public.admin_stats_v3(p_days int default 30, p_tz text default 'Asia/Jerusalem')
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
  v_names text[] := array['training', 'burnout', 'injury_training', 'coach_talk'];
  v_res   jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'Asia/Jerusalem';
  end if;
  v_today := (now() at time zone v_tz)::date;
  v_from  := now() - make_interval(days => v_days + 1);

  with ev as (
    -- the 2.2 rows only, with their normalised keys
    select created_at,
           device_id,
           name,
           public.hy_event_n(props) as n,
           case when name = 'training' and props->>'focus' = 'rest' then 'rest'
                when name = 'training' and props->>'intensity' in ('light', 'normal', 'hard', 'extreme') then props->>'intensity'
                when name = 'training' then '?'
                else null end as intensity,
           coalesce(nullif(left(props->>'focus', 24), ''), '?') as focus,
           case when name = 'coach_talk' and props->>'approach' in ('ask', 'demand', 'threat') then props->>'approach'
                when name = 'coach_talk' then '?'
                else null end as approach,
           (props->>'success') = 'true' as success
    from public.events
    where name = any (v_names)
  )
  select jsonb_build_object(
    'schema', '2.2',
    'generated_at', now(),
    'days', v_days,

    -- training weeks (one row = n weeks of one focus + intensity)
    'training', jsonb_build_object(
      'weeks',    (select coalesce(sum(n), 0) from ev where name = 'training'),
      'weeks_7d', (select coalesce(sum(n), 0) from ev where name = 'training' and created_at > v_week),
      'devices',  (select count(distinct device_id) from ev where name = 'training'),
      'by_intensity', (select jsonb_build_object(
                         'light',   coalesce(sum(n) filter (where intensity = 'light'), 0),
                         'normal',  coalesce(sum(n) filter (where intensity = 'normal'), 0),
                         'hard',    coalesce(sum(n) filter (where intensity = 'hard'), 0),
                         'extreme', coalesce(sum(n) filter (where intensity = 'extreme'), 0),
                         'rest',    coalesce(sum(n) filter (where intensity = 'rest'), 0),
                         'unknown', coalesce(sum(n) filter (where intensity = '?'), 0))
                       from ev where name = 'training'),
      'by_intensity_7d', (select jsonb_build_object(
                         'light',   coalesce(sum(n) filter (where intensity = 'light'), 0),
                         'normal',  coalesce(sum(n) filter (where intensity = 'normal'), 0),
                         'hard',    coalesce(sum(n) filter (where intensity = 'hard'), 0),
                         'extreme', coalesce(sum(n) filter (where intensity = 'extreme'), 0),
                         'rest',    coalesce(sum(n) filter (where intensity = 'rest'), 0),
                         'unknown', coalesce(sum(n) filter (where intensity = '?'), 0))
                       from ev where name = 'training' and created_at > v_week),
      'by_focus', (
        select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
        from (select focus as k, sum(n) as c from ev where name = 'training'
              group by 1 order by 2 desc, 1 limit 12) t
      )
    ),

    -- burnouts (4 weeks in a row at load >= 80) and injuries picked up in training
    'burnout', jsonb_build_object(
      'total',    (select coalesce(sum(n), 0) from ev where name = 'burnout'),
      'total_7d', (select coalesce(sum(n), 0) from ev where name = 'burnout' and created_at > v_week),
      'devices',  (select count(distinct device_id) from ev where name = 'burnout')
    ),
    'injury_training', jsonb_build_object(
      'total',    (select coalesce(sum(n), 0) from ev where name = 'injury_training'),
      'total_7d', (select coalesce(sum(n), 0) from ev where name = 'injury_training' and created_at > v_week),
      'devices',  (select count(distinct device_id) from ev where name = 'injury_training')
    ),

    -- talks with the coach after a bench run, by approach
    'coach_talk', jsonb_build_object(
      'total',      (select coalesce(sum(n), 0) from ev where name = 'coach_talk'),
      'success',    (select coalesce(sum(n), 0) from ev where name = 'coach_talk' and success),
      'total_7d',   (select coalesce(sum(n), 0) from ev where name = 'coach_talk' and created_at > v_week),
      'success_7d', (select coalesce(sum(n), 0) from ev where name = 'coach_talk' and success and created_at > v_week),
      'devices',    (select count(distinct device_id) from ev where name = 'coach_talk'),
      'by_approach', (
        select jsonb_object_agg(a.k, jsonb_build_object(
                 'total',   coalesce((select sum(n) from ev where name = 'coach_talk' and approach = a.k), 0),
                 'success', coalesce((select sum(n) from ev where name = 'coach_talk' and approach = a.k and success), 0)))
        from unnest(array['ask', 'demand', 'threat']) as a(k)
      )
    ),

    -- per day (Israel time by default): burnouts, training injuries, coach talks
    'per_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(g.d, 'YYYY-MM-DD'),
                                                   'burnout', coalesce(x.b, 0),
                                                   'injury_training', coalesce(x.i, 0),
                                                   'coach_talk', coalesce(x.c, 0)) order by g.d), '[]'::jsonb)
      from (select gs::date as d
            from generate_series((v_today - (v_days - 1))::timestamp, v_today::timestamp, interval '1 day') gs) g
      left join (select (created_at at time zone v_tz)::date as dd,
                        sum(n) filter (where name = 'burnout') as b,
                        sum(n) filter (where name = 'injury_training') as i,
                        sum(n) filter (where name = 'coach_talk') as c
                 from ev
                 where created_at >= v_from and name <> 'training'
                 group by 1) x on x.dd = g.d
    )
  ) into v_res;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. "שחקנים" tab: index for the per-device lookups (latest career_snapshot, match_played counts)
-- ---------------------------------------------------------------------
create index if not exists events_name_device_created_idx on public.events (name, device_id, created_at);

-- helper: a jsonb value if it is a JSON number, else null (client-sent props are never trusted as numbers)
create or replace function public.hy_jnum(p jsonb)
returns jsonb
language sql immutable
set search_path = public, pg_temp
as $$
  select case when jsonb_typeof(p) = 'number' then p else null end;
$$;

-- ---------------------------------------------------------------------
-- 4. admin_players(): one row per career = the LATEST career_snapshot event per (device, careerId),
--    joined with the device (platform, first_seen, last_seen) and the device's match_played count.
--    p_limit:  1..200 (default 50)          p_offset: >= 0
--    p_search: part of the character name or nickname (case-insensitive, wildcards are escaped)
--    p_sort:   'last_seen' (default) | 'matches' | 'ovr'   (all descending)
--              'matches' = the career's own appearances (snapshot apps), then the device's match_played count
--    returns {schema, generated_at, total, limit, offset, sort, rows: [...]}
-- ---------------------------------------------------------------------
create or replace function public.admin_players(p_limit int default 50, p_offset int default 0,
                                                p_search text default null, p_sort text default 'last_seen')
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := least(greatest(coalesce(p_offset, 0), 0), 1000000);
  v_sort   text := case when p_sort in ('last_seen', 'matches', 'ovr') then p_sort else 'last_seen' end;
  v_q      text := nullif(btrim(left(coalesce(p_search, ''), 60)), '');
  v_pat    text := null;
  v_total  bigint;
  v_rows   jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_q is not null then
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with snap as (
    select distinct on (e.device_id, e.k) e.device_id, e.k as career_id, e.props, e.created_at
    from (select device_id, id, props, created_at,
                 coalesce(nullif(left(props->>'careerId', 64), ''), '-') as k
          from public.events
          where name = 'career_snapshot') e
    order by e.device_id, e.k, e.created_at desc, e.id desc
  ),
  m as (
    select device_id, count(*) as matches
    from public.events
    where name = 'match_played' and device_id in (select device_id from snap)
    group by device_id
  ),
  p as (
    select s.device_id, s.career_id, s.props, s.created_at as snap_at,
           d.platform, d.standalone, d.app_version, d.first_seen,
           coalesce(d.last_seen, s.created_at) as seen,
           coalesce(m.matches, 0) as matches,
           case when jsonb_typeof(s.props->'ovr') = 'number' then (s.props->>'ovr')::numeric end as ovr,
           case when jsonb_typeof(s.props->'apps') = 'number' then (s.props->>'apps')::numeric end as apps
    from snap s
    left join public.devices d on d.id = s.device_id
    left join m on m.device_id = s.device_id
    where v_pat is null
       or (coalesce(s.props->>'name', '') || ' ' || coalesce(s.props->>'nick', '')) ilike v_pat escape '\'
  )
  select (select count(*) from p),
         coalesce((
           select jsonb_agg(x.obj order by x.rn)
           from (
             select row_number() over (order by
                      case when v_sort = 'matches' then p.apps end desc nulls last,
                      case when v_sort = 'matches' then p.matches end desc nulls last,
                      case when v_sort = 'ovr' then p.ovr end desc nulls last,
                      p.seen desc nulls last, p.device_id, p.career_id) as rn,
                    jsonb_build_object(
                      'device_id',   p.device_id,
                      'career_id',   p.career_id,
                      'name',        left(p.props->>'name', 40),
                      'nick',        left(p.props->>'nick', 16),
                      'gender',      left(p.props->>'gender', 8),
                      'nation',      left(p.props->>'nation', 8),
                      'pos',         left(p.props->>'pos', 4),
                      'club',        left(p.props->>'club', 32),
                      'club_he',     left(p.props->>'clubHe', 60),
                      'league',      left(p.props->>'league', 12),
                      'stage',       left(p.props->>'stage', 12),
                      'why',         left(p.props->>'why', 12),
                      'ovr',         public.hy_jnum(p.props->'ovr'),
                      'age',         public.hy_jnum(p.props->'age'),
                      'season',      public.hy_jnum(p.props->'season'),
                      'seasons',     public.hy_jnum(p.props->'seasons'),
                      'apps',        public.hy_jnum(p.props->'apps'),
                      'goals',       public.hy_jnum(p.props->'goals'),
                      'matches',     p.matches,
                      'snapshot_at', p.snap_at,
                      'platform',    p.platform,
                      'standalone',  coalesce(p.standalone, false),
                      'app_version', p.app_version,
                      'first_seen',  p.first_seen,
                      'last_seen',   p.seen
                    ) as obj
             from p
             order by rn
             limit v_limit offset v_offset
           ) x), '[]'::jsonb)
  into v_total, v_rows;

  return jsonb_build_object(
    'schema', '2.2',
    'generated_at', now(),
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'sort', v_sort,
    'rows', v_rows
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Function privileges (Supabase auto-grants EXECUTE to anon: revoke, then grant to authenticated;
--    the admin functions still check is_admin() themselves)
-- ---------------------------------------------------------------------
revoke execute on function public.hy_event_n(jsonb) from public, anon, authenticated;
revoke execute on function public.hy_jnum(jsonb) from public, anon, authenticated;
revoke execute on function public.admin_stats_v3(int, text) from public, anon, authenticated;
revoke execute on function public.admin_players(int, int, text, text) from public, anon, authenticated;
grant execute on function public.admin_stats_v3(int, text) to authenticated;
grant execute on function public.admin_players(int, int, text, text) to authenticated;
-- hy_event_n, hy_jnum: granted to nobody (used only inside the admin_* functions, which run as their owner).

-- Ask PostgREST to reload its schema cache so the new functions are visible immediately.
notify pgrst, 'reload schema';
