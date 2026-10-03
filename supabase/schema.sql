-- =====================================================================
--  הילד מהשכונה (hayeled) - Supabase schema (SPEC §8.6)
--  Paste the WHOLE file into Supabase -> SQL Editor -> Run.
--  Idempotent: safe to run again after updates.
--
--  Security model:
--   * RLS is enabled on every table.
--   * anon / authenticated have NO direct table access, except SELECT on app_config.
--   * All writes go through SECURITY DEFINER functions with validation + rate limits.
--   * Admin functions check public.is_admin() (verified, confirmed auth user whose
--     email is listed in public.admins).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.devices (
  id text primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  platform text,
  standalone boolean default false,
  app_version text,
  installed_at timestamptz,
  rate_window timestamptz not null default now(),
  rate_count int not null default 0,
  feedback_day date,
  feedback_count int not null default 0
);

create table if not exists public.sessions (
  id text primary key,
  device_id text not null references public.devices(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  heartbeats int not null default 1,
  app_version text,
  standalone boolean default false
);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  device_id text not null,
  session_id text,
  name text not null,
  props jsonb not null default '{}',
  client_ts timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  device_id text,
  rating smallint not null check (rating between 1 and 5),
  message text check (char_length(message) <= 2000),
  email text check (char_length(email) <= 200),
  context jsonb not null default '{}',
  app_version text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------
create index if not exists events_created_at_idx      on public.events (created_at);
create index if not exists events_name_created_at_idx on public.events (name, created_at);
create index if not exists sessions_last_seen_idx     on public.sessions (last_seen);
create index if not exists sessions_started_at_idx    on public.sessions (started_at);
create index if not exists sessions_device_idx        on public.sessions (device_id);
create index if not exists devices_first_seen_idx     on public.devices (first_seen);
create index if not exists feedback_created_at_idx    on public.feedback (created_at desc);

-- ---------------------------------------------------------------------
-- 3. Seed remote config (ads DISABLED by default). Existing rows are kept.
-- ---------------------------------------------------------------------
insert into public.app_config (key, value) values
  ('ads', '{
     "enabled": false, "provider": "none",
     "placements": {
       "hub_banner":   {"enabled": true},
       "interstitial": {"enabled": true, "everyMatchdays": 4, "minMinutesBetween": 3, "skipFirstMinutes": 10},
       "rewarded":     {"enabled": false, "maxPerDay": 3, "energy": 15}
     },
     "house": [],
     "adsense": {"client": "", "slots": {"hub_banner": "", "interstitial": ""}}
   }'::jsonb),
  ('announcement', '{"enabled": false, "id": "", "textHe": "", "link": "", "level": "info"}'::jsonb),
  ('version', '{"min": "0.0.0", "latest": "0.0.0", "messageHe": "יש גרסה חדשה. רענן כדי לעדכן"}'::jsonb),
  ('feedback', '{"enabled": true, "prompt": true}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 4. Row Level Security + table privileges
-- ---------------------------------------------------------------------
alter table public.devices    enable row level security;
alter table public.sessions   enable row level security;
alter table public.events     enable row level security;
alter table public.feedback   enable row level security;
alter table public.app_config enable row level security;
alter table public.admins     enable row level security;

drop policy if exists app_config_public_read on public.app_config;
create policy app_config_public_read on public.app_config
  for select to anon, authenticated using (true);
-- devices, sessions, events, feedback, admins: intentionally NO policies (fully denied).

-- Scoped to THIS game's tables only: the project is shared with other apps
-- (e.g. app_releases), whose grants must stay untouched.
revoke all on table public.devices, public.sessions, public.events,
                    public.feedback, public.app_config, public.admins
  from anon, authenticated;
revoke all on sequence public.events_id_seq, public.feedback_id_seq from anon, authenticated;
grant select on public.app_config to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Functions
--    NOTE: Supabase auto-grants EXECUTE on new functions to anon/authenticated,
--    so every function below is explicitly revoked and then granted (section 7).
-- ---------------------------------------------------------------------

-- 5.1 is_admin(): verified (email confirmed) auth user whose email is in public.admins
create or replace function public.is_admin()
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
    from public.admins a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
end;
$$;

-- 5.2 heartbeat(): upsert device + session ("online now" = last_seen within 2 minutes)
create or replace function public.heartbeat(p_device text, p_session text, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_platform text;
  v_version text;
  v_standalone boolean := false;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$'
     or p_session is null or p_session !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false);
  end if;
  if jsonb_typeof(v_meta) <> 'object' or octet_length(v_meta::text) > 1024 then
    v_meta := '{}'::jsonb;
  end if;
  v_platform := left(v_meta->>'platform', 16);
  v_version  := left(v_meta->>'v', 20);
  if jsonb_typeof(v_meta->'standalone') = 'boolean' then
    v_standalone := (v_meta->>'standalone')::boolean;
  end if;

  insert into public.devices as d (id, platform, standalone, app_version)
  values (p_device, v_platform, v_standalone, v_version)
  on conflict (id) do update
    set last_seen   = now(),
        platform    = coalesce(excluded.platform, d.platform),
        standalone  = coalesce(excluded.standalone, d.standalone),
        app_version = coalesce(excluded.app_version, d.app_version);

  insert into public.sessions as s (id, device_id, app_version, standalone)
  values (p_session, p_device, v_version, v_standalone)
  on conflict (id) do update
    set last_seen  = now(),
        heartbeats = s.heartbeats + 1
    where s.device_id = excluded.device_id
      and s.last_seen < now() - interval '20 seconds';

  return jsonb_build_object('ok', true, 'server_time', now());
end;
$$;

-- 5.3 track_events(): batch insert (max 50 per call, 600 per device per rolling hour)
create or replace function public.track_events(p_device text, p_session text, p_events jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_total    int;
  v_allowed  int;
  v_window   timestamptz;
  v_count    int;
  v_accepted int := 0;
  v_dropped  int := 0;
  v_i        int := 0;
  v_name     text;
  v_props    jsonb;
  v_ts       timestamptz;
  v_sess     text;
  e          jsonb;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$'
     or p_session is null or p_session !~ '^[A-Za-z0-9-]{8,64}$'
     or p_events is null or jsonb_typeof(p_events) <> 'array' then
    return jsonb_build_object('accepted', 0, 'dropped',
      case when p_events is not null and jsonb_typeof(p_events) = 'array' then jsonb_array_length(p_events) else 0 end);
  end if;

  v_total := jsonb_array_length(p_events);

  insert into public.devices as d (id) values (p_device)
  on conflict (id) do update set last_seen = now();

  select rate_window, rate_count into v_window, v_count
  from public.devices where id = p_device for update;
  if v_window is null or v_window < now() - interval '1 hour' then
    v_window := now();
    v_count := 0;
  end if;
  v_allowed := greatest(0, least(50, 600 - coalesce(v_count, 0)));

  for e in select value from jsonb_array_elements(p_events)
  loop
    v_i := v_i + 1;
    if v_i > v_allowed then
      v_dropped := v_dropped + 1;
      continue;
    end if;
    if jsonb_typeof(e) <> 'object' then
      v_dropped := v_dropped + 1;
      continue;
    end if;
    v_name := e->>'n';
    if v_name is null or v_name !~ '^[a-z_]{2,32}$' then
      v_dropped := v_dropped + 1;
      continue;
    end if;
    v_props := coalesce(e->'p', '{}'::jsonb);
    if jsonb_typeof(v_props) <> 'object' then
      v_props := '{}'::jsonb;
    end if;
    if octet_length(v_props::text) > 2048 then
      v_dropped := v_dropped + 1;
      continue;
    end if;
    begin
      v_ts := (e->>'t')::timestamptz;
    exception when others then
      v_ts := null;
    end;
    v_ts := coalesce(v_ts, now());
    v_ts := least(greatest(v_ts, now() - interval '7 days'), now() + interval '1 hour');
    v_sess := e->>'s';
    if v_sess is null or v_sess !~ '^[A-Za-z0-9-]{8,64}$' then
      v_sess := p_session;
    end if;

    insert into public.events (device_id, session_id, name, props, client_ts)
    values (p_device, v_sess, v_name, v_props, v_ts);
    v_accepted := v_accepted + 1;

    if v_name = 'install' then
      update public.devices set installed_at = coalesce(installed_at, now()) where id = p_device;
    end if;
  end loop;

  update public.devices
     set rate_window = v_window,
         rate_count  = coalesce(v_count, 0) + least(v_total, v_allowed)
   where id = p_device;

  return jsonb_build_object('accepted', v_accepted, 'dropped', v_dropped);
end;
$$;

-- 5.4 submit_feedback(): 1..5 stars + text + optional email (max 5 per device per day)
create or replace function public.submit_feedback(p_device text, p_rating int, p_message text, p_email text, p_context jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id     bigint;
  v_msg    text;
  v_email  text;
  v_ctx    jsonb := coalesce(p_context, '{}'::jsonb);
  v_day    date := (now() at time zone 'Asia/Jerusalem')::date;
  v_fday   date;
  v_fcount int;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'error', 'bad_rating');
  end if;
  if p_device is null or p_device !~ '^[A-Za-z0-9-]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_device');
  end if;

  v_msg := left(btrim(coalesce(p_message, '')), 2000);
  v_email := nullif(btrim(coalesce(p_email, '')), '');
  if v_email is not null and (char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    v_email := null;
  end if;
  if jsonb_typeof(v_ctx) <> 'object' or octet_length(v_ctx::text) > 2048 then
    v_ctx := '{}'::jsonb;
  end if;

  insert into public.devices as d (id) values (p_device)
  on conflict (id) do update set last_seen = now();

  select feedback_day, feedback_count into v_fday, v_fcount
  from public.devices where id = p_device for update;
  if v_fday is distinct from v_day then
    v_fcount := 0;
  end if;
  if coalesce(v_fcount, 0) >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  update public.devices
     set feedback_day = v_day, feedback_count = coalesce(v_fcount, 0) + 1
   where id = p_device;

  insert into public.feedback (device_id, rating, message, email, context, app_version)
  values (p_device, p_rating, nullif(v_msg, ''), v_email, v_ctx, left(v_ctx->>'v', 20))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 5.5 admin_whoami(): cosmetic check for the dashboard (real checks are inside each admin function)
create or replace function public.admin_whoami()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  return jsonb_build_object('is_admin', public.is_admin(), 'email', auth.jwt()->>'email');
end;
$$;

-- 5.6 admin_stats(): the whole dashboard in one JSON (exact keys, see SPEC §8.6 AdminStats)
create or replace function public.admin_stats(p_days int default 30, p_tz text default 'Asia/Jerusalem')
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_days  int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_tz    text := coalesce(p_tz, 'Asia/Jerusalem');
  v_today date;
  v_from  timestamptz;
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
    'generated_at', now(),
    'days', v_days,
    'online_now',   (select count(*) from public.sessions where last_seen > now() - interval '2 minutes'),
    'total_devices',(select count(*) from public.devices),
    'dau', (select count(distinct device_id) from public.sessions where last_seen > now() - interval '1 day'),
    'wau', (select count(distinct device_id) from public.sessions where last_seen > now() - interval '7 days'),
    'mau', (select count(distinct device_id) from public.sessions where last_seen > now() - interval '30 days'),

    'new_per_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(g.d, 'YYYY-MM-DD'), 'count', coalesce(x.c, 0)) order by g.d), '[]'::jsonb)
      from (select gs::date as d
            from generate_series((v_today - (v_days - 1))::timestamp, v_today::timestamp, interval '1 day') gs) g
      left join (select (first_seen at time zone v_tz)::date as dd, count(*) as c
                 from public.devices where first_seen >= v_from group by 1) x on x.dd = g.d
    ),
    'active_per_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(g.d, 'YYYY-MM-DD'), 'count', coalesce(x.c, 0)) order by g.d), '[]'::jsonb)
      from (select gs::date as d
            from generate_series((v_today - (v_days - 1))::timestamp, v_today::timestamp, interval '1 day') gs) g
      left join (select a.dd, count(distinct a.device_id) as c
                 from (select device_id, (started_at at time zone v_tz)::date as dd from public.sessions where last_seen >= v_from
                       union
                       select device_id, (last_seen at time zone v_tz)::date as dd from public.sessions where last_seen >= v_from) a
                 group by a.dd) x on x.dd = g.d
    ),

    'sessions_today', (select count(*) from public.sessions where (started_at at time zone v_tz)::date = v_today),
    'avg_session_sec_today', (select coalesce(round(avg(extract(epoch from (last_seen - started_at)))), 0)
                              from public.sessions where (started_at at time zone v_tz)::date = v_today),
    'avg_session_sec_7d', (select coalesce(round(avg(extract(epoch from (last_seen - started_at)))), 0)
                           from public.sessions where started_at > now() - interval '7 days'),

    'installs_total', (select count(*) from public.devices where installed_at is not null),
    'installs_7d',    (select count(*) from public.devices where installed_at > now() - interval '7 days'),

    'careers_started',   (select count(*) from public.events where name = 'career_started'),
    'matches_played',    (select count(*) from public.events where name = 'match_played'),
    'seasons_completed', (select count(*) from public.events where name = 'season_completed'),
    'retirements',       (select count(*) from public.events where name = 'retired'),
    'transfers',         (select count(*) from public.events where name = 'transfer'),
    'careers_7d', (select count(*) from public.events where name = 'career_started' and created_at > now() - interval '7 days'),
    'matches_7d', (select count(*) from public.events where name = 'match_played' and created_at > now() - interval '7 days'),

    'top_nations', (
      select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
      from (select props->>'nation' as k, count(*) as c from public.events
            where name = 'career_started' and coalesce(props->>'nation', '') <> ''
            group by 1 order by 2 desc, 1 limit 10) t
    ),
    'top_positions', (
      select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
      from (select props->>'position' as k, count(*) as c from public.events
            where name = 'career_started' and coalesce(props->>'position', '') <> ''
            group by 1 order by 2 desc, 1 limit 10) t
    ),
    'top_clubs', (
      select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
      from (select props->>'club' as k, count(*) as c from public.events
            where name = 'career_started' and coalesce(props->>'club', '') <> ''
            group by 1 order by 2 desc, 1 limit 10) t
    ),

    'rating_avg',   (select coalesce(round(avg(rating)::numeric, 2), 0) from public.feedback),
    'rating_count', (select count(*) from public.feedback),
    'rating_dist',  (select jsonb_build_object(
                       '1', count(*) filter (where rating = 1),
                       '2', count(*) filter (where rating = 2),
                       '3', count(*) filter (where rating = 3),
                       '4', count(*) filter (where rating = 4),
                       '5', count(*) filter (where rating = 5)) from public.feedback),
    'feedback_total',  (select count(*) from public.feedback),
    'feedback_unread', (select count(*) from public.feedback where not is_read),

    'ads', jsonb_build_object(
      'impressions_total', (select count(*) from public.events where name = 'ad_impression'),
      'clicks_total',      (select count(*) from public.events where name = 'ad_click'),
      'impressions_7d',    (select count(*) from public.events where name = 'ad_impression' and created_at > now() - interval '7 days'),
      'clicks_7d',         (select count(*) from public.events where name = 'ad_click' and created_at > now() - interval '7 days'),
      'rewarded_7d',       (select count(*) from public.events where name = 'ad_rewarded' and created_at > now() - interval '7 days'),
      'by_placement', (
        select coalesce(jsonb_agg(jsonb_build_object('placement', t.p, 'impressions', t.i, 'clicks', t.c) order by t.i desc, t.p), '[]'::jsonb)
        from (select coalesce(props->>'placement', '?') as p,
                     count(*) filter (where name = 'ad_impression') as i,
                     count(*) filter (where name = 'ad_click') as c
              from public.events where name in ('ad_impression', 'ad_click')
              group by 1) t
      )
    ),

    'platforms', (
      select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
      from (select coalesce(platform, 'other') as k, count(*) as c from public.devices group by 1 order by 2 desc, 1 limit 10) t
    ),
    'versions', (
      select coalesce(jsonb_agg(jsonb_build_object('key', t.k, 'count', t.c) order by t.c desc, t.k), '[]'::jsonb)
      from (select coalesce(app_version, '?') as k, count(*) as c from public.devices group by 1 order by 2 desc, 1 limit 10) t
    )
  ) into v_res;

  return v_res;
