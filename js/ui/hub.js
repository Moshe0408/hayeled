// hub.js: #/hub. Player card hero, next match, training, advance / fast-forward, alerts, ad slot, quick links.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, svc, call, toast, openModal, overlay, hubSafe } from './app.js';
import { navigate } from './router.js';
import { badge, bar, stars, fixtureRow, formDots, moraleIcon, playerCard, nationTeam, teamLabel, scoreBox, selChip } from './components.js';
import { money, rating } from './format.js';
import { showWeekSummary } from './week.js';
import { mountAdSlot, rewardedButton } from './adslots.js';
import { maybePromptFeedback } from './feedback.js';
import { g, gtext } from './gender.js';
import { mountTilt, mountStadium } from './fx.js';

const MAIN_BTN = {
  idle: 'שחק{{|י}} את השבוע',
  in_week: 'המשך{{|י}} את השבוע',
  match: 'למשחק!',
  review: 'סיכום העונה',
};

const TRAIN_ICO = {
  balanced: '<path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>',
  shooting: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  technique: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l4 3-1.5 4.8h-5L8 10.5z"/>',
  defense: '<path d="M12 3l7.5 3v6c0 4.5-3.3 7.8-7.5 9-4.2-1.2-7.5-4.5-7.5-9V6z"/>',
  physical: '<path d="M13 3L5 13.5h6l-1 7.5 8-10.5h-6z"/>',
  goalkeeping: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10m0-4.5V5a1.5 1.5 0 0 1 3 0v5m0-3.5a1.5 1.5 0 0 1 3 0V11m0-2a1.5 1.5 0 0 1 3 0v4.5a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 14l-1-2.5a1.5 1.5 0 0 1 2.6-1.4L7 11"/>',
  rest: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
};
const QUICK_ICO = {
  offers: '<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>',
  national: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/>',
  shop: '<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  awards: '<circle cx="12" cy="9" r="5.5"/><path d="M9 13.8 7.5 21l4.5-2.5 4.5 2.5-1.5-7.2"/>',
  hof: '<path d="M3 21h18M5 18h14M6 18V10M10 18V10M14 18V10M18 18V10M3.5 10h17L12 4z"/>',
};
const ALERT_ICO = { contract_expiring: '📝', injured: '🤕', callup: '🏳️', window_open: '🔁', offer: '📨', energy_low: '🪫', suspended: '🟥', free_agent: '🆓', season_review: '🏁' };
const svgI = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

