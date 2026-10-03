// match.js: #/match. TV-broadcast WATCH MODE (default, contract C5): at kick-off the engine resolves the whole match
// (game.autoPlayMatch) and the screen replays its log on a running clock - goals on the live pitch, "גוללללל!"
// celebrations, the fourth official's LED board for substitutions, half-time / full-time whistles - then a
// broadcast stats panel. The old interactive key moments stay available only when ctx.settings.decisions === true.
// Never shows ads.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, call, toast, buzz, reducedMotion } from './app.js';
import { navigate } from './router.js';
import { badge, oddsChip, ratingChip, resChip } from './components.js';
import { rating, signed } from './format.js';
import { createMatchScene } from './scene/match-scene.js';
import * as crowd from './scene/crowd-audio.js';

import { crestSVG } from './crests.js';
import { celebrate } from './scene/celebration.js';
import * as genderStatic from './gender.js';
import { ico } from './icons.js';

/* ------------------------------------------------------------------ shared modules
   Crests (C6), the mega celebration (C9) and gender helpers (C2). Calls stay wrapped in try/catch so a
   rendering error in one of them never breaks the match screen. */
const crestFn = crestSVG, celebrateFn = celebrate, genderMod = genderStatic;
const optReady = Promise.resolve();

function careerGender() {
  try { const m = game.getSaveMeta(); return m && m.gender === 'f' ? 'f' : 'm'; } catch { return 'm'; }
}
/** g(male, female): text for the current career gender (C2). */
function g(male, female) {
  if (genderMod && typeof genderMod.g === 'function') { try { return genderMod.g(male, female); } catch { /* fall through */ } }
  return careerGender() === 'f' ? female : male;
}
/** Resolves {{male|female}} markers that might still be inside a string. */
function gt(str) {
  const s = String(str == null ? '' : str);
  if (s.indexOf('{{') < 0) return s;
  if (genderMod && typeof genderMod.gtext === 'function') { try { return genderMod.gtext(s); } catch { /* fall through */ } }
  const f = careerGender() === 'f';
  return s.replace(/\{\{([^|{}]*)\|([^|{}]*)\}\}/g, (_, a, b) => (f ? b : a));
}
function crest(team, size = 40) {
  if (crestFn && team) { try { const s = crestFn(team, size); if (s) return `<span class="mx-crest" style="--cs:${size}px">${s}</span>`; } catch { /* fallback */ } }
  return `<span class="mx-crest mx-crest-fb" style="--cs:${size}px">${badge(team, size >= 56 ? 'l' : 'm')}</span>`;
}

/* ------------------------------------------------------------------ constants */
// How a chosen option is acted out on the live pitch (decisions mode).
const CROSS_KEYS = new Set(['whipped_cross', 'take_on_cross', 'to_box', 'knock_down', 'power_header', 'placed_header', 'long_ball']);
const PASS_KEYS = new Set(['cutback', 'pass_wide', 'killer_pass', 'one_two', 'line_break']);
const SHOT_CODES = new Set(['GOAL', 'ASSIST', 'MISS', 'SAVE']);
const pick = (a, n) => a[Math.abs(n | 0) % a.length];
const safeHex = (c, d) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : d);
const ICON_SND_ON = '<svg class="i" viewBox="0 0 24 24"><path d="M4 9.2h3.6L12.5 5v14l-4.9-4.2H4Z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2"/></svg>';
const ICON_SND_OFF = '<svg class="i" viewBox="0 0 24 24"><path d="M4 9.2h3.6L12.5 5v14l-4.9-4.2H4Z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>';
const ICON_DRUM = '<svg class="i" viewBox="0 0 24 24"><ellipse cx="12" cy="10" rx="7.5" ry="3"/><path d="M4.5 10v5.5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V10M7.5 3.5l3 5M16.5 3.5l-3 5"/></svg>';
const SIDE_HE = { att: 'התקפה', def: 'הגנה', gk: 'שער' };
// line icons (js/ui/icons.js) instead of emoji: one visual language with the tab bar and the settings list
const CODE_ICON = { GOAL: 'ball', ASSIST: 'boot', CHANCE: 'spark', MISS: 'cross', LOST: 'cross', WON: 'check', BEATEN: 'cross', CONCEDED: 'cross', SAVE: 'shield', GK_CONCEDED: 'cross', CARD: 'card' };
const CODE_TONE = { GOAL: 'gold', ASSIST: 'teal', CHANCE: 'teal', WON: 'good', SAVE: 'good', CARD: 'warn' };
const EV_ICON = { kickoff: 'whistle', goal: 'ball', sub: 'swap', card: 'card', ht: 'clock', ft: 'flag', et: 'clock', pens: 'target', moment: 'spark', info: 'mega' };
const DEFAULT_NUM = { GK: 1, RB: 2, LB: 3, CB: 4, CDM: 6, RW: 7, CM: 8, ST: 9, CAM: 10, LW: 11 };
const MIN_PER_SEC = 90 / 30;          // x1: 30 s of running clock (+ goal / sub / whistle sequences ~ 45-60 s per match)
const SHOT_TYPES = ['dribble_shot', 'cross', 'cutback'];

