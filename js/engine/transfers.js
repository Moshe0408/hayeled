// Offers, negotiation, contracts, loans, renewals, free-agent fallback (SPEC §5.13, §5.10).
import { LEAGUES, LEAGUE_BY_ID } from '../data/leagues.js';
import { ROLES } from '../data/strings.js';
import { clamp, fmtSeason, fmtMoney, round1, econOf, gtext, femLabel } from './util.js';
import { nextId, curAw, emit } from './state.js';
import { cs, clubData, clubLeague, clubCountry, clubPrestige, teamVM, country, leagueMembers, clubName, lgNameHe } from './world.js';
import { ovrOf, ageOf, formAvgOr, valueOf, fairWage, wageCap } from './player.js';
import { isWindowOpen } from './calendar.js';
import { raise, sysMsg } from './narrative.js';
import { openSpell, closeSpell, addTimeline } from './history.js';

export const ROLE_ORDER = ['prospect', 'squad', 'rotation', 'key', 'star'];
const TYPE_HE = { transfer: 'העברה', loan: 'השאלה', free: 'חוזה {{לשחקן חופשי|לשחקנית חופשית}}', precontract: 'חוזה מוקדם', renewal: 'הארכת חוזה', pro: 'חוזה מקצועני ראשון' };
const STATUS_HE = { open: 'ממתינה לתשובה', accepted: 'סוכם', rejected: 'נדחתה', expired: 'פג תוקף', club_refused: 'המועדון סירב', withdrawn: 'בוטלה' };

export function effSeason(S) { return S.week >= 45 ? S.season + 1 : S.season; }
export function roleFor(gap) { return gap >= 5 ? 'star' : gap >= 0 ? 'key' : gap >= -5 ? 'rotation' : gap >= -10 ? 'squad' : 'prospect'; }
function yearsFor(rng, age) { return age <= 23 ? rng.int(4, 5) : age <= 29 ? rng.int(3, 4) : rng.int(1, 2); }
export function teamStrOf(S) { const p = S.player; return p.club ? cs(S, p.club) : Math.max(35, ovrOf(p) - 5); }

function minutesShare(p) {
  const m = p.mins || [];
  if (m.length === 0) return 0;
  const tot = m.reduce((s, x) => s + x, 0);
  return tot / (Math.max(4, m.length) * 90);
}

function openOfferClubs(S) {
  const s = new Set();
  for (const o of S.offers) if (o.status === 'open') s.add(o.club);
  return s;
}

function allLeagueClubs(S) {
  const out = [];
  for (const lg of LEAGUES) for (const id of leagueMembers(S, lg.id)) out.push(id);
  return out.sort();
}

function candWeight(S, id, teamStr) {
  const p = S.player;
  const c = S.world.clubs[id];
  const pr = clubPrestige(S, id);
  const same = clubCountry(id) === p.nation && ageOf(S) < 20 ? 1.5 : 1;
  return (c.r / 50) * (pr / 5) * same * (c.s > teamStr ? 1.3 : 0.8);
}

function makeOffer(S, rng, club, type, extra = {}) {
  const p = S.player;
  const ovr = ovrOf(p);
  const age = ageOf(S);
  const value = valueOf(S);
  const c = S.world.clubs[club];
  const pr = clubPrestige(S, club);
  const role = roleFor(ovr - c.s);
  const E = econOf(S);
  let wage = Math.round(Math.min(fairWage(ovr, pr, E) * rng.float(0.9, 1.2), wageCap(c.b, E)));
  if (type === 'loan') wage = p.contract ? p.contract.wage : wage;
  let fee = 0;
  if (type === 'transfer') fee = Math.round(value * rng.float(0.85, 1.25) / 1000) * 1000;
  const years = type === 'loan' ? 1 : yearsFor(rng, age);
  const rc = ((role === 'star' || role === 'key') && pr < 8 && type !== 'loan') ? Math.round(value * 2.5 / 1000) * 1000 : 0;
  const o = { id: nextId(S, 'offer'), aw: curAw(S), club, type, fee, wage: Math.max(Math.round(100 * E), wage), years, role, rc, exp: curAw(S) + 2, status: 'open', neg: 0 };
  Object.assign(o, extra);
  S.offers.push(o);
  if (S.wsum) S.wsum.offers = (S.wsum.offers || 0) + 1;
  raise(S, 'offer_received');
  const ag = S.names.agent || 'הסוכן';
  const txt = type === 'renewal' ? ('המועדון רוצה להאריך איתך את החוזה. יש הצעה על השולחן.')
    : type === 'pro' ? ('מזל טוב! ' + clubName(club) + ' מציעה לך חוזה מקצועני ראשון!')
      : (ag + ': יש לי משהו גדול בשבילך... ' + clubName(club) + ' רוצה אותך (' + (TYPE_HE[type] || '') + ').');
  sysMsg(S, type === 'renewal' || type === 'pro' ? 'club' : 'agent', txt, false);
  return o;
}