end;
$$;

-- 5.7 admin_feedback(): paged feedback list, newest first
create or replace function public.admin_feedback(p_limit int default 50, p_offset int default 0, p_unread_only boolean default false)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_unread boolean := coalesce(p_unread_only, false);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total',  (select count(*) from public.feedback where (not v_unread or not is_read)),
    'unread', (select count(*) from public.feedback where not is_read),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at desc, f.id desc)
      from (select id, created_at, rating, message, email, context, app_version, is_read, device_id
            from public.feedback
            where (not v_unread or not is_read)
            order by created_at desc, id desc
            limit v_limit offset v_offset) f
    ), '[]'::jsonb)
  );
end;
$$;

-- 5.8 admin_mark_read()
create or replace function public.admin_mark_read(p_id bigint, p_read boolean default true)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.feedback set is_read = coalesce(p_read, true) where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- 5.9 admin_get_config()
create or replace function public.admin_get_config()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((select jsonb_object_agg(key, value) from public.app_config), '{}'::jsonb);
end;
$$;

-- 5.10 admin_set_config()
create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_at timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_key is null or p_key not in ('ads', 'announcement', 'version', 'feedback')
     or p_value is null or jsonb_typeof(p_value) <> 'object'
     or octet_length(p_value::text) > 32768 then
    return jsonb_build_object('ok', false, 'error', 'bad_value');
  end if;
  insert into public.app_config (key, value, updated_at, updated_by)
  values (p_key, p_value, v_at, auth.jwt()->>'email')
  on conflict (key) do update
    set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true, 'key', p_key, 'updated_at', v_at);
