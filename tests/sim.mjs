// Headless career simulation through the facade only (SPEC §10.1).
// Usage: node tests/sim.mjs [--careers 12] [--seasons 25] [--mgr-seasons 6] [--seed 1] [--quick] [--gender m|f|both]   (default both: every career runs as a boy and as a girl)
// v2.1: every career that retires goes on to a coaching career (best retirement offer -> --mgr-seasons manager seasons).
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
const MGR_SEASONS = QUICK ? 3 : arg('mgr-seasons', 6);
const VERBOSE = argv.includes('--verbose');
const V22_ONLY = argv.includes('--v22-only');   // only the v2.2 training-load / coach-talk section
const GARG = (() => { const i = argv.indexOf('--gender'); return i >= 0 && argv[i + 1] ? argv[i + 1] : 'both'; })();
const GENDERS = GARG === 'm' ? ['m'] : GARG === 'f' ? ['f'] : ['m', 'f'];

const violations = [];
const checkCounts = { seasonEnd: 0, world: 0, purity: 0, schedule: 0, player: 0, walks: 0, matchLogs: 0, women: 0, econ: 0, migrate: 0, manager: 0, reels: 0, legend: 0, money: 0 };
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
    if (v.indexOf('€') >= 0 || v.indexOf('{eur:') >= 0) fail('euro amount (not shekels) in ' + where + ' at ' + path, v);
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
  for (const k of ['load', 'sharp']) if (!(typeof p[k] === 'number' && p[k] >= 0 && p[k] <= 100)) fail(tag + ' ' + k + ' (v2.2)', p[k]);
  if (!(p.benchRun >= 0 && p.lowMin >= 0) || !p.talk || ['light', 'normal', 'hard', 'extreme'].indexOf(S.trainInt) < 0) fail(tag + ' v2.2 fields', [p.benchRun, p.lowMin, S.trainInt]);
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
  ['getSaveMeta', () => game.getSaveMeta()], ['getManager', () => game.getManager()],
  ['canTalkToCoach', () => game.canTalkToCoach()], ['getTrainingPreview', () => game.getTrainingPreview('balanced', 'hard')], ['getTrainingPreview:rest', () => game.getTrainingPreview('rest')],
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
  const mv = game.getManager();
  if (mv) for (const r of mv.recent.slice(0, 3)) extra.push(['getMatchReel:' + r.key, () => game.getMatchReel(r.key)]);
  if (game.serialize().retired) extra.push(['previewCoachingOffers', () => game.previewCoachingOffers(400)]);
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


// ---------------- R2 manager / coach career (after retirement)
const TIER_RANK = { national: 5, elite: 6, top: 4, lower: 3, assistant: 2, youth: 1 };
function bestOffer(offers) {
  return offers.slice().sort((a, b) => ((b.role === 'head' ? 1000 : 0) + b.strength + (TIER_RANK[b.tier] || 0)) - ((a.role === 'head' ? 1000 : 0) + a.strength + (TIER_RANK[a.tier] || 0)) || (a.id < b.id ? -1 : 1))[0];
}
function checkManagerVM(M, tag) {
  checkCounts.manager++;
  if (!M) { fail(tag + ' getManager null in manager mode'); return; }
  if (!(M.rep >= 0 && M.rep <= 100)) fail(tag + ' manager rep', M.rep);
  const R = M.record;
  if (R.w + R.d + R.l !== R.games) fail(tag + ' manager record w+d+l', R);
  if (M.job) {
    for (const b of M.job.bars) if (!(b.value >= 0 && b.value <= 100)) fail(tag + ' manager bar ' + b.key, b.value);
    if (M.job.transfers && !(M.job.transfers.budget >= 0)) fail(tag + ' manager budget', M.job.transfers.budget);
    if (!M.job.roleHe || !M.job.team || !M.job.team.nameHe) fail(tag + ' manager job VM', M.job);
    if (CUR_G === 'f' && /מאמן ראשי|עוזר מאמן|מאמן הנוער|מאמן הנבחרת/.test(M.job.roleHe)) fail(tag + ' masculine role in a women career', M.job.roleHe);
    if (CUR_G === 'm' && /מאמנת/.test(M.job.roleHe)) fail(tag + ' feminine role in a men career', M.job.roleHe);
  }
  const asst = M.job && M.job.role === 'assistant';
  const expTitle = asst ? (CUR_G === 'f' ? 'עוזרת המאמן' : 'עוזר המאמן') : (CUR_G === 'f' ? 'המאמנת' : 'המאמן');
  if (M.titleHe !== expTitle) fail(tag + ' manager title gender', M.titleHe);
  // v2.1 review: a female coach never gets a masculine reputation label / coaching phrase
  if (CUR_G === 'f' && /מתחיל להתבלט|מוערך מאוד|מוכר בליגה/.test(M.repHe || '')) fail(tag + ' masculine reputation in a women career', M.repHe);
  if (M.job && M.job.transfers) {
    // the window's transfer list is frozen: a signed target keeps the OVR / fee it was signed for
    for (const t of M.job.transfers.targets) {
      if (!t.signed) continue;
      const s = M.job.transfers.signed.find((x) => x.name === t.name);
      if (s && s.ovr !== t.ovr) fail(tag + ' signed target re-rolled', [t.name, s.ovr, t.ovr]);
    }
  }
  const jobGames = M.jobs.reduce((s, j) => s + j.games, 0);
  if (jobGames !== R.games) fail(tag + ' sum of job games != record', [jobGames, R.games]);
}
function checkReel(r, tag) {
  checkCounts.reels++;
  const rl = r.reel || [];
  if (!rl.length || rl[0].ev !== 'kickoff' || rl[rl.length - 1].ev !== 'ft') { fail(tag + ' reel shape', rl.map((e) => e.ev)); return; }
  let prev = -1, gh = 0, ga = 0;
  for (const e of rl) {
    if (e.minute < prev) fail(tag + ' reel minutes not ordered', [prev, e.minute]);
    prev = e.minute;
    if (e.ev === 'goal') { if (e.side === 'h') gh++; else ga++; if (!e.nameHe) fail(tag + ' reel goal without scorer', e); }
  }
  if (gh !== r.score[0] || ga !== r.score[1]) fail(tag + ' reel goals != score', [gh, ga, r.score]);
  const last = rl[rl.length - 1].score;
  if (last[0] !== r.score[0] || last[1] !== r.score[1]) fail(tag + ' reel final score', [last, r.score]);
}
const mgrAgg = { careers: 0, seasons: 0, sackings: 0, offers: 0, jobs: 0, trophies: 0, awards: 0, nation: 0, youth: 0, assistant: 0, head: 0, signings: 0, budgetAsks: 0, approved: 0, firstTier: [] };