export function render(root) {
  const first = hubSafe();
  if (!first) { navigate('#/title'); return; }
  if (first.status === 'retired') { navigate('#/retire'); return; }
  let training = first.training && first.training.current;
  let unmountAd = null;
  let untilt = () => {};
  let unstadium = () => {};
  let busy = false;

  function draw() {
    const hub = hubSafe();
    if (!hub) return;
    if (hub.status === 'retired') { navigate('#/retire'); return; }
    training = (hub.training && hub.training.current) || training;
    const prof = call(() => game.getProfile(), { quiet: true });
    let meta = null;
    try { meta = game.getSaveMeta(); } catch { meta = null; }
    untilt(); unstadium();
    root.innerHTML = tpl(hub, training, prof, meta);
    if (unmountAd) unmountAd();
    unmountAd = mountAdSlot(root.querySelector('.ad-slot'), 'hub_banner');
    rewardedButton(root.querySelector('.rw-slot'), () => draw());
    untilt = mountTilt(root);
    unstadium = mountStadium(root.querySelector('.hero-stadium'));
  }

  function handleResult(r) {
    if (!r) { draw(); return; }
    if (!r.ok) {
      const h = hubSafe();
      if (r.error === 'busy' && h && h.status === 'match') { navigate('#/match'); return; }
      if (r.error === 'review_pending') { navigate('#/season'); return; }
      if (r.error === 'retired') { navigate('#/retire'); return; }
      toast(r.messageHe || 'אי אפשר להתקדם כרגע');
      draw();
      return;
    }
    if (r.status === 'match') { navigate('#/match'); return; }
    draw();
    showWeekSummary(r.summary);
  }

  function advance() {
    if (busy) return;
    const hub = hubSafe();
    if (!hub) return;
    if (hub.status === 'match') { navigate('#/match'); return; }
    if (hub.status === 'review') { navigate('#/season'); return; }
    if (hub.status === 'retired') { navigate('#/retire'); return; }
    busy = true;
    try {
      const r = call(() => (hub.status === 'in_week' ? game.resumeWeek() : game.advanceWeek(training)));
      handleResult(r);
    } finally { busy = false; }
  }

  function openFF() {
    const hub = hubSafe();
    if (!hub) return;
    const close = openModal(`<h2 class="modal-title">⏩ קפיצה קדימה</h2>
      <p class="muted small">${esc(gtext('המשחקים שלך ישוחקו אוטומטית. נעצור אם תגיע הצעה, הודעה חשובה, פציעה או זימון.'))}</p>
      <div class="btn-col">
        <button type="button" class="btn btn-lg" data-ff="next_match" data-testid="ff-next-match">עד המשחק הבא</button>
        <button type="button" class="btn btn-lg" data-ff="season_end" data-testid="ff-season-end">עד סוף העונה</button>
        ${hub.phase === 'summer' ? '<button type="button" class="btn btn-lg" data-ff="season_start" data-testid="ff-skip-summer">דלג על הקיץ</button>' : ''}
        <button type="button" class="btn btn-ghost" data-close>ביטול</button>
      </div>`, { sheet: true, testid: 'ff-sheet' });
    close.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ff]');
      if (!b) return;
      close();
      runFF(b.dataset.ff);
    });
  }

  async function runFF(until) {
    if (busy) return;
    busy = true;
    let stopReq = false;
    let weeks = 0;
    let last = null;
    let res = null;
    const summaries = [];
    const ov = overlay(`<div class="spinner" aria-hidden="true"></div><b class="ff-date">מתחילים...</b>
      <p class="muted small">${esc(g('משחקים את השבועות בשבילך', 'משחקים את השבועות בשבילך'))}</p>
      <button type="button" class="btn" data-testid="btn-ff-stop">עצור</button>`, { testid: 'ff-overlay' });
    const dateEl = ov.el.querySelector('.ff-date');
    ov.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-testid="btn-ff-stop"]');
      if (b) { stopReq = true; b.disabled = true; b.textContent = 'עוצר...'; }
    });
    let chunks = 0;
    try {
      for (;;) {
        res = call(() => game.fastForward({ until, training, maxWeeks: 2 }));
        if (!res || !res.ok) break;
        weeks += res.weeks || 0;
        for (const s of res.summaries || []) summaries.push(s);
        if (summaries.length > 60) summaries.splice(0, summaries.length - 60);
        if (res.hub && dateEl) dateEl.textContent = res.hub.dateHe || '';
        chunks++;
        if (chunks % 5 === 0 && ctx.hooks.saveNow) ctx.hooks.saveNow();
        if (res.stopped !== 'chunk' || stopReq) break;
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      ov.close();
      busy = false;
      if (ctx.hooks.saveNow) ctx.hooks.saveNow();
    }
    if (res && !res.ok) { toast(res.messageHe || 'הקפיצה נעצרה'); }
    const hub = hubSafe();
    if (!hub) { navigate('#/title'); return; }
    last = summaries.length ? summaries[summaries.length - 1] : null;
    const goingToMatch = hub.status === 'match';
    // Count matchdays for the interstitial cap: all but the last (its modal close counts it).
    try {
      const upto = goingToMatch ? summaries.length : summaries.length - 1;
      for (let i = 0; i < upto; i++) if (summaries[i].hadMatchday) svc.ads.noteMatchday();
    } catch { /* ignore */ }
    if (goingToMatch) { navigate('#/match'); return; }
    if (hub.status === 'retired' && !last) { navigate('#/retire'); return; }
    if (last) {
      draw();
      const stopped = res && res.ok ? (res.stopped === 'chunk' ? (stopReq ? 'chunk' : null) : res.stopped) : null;
      showWeekSummary(last, { ffWeeks: weeks, stopped });
      return;
    }
    if (hub.status === 'review') { navigate('#/season'); return; }
    draw();
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'advance') advance();
    else if (act === 'ff') openFF();
    else if (act === 'train') {
      const id = b.dataset.v;
      if (b.disabled) return;
      const r = call(() => game.setTraining(id));
      if (r && r.ok !== false) training = id;
      draw();
    } else if (act === 'go') {
      const to = b.dataset.to;
      if (to) navigate(to);
    }
  });

  draw();

  // Deferred UI from other screens (after a match: week summary; after the first season review: feedback prompt).
  if (ctx.pendingSummary) {
    const s = ctx.pendingSummary;
    ctx.pendingSummary = null;
    setTimeout(() => showWeekSummary(s), 0);
  } else if (ctx.pendingPrompt) {
    const t = ctx.pendingPrompt;
    ctx.pendingPrompt = null;
    setTimeout(() => maybePromptFeedback(t), 250);
  }

  return () => { if (unmountAd) unmountAd(); untilt(); unstadium(); };
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