/** The feed and lower third show the minute in their own badge: drop the 'דקה 43:' prefix of commentary lines. */
const noMinute = (t) => String(t == null ? '' : t).replace(/^\s*דקה\s+\d+(?:\+\d+)?\s*[:׃]\s*/, '');
function hashStr(s) { let h = 2166136261; s = String(s || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mmss(clock) {
  const t = Math.max(0, Math.round(clock * 60));
  const mm = Math.floor(t / 60), ss = t % 60;
  return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

/* ------------------------------------------------------------------ player identity */
function playerInfo(m) {
  let meta = {};
  try { meta = game.getSaveMeta() || {}; } catch { /* no career */ }
  const name = (m && (m.playerNameHe || (m.player && m.player.nameHe))) || meta.name || '';
  const parts = String(name).trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
  const nick = meta.nick || '';
  const callHe = (m && m.playerHe) || nick || '';
  const pos = (m && m.pos) || meta.pos || 'ST';
  const num = Number((m && (m.num || (m.player && m.player.num) || m.shirtNum)) || meta.num) || DEFAULT_NUM[pos] || 9;
  const gender = (m && m.gender) === 'f' || meta.gender === 'f' ? 'f' : 'm';
  return { name, last, nick, call: callHe || last, pos, posHe: meta.posHe || '', num, gender, look: meta.look || null };
}
function mentionsMe(txt, P) {
  const t = String(txt || '');
  return !!((P.last && P.last.length > 1 && t.indexOf(P.last) >= 0) || (P.nick && P.nick.length > 1 && t.indexOf(P.nick) >= 0) || (P.call && P.call.length > 1 && t.indexOf(P.call) >= 0));
}
function nameMatch(a, P) {
  const t = String(a || '');
  return !!t && ((P.name && t.indexOf(P.name) >= 0) || mentionsMe(t, P));
}

/* ------------------------------------------------------------------ log -> broadcast events
   Uses the structured C4 fields when the engine provides them; otherwise infers them from kind/text. */
function normEvents(m, P) {
  const log = Array.isArray(m.log) ? m.log : [];
  const n = log.length;
  const evs = [];
  let own = 0, opp = 0, meGoals = 0;
  const final = m.isHome ? [m.score[0], m.score[1]] : [m.score[1], m.score[0]];
  log.forEach((e, i) => {
    const kind = e.kind || 'info';
    const txt = gt(e.textHe || '');
    const minute = Number(e.minute) || 0;
    let ev = e.ev || null, who = e.who || null, side = e.side || null, subOn = null;
    if (!ev) {
      if (kind === 'goal_for' || kind === 'goal_against') ev = 'goal';
      else if (i === 0 && minute === 0) ev = 'kickoff';
      else if (i === n - 1 && kind === 'info') ev = 'ft';
      else if (kind === 'info' && minute === 45 && /מחצית|הפסקה|חדר ההלבשה/.test(txt)) ev = 'ht';
      else if (kind === 'info' && /הארכה/.test(txt) && minute >= 90) ev = 'et';
      else if (kind === 'info' && /פנדל/.test(txt) && minute >= 120) ev = 'pens';
      else if (kind === 'info' && mentionsMe(txt, P) && /יוצא|מוחלף|מסיים את המשחק/.test(txt)) { ev = 'sub'; who = 'me'; subOn = false; }
      else if (kind === 'info' && mentionsMe(txt, P) && /נכנס|עולה|קורא ל/.test(txt)) { ev = 'sub'; who = 'me'; subOn = true; }
      else if (kind === 'moment') ev = 'moment';
      else if (/צהוב|כרטיס/.test(txt)) ev = 'card';
      else ev = 'info';
    }
    if (ev === 'goal') {
      if (!side) side = kind === 'goal_against' || who === 'opp' ? 'opp' : 'own';
      if (!who) who = side === 'opp' ? 'opp' : (mentionsMe(txt, P) && !/מבשל|בישול|מסירה|אסיסט|בישל|מוסר|מניח|מגביה|מרים|מחזיר|לאגף|על הראש של|בשביל/.test(txt) && !e.assist ? 'me' : 'mate');
      if (Array.isArray(e.score) && e.score.length === 2) { own = m.isHome ? e.score[0] : e.score[1]; opp = m.isHome ? e.score[1] : e.score[0]; } else if (side === 'own') own++; else opp++;
      if (who === 'me') meGoals++;
    }
    if (ev === 'sub' && who === 'me' && subOn === null) {
      if (e.inHe && nameMatch(e.inHe, P)) subOn = true;
      else if (e.outHe && nameMatch(e.outHe, P)) subOn = false;
      else subOn = !/יוצא|מוחלף|מסיים/.test(txt);
    }
    if (ev === 'sub' && !side) side = 'own';
    const x = { i, minute, textHe: txt, kind, ev, who, side, subOn, inHe: e.inHe ? gt(e.inHe) : '', outHe: e.outHe ? gt(e.outHe) : '',
      inNum: e.inNum || null, outNum: e.outNum || null, scorerHe: gt(e.scorerHe || e.nameHe || e.playerHe || ''), raw: e };
    if (ev === 'goal') {
      x.own = own; x.opp = opp;
      const late = minute >= 80 && (side === 'own' ? own - opp : opp - own) >= 0 && (side === 'own' ? own - opp : opp - own) <= 1;
      x.big = typeof e.big === 'boolean' ? e.big : (who === 'me' || !!m.big || late);
      x.mega = typeof e.mega === 'boolean' ? e.mega : (who === 'me' && (!!m.big || minute >= 80 || meGoals === 3));
    }
    evs.push(x);
  });
  // extra-time goals that the log does not narrate: synthesise them so the replayed score ends right
  const etIdx = evs.findIndex((x) => x.ev === 'et');
  const missOwn = Math.max(0, final[0] - own), missOpp = Math.max(0, final[1] - opp);
  if (missOwn + missOpp > 0) {
    const at = etIdx >= 0 ? etIdx + 1 : Math.max(0, evs.findIndex((x) => x.ev === 'ft'));
    const base = etIdx >= 0 ? 95 : 88;
    const span = etIdx >= 0 ? 23 : 1;
    const list = [];
    const tot = missOwn + missOpp;
    for (let k = 0; k < tot; k++) {
      const sideK = k < missOwn ? 'own' : 'opp';
      list.push({ minute: base + Math.round(((k + 1) / (tot + 1)) * span), side: sideK });
    }
    list.sort((a, b) => a.minute - b.minute);
    let o2 = own, p2 = opp;
    const ins = list.map((q) => {
      if (q.side === 'own') o2++; else p2++;
      const team = q.side === 'own' ? myTeam(m) : oppTeam(m);
      return { i: -1, minute: q.minute, textHe: `דקה ${q.minute}: גול ל${(team && team.shortHe) || 'קבוצה'}${etIdx >= 0 ? ' בהארכה' : ''}!`, kind: q.side === 'own' ? 'goal_for' : 'goal_against',
        ev: 'goal', who: q.side === 'own' ? 'mate' : 'opp', side: q.side, own: o2, opp: p2, big: true, mega: false, synth: true, raw: {} };
    });
    evs.splice(at < 0 ? evs.length : at, 0, ...ins);
  }
  // the clock moment each event fires at (monotonic). ET starts right after 90'.
  let last = 0;
  for (const x of evs) {
    let at = x.ev === 'kickoff' ? 0 : x.ev === 'et' ? 90 : x.minute;
    if (x.ev === 'ht') at = 45;
    at = Math.max(last, at);
    x.at = at; last = at;
  }
  return evs;
}
function myTeam(m) { return m.isHome ? m.home : m.away; }
function oppTeam(m) { return m.isHome ? m.away : m.home; }
function teamColors(t, fb) {
  const c = (t && Array.isArray(t.colors) ? t.colors : null) || fb;
  return [safeHex(c[0], fb[0]), safeHex(c[1], fb[1])];
}

/* ------------------------------------------------------------------ whistle (WebAudio, only when crowd sound is on) */
let wac = null;
function whistle(times = 1, long = false) {
  if (!crowd.isOn()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!wac) wac = new AC();
    if (wac.state === 'suspended') wac.resume();
    const t0 = wac.currentTime + 0.02;
    for (let k = 0; k < times; k++) {
      const t = t0 + k * 0.42, d = long && k === times - 1 ? 0.95 : 0.28;
      const o = wac.createOscillator(), lfo = wac.createOscillator(), lg = wac.createGain(), gn = wac.createGain();
      o.type = 'sine'; o.frequency.value = 2950; lfo.frequency.value = 34; lg.gain.value = 140;
      lfo.connect(lg).connect(o.frequency);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.16, t + 0.02); gn.gain.setValueAtTime(0.16, t + d - 0.05); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(gn).connect(wac.destination);
      o.start(t); lfo.start(t); o.stop(t + d + 0.02); lfo.stop(t + d + 0.02);
    }
  } catch { /* audio is optional */ }
}

/* ------------------------------------------------------------------ mini formation (pre-match card) */
const F433 = { GK: [60, 147], LB: [17, 118], LCB: [44, 126], RCB: [76, 126], RB: [103, 118], LCM: [33, 90], DM: [60, 100], RCM: [87, 90], LW: [22, 52], ST: [60, 38], RW: [98, 52] };
const F4231 = { GK: [60, 147], LB: [17, 118], LCB: [44, 126], RCB: [76, 126], RB: [103, 118], LDM: [44, 100], RDM: [76, 100], CAM: [60, 72], LW: [22, 58], ST: [60, 34], RW: [98, 58] };
const SLOT_NUM = { GK: 1, RB: 2, LB: 3, RCB: 4, LCB: 5, DM: 6, LDM: 6, RW: 7, RCM: 8, RDM: 8, ST: 9, CAM: 10, LCM: 10, LW: 11 };
const POS_SLOT = { GK: 'GK', CB: 'RCB', LB: 'LB', RB: 'RB', CDM: 'DM', CM: 'RCM', CAM: 'CAM', LW: 'LW', RW: 'RW', ST: 'ST' };
function formationSVG(P, colors, starter) {
  const F = P.pos === 'CAM' ? F4231 : F433;
  const mine = POS_SLOT[P.pos] || 'ST';
  const [c1, c2] = colors;
  const dots = Object.keys(F).map((k) => {
    const [x, y] = F[k];
    const me = starter && k === mine;
    const num = me ? P.num : (SLOT_NUM[k] === P.num ? (k === 'GK' ? 1 : 12 + (SLOT_NUM[k] || 0)) : SLOT_NUM[k]);
    return `<g class="fd${me ? ' me' : ''}" transform="translate(${x} ${y})">
      ${me ? '<circle class="fd-pulse" r="11"/>' : ''}
      <circle r="${me ? 8.2 : 6.6}" fill="${me ? '#F4C35A' : c1}" stroke="${me ? '#FFF6D6' : c2}" stroke-width="1.6"/>
      <text y="${me ? 3 : 2.5}" font-size="${me ? 8 : 6.6}" fill="${me ? '#0A1838' : c2}">${esc(num)}</text></g>`;
  }).join('');
  const bench = starter ? '' : `<g class="fd me" transform="translate(60 176)"><circle class="fd-pulse" r="11"/><circle r="8.2" fill="#F4C35A" stroke="#FFF6D6" stroke-width="1.6"/><text y="3" font-size="8" fill="#0A1838">${esc(P.num)}</text></g>
    <text class="fd-bench" x="60" y="196">ספסל</text>`;
  return `<svg class="mx-form" viewBox="0 0 120 ${starter ? 166 : 202}" role="img" aria-label="ההרכב">
    <defs><linearGradient id="mxPitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C7A44"/><stop offset="1" stop-color="#11532F"/></linearGradient></defs>
    <rect x="2" y="2" width="116" height="160" rx="8" fill="url(#mxPitch)"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i % 2 ? `<rect x="2" y="${2 + i * 20}" width="116" height="20" fill="rgba(255,255,255,.035)"/>` : '')).join('')}
    <g fill="none" stroke="rgba(240,250,255,.55)" stroke-width="1">
      <rect x="6" y="6" width="108" height="152" rx="2"/><line x1="6" y1="82" x2="114" y2="82"/><circle cx="60" cy="82" r="13"/>
      <rect x="32" y="6" width="56" height="22"/><rect x="32" y="136" width="56" height="22"/><rect x="47" y="6" width="26" height="8"/><rect x="47" y="150" width="26" height="8"/>
    </g>${dots}${bench}</svg>`;
}

/* ------------------------------------------------------------------ the screen */
export function render(root) {
  let m = call(() => game.getMatch(), { quiet: true });
  if (!m) { navigate('#/hub', { replace: true }); return; }
  const decisions = !!(ctx.settings && ctx.settings.decisions === true);
  const P = playerInfo(m);
  let summary = null;
  let outcome = null;
  let busy = false;
  let skipWait = null;
  let scene = null;
  let sceneKey = '';
  let waitOutcome = null;
  let RP = null;        // replay state (watch mode)
  let alive = true;
  let speed = 1;
  let lastEvs = null;  // the match events as replayed (the finish summary log may lack the C4 fields)

  function kit(t, fallback) {
    const [a, b] = teamColors(t, fallback);
    return { name: (t && (t.shortHe || t.nameHe)) || '', shirt: a, shorts: b, socks: a, trim: b, gk: '#22C55E', fans: [a, a, b, '#F4F4F4'] };
  }
  function ensureShell() {
    if (root.querySelector('.match-shell')) return;
    root.innerHTML = `<div data-testid="match" class="match match-shell mx">
      <div class="pitch-wrap mx-pitch" data-act="skip">
        <canvas class="match-canvas" aria-label="המשחק בשידור חי"></canvas>
        <div class="sb-slot mx-bug-slot"></div>
        <div class="hud-top mx-hud"><div class="chant"><span class="drum" aria-hidden="true">${ICON_DRUM}</span><span>אוהדים: <em class="chant-t"></em></span></div>
          <button type="button" class="mute" data-act="mute" data-testid="btn-sound" aria-label="צליל קהל"></button></div>
        <div class="mx-fx" aria-live="polite"></div>
        <div class="mx-lower" aria-hidden="true"></div>
        <div class="goal-flash" aria-hidden="true"><b>גול!</b></div>
      </div>
      <div class="match-body mx-body"></div></div>`;
    paintMute();
  }
  function paintMute() {
    const b = root.querySelector('.mute');
    if (!b) return;
    const on = crowd.isOn();
    b.classList.toggle('on', on);
    b.innerHTML = on ? ICON_SND_ON : ICON_SND_OFF;
  }
  // the scene always shows "my" team as the home side
  function myScore() { return m.isHome ? [m.score[0], m.score[1]] : [m.score[1], m.score[0]]; }
  function ensureScene() {
    ensureShell();
    const me = myTeam(m), op = oppTeam(m);
    const key = (me && (me.id || me.nameHe)) + '|' + (op && (op.id || op.nameHe));
    if (scene && sceneKey === key) return;
    destroyScene();
    const home = kit(me, ['#F4C35A', '#0B1E42']);
    const away = kit(op, ['#E8ECF4', '#17181C']);
    if (away.shirt.toLowerCase() === home.shirt.toLowerCase()) { away.shirt = away.shorts; away.socks = away.shorts; }
    if (away.shirt.toLowerCase() === home.shirt.toLowerCase()) { away.shirt = '#E8ECF4'; away.socks = '#E8ECF4'; }
    const chant = `יאללה יאללה ${home.name || 'הקבוצה'}!`;
    const ct = root.querySelector('.chant-t');
    if (ct) ct.textContent = '"' + chant + '"';
    try {
      scene = createMatchScene(root.querySelector('.match-canvas'), {
        home, away, chant, hero: P.call, seed: (hashStr(key) % 997) + (m.minute || 0) + m.score[0] * 7 + 3, ambientGoals: false,
        heroRole: P.pos, heroNum: P.num, heroOn: decisions ? true : m.role === 'starter', gender: P.gender, heroLook: P.look,
      });
      sceneKey = key;
      scene.on('outcome', () => { if (waitOutcome) waitOutcome(); });
      scene.on('beat', () => { const c = root.querySelector('.chant'); if (c) { c.classList.remove('beat'); void c.offsetWidth; c.classList.add('beat'); } crowd.beat(); });
      scene.on('goal', () => crowd.roar(1));
      scene.on('chance', (o) => crowd.roar(o && o.rev ? 0.25 : 0.45));
      scene.setScore(myScore()[0], myScore()[1]);
      if (reducedMotion()) scene.pause();
    } catch (e) { console.warn('match scene', e); scene = null; }
  }
  function destroyScene() { if (scene) { try { scene.destroy(); } catch { /* ignore */ } } scene = null; sceneKey = ''; }
  function flash(text, cls) {
    const f = root.querySelector('.goal-flash');
    if (!f || reducedMotion()) return;
    f.querySelector('b').textContent = text;
    f.className = 'goal-flash ' + (cls || '');
    void f.offsetWidth;
    f.classList.add('show');
  }

  /* ---------------- score bug (crests + live clock) ---------------- */
  function shownScore() {
    if (RP && !RP.done) return m.isHome ? [RP.own, RP.opp] : [RP.opp, RP.own];
    return [m.score[0], m.score[1]];
  }
  function clockText() {
    if (RP && !RP.done) return RP.started ? mmss(RP.clock) : '00:00';
    if (m.phase === 'pre') return 'לפני הפתיחה';
    if (m.phase === 'ended') return 'סיום';
    return `${m.minute}'`;
  }
  function scoreboard() {
    const sc = shownScore();
    const live = (RP && !RP.done) || m.phase === 'live';
    return `<div class="mx-bug${m.big ? ' big' : ''}">
      <div class="mx-bug-comp"><b>${esc(m.compHe || '')}</b>${m.roundHe ? `<span>${esc(m.roundHe)}</span>` : ''}</div>
      <div class="mx-bug-main">
        <div class="mx-bug-team h${m.isHome ? ' mine' : ''}">${crest(m.home, 30)}<b>${esc(m.home && (m.home.shortHe || m.home.nameHe))}</b></div>
        <div class="mx-bug-score" data-testid="match-score"><b class="num mx-sc-h">${esc(sc[0])}</b><i>-</i><b class="num mx-sc-a">${esc(sc[1])}</b></div>
        <div class="mx-bug-team a${!m.isHome ? ' mine' : ''}"><b>${esc(m.away && (m.away.shortHe || m.away.nameHe))}</b>${crest(m.away, 30)}</div>
      </div>
      <div class="mx-bug-clock${live ? ' live' : ''}">${live ? '<span class="mx-live-dot"></span>' : ''}<span class="num mx-clock">${esc(clockText())}</span>${m.extraHe && !(RP && !RP.done) ? `<em>${esc(m.extraHe)}</em>` : ''}</div>
    </div>`;
  }
  function paintBug() { const s = root.querySelector('.sb-slot'); if (s) s.innerHTML = scoreboard(); }
  function paintScore(pop) {
    const sc = shownScore();
    const h = root.querySelector('.mx-sc-h'), a = root.querySelector('.mx-sc-a');
    if (!h || !a) { paintBug(); return; }
    const ch = h.textContent !== String(sc[0]), ca = a.textContent !== String(sc[1]);
    h.textContent = sc[0]; a.textContent = sc[1];
    if (pop) { const el = ch ? h : ca ? a : null; if (el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } }
    if (scene) scene.setScore(m.isHome ? sc[0] : sc[1], m.isHome ? sc[1] : sc[0]);
  }
  function paintClock() { const c = root.querySelector('.mx-clock'); if (c) c.textContent = clockText(); }

  /* ---------------- feed ---------------- */
  function evIcon(x) {
    if (x.ev === 'goal') return ico('ball', 'gold');
    if (x.ev === 'card') return ico('card', /אדום/.test(x.textHe) ? 'bad' : 'warn');
    return ico(EV_ICON[x.ev] || 'mega');
  }
  function feedRow(x) {
    const cls = x.ev === 'goal' ? (x.side === 'opp' ? 'k-goal_against' : 'k-goal_for') + (x.who === 'me' ? ' me' : '') : x.ev === 'sub' ? 'k-sub' : x.ev === 'moment' ? 'k-moment' : x.ev === 'card' ? 'k-card' : 'k-info';
    const minute = x.ev === 'kickoff' ? '' : (x.minute ? x.minute + "'" : '');
    let text = minute ? noMinute(x.textHe) : x.textHe;
    if (x.ev === 'sub' && x.who !== 'me' && (x.inHe || x.outHe) && !text) text = `חילוף: ${x.inHe} ${g('נכנס', 'נכנסת')}, ${x.outHe} ${g('יוצא', 'יוצאת')}`;
    return `<div class="feed-row mx-row ${cls}"><span class="mx-ico" aria-hidden="true">${evIcon(x)}</span><span class="fm num">${esc(minute)}</span><span class="grow">${esc(text)}</span></div>`;
  }
  function feedHtml(list) {
    if (!list.length) return '<div class="feed mx-feed" aria-live="polite"></div>';
    return `<div class="feed mx-feed" aria-live="polite">${list.slice().reverse().map(feedRow).join('')}</div>`;
  }
  function feedAdd(x) {
    if (!RP) return;
    RP.feed.push(x);
    const f = root.querySelector('.mx-feed');
    if (f) { f.insertAdjacentHTML('afterbegin', feedRow(x)); const r = f.firstElementChild; if (r) r.classList.add('new'); }
  }
  function lower(x, ms = 2600) {
    const el = root.querySelector('.mx-lower');
    if (!el || !x || !x.textHe) return;
    el.innerHTML = `<span class="mx-lower-min num">${esc(x.minute ? x.minute + "'" : 'LIVE')}</span><span class="mx-lower-ico">${evIcon(x)}</span><span class="mx-lower-t">${esc(x.minute ? noMinute(x.textHe) : x.textHe)}</span>`;
    el.className = 'mx-lower show ' + (x.ev === 'goal' ? (x.side === 'opp' ? 'opp' : 'own') : x.ev);
    clearTimeout(lower.t);
    lower.t = setTimeout(() => { if (el.isConnected) el.classList.remove('show'); }, ms / Math.max(1, speed / 1.5));
  }

  /* ---------------- broadcast overlays (DOM, on top of the canvas) ---------------- */
  function fxLayer() { return root.querySelector('.mx-fx'); }
  function fxAdd(html, cls, ms) {
    const L = fxLayer();
    if (!L) return null;
    const d = document.createElement('div');
    d.className = 'mx-fxi ' + cls;
    d.innerHTML = html;
    L.appendChild(d);
    const life = Math.max(700, ms / holdDiv());
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 420); }, life);
    return d;
  }
  function fxBanner(title, sub, cls, ms = 1700) {
    return fxAdd(`<div class="mx-banner-in"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`, 'mx-banner ' + (cls || ''), ms);
  }
  function scoreLine() { const sc = shownScore(); return `${(m.home && m.home.shortHe) || ''} ${sc[0]}-${sc[1]} ${(m.away && m.away.shortHe) || ''}`; }
  function numFor(name, salt) { return 12 + (hashStr(String(name || '') + '|' + (salt || '')) % 18); }
  function fxSubBoard(x) {
    const team = x.side === 'opp' ? oppTeam(m) : myTeam(m);
    const me = x.who === 'me';
    const inName = me && x.subOn ? P.name : x.inHe;
    const outName = me && !x.subOn ? P.name : x.outHe;
    const inNum = x.inNum || (me && x.subOn ? P.num : numFor(inName, x.minute));
    let outNum = x.outNum || (me && !x.subOn ? P.num : numFor(outName, x.minute + 1));
    if (outNum === inNum) outNum = inNum === 29 ? 12 : inNum + 1;
    const rows = [];
    if (inName || me) rows.push(`<div class="mxb-row in"><b class="mxb-num num">${esc(inNum)}</b><i class="mxb-arr">▲</i><span class="mxb-name">${esc(inName || '')}</span></div>`);
    if (outName || !me) rows.push(`<div class="mxb-row out"><b class="mxb-num num">${esc(outNum)}</b><i class="mxb-arr">▼</i><span class="mxb-name">${esc(outName || '')}</span></div>`);
    return fxAdd(`<div class="mxb-board" data-testid="sub-board"><div class="mxb-head">${crest(team, 22)}<span>חילוף · ${esc((team && team.shortHe) || '')}</span><span class="num">${esc(x.minute)}'</span></div>${rows.join('')}</div><div class="mxb-pole"></div>`, 'mx-subboard', 2500);
  }

  /* ---------------- views ---------------- */
  function venueLine() {
    if (m.neutral) return 'מגרש ניטרלי';
    const h = (m.home && (m.home.shortHe || m.home.nameHe)) || '';
    return m.isHome ? `משחק בית · מול הקהל שלנו` : `משחק חוץ · אצל ${h}`;
  }
  function statusHtml() {
    if (m.role === 'starter') return `<span class="mx-shirt num">${esc(P.num)}</span><span class="mx-st-t"><b>${esc(g('פותח בהרכב', 'פותחת בהרכב'))}</b><small>${esc(P.posHe || '')}${P.posHe ? ' · ' : ''}חולצה ${esc(P.num)}</small></span>`;
    return `<span class="mx-shirt bench num">${esc(P.num)}</span><span class="mx-st-t"><b>${esc(g('מתחיל על הספסל', 'מתחילה על הספסל'))}</b><small>${m.onMinute ? `המאמן יכניס אותך בסביבות הדקה ${esc(m.onMinute)}` : 'מחכים להזדמנות'}</small></span>`;
  }
  function preView() {
    const resuming = m.phase === 'live';
    const colors = teamColors(myTeam(m), ['#F4C35A', '#0B1E42']);
    return `<section class="card mx-pre match-pre">
      <div class="mx-pre-top"><span class="mx-onair pre"><i></i>יום משחק</span><span class="mx-pre-comp">${esc(m.compHe || '')}${m.roundHe ? ` · ${esc(m.roundHe)}` : ''}</span>${m.big ? '<span class="big-tag">⭐ משחק גדול</span>' : ''}</div>
      <div class="mx-vs">
        <div class="mx-side${m.isHome ? ' mine' : ''}">${crest(m.home, 64)}<b>${esc(m.home && (m.home.shortHe || m.home.nameHe))}</b><small>בית</small></div>
        <div class="mx-vs-mid"><span class="mx-vs-badge">VS</span><small>${esc(m.dateHe || '')}</small></div>
        <div class="mx-side${!m.isHome ? ' mine' : ''}">${crest(m.away, 64)}<b>${esc(m.away && (m.away.shortHe || m.away.nameHe))}</b><small>חוץ</small></div>
      </div>
      <div class="mx-venue">${ico('stadium')} ${esc(venueLine())}</div>
      <div class="mx-pre-grid">
        <div class="mx-status ${m.role === 'starter' ? 'starter' : 'bench'}">${statusHtml()}</div>
        ${formationSVG(P, colors, m.role === 'starter')}
      </div>
      ${m.introHe ? `<p class="intro mx-intro">${esc(gt(m.introHe))}</p>` : ''}
      <div class="btn-col mx-pre-btns">
        <button type="button" class="btn btn-primary btn-gold btn-xl" data-act="start" data-testid="btn-start-match">${resuming ? '▶ המשך לצפות' : '▶ שריקת פתיחה'}</button>
        <button type="button" class="btn btn-ghost" data-act="auto" data-testid="btn-autoplay">${ico('skip')}לתוצאה</button>
      </div></section>`;
  }
  function replayView() {
    return `<div class="mx-ctrl">
        <span class="mx-onair"><i></i>שידור חי</span>
        <div class="mx-speed" role="group" aria-label="מהירות שידור">${[1, 2, 4].map((v) => `<button type="button" class="${speed === v ? 'on' : ''}" data-act="speed" data-v="${v}" data-testid="speed-${v}" aria-pressed="${speed === v}">x${v}</button>`).join('')}</div>
        <button type="button" class="mx-skip" data-act="skipend" data-testid="btn-skip-end">${ico('skip')}לסיום</button>
      </div>
      ${feedHtml(RP ? RP.feed : [])}`;
  }

  // decisions mode (ctx.settings.decisions === true): the interactive key moments, unchanged
  function momentView() {
    const mo = m.moment;
    if (outcome) {
      const o = outcome;
      return `<section class="card moment outcome ${o.ok ? 'ok' : 'bad'}${o.goalFor ? ' goal' : ''}${o.goalAgainst ? ' conceded' : ''}" data-act="skip" data-testid="moment-outcome">
        <div class="oc-ico">${ico(CODE_ICON[o.code] || (o.ok ? 'check' : 'cross'), CODE_TONE[o.code] || (o.ok ? 'good' : 'bad'))}</div>
        <p class="oc-text">${esc(gt(o.textHe))}</p>
        <span class="oc-delta num ${o.ratingDelta >= 0 ? 'up' : 'down'}">${esc(signed(o.ratingDelta, 1))} לציון</span>
        <span class="muted small">${esc(g('גע כדי להמשיך', 'געי כדי להמשיך'))}</span>
      </section>`;
    }
    if (!mo) return '';
    return `<section class="card moment">
      <div class="mo-head"><span class="chip side-${esc(mo.side)}">${esc(SIDE_HE[mo.side] || '')}</span><span class="num mo-min">${esc(mo.minute)}'</span>
        <span class="muted small">רגע ${esc((m.momentIndex || 0) + 1)} מתוך ${esc(m.momentsTotal || 0)}</span></div>
      <p class="mo-text">${esc(gt(mo.textHe))}</p>
      <div class="mo-opts">${(mo.options || []).map((o) => `<button type="button" class="btn mo-opt" data-act="opt" data-i="${esc(o.index)}" data-testid="moment-opt-${esc(o.index)}">
        <span class="grow">${esc(gt(o.he))}</span>${oddsChip(o.odds, o.oddsHe)}</button>`).join('')}</div>
    </section>`;
  }
  function liveView() {
    const evs = normEvents(m, P);
    return `${momentView()}
      <div class="rating-so-far">ציון עד עכשיו: ${ratingChip(m.ratingSoFar) || '<b>6.0</b>'}</div>
      ${feedHtml(evs)}
      <button type="button" class="btn btn-ghost" data-act="auto" data-testid="btn-autoplay" ${outcome ? 'disabled' : ''}>${ico('ff')}שחק אוטומטית את שאר המשחק</button>`;
  }

  function goalsOf(src) {
    const structured = (src.log || []).some((e) => e && e.ev);
    const evs = (!structured && lastEvs ? lastEvs : normEvents(src, P)).filter((x) => x.ev === 'goal');
    const home = [], away = [];
    for (const x of evs) {
      const isHomeGoal = (x.side !== 'opp') === !!src.isHome;
      const team = isHomeGoal ? src.home : src.away;
      const who = x.who === 'me' ? P.name : (x.scorerHe || (team && team.shortHe) || '');
      (isHomeGoal ? home : away).push({ minute: x.minute, who, me: x.who === 'me' });
    }
    return { home, away };
  }
  function scorersHtml(src) {
    const { home, away } = goalsOf(src);
    if (!home.length && !away.length) return '<div class="mx-scorers none">בלי שערים</div>';
    const col = (list) => `<ul>${list.map((s) => `<li class="${s.me ? 'me' : ''}"><span class="num">${esc(s.minute)}'</span> ${ico('ball')} ${esc(s.who)}</li>`).join('')}</ul>`;
    return `<div class="mx-scorers">${col(home)}${col(away)}</div>`;
  }
  function endedView() {
    const sc = [m.score[0], m.score[1]];
    const feedList = RP ? RP.feed : normEvents(m, P);
    return `<section class="card match-ended mx-ft">
      <div class="mx-ft-tag">שריקת סיום</div>
      <div class="mx-ft-score">
        <div class="mx-side${m.isHome ? ' mine' : ''}">${crest(m.home, 48)}<b>${esc(m.home && m.home.shortHe)}</b></div>
        <div class="mx-ft-num num"><b>${esc(sc[0])}</b><i>-</i><b>${esc(sc[1])}</b></div>
        <div class="mx-side${!m.isHome ? ' mine' : ''}">${crest(m.away, 48)}<b>${esc(m.away && m.away.shortHe)}</b></div>
      </div>
      ${m.extraHe ? `<div class="mx-ft-extra">${esc(m.extraHe)}</div>` : ''}
      ${scorersHtml(m)}
      <button type="button" class="btn btn-primary btn-gold btn-xl" data-act="finish" data-testid="btn-finish-match">סיכום המשחק</button>
      ${!decisions && !RP ? '<button type="button" class="btn btn-ghost" data-act="replay" data-testid="btn-replay">▶ לשידור החוזר</button>' : ''}
    </section>${feedHtml(feedList)}`;
  }

  function ring(r) {
    const v = Math.max(0, Math.min(10, Number(r) || 0));
    const tone = v >= 8 ? '#F4C35A' : v >= 7 ? '#34D399' : v >= 6 ? '#7DF0E2' : '#FF5A6E';
    const C = 2 * Math.PI * 42, len = (v / 10) * C;
    return `<div class="mx-ring" style="--tone:${tone}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" class="trk"/>
      <circle cx="50" cy="50" r="42" class="val" stroke="${tone}" stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
      <div class="mx-ring-v"><b class="num">${esc(rating(v))}</b><small>הציון שלך</small></div></div>`;
  }
  function summaryView() {
    const s = summary;
    const src = { isHome: s.isHome, score: s.score, home: s.home, away: s.away, log: s.log || [], big: false };
    const stat = (label, value, cls = '') => `<div class="mx-stat ${cls}"><b class="num">${esc(value)}</b><small>${esc(label)}</small></div>`;
    return `<div data-testid="match-summary" class="match-summary mx-sum">
      <section class="card ms-head mx-sum-head ${s.res ? 'res-' + esc(s.res) : ''}">
        <div class="mx-sum-tag"><span class="mx-onair ft"><i></i>סיום</span><span>${esc(s.compHe || '')}${s.roundHe ? ' · ' + esc(s.roundHe) : ''}</span></div>
        <div class="mx-ft-score">
          <div class="mx-side${s.isHome ? ' mine' : ''}">${crest(s.home, 56)}<b>${esc(s.home && s.home.shortHe)}</b></div>
          <div class="mx-ft-num num"><b>${esc(s.score[0])}</b><i>-</i><b>${esc(s.score[1])}</b></div>
          <div class="mx-side${!s.isHome ? ' mine' : ''}">${crest(s.away, 56)}<b>${esc(s.away && s.away.shortHe)}</b></div>
        </div>
        <div class="chips center">${resChip(s.res)}${s.extraHe ? `<span class="chip">${esc(s.extraHe)}</span>` : ''}${s.motm ? `<span class="chip gold">${ico('star')} ${esc(g('מצטיין המשחק', 'מצטיינת המשחק'))}</span>` : ''}${s.cleanSheet ? '<span class="chip good">' + ico('shield') + ' שער נקי</span>' : ''}</div>
        ${scorersHtml(src)}
        ${s.tieHe ? `<p class="note good">${esc(gt(s.tieHe))}</p>` : ''}
        ${s.injuryHe ? `<p class="note warn">${ico('medic', 'bad')} ${esc(gt(s.injuryHe))}</p>` : ''}
      </section>
      <section class="card mx-sum-me">
        <div class="mx-sum-me-head"><span class="mx-shirt num">${esc(P.num)}</span><b>${esc(P.name)}</b>${ratingChip(s.rating)}</div>
        <div class="mx-sum-grid">${ring(s.rating)}
          <div class="mx-stats">${stat('דקות', s.minutes ?? 0)}${stat('שערים', s.goals ?? 0, s.goals ? 'hi' : '')}${stat('בישולים', s.assists ?? 0, s.assists ? 'hi' : '')}${stat(g('מצטיין', 'מצטיינת'), s.motm ? '⭐' : '-', s.motm ? 'hi' : '')}</div>
        </div>
        ${(s.effectsHe || []).length ? `<div class="chips">${s.effectsHe.map((t) => `<span class="chip">${esc(gt(t))}</span>`).join('')}</div>` : ''}
      </section>
      ${(s.momentsHe || []).length ? `<section class="card"><h2 class="card-title">הרגעים שלך</h2>${s.momentsHe.map((x) => `<div class="feed-row ${x.ok ? 'k-goal_for' : 'k-goal_against'}"><span class="fm num">${esc(x.minute)}'</span><span>${x.ok ? ico('check', 'good') : ico('cross', 'bad')} ${esc(gt(x.textHe))}</span></div>`).join('')}</section>` : ''}
      <button type="button" class="btn btn-primary btn-gold btn-xl" data-act="continue" data-testid="btn-match-continue">המשך</button>
    </div>`;
  }

  function draw() {
    if (!alive) return;
    if (summary) { destroyScene(); crowd.silence(); root.innerHTML = summaryView(); return; }
    ensureScene();
    let phase, body;
    if (RP && !RP.done) { phase = 'replay'; body = replayView(); }
    else if (m.phase === 'pre' || (!decisions && m.phase === 'live')) { phase = 'pre'; body = preView(); }
    else if (m.phase === 'ended') { phase = 'ended'; body = endedView(); }
    else { phase = 'live'; body = liveView(); }
    const shell = root.querySelector('.match-shell');
    shell.className = 'match match-shell mx phase-' + phase + (decisions ? ' decisions' : '');
    paintBug();
    root.querySelector('.match-body').innerHTML = body;
  }

  /* ---------------- watch-mode replay engine ---------------- */
  function holdDiv() { return speed >= 4 ? 2.4 : speed >= 2 ? 1.5 : 1; }
  function sceneSpeed() { return speed >= 4 ? 2 : speed >= 2 ? 1.45 : 1; }
  function hold(ms) {
    return new Promise((resolve) => {
      if (!RP || RP.skipping) { resolve(); return; }
      const done = () => { clearTimeout(t); if (RP) RP.waits.delete(done); resolve(); };
      const t = setTimeout(done, ms / holdDiv());
      RP.waits.add(done);
    });
  }
  function waitScene(ms) {
    return new Promise((resolve) => {
      if (!RP || RP.skipping || !scene) { resolve(); return; }
      const done = () => { clearTimeout(t); if (waitOutcome === done) waitOutcome = null; if (RP) RP.waits.delete(done); resolve(); };
      const t = setTimeout(done, ms / sceneSpeed());
      waitOutcome = done;
      RP.waits.add(done);
    });
  }
  function releaseWaits() { if (RP) [...RP.waits].forEach((f) => f()); }
  const stopped = () => !alive || !RP || RP.skipping;

  function startReplay() {
    RP = { evs: normEvents(m, P), i: 0, clock: 0, end: 90, own: 0, opp: 0, feed: [], busy: false, done: false, started: true,
      last: performance.now(), timer: 0, waits: new Set(), skipping: false, heroOn: m.role === 'starter' };
    RP.end = RP.evs.some((x) => x.ev === 'et' || x.at > 90.5) ? 120 : 90;
    if (scene) { scene.setHeroOn(RP.heroOn); scene.setSpeed(sceneSpeed()); scene.setScore(0, 0); }
    draw();
    RP.timer = setInterval(tick, 100);
  }
  function tick() {
    if (!alive || !RP || RP.done) return;
    const now = performance.now();
    const dt = Math.min(0.25, (now - RP.last) / 1000);
    RP.last = now;
    if (RP.busy) return;
    const target = Math.min(RP.end, RP.clock + dt * MIN_PER_SEC * speed);
    while (RP.i < RP.evs.length && RP.evs[RP.i].at <= target) {
      const x = RP.evs[RP.i++];
      RP.clock = Math.max(RP.clock, x.at);
      if (blocking(x)) {
        RP.busy = true; RP.cur = x;
        paintClock();
        runEvent(x).catch((e) => console.warn('match replay', e)).finally(() => { if (RP) { RP.busy = false; RP.cur = null; RP.last = performance.now(); } });
        return;
      }
      instant(x);
    }
    RP.clock = target;
    paintClock();
    if (RP.i >= RP.evs.length && RP.clock >= RP.end) finishReplay();
  }
  function blocking(x) { return x.ev === 'kickoff' || x.ev === 'goal' || x.ev === 'sub' || x.ev === 'ht' || x.ev === 'et' || x.ev === 'pens' || x.ev === 'ft'; }
  function instant(x) {
    x.applied = true;
    feedAdd(x);
    lower(x);
    if (x.ev === 'card') buzz(15);
    if (x.ev === 'moment' && scene && !reducedMotion() && x.who !== 'opp' && (hashStr(x.textHe) % 3 === 0)) {
      scene.say(pick([g('יאללה, תן לו!', 'יאללה, תני לה!'), 'תזיזו את הכדור!', 'קדימה! לחץ גבוה!', 'ככה! עוד!'], hashStr(x.textHe)), 'shout');
    }
  }
  function applyGoal(x) {
    if (x.applied) return;
    x.applied = true;
    RP.own = x.own; RP.opp = x.opp;
    if (x.who === 'me' && scene) scene.setHeroOn(true);
    feedAdd(x);
    lower(x, 3400);
    paintScore(true);
  }
  function applySub(x) {
    if (x.applied) return;
    x.applied = true;
    if (x.who === 'me') { RP.heroOn = !!x.subOn; if (scene) scene.setHeroOn(RP.heroOn); }
    feedAdd(x);
    lower(x);
  }
  async function runEvent(x) {
    const fast = speed >= 4 || reducedMotion() || !scene;
    switch (x.ev) {
      case 'kickoff':
        x.applied = true; feedAdd(x); lower(x, 3000); whistle(1, true);
        fxBanner('שריקת פתיחה', scoreLine(), 'kickoff', 1300);
        await hold(1300);
        break;
      case 'ht':
        x.applied = true; feedAdd(x); whistle(2, true);
        fxBanner('מחצית', scoreLine(), 'ht', 1800);
        if (scene) scene.say(pick(['לחדר ההלבשה! יש לנו מה לתקן', 'מחצית טובה. ממשיכים ככה!', 'עוד 45 דקות. מרוכזים!'], RP.own * 3 + RP.opp), 'shout');
        await hold(1900);
        break;
      case 'et':
        x.applied = true; feedAdd(x); whistle(1, true);
        fxBanner('הארכה', '30 דקות נוספות', 'et', 1600);
        await hold(1700);
        break;
      case 'pens':
        x.applied = true; feedAdd(x); lower(x, 3200);
        fxBanner('פנדלים!', x.textHe, 'pens', 2600);
        buzz([30, 60, 30]);
        await hold(2700);
        break;
      case 'ft':
        x.applied = true; feedAdd(x); whistle(3, true);
        fxBanner('שריקת סיום', scoreLine(), 'ft', 1600);
        await hold(1500);
        if (!stopped()) finishReplay();
        break;
      case 'sub':
        applySub(x);
        fxSubBoard(x);
        if (x.who === 'me') {
          fxBanner(x.subOn ? 'נכנסת למגרש!' : 'יצאת מהמגרש', x.subOn ? `${P.name} · חולצה ${P.num}` : g('הקהל מוחא לך כפיים', 'הקהל מוחא לך כפיים'), x.subOn ? 'me-in' : 'me-out', 2300);
          if (x.subOn) { buzz([30, 30, 60]); crowd.roar(0.5); if (scene) scene.say(g('יאללה ילד, תראה להם!', 'יאללה ילדה, תראי להם!'), 'shout'); }
          await hold(2500);
        } else await hold(fast ? 1500 : 1700);
        break;
      case 'goal':
        await doGoal(x, fast);
        break;
      default:
        instant(x);
    }
  }
  async function doGoal(x, fast) {
    const own = x.side !== 'opp';
    if (!fast) {
      scene.setSpeed(sceneSpeed());
      if (x.who === 'me') scene.setHeroOn(true);
      const type = SHOT_TYPES[hashStr(x.textHe + '|' + x.minute) % SHOT_TYPES.length];
      scene.play(type, 'goal', own ? { side: 'home', scorer: x.who === 'me' ? 'hero' : 'mate' } : { side: 'away' });
      await waitScene(9500);
      if (stopped()) return;
    } else if (scene && !reducedMotion()) scene.react(own ? 'goal' : 'concede');
    applyGoal(x);
    if (own) {
      buzz(x.mega ? [60, 40, 60, 40, 220] : [40, 40, 120]);
      await celebrateGoal(x);
    } else {
      buzz(35);
      const op = oppTeam(m);
      fxAdd(`<div class="mx-concede-in">${crest(op, 40)}<div><b>גול ל${esc((op && op.shortHe) || 'יריבה')}</b><span>${esc(scoreLine())}</span></div></div>`, 'mx-concede', 1700);
      await hold(1800);
    }
  }
  async function celebrateGoal(x) {
    const me = x.who === 'me';
    const team = myTeam(m);
    const colors = teamColors(team, ['#F4C35A', '#0B1E42']);
    const kind = x.mega ? 'mega' : 'goal';
    const textHe = me || x.big || x.mega ? 'גוללללל!' : 'גול!';
    const subHe = me ? `${P.name} · ${x.minute}'` : `${x.scorerHe || (team && team.shortHe) || ''} · ${x.minute}'`;
    if (celebrateFn && !reducedMotion()) {
      let p = null;
      try { p = celebrateFn({ kind, textHe, subHe, colors }); } catch (e) { console.warn('celebrate', e); }
      if (p && typeof p.then === 'function') {
        await Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, kind === 'mega' ? 6000 : 4500)), new Promise((r) => { if (RP) RP.waits.add(r); })]);
        return;
      }
    }
    flash(textHe, x.mega ? 'mega' : '');
    fxBanner(textHe, subHe, 'goal' + (x.mega ? ' mega' : ''), x.mega ? 2600 : 1900);
    await hold(x.mega ? 2600 : 1900);
  }
  function finishReplay() {
    if (!RP || RP.done) return;
    clearInterval(RP.timer);
    RP.done = true;
    RP.clock = RP.end;
    releaseWaits();
    if (scene) { scene.setSpeed(1); scene.setHeroOn(true); }
    draw();
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
  }
  function skipToEnd() {
    if (!RP || RP.done) return;
    RP.skipping = true;
    releaseWaits();
    const cur = RP.cur;
    const rest = [cur, ...RP.evs.slice(RP.i)].filter(Boolean);
    RP.i = RP.evs.length;
    for (const x of rest) {
      if (x.applied) continue;
      x.applied = true;
      if (x.ev === 'goal') { RP.own = x.own; RP.opp = x.opp; }
      if (x.ev === 'sub' && x.who === 'me') RP.heroOn = !!x.subOn;
      RP.feed.push(x);
    }
    whistle(3, true);
    finishReplay();
  }
  function setSpeed(v) {
    speed = v === 4 ? 4 : v === 2 ? 2 : 1;
    if (scene) scene.setSpeed(sceneSpeed());
    root.querySelectorAll('.mx-speed button').forEach((b) => { const on = Number(b.dataset.v) === speed; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  }

  /* ---------------- decisions mode: one key moment ---------------- */
  const wait = (ms) => new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); skipWait = null; resolve(); }
    skipWait = done;
  });
  async function choose(i) {
    if (busy) return;
    busy = true;
    buzz(15);
    const r = call(() => game.chooseMoment(i));
    if (!r) { busy = false; m = call(() => game.getMatch(), { quiet: true }); if (!m) { navigate('#/hub'); return; } draw(); return; }
    const mo = m.moment;
    const opt = mo && (mo.options || []).find((x) => x.index === i);
    const o = r.outcome;
    // lock the choices while the play happens on the pitch
    const picked = root.querySelector(`[data-testid="moment-opt-${i}"]`);
    if (picked) picked.classList.add('picked');
    const opts = root.querySelector('.mo-opts');
    if (opts) {
      opts.classList.add('locked');
      opts.querySelectorAll('.mo-opt').forEach((b) => { b.disabled = true; b.removeAttribute('data-testid'); });
    }
    const n = (m.minute || 0) + i;
    const SAY_GOOD = ['כל הכבוד!', 'ככה! ככה משחקים!', g('איזה ילד!', 'איזו ילדה!')];
    const SAY_BAD = [g('מה אתה עושה?!', 'מה את עושה?!'), g('תתעורר!', 'תתעוררי!'), 'נו באמת!'];
    const SAY_DEF_GOOD = ['איזה תיקול!', 'ככה מגינים!', g('אתה קיר!', 'את קיר!')];
    if (scene && !reducedMotion() && o) {
      if (mo && mo.side === 'att' && SHOT_CODES.has(o.code)) {
        const key = opt && opt.key;
        const type = CROSS_KEYS.has(key) ? 'cross' : PASS_KEYS.has(key) ? 'cutback' : 'dribble_shot';
        const res = o.goalFor ? 'goal' : o.code === 'MISS' ? 'miss' : 'save';
        scene.say({ cross: 'תרים! תרים לרחבה!', cutback: 'תסתכל לצדדים! יש לך!', dribble_shot: g('יאללה, תן לו!', 'יאללה, תני לה!') }[type], 'shout');
        scene.play(type, res);
        await new Promise((resolve) => {
          const t = setTimeout(done, 7000);
          function done() { clearTimeout(t); waitOutcome = null; skipWait = null; resolve(); }
          waitOutcome = done; skipWait = done;
        });
      } else {
        if (o.goalAgainst) scene.say(pick(SAY_BAD, n), 'angry');
        else if (mo && mo.side !== 'att') scene.say(o.ok ? pick(SAY_DEF_GOOD, n) : pick(SAY_BAD, n), o.ok ? 'happy' : 'angry');
        else scene.say(o.ok ? pick(SAY_GOOD, n) : pick(SAY_BAD, n), o.ok ? 'happy' : 'angry');
        if (o.ok) crowd.roar(0.4);
      }
    }
    outcome = o;
    m = r.match;
    draw();
    if (scene) scene.setScore(myScore()[0], myScore()[1]);
    if (outcome && outcome.goalFor) {
      buzz([40, 40, 120]);
      if (celebrateFn && !reducedMotion()) { try { celebrateFn({ kind: 'goal', textHe: 'גוללללל!', subHe: P.name, colors: teamColors(myTeam(m), ['#F4C35A', '#0B1E42']) }); } catch { flash('גול!'); } } else flash('גול!');
    } else if (outcome && outcome.code === 'SAVE' && mo && mo.side === 'gk') flash('הצלה!', 'save');
    await wait(reducedMotion() ? 600 : (outcome && (outcome.goalFor || outcome.goalAgainst) ? 1700 : 1200));
    outcome = null;
    busy = false;
    draw();
  }

  function cont() {
    if (busy) return;
    busy = true;
    const r = call(() => game.resumeWeek());
    busy = false;
    if (r && r.ok && r.status === 'match') { m = r.match; summary = null; outcome = null; RP = null; draw(); try { window.scrollTo(0, 0); } catch { /* ignore */ } return; }
    if (r && r.ok && r.status === 'done') { ctx.pendingSummary = r.summary; navigate('#/hub'); return; }
    if (r && !r.ok && r.error === 'busy') {
      const lm = call(() => game.getMatch(), { quiet: true });
      if (lm) { m = lm; summary = null; RP = null; draw(); return; }
    }
    if (r && !r.ok && r.messageHe && r.error !== 'no_week') toast(r.messageHe);
    navigate('#/hub');
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'skip') { if (skipWait) skipWait(); else if (RP && !RP.done && RP.busy) releaseWaits(); return; }
    if (act === 'mute') { crowd.setSound(!crowd.isOn()); paintMute(); return; }
    if (act === 'speed') { setSpeed(Number(b.dataset.v)); return; }
    if (act === 'skipend') { skipToEnd(); return; }
    if (busy) return;
    if (act === 'start') {
      if (decisions) {
        const r = call(() => game.startMatch());
        if (r) { m = r; draw(); }
      } else if (!RP || RP.done) {
        const r = call(() => game.autoPlayMatch());
        if (r) { m = r; startReplay(); }
      }
    } else if (act === 'replay') {
      if (!RP && m.phase === 'ended') startReplay();
    } else if (act === 'auto') {
      const r = call(() => game.autoPlayMatch());
      if (r) { m = r; outcome = null; if (RP) { clearInterval(RP.timer); RP = null; } draw(); if (scene) scene.setScore(myScore()[0], myScore()[1]); }
    } else if (act === 'opt') {
      choose(Number(b.dataset.i));
    } else if (act === 'finish') {
      if (RP && !RP.done) skipToEnd();
      try { lastEvs = normEvents(m, P); } catch { lastEvs = null; }
      const s = call(() => game.finishMatch());
      if (s) {
        summary = s; RP = null; draw(); try { window.scrollTo(0, 0); } catch { /* ignore */ }
        // a won final gets the full trophy celebration (C9); a won big match gets the win burst
        const wonFinal = s.final && (s.res === 'W' || /זכיתם בגמר/.test(s.tieHe || ''));
        if (celebrateFn && !reducedMotion() && (wonFinal || (s.big && s.res === 'W'))) {
          try {
            celebrateFn({ kind: wonFinal ? 'trophy' : 'win', textHe: wonFinal ? g('אלופים!', 'אלופות!') : 'ניצחון!',
              subHe: `${(s.compHe || '').trim()}${s.roundHe && !wonFinal ? ' · ' + s.roundHe : ''}`, colors: teamColors(s.isHome ? s.home : s.away, ['#F4C35A', '#0B1E42']) });
          } catch (e) { console.warn('celebrate', e); }
        }
      }
      else { const lm = call(() => game.getMatch(), { quiet: true }); if (lm) { m = lm; draw(); } else navigate('#/hub'); }
    } else if (act === 'continue') cont();
  });

  window.__hyMatchDebug = {
    speed: (n) => setSpeed(Number(n)),
    skipToEnd: () => skipToEnd(),
    state: () => ({ phase: summary ? 'summary' : RP && !RP.done ? 'replay' : m.phase, clock: RP ? RP.clock : null, event: RP ? RP.i : null, events: RP ? RP.evs.length : null, speed, busy: !!(RP && RP.busy), score: shownScore() }),
    scene: () => scene,
    events: () => normEvents(m, P).map((x) => ({ minute: x.minute, ev: x.ev, who: x.who, side: x.side, big: !!x.big, mega: !!x.mega, textHe: x.textHe })),
  };

  if (crowd.soundWanted()) crowd.setSound(true);
  draw();
  optReady.then(() => { if (!alive || summary) return; if (RP && !RP.done) paintBug(); else draw(); });
  return () => {
    alive = false;
    if (skipWait) skipWait();
    if (RP) { clearInterval(RP.timer); releaseWaits(); }
    destroyScene();
    crowd.silence();
    if (window.__hyMatchDebug) delete window.__hyMatchDebug;
  };
}
