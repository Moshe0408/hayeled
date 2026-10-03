// Headless career simulation through the facade only (SPEC §10.1).
// Usage: node tests/sim.mjs [--careers 12] [--seasons 25] [--seed 1] [--quick]
import * as game from '../js/engine/game.js';
import { rngFor, hash32 } from '../js/core/rng.js';
import { LEAGUES, LEAGUE_BY_ID, CLUB_INDEX, EURO_FILLER_CLUBS } from '../js/data/leagues.js';

// ---------------- args
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? Number(argv[i + 1]) : def; };
const QUICK = argv.includes('--quick');
const CAREERS = QUICK ? 3 : arg('careers', 12);
const SEASONS = QUICK ? 6 : arg('seasons', 25);
const SEED = arg('seed', 1);
const VERBOSE = argv.includes('--verbose');

const violations = [];
const checkCounts = { seasonEnd: 0, world: 0, purity: 0, schedule: 0, player: 0 };
const warnings = [];
function fail(msg, detail) {
  if (violations.length < 200) violations.push(detail !== undefined ? msg + ' :: ' + JSON.stringify(detail).slice(0, 400) : msg);
}
function warn(msg) { warnings.push(msg); }

// ---------------- deep scans
const PH = /\{[a-z0-9]+\}/;
function scanVM(v, where, path = '') {
  if (v === null || v === undefined) return;
  if (typeof v === 'number') { if (!Number.isFinite(v)) fail('non-finite number in ' + where + ' at ' + path, v); return; }
  if (typeof v === 'string') { if (PH.test(v)) fail('unfilled placeholder in ' + where + ' at ' + path, v); return; }
  if (typeof v === 'function') { fail('function in VM ' + where + ' at ' + path); return; }
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) scanVM(v[i], where, path + '[' + i + ']'); return; }
  if (typeof v === 'object') for (const k of Object.keys(v)) scanVM(v[k], where, path + '.' + k);
}
function chk(name, v) {
  try { JSON.stringify(v); } catch (e) { fail('VM not serialisable: ' + name); }
  scanVM(v, name);
  return v;
}
function stateHash() {
  const s = JSON.parse(JSON.stringify(game.serialize()));
  delete s.createdAt;
  return hash32(JSON.stringify(s));
}

// ---------------- stats collectors
const calib = { pos: {}, ratings: [], gkMatches: 0, gkCS: 0, lgGoals: 0, lgMatches: 0, homeW: 0, draws: 0, sampled: new Set() };
function posBucket(pos) { return pos === 'LW' || pos === 'RW' ? 'W' : (pos === 'CB' || pos === 'LB' || pos === 'RB') ? 'DEF' : pos; }

// ---------------- invariants on state
const BASE_SIZE = {};
for (const l of LEAGUES) BASE_SIZE[l.id] = l.clubs.length;

function leagueFmt(lid) {
  const lg = LEAGUE_BY_ID[lid];
  const N = lg.clubs.length;
  const f = lg.format;
  const cyc = f.type === 'triple_rr_split' ? 3 : 2;
  const Rb = cyc * (N - 1);
  let extra = 0;
  const groups = f.groups || null;
  if (groups) for (const g of groups) { const sz = g.to - g.from + 1; extra = Math.max(extra, (g.rr || 1) * (sz % 2 === 0 ? sz - 1 : sz)); }
  return { N, Rb, R: Rb + extra, groups, halve: !!f.halve };
}