function runManager(i, gender, pol, take, checks, collect) {
  const tag0 = 'c' + i + gender + ' mgr';
  let M = chk('getManager', game.getManager());
  const R0 = chk('getRetirement', game.getRetirement());
  if (!R0.coaching || R0.coaching.st !== 'offers' || !R0.coaching.offers.length) { fail(tag0 + ' no coaching offers at retirement', R0.coaching); return null; }
  if (R0.lastClub && !Array.isArray(R0.lastClub.colors)) fail(tag0 + ' retirement lastClub colours', R0.lastClub);
  const off = bestOffer(R0.coaching.offers);
  const a = chk('mgrRespondOffer', game.mgrRespondOffer(off.id, 'accept'));
  take();
  if (!a.ok) { fail(tag0 + ' accept coaching offer', a); return null; }
  if (collect) { mgrAgg.careers++; mgrAgg.firstTier.push([R0.coaching.band, off.tier, off.strength]); }
  const startSeason = game.serialize().season;
  let seasonsDone = 0, sacks = 0, offersSeen = new Set(), guard = 0;
  let prevSeason = startSeason;
  while (seasonsDone < MGR_SEASONS && guard++ < 60 * (MGR_SEASONS + 2)) {
    M = chk('getManager', game.getManager());
    const S = game.serialize();
    const tag = tag0 + ' ' + S.season + 'w' + S.week;
    if (checks) checkManagerVM(M, tag);
    if (M.st === 'done') break;
    for (const o of M.offers) offersSeen.add(o.id);
    // offers: unemployed -> take the best; employed -> sometimes move to a stronger team
    if (M.st === 'unemployed' && M.offers.length) {
      const o = bestOffer(M.offers);
      const r = chk('mgrRespondOffer', game.mgrRespondOffer(o.id, 'accept')); take();
      if (!r.ok) fail(tag + ' accept offer when unemployed', r);
      continue;
    }
    if (M.st === 'active' && M.offers.length) {
      for (const o of M.offers) {
        if (o.role === 'head' && M.job && (o.strength > M.job.strength + 3 || M.job.role !== 'head') && pol.chance(0.35)) { chk('mgrRespondOffer', game.mgrRespondOffer(o.id, 'accept')); take(); break; }
        else if (pol.chance(0.3)) { chk('mgrRespondOffer', game.mgrRespondOffer(o.id, 'reject')); take(); }
      }
      M = game.getManager();
    }
    // transfers
    if (M.job && M.job.transfers && M.job.transfers.open) {
      if (M.job.transfers.canRequest && pol.chance(0.5)) { const r = chk('mgrRequestBudget', game.mgrRequestBudget()); take(); if (collect) { mgrAgg.budgetAsks++; if (r.approved) mgrAgg.approved++; } }
      const T = game.getManager().job.transfers;
      for (const t of T.targets) {
        if (T.used >= T.max) break;
        if (t.signed || !t.affordable || !pol.chance(0.5)) continue;
        const r = chk('mgrSign', game.mgrSign(t.id)); take();
        if (r.ok && collect) mgrAgg.signings++;
        break;
      }
    }
    // tactic: follow the assistant's recommendation most of the time
    const rec = M.tactic.recommended;
    const tac = rec && pol.chance(0.6) ? rec : pol.pick(M.tactic.options).id;
    // play: mostly week by week (watch mode), sometimes a chunked fast-forward
    let sums = [];
    if (pol.chance(0.7)) { const r = chk('mgrAdvance', game.mgrAdvance(tac)); take(); if (!r.ok) { fail(tag + ' mgrAdvance', r); break; } sums = [r.summary]; }
    else { game.mgrSetTactic(tac); const r = chk('mgrFastForward', game.mgrFastForward({ until: pol.pick(['next_match', 'season_end']), maxWeeks: 3 })); take(); if (!r.ok) { fail(tag + ' mgrFastForward', r); break; } sums = r.summaries; }
    for (const sm of sums) {
      if (checks) for (const r of sm.results) checkReel(r, tag);
      if (sm.sacked) sacks++;
      if (sm.seasonEnded) {
        const S2 = game.serialize();
        if (checks) { checkSeasonEnd(S2, tag + ' mgr-season'); checkSchedule(tag + ' mgr-season'); }
        const M2 = game.getManager();
        if (M2.review) { chk('mgrAckReview', game.mgrAckReview()); }
      }
    }
    const S3 = game.serialize();
    if (checks) checkPlayer(S3, tag);
    if (S3.season !== prevSeason) {
      if (S3.season !== prevSeason + 1 || S3.week > 4) fail(tag + ' manager season increment', [prevSeason, S3.season, S3.week]);
      prevSeason = S3.season;
      seasonsDone++;
      if (checks) {
        checkWorld(S3, tag + ' world');
        const str = JSON.stringify(S3);
        if (str.length > 1.5e6) fail(tag + ' save too big', str.length);
        const lr = game.loadState(JSON.parse(str));
        if (!lr.ok) fail(tag + ' manager loadState round trip', lr);
        if (seasonsDone % 3 === 1) purityCheck(tag);
        walkAll(tag);
        const sch = game.getSchedule();
        if (S3.mgr && S3.mgr.st === 'active' && S3.mgr.job.kind === 'club' && S3.mgr.job.role === 'head' && !sch.fixtures.length) fail(tag + ' empty manager schedule');
        const comps = game.getCompetitions();
        if (S3.mgr && S3.mgr.st === 'active' && S3.mgr.job.kind === 'club') {
          const lid = S3.world.clubs[S3.mgr.job.team].lg;
          if (lid && !comps.mine.some((c) => c.id === lid)) fail(tag + ' managed league not in my competitions', lid);
          const tb = game.getTable(lid);
          if (S3.mgr.job.role === 'head' && !tb.groups.some((g) => g.rows.some((r) => r.mine && r.team.id === S3.mgr.job.team))) fail(tag + ' managed team not marked in table');
        }
      }
    }
  }
  M = chk('getManager', game.getManager());
  const S = game.serialize();
  if (collect) {
    mgrAgg.seasons += seasonsDone; mgrAgg.sackings += sacks; mgrAgg.offers += Array.from(offersSeen).length;
    mgrAgg.jobs += S.mgr.jobs.length; mgrAgg.trophies += S.mgr.trophies.length; mgrAgg.awards += S.mgr.awards.length;
    for (const j of S.mgr.jobs) { if (j.kind === 'nation') mgrAgg.nation++; else if (j.role === 'youth') mgrAgg.youth++; else if (j.role === 'assistant') mgrAgg.assistant++; else mgrAgg.head++; }
  }
  if (seasonsDone < MGR_SEASONS && M.st !== 'done') fail(tag0 + ' manager seasons not reached', [seasonsDone, MGR_SEASONS]);
  // retire from coaching (most careers), check the Hall of Fame entry shows player + coach
  if (pol.chance(0.8)) {
    const r = chk('mgrRetire', game.mgrRetire()); take();
    if (!r.ok) fail(tag0 + ' mgrRetire', r);
    const M2 = chk('getManager', game.getManager());
    if (M2.st !== 'done') fail(tag0 + ' manager not done after mgrRetire', M2.st);
    const a2 = game.mgrAdvance('balanced');
    if (a2.ok) fail(tag0 + ' mgrAdvance after coaching retirement should fail');
  }
  const e = chk('buildHallOfFameEntry', game.buildHallOfFameEntry());
  if (!e.coach || !(e.coach.games >= 0) || e.roleHe !== (gender === 'f' ? 'שחקנית + מאמנת' : 'שחקן + מאמן')) fail(tag0 + ' HoF entry without the coaching record', e.roleHe);
  if (!(e.legacy >= e.legacyPlayer)) fail(tag0 + ' HoF legacy', [e.legacy, e.legacyPlayer]);
  const car = chk('getCareer', game.getCareer());
  if (!car.coach) fail(tag0 + ' getCareer without coach record');
  return { seasons: seasonsDone, sacks, jobs: S.mgr.jobs.length, trophies: S.mgr.trophies.length, band: R0.coaching.band, first: off.tier + ':' + off.team.nameHe };
}