// Weekly offer generation (week start)
export function generateOffers(S, rng) {
  const p = S.player;
  if (p.stage === 'youth' || p.stage === 'retired') return 0;
  if (p.next) return 0;
  const free = p.stage === 'free' || !p.club;
  if (!free && !isWindowOpen(S.week)) return 0;
  const ovr = ovrOf(p);
  const age = ageOf(S);
  const teamStr = teamStrOf(S);
  const lam = clamp(0.15 + 0.15 * Math.max(0, ovr - teamStr) / 5 + (p.agentPush > 0 ? 0.4 : 0) + (p.treq ? 0.4 : 0) + (formAvgOr(p) - 6.8) * 0.2, 0.05, 1.5);
  let n = rng.poisson(lam);
  const taken = openOfferClubs(S);
  const parentClub = p.parent ? p.parent.club : null;
  let made = 0;
  const all = allLeagueClubs(S);
  const cands = all.filter((id) => id !== p.club && id !== parentClub && !taken.has(id)).filter((id) => {
    const c = S.world.clubs[id];
    return c.s >= ovr - 10 && c.s <= ovr + 6 && wageCap(c.b, econOf(S)) >= 0.7 * fairWage(ovr, clubPrestige(S, id), econOf(S));
  });
  for (let i = 0; i < n && cands.length; i++) {
    const club = rng.weighted(cands, (id) => candWeight(S, id, teamStr));
    cands.splice(cands.indexOf(club), 1);
    let type;
    if (free) type = 'free';
    else if (p.contract && !p.contract.loan && p.contract.until === S.season && S.week >= 22 && S.week <= 44) type = 'precontract';
    else if (age <= 22 && (minutesShare(p) < 0.4 || ['squad', 'prospect'].indexOf(p.contract && p.contract.role) >= 0) && S.world.clubs[club].s < teamStr && !(p.contract && p.contract.loan) && rng.chance(0.5)) type = 'loan';
    else type = 'transfer';
    if (type === 'transfer') {
      const value = valueOf(S);
      if (value * 0.85 > S.world.clubs[club].b * 1e6 * 0.5 * econOf(S)) continue;
    }
    const o = makeOffer(S, rng, club, type);
    const capFee = S.world.clubs[club].b * 1e6 * 0.5 * econOf(S);
    if (type === 'transfer' && o.fee > capFee) o.fee = Math.round(capFee / 1000) * 1000;
    made++;
  }
  if (free && made === 0 && (p.freeWeeks === 0 || p.freeWeeks % 3 === 0)) {
    let pool = all.filter((id) => S.world.clubs[id].s <= ovr + 4 && !taken.has(id));
    let club = null;
    if (pool.length) {
      let bw = -1;
      for (const id of pool) { const w = candWeight(S, id, teamStr); if (w > bw) { bw = w; club = id; } }
    } else {
      const lgs = LEAGUES.filter((l) => l.countryId === p.nation).sort((a, b) => b.tier - a.tier);
      const lowest = lgs.length ? leagueMembers(S, lgs[0].id) : all;
      club = lowest.slice().sort((a, b) => (cs(S, a) - cs(S, b)) || (a < b ? -1 : 1))[0] || all[0];
    }
    if (club) { makeOffer(S, rng, club, 'free'); made++; }
  }
  return made;
}

export function renewalCheck(S, rng) {
  const p = S.player;
  if (p.stage !== 'pro' || !p.contract || p.contract.loan || p.next) return;
  if (p.contract.until !== S.season) return;
  if ([10, 22, 35].indexOf(S.week) < 0) return;
  if (S.offers.some((o) => o.status === 'open' && o.type === 'renewal')) return;
  const ovr = ovrOf(p);
  if (p.trust < 40 || ovr < cs(S, p.club) - 8) return;
  const pr = clubPrestige(S, p.club);
  const wage = Math.round(Math.max(1.1 * p.contract.wage, fairWage(ovr, pr, econOf(S))));
  makeOffer(S, rng, p.club, 'renewal', { wage, fee: 0, role: roleFor(ovr - cs(S, p.club)), exp: curAw(S) + 3 });
  raise(S, 'renewal_offer');
}