function checkSeasonEnd(S, tag) {
  checkCounts.seasonEnd++;
  // leagues
  for (const lg of LEAGUES) {
    const L = S.comp.lg[lg.id];
    const f = leagueFmt(lg.id);
    if (!L) { fail(tag + ' missing league ' + lg.id); continue; }
    if (L.t.length !== f.N) fail(tag + ' league size ' + lg.id, L.t.length);
    if (L.R !== f.R) fail(tag + ' round count ' + lg.id, [L.R, f.R]);
    if (L.r !== L.R) fail(tag + ' rounds played ' + lg.id, [L.r, L.R]);
    let gf = 0, ga = 0;
    for (const r of L.t) {
      const [id, p, w, d, l, f1, a1, pts] = r;
      gf += f1; ga += a1;
      if (p !== w + d + l) fail(tag + ' p!=w+d+l ' + lg.id, r);
      if (f.halve ? pts > 3 * w + d : pts !== 3 * w + d) fail(tag + ' pts ' + lg.id, r);
      let exp = f.Rb;
      if (f.groups) {
        const gi = L.sp ? L.sp.findIndex((g) => g.indexOf(id) >= 0) : -1;
        if (gi < 0) fail(tag + ' club not in split group ' + lg.id, id);
        else { const g = f.groups[gi]; const sz = g.to - g.from + 1; exp += (g.rr || 1) * (sz % 2 === 0 ? sz - 1 : sz - 1); }
      }
      if (p !== exp) fail(tag + ' club matches ' + lg.id + ' ' + id, [p, exp]);
    }
    if (gf !== ga) fail(tag + ' gf!=ga ' + lg.id, [gf, ga]);
    if (lg.tier === 1) {
      calib.lgGoals += gf; calib.lgMatches += L.t.reduce((s, r) => s + r[1], 0) / 2;
    }
  }
  // europe
  const seen = new Map();
  for (const c of ['ucl', 'uel', 'uecl']) {
    const E = S.comp.eu[c];
    const teams = E.lp.teams;
    if (teams.length !== 36 || new Set(teams).size !== 36) fail(tag + ' ' + c + ' lp teams', teams.length);
    const cnt = {};
    for (const f of E.lp.fx) { cnt[f[1]] = (cnt[f[1]] || 0) + 1; cnt[f[2]] = (cnt[f[2]] || 0) + 1; if (f[3] === null) fail(tag + ' ' + c + ' unplayed lp fixture'); }
    for (const t of teams) if (cnt[t] !== 8) fail(tag + ' ' + c + ' team lp matches ' + t, cnt[t]);
    const all = new Set(teams);
    for (const t of E.q) { all.add(t[0]); all.add(t[1]); }
    for (const id of all) {
      if (seen.has(id) && seen.get(id) !== c) {
        // a q loser dropping to a lower competition is allowed (same club, lower comp)
        const prev = seen.get(id);
        const qLoser = S.comp.eu[prev].q.some((t) => t[0] === id || t[1] === id) && S.comp.eu[prev].lp.teams.indexOf(id) < 0;
        if (!qLoser) fail(tag + ' club in two euro comps ' + id, [prev, c]);
      }
      seen.set(id, c);
    }
    if (!E.w) fail(tag + ' no winner ' + c);
    else if (teams.indexOf(E.w) < 0) fail(tag + ' winner not in lp ' + c, E.w);
  }
  // cups
  for (const lg of LEAGUES) {
    if (!lg.cup) continue;
    const Cp = S.comp.cups[lg.cup.id];
    if (!Cp || !Cp.w) { fail(tag + ' cup no winner ' + lg.cup.id); continue; }
    const e = CLUB_INDEX[Cp.w];
    const cc = e && e.leagueId ? LEAGUE_BY_ID[e.leagueId].countryId : null;
    if (cc !== lg.countryId) fail(tag + ' cup winner wrong country ' + lg.cup.id, Cp.w);
  }
}

function checkWorld(S, tag) {
  checkCounts.world++;
  const cnt = {};
  for (const id of Object.keys(S.world.clubs)) {
    const lg = S.world.clubs[id].lg;
    if (lg) cnt[lg] = (cnt[lg] || 0) + 1;
    const c = S.world.clubs[id];
    if (!(c.s >= 35 && c.s <= 92)) fail(tag + ' club strength out of range ' + id, c.s);
  }
  for (const l of LEAGUES) if (cnt[l.id] !== BASE_SIZE[l.id]) fail(tag + ' league size after promo/releg ' + l.id, [cnt[l.id], BASE_SIZE[l.id]]);
  const total = Object.values(cnt).reduce((a, b) => a + b, 0);
  if (total !== Object.keys(BASE_SIZE).reduce((s, k) => s + BASE_SIZE[k], 0)) fail(tag + ' total league clubs', total);
}

