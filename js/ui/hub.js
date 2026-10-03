// hub.js: #/hub. Status header, this week, training, advance / fast-forward, alerts, ad slot, quick links.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, svc, call, toast, openModal, overlay, hubSafe } from './app.js';
import { navigate } from './router.js';
import { badge, bar, stars, ovrCircle, fixtureRow, formChips, card } from './components.js';
import { money, rating } from './format.js';
import { showWeekSummary } from './week.js';
import { mountAdSlot, rewardedButton } from './adslots.js';
import { maybePromptFeedback } from './feedback.js';

const MAIN_BTN = {
  idle: 'שחק את השבוע ▶',
  in_week: 'המשך את השבוע ▶',
  match: 'למשחק! ⚽',
  review: 'סיכום העונה 🏁',
};

export function render(root) {
  const first = hubSafe();
  if (!first) { navigate('#/title'); return; }
  if (first.status === 'retired') { navigate('#/retire'); return; }
  let training = first.training && first.training.current;
  let unmountAd = null;
  let busy = false;

  function draw() {
    const hub = hubSafe();
    if (!hub) return;
    if (hub.status === 'retired') { navigate('#/retire'); return; }
    training = (hub.training && hub.training.current) || training;
    root.innerHTML = tpl(hub, training);
    if (unmountAd) unmountAd();
    unmountAd = mountAdSlot(root.querySelector('.ad-slot'), 'hub_banner');
    rewardedButton(root.querySelector('.rw-slot'), () => draw());
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
      <p class="muted small">המשחקים שלך ישוחקו אוטומטית. נעצור אם תגיע הצעה, הודעה חשובה, פציעה או זימון.</p>
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
      <p class="muted small">משחקים את השבועות בשבילך</p>
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

  return () => { if (unmountAd) unmountAd(); };
}

function tpl(hub, training) {
  const p = hub.player || {};
  const c = hub.club;
  const status = hub.status;
  const potRange = Array.isArray(p.potRange) ? p.potRange.join('-') : '';
  const head = `<section class="card hub-head">
    <div class="hh-top">
      ${ovrCircle(p.ovr, { testid: 'hub-ovr', size: 'l' })}
      <div class="grow hh-id">
        <b class="pname">${esc(p.name)}${p.nick ? ` <span class="muted">"${esc(p.nick)}"</span>` : ''}</b>
        <div class="small">${esc(p.posHe || '')} · גיל ${esc(p.age)} · ${esc(p.stageHe || '')}</div>
        <div class="pot-line">${stars(p.potStars, 'פוטנציאל')}<span class="muted small num" dir="ltr">${esc(potRange)}</span></div>
      </div>
    </div>
    ${c ? `<a class="hh-club" href="#/offers">${badge(c)}<span class="grow"><b>${esc(c.nameHe)}</b>${c.loan ? ' <span class="chip">השאלה</span>' : ''}
        <small class="muted">${esc(c.leagueHe || '')}${c.rank ? ' · מקום ' + esc(c.rank) : ''} · ${esc(c.roleHe || '')}</small></span>
        <span class="small num">${esc(money(c.wage))}<small class="muted"> /שבוע</small></span></a>`
      : `<a class="hh-club free" href="#/offers"><span class="badge badge-m badge-empty">?</span><span class="grow"><b>ללא קבוצה</b><small class="muted">בדוק הצעות</small></span></a>`}
    ${p.injury ? `<p class="note warn">🤕 פצוע: ${esc(p.injury.he)} (${esc(p.injury.weeks)} שבועות)</p>` : ''}
    ${p.susp ? `<p class="note warn">🟨 מורחק ל-${esc(p.susp)} משחקים</p>` : ''}
    <div class="hh-bars">
      ${bar('⚡ אנרגיה', p.energy, { testid: 'hub-energy' })}
      ${bar('😊 מורל', p.morale)}
    </div>
    <div class="rw-slot" hidden></div>
    <div class="hh-form"><span class="small muted">כושר:</span> ${formChips(p.form)}${p.formAvg ? `<span class="small muted"> ממוצע ${esc(rating(p.formAvg))}</span>` : ''}</div>
    <div class="hh-money"><span>💰 <b class="num">${esc(money(p.money))}</b></span><span class="muted small">שווי: <b class="num">${esc(money(p.value))}</b></span></div>
  </section>`;

  const fixtures = (hub.thisWeek || []).map((fx) => fixtureRow(fx)).join('');
  const nextFx = !fixtures && hub.next ? `<div class="muted small">המשחק הבא</div>${fixtureRow(hub.next, { showDate: true, showSel: false })}` : '';
  const weekCard = `<section class="card week-card">
    <div class="wc-head"><h2 class="card-title">${esc(hub.dateHe || '')}</h2>${hub.windowOpen ? '<span class="chip gold">חלון העברות פתוח</span>' : ''}</div>
    ${fixtures || nextFx || '<p class="muted">אין משחקים השבוע. זמן טוב להתאמן.</p>'}
    ${hub.lastResult && hub.lastResult.textHe ? `<p class="small last-res">${esc(hub.lastResult.textHe)}${hub.lastResult.rating ? ' · ציון ' + esc(rating(hub.lastResult.rating)) : ''}</p>` : ''}
    <div class="wc-actions">
      <button type="button" class="btn btn-primary btn-xl grow" data-act="advance" data-testid="btn-advance">${esc(MAIN_BTN[status] || MAIN_BTN.idle)}</button>
      ${status === 'idle' || status === 'in_week' ? '<button type="button" class="btn btn-ff" data-act="ff" data-testid="btn-ff" aria-label="קפיצה קדימה">⏩</button>' : ''}
    </div>
  </section>`;

  const opts = (hub.training && hub.training.options) || [];
  const cur = opts.find((o) => o.id === training);
  const trainCard = card(`<div class="chips scroll">${opts.map((o) => `<button type="button" class="chip chip-btn${o.id === training ? ' on' : ''}" data-act="train" data-v="${esc(o.id)}" data-testid="training-${esc(o.id)}" ${o.disabled ? 'disabled' : ''}>${esc(o.he)}</button>`).join('')}</div>
    ${cur && cur.desc ? `<p class="muted small">${esc(cur.desc)}</p>` : ''}`, { title: 'אימון השבוע' });

  const alerts = (hub.alerts || []).filter((a) => a && a.textHe);
  const alertsHtml = alerts.length ? `<div class="alerts">${alerts.map((a) => `<button type="button" class="alert alert-${esc(a.type)}" ${a.route ? `data-act="go" data-to="${esc(a.route)}"` : 'disabled'}>${esc(alertIcon(a.type))} ${esc(a.textHe)}${a.route ? '<span class="chev">‹</span>' : ''}</button>`).join('')}</div>` : '';
  const notes = (hub.announcementsHe || []).length ? `<div class="notes">${hub.announcementsHe.map((t) => `<p class="note">📢 ${esc(t)}</p>`).join('')}</div>` : '';

  const links = [
    ['#/offers', '📨', 'הצעות', hub.openOffers],
    ['#/national', '🏳️', 'נבחרת', 0],
    ['#/profile', '👤', 'פרופיל', 0],
    ['#/shop', '🛍️', 'חנות', 0],
    ['#/awards', '🏅', 'פרסים', 0],
    ['#/hof', '🏛️', 'היכל התהילה', 0],
  ];
  const grid = `<div class="quick-grid">${links.map(([to, ico, he, n]) => `<button type="button" class="quick" data-act="go" data-to="${to}"><span class="q-ico">${ico}</span><span>${he}</span>${n ? `<b class="q-badge num">${esc(n)}</b>` : ''}</button>`).join('')}</div>`;

  return `<div data-testid="hub" class="hub">
    ${head}
    ${notes}
    ${weekCard}
    ${trainCard}
    ${alertsHtml}
    <div class="ad-slot" data-placement="hub_banner" hidden></div>
    ${grid}
  </div>`;
}

function alertIcon(type) {
  return ({ contract_expiring: '📝', injured: '🤕', callup: '🏳️', window_open: '🔁', offer: '📨', energy_low: '🪫', suspended: '🟨', free_agent: '🆓', season_review: '🏁' })[type] || 'ℹ️';
}
