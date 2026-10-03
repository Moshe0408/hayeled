// Narrative engine: triggers, eligibility, rendering, inbox, effects (SPEC §4.1, §5.16).
import { EVENTS } from '../data/events.js';
import { PERSONAS } from '../data/strings.js';
import { PARTNER_NAMES } from '../data/names.js';
import { LEAGUE_BY_ID } from '../data/leagues.js';
import { rngFor } from '../core/rng.js';
import { clamp, fill, fmtMoney, fmtSeason, round1 } from './util.js';
import { nextId, curAw } from './state.js';
import { clubData, clubLeague, clubCountry, nameFor, country, leagueMembers, cs } from './world.js';
import { ovrOf, ageOf, formAvg, valueOf, ALL_ATTRS } from './player.js';
import { weekLabelHe, isWindowOpen } from './calendar.js';

// Triggers raised outside a week (offer responses, shop, ...) are carried into the next week.
export function raise(S, trig) {
  if (!S.inWeek) {
    if (!S.ev.carry) S.ev.carry = [];
    if (S.ev.carry.indexOf(trig) < 0) S.ev.carry.push(trig);
    return;
  }
  if (!S.ev.trig) S.ev.trig = [];
  if (S.ev.trig.indexOf(trig) < 0) S.ev.trig.push(trig);
}

let _byTrig = null, _byId = null;
function index() {
  if (_byTrig) return;
  _byTrig = { __pool: [] };
  _byId = {};
  for (const e of (EVENTS || [])) {
    _byId[e.id] = e;
    const k = e.trigger || '__pool';
    (_byTrig[k] = _byTrig[k] || []).push(e);
  }
}
export function eventDef(id) { index(); return _byId[id] || null; }

export function personaHe(id) { const p = PERSONAS && PERSONAS[id]; return p ? p.he : (id || ''); }
export function personaAvatar(id) { const p = PERSONAS && PERSONAS[id]; return p ? p.avatar : '💬'; }
export function awSeasonWeek(aw) { const s = Math.floor((aw - 1) / 52); return { season: s, week: aw - s * 52 }; }
export function awLabel(aw) { const x = awSeasonWeek(aw); return weekLabelHe(x.season, x.week); }

function seasonTotals(p) {
  let g = 0, a = 0;
  for (const k of ['lg', 'cup', 'eu', 'nt', 'yth', 'ynt']) { g += p.s[k].g; a += p.s[k].apps; }
  return { goals: g, apps: a };
}

export function coachName(S, club, store) {
  if (!club) return null;
  if (S.names.coach[club]) return S.names.coach[club];
  const n = nameFor(club, 'coach');
  if (store) S.names.coach[club] = n;
  return n;
}

// Placeholder values (always non-empty)
export function placeholderVars(S, extra = {}) {
  const p = S.player;
  const club = p.club;
  const cd = club ? clubData(club) : null;
  const lid = club ? clubLeague(S, club) : null;
  const lg = lid ? LEAGUE_BY_ID[lid] : null;
  let leagueHe = lg ? lg.nameHe : 'הליגה';
  if (p.stage === 'youth' && S.comp && S.comp.yl && lg) leagueHe = (lg.youthNameHe || 'ליגת הנוער') + (S.comp.yl.lvl === 'u17' ? ' עד גיל 17' : ' עד גיל 19');
  let rival = 'היריבה העירונית';
  if (cd && cd.rival && clubData(cd.rival)) rival = clubData(cd.rival).nameHe;
  else if (lid) {
    const others = leagueMembers(S, lid).filter((x) => x !== club).sort((a, b) => cs(S, b) - cs(S, a) || (a < b ? -1 : 1));
    if (others.length) rival = clubData(others[0]).nameHe;
  }
  const tot = seasonTotals(p);
  const lm = S.lastMatch;
  const nat = country(p.nation);
  const v = {
    first: p.first, last: p.last, nick: p.nick || p.first, name: p.first + ' ' + p.last,
    club: cd ? cd.nameHe : 'הקבוצה', clubShort: cd ? (cd.shortHe || cd.nameHe) : 'הקבוצה', city: cd ? (cd.city || 'העיר') : 'העיר',
    league: leagueHe, coach: (club && coachName(S, club, false)) || 'המאמן', agent: S.names.agent || 'הסוכן', journalist: S.names.journalist || 'העיתונאי',
    partner: S.names.partner || 'בת הזוג', friend1: S.names.friends[0] || 'שמוליק', friend2: S.names.friends[1] || 'מוטי', friend3: S.names.friends[2] || 'דודו',
    opp: extra.opp || 'היריבה', rival, nation: nat ? nat.nameHe : 'הנבחרת', age: String(ageOf(S)),
    money: fmtMoney(p.money), wage: p.contract ? fmtMoney(p.contract.wage) + ' לשבוע' : 'אין חוזה', value: fmtMoney(valueOf(S)),
    season: fmtSeason(S.season),
    teammate: club ? nameFor(club, S.season, 'mate', extra.k || 0) : 'חבר לקבוצה',
    captain: club ? nameFor(club, S.season, 'cap') : 'הקפטן',
    goals: String(tot.goals || 0), apps: String(tot.apps || 0), rating: lm && typeof lm.rating === 'number' ? lm.rating.toFixed(1) : '-',
  };
  for (const k of Object.keys(v)) if (v[k] === null || v[k] === undefined || v[k] === '') v[k] = '-';
  return v;
}
function scrub(t) { return t.replace(/\{[a-z0-9]+\}/gi, ''); }
function render(t, v) { return scrub(fill(t, v)); }