function checkPlayer(S, tag) {
  checkCounts.player++;
  const p = S.player;
  if (!(S.week >= 1 && S.week <= 52)) fail(tag + ' week out of range', S.week);
  for (const k of Object.keys(p.a)) if (!(p.a[k] >= 1 && p.a[k] <= 99)) fail(tag + ' attr out of range ' + k, p.a[k]);
  const ovr = game.getHub().player.ovr;
  if (!(ovr >= 1 && ovr <= 99)) fail(tag + ' ovr', ovr);
  for (const k of ['energy', 'morale', 'trust', 'fans', 'mates']) if (!(p[k] >= 0 && p[k] <= 100)) fail(tag + ' ' + k, p[k]);
  for (const k of ['l', 'c', 'w']) if (!(p.rep[k] >= 0 && p.rep[k] <= 100)) fail(tag + ' rep.' + k, p.rep[k]);
  if (!(p.money >= 0)) fail(tag + ' money', p.money);
  for (const r of p.form) if (!(r >= 3 && r <= 10)) fail(tag + ' form rating', r);
  if (p.stage === 'free' || p.stage === 'retired') { if (p.club !== null || p.contract !== null) fail(tag + ' free/retired has club', [p.club, p.contract && p.contract.club]); }
  else {
    if (!p.contract || p.contract.club !== p.club) fail(tag + ' club != contract.club', [p.club, p.contract && p.contract.club]);
    if (p.contract && p.contract.loan && !p.parent) fail(tag + ' loan without parent');
  }
}

function checkSpells(S, tag) {
  const cl = S.hist.clubs;
  let sumApps = 0;
  for (let i = 0; i < cl.length; i++) { sumApps += cl[i].apps; if (i < cl.length - 1 && cl[i].to === null) fail(tag + ' open spell not last', cl[i]); }
  let tot = 0;
  const archived = new Set(S.hist.seasons.map((x) => x.s));
  for (const s of S.hist.seasons) for (const k of ['lg', 'cup', 'eu', 'yth']) tot += s.stats[k].apps;
  if (!archived.has(S.season)) for (const k of ['lg', 'cup', 'eu', 'yth']) tot += S.player.s[k].apps;
  if (tot !== sumApps) fail(tag + ' spell apps != club apps', [sumApps, tot]);
}

function checkSchedule(tag) {
  checkCounts.schedule++;
  const sch = chk('getSchedule', game.getSchedule());
  const keys = new Set();
  for (const f of sch.fixtures) {
    const k = f.week + '-' + f.slot;
    if (keys.has(k)) fail(tag + ' duplicate (week,slot) in schedule', k);
    keys.add(k);
  }
}

const GETTERS = [
  ['getHub', () => game.getHub()], ['getMatch', () => game.getMatch()], ['getLastMatch', () => game.getLastMatch()],
  ['getSeasonReview', () => game.getSeasonReview()], ['getInbox', () => game.getInbox()], ['getOffers', () => game.getOffers()],
  ['getContract', () => game.getContract()], ['getCompetitions', () => game.getCompetitions()], ['getSchedule', () => game.getSchedule()],
  ['getProfile', () => game.getProfile()], ['getCareer', () => game.getCareer()], ['getNational', () => game.getNational()],
  ['getAwards', () => game.getAwards()], ['getShop', () => game.getShop()], ['getRetirement', () => game.getRetirement()],
  ['getSaveMeta', () => game.getSaveMeta()],
];
function purityCheck(tag) {
  checkCounts.purity++;
  const h0 = stateHash();
  const sig0 = game.getAndClearSignals();
  const comps = game.getCompetitions();
  const ids = comps.mine.map((c) => c.id).concat(comps.europe.map((c) => c.id)).concat(comps.leagues.slice(0, 3).flatMap((g) => g.items.map((i) => i.id)));
  const extra = [];
  for (const id of ids) { extra.push(['getTable:' + id, () => game.getTable(id)]); extra.push(['getBracket:' + id, () => game.getBracket(id)]); extra.push(['getResults:' + id, () => game.getResults(id)]); }
  const inbox = game.getInbox();
  for (const it of inbox.slice(0, 5)) extra.push(['getThread:' + it.id, () => game.getThread(it.id)]);
  for (const [name, fn] of GETTERS.concat(extra)) {
    const a = JSON.stringify(chk(name, fn()));
    const b = JSON.stringify(fn());
    if (a !== b) fail(tag + ' getter not deterministic ' + name);
  }
  if (stateHash() !== h0) fail(tag + ' getters changed state');
  const sig1 = game.getAndClearSignals();
  if (sig1.length) fail(tag + ' getters emitted signals', sig1);
  return sig0;
}

