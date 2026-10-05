// progress.js (v2.3): the "always a reason to play" widgets. Hub: career path bar (F7), weekly + season objectives (F4),
// daily reward sheet + streak (F8). Match: the STAKES card before kick-off and its resolution after (F9).
// Facade calls are optional (typeof game.x === 'function'), content tables are optional (built-in Hebrew fallbacks).
import * as game from '../engine/game.js';
import * as STR from '../data/strings.js';
import * as EVT from '../data/events.js';
import { esc } from './dom.js';
import { ctx, svc, call, toast, openModal, buzz, reducedMotion, refreshChrome } from './app.js';
import { gtext } from './gender.js';
import { ico } from './icons.js';
import * as daily from '../core/daily.js';
import { celebrate } from './scene/celebration.js';
import { money as fmtMoney } from './format.js';

export const tbl = (name) => STR[name] || EVT[name] || null;
const has = (fn) => typeof game[fn] === 'function';
/** Safe optional facade call (null when the function is missing or throws). */
export function opt(fn, ...args) {
  if (!has(fn)) return null;
  try { if (!game.hasCareer()) return null; } catch { return null; }
  return call(() => game[fn](...args), { quiet: true });
}
const fillV = (s, v = {}) => gtext(String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? String(v[k]) : m)));
const pct = (a, b) => Math.max(0, Math.min(100, b > 0 ? (Number(a) || 0) / b * 100 : 0));
const n0 = (v) => Math.max(0, Math.round(Number(v) || 0));

/* ------------------------------------------------------------------ F7 career path */
const PATH_FB = [
  ['debut', 'בכורה'], ['first_goal', 'גול ראשון'], ['starter', 'שחקן הרכב'], ['pro', 'חוזה מקצועני'], ['youth_nt', 'נבחרת הנוער'], ['abroad', 'הצעה מחו"ל'],
  ['top5', 'ליגה בכירה'], ['ucl', 'ליגת האלופות'], ['senior_nt', 'הנבחרת הבוגרת'], ['ballon10', 'טופ 10 בכדור הזהב'], ['legend', 'אגדה'],
];
export function getPathSafe() {
  const p = opt('getPath');
  if (p && Array.isArray(p.steps) && p.steps.length) return p;
  return null;
}
export function pathBar(p, { compact = false } = {}) {
  if (!p) return '';
  const steps = p.steps;
  const doneN = steps.filter((s) => s.done).length;
  const curI = Math.min(steps.length - 1, doneN);
  const nx = p.next || {};
  const prog = Math.max(0, Math.min(1, Number(nx.progress) || 0));
  const fillPct = steps.length > 1 ? ((Math.max(0, doneN - 1) + (doneN < steps.length ? prog : 0)) / (steps.length - 1)) * 100 : 100;
  return `<section class="card path-card${compact ? ' compact' : ''}" data-testid="path-bar">
    <div class="path-head"><span class="path-tag">${ico('flag', 'gold')}שביל הקריירה</span><span class="muted small num">${doneN}/${steps.length}</span></div>
    <div class="path-track" role="list">
      <i class="path-line" aria-hidden="true"><i style="width:${fillPct.toFixed(1)}%"></i></i>
      ${steps.map((s, i) => `<span class="path-node${s.done ? ' done' : ''}${i === curI && !s.done ? ' cur' : ''}" role="listitem" title="${esc(gtext(s.he))}" aria-label="${esc(gtext(s.he))}${s.done ? ' ✓' : ''}" style="--i:${i}">${s.done ? ico('check') : i === steps.length - 1 ? ico('star') : ''}</span>`).join('')}
    </div>
    ${nx.he ? `<div class="path-next"><small>הבא</small><b>${esc(gtext(nx.he))}</b>${nx.missingHe ? `<span class="path-miss">${esc(gtext(nx.missingHe))}</span>` : ''}
      ${prog > 0 && prog < 1 ? `<span class="path-prog"><i style="width:${(prog * 100).toFixed(0)}%"></i></span>` : ''}</div>` : `<div class="path-next done"><b>${esc(gtext('{{אגדה|אגדה}}! השביל הושלם'))}</b></div>`}
  </section>`;
}