function condOk(S, rng, c, ctx) {
  if (!c) return true;
  const p = S.player;
  const age = ageOf(S);
  const ovr = ovrOf(p);
  if (c.minAge !== undefined && age < c.minAge) return false;
  if (c.maxAge !== undefined && age > c.maxAge) return false;
  if (c.minOvr !== undefined && ovr < c.minOvr) return false;
  if (c.maxOvr !== undefined && ovr > c.maxOvr) return false;
  if (c.minRepW !== undefined && p.rep.w < c.minRepW) return false;
  if (c.stage && c.stage.indexOf(p.stage) < 0) return false;
  if (c.role && (!p.contract || c.role.indexOf(p.contract.role) < 0)) return false;
  if (c.natLvl && c.natLvl.indexOf(p.natLvl) < 0) return false;
  if (c.nation && c.nation.indexOf(p.nation) < 0) return false;
  if (c.leagueTier !== undefined) {
    const l = p.club ? LEAGUE_BY_ID[clubLeague(S, p.club)] : null;
    if (!l || l.tier !== c.leagueTier) return false;
  }
  if (c.phase && c.phase !== (S.week >= 45 ? 'summer' : 'season')) return false;
  if (c.weeks && (S.week < c.weeks[0] || S.week > c.weeks[1])) return false;
  if (c.inWindow !== undefined && !!c.inWindow !== isWindowOpen(S.week)) return false;
  if (c.hasClub !== undefined && !!c.hasClub !== !!p.club) return false;
  if (c.abroad !== undefined) {
    const ab = !!p.club && clubCountry(p.club) !== p.nation;
    if (!!c.abroad !== ab) return false;
  }
  if (c.injured !== undefined && !!c.injured !== !!p.injury) return false;
  if (c.minMoney !== undefined && p.money < c.minMoney) return false;
  if (c.flags && c.flags.some((f) => !S.ev.flags[f])) return false;
  if (c.notFlags && c.notFlags.some((f) => !!S.ev.flags[f])) return false;
  const lm = S.lastMatch;
  if (c.lastResult && (!lm || lm.res !== c.lastResult)) return false;
  if (c.lastRatingMin !== undefined && (!lm || lm.rating < c.lastRatingMin)) return false;
  if (c.lastRatingMax !== undefined && (!lm || lm.rating > c.lastRatingMax)) return false;
  const fa = formAvg(p);
  if (c.formMin !== undefined && (fa === null || fa < c.formMin)) return false;
  if (c.formMax !== undefined && (fa === null || fa > c.formMax)) return false;
  if (c.benchMin !== undefined && p.bench < c.benchMin) return false;
  if (c.derbyWeek !== undefined && !!c.derbyWeek !== !!(ctx && ctx.derby)) return false;
  if (c.chance !== undefined && !(rng.next() < c.chance)) return false;
  return true;
}

function eligible(S, rng, e, aw, ctx) {
  const cd = S.ev.cd[e.id];
  const cool = e.cooldown === undefined ? 26 : e.cooldown;
  if (cd !== undefined && aw - cd < cool) return false;
  if (e.once && S.ev.once.indexOf(e.id) >= 0) return false;
  return condOk(S, rng, e.cond, ctx);
}

export function capInbox(S) {
  const max = 80;
  if (S.inbox.length <= max) return;
  let over = S.inbox.length - max;
  const keep = [];
  for (const it of S.inbox) {
    if (over > 0 && (it.choices === null || it.ans !== null)) { over--; continue; }
    keep.push(it);
  }
  while (keep.length > max) keep.shift();
  S.inbox = keep;
}

export function pushInbox(S, item) {
  S.inbox.push(item);
  if (S.wsum) S.wsum.msgs = (S.wsum.msgs || 0) + 1;
  capInbox(S);
  return item;
}