export function makeProOffer(S, rng, expWeeks) {
  const p = S.player;
  if (S.offers.some((o) => o.status === 'open' && o.type === 'pro')) return null;
  const club = p.club;
  const ovr = ovrOf(p);
  const wage = Math.round(0.6 * fairWage(ovr, clubPrestige(S, club), econOf(S)));
  return makeOffer(S, rng, club, 'pro', { wage, fee: 0, years: 3, role: 'prospect', rc: 0, exp: curAw(S) + expWeeks });
}

export function proEligible(S) {
  const p = S.player;
  const s = cs(S, p.club);
  const ovr = ovrOf(p);
  return ovr >= s - 18 || (p.pot >= s - 2 && ovr >= s - 22);
}

// ----- moves -----
function withdrawOthers(S, keepId) {
  for (const o of S.offers) if (o.status === 'open' && o.id !== keepId) { o.status = 'withdrawn'; o.cl = curAw(S); }
}

export function setAbroadFlag(S) {
  const p = S.player;
  if (p.club && clubCountry(p.club) !== p.nation) S.ev.flags.abroad = true; else delete S.ev.flags.abroad;
}

function moveTo(S, o) {
  const p = S.player;
  const from = p.club;
  const fromCountry = from ? clubCountry(from) : p.nation;
  const es = effSeason(S);
  const bigger = from ? cs(S, o.club) > cs(S, from) + 2 : true;
  closeSpell(S, S.season);
  if (o.type === 'loan') {
    p.parent = p.contract && !p.contract.loan ? p.contract : p.parent;
    p.contract = { club: o.club, wage: o.wage, until: es, role: o.role, rc: 0, since: S.season, loan: true };
  } else {
    p.parent = null;
    p.contract = { club: o.club, wage: o.wage, until: es + o.years - 1, role: o.role, rc: o.rc, since: S.season, loan: false };
  }
  p.club = o.club;
  p.stage = 'pro';
  p.youth = null;
  openSpell(S, o.club, o.type === 'loan', o.fee, es);
  p.trust = (o.role === 'star' || o.role === 'key') ? 60 : 45;
  p.treq = false; p.freeWeeks = 0; p.bench = 0;
  if (bigger) p.morale = Math.min(100, p.morale + 10);
  p.money += 4 * o.wage;
  if (S.comp) {
    if (S.week >= 1 && S.week <= 44) S.comp.moved = true;
    if (S.comp.yl && S.comp.yl.clubs.indexOf(o.club) < 0) S.comp.yl = null;
  }
  emit('transfer', { type: o.type, from: from || null, to: o.club, fee: o.fee || 0 });
  raise(S, o.type === 'loan' ? 'loan_start' : 'transfer_done');
  const toCountry = clubCountry(o.club);
  if (toCountry !== p.nation && toCountry !== fromCountry) raise(S, 'moved_abroad');
  setAbroadFlag(S);
  if (S.names.coach && !S.names.coach[o.club]) { /* generated lazily */ }
  const txt = o.type === 'loan' ? ('עברת בהשאלה ל' + clubName(o.club) + '. בהצלחה!') : ('{{ברוך הבא|ברוכה הבאה}} ל' + clubName(o.club) + '! החוזה נחתם.');
  sysMsg(S, 'club', txt);
  addTimeline(S, o.type === 'loan' ? 'info' : 'transfer', (o.type === 'loan' ? 'השאלה ל' : 'מעבר ל') + clubName(o.club) + (o.fee ? ' תמורת ' + fmtMoney(o.fee) : ''));
  withdrawOthers(S, o.id);
}

// Applied at week 45 start
export function applyPrecontract(S) {
  const p = S.player;
  if (!p.next) return false;
  const n = p.next;
  p.next = null;
  const o = { type: 'precontract', club: n.club, fee: 0, wage: n.wage, role: n.role, rc: n.rc, years: n.until - S.season };
  closeSpell(S, S.season);
  const from = p.club;
  p.contract = n; p.parent = null; p.club = n.club; p.stage = 'pro';
  openSpell(S, n.club, false, 0, S.season + 1);
  p.trust = (n.role === 'star' || n.role === 'key') ? 60 : 45;
  p.treq = false; p.freeWeeks = 0; p.bench = 0;
  emit('transfer', { type: 'precontract', from: from || null, to: n.club, fee: 0 });
  raise(S, 'transfer_done');
  if (clubCountry(n.club) !== p.nation && (!from || clubCountry(from) !== clubCountry(n.club))) raise(S, 'moved_abroad');
  setAbroadFlag(S);
  sysMsg(S, 'club', '{{ברוך הבא|ברוכה הבאה}} ל' + clubName(n.club) + '! החוזה המוקדם נכנס לתוקף.');
  addTimeline(S, 'transfer', 'מעבר חופשי ל' + clubName(n.club));
  void o;
  return true;
}