function hero(hub, prof, meta) {
  const p = hub.player || {};
  const c = hub.club;
  const nat = meta ? nationTeam(meta.nation) : null;
  const potRange = Array.isArray(p.potRange) ? p.potRange.join('-') : '';
  const cardHtml = playerCard({
    name: p.name, nick: p.nick, ovr: p.ovr, pos: p.pos, gk: p.pos === 'GK', attrs: (prof && prof.attrs) || [],
    meta: meta || {}, gender: meta && meta.gender, club: c, nation: nat,
  }, { size: 'm', ovrTestid: 'hub-ovr' });
  return `<section class="hub-hero">
    <canvas class="hero-stadium" aria-hidden="true"></canvas>
    <div class="hh-grid">
      <a class="hh-card" href="#/profile" aria-label="הפרופיל שלי">${cardHtml}</a>
      <div class="hh-info">
        <b class="pname">${esc(p.name)}</b>
        ${p.nick ? `<span class="pnick">"${esc(p.nick)}"</span>` : ''}
        <div class="hh-sub">${esc(gtext(p.posHe || ''))} · גיל <b class="num">${esc(p.age)}</b></div>
        <div class="hh-sub muted">${esc(gtext(p.stageHe || ''))}</div>
        <div class="pot-line"><span class="lbl">פוטנציאל</span>${stars(p.potStars, 'פוטנציאל')}<span class="muted small num" dir="ltr">${esc(potRange)}</span></div>
        <div class="hh-kpis">
          <div class="kpi"><small>מורל</small>${moraleIcon(p.morale)}</div>
          <div class="kpi"><small>כושר</small>${formDots(p.form, { max: 5 })}</div>
        </div>
      </div>
    </div>
    ${c ? `<a class="hh-club" href="#/offers">${badge(c, 'm')}<span class="grow"><b>${esc(c.nameHe)}</b>${c.loan ? ' <span class="chip">השאלה</span>' : ''}
        <small class="muted">${esc(gtext(c.leagueHe || ''))}${c.rank ? ' · מקום ' + esc(c.rank) : ''} · ${esc(gtext(c.roleHe || ''))}</small></span>
        <span class="hh-wage num">${esc(money(c.wage))}<small class="muted"> /שבוע</small></span></a>`
      : `<a class="hh-club free" href="#/offers"><span class="badge badge-m badge-empty">?</span><span class="grow"><b>ללא קבוצה</b><small class="muted">${esc(gtext('בדוק{{|י}} הצעות'))}</small></span></a>`}
  </section>`;
}

function statusPanel(hub) {
  const p = hub.player || {};
  return `<section class="card status-card">
    ${p.injury ? `<p class="note warn">🤕 ${esc(gtext('פצוע{{|ה}}'))}: ${esc(p.injury.he)} (${esc(p.injury.weeks)} שבועות)</p>` : ''}
    ${p.susp ? `<p class="note warn">🟥 ${esc(gtext('מורחק{{|ת}}'))} ל-${esc(p.susp)} משחקים</p>` : ''}
    <div class="hh-bars">
      ${bar('אנרגיה', p.energy, { testid: 'hub-energy', ico: '<i class="bi bi-energy"></i>' })}
      ${bar('מורל', p.morale, { ico: '<i class="bi bi-morale"></i>' })}
    </div>
    <div class="rw-slot" hidden></div>
    <div class="money-row">
      <div class="mr-item"><small>בבנק</small><b class="num">${esc(money(p.money))}</b></div>
      <div class="mr-item"><small>שווי שוק</small><b class="num">${esc(money(p.value))}</b></div>
      <div class="mr-item"><small>ממוצע ציון</small><b class="num">${esc(p.formAvg ? rating(p.formAvg) : '-')}</b></div>
    </div>
  </section>`;
}

/** Big FM-style match preview for this week's first fixture. */
function matchPreview(fx, label) {
  const r = fx.result;
  return `<div class="mp${fx.big ? ' mp-big' : ''}">
    <div class="mp-meta"><span class="chip comp kind-${esc(fx.kind)}">${esc(fx.compHe)}</span>${fx.roundHe ? `<span class="muted">${esc(fx.roundHe)}</span>` : ''}${fx.big ? '<span class="big-tag">★ משחק גדול</span>' : ''}</div>
    <div class="mp-teams">
      <div class="mp-team${fx.isHome ? ' mine' : ''}">${badge(fx.home, 'l')}<b>${teamLabel(fx.home)}</b><small class="muted">בית</small></div>
      <div class="mp-mid">${r ? scoreBox(r.score, 'big') : '<span class="mp-vs">VS</span>'}${label ? `<small class="muted">${esc(label)}</small>` : ''}</div>
      <div class="mp-team${!fx.isHome ? ' mine' : ''}">${badge(fx.away, 'l')}<b>${teamLabel(fx.away)}</b><small class="muted">חוץ</small></div>
    </div>
    ${!r && fx.selection && fx.selection !== 'unknown' ? `<div class="mp-sel">${selChip(fx.selection)}</div>` : ''}
  </div>`;
}