export function sysMsg(S, from, text, imp = false) {
  const it = { id: nextId(S, 'inbox'), aw: curAw(S), from, ev: null, lines: [{ who: from, t: scrub(text) }], choices: null, ans: null, exp: null, imp: !!imp, read: false };
  return pushInbox(S, it);
}

export function fireEvent(S, rng, e, ctx) {
  const aw = curAw(S);
  if (e.who === 'coach' && S.player.club) coachName(S, S.player.club, true);
  const v = placeholderVars(S, { opp: ctx && ctx.opp, k: rng.int(0, 4) });
  const lines = (e.messages || []).map((m) => (typeof m === 'string' ? { who: e.who, t: render(m, v) } : { who: m.who || e.who, t: render(m.t || '', v) }));
  const ch = e.choices || [];
  const choices = ch.length ? ch.map((c) => ({ label: render(c.label || '', v), disabled: !!(c.effects && c.effects.money < 0 && S.player.money < -c.effects.money) })) : null;
  const it = { id: nextId(S, 'inbox'), aw, from: e.who, ev: e.id, lines, choices, ans: null, exp: choices ? aw + 2 : null, imp: !!(e.trigger && ch.length > 0), read: false };
  S.ev.cd[e.id] = aw;
  if (e.once && S.ev.once.indexOf(e.id) < 0) S.ev.once.push(e.id);
  return pushInbox(S, it);
}

// Week-end narrative step. ctx: { opp, derby }
export function runWeekEvents(S, rng, ctx, onlyTriggers) {
  index();
  const aw = curAw(S);
  let fired = 0;
  const q = S.ev.q || [];
  S.ev.q = [];
  for (const id of q) {
    const e = _byId[id];
    if (e) { fireEvent(S, rng, e, ctx); fired++; }
  }
  let trigFired = 0;
  for (const t of (S.ev.trig || [])) {
    if (trigFired >= 2) break;
    const list = (_byTrig[t] || []).filter((e) => eligible(S, rng, e, aw, ctx));
    if (!list.length) continue;
    const e = rng.weighted(list, (x) => (x.weight === undefined ? 1 : x.weight));
    fireEvent(S, rng, e, ctx);
    trigFired++; fired++;
  }
  if (onlyTriggers) return fired;
  if (fired < 2) {
    const r = rng.next();
    let k = r < 0.5 ? 0 : r < 0.92 ? 1 : 2;
    k = Math.min(k, 2 - fired);
    for (let i = 0; i < k; i++) {
      const list = _byTrig.__pool.filter((e) => eligible(S, rng, e, aw, ctx));
      if (!list.length) break;
      const e = rng.weighted(list, (x) => (x.weight === undefined ? 1 : x.weight));
      fireEvent(S, rng, e, ctx);
      fired++;
    }
  }
  return fired;
}

const EFF_HE = { morale: 'מורל', energy: 'אנרגיה', trust: 'אמון המאמן', fans: 'אהדת הקהל', mates: 'יחסים בחדר ההלבשה' };
function sgn(n) { return (n > 0 ? '+' : '') + n; }

export function applyEffects(S, eff) {
  const p = S.player;
  const out = [];
  if (!eff) return out;
  for (const k of ['morale', 'energy', 'trust', 'fans', 'mates']) {
    if (typeof eff[k] === 'number' && eff[k] !== 0) {
      p[k] = Math.round(clamp(p[k] + eff[k], 0, 100));
      out.push(sgn(eff[k]) + ' ' + EFF_HE[k]);
    }
  }
  const rk = { repL: 'l', repC: 'c', repW: 'w' };
  let repSum = 0;
  for (const k of Object.keys(rk)) {
    if (typeof eff[k] === 'number' && eff[k] !== 0) { p.rep[rk[k]] = round1(clamp(p.rep[rk[k]] + eff[k], 0, 100)); repSum += eff[k]; }
  }
  if (repSum) out.push(repSum > 0 ? 'המוניטין עלה' : 'המוניטין ירד');
  if (typeof eff.money === 'number' && eff.money !== 0) {
    p.money = Math.max(0, Math.round(p.money + eff.money));
    out.push((eff.money > 0 ? '+' : '-') + fmtMoney(Math.abs(eff.money)));
  }
  if (typeof eff.form === 'number') {
    p.form.push(round1(clamp(eff.form, 3, 10)));
    while (p.form.length > 5) p.form.shift();
    out.push('הכושר השתנה');
  }
  if (typeof eff.injuryWeeks === 'number' && eff.injuryWeeks > 0 && !p.injury) {
    p.injury = { weeks: Math.round(eff.injuryWeeks), kind: 'knock', sev: 'minor' };
    out.push('פציעה קלה (' + Math.round(eff.injuryWeeks) + ' שב׳)');
  }
  if (eff.attr) {
    for (const k of Object.keys(eff.attr).sort()) {
      if (ALL_ATTRS.indexOf(k) < 0) continue;
      p.a[k] = round1(clamp(p.a[k] + eff.attr[k], 1, 99));
    }
    out.push('התכונות השתנו');
  }
  if (typeof eff.pot === 'number' && eff.pot !== 0) p.pot = clamp(Math.round(p.pot + eff.pot), Math.min(p.pot, ovrOf(p)), 96);
  if (eff.setFlags) for (const f of eff.setFlags) S.ev.flags[f] = true;
  if (eff.clearFlags) for (const f of eff.clearFlags) delete S.ev.flags[f];
  if (S.ev.flags.has_partner && !S.names.partner) {
    const r = rngFor(S.id, 'partner');
    S.names.partner = r.pick(PARTNER_NAMES || []) || 'נועה';
  }
  if (typeof eff.treq === 'boolean' && p.club && p.stage === 'pro') p.treq = eff.treq;
  if (typeof eff.agentPush === 'number' && eff.agentPush > 0) p.agentPush = Math.max(p.agentPush, Math.round(eff.agentPush));
  if (eff.next) { if (S.ev.q.indexOf(eff.next) < 0) S.ev.q.push(eff.next); }
  return out;
}