export function endLoan(S) {
  const p = S.player;
  if (!p.contract || !p.contract.loan) return false;
  const par = p.parent;
  closeSpell(S, S.season);
  p.contract = par; p.parent = null; p.club = par ? par.club : null;
  if (p.club) {
    const expiring = par.until === S.season && !p.next;
    if (!expiring) openSpell(S, p.club, false, 0, S.season + 1);
    sysMsg(S, 'club', 'ההשאלה הסתיימה. {{חוזר|חוזרת}} ל' + clubName(p.club) + '.');
  }
  setAbroadFlag(S);
  return true;
}

export function contractExpiry(S) {
  const p = S.player;
  if (p.stage !== 'pro' || !p.contract) return false;
  if (p.contract.until !== S.season || p.next) return false;
  const club = p.club;
  const sp = S.hist.clubs[S.hist.clubs.length - 1];
  if (sp && sp.to === null) closeSpell(S, S.season);
  p.stage = 'free'; p.club = null; p.contract = null; p.parent = null; p.freeWeeks = 0; p.treq = false;
  setAbroadFlag(S);
  sysMsg(S, 'agent', 'החוזה שלך עם ' + clubName(club) + ' הסתיים. {{אתה שחקן חופשי|את שחקנית חופשית}}, ' + (S.names.agent || 'הסוכן') + ' כבר מחפש לך קבוצה.');
  addTimeline(S, 'info', 'סיום חוזה ב' + clubName(club));
  return true;
}

export function releaseYouth(S) {
  const p = S.player;
  const club = p.club;
  closeSpell(S, S.season);
  p.stage = 'free'; p.club = null; p.contract = null; p.youth = null; p.freeWeeks = 0;
  if (S.comp) S.comp.yl = null;
  setAbroadFlag(S);
  raise(S, 'released');
  sysMsg(S, 'club', clubName(club) + ' החליטה לא להחתים אותך על חוזה מקצועני. זה לא הסוף. {{אתה שחקן חופשי|את שחקנית חופשית}}.');
  addTimeline(S, 'info', 'שוחררת מהאקדמיה של ' + clubName(club));
}

export function signPro(S, o) {
  const p = S.player;
  const es = effSeason(S);
  p.stage = 'pro';
  p.youth = null;
  p.contract = { club: p.club, wage: o.wage, until: es + o.years - 1, role: o.role, rc: o.rc, since: S.season, loan: false };
  raise(S, 'pro_contract');
  emit('pro_contract', { club: p.club });
  addTimeline(S, 'contract', 'חוזה מקצועני ראשון ב' + clubName(p.club));
  sysMsg(S, 'club', 'חתמת על חוזה מקצועני ראשון! מעכשיו {{אתה שחקן|את שחקנית}} בקבוצה הבוגרת.');
}

// ----- respond -----
function clubAccepts(S, rng, o) {
  const p = S.player;
  if (o.type === 'loan') {
    const role = p.contract ? p.contract.role : 'squad';
    return rng.chance(clamp(0.8 + (role === 'squad' || role === 'prospect' ? 0.15 : 0) - (role === 'star' || role === 'key' ? 0.6 : 0), 0, 1));
  }
  const cur = p.contract && p.contract.loan ? p.parent : p.contract;
  if (!cur) return true;
  if (cur.rc > 0 && o.fee >= cur.rc) return true;
  const value = valueOf(S);
  const pr = clamp((o.fee / value - 0.8) * 2.5 + (p.treq ? 0.3 : 0) - (cur.role === 'star' ? 0.2 : 0), 0, 1);
  return rng.chance(pr);
}

export function canAcceptNow(S, o) {
  if (o.status !== 'open') return false;
  if (S.inWeek || S.live) return false;
  if (S.retired) return false;
  if (o.type === 'loan' && S.player.next) return false;
  return true;
}

function roleSteps(from, to) { return Math.max(0, ROLE_ORDER.indexOf(to) - ROLE_ORDER.indexOf(from)); }