/* ------------------------------------------------------------------ F4 objectives */
export function getObjectivesSafe() {
  const o = opt('getObjectives');
  if (!o || !Array.isArray(o.weekly)) return null;
  return o;
}
function objRow(x, season = false) {
  const tgt = Math.max(1, Number(x.target) || 1);
  const pr = Math.min(tgt, Number(x.progress) || 0);
  return `<div class="obj${x.done ? ' done' : ''}${season ? ' season' : ''}" data-testid="obj-${esc(x.id)}">
    <span class="obj-ico">${x.done ? ico('check', 'good') : season ? ico('trophy', 'gold') : ico('target')}</span>
    <div class="obj-main"><div class="obj-top"><b>${esc(gtext(x.he))}</b><span class="obj-rw">${esc(gtext(x.rewardHe || ''))}</span></div>
      <div class="obj-bar"><i style="width:${pct(pr, tgt).toFixed(0)}%"></i></div></div>
    <span class="obj-n num">${x.done ? '✓' : `${esc(Math.round(pr))}/${esc(tgt)}`}</span></div>`;
}
export function objectivesCard(o, { compact = false } = {}) {
  if (!o) return '';
  const w = o.weekly || [];
  const doneN = w.filter((x) => x.done).length;
  if (compact) {
    // the hub strip right under the player card: one line per objective, a bar, the count (the goals are always in view)
    const row = (x, season) => {
      const tgt = Math.max(1, Number(x.target) || 1);
      const pr = Math.min(tgt, Number(x.progress) || 0);
      return `<div class="objc${x.done ? ' done' : ''}${season ? ' season' : ''}" data-testid="obj-${esc(x.id)}"><span class="objc-ico">${x.done ? ico('check', 'good') : season ? ico('trophy', 'gold') : ico('target')}</span>
        <span class="objc-t">${esc(gtext(x.he))}</span><i class="objc-bar"><i style="width:${pct(pr, tgt).toFixed(0)}%"></i></i><span class="objc-n num">${x.done ? '✓' : `${esc(Math.round(pr))}/${esc(tgt)}`}</span><em class="objc-rw num">${esc(x.rewardStars ? '+' + x.rewardStars + '⭐' : '')}</em></div>`;
    };
    if (!w.length && !(o.season && o.season.he)) return '';
    return `<section class="card obj-card obj-compact" data-testid="objectives">
      <div class="objc-head"><b>משימות השבוע</b><small class="muted num">${doneN}/${w.length}</small></div>
      ${w.map((x) => row(x)).join('')}${o.season && o.season.he ? row(o.season, true) : ''}
    </section>`;
  }
  return `<section class="card obj-card" data-testid="objectives">
    <h2 class="card-title"><span>משימות השבוע</span><small class="muted num">${doneN}/${w.length}</small></h2>
    <div class="obj-list">${w.map((x) => objRow(x)).join('')}</div>
    ${o.season && o.season.he ? `<div class="obj-season">${objRow(o.season, true)}</div>` : ''}
  </section>`;
}

