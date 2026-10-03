// match.js: #/match. Live match with key moments, commentary, auto-play, summary. Never shows ads.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, call, toast, buzz, reducedMotion } from './app.js';
import { navigate } from './router.js';
import { badge, oddsChip, ratingChip, resChip, statGrid } from './components.js';
import { rating, signed } from './format.js';
import { createMatchScene } from './scene/match-scene.js';
import * as crowd from './scene/crowd-audio.js';

// How a chosen option is acted out on the live pitch.
const CROSS_KEYS = new Set(['whipped_cross', 'take_on_cross', 'to_box', 'knock_down', 'power_header', 'placed_header', 'long_ball']);
const PASS_KEYS = new Set(['cutback', 'pass_wide', 'killer_pass', 'one_two', 'line_break']);
const SHOT_CODES = new Set(['GOAL', 'ASSIST', 'MISS', 'SAVE']);
const SAY_GOOD = ['כל הכבוד!', 'ככה! ככה משחקים!', 'איזה ילד!'];
const SAY_BAD = ['מה אתה עושה?!', 'תתעורר!', 'נו באמת!'];
const SAY_DEF_GOOD = ['איזה תיקול!', 'ככה מגינים!', 'אתה קיר!'];
const pick = (a, n) => a[Math.abs(n | 0) % a.length];
const safeHex = (c, d) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : d);
const ICON_SND_ON = '<svg class="i" viewBox="0 0 24 24"><path d="M4 9.2h3.6L12.5 5v14l-4.9-4.2H4Z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2"/></svg>';
const ICON_SND_OFF = '<svg class="i" viewBox="0 0 24 24"><path d="M4 9.2h3.6L12.5 5v14l-4.9-4.2H4Z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>';
const ICON_DRUM = '<svg class="i" viewBox="0 0 24 24"><ellipse cx="12" cy="10" rx="7.5" ry="3"/><path d="M4.5 10v5.5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V10M7.5 3.5l3 5M16.5 3.5l-3 5"/></svg>';

const SIDE_HE = { att: 'התקפה', def: 'הגנה', gk: 'שער' };
const CODE_ICON = { GOAL: '⚽', ASSIST: '🅰️', CHANCE: '👍', MISS: '😬', LOST: '😕', WON: '💪', BEATEN: '😣', CONCEDED: '🥅', SAVE: '🧤', GK_CONCEDED: '🥅', CARD: '🟨' };

