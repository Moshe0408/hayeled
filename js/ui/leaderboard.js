// leaderboard.js (v2.3, F11): #/leaderboard ("טבלת האגדות": legacy / goals / Ballon d'Or, all time / this week),
// the "אתגר חבר" challenge link, and the challenge card on the title screen (?c=<code>, no backend needed).
// Online calls go through js/core/leaderboard.js (offline-safe); without a backend the screen shows a friendly state.
import * as game from '../engine/game.js';
import * as STR from '../data/strings.js';
import { esc } from './dom.js';
import { svc, call, toast, openModal } from './app.js';
import { navigate } from './router.js';
import { gtext } from './gender.js';
import { ico } from './icons.js';
import { badge, nationTeam } from './components.js';

const LBT = STR.LEADERBOARD_TEXT || {};
const CHT = STR.CHALLENGE_TEXT || {};
const L = (k, fb) => (LBT[k] !== undefined && LBT[k] !== '' ? LBT[k] : fb);
const fillV = (s, v = {}, gd) => gtext(String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? String(v[k]) : m)), gd);
const pick = (v) => (Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);
const KINDS_FB = { legacy: 'מורשת', goals: 'שערים', ballon: 'כדור הזהב' };
const PERIODS_FB = { all: 'כל הזמנים', week: 'השבוע' };
const STAT_FB = { legacy: '{n} נק׳', goals: '{n} שערים', ballon: '{n} כדורי זהב' };

let lbMod = null;
/** js/core/leaderboard.js, loaded defensively (null if it fails). */
export async function lb() {
  if (lbMod) return lbMod;
  try { lbMod = await import('../core/leaderboard.js'); } catch (e) { console.warn('[hayeled] leaderboard module', e); lbMod = null; }
  return lbMod;
}

function careerId() { try { return game.hasCareer() ? String(game.getSaveMeta().careerId || '') : ''; } catch { return ''; } }

/* ------------------------------------------------------------------ challenge helpers */
/** The loaded career as a challenge summary (getCareerSummaryForBoard + path milestone + age). null without career. */
export function challengeSummary() {
  if (!game.hasCareer()) return null;
  let s = null;
  if (typeof game.getCareerSummaryForBoard === 'function') s = call(() => game.getCareerSummaryForBoard(), { quiet: true });
  let meta = {}, hub = null;
  try { meta = game.getSaveMeta() || {}; } catch { meta = {}; }
  try { hub = game.getHub(); } catch { hub = null; }
  if (!s) s = { name: meta.name, gender: meta.gender, nation: meta.nation, clubHe: meta.clubHe, ovr: meta.ovr, goals: 0, trophies: 0, ballon: 0, legacy: 0, careerId: meta.careerId };
  let ms = null;
  try {
    const p = typeof game.getPath === 'function' ? game.getPath() : null;
    const done = p && Array.isArray(p.steps) ? p.steps.filter((x) => x.done) : [];
    ms = done.length ? done[done.length - 1] : null;
  } catch { ms = null; }
  const age = (hub && hub.player && hub.player.age) || meta.age || null;
  return { ...s, age, milestone: ms ? ms.id : null, milestoneHe: ms ? gtext(ms.he) : '', seasons: meta.seasons || 1 };
}

function reachOf(ch) {
  const steps = (STR.PATH && Array.isArray(STR.PATH.steps)) ? STR.PATH.steps : [];
  const st = ch.milestone ? steps.find((x) => x.id === ch.milestone) : null;
  if (st && st.reachHe) return gtext(st.reachHe, ch.gender);
  if (ch.milestoneHe) return 'ל' + (/^ה/.test(ch.milestoneHe) ? ch.milestoneHe.slice(1) : ch.milestoneHe);
  return '';
}
/** Card lines for a decoded challenge: { title, line, ask, stats, club }. Markers follow the challenger's gender. */
export function challengeLines(ch, mod) {
  const card = CHT.card || {};
  const gd = ch.gender === 'f' ? 'f' : 'm';
  const reach = reachOf(ch);
  const v = { name: ch.name, reach, age: ch.age || '', goals: ch.goals, trophies: ch.trophies, ovr: ch.ovr, club: ch.clubHe || '', nation: (nationTeam(ch.nation) || {}).nameHe || '' };
  let line = '';
  if (reach && ch.age && card.line) line = fillV(card.line, v, gd);
  if (!line && mod && mod.challengeLineHe) line = String(mod.challengeLineHe(ch) || '').replace(/\s*-\s*תנסה לנצח\?$/, '');
  if (!line) line = `${ch.name} ${gd === 'f' ? 'הגיעה' : 'הגיע'} ליכולת ${ch.ovr}`;
  return {
    title: card.title || 'אתגר חדש!',
    from: fillV(card.from || 'אתגר מ{name}', v, gd),
    line,
    ask: pick(card.ask) || 'מקבלים את האתגר?',
    stats: fillV(card.stats || '{goals} שערים · {trophies} תארים · יכולת {ovr}', v, gd),
    club: [v.club, v.nation].filter(Boolean).join(' · '),
    accept: card.accept || 'אני בפנים!',
    later: card.later || 'אולי אחר כך',
  };
}