/* ------------------------------------------------------------------ F9 stakes */
const STAKE_ICO = { table: 'table', scout: 'target', derby: 'fist', coach: 'clipboard', national: 'flag', youth: 'flag', debut: 'boot', cup: 'trophy', europe: 'globe', fans: 'mega', title: 'trophy', relegation: 'warn', record: 'up', contract: 'pen', rival: 'fist', streak: 'spark' };
function stakeIco(kind) {
  const k = String(kind || '').toLowerCase();
  const key = Object.keys(STAKE_ICO).find((x) => k.includes(x));
  return ico(key ? STAKE_ICO[key] : 'spark', key === 'scout' || key === 'title' || key === 'cup' ? 'gold' : 'teal');
}
/** { stakes: [{he, kind}], personal: {he, rewardStars, kind?} | null } for the upcoming match (null without facade). */
export function getStakesSafe() {
  const r = opt('getStakes');
  if (!r) return null;
  let stakes = [], personal = null;
  if (Array.isArray(r)) { stakes = r; personal = r.personal || r.goal || null; }
  else if (typeof r === 'object') { stakes = r.stakes || r.list || r.items || []; personal = r.personal || r.personalGoal || r.goal || null; }
  stakes = (Array.isArray(stakes) ? stakes : []).filter((s) => s && (s.he || s.textHe)).map((s) => ({ he: s.he || s.textHe, kind: s.kind || s.type || '' })).slice(0, 2);
  if (personal && !(personal.he || personal.textHe)) personal = null;
  if (personal) personal = { ...personal, he: personal.he || personal.textHe, rewardStars: n0(personal.rewardStars ?? personal.stars) };
  if (!stakes.length && !personal) return null;
  return { stakes, personal };
}
export function stakesCard(st) {
  if (!st) return '';
  return `<div class="stakes" data-testid="stakes-card">
    <div class="stakes-head"><span>${ico('spark', 'gold')}על מה משחקים היום</span></div>
    ${st.stakes.map((s, i) => `<div class="stake" style="--d:${i}">${stakeIco(s.kind)}<span>${esc(gtext(s.he))}</span></div>`).join('')}
    ${st.personal ? `<div class="stake personal" data-testid="stakes-personal">${ico('target', 'gold')}<span><small>המטרה האישית שלך</small><b>${esc(gtext(st.personal.he))}</b></span>${st.personal.rewardStars ? `<em class="num">+${esc(st.personal.rewardStars)}⭐</em>` : ''}</div>` : ''}
  </div>`;
}
/** After the match: how the stakes and the personal goal resolved. s = finishMatch summary, pre = getStakesSafe() before. */
export function stakesResolution(s, pre, starsDelta0 = 0) {
  let starsDelta = starsDelta0;
  if (!s) return '';
  // engine-provided resolution (preferred): s.stakes / s.stakesResolved = [{he, ok, resultHe}], s.personalGoal = {he, done, stars}
  // engine: s.stakes = { items: [{kind, he, ok, resultHe}], goal: {he, ok, stars, rewardStars, resultHe}, titleHe }
  const SK = s.stakes && !Array.isArray(s.stakes) ? s.stakes : null;
  let rows = s.stakesResolved || s.stakesOut || (SK ? SK.items || SK.list : s.stakes) || null;
  rows = Array.isArray(rows) ? rows.filter((r) => r && (r.he || r.resultHe || r.textHe)) : [];
  let pg = (SK && SK.goal) || s.personalGoal || s.personal || s.matchGoal || null;
  if (pg && pg.done === undefined && pg.ok !== undefined) pg = { ...pg, done: pg.ok };
  if (pg && pg.resultHe) pg = { ...pg, he: pg.resultHe, goalHe: pg.he };
  if (s.starsEarned !== undefined && s.starsEarned !== null) starsDelta = Math.max(0, Number(s.starsEarned) || 0);
  if (!rows.length && pre && pre.stakes.length) rows = pre.stakes.map((x) => ({ he: x.he, kind: x.kind, ok: null }));
  if (!pg && pre && pre.personal) {
    const k = String(pre.personal.kind || pre.personal.id || pre.personal.he || '');
    const done = /assist|בישול/.test(k) ? (s.assists || 0) >= 1 : /rating|ציון|דירוג/.test(k) ? (Number(s.rating) || 0) >= 7 : /goal|score|גול|הבקע|תבקיע/.test(k) ? (s.goals || 0) >= 1 : null;
    pg = { he: pre.personal.he, done, stars: done ? pre.personal.rewardStars : 0 };
  }
  if (!rows.length && !pg && !starsDelta) return '';
  const mark = (ok) => (ok === true ? ico('check', 'good') : ok === false ? ico('cross', 'bad') : ico('info'));
  return `<section class="card stakes-res" data-testid="stakes-result">
    <h2 class="card-title"><span>${esc(gtext((SK && SK.titleHe) || 'מה זה שינה'))}</span>${starsDelta > 0 ? `<b class="stars-gain num">+${esc(starsDelta)}⭐</b>` : ''}</h2>
    ${rows.map((r) => `<div class="sr-row ${r.ok === true ? 'ok' : r.ok === false ? 'no' : ''}">${mark(r.ok)}<span>${esc(gtext(r.resultHe || r.he || r.textHe))}</span></div>`).join('')}
    ${pg ? `<div class="sr-row personal ${pg.done ? 'ok' : pg.done === false ? 'no' : ''}" data-testid="stakes-personal-result">${mark(pg.done)}<span><small>המטרה האישית</small> ${esc(gtext(pg.he || ''))}</span>${pg.done && (pg.stars || pg.rewardStars) ? `<em class="num">+${esc(pg.stars || pg.rewardStars)}⭐</em>` : ''}</div>` : ''}
  </section>`;
}

