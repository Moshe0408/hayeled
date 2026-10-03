// Headless career simulation through the facade only (SPEC §10.1).
// Usage: node tests/sim.mjs [--careers 12] [--seasons 25] [--seed 1] [--quick] [--gender m|f|both]   (default both: every career runs as a boy and as a girl)
import * as game from '../js/engine/game.js';
import { rngFor, hash32 } from '../js/core/rng.js';
import { LEAGUES, LEAGUE_BY_ID, CLUB_INDEX, EURO_FILLER_CLUBS } from '../js/data/leagues.js';
import { WOMEN_ECON } from '../js/engine/state.js';

// ---------------- args
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? Number(argv[i + 1]) : def; };
const QUICK = argv.includes('--quick');
const CAREERS = QUICK ? 3 : arg('careers', 12);
const SEASONS = QUICK ? 6 : arg('seasons', 25);
const SEED = arg('seed', 1);
const VERBOSE = argv.includes('--verbose');
const GARG = (() => { const i = argv.indexOf('--gender'); return i >= 0 && argv[i + 1] ? argv[i + 1] : 'both'; })();
const GENDERS = GARG === 'm' ? ['m'] : GARG === 'f' ? ['f'] : ['m', 'f'];

const violations = [];
const checkCounts = { seasonEnd: 0, world: 0, purity: 0, schedule: 0, player: 0, walks: 0, matchLogs: 0, women: 0, econ: 0, migrate: 0 };
const warnings = [];
function fail(msg, detail) {
  if (violations.length < 200) violations.push(detail !== undefined ? msg + ' :: ' + JSON.stringify(detail).slice(0, 400) : msg);
}
function warn(msg) { warnings.push(msg); }