// legends get better jobs (pure preview through the facade)
function legendCheck(tag) {
  checkCounts.legend++;
  const L = chk('previewCoachingOffers', game.previewCoachingOffers(650));
  const G2 = chk('previewCoachingOffers', game.previewCoachingOffers(170));
  const A = chk('previewCoachingOffers', game.previewCoachingOffers(15));
  if (L.band !== 'legend' || A.band !== 'average') fail(tag + ' legacy bands', [L.band, G2.band, A.band]);
  const bestHead = (o) => Math.max(0, ...o.offers.filter((x) => x.role === 'head').map((x) => x.strength));
  if (!L.offers.some((x) => x.kind === 'nation')) fail(tag + ' legend without a national-team offer', L.offers);
  if (!L.offers.some((x) => x.role === 'head' && x.kind === 'club' && x.strength >= 78)) fail(tag + ' legend without a big-club head-coach offer', L.offers);
  if (!(bestHead(L) > bestHead(A))) fail(tag + ' legend head-coach offers not better than average', [bestHead(L), bestHead(A)]);
  if (A.offers.some((x) => x.tier === 'elite' || x.kind === 'nation')) fail(tag + ' average player offered an elite job', A.offers);
  if (!A.offers.some((x) => x.role === 'youth' || x.tier === 'lower')) fail(tag + ' average player without youth / lower-league offer', A.offers);
  if (!G2.offers.some((x) => x.role === 'assistant' || x.tier === 'lower')) fail(tag + ' good player without assistant / lower-league offer', G2.offers);
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

function runCareer(i, { roundTrip = false, collect = true, checks = true, gender = 'm', manager = true, full = false } = {}) {
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
  const SEAS = (QUICK && i === 0 && manager) || full ? 30 : SEASONS;
  for (let guard = 0; guard < 60 * SEAS + 100; guard++) {
    let S = game.serialize();
    if (S.retired) break;
    if (S.season >= start + SEAS) break;
    // pending review
    if (S.pending.review !== null) {
      chk('getSeasonReview', game.getSeasonReview());
      if (checks && lastSeasonChecked !== S.season) { checkSeasonEnd(S, 'c' + i + ' s' + S.season); lastSeasonChecked = S.season; checkSchedule('c' + i + ' s' + S.season); }
      if (ageNow() >= 33 && pol.chance(0.5)) { const rr = chk('retire', game.retire()); take(); if (!rr.ok) fail('retire failed', rr); break; }
      chk('ack', game.ackSeasonReview());
      take();
      continue;
    }
    // training
    const hub = chk('getHub', game.getHub());
    const tr = pol.pick(hub.training.options.filter((o) => !o.disabled)).id;
    // v2.2: intensity (mostly normal) and the coach talk when it opens
    const ir = pol.next();
    const it = ir < 0.5 ? 'normal' : ir < 0.7 ? 'light' : ir < 0.9 ? 'hard' : 'extreme';
    const ct = hub.coachTalk;
    if (ct && ct.ok && !(ct.benchRun >= ct.threshold || ct.lowMin >= 4)) fail('coach talk open without a bench run', ct);
    if (ct && !ct.ok && game.talkToCoach('ask').ok) fail('talkToCoach went through while closed', ct.reasonHe);
    if (ct && ct.ok && pol.chance(0.6)) {
      const tk = chk('talkToCoach', game.talkToCoach(pol.pick(['ask', 'demand', 'threat'])));
      take();
      if (!tk.ok) fail('talkToCoach failed while open', tk);
      else if (tk.success && !tk.promise) fail('successful talk without a promise', tk);
    }
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
    let a = chk('advanceWeek', game.advanceWeek({ focus: tr, intensity: it }));
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
  take();
  let mgrRes = null;
  if (manager && game.serialize().retired) {
    if (checks) legendCheck('c' + i + gender);
    mgrRes = runManager(i, gender, pol, take, checks, collect);
  }
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
    const rp = signals.find((x) => x.name === 'retired').props;
    if (rp.gender !== gender || !('league' in rp) || !('tier' in rp) || typeof rp.top5 !== 'boolean' || !Number.isFinite(rp.legacy)) fail('retired signal props', rp);
  }
  const cs0 = signals.find((x) => x.name === 'career_started');
  if (cs0 && (cs0.props.gender !== gender || !cs0.props.nation || !cs0.props.position || !cs0.props.club)) fail('career_started props', cs0.props);
  { let tg = 0; for (const s2 of S.hist.seasons) for (const k of ['lg', 'cup', 'eu', 'nt', 'yth', 'ynt']) tg += s2.stats[k].g; if (!S.hist.seasons.some((x) => x.s === S.season)) for (const k of ['lg', 'cup', 'eu', 'nt', 'yth', 'ynt']) tg += S.player.s[k].g;
    if (count('goal') !== tg) fail('goal signals != player goals', [count('goal'), tg]);
    for (const g2 of signals.filter((x) => x.name === 'goal')) if (typeof g2.props.mega !== 'boolean') { fail('goal signal without mega', g2.props); break; } }
  if (S.mgr) {
    if (count('manager_started') !== S.mgr.jobs.length) fail('manager_started count != jobs', [count('manager_started'), S.mgr.jobs.length]);
    for (const ms of signals.filter((x) => x.name === 'manager_started')) if (!ms.props.tier || ms.props.gender !== gender) fail('manager_started props', ms.props);
    if (count('manager_retired') > 1) fail('manager_retired > 1');
    if (S.mgr.st === 'done' && S.mgr.jobs.length && count('manager_retired') !== 1) fail('manager_retired missing');
  }
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
  return { S, signals, elapsed, weeks, matches: matchCount, maxSize, sizes, midTransfer, retiredAge, opts, gender, seasons: (S.retired ? S.retired.season : S.season) - start + (S.retired ? 1 : 0), mgr: mgrRes };
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
    seasons: r.seasons, ms: r.elapsed, maxSaveKB: Math.round(r.maxSize / 1024), coach: r.mgr,
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
  if (car) { const exp = e === 1 ? 3000 : Number((3000 * Math.sqrt(e)).toPrecision(2)); if (car.price !== exp) fail('c' + i + gender + ' shop price not scaled', [car.price, exp]); }
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

// ---------------- v2 -> v3 migration (coaching career state)
function migrationV3Check() {
  checkCounts.migrate++;
  CUR_G = 'm';
  game.newCareer({ ...careerOpts(3, 'm'), seed: hash32(SEED, 'mig3'), now: 0 });
  game.fastForward({ until: 'weeks', weeks: 4 });
  const v2 = JSON.parse(JSON.stringify(game.serialize()));
  v2.v = 2; delete v2.mgr;
  const lr = game.loadState(game.migrateState(v2, 2));
  if (!lr.ok) { fail('migrated v2 state does not load', lr); return; }
  const S = game.serialize();
  if (S.v !== game.SCHEMA_VERSION || S.mgr !== null) fail('v3 migration defaults', [S.v, S.mgr]);
  if (game.getManager() !== null) fail('getManager on an active player career should be null');
  walkAll('migrated-v3');
  // a retired v2 career (no coaching state) gets its offers on the retirement screen
  const r2 = JSON.parse(JSON.stringify(S));
  r2.retired = { season: r2.season, week: r2.week, age: 33, reason: 'voluntary', legacy: 120 };
  r2.player.stage = 'retired'; r2.player.club = null; r2.player.contract = null; r2.v = 2; delete r2.mgr;
  const lr2 = game.loadState(game.migrateState(r2, 2));
  if (!lr2.ok) { fail('migrated retired v2 state does not load', lr2); return; }
  const e = game.ensureCoachingOffers();
  if (!e.ok || !e.created) fail('ensureCoachingOffers on a migrated retired career', e);
  const R = chk('getRetirement(migrated)', game.getRetirement());
  if (!R.coaching || !R.coaching.offers.length) fail('migrated retired career without coaching offers', R.coaching);
  const e2 = game.ensureCoachingOffers();
  if (e2.created) fail('ensureCoachingOffers not idempotent');
  // v2.1 review: a coaching job with no managed match does not turn the HoF entry into "player + coach"
  const o0 = R.coaching.offers[0];
  game.mgrRespondOffer(o0.id, 'accept');
  const h0 = game.buildHallOfFameEntry();
  if (h0 && (h0.coach || /מאמן/.test(h0.tierHe || ''))) fail('HoF coach record with zero managed matches', [h0.tierHe, h0.coach]);
  // v2 saves carry rendered euro amounts in persisted texts: the migration shows them in shekels
  const r3 = JSON.parse(JSON.stringify(S));
  r3.v = 2; delete r3.mgr;
  if (r3.inbox.length && r3.inbox[0].lines && r3.inbox[0].lines.length) r3.inbox[0].lines[0].t = 'בונוס חתימה של €15,000 ושכר €2.5K לשבוע';
  r3.hist.timeline.push({ id: 'tx', s: r3.season, w: r3.week, icon: 'transfer', t: 'מעבר למכבי תמורת €1.2M' });
  const lr3 = game.loadState(game.migrateState(r3, 2));
  if (!lr3.ok) fail('v2 state with euro texts does not load', lr3);
  const j3 = JSON.stringify(game.serialize());
  if (j3.indexOf('€') >= 0) fail('euro sign survives the v2 -> v3 migration', j3.slice(j3.indexOf('€') - 40, j3.indexOf('€') + 20));
  if (j3.indexOf('₪4.7 מיליון') < 0) fail('migrated timeline amount not in shekels');
  // a forced retirement sits at week 52 after the world rollover: the migrated career must not roll the world twice
  const r4 = JSON.parse(JSON.stringify(S));
  r4.v = 2; delete r4.mgr; r4.week = 52;
  r4.retired = { season: r4.season, week: 52, age: 40, reason: 'age', legacy: 120 };
  r4.player.stage = 'retired'; r4.player.club = null; r4.player.contract = null;
  const lr4 = game.loadState(game.migrateState(r4, 2));
  if (!lr4.ok) { fail('week-52 retired v2 state does not load', lr4); return; }
  const s4 = game.serialize().season;
  const strength0 = JSON.stringify(game.serialize().world.clubs);
  game.ensureCoachingOffers();
  if (!game.serialize().mgr.roll) fail('week-52 forced retirement: coaching state should finish the pending rollover only');
  const R4 = game.getRetirement();
  game.mgrRespondOffer(R4.coaching.offers[0].id, 'accept');
  const S4 = game.serialize();
  if (S4.season !== s4 + 1 || S4.week !== 1) fail('week-52 migration: season switch', [s4, S4.season, S4.week]);
  if (JSON.stringify(Object.fromEntries(Object.entries(S4.world.clubs).map(([k, v]) => [k, v.s]))) !== JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(strength0)).map(([k, v]) => [k, v.s])))) fail('week-52 migration: club strengths evolved a second time');
  // a job taken after week 40 is not judged on an objective the board sets at week 44
  const r5 = JSON.parse(JSON.stringify(S));
  r5.v = 2; delete r5.mgr; r5.week = 41;
  r5.retired = { season: r5.season, week: 41, age: 34, reason: 'voluntary', legacy: 150 };
  r5.player.stage = 'retired'; r5.player.club = null; r5.player.contract = null;
  if (!game.loadState(game.migrateState(r5, 2)).ok) { fail('week-41 retired v2 state does not load'); return; }
  game.ensureCoachingOffers();
  game.mgrRespondOffer(game.getRetirement().coaching.offers[0].id, 'accept');
  const conf0 = game.serialize().mgr.job.conf;
  for (let k = 0; k < 4; k++) game.mgrAdvance('balanced');
  const M5 = game.serialize().mgr;
  const row = M5.seasons.find((x) => x.s === r5.season && !x.part);
  if (!row) fail('late job: no season row');
  else if (row.met !== null) fail('late job judged on a week-44 objective', row);
  if (M5.st !== 'active') fail('late job: sacked / left at the first season end', M5.st);
  void conf0;
}

