// match.js: #/match. Live match with key moments, commentary, auto-play, summary. Never shows ads.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, call, toast, buzz, reducedMotion } from './app.js';
import { navigate } from './router.js';
import { badge, oddsChip, ratingChip, resChip, statGrid } from './components.js';
import { rating, signed } from './format.js';

const SIDE_HE = { att: 'התקפה', def: 'הגנה', gk: 'שער' };
const CODE_ICON = { GOAL: '⚽', ASSIST: '🅰️', CHANCE: '👍', MISS: '😬', LOST: '😕', WON: '💪', BEATEN: '😣', CONCEDED: '🥅', SAVE: '🧤', GK_CONCEDED: '🥅', CARD: '🟨' };

export function render(root) {
  let m = call(() => game.getMatch(), { quiet: true });
  let summary = null;
  let outcome = null;
  let busy = false;
  let skipWait = null;
  if (!m) { navigate('#/hub', { replace: true }); return; }

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
    if (summary) { root.innerHTML = summaryView(); return; }
    const body = m.phase === 'pre' ? preView() : m.phase === 'ended' ? endedView() : liveView();
    root.innerHTML = `<div data-testid="match" class="match phase-${esc(m.phase)}">${scoreboard()}${body}
      ${outcome && outcome.goalFor ? '<div class="goal-flash" aria-hidden="true">גוללל!</div>' : ''}</div>`;
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
    outcome = r.outcome;
    m = r.match;
    draw();
    if (outcome && outcome.goalFor) buzz([40, 40, 120]);
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
    if (busy) return;
    if (act === 'start') {
      const r = call(() => game.startMatch());
      if (r) { m = r; draw(); }
    } else if (act === 'auto') {
      const r = call(() => game.autoPlayMatch());
      if (r) { m = r; outcome = null; draw(); }
    } else if (act === 'opt') {
      choose(Number(b.dataset.i));
    } else if (act === 'finish') {
      const s = call(() => game.finishMatch());
      if (s) { summary = s; draw(); try { window.scrollTo(0, 0); } catch { /* ignore */ } }
      else { const lm = call(() => game.getMatch(), { quiet: true }); if (lm) { m = lm; draw(); } else navigate('#/hub'); }
    } else if (act === 'continue') cont();
  });

  draw();
  return () => { if (skipWait) skipWait(); };
}