// ---------------- policy
const POS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
function careerOpts(i) {
  const r = rngFor(SEED, i, 'opts');
  const co = game.getCreateOptions({ seed: hash32(SEED, i) });
  const fixedNations = ['isr', 'eng', 'bra', 'cro', 'isr', 'esp', 'arg', 'ger'];
  const nation = i < fixedNations.length ? fixedNations[i] : r.pick(co.nations).id;
  const pos = POS[(i * 3 + SEED) % POS.length];
  const ac = game.getAcademyOptions(nation);
  let groups = ac.groups;
  if (nation === 'isr' && i % 2 === 0) groups = groups.filter((g) => g.tier === 1);
  const g = r.pick(groups);
  const club = r.pick(g.clubs).id;
  return { first: 'שחקן' + i, last: 'בדיקה', nick: r.chance(0.5) ? r.pick(co.nicknames) || '' : '', nation, pos, foot: r.chance(0.7) ? 'R' : 'L', club };
}

function ageNow() { return game.getHub().player.age; }

function runCareer(i, { roundTrip = false, collect = true, checks = true } = {}) {
  const opts = careerOpts(i);
  const res = chk('newCareer', game.newCareer({ ...opts, seed: hash32(SEED, i), now: 0 }));
  if (!res.ok) { fail('newCareer failed', res); return null; }
  const pol = rngFor(SEED, i, 'policy');
  const signals = [];
  const take = () => { for (const s of game.getAndClearSignals()) signals.push(s); };
  take();
  const S0 = game.serialize();
  const start = S0.startSeason;
  let weeks = 0, matchCount = 0, autoToggle = false;
  let maxSize = 0, sizes = [];
  let lastSeasonChecked = -1;
  let seasonsDone = 0;
  let midTransfer = false;
  const t0 = Date.now();
  let prevSeason = S0.season;
  let retiredAge = null;
  for (let guard = 0; guard < 60 * SEASONS + 100; guard++) {
    let S = game.serialize();
    if (S.retired) break;
    if (S.season >= start + SEASONS) break;
    // pending review
    if (S.pending.review !== null) {
      chk('getSeasonReview', game.getSeasonReview());
      if (checks && lastSeasonChecked !== S.season) { checkSeasonEnd(S, 'c' + i + ' s' + S.season); lastSeasonChecked = S.season; checkSchedule('c' + i + ' s' + S.season); }
      if (ageNow() >= 35 && pol.chance(0.3)) { const rr = chk('retire', game.retire()); take(); if (!rr.ok) fail('retire failed', rr); break; }
      chk('ack', game.ackSeasonReview());
      take();
      continue;
    }
    // training
    const hub = chk('getHub', game.getHub());
    const tr = pol.pick(hub.training.options.filter((o) => !o.disabled)).id;
    // offers
    for (const o of game.getOffers()) {
      if (o.status !== 'open' || !o.canAccept) continue;
      const curS = hub.club ? (CLUB_INDEX[hub.club.id] ? S.world.clubs[hub.club.id].s : 0) : 0;
      let action;
      if (o.type === 'pro') action = 'accept';
      else if (o.type === 'renewal') action = pol.chance(0.8) ? 'accept' : 'reject';
      else if (pol.chance(0.1) && o.negotiationsLeft > 0) action = 'negotiate';
      else action = (o.club.strength > curS + 2 && pol.chance(0.7)) || (hub.player.stage === 'free' && pol.chance(0.8)) ? 'accept' : 'reject';
      const counter = action === 'negotiate' ? { wageMul: pol.pick([1.1, 1.2, 1.35]), years: pol.int(1, 5), role: o.role, rc: pol.pick(['none', 'low', 'default']) } : undefined;
      const r = chk('respondOffer', game.respondOffer(o.id, action, counter));
      if (r.status === 'signed' && (o.type === 'transfer' || o.type === 'loan' || o.type === 'free') && S.week >= 1 && S.week <= 44) midTransfer = true;
      take();
    }
    // play the week
    let a = chk('advanceWeek', game.advanceWeek(tr));
    take();
    if (!a.ok) { if (a.error === 'review_pending' || a.error === 'retired') continue; fail('advanceWeek failed', a); break; }
    while (a.status === 'match') {
      matchCount++;
      autoToggle = !autoToggle;
      const live = game.serialize().live;
      if (autoToggle) chk('autoPlayMatch', game.autoPlayMatch());
      else {
        let m = chk('startMatch', game.startMatch());
        let g2 = 0;
        while (m.phase === 'live' && m.moment && g2++ < 20) {
          const opt = pol.int(0, m.moment.options.length - 1);
          const out = chk('chooseMoment', game.chooseMoment(opt));
          m = out.match;
        }
        if (m.phase !== 'ended') m = game.autoPlayMatch();
      }
      const sum = chk('finishMatch', game.finishMatch());
      take();
      if (!(sum.rating >= 3 && sum.rating <= 10)) fail('rating out of range', sum.rating);
      if (collect) {
        calib.ratings.push(sum.rating);
        const S2 = game.serialize();
        const pos = S2.player.pos;
        const ovr = game.getHub().player.ovr;
        if (sum.minutes >= 60 && live.role === 'starter' && Math.abs(ovr - live.so) <= 6 && Math.abs(live.so - live.sa) <= 6) {
          const b = posBucket(pos);
          const P = calib.pos[b] = calib.pos[b] || { g: 0, a: 0, min: 0, n: 0 };
          P.g += sum.goals; P.a += sum.assists; P.min += sum.minutes; P.n++;
        }
        if (pos === 'GK' && sum.minutes >= 60) { calib.gkMatches++; if (sum.cleanSheet) calib.gkCS++; }
      }
      a = chk('resumeWeek', game.resumeWeek());
      take();
      if (!a.ok) { fail('resumeWeek failed', a); break; }
    }
    if (a.status === 'done') { chk('summary', a.summary); weeks++; }
    // inbox
    for (const it of game.getInbox()) {
      if (!it.needsAnswer) continue;
      const th = game.getThread(it.id);
      const ch = (th.choices || []).filter((c) => !c.disabled);
      if (!ch.length) continue;
      chk('answerEvent', game.answerEvent(it.id, pol.pick(ch).index));
      take();
    }
    S = game.serialize();
    if (checks) checkPlayer(S, 'c' + i + ' ' + S.season + 'w' + S.week);
    // season increment check
    if (S.season !== prevSeason) {
      if (S.season !== prevSeason + 1 || S.week !== 1) fail('season increment', [prevSeason, S.season, S.week]);
      prevSeason = S.season;
      seasonsDone++;
      if (!S.retired && S.hist.seasons.length !== S.season - start) fail('hist.seasons length', [S.hist.seasons.length, S.season - start]);
      if (checks) { checkWorld(S, 'c' + i + ' s' + S.season); checkSpells(S, 'c' + i + ' s' + S.season); }
      const str = JSON.stringify(game.serialize());
      sizes.push(str.length);
      maxSize = Math.max(maxSize, str.length);
      if (str.length > 1.5e6) fail('save too big', str.length);
      if (checks && seasonsDone % 3 === 0) {
        const parsed = JSON.parse(str);
        const lr = game.loadState(parsed);
        if (!lr.ok) fail('loadState round trip', lr);
      }
      if (roundTrip) {
        const lr = game.loadState(JSON.parse(JSON.stringify(game.serialize())));
        if (!lr.ok) fail('loadState round trip (rt)', lr);
      }
      if (checks && seasonsDone % 5 === 1) purityCheck('c' + i + ' s' + S.season);
    }
    if (collect && S.week % 1 === 0 && S.comp) {
      for (const lid of Object.keys(S.comp.lg)) {
        const L = S.comp.lg[lid];
        const key = S.season + lid + L.r;
        if (!L.last || !L.last.length || calib.sampled.has(key)) continue;
        calib.sampled.add(key);
        for (const [h, a2, hg, ag] of L.last) { calib.homeW += hg > ag ? 1 : 0; calib.draws += hg === ag ? 1 : 0; calib.lgN = (calib.lgN || 0) + 1; }
      }
    }
  }
  const elapsed = Date.now() - t0;
  const S = game.serialize();
  take();
  // signals
  const count = (n) => signals.filter((s) => s.name === n).length;
  if (count('career_started') !== 1) fail('career_started count', count('career_started'));
  const expSC = S.hist.seasons.length - (S.retired && S.retired.week <= 44 ? 1 : 0) + (!S.retired && S.week > 44 ? 1 : 0);
  if (count('season_completed') !== expSC) fail('season_completed count', [count('season_completed'), expSC]);
  if (count('retired') > 1) fail('retired signal > 1');
  if (S.retired && count('retired') !== 1) fail('retired signal missing');
  if (S.retired) {
    const e = chk('buildHallOfFameEntry', game.buildHallOfFameEntry());
    if (!e || !Number.isFinite(e.legacy) || e.careerId !== S.id) fail('bad HofEntry', e);
    chk('getRetirement', game.getRetirement());
    retiredAge = S.retired.age;
  }
  if (checks) checkSpells(S, 'c' + i + ' end');
  // inbox placeholders
  for (const it of S.inbox) for (const l of it.lines) if (PH.test(l.t)) fail('inbox placeholder', l.t);
  return { S, signals, elapsed, weeks, matches: matchCount, maxSize, sizes, midTransfer, retiredAge, opts, seasons: S.season - start + (S.retired ? 1 : 0) };
}