end;
$$;

-- 5.11 purge_old_events(): retention (granted to NOBODY; run by postgres / pg_cron)
create or replace function public.purge_old_events(p_days int default 180)
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  delete from public.events where created_at < now() - make_interval(days => greatest(coalesce(p_days, 180), 1));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- 5.12 html escape helper for the email body (granted to nobody)
create or replace function public.hy_html_escape(p text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select replace(replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- ---------------------------------------------------------------------
-- 6. OPTIONAL: email to the owner on each new feedback (pg_net -> Resend)
--    Inert until configured: needs the pg_net extension AND two Vault secrets:
--      select vault.create_secret('re_xxx...', 'resend_api_key');
--      select vault.create_secret('you@example.com', 'feedback_email_to');
--    optional:  select vault.create_secret('feedback@your-domain.com', 'feedback_email_from');
--    A failure here can NEVER block a feedback insert.
-- ---------------------------------------------------------------------
create or replace function public.notify_feedback_email()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_key  text;
  v_to   text;
  v_from text;
  v_html text;
  v_stars text;
begin
  begin
    -- pg_net enabled? (same meaning as to_regproc('net.http_post') is not null, but never ambiguous)
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'net' and p.proname = 'http_post') then
      return new;
    end if;
    if to_regclass('vault.decrypted_secrets') is null then
      return new;
    end if;
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_key  using 'resend_api_key';
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_to   using 'feedback_email_to';
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_from using 'feedback_email_from';
    if coalesce(v_key, '') = '' or coalesce(v_to, '') = '' then
      return new;
    end if;
    v_from := coalesce(nullif(v_from, ''), 'onboarding@resend.dev');
    v_stars := repeat('★', new.rating) || repeat('☆', 5 - new.rating);

    v_html := '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">'
      || '<h2 style="margin:0 0 8px">משוב חדש - הילד מהשכונה</h2>'
      || '<p style="font-size:22px;color:#e0a800;margin:0 0 8px">' || v_stars || ' (' || new.rating || '/5)</p>'
      || '<p><b>הודעה:</b><br>' || replace(public.hy_html_escape(coalesce(new.message, '(ללא טקסט)')), E'\n', '<br>') || '</p>'
      || '<p><b>אימייל:</b> ' || public.hy_html_escape(coalesce(new.email, '(לא הושאר)')) || '</p>'
      || '<p><b>גרסה:</b> ' || public.hy_html_escape(coalesce(new.app_version, '?')) || '</p>'
      || '<p><b>הקשר:</b> <code dir="ltr">' || public.hy_html_escape(left(new.context::text, 1500)) || '</code></p>'
      || '<p style="color:#888"><b>זמן:</b> ' || public.hy_html_escape(to_char(new.created_at at time zone 'Asia/Jerusalem', 'YYYY-MM-DD HH24:MI')) || ' (שעון ישראל)</p>'
      || '</div>';

    execute 'select net.http_post(url := $1, headers := $2, body := $3)'
      using 'https://api.resend.com/emails',
            jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
            jsonb_build_object(
              'from', v_from,
              'to', jsonb_build_array(v_to),
              'subject', 'משוב חדש (' || new.rating || '★) - הילד מהשכונה',
              'html', v_html);
  exception when others then
    raise warning 'notify_feedback_email failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_feedback_email on public.feedback;
create trigger trg_feedback_email
  after insert on public.feedback
  for each row execute function public.notify_feedback_email();

-- ---------------------------------------------------------------------
-- 7. Function privileges (explicit; Supabase default privileges grant EXECUTE to anon!)
-- ---------------------------------------------------------------------
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.heartbeat(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.track_events(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.submit_feedback(text, int, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_whoami() from public, anon, authenticated;
revoke execute on function public.admin_stats(int, text) from public, anon, authenticated;
revoke execute on function public.admin_feedback(int, int, boolean) from public, anon, authenticated;
revoke execute on function public.admin_mark_read(bigint, boolean) from public, anon, authenticated;
revoke execute on function public.admin_get_config() from public, anon, authenticated;
revoke execute on function public.admin_set_config(text, jsonb) from public, anon, authenticated;
revoke execute on function public.purge_old_events(int) from public, anon, authenticated;
revoke execute on function public.hy_html_escape(text) from public, anon, authenticated;
revoke execute on function public.notify_feedback_email() from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.heartbeat(text, text, jsonb) to anon, authenticated;
grant execute on function public.track_events(text, text, jsonb) to anon, authenticated;
grant execute on function public.submit_feedback(text, int, text, text, jsonb) to anon, authenticated;
grant execute on function public.admin_whoami() to authenticated;
grant execute on function public.admin_stats(int, text) to authenticated;
grant execute on function public.admin_feedback(int, int, boolean) to authenticated;
grant execute on function public.admin_mark_read(bigint, boolean) to authenticated;
grant execute on function public.admin_get_config() to authenticated;
grant execute on function public.admin_set_config(text, jsonb) to authenticated;
-- purge_old_events, hy_html_escape, notify_feedback_email: granted to nobody.

-- ---------------------------------------------------------------------
-- 8. OPTIONAL retention: delete raw events older than 180 days, daily at 03:15 UTC.
--    Runs only if the pg_cron extension is enabled (Database -> Extensions -> pg_cron),
--    then re-run this file.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $q$select cron.unschedule(jobid) from cron.job where jobname = 'hy-retention'$q$;
      execute $q$select cron.schedule('hy-retention', '15 3 * * *', 'select public.purge_old_events(180)')$q$;
    exception when others then
      raise notice 'pg_cron retention not scheduled: %', sqlerrm;
    end;
  end if;
end
$$;

-- Ask PostgREST to reload its schema cache so the new functions are visible immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 9. The owner's admin account (must already exist in Authentication -> Users).
--    Add more admins with another insert line.
-- ---------------------------------------------------------------------
insert into public.admins(email) values ('mosheisakov91@gmail.com') on conflict do nothing;