export function respond(S, rng, o, action, counter) {
  const p = S.player;
  if (o.status !== 'open') return { ok: false, error: 'closed', status: null, messageHe: 'ההצעה כבר לא בתוקף' };
  if (action === 'reject') {
    o.status = 'rejected'; o.cl = curAw(S);
    return { ok: true, status: 'rejected', messageHe: 'דחית את ההצעה' };
  }
  if (action === 'negotiate') {
    if (o.type === 'loan' || o.type === 'pro' || o.neg >= 2) return { ok: false, error: 'not_negotiable', status: null, messageHe: 'אי אפשר לנהל משא ומתן על ההצעה הזו' };
    const c = counter || {};
    const wm = [1.1, 1.2, 1.35].indexOf(c.wageMul) >= 0 ? c.wageMul : 1.1;
    const yrs = clamp(Math.round(c.years || o.years), 1, 5);
    const role = ROLE_ORDER.indexOf(c.role) >= 0 ? c.role : o.role;
    const rcm = ['none', 'low', 'default'].indexOf(c.rc) >= 0 ? c.rc : 'default';
    const P = clamp(1 - 2.2 * Math.max(0, wm - 1) - 0.25 * roleSteps(o.role, role) - 0.05 * Math.abs(yrs - o.years) - (rcm === 'none' ? 0.15 : rcm === 'low' ? 0.08 : 0), 0.05, 1);
    o.neg++;
    const value = valueOf(S);
    const rcVal = rcm === 'none' ? 0 : rcm === 'low' ? Math.round(value * 1.5 / 1000) * 1000 : (o.rc || 0);
    if (rng.chance(P)) {
      o.wage = Math.round(o.wage * wm); o.years = yrs; o.role = role; o.rc = rcVal;
      return { ok: true, status: 'countered_accepted', messageHe: 'המועדון קיבל את הדרישות שלך!' };
    }
    if (rng.chance(0.5)) {
      o.wage = Math.round(o.wage * (1 + wm) / 2);
      o.years = Math.round((o.years + yrs) / 2);
      o.rc = Math.round((o.rc + rcVal) / 2 / 1000) * 1000;
      o.exp = Math.max(o.exp, curAw(S) + 1);
      return { ok: true, status: 'countered', messageHe: 'המועדון חזר עם הצעה נגדית באמצע הדרך' };
    }
    o.status = 'withdrawn'; o.cl = curAw(S);
    return { ok: true, status: 'withdrawn', messageHe: 'המועדון נעלב ומשך את ההצעה' };
  }
  // accept
  if (!canAcceptNow(S, o)) return { ok: false, error: 'busy', status: null, messageHe: 'סיים קודם את השבוע' };
  if (o.type === 'transfer' || o.type === 'loan') {
    if (!clubAccepts(S, rng, o)) {
      o.status = 'club_refused'; o.cl = curAw(S);
      return { ok: true, status: 'club_refused', messageHe: 'המועדון שלך סירב לשחרר אותך' };
    }
  }
  if (o.type === 'precontract') {
    const es = S.season + 1;
    p.next = { club: o.club, wage: o.wage, until: es + o.years - 1, role: o.role, rc: o.rc, since: S.season, loan: false };
    o.status = 'accepted'; o.cl = curAw(S);
    withdrawOthers(S, o.id);
    addTimeline(S, 'contract', 'סוכם חוזה מוקדם עם ' + clubName(o.club));
    sysMsg(S, 'agent', 'סגרנו! בקיץ {{אתה עובר|את עוברת}} ל' + clubName(o.club) + '.');
    return { ok: true, status: 'accepted', messageHe: gtext('סוכם! {{תעבור|תעברי}} בתחילת הקיץ') };
  }
  if (o.type === 'renewal') {
    const es = effSeason(S);
    p.contract = Object.assign({}, p.contract, { wage: o.wage, until: es + o.years - 1, role: o.role, rc: o.rc, since: S.season });
    o.status = 'accepted'; o.cl = curAw(S);
    addTimeline(S, 'contract', 'הארכת חוזה ב' + clubName(p.club) + ' עד ' + fmtSeason(p.contract.until));
    return { ok: true, status: 'signed', messageHe: 'החוזה הוארך!' };
  }
  if (o.type === 'pro') {
    o.status = 'accepted'; o.cl = curAw(S);
    signPro(S, o);
    return { ok: true, status: 'signed', messageHe: 'חתמת על חוזה מקצועני ראשון!' };
  }
  o.status = 'accepted'; o.cl = curAw(S);
  moveTo(S, o);
  return { ok: true, status: 'signed', messageHe: 'החוזה נחתם!' };
}