export function render(root) {
  let m = call(() => game.getMatch(), { quiet: true });
  let summary = null;
  let outcome = null;
  let busy = false;
  let skipWait = null;
  if (!m) { navigate('#/hub', { replace: true }); return; }
  let scene = null;
  let sceneKey = '';
  let waitOutcome = null;

  function kit(t, fallback) {
    const c = (t && Array.isArray(t.colors) ? t.colors : null) || fallback;
    const a = safeHex(c[0], fallback[0]), b = safeHex(c[1], fallback[1]);
    return { name: (t && (t.shortHe || t.nameHe)) || '', shirt: a, shorts: b, socks: a, trim: b, gk: '#22C55E', fans: [a, a, b, '#F4F4F4'] };
  }
  function heroName() {
    try { const n = game.getSaveMeta().name || ''; return n.split(' ').slice(-1)[0] || n; } catch { return ''; }
  }
  function ensureShell() {
    if (root.querySelector('.match-shell')) return;
    root.innerHTML = `<div data-testid="match" class="match match-shell">
      <div class="pitch-wrap" data-act="skip">
        <canvas class="match-canvas" aria-label="המשחק בשידור חי"></canvas>
        <div class="sb-slot"></div>
        <div class="hud-top"><div class="chant"><span class="drum" aria-hidden="true">${ICON_DRUM}</span><span>אוהדים: <em class="chant-t"></em></span></div>
          <button type="button" class="mute" data-act="mute" data-testid="btn-sound" aria-label="צליל קהל"></button></div>
        <div class="goal-flash" aria-hidden="true"><b>גול!</b></div>
      </div>
      <div class="match-body"></div></div>`;
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
    const me = m.isHome ? m.home : m.away, op = m.isHome ? m.away : m.home;
    const key = (me && (me.id || me.nameHe)) + '|' + (op && (op.id || op.nameHe));
    if (scene && sceneKey === key) return;
    destroyScene();
    const home = kit(me, ['#F4C35A', '#0B1E42']);
    const away = kit(op, ['#E8ECF4', '#17181C']);
    if (away.shirt.toLowerCase() === home.shirt.toLowerCase()) { away.shirt = away.shorts; away.socks = away.shorts; }
    const chant = `יאללה יאללה ${home.name || 'הקבוצה'}!`;
    const ct = root.querySelector('.chant-t');
    if (ct) ct.textContent = '"' + chant + '"';
    try {
      scene = createMatchScene(root.querySelector('.match-canvas'), { home, away, chant, hero: heroName(), seed: (m.minute || 0) + m.score[0] * 7 + 3, ambientGoals: false });
      sceneKey = key;
      scene.on('outcome', () => { if (waitOutcome) waitOutcome(); });
      scene.on('beat', () => { const c = root.querySelector('.chant'); if (c) { c.classList.remove('beat'); void c.offsetWidth; c.classList.add('beat'); } crowd.beat(); });
      scene.on('goal', () => crowd.roar(1));
      scene.on('chance', () => crowd.roar(0.45));
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

  function scoreboard() {
    const minute = m.phase === 'pre' ? 'לפני הפתיחה' : m.phase === 'ended' ? 'סיום' : `${m.minute}'`;
    return `<div class="scorebug${m.big ? ' big' : ''}">
      <div class="sb-comp"><span>${esc(m.compHe || '')}</span>${m.roundHe ? `<span class="muted">· ${esc(m.roundHe)}</span>` : ''}</div>
      <div class="sb-main">
        <div class="sb-team${m.isHome ? ' mine' : ''}">${badge(m.home, 'l')}<b>${esc(m.home && (m.home.shortHe || m.home.nameHe))}</b></div>
        <div class="sb-center"><div class="sb-score" data-testid="match-score"><b class="num">${esc(m.score[0])}</b><i>-</i><b class="num">${esc(m.score[1])}</b></div>
          <span class="sb-min num">${esc(minute)}</span></div>
        <div class="sb-team${!m.isHome ? ' mine' : ''}">${badge(m.away, 'l')}<b>${esc(m.away && (m.away.shortHe || m.away.nameHe))}</b></div>
      </div>
      ${m.extraHe ? `<div class="sb-extra">${esc(m.extraHe)}</div>` : ''}
    </div>`;
  }

  function feed() {
    const log = (m.log || []).slice().reverse();
    if (!log.length) return '';
    return `<div class="feed" aria-live="polite">${log.map((l) => `<div class="feed-row k-${esc(l.kind)}"><span class="fm num">${l.minute ? esc(l.minute) + "'" : '📣'}</span><span>${esc(l.textHe)}</span></div>`).join('')}</div>`;
  }

  function preView() {
    return `<section class="card match-pre">
      <div class="chips"><span class="chip ${m.role === 'starter' ? 'sel-starter' : 'sel-bench'}">${esc(m.roleHe || (m.role === 'starter' ? 'בהרכב' : 'על הספסל'))}</span>
        ${m.role === 'bench' && m.onMinute ? `<span class="chip">נכנס בדקה ${esc(m.onMinute)}</span>` : ''}${m.big ? '<span class="big-tag">⭐ משחק גדול</span>' : ''}</div>
      <p class="intro">${esc(m.introHe || '')}</p>
      <div class="muted small">${esc(m.dateHe || '')}</div>
      <div class="btn-col">
        <button type="button" class="btn btn-primary btn-xl" data-act="start" data-testid="btn-start-match">יאללה! ⚽</button>
        <button type="button" class="btn" data-act="auto" data-testid="btn-autoplay">שחק אוטומטית ⏩</button>
      </div></section>`;
  }

  function momentView() {
    const mo = m.moment;
    if (outcome) {
      const o = outcome;
      return `<section class="card moment outcome ${o.ok ? 'ok' : 'bad'}${o.goalFor ? ' goal' : ''}${o.goalAgainst ? ' conceded' : ''}" data-act="skip" data-testid="moment-outcome">
        <div class="oc-ico">${esc(CODE_ICON[o.code] || (o.ok ? '✅' : '❌'))}</div>
        <p class="oc-text">${esc(o.textHe)}</p>
        <span class="oc-delta num ${o.ratingDelta >= 0 ? 'up' : 'down'}">${esc(signed(o.ratingDelta, 1))} לציון</span>
        <span class="muted small">גע כדי להמשיך</span>
      </section>`;
    }
    if (!mo) return '';
    return `<section class="card moment">
      <div class="mo-head"><span class="chip side-${esc(mo.side)}">${esc(SIDE_HE[mo.side] || '')}</span><span class="num mo-min">${esc(mo.minute)}'</span>
        <span class="muted small">רגע ${esc((m.momentIndex || 0) + 1)} מתוך ${esc(m.momentsTotal || 0)}</span></div>
      <p class="mo-text">${esc(mo.textHe)}</p>
      <div class="mo-opts">${(mo.options || []).map((o) => `<button type="button" class="btn mo-opt" data-act="opt" data-i="${esc(o.index)}" data-testid="moment-opt-${esc(o.index)}">
        <span class="grow">${esc(o.he)}</span>${oddsChip(o.odds, o.oddsHe)}</button>`).join('')}</div>
    </section>`;
  }

  function liveView() {
    return `${momentView()}
      <div class="rating-so-far">ציון עד עכשיו: ${ratingChip(m.ratingSoFar) || '<b>6.0</b>'}</div>
      ${feed()}
      <button type="button" class="btn btn-ghost" data-act="auto" data-testid="btn-autoplay" ${outcome ? 'disabled' : ''}>שחק אוטומטית את שאר המשחק ⏩</button>`;
  }

  function endedView() {
    return `<section class="card match-ended">
      <h2 class="card-title">שריקת הסיום</h2>
      ${m.extraHe ? `<p>${esc(m.extraHe)}</p>` : ''}
      <div class="rating-so-far">הציון שלך: ${ratingChip(m.ratingSoFar)}</div>
      <button type="button" class="btn btn-primary btn-xl" data-act="finish" data-testid="btn-finish-match">סיכום המשחק</button>
    </section>${feed()}`;
  }

  function summaryView() {
    const s = summary;
    return `<div data-testid="match-summary" class="match-summary">
      <section class="card ms-head ${s.res ? 'res-' + esc(s.res) : ''}">
        <div class="ms-teams"><span>${badge(s.home)}<b>${esc(s.home && s.home.shortHe)}</b></span>
          <span class="sb-score"><b class="num">${esc(s.score[0])}</b><i>-</i><b class="num">${esc(s.score[1])}</b></span>
          <span>${badge(s.away)}<b>${esc(s.away && s.away.shortHe)}</b></span></div>
        <div class="chips center">${resChip(s.res)}${s.extraHe ? `<span class="chip">${esc(s.extraHe)}</span>` : ''}${s.motm ? '<span class="chip gold">⭐ מצטיין המשחק</span>' : ''}${s.cleanSheet ? '<span class="chip good">🧤 שער נקי</span>' : ''}</div>
        <div class="ms-rating"><small>הציון שלך</small><b class="num">${esc(rating(s.rating))}</b></div>
        ${s.tieHe ? `<p class="note good">${esc(s.tieHe)}</p>` : ''}
        ${s.injuryHe ? `<p class="note warn">🤕 ${esc(s.injuryHe)}</p>` : ''}
      </section>
      <section class="card">${statGrid([{ label: 'שערים', value: s.goals ?? 0 }, { label: 'בישולים', value: s.assists ?? 0 }, { label: 'דקות', value: s.minutes ?? 0 }])}
        ${(s.effectsHe || []).length ? `<div class="chips">${s.effectsHe.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}</section>
      ${(s.momentsHe || []).length ? `<section class="card"><h2 class="card-title">הרגעים שלך</h2>${s.momentsHe.map((x) => `<div class="feed-row ${x.ok ? 'k-goal_for' : 'k-goal_against'}"><span class="fm num">${esc(x.minute)}'</span><span>${x.ok ? '✅' : '❌'} ${esc(x.textHe)}</span></div>`).join('')}</section>` : ''}
      <button type="button" class="btn btn-primary btn-xl" data-act="continue" data-testid="btn-match-continue">המשך</button>
    </div>`;
  }

  function draw() {
    if (summary) { destroyScene(); crowd.silence(); root.innerHTML = summaryView(); return; }
    ensureScene();
    const body = m.phase === 'pre' ? preView() : m.phase === 'ended' ? endedView() : liveView();
    root.querySelector('.match-shell').className = 'match match-shell phase-' + m.phase;
    root.querySelector('.sb-slot').innerHTML = scoreboard();
    root.querySelector('.match-body').innerHTML = body;
  }

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
      // the choice is made: the buttons stay visible during the play but can't be tapped again
      opts.querySelectorAll('.mo-opt').forEach((b) => { b.disabled = true; b.removeAttribute('data-testid'); });
    }
    const n = (m.minute || 0) + i;
    if (scene && !reducedMotion() && o) {
      if (mo && mo.side === 'att' && SHOT_CODES.has(o.code)) {
        const key = opt && opt.key;
        const type = CROSS_KEYS.has(key) ? 'cross' : PASS_KEYS.has(key) ? 'cutback' : 'dribble_shot';
        const res = o.goalFor ? 'goal' : o.code === 'MISS' ? 'miss' : 'save';
        scene.say({ cross: 'תרים! תרים לרחבה!', cutback: 'תסתכל לצדדים! יש לך!', dribble_shot: 'יאללה, תן לו!' }[type], 'shout');
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
    if (outcome && outcome.goalFor) { buzz([40, 40, 120]); flash('גול!'); }
    else if (outcome && outcome.code === 'SAVE' && mo && mo.side === 'gk') flash('הצלה!', 'save');
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
    if (r && r.ok && r.status === 'match') { m = r.match; summary = null; outcome = null; draw(); try { window.scrollTo(0, 0); } catch { /* ignore */ } return; }
    if (r && r.ok && r.status === 'done') { ctx.pendingSummary = r.summary; navigate('#/hub'); return; }
    if (r && !r.ok && r.error === 'busy') {
      const lm = call(() => game.getMatch(), { quiet: true });
      if (lm) { m = lm; summary = null; draw(); return; }
    }
    if (r && !r.ok && r.messageHe && r.error !== 'no_week') toast(r.messageHe);
    navigate('#/hub');
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'skip') { if (skipWait) skipWait(); return; }
    if (act === 'mute') { crowd.setSound(!crowd.isOn()); paintMute(); return; }
    if (busy) return;
    if (act === 'start') {
      const r = call(() => game.startMatch());
      if (r) { m = r; draw(); }
    } else if (act === 'auto') {
      const r = call(() => game.autoPlayMatch());
      if (r) { m = r; outcome = null; draw(); if (scene) scene.setScore(myScore()[0], myScore()[1]); }
    } else if (act === 'opt') {
      choose(Number(b.dataset.i));
    } else if (act === 'finish') {
      const s = call(() => game.finishMatch());
      if (s) { summary = s; draw(); try { window.scrollTo(0, 0); } catch { /* ignore */ } }
      else { const lm = call(() => game.getMatch(), { quiet: true }); if (lm) { m = lm; draw(); } else navigate('#/hub'); }
    } else if (act === 'continue') cont();
  });

  if (crowd.soundWanted()) crowd.setSound(true);
  draw();
  return () => { if (skipWait) skipWait(); destroyScene(); crowd.silence(); };
}