/* ------------------------------------------------------------------ F8 daily reward + streak */
const DAILY_FB = [
  { day: 1, stars: 3 }, { day: 2, energy: 15 }, { day: 3, stars: 5 }, { day: 4, money: 1500 }, { day: 5, stars: 8 }, { day: 6, energy: 25, stars: 3 }, { day: 7, stars: 25, energy: 30, chest: true },
];
function dailyDays() {
  if (has('getDailyPreview')) {
    const pv = opt('getDailyPreview');
    if (Array.isArray(pv) && pv.length >= 7) return pv.slice(0, 7).map((d, i) => ({ day: i + 1, ...d }));
  }
  const t = tbl('DAILY');
  let list = null;
  if (Array.isArray(t)) list = t;
  else if (t && typeof t === 'object') list = t.days || t.calendar || t.rewards || null;
  if (!Array.isArray(list) || list.length < 7) return DAILY_FB;
  return list.slice(0, 7).map((d, i) => {
    const o = { day: i + 1, ...(d && typeof d === 'object' ? d : {}) };
    // content shape: rewards: [{ type: 'stars'|'energy'|'money'|'morale', n }]
    if (Array.isArray(o.rewards)) for (const r of o.rewards) if (r && r.type && !o[r.type]) o[r.type] = Number(r.n) || 0;
    if (o.big) o.chest = true;
    return o;
  });
}
function dailyText(key, fb) {
  const t = tbl('DAILY');
  if (!t || Array.isArray(t) || typeof t !== 'object') return fb;
  let v = (t.ui && t.ui[key]) || t[key] || (t.text && t.text[key]);
  if (Array.isArray(v)) v = v[Math.floor(Math.random() * v.length)];
  return typeof v === 'string' && v ? v : fb;
}
function dayLabel(d) {
  const parts = [];
  if (d.stars) parts.push(d.stars + '⭐');
  if (d.energy) parts.push('+' + d.energy + ' אנרגיה');
  if (d.money) parts.push(d.moneyHe ? gtext(d.moneyHe) : d.moneyIls ? '₪' + Number(d.moneyIls).toLocaleString('en-US') : '+' + fmtMoney(Number(d.money) || 0));
  if (d.morale) parts.push('+' + d.morale + ' מורל');
  if (d.item) parts.unshift(d.itemHe || 'פריט מסתורי');
  if (d.scout) parts.unshift(d.scoutHe || 'הסקאוט הראשי');
  if (parts.length) return parts.join(' · ');
  return gtext(d.labelHe || d.short || d.he || '');
}
function dayIco(d, i) {
  if (d.chest || d.big || i === 6) return '<svg class="ico gold dly-chest" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5h17V20h-17z"/><path d="M3.5 10.5a8.5 5 0 0 1 17 0"/><path d="M3.5 13.5h17M11 12h2v3h-2z"/></svg>';
  if (d.item) return ico('sparkle', 'gold');
  if (d.scout) return ico('target', 'gold');
  if (d.energy && !d.stars) return ico('battery', 'teal');
  if (d.money && !d.stars) return ico('bank', 'gold');
  return ico('star', 'gold');
}

/** Show the daily reward sheet if today's reward has not been claimed (call on the hub). Returns true if shown. */
let dailyShownFor = '';
export function maybeShowDaily({ force = false, allowMatch = false } = {}) {
  try {
    if (!game.hasCareer()) return false;
    const hub = game.getHub();
    if (!hub || (hub.status === 'match' && !allowMatch) || hub.status === 'retired') return false;
    if (ctx.tutorial && !force) return false; // never on top of the debut flow
  } catch { return false; }
  const st = daily.status();
  if (st.claimedToday && !force) return false;
  if (!force && dailyShownFor === st.today) return false;
  // automated test runs (intro skipped) get the hub banner only: a modal would block their clicks
  if (!force) { try { if (localStorage.getItem('hy.intro.skip') === '1' && localStorage.getItem('hy.daily.auto') !== '1') return false; } catch { /* ignore */ } }
  dailyShownFor = st.today;
  showDailySheet(st);
  return true;
}