export function expireOffers(S) {
  const aw = curAw(S);
  const expired = [];
  for (const o of S.offers) {
    if (o.status === 'open' && aw > o.exp) { o.status = 'expired'; o.cl = aw; expired.push(o); }
  }
  S.offers = S.offers.filter((o) => o.status === 'open' || (aw - (o.cl || o.aw)) <= 4);
  return expired;
}

export function requestTransfer(S) {
  const p = S.player;
  if (p.stage !== 'pro' || !p.club || p.treq) return { ok: false, messageHe: p.treq ? 'כבר ביקשת העברה' : 'אין לך קבוצה לעזוב' };
  p.treq = true;
  p.trust = Math.max(0, p.trust - 15);
  p.fans = Math.max(0, p.fans - 10);
  return { ok: true, messageHe: 'ביקשת העברה. הסוכן יתחיל לחפש לך קבוצה.' };
}
export function cancelTransferRequest(S) {
  const p = S.player;
  if (!p.treq) return { ok: false, messageHe: 'אין בקשת העברה פעילה' };
  p.treq = false;
  return { ok: true, messageHe: 'ביטלת את בקשת ההעברה' };
}

// ----- VMs -----
export function contractVM(S, c, extra) {
  if (!c) return null;
  const p = S.player;
  const until = c.until;
  return {
    club: teamVM(c.club), wage: c.wage, until, untilHe: 'עד סוף ' + fmtSeason(until), role: c.role, roleHe: femLabel((ROLES && ROLES[c.role]) || c.role), rc: c.rc,
    loan: !!c.loan, parentHe: p.parent ? clubName(p.parent.club) : null, nextHe: p.next ? (clubName(p.next.club) + ' (מהקיץ)') : null,
    yearsLeft: Math.max(0, until - effSeason(S) + 1),
  };
}

export function offerVM(S, o, awLabel) {
  const p = S.player;
  const cd = clubData(o.club);
  const lid = clubLeague(S, o.club);
  const lg = LEAGUE_BY_ID[lid];
  const cc = country(clubCountry(o.club));
  const club = Object.assign(teamVM(o.club), { leagueHe: lg ? lgNameHe(lid) : '', countryHe: cc ? cc.nameHe : '', flag: cc ? cc.flag : '', strength: Math.round(cs(S, o.club)) });
  const compare = [];
  const curWage = p.contract ? p.contract.wage : 0;
  if (o.type !== 'loan' && curWage > 0 && o.type !== 'renewal') {
    const r = o.wage / curWage;
    if (r >= 1.15) compare.push('שכר גבוה פי ' + round1(r));
    else if (r <= 0.87) compare.push('שכר נמוך יותר');
    else compare.push('שכר דומה');
  } else if (o.type === 'renewal' && curWage > 0) compare.push('העלאה של ' + Math.round((o.wage / curWage - 1) * 100) + '%');
  if (p.club && o.club !== p.club) {
    const myL = LEAGUE_BY_ID[clubLeague(S, p.club)];
    if (lg && myL) {
      if (lg.prestige > myL.prestige + 0.4) compare.push('ליגה חזקה יותר');
      else if (lg.prestige < myL.prestige - 0.4) compare.push('ליגה חלשה יותר');
    }
    const d = cs(S, o.club) - cs(S, p.club);
    if (d >= 3) compare.push('קבוצה חזקה יותר');
    else if (d <= -3) compare.push('קבוצה חלשה יותר');
  }
  if (cc && cc.id !== p.nation) compare.push('מעבר לחו״ל: ' + cc.nameHe);
  compare.push('תפקיד: ' + femLabel((ROLES && ROLES[o.role]) || o.role));
  const negotiable = !(o.type === 'loan' || o.type === 'pro');
  return {
    id: o.id, type: o.type, typeHe: gtext(TYPE_HE[o.type] || o.type), club, fee: o.fee, wage: o.wage, years: o.years, role: o.role,
    roleHe: femLabel((ROLES && ROLES[o.role]) || o.role), rc: o.rc, status: o.status, statusHe: STATUS_HE[o.status] || o.status,
    expiresHe: o.status === 'open' ? ('בתוקף עד ' + awLabel(o.exp)) : '',
    negotiationsLeft: negotiable && o.status === 'open' ? Math.max(0, 2 - o.neg) : 0,
    compareHe: compare, canAccept: canAcceptNow(S, o),
  };
}