function summarize(r, i) {
  const S = r.S;
  const p = S.player;
  const clubs = [];
  for (const c of S.hist.clubs) { const nm = (CLUB_INDEX[c.club] && CLUB_INDEX[c.club].club.nameHe) || c.club; const lab = nm + (c.loan ? ' (השאלה)' : ''); if (clubs[clubs.length - 1] !== lab) clubs.push(lab); }
  const leagues = Array.from(new Set(S.hist.seasons.map((s) => s.lg).filter(Boolean)));
  const tot = { apps: 0, g: 0, a: 0 };
  for (const s of S.hist.seasons) for (const k of ['lg', 'cup', 'eu', 'nt', 'yth', 'ynt']) { tot.apps += s.stats[k].apps; tot.g += s.stats[k].g; tot.a += s.stats[k].a; }
  const trophies = {};
  for (const t of S.hist.trophies) trophies[t.k] = (trophies[t.k] || 0) + 1;
  const awards = {};
  for (const t of S.hist.awards) awards[t.k] = (awards[t.k] || 0) + 1;
  const bdo = S.hist.bdo.filter((b) => b.rank > 0).map((b) => b.s + ':' + b.rank);
  return {
    career: i, nation: p.nation, pos: p.pos, pot: p.pot, academy: r.opts.club, clubs, leagues, apps: tot.apps, goals: tot.g, assists: tot.a,
    trophies, awards, caps: p.caps.senior, intlGoals: p.ig.senior, youthCaps: p.caps.u17 + p.caps.u19 + p.caps.u21, peakOvr: p.peak,
    ballonDor: bdo, retired: S.retired ? S.retired.reason + '@' + S.retired.age : 'active@' + (S.season - p.born), legacy: S.retired ? S.retired.legacy : null,
    seasons: r.seasons, ms: r.elapsed, maxSaveKB: Math.round(r.maxSize / 1024),
    ovrByAge: S.hist.seasons.map((s) => s.age + ':' + s.ovr).join(' '),
  };
}

