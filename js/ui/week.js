// week.js: week summary modal + #/season (season review).
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, svc, call, toast, openModal, confirmDialog, hubSafe } from './app.js';
import { navigate } from './router.js';
import { badge, teamLabel, scoreBox, ratingChip, statGrid, card, empty } from './components.js';
import { afterWeekAds } from './adslots.js';
import { money, rating, signed } from './format.js';
import { gtext, g } from './gender.js';
import { celebrate } from './scene/celebration.js';

const STOP_HE = {
  until: '', offer: 'עצרנו: הגיעה הצעה חדשה 📨', event: 'עצרנו: יש הודעה שמחכה לתשובה 💬', review: 'העונה הסתיימה 🏁',
  retired: 'הקריירה הסתיימה', injury: 'עצרנו: נפצעת 🤕', callup: 'עצרנו: זומנת לנבחרת! 🏳️', chunk: 'עצרת את הקפיצה',
};

/**
 * Show the week summary modal. extra: { ffWeeks, stopped }
 * On close: retire -> season review -> ads (SPEC §9.4).
 */
export function showWeekSummary(summary, extra = {}) {
  if (!summary) return null;
  const s = summary;
  const ovrDelta = (Number(s.ovrAfter) || 0) - (Number(s.ovrBefore) || 0);
  const results = (s.results || []).map((r) => `<div class="ws-res${r.mine ? ' mine' : ''}">
      <div class="muted small">${esc(r.compHe)}</div>
      <div class="ws-teams"><span class="fx-team home">${badge(r.home, 's')}<span class="tname">${teamLabel(r.home)}</span></span>
        ${scoreBox(r.score)}
        <span class="fx-team away"><span class="tname">${teamLabel(r.away)}</span>${badge(r.away, 's')}</span></div>
      <div class="ws-note">${r.extraHe ? `<span class="muted small">${esc(r.extraHe)}</span>` : ''}${r.noteHe ? `<span class="small">${esc(r.noteHe)}</span>` : ''}${ratingChip(r.rating)}</div>
    </div>`).join('');
  const stopLine = extra.stopped && STOP_HE[extra.stopped] ? `<p class="note">${esc(STOP_HE[extra.stopped])}</p>` : '';
  const html = `
    <h2 class="modal-title">${extra.ffWeeks > 1 ? `קפצנו ${esc(extra.ffWeeks)} שבועות` : 'סיכום השבוע'}</h2>
    <div class="muted small">${esc(s.dateHe || '')}</div>
    ${stopLine}
    ${s.callupHe ? `<p class="note good">🏳️ ${esc(s.callupHe)}</p>` : ''}
    ${s.injuryHe ? `<p class="note warn">🤕 ${esc(s.injuryHe)}</p>` : ''}
    ${results ? `<div class="ws-results">${results}</div>` : '<p class="muted">לא היו משחקים השבוע.</p>'}
    <div class="ws-stats">
      <div class="ws-stat"><small>OVR</small><b class="num">${esc(s.ovrAfter)}</b>${ovrDelta ? `<span class="delta ${ovrDelta > 0 ? 'up' : 'down'}">${esc(signed(ovrDelta))}</span>` : ''}</div>
      <div class="ws-stat"><small>אנרגיה</small><b class="num">${esc(Math.round(s.energy))}</b></div>
      <div class="ws-stat"><small>מורל</small><b class="num">${esc(Math.round(s.morale))}</b></div>
    </div>
    ${s.trainingHe ? `<p class="small">🏋️ ${esc(s.trainingHe)}</p>` : ''}
    ${(s.linesHe || []).length ? `<ul class="ws-lines">${s.linesHe.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    ${s.newMessages || s.newOffers ? `<div class="chips">${s.newMessages ? `<span class="chip">💬 ${s.newMessages === 1 ? 'הודעה חדשה' : esc(s.newMessages) + ' הודעות חדשות'}</span>` : ''}${s.newOffers ? `<span class="chip gold">📨 ${s.newOffers === 1 ? 'הצעה חדשה' : esc(s.newOffers) + ' הצעות חדשות'}</span>` : ''}</div>` : ''}
    <button type="button" class="btn btn-primary btn-lg" data-testid="btn-week-ok" data-close>המשך</button>`;
  const close = openModal(html, { testid: 'week-summary', sheet: true, onClose: (why) => { if (why !== 'nav') afterSummary(s); } });
  return close;
}

function afterSummary(s) {
  const hub = hubSafe();
  if (s.retiredNow || (hub && hub.status === 'retired')) { navigate('#/retire'); return; }
  if (s.seasonEnded || (hub && hub.status === 'review')) {
    try { if (s.hadMatchday) svc.ads.noteMatchday(); } catch { /* ignore */ }
    navigate('#/season');
    return;
  }
  afterWeekAds(s);
}

/* ------------------------------------------------------------------ */
/* #/season                                                            */
/* ------------------------------------------------------------------ */

export function render(root) {
  const hub = hubSafe();
  const rv = call(() => game.getSeasonReview(), { quiet: true });
  if (!rv) {
    root.innerHTML = empty('אין עדיין סיכום עונה') + '<button type="button" class="btn" data-act="hub">חזרה לבית</button>';
    root.addEventListener('click', (e) => { if (e.target.closest('[data-act="hub"]')) navigate('#/hub'); });
    return;
  }
  const pending = !!(hub && hub.status === 'review');
  const st = rv.stats || {};
  const ovrD = (Number(rv.ovrEnd) || 0) - (Number(rv.ovrStart) || 0);
  root.innerHTML = `<div data-testid="season-review" class="season-review">
    <section class="card hero-card">
      <div class="muted small">סיכום עונת</div>
      <h2 class="big-title num">${esc(rv.seasonHe)}</h2>
      <div>${esc(rv.clubHe || '')}${rv.leagueHe ? ' · ' + esc(rv.leagueHe) : ''}</div>
      ${rv.rankHe ? `<div class="rank-line">${esc(rv.rankHe)}</div>` : ''}
    </section>
    ${(rv.trophies || []).length ? card(`<div class="trophy-row">${rv.trophies.map((t) => `<span class="trophy">🏆<b>${esc(t.he)}</b></span>`).join('')}</div>`, { title: 'תארים', cls: 'gold-card' }) : ''}
    ${(rv.awards || []).length ? card(`<div class="trophy-row">${rv.awards.map((t) => `<span class="trophy">🏅<b>${esc(t.he)}</b></span>`).join('')}</div>`, { title: 'פרסים אישיים' }) : ''}
    ${card(statGrid([
      { label: 'הופעות', value: st.apps ?? 0 }, { label: 'שערים', value: st.goals ?? 0 }, { label: 'בישולים', value: st.assists ?? 0 },
      { label: 'ציון ממוצע', value: rating(st.avgRating) }, { label: gtext('{{מצטיין|מצטיינת}} המשחק'), value: st.motm ?? 0 }, { label: 'שער נקי', value: st.cleanSheets ?? 0 },
    ]), { title: 'המספרים' })}
    ${(rv.byComp || []).length ? card(`<table class="tbl simple"><thead><tr><th class="tm">מסגרת</th><th>הופ׳</th><th>שע׳</th><th>בי׳</th><th>ציון</th></tr></thead><tbody>
      ${rv.byComp.map((c) => `<tr><td class="tm">${esc(c.compHe)}</td><td class="num">${esc(c.apps)}</td><td class="num">${esc(c.goals)}</td><td class="num">${esc(c.assists)}</td><td class="num">${esc(rating(c.avgRating))}</td></tr>`).join('')}
      </tbody></table>`, { title: 'לפי מסגרת' }) : ''}
    ${card(`<div class="kv"><span>OVR</span><b class="num">${esc(rv.ovrStart)} ← ${esc(rv.ovrEnd)} ${ovrD ? `<span class="delta ${ovrD > 0 ? 'up' : 'down'}">${esc(signed(ovrD))}</span>` : ''}</b></div>
      <div class="kv"><span>שווי שוק</span><b class="num">${esc(money(rv.valueEnd))}</b></div>`, { title: 'ההתפתחות שלך' })}
    ${(rv.highlightsHe || []).length ? card(`<ul class="ws-lines">${rv.highlightsHe.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`, { title: 'רגעים מהעונה' }) : ''}
    ${(rv.nextHe || []).length ? card(`<ul class="ws-lines">${rv.nextHe.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`, { title: 'מה הלאה' }) : ''}
    ${rv.canRetire && pending ? '<p class="note">אולי הגיע הזמן לתלות את הנעליים? ההחלטה שלך. אפשר גם להמשיך עוד עונה.</p>' : ''}
    <div class="btn-col">
      <button type="button" class="btn btn-primary btn-lg" data-act="ok" data-testid="btn-season-ok">${pending ? 'המשך לעונה הבאה' : 'חזרה'}</button>
      ${rv.canRetire && pending ? '<button type="button" class="btn btn-danger" data-act="retire" data-testid="btn-season-retire">לפרוש</button>' : ''}
    </div>
  </div>`;

  // trophies won this season: the full-screen trophy celebration (C9), once per review
  const tr = rv.trophies || [];
  if (pending && tr.length && ctx.celebratedReview !== rv.seasonHe) {
    ctx.celebratedReview = rv.seasonHe;
    let reduce = false;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || !!(ctx.settings && ctx.settings.reduceMotion); } catch { /* ignore */ }
    if (!reduce) setTimeout(() => { try { celebrate({ kind: 'trophy', textHe: g('אלופים!', 'אלופות!'), subHe: tr.map((t) => t.he).join(' · ') }); } catch (e) { console.warn('celebrate', e); } }, 350);
  }

  let busy = false;
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || busy) return;
    if (b.dataset.act === 'ok') {
      busy = true;
      const h = hubSafe();
      if (h && h.status === 'review') call(() => game.ackSeasonReview());
      if (rv.isFirstSeason && pending) ctx.pendingPrompt = 'season1';
      navigate('#/hub');
      busy = false;
    } else if (b.dataset.act === 'retire') {
      const ok = await confirmDialog({ title: 'לתלות את הנעליים?', text: 'הפרישה סופית. הקריירה תיכנס להיכל התהילה ות{{וכל|וכלי}} עדיין לדפדף בה.', yes: 'כן, אני {{פורש|פורשת}}', danger: true });
      if (!ok) return;
      const r = call(() => game.retire());
      if (r && r.ok !== false) navigate('#/retire');
      else toast((r && r.messageHe) || 'אי אפשר לפרוש עכשיו');
    }
  });
}