// ---------------- deep scans
const PH = /\{[a-zA-Z0-9_]+\}/;
const GM = /\{\{|\}\}|undefined|NaN|\[object /;
let CUR_G = 'm';
const MEN_ONLY = /לנשים|לנערות|כדור הזהב לנשים|הכישרון הצעיר/;
function scanVM(v, where, path = '') {
  if (v === null || v === undefined) return;
  if (typeof v === 'number') { if (!Number.isFinite(v)) fail('non-finite number in ' + where + ' at ' + path, v); return; }
  if (typeof v === 'string') {
    if (PH.test(v)) fail('unfilled placeholder in ' + where + ' at ' + path, v);
    if (GM.test(v)) fail('gender marker leak in ' + where + ' at ' + path, v);
    if (CUR_G === 'm' && MEN_ONLY.test(v)) fail("women's name in a men's career " + where + ' at ' + path, v);
    return;
  }
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

// Walk every view model the facade can return right now (C2 leak scan) + women's names / econ checks (C3).
const W_EURO = { ucl: 'ליגת האלופות לנשים', uel: 'הליגה האירופית לנשים', uecl: 'הקונפרנס ליג לנשים' };
function walkAll(tag) {
  checkCounts.walks++;
  for (const [name, fn] of GETTERS) chk(name, fn());
  const comps = chk('getCompetitions', game.getCompetitions());
  const ids = new Set(comps.mine.map((c) => c.id).concat(comps.europe.map((c) => c.id)));
  for (const id of ids) { chk('getTable:' + id, game.getTable(id)); chk('getBracket:' + id, game.getBracket(id)); chk('getResults:' + id, game.getResults(id)); }
  for (const it of game.getInbox()) chk('getThread:' + it.id, game.getThread(it.id));
  const hub = game.getHub(), meta = game.getSaveMeta(), prof = game.getProfile();
  if (hub.player.gender !== CUR_G || meta.gender !== CUR_G || prof.gender !== CUR_G) fail(tag + ' gender mismatch in VMs', [CUR_G, hub.player.gender, meta.gender, prof.gender]);
  if (CUR_G === 'f') {
    checkCounts.women++;
    for (const c of comps.europe) if (c.he !== W_EURO[c.id]) fail(tag + " women's euro name", c);
    for (const g of comps.leagues) for (const it of g.items) {
      const lg = LEAGUE_BY_ID[it.id];
      if (lg && it.he !== lg.nameHeW) fail(tag + " women's league name", [it.id, it.he]);
      if (!lg && it.kind === 'cup') { const l2 = LEAGUES.find((l) => l.cup && l.cup.id === it.id); if (l2 && it.he !== l2.cup.nameHeW) fail(tag + " women's cup name", [it.id, it.he]); }
    }
    if (hub.club && hub.club.leagueHe && LEAGUE_BY_ID[game.serialize().world.clubs[hub.club.id].lg] && hub.club.leagueHe !== LEAGUE_BY_ID[game.serialize().world.clubs[hub.club.id].lg].nameHeW) fail(tag + " hub women's league", hub.club.leagueHe);
    const aw = game.getAwards();
    for (const a of aw.mine) {
      if (a.key === 'ballon_dor' && a.he !== 'כדור הזהב לנשים') fail(tag + " women's Ballon d'Or label", a.he);
      if (a.key === 'golden_boy' && a.he.indexOf('הכישרון הצעיר') < 0) fail(tag + ' women golden boy label', a.he);
    }
    const car = game.getCareer();
    for (const t of car.trophies) if ((t.key === 'ucl' || t.key === 'wc') && t.he.indexOf('לנשים') < 0) fail(tag + " women's trophy label", t);
    for (const s of game.getSchedule().fixtures) if (s.kind === 'europe' && s.compHe.indexOf('לנשים') < 0) fail(tag + " women's fixture comp", s.compHe);
  }
}

// ---------------- policy
const POS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
function careerOpts(i, gender = 'm') {
  const r = rngFor(SEED, i, 'opts');
  const co = game.getCreateOptions({ seed: hash32(SEED, i), gender });
  const fixedNations = ['isr', 'eng', 'bra', 'cro', 'isr', 'esp', 'arg', 'ger'];
  const nation = i < fixedNations.length ? fixedNations[i] : r.pick(co.nations).id;
  const pos = POS[(i * 3 + SEED) % POS.length];
  const ac = game.getAcademyOptions(nation, { gender });
  let groups = ac.groups;
  if (nation === 'isr' && i % 2 === 0) groups = groups.filter((g) => g.tier === 1);
  const g = r.pick(groups);
  const club = r.pick(g.clubs).id;
  const look = i % 3 === 0 ? { skin: i % 5, hair: (i * 7) % 6 } : undefined;
  return { first: (gender === 'f' ? 'שחקנית' : 'שחקן') + i, last: 'בדיקה', nick: r.chance(0.5) ? r.pick(co.nicknames) || '' : '', nation, pos, foot: r.chance(0.7) ? 'R' : 'L', club, gender, look };
}

function ageNow() { return game.getHub().player.age; }

function runCareer(i, { roundTrip = false, collect = true, checks = true, gender = 'm' } = {}) {
  CUR_G = gender;
  const opts = careerOpts(i, gender);
  const res = chk('newCareer', game.newCareer({ ...opts, seed: hash32(SEED, i, gender === 'f' ? 'f' : ''), now: 0 }));
  if (!res.ok) { fail('newCareer failed', res); return null; }
  if (checks) checkEcon(i, gender);
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
      const preLive = checks ? JSON.parse(JSON.stringify(game.serialize().live)) : null;
      const sum = chk('finishMatch', game.finishMatch());
      take();
      if (checks) checkMatchLog(sum, preLive, 'c' + i + gender + ' ' + S.season + 'w' + S.week);
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
      if (checks) walkAll('c' + i + gender + ' s' + S.season);
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
  if (checks) { checkSpells(S, 'c' + i + ' end'); walkAll('c' + i + gender + ' end'); }
  // inbox placeholders
  for (const it of S.inbox) for (const l of it.lines) { if (PH.test(l.t)) fail('inbox placeholder', l.t); if (GM.test(l.t)) fail('inbox gender marker', l.t); }
  for (const e of S.hist.timeline) if (GM.test(e.t) || PH.test(e.t)) fail('timeline leak', e.t);
  return { S, signals, elapsed, weeks, matches: matchCount, maxSize, sizes, midTransfer, retiredAge, opts, gender, seasons: S.season - start + (S.retired ? 1 : 0) };
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
    career: i, gender: p.gender, nation: p.nation, pos: p.pos, pot: p.pot, academy: r.opts.club, clubs, leagues, apps: tot.apps, goals: tot.g, assists: tot.a,
    trophies, awards, caps: p.caps.senior, intlGoals: p.ig.senior, youthCaps: p.caps.u17 + p.caps.u19 + p.caps.u21, peakOvr: p.peak,
    ballonDor: bdo, retired: S.retired ? S.retired.reason + '@' + S.retired.age : 'active@' + (S.season - p.born), legacy: S.retired ? S.retired.legacy : null,
    seasons: r.seasons, ms: r.elapsed, maxSaveKB: Math.round(r.maxSize / 1024),
    ovrByAge: S.hist.seasons.map((s) => s.age + ':' + s.ovr).join(' '),
  };
}

// ---------------- C4 match log structure
const EVS = new Set(['kickoff', 'goal', 'sub', 'card', 'ht', 'ft', 'et', 'pens', 'moment', 'info']);
function checkMatchLog(sum, live, tag) {
  checkCounts.matchLogs++;
  const log = sum.log || [];
  if (!log.length) { fail(tag + ' empty match log'); return; }
  if (log[0].ev !== 'kickoff') fail(tag + ' first log entry not kickoff', log[0]);
  if (log[log.length - 1].ev !== 'ft') fail(tag + ' last log entry not ft', log[log.length - 1].ev);
  const my = sum.isHome ? sum.score[0] : sum.score[1], th = sum.isHome ? sum.score[1] : sum.score[0];
  let gOwn = 0, gOpp = 0, gMe = 0, subMate = 0, subOpp = 0, subMe = 0, prevMin = -1;
  for (const e of log) {
    if (!EVS.has(e.ev)) fail(tag + ' bad ev', e.ev);
    if (typeof e.minute !== 'number' || e.minute < prevMin) fail(tag + ' log minutes not ordered', [prevMin, e.minute, e.ev]);
    prevMin = e.minute;
    if (!Array.isArray(e.score) || e.score.length !== 2) fail(tag + ' log entry without score', e);
    if (e.mega && e.who !== 'me') fail(tag + ' mega on a non-me entry', e);
    if (e.mega && e.ev !== 'goal') fail(tag + ' mega on a non-goal entry', e);
    if (e.ev === 'goal') {
      if (['me', 'mate', 'opp'].indexOf(e.who) < 0) fail(tag + ' goal without who', e);
      if (e.side !== 'own' && e.side !== 'opp') fail(tag + ' goal without side', e);
      if ((e.who === 'opp') !== (e.side === 'opp')) fail(tag + ' goal who/side mismatch', e);
      if (!e.scorerHe) fail(tag + ' goal without scorer', e);
      if (e.who === 'me' && !e.big) fail(tag + ' my goal not big', e);
      if (e.side === 'own') gOwn++; else gOpp++;
      if (e.who === 'me') gMe++;
    }
    if (e.ev === 'sub') {
      if (!e.inHe || !e.outHe) { if (!(e.who === 'me' && (e.inHe || e.outHe))) fail(tag + ' sub without names', e); }
      if (e.who === 'me') subMe++; else if (e.side === 'own') subMate++; else if (e.side === 'opp') subOpp++;
    }
  }
  if (gOwn !== my || gOpp !== th) fail(tag + ' goal entries != final score', [gOwn, gOpp, my, th]);
  if (gMe !== sum.goals) fail(tag + " 'me' goals != player goals", [gMe, sum.goals]);
  if (subMate < 2 || subOpp < 2) fail(tag + ' cosmetic subs missing', [subMate, subOpp]);
  if (live && live.role === 'bench' && subMe < 1) fail(tag + ' bench player without own sub entry');
  if (live && live.role === 'starter' && live.off < 90 && subMe < 1) fail(tag + ' subbed-off starter without own sub entry');
  const last = log[log.length - 1].score;
  if (last[0] !== sum.score[0] || last[1] !== sum.score[1]) fail(tag + ' last log score != final', [last, sum.score]);
}

// ---------------- C3 economy
function checkEcon(i, gender) {
  checkCounts.econ++;
  const S = game.serialize();
  const e = gender === 'f' ? WOMEN_ECON : 1;
  if (S.econ !== e) fail('c' + i + gender + ' econ', S.econ);
  if (S.player.gender !== gender) fail('c' + i + ' state gender', S.player.gender);
  if (S.player.money !== Math.round(1500 * e)) fail('c' + i + gender + ' start money not scaled', S.player.money);
  const s0 = S.world.clubs[S.player.club].s;
  if (S.player.contract.wage !== Math.round((150 + 5 * s0) * e)) fail('c' + i + gender + ' youth wage not scaled', S.player.contract.wage);
  const items = game.getShop().cats.flatMap((c) => c.items);
  const car = items.find((x) => x.id === 'car_old');
  if (car) { const exp = e === 1 ? 3000 : Number((3000 * e).toPrecision(2)); if (car.price !== exp) fail('c' + i + gender + ' shop price not scaled', [car.price, exp]); }
  const v = game.getHub().player.value;
  if (gender === 'f' && v > 2e6) fail('c' + i + ' women value too high', v);
}

// ---------------- v1 -> v2 migration
function migrationCheck() {
  checkCounts.migrate++;
  CUR_G = 'm';
  game.newCareer({ ...careerOpts(2, 'm'), seed: hash32(SEED, 'mig'), now: 0 });
  game.fastForward({ until: 'weeks', weeks: 6 });
  const v1 = JSON.parse(JSON.stringify(game.serialize()));
  v1.v = 1; delete v1.econ; delete v1.player.gender; delete v1.player.look; delete v1.player.num;
  const m = game.migrateState(v1, 1);
  const lr = game.loadState(m);
  if (!lr.ok) { fail('migrated v1 state does not load', lr); return; }
  const S = game.serialize();
  if (S.v !== game.SCHEMA_VERSION || S.econ !== 1 || S.player.gender !== 'm' || S.player.look !== null || typeof S.player.num !== 'number') fail('migration defaults', [S.v, S.econ, S.player.gender, S.player.look, S.player.num]);
  walkAll('migrated');
  // a v1 save taken in the middle of a live match (old LiveMatch shape) must keep playing
  for (let k = 0; k < 60 && !game.serialize().live; k++) {
    const r = game.fastForward({ until: 'next_match' });
    if (r.stopped === 'review') game.ackSeasonReview();
    for (const o of game.getOffers()) if (o.status === 'open' && o.canAccept) game.respondOffer(o.id, 'accept');
  }
  if (game.serialize().live) {
    let m = game.startMatch();
    if (m.moment) game.chooseMoment(0);
    const v1m = JSON.parse(JSON.stringify(game.serialize()));
    v1m.v = 1; delete v1m.econ; delete v1m.player.gender; delete v1m.player.look; delete v1m.player.num;
    const L = v1m.live;
    for (const k of ['ck', 'cc', 'cx', 'ci', 'out', 'mg', 'pn']) delete L[k];
    for (const k of ['x', 'b', 'ox', 'ob', 'po', 'pi']) delete L.nm[k];
    L.log = L.log.map((e) => ({ m: e.m, t: e.t, k: e.k }));
    const lr2 = game.loadState(game.migrateState(v1m, 1));
    if (!lr2.ok) fail('migrated mid-match v1 state does not load', lr2);
    else {
      chk('getMatch(migrated)', game.getMatch());
      const vm = chk('autoPlayMatch(migrated)', game.autoPlayMatch());
      for (const e of vm.log) if (!e.ev || !Array.isArray(e.score)) fail('migrated log entry without ev/score', e);
      chk('finishMatch(migrated)', game.finishMatch());
      chk('resumeWeek(migrated)', game.resumeWeek());
    }
  } else warn('migration check: no live match reached');
  let threw = false;
  try { game.migrateState({ v: game.SCHEMA_VERSION + 1 }, game.SCHEMA_VERSION + 1); } catch (e) { threw = true; }
  if (!threw) fail('migrateState accepts a newer schema');
}

// ---------------- main
const T0 = Date.now();
const results = [];
let totalSeasons = 0, totalMs = 0;
for (const gender of GENDERS) for (let i = 0; i < CAREERS; i++) {
  const r = runCareer(i, { gender });
  if (!r) continue;
  results.push(r);
  totalSeasons += r.seasons; totalMs += r.elapsed;
  const s = summarize(r, i);
  console.log(JSON.stringify(s));
}

// determinism
function plainHash(i, opts) { runCareer(i, opts); return stateHash(); }
let detOk = true;
const detHashes = {};
for (const gender of GENDERS) {
  const dOpts = { collect: false, checks: false, gender };
  const hA = plainHash(0, dOpts);
  const hB = plainHash(0, dOpts);
  const hC = plainHash(0, { ...dOpts, roundTrip: true });
  detHashes[gender] = hA;
  if (hA !== hB) { detOk = false; fail('determinism (' + gender + '): two plain runs differ', [hA, hB]); }
  if (hA !== hC) { detOk = false; fail('determinism (' + gender + '): save/load round trip differs', [hA, hC]); }
}
if (GENDERS.length === 2 && detHashes.m === detHashes.f) fail('boy and girl careers produced the same state');
migrationCheck();

// chunked vs unchunked fast-forward
for (const gender of GENDERS) {
  CUR_G = gender;
  const opts = careerOpts(1, gender);
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
  genders: GENDERS, determinism: detOk ? 'ok' : 'FAIL', checksRun: checkCounts,
};
console.log('REPORT ' + JSON.stringify(report, null, 1));
if (warnings.length) { console.log('CALIBRATION WARNINGS:'); for (const w of warnings) console.log('  - ' + w); }
if (violations.length) {
  console.log('VIOLATIONS (' + violations.length + '):');
  for (const v of violations.slice(0, 80)) console.log('  ! ' + v);
  process.exitCode = 1;
} else console.log('ALL INVARIANTS OK');