// chunked manager fast-forward == week-by-week, and a save/load round trip mid coaching career keeps the state identical
function managerDeterminism() {
  for (const gender of GENDERS) {
    CUR_G = gender;
    runCareer(0, { collect: false, checks: false, gender, manager: false, full: true });
    if (!game.serialize().retired) { const r = game.retire(); if (!r.ok) { warn('manager determinism: could not retire (' + gender + ')'); continue; } }
    const R = game.getRetirement();
    const o = bestOffer(R.coaching.offers);
    game.mgrRespondOffer(o.id, 'accept');
    game.getAndClearSignals();
    const snap = JSON.stringify(game.serialize());
    const weekly = () => { game.loadState(JSON.parse(snap)); for (let k = 0; k < 70; k++) { const r = game.mgrAdvance('press'); if (!r.ok) break; if (game.getManager().st === 'unemployed') break; } return stateHash(); };
    const chunked = () => { game.loadState(JSON.parse(snap)); game.mgrSetTactic('press'); let n = 0; while (n < 70) { const r = game.mgrFastForward({ until: 'weeks', weeks: Math.min(7, 70 - n), maxWeeks: 7 }); if (!r.ok || !r.weeks) break; n += r.weeks; if (game.getManager().st === 'unemployed') break; } return { h: stateHash(), n }; };
    const a = weekly();
    const c = chunked();
    const nWeekly = (() => { game.loadState(JSON.parse(snap)); let n = 0; for (let k = 0; k < 70; k++) { const r = game.mgrAdvance('press'); if (!r.ok) break; n++; if (game.getManager().st === 'unemployed') break; } return n; })();
    if (c.n === nWeekly && a !== c.h) fail('manager: chunked fast-forward differs from week-by-week (' + gender + ')', [a, c.h]);
    // round trip in the middle
    game.loadState(JSON.parse(snap));
    for (let k = 0; k < 30; k++) game.mgrAdvance('attack');
    const mid = JSON.stringify(game.serialize());
    for (let k = 0; k < 30; k++) game.mgrAdvance('defend');
    const h1 = stateHash();
    game.loadState(JSON.parse(mid));
    for (let k = 0; k < 30; k++) game.mgrAdvance('defend');
    if (stateHash() !== h1) fail('manager: save/load round trip changes the outcome (' + gender + ')');
  }
}