/** Share the loaded career as a challenge link ("אתגר חבר"). */
export async function shareChallenge() {
  const m = await lb();
  const sum = challengeSummary();
  if (!m || !sum || !m.challengeUrl) { toast('אי אפשר ליצור אתגר כרגע'); return; }
  const url = m.challengeUrl(sum);
  if (!url) { toast('אי אפשר ליצור אתגר כרגע'); return; }
  const reach = reachOf({ ...sum, gender: sum.gender });
  const v = { reach: reach || 'רחוק', age: sum.age || '', goals: sum.goals || 0, trophies: sum.trophies || 0, url };
  const tpls = Array.isArray(CHT.share) ? CHT.share : [CHT.share].filter(Boolean);
  const okT = tpls.filter((t) => (!/\{reach\}/.test(t) || reach) && (!/\{age\}/.test(t) || sum.age));
  const msg = okT.length ? fillV(okT[Math.floor(Math.random() * okT.length)], v) : `${sum.name} מאתגר אותך בהילד מהשכונה! ${url}`;
  const sc = await import('./sharecard.js');
  sc.shareMoment({ kind: 'challenge', titleHe: CHT.button || 'אתגר חבר', textHe: reach ? `הגעתי ${reach}` : '', url, messageHe: msg });
}

/** Title screen: the challenge card HTML for ?c=<code> (''), and the click wiring. Tracks challenge_open once. */
let challengeSeen = false;
export async function titleChallenge() {
  const m = await lb();
  if (!m || !m.readChallengeFromUrl) return null;
  const r = m.readChallengeFromUrl();
  if (!r) return null;
  if (!challengeSeen) {
    challengeSeen = true;
    try { if (typeof svc.telemetry.trackChallengeOpen === 'function') svc.telemetry.trackChallengeOpen(!!r.challenge); else svc.telemetry.track('challenge_open', { valid: !!r.challenge }); } catch { /* ignore */ }
  }
  if (!r.challenge) {
    return { html: `<section class="card ch-card bad" data-testid="challenge-card"><p>${esc(CHT.invalid || 'קישור האתגר לא תקין. אפשר פשוט להתחיל קריירה')}</p><button type="button" class="btn btn-ghost btn-sm" data-act="ch-later">סגירה</button></section>`, challenge: null, mod: m };
  }
  const ch = r.challenge;
  try { localStorage.setItem('hy.challenge', JSON.stringify({ ...ch, at: Date.now() })); } catch { /* ignore */ }
  const t = challengeLines(ch, m);
  const nat = nationTeam(ch.nation);
  return {
    challenge: ch, mod: m,
    html: `<section class="card ch-card" data-testid="challenge-card">
      <div class="ch-top"><span class="ch-tag">${ico('fist', 'gold')}${esc(t.title)}</span><small class="muted">${esc(t.from)}</small></div>
      <div class="ch-body">${nat ? `<span class="ch-flag">${badge(nat, 'l')}</span>` : ''}<div class="ch-txt"><b class="ch-line">${esc(t.line)}</b><span class="ch-ask">${esc(t.ask)}</span></div>
        <span class="ch-ovr"><b class="num">${esc(ch.ovr)}</b><small>יכולת</small></span></div>
      <div class="ch-stats small muted">${esc(t.stats)}${t.club ? ' · ' + esc(t.club) : ''}</div>
      <div class="btn-row"><button type="button" class="btn btn-gold" data-act="ch-accept" data-testid="btn-challenge-accept">${ico('ball')}${esc(t.accept)}</button>
        <button type="button" class="btn btn-ghost" data-act="ch-later" data-testid="btn-challenge-later">${esc(t.later)}</button></div>
    </section>`,
  };
}