// ---------------- main
const T0 = Date.now();
const results = [];
let totalSeasons = 0, totalMs = 0;
for (let i = 0; i < CAREERS; i++) {
  const r = runCareer(i);
  if (!r) continue;
  results.push(r);
  totalSeasons += r.seasons; totalMs += r.elapsed;
  const s = summarize(r, i);
  console.log(JSON.stringify(s));
}

// determinism
function plainHash(i, opts) { runCareer(i, opts); return stateHash(); }
const dOpts = { collect: false, checks: false };
const hA = plainHash(0, dOpts);
const hB = plainHash(0, dOpts);
const hC = plainHash(0, { ...dOpts, roundTrip: true });
if (hA !== hB) fail('determinism: two plain runs differ', [hA, hB]);
if (hA !== hC) fail('determinism: save/load round trip differs', [hA, hC]);

// chunked vs unchunked fast-forward
{
  const opts = careerOpts(1);
  game.newCareer({ ...opts, seed: hash32(SEED, 99), now: 0 });
  game.fastForward({ until: 'weeks', weeks: 3 });
  const snap = JSON.stringify(game.serialize());
  const runFF = (chunk) => {
    game.loadState(JSON.parse(snap));
    let n = 0;
    for (;;) {
      const r = game.fastForward(chunk ? { until: 'season_end', maxWeeks: 2 } : { until: 'season_end' });
      chk('fastForward', r);
      if (r.stopped === 'review' || r.stopped === 'retired' || n++ > 400) break;
    }
    return stateHash();
  };
  const u = runFF(false), c = runFF(true);
  if (u !== c) fail('chunked fast-forward differs from unchunked', [u, c]);
  // next_match stops before the match
  game.loadState(JSON.parse(snap));
  const r = game.fastForward({ until: 'next_match' });
  if (r.stopped === 'until' && !r.hub.pending.match && r.hub.status !== 'match') {
    // may legitimately stop for other reasons; only flag if it claims 'until' without a match pending
    fail('fastForward next_match stopped without pending match', r.hub.status);
  }
}