// every kind of coaching job (national team / assistant / youth) through the facade: the retired snapshot gets a
// different legacy so the retirement offers change (legend -> national team, good -> assistant, average -> youth)
function coachingRoles() {
  for (const gender of GENDERS) {
    CUR_G = gender;
    runCareer(1, { collect: false, checks: false, gender, manager: false, full: true });
    if (!game.serialize().retired) { const r = game.retire(); if (!r.ok) { warn('coachingRoles: could not retire (' + gender + ')'); continue; } }
    const snap = JSON.parse(JSON.stringify(game.serialize()));
    for (const [legacy, want] of [[650, (o) => o.kind === 'nation'], [170, (o) => o.role === 'assistant'], [15, (o) => o.role === 'youth']]) {
      const st = JSON.parse(JSON.stringify(snap));
      st.retired.legacy = legacy; st.mgr = null;
      const lr = game.loadState(st);
      if (!lr.ok) { fail('coachingRoles loadState', lr); continue; }
      game.ensureCoachingOffers();
      const R = chk('getRetirement', game.getRetirement());
      const o = R.coaching.offers.find(want);
      const tag = 'role ' + gender + ' L' + legacy;
      if (!o) { fail(tag + ' expected offer kind missing', R.coaching.offers.map((x) => x.kind + '/' + x.role)); continue; }
      game.getAndClearSignals();
      chk('mgrRespondOffer', game.mgrRespondOffer(o.id, 'accept'));
      const sig = game.getAndClearSignals().find((x) => x.name === 'manager_started');
      const expTier = o.kind === 'nation' ? 'national' : o.role;
      if (!sig || sig.props.tier !== expTier) fail(tag + ' manager_started tier', sig && sig.props);
      let seasons = 0, played = 0;
      const s0 = game.serialize().season;
      for (let k = 0; k < 200 && seasons < 2; k++) {
        const M = chk('getManager', game.getManager());
        checkManagerVM(M, tag);
        if (M.st === 'unemployed') { if (M.offers.length) game.mgrRespondOffer(bestOffer(M.offers).id, 'accept'); }
        const r = chk('mgrAdvance', game.mgrAdvance(M.tactic.recommended || 'balanced'));
        if (!r.ok) { fail(tag + ' mgrAdvance', r); break; }
        for (const x of r.summary.results) { checkReel(x, tag); played++; }
        if (r.summary.seasonEnded) { checkSeasonEnd(game.serialize(), tag); game.mgrAckReview(); }
        seasons = game.serialize().season - s0;
      }
      if (!played) fail(tag + ' no managed matches in two seasons');
      walkAll(tag);
      purityCheck(tag);
      const S = game.serialize();
      if (o.kind === 'nation' && S.mgr.res.some((x) => x.k !== 'national' && x.k !== 'friendly')) fail(tag + ' a national-team manager played club matches');
      if (o.role === 'youth' && S.mgr.res.some((x) => x.k !== 'youth')) fail(tag + ' a youth coach played senior matches');
    }
  }
}