/* ------------------------------------------------------------------ #/leaderboard */
export async function render(root, params = {}) {
  let kind = ['legacy', 'goals', 'ballon'].includes(params.kind) ? params.kind : 'legacy';
  let period = params.period === 'week' ? 'week' : 'all';
  const kinds = { ...KINDS_FB, ...(LBT.kinds || {}) };
  const periods = { ...PERIODS_FB, ...(LBT.periods || {}) };
  const stat = { ...STAT_FB, ...(LBT.stat || {}) };
  const stat1 = LBT.stat1 || {};
  let alive = true;
  let token = 0;
  const has = game.hasCareer();

  function shell() {
    root.innerHTML = `<div class="lb" data-testid="leaderboard">
      <section class="card lb-hero"><span class="lb-crown" aria-hidden="true">${ico('trophy', 'gold')}</span><h2>${esc(L('title', 'טבלת האגדות'))}</h2>
        <div class="seg lb-kinds" role="tablist">${Object.keys(KINDS_FB).map((k) => `<button type="button" role="tab" class="seg-btn${k === kind ? ' on' : ''}" data-act="kind" data-v="${k}" data-testid="lb-kind-${k}" aria-selected="${k === kind}">${esc(kinds[k])}</button>`).join('')}</div>
        <div class="lb-periods">${Object.keys(PERIODS_FB).map((p) => `<button type="button" class="chip chip-btn${p === period ? ' on' : ''}" data-act="period" data-v="${p}" data-testid="lb-period-${p}">${esc(periods[p])}</button>`).join('')}</div>
      </section>
      <div class="lb-me-slot"></div>
      <div class="lb-list" aria-live="polite"><div class="lb-loading"><div class="spinner" aria-hidden="true"></div><span class="muted small">${esc(L('loading', 'טוען את הטבלה...'))}</span></div></div>
      ${has ? `<button type="button" class="btn btn-gold btn-lg lb-challenge" data-act="challenge" data-testid="btn-challenge">${ico('fist')}${esc(CHT.button || 'אתגר חבר')}</button>
        <p class="muted small center">${esc(gtext(CHT.hint || '{{שלח|שלחי}} לחבר את הקריירה שלך, ונראה מי מגיע רחוק יותר'))}</p>` : ''}
      <p class="muted small center lb-note">${esc(L('submitNote', 'בסוף כל עונה נשלחים לטבלה השם, הקבוצה והמספרים של הקריירה. בלי פרטים אישיים'))}</p>
      <div class="lb-part"></div>
    </div>`;
  }

  function rowHtml(r) {
    const n = r[kind] ?? 0;
    const v = Number(n) === 1 && stat1[kind] ? stat1[kind] : fillV(stat[kind], { n });
    const nat = nationTeam(r.nation);
    return `<div class="lb-row${r.mine ? ' mine' : ''}${r.rank <= 3 ? ' top top-' + r.rank : ''}" data-testid="lb-row">
      <span class="lb-rank num">${r.rank <= 3 ? `<i class="lb-medal">${esc(r.rank)}</i>` : esc(r.rank)}</span>
      <span class="lb-flag">${nat ? badge(nat, 's') : ''}</span>
      <span class="lb-name"><b>${esc(r.name)}${r.mine ? ` <em class="lb-me-tag">${esc(L('me', 'אני'))}</em>` : ''}</b><small class="muted">${esc(r.club || '')}${r.club ? ' · ' : ''}${esc((LBT.genderTag || { m: 'בן', f: 'בת' })[r.gender] || '')}</small></span>
      <span class="lb-stat num">${esc(v)}</span></div>`;
  }

  async function load() {
    const my = ++token;
    const list = root.querySelector('.lb-list');
    const meSlot = root.querySelector('.lb-me-slot');
    try { if (typeof svc.telemetry.trackLeaderboardView === 'function') svc.telemetry.trackLeaderboardView(kind, period); else svc.telemetry.track('leaderboard_view', { kind, period }); } catch { /* ignore */ }
    const m = await lb();
    let r = null;
    if (m && m.getLeaderboard) { try { r = await m.getLeaderboard({ kind, period, limit: 50, careerId: careerId() }); } catch { r = null; } }
    if (!alive || my !== token || !list) return;
    const emptyState = (txt, icon, retry) => `<div class="lb-empty" data-testid="lb-empty"><span class="lb-empty-ico">${ico(icon, 'gold')}</span><p>${esc(txt)}</p>${retry ? `<button type="button" class="btn btn-sm" data-act="retry">${esc(L('retry', 'לנסות שוב'))}</button>` : ''}</div>`;
    if (!r || !r.ok) {
      const off = !r || r.offline || r.error === 'offline' || (m && m.isAvailable && !m.isAvailable());
      list.innerHTML = emptyState(off ? L('offline', 'הטבלה זמינה כשיש חיבור לאינטרנט. הקריירה שלך נשמרת בינתיים') : r.error === 'not_installed' ? L('empty', 'עוד אין כאן אף אחד. הקריירה שלך יכולה להיות הראשונה') : L('error', 'הטבלה לא נטענה. אפשר לנסות שוב בעוד רגע'), off ? 'globe' : 'trophy', !off);
      if (meSlot) meSlot.innerHTML = '';
      return;
    }
    const rows = r.rows || [];
    list.innerHTML = rows.length ? `<div class="lb-rows">${rows.map(rowHtml).join('')}</div>` : emptyState(L('empty', 'עוד אין כאן אף אחד. הקריירה שלך יכולה להיות הראשונה'), 'trophy');
    if (meSlot) {
      if (r.me && r.me.rank) meSlot.innerHTML = `<div class="lb-mine" data-testid="lb-my-rank">${ico('user', 'gold')}<b>${esc(fillV(L('myRank', 'המקום שלך: {n}'), { n: r.me.rank }))}</b>${r.me.inTop ? '' : rowHtml({ ...r.me, mine: true })}</div>`;
      else meSlot.innerHTML = has ? `<p class="note lb-mine none">${ico('info')} ${esc(L('notRanked', 'הקריירה שלך עוד לא בטבלה. היא תיכנס בסוף העונה'))}</p>` : '';
    }
    if (r.stale) list.insertAdjacentHTML('afterbegin', `<p class="muted small center">${esc(L('offline', 'מוצגת הטבלה האחרונה שנשמרה'))}</p>`);
  }

  async function partToggle() {
    const m = await lb();
    const el = root.querySelector('.lb-part');
    if (!el || !m || !m.getParticipation || !has) return;
    const on = m.getParticipation();
    el.innerHTML = `<label class="lb-opt"><input type="checkbox" data-act="optin" data-testid="lb-optin-box" ${on ? 'checked' : ''}> <span>${esc(L('optIn', 'להופיע בטבלה (שם הדמות יוצג לכולם)'))}</span></label>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'kind') { kind = b.dataset.v; for (const x of root.querySelectorAll('[data-act="kind"]')) { x.classList.toggle('on', x.dataset.v === kind); x.setAttribute('aria-selected', String(x.dataset.v === kind)); } load(); }
    else if (act === 'period') { period = b.dataset.v; for (const x of root.querySelectorAll('[data-act="period"]')) x.classList.toggle('on', x.dataset.v === period); load(); }
    else if (act === 'retry') load();
    else if (act === 'challenge') shareChallenge();
  });
  root.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-act="optin"]')) return;
    const m = await lb();
    if (m && m.setParticipation) m.setParticipation(!!e.target.checked);
    if (e.target.checked) submitSeason().catch(() => {});
  });
  shell();
  load();
  partToggle();
  return () => { alive = false; };
}

/** Season end / retirement: send the career summary to the public board (never blocks, never throws). */
export async function submitSeason() {
  try {
    if (!game.hasCareer() || typeof game.getCareerSummaryForBoard !== 'function') return null;
    const s = call(() => game.getCareerSummaryForBoard(), { quiet: true });
    if (!s) return null;
    const m = await lb();
    if (!m || !m.submitCareer) return null;
    // explicit opt-in: the first season end asks once (the name of the character becomes public)
    if (m.isAvailable && m.isAvailable() && m.participationAsked && !m.participationAsked()) {
      // after the season-review screen has moved on and any other sheet (feedback) is closed
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (!document.querySelector('.modal-wrap:not(.closing)') && !String(location.hash).startsWith('#/season')) break;
      }
      const yes = await askOptIn(s);
      if (yes === null) return { ok: true, skipped: 'later' };   // closed by a screen change: ask again next season
      if (m.setParticipation) m.setParticipation(yes);
      if (!yes) return { ok: true, skipped: 'off' };
    }
    return await m.submitCareer(s);
  } catch { return null; }
}
function askOptIn(s) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (done) return; done = true; resolve(v); };
    const name = esc((s && s.name) || '');
    const close = openModal(`<div class="lb-ask" data-testid="lb-optin">
      <h2 class="modal-title">${ico('trophy', 'gold')} ${esc(L('askTitle', 'להיכנס לטבלת האגדות?'))}</h2>
      <p class="muted">${esc(L('askSub', 'הקריירה תופיע בטבלה הציבורית עם שם הדמות, הקבוצה והמספרים. אפשר לשנות בכל רגע במסך הטבלה.'))}</p>
      ${name ? `<p class="lb-ask-name"><b>${name}</b></p>` : ''}
      <div class="btn-col"><button type="button" class="btn btn-gold btn-lg" data-a="yes" data-testid="btn-lb-optin-yes">${esc(L('askYes', 'כן, תכניסו אותי!'))}</button>
      <button type="button" class="btn btn-ghost" data-a="no" data-nudge-later data-testid="btn-lb-optin-no">${esc(L('askNo', 'לא עכשיו'))}</button></div></div>`,
    { sheet: true, testid: 'lb-ask', onClose: (why) => fin(why === 'nav' ? null : false) });
    close.el.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; fin(b.dataset.a === 'yes'); close(); });
  });
}

/** Title-screen helper: go to the fast start with the challenge in mind (the challenger becomes the new career's rival). */
export function acceptChallenge(mod) {
  try { const c = localStorage.getItem('hy.challenge'); if (c) localStorage.setItem('hy.rival.next', c); } catch { /* ignore */ }
  try { if (mod && mod.stripChallengeFromUrl) mod.stripChallengeFromUrl(); } catch { /* ignore */ }
  navigate('#/new');
}

/* ------------------------------------------------------------------ v2.3 review: the challenger as a rival on the hub */
/** After a fast start: an accepted challenge becomes this career's rival ("מול נועה"). */
export function adoptRival(id) {
  try {
    const c = localStorage.getItem('hy.rival.next');
    if (!c || !id) return;
    localStorage.setItem('hy.rival.' + id, c);
    localStorage.removeItem('hy.rival.next');
  } catch { /* ignore */ }
}
function rivalOf(id) {
  try { const r = JSON.parse(localStorage.getItem('hy.rival.' + id) || 'null'); return r && r.name ? r : null; } catch { return null; }
}
/** Hub card: the challenger's numbers next to mine; beating both OVR and goals = "ניצחת! שלח בחזרה". */
export function rivalBar() {
  try {
    if (!game.hasCareer()) return '';
    const r = rivalOf(careerId());
    if (!r) return '';
    const me = challengeSummary();
    if (!me) return '';
    const rg = r.gender === 'f' ? 'f' : 'm';
    const won = (Number(me.ovr) || 0) >= (Number(r.ovr) || 0) && (Number(me.goals) || 0) >= (Number(r.goals) || 0);
    const pct = (a, b) => Math.max(0, Math.min(100, b > 0 ? (a / b) * 100 : 100));
    const row = (label, mine, theirs) => `<div class="rv-row"><small>${esc(label)}</small><span class="rv-bar"><i style="width:${pct(mine, theirs).toFixed(0)}%"></i></span><b class="num">${esc(mine)}/${esc(theirs)}</b></div>`;
    const ageLine = r.age ? (rg === 'f' ? 'היא הגיעה לזה בגיל ' : 'הוא הגיע לזה בגיל ') + r.age : '';
    return `<section class="card rival-card${won ? ' won' : ''}" data-testid="rival-bar">
      <div class="rv-head">${ico('fist', 'gold')}<b>${esc('מול ' + r.name)}</b><small class="muted">${esc(ageLine)}</small></div>
      ${row('יכולת', Number(me.ovr) || 0, Number(r.ovr) || 0)}
      ${row('שערים', Number(me.goals) || 0, Number(r.goals) || 0)}
      ${won ? `<button type="button" class="btn btn-gold btn-sm" data-act="rival-share" data-testid="btn-rival-share">${ico('upload')}${esc(gtext('{{ניצחת|ניצחת}} את האתגר! שלח בחזרה'))}</button>` : ''}
    </section>`;
  } catch { return ''; }
}
