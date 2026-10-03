-- =====================================================================
--  הילד מהשכונה (hayeled) - update 2.1 for the admin dashboard
--  Run AFTER supabase/schema.sql: Supabase -> SQL Editor -> paste the WHOLE file -> Run.
--  Idempotent: safe to run again. Adds functions only (no new tables, no data changes).
--
--  New admin RPCs (all check public.is_admin() first):
--    admin_stats_v2(p_days, p_tz)          -> v2.1 statistics (gender, manager careers, intro,
--                                             goals + mega celebrations, retirements by league/tier)
--    admin_feedback_v2(p_limit, p_offset, p_unread_only, p_rating)
--                                          -> paged feedback with a star filter + counts per rating
--    admin_delete_feedback(p_id)           -> delete one feedback row
--    admin_reset_stats(p_confirm)          -> wipes devices / sessions / events / feedback of THIS game
--                                             only, and only when p_confirm = 'RESET'
--
--  Scope: this project is shared with other apps. Everything below touches ONLY the
--  game's own objects (devices, sessions, events, feedback, app_config, admins).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. helper: how many goals an event row stands for
--    (the game batches goals: {"mega":false,"n":3}; a plain {"mega":true} counts as 1)
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
-- 2. admin_stats_v2(): the 2.1 statistics (the v2.0 admin_stats() is unchanged)
-- ---------------------------------------------------------------------
create or replace function public.admin_stats_v2(p_days int default 30, p_tz text default 'Asia/Jerusalem')
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
  v_top5  text[] := array['eng1', 'esp1', 'ita1', 'ger1', 'fra1'];
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

  select jsonb_build_object(
    'schema', '2.1',
    'generated_at', now(),
    'days', v_days,

    -- careers by gender ('m' boy / 'f' girl)
    'careers_by_gender', (
      select jsonb_build_object(
        'm', count(*) filter (where props->>'gender' = 'm'),
        'f', count(*) filter (where props->>'gender' = 'f'),
        'unknown', count(*) filter (where coalesce(props->>'gender', '') not in ('m', 'f')),
        'm_7d', count(*) filter (where props->>'gender' = 'm' and created_at > v_week),
        'f_7d', count(*) filter (where props->>'gender' = 'f' and created_at > v_week))
      from public.events where name = 'career_started'
    ),
    'careers_per_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(g.d, 'YYYY-MM-DD'),
                                                   'm', coalesce(x.m, 0), 'f', coalesce(x.f, 0)) order by g.d), '[]'::jsonb)
      from (select gs::date as d
            from generate_series((v_today - (v_days - 1))::timestamp, v_today::timestamp, interval '1 day') gs) g
      left join (select (created_at at time zone v_tz)::date as dd,
                        count(*) filter (where props->>'gender' = 'm') as m,
                        count(*) filter (where props->>'gender' = 'f') as f
                 from public.events
                 where name = 'career_started' and created_at >= v_from
                 group by 1) x on x.dd = g.d
    ),

    -- manager / coach careers. manager_started fires for every job; {first:true} marks the first job
    -- of a career (a row without "first" counts as a first job). by_tier / by_gender use first jobs only.
    'manager', jsonb_build_object(
      'started',    (select count(*) from public.events where name = 'manager_started' and coalesce(props->>'first', 'true') <> 'false'),
      'started_7d', (select count(*) from public.events where name = 'manager_started' and coalesce(props->>'first', 'true') <> 'false' and created_at > v_week),
      'jobs',       (select count(*) from public.events where name = 'manager_started'),
      'sacked',     (select count(*) from public.events where name = 'manager_sacked'),
      'trophies',   (select count(*) from public.events where name = 'manager_trophy'),
      'retired',    (select count(*) from public.events where name = 'manager_retired'),
      'by_gender', (select jsonb_build_object(
                      'm', count(*) filter (where props->>'gender' = 'm'),
                      'f', count(*) filter (where props->>'gender' = 'f'))
                    from public.events where name = 'manager_started' and coalesce(props->>'first', 'true') <> 'false'),
      'by_tier', (
        select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
        from (select coalesce(nullif(props->>'tier', ''), '?') as k, count(*) as c
              from public.events where name = 'manager_started' and coalesce(props->>'first', 'true') <> 'false'
              group by 1 order by 2 desc, 1 limit 12) t
      )
    ),

    -- 8-second intro: watched to the end vs skipped
    'intro', (
      select jsonb_build_object(
        'done',       count(*) filter (where props->>'done' = 'true'),
        'skipped',    count(*) filter (where props->>'done' = 'false'),
        'done_7d',    count(*) filter (where props->>'done' = 'true' and created_at > v_week),
        'skipped_7d', count(*) filter (where props->>'done' = 'false' and created_at > v_week))
      from public.events where name = 'intro'
    ),

    -- goals and mega celebrations
    'goals', (
      select jsonb_build_object(
        'total',    coalesce(sum(public.hy_event_n(props)), 0),
        'mega',     coalesce(sum(public.hy_event_n(props)) filter (where props->>'mega' = 'true'), 0),
        'total_7d', coalesce(sum(public.hy_event_n(props)) filter (where created_at > v_week), 0),
        'mega_7d',  coalesce(sum(public.hy_event_n(props)) filter (where props->>'mega' = 'true' and created_at > v_week), 0))
      from public.events where name = 'goal'
    ),

    -- retirements: final league / tier, how many finished in a European top-5 league
    'retired', jsonb_build_object(
      'total', (select count(*) from public.events where name = 'retired'),
      'by_gender', (select jsonb_build_object(
                      'm', count(*) filter (where props->>'gender' = 'm'),
                      'f', count(*) filter (where props->>'gender' = 'f'))
                    from public.events where name = 'retired'),
      'top5', (select count(*) from public.events
               where name = 'retired' and ((props->>'league') = any (v_top5) or props->>'top5' = 'true')),
      'final_top5', (select count(*) from public.events where name = 'retired' and (props->>'league') = any (v_top5)),
      'avg_legacy', (select coalesce(round(avg((props->>'legacy')::numeric), 1), 0)
                     from public.events where name = 'retired' and jsonb_typeof(props->'legacy') = 'number'),
      'by_league', (
        select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
        from (select coalesce(nullif(props->>'league', ''), '?') as k, count(*) as c
              from public.events where name = 'retired'
              group by 1 order by 2 desc, 1 limit 12) t
      ),
      'by_tier', (
        select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
        from (select coalesce(nullif(props->>'tier', ''), '?') as k, count(*) as c
              from public.events where name = 'retired'
              group by 1 order by 2 desc, 1 limit 12) t
      )
    )
  ) into v_res;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. admin_feedback_v2(): paged feedback, optional exact star filter (1..5, null = all)