// ---------------- v2.2 training load + coach talk (docs/SPEC-2.2-training-bench.md §9)
const v22 = { policies: {}, talk: {}, promise: {}, checks: 0 };
const POLICIES = {
  normal: () => ({ focus: 'balanced', intensity: 'normal' }),
  extreme: () => ({ focus: 'balanced', intensity: 'extreme' }),
  rest: () => ({ focus: 'rest', intensity: 'light' }),
  smart: (h) => ({ focus: 'balanced', intensity: h.player.load < 50 ? 'hard' : 'light' }),
  light: () => ({ focus: 'balanced', intensity: 'light' }),
  hard: () => ({ focus: 'balanced', intensity: 'hard' }),
};
// One career under a fixed training policy (offers / events answered the same way for every policy).
function policyCareer(i, gender, name, seasons) {
  CUR_G = gender;
  const opts = careerOpts(i, gender);
  game.newCareer({ ...opts, seed: hash32(SEED, i, gender, 'pol'), now: 0 });
  game.getAndClearSignals();
  const start = game.serialize().startSeason;
  const st = { peak: 0, ovr25: null, inj: 0, trainInj: 0, burnouts: 0, sharp: 0, load: 0, weeks: 0, apps: 0 };
  for (let guard = 0; guard < 60 * seasons + 100; guard++) {
    const S = game.serialize();
    if (S.retired || S.season >= start + seasons) break;
    if (S.pending.review !== null) { game.ackSeasonReview(); continue; }
    const hub = game.getHub();
    for (const o of game.getOffers()) {
      if (o.status !== 'open' || !o.canAccept) continue;
      const curS = hub.club && S.world.clubs[hub.club.id] ? S.world.clubs[hub.club.id].s : 0;
      const ok = o.type === 'pro' || o.type === 'renewal' || hub.player.stage === 'free' || (o.type !== 'loan' && o.club.strength > curS + 2);
      game.respondOffer(o.id, ok ? 'accept' : 'reject');
    }
    let a = game.advanceWeek(POLICIES[name](hub));
    while (a.ok && a.status === 'match') { game.autoPlayMatch(); game.finishMatch(); a = game.resumeWeek(); }
    if (!a.ok) { if (a.error === 'review_pending' || a.error === 'retired') continue; fail('policy advanceWeek failed', a); break; }
    for (const it of game.getInbox()) {
      if (!it.needsAnswer) continue;
      const th = game.getThread(it.id);
      const ch = (th.choices || []).filter((c) => !c.disabled);
      if (!ch.length) continue;
      // a fixed policy keeps its intensity: it answers the physio "I'm fine" (choice 1); smart takes the light week
      const pick = name !== 'smart' && th.ev && /^physio_warn/.test(th.ev) ? (ch.find((c) => c.index === 1) || ch[0]) : ch[0];
      game.answerEvent(it.id, pick.index);
    }
    const S2 = game.serialize();
    const p = S2.player;
    if (!(p.load >= 0 && p.load <= 100) || !(p.sharp >= 0 && p.sharp <= 100)) fail('load / sharp out of range', [name, p.load, p.sharp]);
    if (S2.week <= 45 && S2.week >= 2) { st.sharp += p.sharp; st.load += p.load; st.weeks++; }
    if (S2.season - p.born === 25 && st.ovr25 === null) st.ovr25 = game.getHub().player.ovr;
  }
  const S = game.serialize();
  const sig = game.getAndClearSignals();
  st.peak = S.player.peak;
  st.trainInj = sig.filter((x) => x.name === 'injury_training').length;
  st.burnouts = sig.filter((x) => x.name === 'burnout').length;
  st.inj = S.hist.timeline.filter((e) => e.icon === 'injury').length;
  st.sharp = st.weeks ? st.sharp / st.weeks : 0;
  st.load = st.weeks ? st.load / st.weeks : 0;
  for (const s2 of S.hist.seasons) for (const k of ['lg', 'cup', 'eu']) st.apps += s2.stats[k].apps;
  if (sig.filter((x) => x.name === 'training').some((x) => !x.props.focus || ['light', 'normal', 'hard', 'extreme'].indexOf(x.props.intensity) < 0)) fail('training signal props', name);
  return st;
}
function trainingPolicies() {
  const seeds = QUICK ? [0, 1] : [0, 1, 2, 3];
  const seas = QUICK ? 14 : 25;
  const names = QUICK ? ['normal', 'extreme', 'rest', 'smart'] : Object.keys(POLICIES);
  const agg = {};
  for (const name of names) {
    const rows = [];
    for (const gender of GENDERS) for (const i of seeds) rows.push(policyCareer(i, gender, name, seas));
    const mean = (k) => +(rows.reduce((s, r) => s + (r[k] || 0), 0) / rows.length).toFixed(2);
    agg[name] = { n: rows.length, peak: mean('peak'), ovr25: mean('ovr25'), injuries: mean('inj'), trainInj: mean('trainInj'), burnouts: mean('burnouts'), sharp: mean('sharp'), load: mean('load'), apps: mean('apps'),
      peaks: rows.map((r) => r.peak).join(' ') };
  }
  v22.policies = agg;
  const A = agg;
  const chkP = (cond, msg) => { if (!cond) (QUICK ? warn : fail)('v2.2 policy: ' + msg); };
  chkP(A.extreme.injuries > A.normal.injuries, 'always-extreme should get more injuries than normal ' + JSON.stringify([A.extreme.injuries, A.normal.injuries]));
  chkP(A.extreme.burnouts > A.normal.burnouts, 'always-extreme should burn out more than normal ' + JSON.stringify([A.extreme.burnouts, A.normal.burnouts]));
  chkP(A.extreme.peak <= A.normal.peak + 0.25, 'always-extreme must not beat normal on peak OVR ' + JSON.stringify([A.extreme.peak, A.normal.peak]));
  chkP(A.rest.sharp < 35, 'always-rest sharpness should be low ' + A.rest.sharp);
  chkP(A.rest.peak < A.normal.peak - 5, 'always-rest should progress much less ' + JSON.stringify([A.rest.peak, A.normal.peak]));
  for (const k of Object.keys(A)) if (k !== 'smart') chkP(A.smart.peak > A[k].peak, 'smart should have the highest mean peak OVR (vs ' + k + ') ' + JSON.stringify([A.smart.peak, A[k].peak]));
}

// coach talk: odds vs outcomes, the promise, no talk before the bench run
function talkScenario(gender) {
  // a pro career a few weeks into a season, idle (no week in progress)
  CUR_G = gender;
  for (let i = 0; i < 12; i++) {
    game.newCareer({ ...careerOpts(i, gender), seed: hash32(SEED, 'talk', i, gender), now: 0 });
    for (let k = 0; k < 40; k++) {
      const S = game.serialize();
      if (S.player.stage === 'pro' && S.player.club && S.week >= 3 && S.week <= 30 && !S.player.injury && !S.player.contract.loan) return true;
      if (S.pending.review !== null) game.ackSeasonReview();
      for (const o of game.getOffers()) if (o.status === 'open' && o.canAccept && (o.type === 'pro' || o.type === 'renewal' || o.type === 'transfer')) game.respondOffer(o.id, 'accept');
      game.fastForward({ until: 'weeks', weeks: 13 });
    }
  }
  return false;
}
function coachTalkChecks() {
  for (const gender of GENDERS) {
    if (!talkScenario(gender)) { fail('coach talk: no pro scenario reached (' + gender + ')'); continue; }
    // no talk before the bench run
    game.devSetBench(0, 0);
    const c0 = chk('canTalkToCoach', game.canTalkToCoach());
    if (c0.ok) fail('coach talk allowed with benchRun 0', c0);
    const t0 = game.talkToCoach('ask');
    if (t0.ok) fail('talkToCoach succeeded without a bench run', t0);
    game.devSetBench(2, 0);
    if (game.canTalkToCoach().ok) fail('coach talk allowed with benchRun 2');
    game.devSetBench(3, 0);
    const c3 = chk('canTalkToCoach(3)', game.canTalkToCoach());
    if (!c3.ok || !c3.approaches || c3.approaches.length !== 3) { fail('coach talk not offered at benchRun 3', c3); continue; }
    if (!c3.openHe) fail('coach talk without an opening line', c3);
    const base = JSON.parse(JSON.stringify(game.serialize()));
    const N = QUICK ? 240 : 700;
    for (const ap of ['ask', 'demand', 'threat']) {
      let sumP = 0, wins = 0, promised = 0, kept = 0, lapsed = 0;
      for (let k = 0; k < N; k++) {
        const s = JSON.parse(JSON.stringify(base));
        const r = rngFor(SEED, gender, ap, k);
        s.rng = hash32(SEED, gender, ap, k, 'rng');
        s.player.trust = r.int(20, 90); s.player.load = r.int(0, 95); s.player.form = [r.int(55, 80) / 10, r.int(55, 80) / 10];
        if (!game.loadState(s).ok) { fail('talk scenario loadState'); break; }
        const c = game.canTalkToCoach();
        if (!c.ok) { fail('talk not available in scenario', c.reasonHe); break; }
        const pr = c.approaches.find((x) => x.id === ap).chance;
        const out = game.talkToCoach(ap);
        if (!out.ok) { fail('talkToCoach failed', out); break; }
        if (k < 40) chk('talkToCoach', out);
        sumP += pr; if (out.success) wins++;
        if (game.canTalkToCoach().ok) fail('a second talk right after the first one is allowed');
        if (out.success && k % 3 === 0) {
          if (!out.promise) { fail('successful talk without a promise', out); continue; }
          // play the promised matches: the player should start
          promised++;
          for (let w = 0; w < 5; w++) {
            if (!game.serialize().player.talk.promise) break;
            let a = game.advanceWeek({ focus: 'balanced', intensity: 'light' });
            while (a.ok && a.status === 'match') { game.autoPlayMatch(); game.finishMatch(); a = game.resumeWeek(); }
            if (!a.ok) break;
          }
          const P = game.serialize().player;
          if (P.talk.res === 'kept') kept++;
          else if (P.talk.res !== 'broken') { promised--; lapsed++; }   // lapsed (injury / call-up weeks): not judged
        }
      }
      const exp = sumP / N, got = wins / N;
      v22.talk[gender + ':' + ap] = { expected: +exp.toFixed(3), observed: +got.toFixed(3), n: N };
      if (Math.abs(exp - got) > 0.05) fail('coach talk ' + ap + ' success rate vs formula', [gender, exp, got]);
      v22.promise[gender + ':' + ap] = { promised, kept, lapsed, rate: promised ? +(kept / promised).toFixed(3) : null };
    }
    let pAll = 0, kAll = 0;
    for (const ap of ['ask', 'demand', 'threat']) { const x = v22.promise[gender + ':' + ap]; pAll += x.promised; kAll += x.kept; }
    if (pAll < 20) fail('too few promises to judge', [gender, pAll]);
    else if (kAll / pAll <= 0.9) fail('a promise should lead to a start > 90%', [gender, kAll, pAll]);
    v22.checks++;
  }
}