export function answerItem(S, rng, item, idx, auto) {
  const e = item.ev ? eventDef(item.ev) : null;
  if (!e || !item.choices || item.ans !== null) return { ok: false, effectsHe: [] };
  const c = e.choices[idx];
  if (!c) return { ok: false, effectsHe: [] };
  if (c.effects && c.effects.money < 0 && S.player.money < -c.effects.money) {
    if (!auto) return { ok: false, effectsHe: [] };
    // auto-answer: pick the first affordable choice instead
    const alt = e.choices.findIndex((x) => !(x.effects && x.effects.money < 0 && S.player.money < -x.effects.money));
    if (alt < 0) { item.ans = idx; item.read = true; return { ok: true, effectsHe: [] }; }
    return answerItem(S, rng, item, alt, auto);
  }
  const v = placeholderVars(S, { k: 0 });
  item.ans = idx;
  if (c.reply) item.lines.push({ who: 'me', t: render(c.reply, v) });
  const eff = applyEffects(S, c.effects || {});
  if (c.followUp) item.lines.push({ who: e.who, t: render(c.followUp, v) });
  item.read = true;
  return { ok: true, effectsHe: eff };
}

export function autoAnswerExpired(S, rng, force) {
  const aw = curAw(S);
  for (const it of S.inbox) {
    if (it.choices && it.ans === null && (force || (it.exp !== null && aw > it.exp))) {
      const e = it.ev ? eventDef(it.ev) : null;
      const d = e && typeof e.defaultChoice === 'number' ? e.defaultChoice : 0;
      const r = answerItem(S, rng, it, Math.min(d, it.choices.length - 1), true);
      if (!r.ok) it.ans = d;
    }
  }
}

// ---------- VMs ----------
function whoHe(S, who) {
  if (who === 'me') return 'אני';
  if (who === 'friend1' || who === 'friend2' || who === 'friend3') return S.names.friends[Number(who.slice(-1)) - 1] || 'חבר';
  if (who === 'agent' && S.names.agent) return S.names.agent;
  if (who === 'journalist' && S.names.journalist) return S.names.journalist;
  if (who === 'partner' && S.names.partner) return S.names.partner;
  return personaHe(who);
}
export function inboxRows(S) {
  const out = [];
  for (let i = S.inbox.length - 1; i >= 0; i--) {
    const it = S.inbox[i];
    const last = it.lines[it.lines.length - 1];
    out.push({ id: it.id, from: it.from, fromHe: whoHe(S, it.from), avatar: personaAvatar(it.from), previewHe: last ? last.t : '',
      dateHe: awLabel(it.aw), unread: !it.read, needsAnswer: !!(it.choices && it.ans === null) });
  }
  return out;
}
export function threadVM(S, it) {
  const isGroup = !!(PERSONAS && PERSONAS[it.from] && PERSONAS[it.from].group);
  const e = it.ev ? eventDef(it.ev) : null;
  return {
    id: it.id, from: it.from, fromHe: whoHe(S, it.from), avatar: personaAvatar(it.from), isGroup,
    messages: it.lines.map((l) => ({ who: l.who, whoHe: whoHe(S, l.who), textHe: l.t, mine: l.who === 'me' })),
    choices: it.choices && it.ans === null ? it.choices.map((c, i) => {
      const def = e && e.choices[i];
      const dis = !!(def && def.effects && def.effects.money < 0 && S.player.money < -def.effects.money);
      return { index: i, he: c.label, disabled: dis };
    }) : null,
    answered: it.ans, dateHe: awLabel(it.aw),
  };
}