-- ---------------------------------------------------------------------
create or replace function public.admin_feedback_v2(p_limit int default 50, p_offset int default 0,
                                                    p_unread_only boolean default false, p_rating int default null)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_unread boolean := coalesce(p_unread_only, false);
  v_rating int := case when p_rating between 1 and 5 then p_rating else null end;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total',  (select count(*) from public.feedback
               where (not v_unread or not is_read) and (v_rating is null or rating = v_rating)),
    'unread', (select count(*) from public.feedback where not is_read),
    'all',    (select count(*) from public.feedback),
    'by_rating', (select jsonb_build_object(
                    '1', count(*) filter (where rating = 1),
                    '2', count(*) filter (where rating = 2),
                    '3', count(*) filter (where rating = 3),
                    '4', count(*) filter (where rating = 4),
                    '5', count(*) filter (where rating = 5))
                  from public.feedback where (not v_unread or not is_read)),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at desc, f.id desc)
      from (select id, created_at, rating, message, email, context, app_version, is_read, device_id
            from public.feedback
            where (not v_unread or not is_read) and (v_rating is null or rating = v_rating)
            order by created_at desc, id desc
            limit v_limit offset v_offset) f
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. admin_delete_feedback(): delete one feedback item
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_feedback(p_id bigint)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.feedback where id = p_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. admin_reset_stats(): wipe the game's statistics (devices, sessions, events, feedback).
--    app_config (ads / announcement / version / feedback settings) and admins are KEPT.
--    Needs p_confirm = 'RESET' exactly. No CASCADE: if anything outside the game ever
--    referenced these tables, the truncate fails instead of touching it.
-- ---------------------------------------------------------------------
create or replace function public.admin_reset_stats(p_confirm text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_dev bigint;
  v_ses bigint;
  v_evt bigint;
  v_fb  bigint;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_confirm is distinct from 'RESET' then
    return jsonb_build_object('ok', false, 'error', 'bad_confirm');
  end if;
  select count(*) into v_dev from public.devices;
  select count(*) into v_ses from public.sessions;
  select count(*) into v_evt from public.events;
  select count(*) into v_fb  from public.feedback;
  truncate table public.events, public.sessions, public.feedback, public.devices restart identity;
  raise log 'hayeled admin_reset_stats by % (devices %, sessions %, events %, feedback %)',
    auth.jwt()->>'email', v_dev, v_ses, v_evt, v_fb;
  return jsonb_build_object('ok', true, 'at', now(),
    'deleted', jsonb_build_object('devices', v_dev, 'sessions', v_ses, 'events', v_evt, 'feedback', v_fb));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Function privileges (Supabase auto-grants EXECUTE to anon: revoke, then grant to authenticated;
--    each function still checks is_admin() itself)
-- ---------------------------------------------------------------------
revoke execute on function public.hy_event_n(jsonb) from public, anon, authenticated;
revoke execute on function public.admin_stats_v2(int, text) from public, anon, authenticated;
revoke execute on function public.admin_feedback_v2(int, int, boolean, int) from public, anon, authenticated;
revoke execute on function public.admin_delete_feedback(bigint) from public, anon, authenticated;
revoke execute on function public.admin_reset_stats(text) from public, anon, authenticated;

grant execute on function public.admin_stats_v2(int, text) to authenticated;
grant execute on function public.admin_feedback_v2(int, int, boolean, int) to authenticated;
grant execute on function public.admin_delete_feedback(bigint) to authenticated;
grant execute on function public.admin_reset_stats(text) to authenticated;
-- hy_event_n: granted to nobody (used only inside admin_stats_v2, which runs as its owner).

-- Ask PostgREST to reload its schema cache so the new functions are visible immediately.
notify pgrst, 'reload schema';