// the v2.2 hub / preview VMs and the intensity rules
function trainingApiChecks() {
  for (const gender of GENDERS) {
    CUR_G = gender;
    game.newCareer({ ...careerOpts(4, gender), seed: hash32(SEED, 'api', gender), now: 0 });
    const h = chk('getHub(v22)', game.getHub());
    for (const k of ['load', 'loadBand', 'sharp', 'sharpHe']) if (h.player[k] === undefined) fail('hub.player.' + k + ' missing');
    if (['fresh', 'tired', 'heavy', 'burnt'].indexOf(h.player.loadBand) < 0) fail('bad loadBand', h.player.loadBand);
    if (!h.training || !h.training.intensity || !h.training.preview || !h.coachTalk) fail('hub training / coachTalk missing', h.training);
    const pv = {};
    for (const it of ['light', 'normal', 'hard', 'extreme']) {
      pv[it] = chk('getTrainingPreview', game.getTrainingPreview('balanced', it));
      for (const k of ['energyDelta', 'loadDelta', 'growthMult', 'sharpDelta', 'injuryRiskHe', 'warnHe']) if (pv[it][k] === undefined) fail('preview.' + k + ' missing', it);
    }
    if (!(pv.hard.energyDelta < pv.normal.energyDelta && pv.hard.loadDelta > pv.normal.loadDelta && pv.hard.growthMult > pv.normal.growthMult)) fail('hard preview should cost more and grow more', [pv.hard, pv.normal]);
    // a 15-year-old cannot train at extreme
    const ex = game.setTraining('balanced', 'extreme');
    if (ex.ok) fail('extreme intensity allowed under 16');
    if (!pv.extreme.locked) fail('extreme preview should be locked under 16');
    const rs = chk('getTrainingPreview(rest)', game.getTrainingPreview('rest'));
    if (rs.growthMult !== 0 || rs.loadDelta >= 0) fail('rest preview', rs);
    const ok = game.setTraining('balanced', 'hard');
    if (!ok.ok || !ok.preview || game.getHub().training.intensity !== 'hard') fail('setTraining(focus, intensity)', ok);
    // hard costs energy: one week at hard from a full tank ends lower than one at light
    const snap = JSON.stringify(game.serialize());
    const runW = (it) => { const s = JSON.parse(snap); s.player.energy = 100; game.loadState(s); let a = game.advanceWeek({ focus: 'balanced', intensity: it }); while (a.ok && a.status === 'match') { game.autoPlayMatch(); game.finishMatch(); a = game.resumeWeek(); } return a; };
    const aH = runW('hard'), aL = runW('light');
    if (!(aH.summary.energy < aL.summary.energy)) fail('hard week should leave less energy than light', [aH.summary.energy, aL.summary.energy]);
    if (!(aH.summary.load > aL.summary.load)) fail('hard week should leave more load than light', [aH.summary.load, aL.summary.load]);
    if (!aH.summary.loadLineHe || aH.summary.energyBefore === undefined) fail('week summary load line missing', aH.summary);
    chk('summary(v22)', aH.summary);
    // string focus keeps working (back compat) and keeps the stored intensity
    game.loadState(JSON.parse(snap));
    const a2 = game.advanceWeek('shooting');
    if (!a2.ok) fail('advanceWeek(string) after v2.2', a2);
    if (game.serialize().trainInt !== 'hard') fail('stored intensity lost by advanceWeek(string)', game.serialize().trainInt);
  }
}

// v3 -> v4 migration (incl. a save taken in the middle of a live match)
function migrationV4Check() {
  checkCounts.migrate++;
  CUR_G = 'm';
  const strip = (s) => { s.v = 3; delete s.trainInt; const p = s.player; for (const k of ['load', 'sharp', 'benchRun', 'lowMin', 'talk', 'lh', 'ld']) delete p[k]; if (s.wsum) for (const k of ['tf', 'ti', 'e0', 'l0', 'nm', 'ntCalled', 'ntPlayed', 'tk']) delete s.wsum[k]; return s; };
  game.newCareer({ ...careerOpts(5, 'm'), seed: hash32(SEED, 'mig4'), now: 0 });
  game.fastForward({ until: 'weeks', weeks: 5 });
  const v3 = strip(JSON.parse(JSON.stringify(game.serialize())));
  const lr = game.loadState(game.migrateState(v3, 3));
  if (!lr.ok) { fail('migrated v3 state does not load', lr); return; }
  const S = game.serialize();
  const p = S.player;
  if (S.v !== 4 || S.trainInt !== 'normal' || p.load !== 20 || p.sharp !== 60 || p.benchRun !== 0 || p.lowMin !== 0 || !p.talk || p.talk.lastWeekAbs !== -99 || p.talk.promise !== null) fail('v4 migration defaults', [S.v, S.trainInt, p.load, p.sharp, p.benchRun, p.lowMin, p.talk]);
  walkAll('migrated-v4');
  const f1 = game.fastForward({ until: 'weeks', weeks: 3 });
  if (!f1.ok) fail('migrated v4 career does not advance', f1);
  // mid-match v3 save
  for (let k = 0; k < 60 && !game.serialize().live; k++) {
    const r = game.fastForward({ until: 'next_match' });
    if (r.stopped === 'review') game.ackSeasonReview();
    for (const o of game.getOffers()) if (o.status === 'open' && o.canAccept) game.respondOffer(o.id, 'accept');
  }
  if (!game.serialize().live) { warn('v4 migration: no live match reached'); return; }
  const m = game.startMatch();
  if (m.moment) game.chooseMoment(0);
  const v3m = strip(JSON.parse(JSON.stringify(game.serialize())));
  const lr2 = game.loadState(game.migrateState(v3m, 3));
  if (!lr2.ok) { fail('migrated mid-match v3 state does not load', lr2); return; }
  chk('getMatch(v4)', game.getMatch());
  chk('autoPlayMatch(v4)', game.autoPlayMatch());
  chk('finishMatch(v4)', game.finishMatch());
  const rw = chk('resumeWeek(v4)', game.resumeWeek());
  if (!rw.ok) fail('resumeWeek after a v3 mid-match migration', rw);
  else if (rw.status === 'done' && typeof rw.summary.load !== 'number') fail('migrated mid-match week summary without load', rw.summary);
}