// ---------------- report
const avgSeasonMs = totalSeasons ? totalMs / totalSeasons : 0;
const posRates = {};
for (const k of Object.keys(calib.pos)) { const P = calib.pos[k]; posRates[k] = { n: P.n, goals90: +(P.g / P.min * 90).toFixed(3), assists90: +(P.a / P.min * 90).toFixed(3) }; }
const avgRating = calib.ratings.length ? calib.ratings.reduce((a, b) => a + b, 0) / calib.ratings.length : 0;
const lgGpm = calib.lgMatches ? calib.lgGoals / calib.lgMatches : 0;
const homeWin = calib.lgN ? calib.homeW / calib.lgN : 0;
const draws = calib.lgN ? calib.draws / calib.lgN : 0;
const withTrophy = results.filter((r) => r.S.hist.trophies.length > 0).length / Math.max(1, results.length);
const bdoWin = results.filter((r) => r.S.hist.awards.some((a) => a.k === 'ballon_dor')).length / Math.max(1, results.length);
const retireAges = results.map((r) => r.retiredAge).filter((x) => x !== null);
const midTransfer = results.some((r) => r.midTransfer);
const maxSave = Math.max(0, ...results.map((r) => r.maxSize));

// calibration warnings (§5.19)
const TGT = { ST: [0.40, 0.55, 0.10, 0.20], W: [0.25, 0.40, 0.20, 0.30], CAM: [0.20, 0.35, 0.25, 0.35], CM: [0.08, 0.18, 0.10, 0.20], CDM: [0, 0.10, 0, 1], DEF: [0, 0.10, 0, 1] };
for (const k of Object.keys(posRates)) {
  const t = TGT[k]; if (!t) continue;
  const v = posRates[k];
  if (v.n < 15) continue;
  if (v.goals90 < t[0] || v.goals90 > t[1]) warn('goals/90 ' + k + ' = ' + v.goals90 + ' (target ' + t[0] + '-' + t[1] + ', n=' + v.n + ')');
  if (v.assists90 < t[2] || v.assists90 > t[3]) warn('assists/90 ' + k + ' = ' + v.assists90 + ' (target ' + t[2] + '-' + t[3] + ', n=' + v.n + ')');
}
if (lgGpm < 2.5 || lgGpm > 3.1) warn('league goals/match ' + lgGpm.toFixed(2) + ' (target 2.5-3.1)');
if (homeWin < 0.40 || homeWin > 0.50) warn('home win share ' + homeWin.toFixed(3) + ' (target 0.40-0.50)');
if (draws < 0.22 || draws > 0.30) warn('draw share ' + draws.toFixed(3) + ' (target 0.22-0.30)');
if (calib.gkMatches >= 20) { const cs = calib.gkCS / calib.gkMatches; if (cs < 0.25 || cs > 0.40) warn('GK clean sheets ' + cs.toFixed(3) + ' (target 0.25-0.40)'); }
if (avgRating < 6.5 || avgRating > 7.0) warn('average rating ' + avgRating.toFixed(2) + ' (target 6.5-7.0)');
if (!QUICK && results.length >= 5 && withTrophy < 0.6) warn('careers with a trophy ' + withTrophy.toFixed(2) + ' (target >= 0.6)');
if (bdoWin > 0.15 && results.length >= 5) warn("Ballon d'Or winners " + bdoWin.toFixed(2) + ' (target <= 0.15)');
for (const a of retireAges) if (a < 33 || a > 40) warn('retire age ' + a + ' outside 33-40');
if (!midTransfer && !QUICK) warn('no mid-season transfer happened in this run');
if (maxSave > 600 * 1024) warn('max save size ' + Math.round(maxSave / 1024) + ' KB > 600 KB');
if (avgSeasonMs > 1000) warn('avg season time ' + avgSeasonMs.toFixed(0) + ' ms > 1000 ms');
if (avgSeasonMs > 3000) fail('performance: avg season time ' + avgSeasonMs.toFixed(0) + ' ms > 3000 ms');