export function showDailySheet(st = daily.status()) {
  const days = dailyDays();
  const idx = st.dayIndex; // 1..7 the claim pays (or paid, when claimed)
  const claimed = st.claimedToday;
  const streakNow = claimed ? st.streak : st.nextStreak;
  const title = dailyText('title', 'הפרס היומי');
  const sub = claimed ? fillV(dailyText('tomorrowHint', 'מחר מחכה: {v}'), { v: dayLabel(days[idx % 7]) })
    : st.reset ? dailyText('missed', 'פספסת יום, והרצף התחיל מחדש. היום מתחילים שוב')
      : st.freezeUsed ? dailyText('freezeUsed', 'הקפאת הרצף נכנסה לפעולה: פספסת יום, והרצף נשמר')
        : st.last ? dailyText('welcome', 'חזרת! הנה הפרס של היום') : dailyText('sub', 'כל יום שחוזרים, הפרס גדל. ביום ה-7 מחכה תיבה');
  const streakLine = streakNow > 1 ? fillV(dailyText('streak', '{n} ימים ברצף'), { n: streakNow }) : dailyText('streak1', 'יום ראשון ברצף');
  const chestN = 7 - idx;
  const chestLine = idx === 7 ? dailyText('chest', 'התיבה הגדולה') : chestN === 1 && claimed ? dailyText('chestHint1', 'מחר: התיבה הגדולה!') : fillV(dailyText('chestHint', 'עוד {n} ימים לתיבה הגדולה'), { n: claimed ? chestN : chestN });
  const html = `<div class="dly" data-testid="daily-sheet">
    <div class="dly-head"><span class="dly-flame${streakNow >= 3 ? ' hot' : ''}">${ico('spark', 'gold')}<b class="num">${esc(streakNow)}</b></span>
      <div><h2 class="modal-title">${esc(gtext(title))}</h2><p class="muted small">${esc(gtext(sub))}</p><p class="dly-streak small"><b>${esc(streakLine)}</b> · ${esc(chestLine)}</p></div></div>
    <div class="dly-grid">${days.map((d, i) => {
      const n = i + 1;
      const state = n < idx || (claimed && n === idx) ? 'got' : n === idx ? 'today' : 'next';
      return `<div class="dly-day ${state}${n === 7 ? ' big' : ''}" data-testid="daily-day-${n}"><small>יום ${n}</small>${dayIco(d, i)}<b>${esc(dayLabel(d))}</b>${state === 'got' ? `<i class="dly-got">${ico('check')}</i>` : ''}</div>`;
    }).join('')}</div>
    <p class="muted small dly-note">${ico('info')} ${esc(dailyText('freezeInfo', 'הקפאת רצף אחת בשבוע שומרת על הרצף אם מפספסים יום'))} · ${esc(st.freezeLeft ? dailyText('freezeReady', 'הקפאת רצף: זמינה') : dailyText('freezeSpent', 'הקפאת רצף: נוצלה השבוע'))}</p>
    ${claimed ? `<button type="button" class="btn btn-ghost btn-lg" data-close>${esc(dailyText('close', 'סגור'))}</button>`
      : `<button type="button" class="btn btn-gold btn-xl dly-claim" data-act="claim" data-testid="btn-daily-claim">${ico('sparkle')}${esc(gtext(dailyText('claim', 'לאסוף')))}</button>`}
  </div>`;
  const close = openModal(html, { sheet: true, testid: 'daily', cls: 'dly-modal', onClose: (why) => { if (why !== 'nav') { try { const b = document.querySelector('[data-testid="hub-daily"]'); if (b && !daily.available()) b.remove(); } catch { /* ignore */ } } } });
  close.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="claim"]');
    if (!b || b.disabled) return;
    b.disabled = true;
    const now = new Date();
    const s2 = daily.status(now);
    if (s2.claimedToday) { close(); return; }
    const r = has('claimDaily') ? call(() => game.claimDaily(s2.dayIndex, s2.today, s2.nextStreak), { quiet: true }) : { ok: true, rewards: [] };
    if (r && r.ok === false && r.error !== 'claimed') { b.disabled = false; toast(r.messageHe || 'לא הצלחנו לאסוף את הפרס'); return; }
    const c = daily.claim(now);
    try { if (typeof svc.telemetry.trackDailyReward === 'function') svc.telemetry.trackDailyReward(c.dayIndex, c.streak); else svc.telemetry.track('daily_reward', { day: c.dayIndex, streak: c.streak }); } catch { /* ignore */ }
    buzz([30, 30, 80]);
    const got = rewardsLine(r && r.rewards, days[c.dayIndex - 1]);
    const box = close.el.querySelector('.dly');
    const cell = close.el.querySelector(`[data-testid="daily-day-${c.dayIndex}"]`);
    if (cell) { cell.classList.remove('today'); cell.classList.add('got', 'pop'); cell.insertAdjacentHTML('beforeend', `<i class="dly-got">${ico('check')}</i>`); }
    b.outerHTML = `<div class="dly-won" data-testid="daily-won"><b>${esc(gtext('{{קיבלת|קיבלת}}!'))}</b><span>${esc(got)}</span></div><button type="button" class="btn btn-primary btn-lg" data-close data-testid="btn-daily-ok">יאללה!</button>`;
    if (box) box.classList.add('claimed');
    if (c.dayIndex === 7 && !reducedMotion()) { try { celebrate({ kind: 'trophy', small: true, textHe: 'תיבת האוצר!', subHe: got }); } catch { /* ignore */ } }
    refreshChrome();
  });
  return close;
}
function rewardsLine(rewards, day) {
  if (Array.isArray(rewards) && rewards.length) {
    return rewards.map((x) => (typeof x === 'string' ? x : x.he || x.textHe || (x.kind === 'stars' ? '+' + (x.amount ?? x.n) + '⭐' : (x.amount ?? x.n) ? '+' + (x.amount ?? x.n) + ' ' + (x.kind || '') : ''))).filter(Boolean).map((t) => gtext(t)).join(' · ');
  }
  return day ? dayLabel(day) : '';
}