function tpl(hub, training, prof, meta) {
  const status = hub.status;
  const week = hub.thisWeek || [];
  const main = week[0] || null;
  const rest = week.slice(1).map((fx) => fixtureRow(fx)).join('');
  const nextHtml = main ? matchPreview(main, 'השבוע') : hub.next ? matchPreview(hub.next, hub.next.dateHe || 'המשחק הבא') : `<p class="muted center">${esc(gtext('אין משחקים השבוע. זמן טוב להתאמן.'))}</p>`;
  const weekCard = `<section class="card week-card">
    <h2 class="card-title"><span>${esc(hub.dateHe || '')}</span></h2>
    ${hub.windowOpen ? '<div class="wc-flags"><span class="chip gold">🔁 חלון העברות פתוח</span></div>' : ''}
    ${nextHtml}
    ${rest}
    ${hub.lastResult && hub.lastResult.textHe ? `<p class="small last-res"><span class="lr-tag">אחרון</span>${esc(hub.lastResult.textHe)}${hub.lastResult.rating ? ' · ציון ' + esc(rating(hub.lastResult.rating)) : ''}</p>` : ''}
    <div class="wc-actions">
      <button type="button" class="btn btn-gold btn-xl grow" data-act="advance" data-testid="btn-advance"><span>${esc(gtext(MAIN_BTN[status] || MAIN_BTN.idle))}</span><svg class="i play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l11-7z"/></svg></button>
      ${status === 'idle' || status === 'in_week' ? '<button type="button" class="btn btn-ff" data-act="ff" data-testid="btn-ff" aria-label="קפיצה קדימה"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6v12l8-6zM12 6v12l8-6z"/></svg></button>' : ''}
    </div>
  </section>`;

  const opts = (hub.training && hub.training.options) || [];
  const cur = opts.find((o) => o.id === training);
  const trainCard = `<section class="card train-card"><h2 class="card-title"><span>אימון השבוע</span></h2>
    <div class="train-grid">${opts.map((o) => `<button type="button" class="train${o.id === training ? ' on' : ''}" data-act="train" data-v="${esc(o.id)}" data-testid="training-${esc(o.id)}" ${o.disabled ? 'disabled' : ''}>${svgI(TRAIN_ICO[o.id] || TRAIN_ICO.balanced)}<span>${esc(gtext(o.he))}</span></button>`).join('')}</div>
    ${cur && cur.desc ? `<p class="muted small train-desc">${esc(gtext(cur.desc))}</p>` : ''}</section>`;

  const alerts = (hub.alerts || []).filter((a) => a && a.textHe);
  const alertsHtml = alerts.length ? `<div class="alerts">${alerts.map((a) => `<button type="button" class="alert alert-${esc(a.type)}" ${a.route ? `data-act="go" data-to="${esc(a.route)}"` : 'disabled'}><span class="al-ico">${esc(ALERT_ICO[a.type] || 'ℹ️')}</span><span class="grow">${esc(gtext(a.textHe))}</span>${a.route ? '<span class="chev">‹</span>' : ''}</button>`).join('')}</div>` : '';
  const notes = (hub.announcementsHe || []).length ? `<div class="notes">${hub.announcementsHe.map((t) => `<p class="note">📢 ${esc(gtext(t))}</p>`).join('')}</div>` : '';

  const links = [
    ['#/offers', 'offers', 'הצעות', hub.openOffers],
    ['#/national', 'national', 'נבחרת', 0],
    ['#/profile', 'profile', 'פרופיל', 0],
    ['#/shop', 'shop', 'חנות', 0],
    ['#/awards', 'awards', 'פרסים', 0],
    ['#/hof', 'hof', 'היכל התהילה', 0],
  ];
  const grid = `<div class="quick-grid">${links.map(([to, ico, he, n]) => `<button type="button" class="quick q-${ico}" data-act="go" data-to="${to}"><span class="q-ico">${svgI(QUICK_ICO[ico])}</span><span>${he}</span>${n ? `<b class="q-badge num">${esc(n)}</b>` : ''}</button>`).join('')}</div>`;

  return `<div data-testid="hub" class="hub">
    ${hero(hub, prof, meta)}
    ${notes}
    ${alertsHtml}
    ${weekCard}
    ${statusPanel(hub)}
    ${trainCard}
    <div class="ad-slot" data-placement="hub_banner" hidden></div>
    ${grid}
  </div>`;
}