const report = {
  careers: results.length, seasonsSimulated: totalSeasons, seed: SEED,
  retireAges, trophiesPerCareer: results.map((r) => r.S.hist.trophies.length), awardsPerCareer: results.map((r) => r.S.hist.awards.length),
  careersWithTrophy: +withTrophy.toFixed(2), ballonDorWinners: +bdoWin.toFixed(2),
  perPos90: posRates, avgRating: +avgRating.toFixed(2), leagueGoalsPerMatch: +lgGpm.toFixed(2), homeWinShare: +homeWin.toFixed(3), drawShare: +draws.toFixed(3),
  gkCleanSheets: calib.gkMatches ? +(calib.gkCS / calib.gkMatches).toFixed(3) : null,
  maxSaveKB: Math.round(maxSave / 1024), saveKBBySeason: results[0] ? results[0].sizes.map((x) => Math.round(x / 1024)) : [],
  avgSeasonMs: Math.round(avgSeasonMs), totalSec: +((Date.now() - T0) / 1000).toFixed(1), midSeasonTransfer: midTransfer,
  determinism: hA === hB && hA === hC ? 'ok' : 'FAIL', checksRun: checkCounts,
};
console.log('REPORT ' + JSON.stringify(report, null, 1));
if (warnings.length) { console.log('CALIBRATION WARNINGS:'); for (const w of warnings) console.log('  - ' + w); }
if (violations.length) {
  console.log('VIOLATIONS (' + violations.length + '):');
  for (const v of violations.slice(0, 80)) console.log('  ! ' + v);
  process.exitCode = 1;
} else console.log('ALL INVARIANTS OK');