/** v2.3 review: "מחר מחכה לך" - a reason to come back tomorrow (week summary footer, once today's reward is claimed). */
export function tomorrowTeaser() {
  try {
    if (!game.hasCareer()) return '';
    const st = daily.status();
    if (!st.claimedToday) return '';
    const days = dailyDays();
    const nx = days[st.dayIndex % 7] || {};
    const n = (st.dayIndex % 7) + 1;
    return `<p class="dly-tomorrow" data-testid="daily-tomorrow"><span class="dly-flame${st.streak >= 3 ? ' hot' : ''}">${ico('spark', 'gold')}<b class="num">${esc(st.streak)}</b></span><span>${esc(n === 7 ? 'מחר: התיבה הגדולה!' : 'מחר מחכה לך: ' + dayLabel(nx))}</span></p>`;
  } catch { return ''; }
}

/** Hub banner while today's reward waits (opens the sheet). */
export function dailyBanner() {
  try { if (!game.hasCareer() || !daily.available()) return ''; } catch { return ''; }
  const st = daily.status();
  const days = dailyDays();
  const d = days[st.dayIndex - 1] || {};
  return `<button type="button" class="dly-banner${st.dayIndex === 7 ? ' big' : ''}" data-act="daily" data-testid="hub-daily">
    <span class="dly-b-ico">${dayIco(d, st.dayIndex - 1)}</span>
    <span class="grow"><b>${esc(gtext(dailyText('badge', 'יש פרס שמחכה')))}</b><small>${esc('יום ' + st.dayIndex + ' · ' + dayLabel(d))}${st.nextStreak > 1 ? ' · ' + esc(fillV(dailyText('streak', '{n} ימים ברצף'), { n: st.nextStreak })) : ''}</small></span>
    <span class="chev" aria-hidden="true">‹</span></button>`;
}