// determinism with the v2.2 systems (intensity choices + coach talks): two runs and a save/load round trip agree
function v22Determinism() {
  for (const gender of GENDERS) {
    const run = (rt) => {
      CUR_G = gender;
      game.newCareer({ ...careerOpts(6, gender), seed: hash32(SEED, 'det22', gender), now: 0 });
      for (let w = 0; w < (QUICK ? 120 : 220); w++) {
        const S = game.serialize();
        if (S.retired) break;
        if (S.pending.review !== null) { game.ackSeasonReview(); continue; }
        for (const o of game.getOffers()) if (o.status === 'open' && o.canAccept && (o.type === 'pro' || o.type === 'renewal')) game.respondOffer(o.id, 'accept');
        const c = game.canTalkToCoach();
        if (c.ok) chk('talkToCoach(det)', game.talkToCoach(['ask', 'demand', 'threat'][w % 3]));
        const its = ['light', 'normal', 'hard', 'extreme'];
        let a = game.advanceWeek({ focus: w % 9 === 0 ? 'rest' : 'balanced', intensity: its[(w * 7) % 4] });
        while (a.ok && a.status === 'match') { game.autoPlayMatch(); game.finishMatch(); a = game.resumeWeek(); }
        if (rt && w % 10 === 5) game.loadState(JSON.parse(JSON.stringify(game.serialize())));
      }
      return stateHash();
    };
    const a = run(false), b = run(false), c = run(true);
    if (a !== b || a !== c) fail('v2.2 determinism (' + gender + ')', [a, b, c]);
  }
}

// ---------------- main
const T0 = Date.now();
const results = [];
let totalSeasons = 0, totalMs = 0;
for (const gender of GENDERS) for (let i = 0; i < (V22_ONLY ? 0 : CAREERS); i++) {
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
for (const gender of (V22_ONLY ? [] : GENDERS)) {
  const dOpts = { collect: false, checks: false, gender };
  const hA = plainHash(0, dOpts);
  const hB = plainHash(0, dOpts);
  const hC = plainHash(0, { ...dOpts, roundTrip: true });
  detHashes[gender] = hA;
  if (hA !== hB) { detOk = false; fail('determinism (' + gender + '): two plain runs differ', [hA, hB]); }
  if (hA !== hC) { detOk = false; fail('determinism (' + gender + '): save/load round trip differs', [hA, hC]); }
}
if (!V22_ONLY && GENDERS.length === 2 && detHashes.m === detHashes.f) fail('boy and girl careers produced the same state');
if (!V22_ONLY) {
  migrationCheck();
  migrationV3Check();
  managerDeterminism();
  coachingRoles();
}
// v2.2
const T22 = Date.now();
trainingApiChecks();
migrationV4Check();
v22Determinism();
coachTalkChecks();
trainingPolicies();
v22.sec = +((Date.now() - T22) / 1000).toFixed(1);

// chunked vs unchunked fast-forward
for (const gender of (V22_ONLY ? [] : GENDERS)) {
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

// ---------------- manager aggregates (R2)
if (mgrAgg.careers >= 4 && !QUICK) {
  if (mgrAgg.sackings < 1) fail('no manager was ever sacked', mgrAgg);
  if (mgrAgg.offers < mgrAgg.careers) fail('too few coaching job offers', mgrAgg);
  if (mgrAgg.jobs <= mgrAgg.careers) fail('no manager ever changed jobs', mgrAgg);
}
if (mgrAgg.careers && mgrAgg.seasons < mgrAgg.careers * MGR_SEASONS * 0.8) fail('manager seasons simulated', [mgrAgg.seasons, mgrAgg.careers * MGR_SEASONS]);
if (mgrAgg.careers === 0 && !V22_ONLY) fail('no coaching career was simulated');

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
if (!V22_ONLY) {
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
}

const report = {
  careers: results.length, seasonsSimulated: totalSeasons, seed: SEED,
  retireAges, trophiesPerCareer: results.map((r) => r.S.hist.trophies.length), awardsPerCareer: results.map((r) => r.S.hist.awards.length),
  careersWithTrophy: +withTrophy.toFixed(2), ballonDorWinners: +bdoWin.toFixed(2),
  perPos90: posRates, avgRating: +avgRating.toFixed(2), leagueGoalsPerMatch: +lgGpm.toFixed(2), homeWinShare: +homeWin.toFixed(3), drawShare: +draws.toFixed(3),
  gkCleanSheets: calib.gkMatches ? +(calib.gkCS / calib.gkMatches).toFixed(3) : null,
  maxSaveKB: Math.round(maxSave / 1024), saveKBBySeason: results[0] ? results[0].sizes.map((x) => Math.round(x / 1024)) : [],
  avgSeasonMs: Math.round(avgSeasonMs), totalSec: +((Date.now() - T0) / 1000).toFixed(1), midSeasonTransfer: midTransfer,
  genders: GENDERS, determinism: detOk ? 'ok' : 'FAIL', checksRun: checkCounts,
  manager: { ...mgrAgg, firstTier: mgrAgg.firstTier.map((x) => x.join(':')) },
  v22,
};
console.log('REPORT ' + JSON.stringify(report, null, 1));
if (warnings.length) { console.log('CALIBRATION WARNINGS:'); for (const w of warnings) console.log('  - ' + w); }
if (violations.length) {
  console.log('VIOLATIONS (' + violations.length + '):');
  for (const v of violations.slice(0, 80)) console.log('  ! ' + v);
  process.exitCode = 1;
} else console.log('ALL INVARIANTS OK');
