// manager.js: #/manager and #/manager/:sec. The coaching career after retirement (v2.1, R2):
// FM-style office (crest of the coached team, objective, board / fans / squad bars, tactic picker, next match),
// watch-mode result reels, transfers, job offers, trophy cabinet and history as a manager.
import * as game from '../engine/game.js';
import * as save from '../core/save.js';
import { esc } from './dom.js';
import { ctx, call, toast, openModal, overlay, confirmDialog, reducedMotion, setHeader } from './app.js';
import { navigate } from './router.js';
import { badge, bar, card, statGrid, empty, teamLabel, scoreBox, fixtureRow, tableGroup, avatarFor, nationTeam } from './components.js';
import { g, gtext } from './gender.js';
import { celebrate } from './scene/celebration.js';
import { ico, trophyIco, awardIco } from './icons.js';
import { ltr, money } from './format.js';

const SECS = [
  { id: 'office', he: 'המשרד' },
  { id: 'squad', he: 'העברות' },
  { id: 'offers', he: 'הצעות' },
  { id: 'history', he: 'היסטוריה' },
];
const TAC_ICO = {
  attack: '<path d="M12 20V6"/><path d="M6.5 11.5 12 6l5.5 5.5"/><path d="M5 20h14"/>',
  balanced: '<path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>',
  defend: '<path d="M12 3l7.5 3v6c0 4.5-3.3 7.8-7.5 9-4.2-1.2-7.5-4.5-7.5-9V6z"/><path d="M9 12l2 2 4-4"/>',
  press: '<path d="M3 12h5M21 12h-5M6 9l3 3-3 3M18 9l-3 3 3 3"/><circle cx="12" cy="12" r="1.6"/>',
  counter: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
};
const svgI = (d, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const RES_HE = { W: 'נ', D: 'ת', L: 'ה' };
const STOP_HE = { offer: 'עצרנו: הגיעה הצעת עבודה', review: 'העונה הסתיימה', sacked: 'עצרנו: פוטרת', done: 'קריירת האימון הסתיימה', chunk: 'עצרת את הקפיצה', until: '' };
const STOP_ICO = { offer: 'mail', review: 'flag', sacked: 'briefcase', done: 'flag', chunk: 'pause' };
/** Summary line chip: engine lines that start with the trophy emoji get the trophy icon instead. */
function lineChip(l) {
  const s = String(l || '');
  if (s.indexOf('🏆') === 0) return `<span class="chip gold">${trophyIco('', '')} ${esc(s.replace(/^🏆\s*/, ''))}</span>`;
  return `<span class="chip">${esc(s)}</span>`;
}
const NOTABLE = /^(🏆|הגיע|פוטרת|החוזה)/;

/* ------------------------------------------------------------------ */
/* Scoped styles (manager screens only)                                */
/* ------------------------------------------------------------------ */
const CSS = `
.mgr{display:grid;gap:12px}
.mgr .card{margin:0}
.mgr-hero{position:relative;overflow:hidden;isolation:isolate;border-radius:var(--r);padding:16px 14px 12px;background:var(--panel-hi);box-shadow:var(--sh-3)}
.mgr-hero::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(90% 120% at 100% 0%,var(--mg-c1,rgba(47,227,207,.25)),transparent 62%),radial-gradient(70% 90% at 0% 100%,rgba(244,195,90,.10),transparent 70%)}
.mgr-hero::after{content:"";position:absolute;inset:auto 0 0 0;height:2px;background:linear-gradient(90deg,transparent,var(--mg-c1h,var(--teal)),var(--gold),transparent);opacity:.7}
.mgr-hgrid{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}
.mgr-crest{filter:drop-shadow(0 8px 18px rgba(0,0,0,.55))}
.mgr-crest .badge{width:76px;height:76px}
.mgr-who{display:grid;gap:3px;min-width:0}
.mgr-role{font:800 12px/1.2 var(--font-d);color:var(--gold);letter-spacing:.02em}
.mgr-team{font:900 20px/1.15 var(--font-d);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.mgr-lg{font-size:13px;color:var(--muted)}
.mgr-av{width:62px;border-radius:14px;overflow:hidden;box-shadow:var(--sh-2)}
.mgr-av svg{display:block;width:100%;height:auto}
.mgr-strip{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.mgr-kpi{flex:1 1 0;min-width:0;display:grid;gap:2px;justify-items:center;padding:7px 4px;border-radius:11px;background:var(--well);box-shadow:var(--sh-1)}
.mgr-kpi b{font:900 clamp(13px,4.1vw,17px)/1 var(--font-d);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.mgr-kpi b.wdl,.stat b.wdl{font-size:clamp(12px,3.6vw,16px);letter-spacing:-.01em;white-space:nowrap}
.mgr-kpi small{font-size:11px;color:var(--muted)}
.mgr-kpi b.wdl small,.stat b.wdl small{font-size:10.5px;font-weight:700;color:var(--muted);margin-inline-end:1px}
.mgr-kpi b.wdl .sep{display:inline-block;width:6px;font-size:0}
.mgr-kpi:has(b.wdl){flex-grow:1.35}
.mgr-strip:has(b.wdl) .mgr-kpi:nth-child(1),.mgr-strip:has(b.wdl) .mgr-kpi:nth-child(3){flex-grow:.7}
.mgr-strip:has(b.wdl) .mgr-kpi:nth-child(4){flex-grow:1.3}
.mgr-strip:has(b.wdl) .mgr-kpi:nth-child(4) b{font-size:clamp(12px,3.7vw,17px)}
.mgr-kpi b.wdl{overflow:visible;text-overflow:clip}
.modal-wrap:has(.mgr-reel-modal){background:rgba(3,7,15,.95);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.mgr-obj-ico .ico{width:22px;height:22px}
.mgr-sum .agg{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 4px}
.mgr-sum .agg .mgr-kpi{min-width:62px}
.mgr-sign{display:grid;gap:8px}
.mgr-play .ico{width:12px;height:12px;vertical-align:-1px}
.mgr-obj{display:flex;align-items:center;gap:10px}
.mgr-obj .grow{display:grid;gap:3px}
.mgr-obj-ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(244,195,90,.12);color:var(--gold);font-size:20px}
.obj-st{font-size:12px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap}
.obj-on{background:rgba(44,200,110,.16);color:#9ff0bf}
.obj-risk{background:rgba(255,181,71,.16);color:var(--amber)}
.obj-off{background:rgba(255,84,104,.16);color:#ffb3bd}
.mgr-bars{display:grid;gap:10px}
.tac-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.tac{position:relative;display:grid;justify-items:center;align-content:center;gap:5px;min-height:78px;padding:10px 3px 8px;border-radius:12px;border:0;background:var(--well);box-shadow:var(--sh-1);color:var(--muted);font:700 11.5px/1.15 var(--font-d);text-align:center}
.tac svg.i{width:26px;height:26px}
.tac.on{color:var(--text);background:radial-gradient(90% 90% at 50% 0%,rgba(244,195,90,.20),transparent 70%),var(--well);box-shadow:0 0 0 2px var(--gold) inset,var(--glow-gold)}
.tac.on svg{color:var(--gold)}
.tac:active{transform:scale(.97)}
.tac-rec{position:absolute;top:-7px;inset-inline-start:50%;transform:translateX(50%);background:var(--teal);color:#032621;font-size:9.5px;font-weight:900;border-radius:999px;padding:1px 6px;white-space:nowrap}
[dir="ltr"] .tac-rec{transform:translateX(-50%)}
.tac-desc{margin:10px 2px 0;font-size:13px;color:var(--muted);min-height:2.6em}
.mgr-mp{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:6px 0 12px}
.mgr-mp .side{display:grid;justify-items:center;gap:6px;text-align:center;font-weight:800;font-size:14px}
.mgr-mp .side.mine b{color:var(--gold)}
.mgr-mp .mid{display:grid;justify-items:center;gap:4px}
.mgr-vs{font:900 22px/1 var(--font-d);color:var(--ink-3)}
.mgr-actions{display:flex;gap:8px;margin-top:12px}
.mgr-res{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:9px 2px;border-bottom:1px solid var(--hair);width:100%;background:none;border-inline:0;border-top:0;color:var(--text);text-align:start}
.mgr-res:last-child{border-bottom:0}
.mgr-res .teams{display:flex;align-items:center;gap:6px;min-width:0;font-size:13.5px}
.mgr-res .teams .tname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:9.5em}
.mgr-res .meta{display:grid;justify-items:end;gap:2px;font-size:11.5px;color:var(--muted)}
.rpill{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font:900 12px/1 var(--font-d)}
.rp-W{background:var(--a5);color:#03210f}.rp-D{background:var(--a3);color:#2a2200}.rp-L{background:var(--a1);color:#fff}
.mgr-play{font-size:11px;color:var(--teal-ink)}
.mgr-offer{display:grid;gap:10px;padding:12px;border-radius:12px;background:var(--well);box-shadow:var(--sh-1);margin-bottom:10px}
.mgr-offer:last-child{margin-bottom:0}
.mgr-offer .top{display:flex;align-items:center;gap:10px}
.mgr-offer .top .grow{display:grid;gap:2px;min-width:0}
.mgr-offer .why{font-size:12px;color:var(--gold)}
.mgr-offer .kvs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.mgr-offer .kvs div{display:grid;gap:1px;padding:6px;border-radius:9px;background:rgba(255,255,255,.03);text-align:center}
.mgr-offer .kvs small{font-size:11px;color:var(--muted)}
.mgr-offer .kvs b{font-size:13px}
.mgr-tgt{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--hair)}
.mgr-tgt:last-child{border-bottom:0}
.mgr-ovr{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;font:900 16px/1 var(--font-d);background:linear-gradient(180deg,#2a3b5c,#16233b);box-shadow:var(--sh-1)}
.mgr-ovr.hi{background:linear-gradient(180deg,var(--gold-hi),var(--gold-lo));color:#2a1b00}
.mgr-budget{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.mgr-budget b{font:900 20px/1 var(--font-d);color:var(--gold)}
.mgr-tbl .tbl{font-size:13px}
.mgr-hist td,.mgr-hist th{font-size:12.5px}
.mgr-retire{margin-top:6px}
.mgr-reel .rl-board{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:6px 0 10px}
.mgr-reel .rl-side{display:grid;justify-items:center;gap:6px;text-align:center;font-weight:800;font-size:13.5px}
.mgr-reel .rl-score{font:900 40px/1 var(--font-d);letter-spacing:.04em;direction:ltr}
.mgr-reel .rl-clock{justify-self:center;font:800 13px/1 var(--font-d);color:var(--live);background:rgba(255,59,78,.12);padding:5px 12px;border-radius:999px}
.mgr-reel .rl-bar{height:4px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;margin:8px 0}
.mgr-reel .rl-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--teal),var(--gold))}
.mgr-reel .rl-log{display:grid;gap:6px;max-height:38vh;overflow:auto;padding:2px}
.mgr-reel .rl-ev{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;font-size:13.5px;padding:7px 10px;border-radius:10px;background:var(--well);animation:rlIn .35s var(--ease-out)}
.mgr-reel .rl-ev.goal:not(.own){background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,.02));box-shadow:0 0 0 1px rgba(255,255,255,.12) inset;font-weight:700}
.mgr-reel .rl-ev.goal.own{background:linear-gradient(90deg,rgba(244,195,90,.18),rgba(244,195,90,.04));box-shadow:0 0 0 1px rgba(244,195,90,.35) inset;font-weight:800}
.mgr-reel .rl-ev .m{font:800 12px/1 var(--font-d);color:var(--muted);min-width:2.4em}
.mgr-reel .rl-ev .ico{width:16px;height:16px;margin-inline-end:5px}
.mgr-reel .rl-ev.goal .ico{color:var(--gold)}
.mgr-reel .rl-ev.card .ico{color:#FFD43B}
.mgr-reel .rl-flash{animation:rlFlash .7s ease-out}
@keyframes rlIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes rlFlash{0%{transform:scale(1.25);color:var(--gold)}100%{transform:none}}
@media (prefers-reduced-motion:reduce){.mgr-reel .rl-ev,.mgr-reel .rl-flash{animation:none}}
.mgr-sum .rows{display:grid;gap:6px;margin:8px 0}
.mgr-sum .row{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;padding:8px;border-radius:10px;background:var(--well)}
.mgr-delta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
`;
function ensureCss() {
  if (document.getElementById('mgr-css')) return;
  const st = document.createElement('style');
  st.id = 'mgr-css';
  st.textContent = CSS;
  document.head.appendChild(st);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function crestOf(team, size = 'm') {
  if (!team) return badge(null, size);
  if (team.nation || team.flag) return badge(nationTeam(team.nation || team.id) || team, size);
  return badge(team, size);
}
function metaSafe() { try { return game.getSaveMeta(); } catch { return null; } }
function coachAvatar(meta, team, size = 62) {
  const kit = team && Array.isArray(team.colors) ? team.colors : ['#1b2a44', '#ffffff'];
  return avatarFor(meta || {}, { size, pose: 'portrait', bg: true, kitColors: kit });
}
function recordHof() {
  try { const e = game.buildHallOfFameEntry(); if (e) save.addHallOfFame(e).catch((err) => console.warn('[hayeled] HoF', err)); } catch (e) { console.warn('[hayeled] HoF', e); }
}
function saveNow() { try { if (ctx.hooks && ctx.hooks.saveNow) ctx.hooks.saveNow(); } catch { /* ignore */ } }
function resPill(res) { return `<span class="rpill rp-${esc(res)}">${esc(RES_HE[res] || '')}</span>`; }

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */
export function render(root, params = {}) {
  ensureCss();
  if (!game.hasCareer()) { navigate('#/title', { replace: true }); return; }
  let first = call(() => game.getManager(), { quiet: true });
  if (!first) {
    // a retired career without a coaching state (v2 saves): create the offers, then show them on the retirement screen
    call(() => game.ensureCoachingOffers(), { quiet: true });
    navigate('#/retire', { replace: true });
    return;
  }
  if (first.st === 'offers') { navigate('#/retire', { replace: true }); return; }
  let sec = SECS.some((s) => s.id === params.sec) ? params.sec : 'office';
  let busy = false;

  function draw() {
    const M = call(() => game.getManager(), { quiet: true });
    if (!M) { navigate('#/retire', { replace: true }); return; }
    if (M.st === 'offers') { navigate('#/retire', { replace: true }); return; }
    const meta = metaSafe();
    try { setHeader({ title: M.titleHe }); } catch { /* ignore */ }
    root.innerHTML = tpl(M, meta, sec);
    const c1 = M.job && M.job.team && M.job.team.colors ? M.job.team.colors[0] : null;
    const hero = root.querySelector('.mgr-hero');
    if (hero && c1 && /^#[0-9a-fA-F]{3,8}$/.test(c1)) { hero.style.setProperty('--mg-c1', c1 + '55'); hero.style.setProperty('--mg-c1h', c1); }
  }

  async function afterWeek(sum, { watch = true, ffWeeks = 0, stopped = null, agg = null } = {}) {
    if (!sum) { draw(); return; }
    const reels = !!(watch && sum.results && sum.results.length);
    // with reels the screen behind keeps the pre-match state until the replay closes (no spoilers)
    if (!reels) draw();
    let merged = false;
    if (reels) {
      // a single matchday: the last reel's end card is the week summary (one "המשך" instead of two)
      const single = ffWeeks <= 1 && !(stopped && STOP_HE[stopped]);
      for (let i = 0; i < sum.results.length; i++) {
        const last = i === sum.results.length - 1;
        const go = await playReel(sum.results[i], last && single ? { lines: sum.linesHe || [] } : {});
        if (go === 'nav') return;
      }
      merged = single;
      draw();
    }
    if (sum.results && sum.results.some((r) => r.res === 'W') && (sum.linesHe || []).some((l) => l.indexOf('🏆') === 0) && !reducedMotion()) {
      try { celebrate({ kind: 'trophy', textHe: g('אלופים!', 'אלופות!'), subHe: sum.linesHe.filter((l) => l.indexOf('🏆') === 0).join(' · ') }); } catch (e) { console.warn(e); }
    }
    if (!merged) await showSummary(sum, { ffWeeks, stopped, agg });
    if (sum.seasonEnded || (sum.review && sum.review.seasonHe)) {
      const M = call(() => game.getManager(), { quiet: true });
      if (M && M.review) await showReview(M.review);
      recordHof();
    }
    saveNow();
    draw();
  }

  function advance() {
    if (busy) return;
    busy = true;
    try {
      const M = call(() => game.getManager(), { quiet: true });
      const r = call(() => game.mgrAdvance(M && M.tactic ? M.tactic.current : undefined));
      if (!r || !r.ok) { toast((r && r.messageHe) || 'אי אפשר להתקדם כרגע'); draw(); return; }
      afterWeek(r.summary).catch((e) => console.warn(e));
    } finally { busy = false; }
  }

  function openFF() {
    const M = call(() => game.getManager(), { quiet: true });
    if (!M) return;
    const close = openModal(`<h2 class="modal-title">${ico('ff', 'gold')} קפיצה קדימה</h2>
      <p class="muted small">${esc(gtext('המשחקים ישוחקו לפי הטקטיקה שבחרת. נעצור אם תגיע הצעת עבודה או בסוף העונה.'))}</p>
      <div class="btn-col">
        <button type="button" class="btn btn-lg" data-ff="next_match" data-testid="mgr-ff-next">עד המשחק הבא</button>
        <button type="button" class="btn btn-lg" data-ff="season_end" data-testid="mgr-ff-season">עד סוף העונה</button>
        ${M.phase === 'summer' ? '<button type="button" class="btn btn-lg" data-ff="season_start" data-testid="mgr-ff-summer">דלג על הקיץ</button>' : ''}
        <button type="button" class="btn btn-ghost" data-close>ביטול</button>
      </div>`, { sheet: true, testid: 'mgr-ff-sheet' });
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
    let stopReq = false, weeks = 0, res = null, last = null, n = 0;
    // the whole skipped span (not just the last week): matches, W-D-L and the notable lines
    const agg = { g: 0, w: 0, d: 0, l: 0, lines: [] };
    const ov = overlay(`<div class="spinner" aria-hidden="true"></div><b class="ff-date">מתחילים...</b>
      <p class="muted small">${esc(g('מנהלים את השבועות בשבילך', 'מנהלות את השבועות בשבילך'))}</p>
      <button type="button" class="btn" data-testid="mgr-ff-stop">עצור</button>`, { testid: 'mgr-ff-overlay' });
    const dateEl = ov.el.querySelector('.ff-date');
    ov.el.addEventListener('click', (e) => { const b = e.target.closest('[data-testid="mgr-ff-stop"]'); if (b) { stopReq = true; b.disabled = true; b.textContent = 'עוצר...'; } });
    try {
      for (;;) {
        res = call(() => game.mgrFastForward({ until, maxWeeks: 2 }));
        if (!res || !res.ok) break;
        weeks += res.weeks || 0;
        if (res.summaries && res.summaries.length) {
          for (const s of res.summaries) {
            for (const r of s.results || []) { agg.g++; if (r.res === 'W') agg.w++; else if (r.res === 'D') agg.d++; else agg.l++; }
            for (const l of s.linesHe || []) if (NOTABLE.test(l) && agg.lines.indexOf(l) < 0) agg.lines.push(l);
          }
          last = res.summaries[res.summaries.length - 1];
          if (dateEl) dateEl.textContent = last.dateHe || '';
        }
        if (++n % 6 === 0) saveNow();
        if (res.stopped !== 'chunk' || stopReq) break;
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally { ov.close(); busy = false; saveNow(); }
    if (res && !res.ok) { toast(res.messageHe || 'הקפיצה נעצרה'); draw(); return; }
    const stopped = res ? (res.stopped === 'chunk' ? (stopReq ? 'chunk' : null) : res.stopped) : null;
    if (last) {
      const sum = weeks > 1 ? Object.assign({}, last, { linesHe: agg.lines.slice() }) : last;
      await afterWeek(sum, { watch: until === 'next_match', ffWeeks: weeks, stopped, agg: weeks > 1 ? agg : null });
    }
    else draw();
  }

  async function respond(id, action) {
    if (action === 'accept') {
      const M = call(() => game.getManager(), { quiet: true });
      const o = M && M.offers.find((x) => x.id === id);
      if (!o) return;
      const txt = M.job ? gtext('{{תעזוב|תעזבי}} את ' + M.job.team.nameHe + ' ו{{תעבור|תעברי}} ל' + o.team.nameHe + '?') : 'לחתום כ' + o.roleHe + ' ב' + o.team.nameHe + '?';
      const ok = await confirmDialog({ title: 'תפקיד חדש', text: txt, yes: 'חותמים' });
      if (!ok) return;
    }
    const r = call(() => game.mgrRespondOffer(id, action));
    if (r && r.ok && action === 'accept') { toast(g('ברוך הבא לתפקיד החדש!', 'ברוכה הבאה לתפקיד החדש!'), { tone: 'good' }); sec = 'office'; saveNow(); navigate('#/manager', { replace: true }); return; }
    if (r && !r.ok && r.messageHe) toast(r.messageHe);
    draw();
  }

  async function retireCoach() {
    const ok = await confirmDialog({ title: 'לפרוש מאימון?', text: 'קריירת האימון תסתיים והשם שלך ייכנס להיכל התהילה {{כשחקן וכמאמן|כשחקנית וכמאמנת}}. אי אפשר לחזור אחורה.', yes: 'כן, לפרוש', danger: true });
    if (!ok) return;
    const r = call(() => game.mgrRetire());
    if (r && r.ok) { recordHof(); saveNow(); toast(g('תודה, המאמן! נכנסת להיכל התהילה.', 'תודה, המאמנת! נכנסת להיכל התהילה.')); }
    draw();
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'advance') advance();
    else if (act === 'ff') openFF();
    else if (act === 'tac') { call(() => game.mgrSetTactic(b.dataset.v)); draw(); }
    else if (act === 'sec') { sec = b.dataset.v; try { history.replaceState(history.state, '', sec === 'office' ? '#/manager' : '#/manager/' + sec); } catch { /* ignore */ } draw(); window.scrollTo(0, 0); }
    else if (act === 'offer') respond(b.dataset.id, b.dataset.a);
    else if (act === 'reel') { const r = call(() => game.getMatchReel(b.dataset.key), { quiet: true }); if (r) playReel(r); }
    else if (act === 'sign') {
      // a signing spends real budget: confirm it like a purchase in the shop
      const M0 = call(() => game.getManager(), { quiet: true });
      const T0 = M0 && M0.job && M0.job.transfers;
      const t = T0 && T0.targets.find((x) => x.id === b.dataset.id);
      if (!t) return;
      if (!(await signSheet(t, T0))) return;
      const r = call(() => game.mgrSign(b.dataset.id));
      if (r) toast(r.messageHe || (r.ok ? 'נחתם!' : 'לא הצלחנו להחתים'), { tone: r.ok ? 'good' : '' });
      if (r && r.ok) saveNow();
      draw();
    } else if (act === 'budget') {
      const r = call(() => game.mgrRequestBudget());
      if (r) toast(r.messageHe || '', { tone: r.approved ? 'good' : '' });
      draw();
    } else if (act === 'review') {
      const M = call(() => game.getManager(), { quiet: true });
      if (M && M.review) { await showReview(M.review); draw(); }
    } else if (act === 'retire') retireCoach();
    else if (act === 'go') navigate(b.dataset.to);
  });

  draw();
  return () => {};
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */
function tpl(M, meta, sec) {
  if (M.st === 'done') return doneTpl(M, meta);
  const J = M.job;
  const tabs = SECS.filter((s) => s.id !== 'squad' || (J && J.transfers));
  if (!tabs.some((t) => t.id === sec)) sec = 'office';
  const seg = `<div class="seg" role="tablist">${tabs.map((s) => `<button type="button" role="tab" class="seg-btn${s.id === sec ? ' on' : ''}" data-act="sec" data-v="${esc(s.id)}" data-testid="mgr-tab-${esc(s.id)}" aria-selected="${s.id === sec}">${esc(s.he)}${s.id === 'offers' && M.openOffers ? ` <b class="q-badge num">${esc(M.openOffers)}</b>` : ''}</button>`).join('')}</div>`;
  let body = '';
  if (sec === 'office') body = officeTpl(M);
  else if (sec === 'squad') body = squadTpl(M);
  else if (sec === 'offers') body = offersTpl(M);
  else body = historyTpl(M);
  return `<div class="mgr" data-testid="manager">${heroTpl(M, meta)}${M.review ? `<button type="button" class="alert alert-season_review" data-act="review" data-testid="mgr-review-open"><span class="al-ico">${ico('flag', 'gold')}</span><span class="grow">סיכום העונה ${esc(M.review.seasonHe)} מחכה לך</span><span class="chev">‹</span></button>` : ''}${seg}${body}</div>`;
}

function heroTpl(M, meta) {
  const J = M.job;
  const av = `<div class="mgr-av">${coachAvatar(meta, J && J.team)}</div>`;
  if (!J) {
    return `<section class="mgr-hero" data-testid="mgr-hero"><div class="mgr-hgrid">
      <div class="mgr-crest">${badge(null, 'xl')}</div>
      <div class="mgr-who"><span class="mgr-role">${esc(M.titleHe)} · ${esc(M.repHe)}</span><b class="mgr-team">${esc(M.name)}</b><span class="mgr-lg">${esc(M.statusHe || '')}</span></div>${av}</div>
      <div class="mgr-strip">${kpi('מוניטין', M.rep)}${kpi('משחקים', M.record.games)}${kpi('אחוז ניצחונות', M.record.winPct + '%')}${kpi('תארים', M.trophies.reduce((s, t) => s + t.count, 0))}</div></section>`;
  }
  return `<section class="mgr-hero" data-testid="mgr-hero"><div class="mgr-hgrid">
    <div class="mgr-crest">${crestOf(J.team, 'xl')}</div>
    <div class="mgr-who"><span class="mgr-role">${esc(J.roleHe)}</span><b class="mgr-team" data-testid="mgr-team">${esc(J.team.nameHe)}</b>
      <span class="mgr-lg">${esc(J.leagueHe || '')}${J.rank ? ' · מקום ' + esc(J.rank) : ''}</span>
      <span class="mgr-lg">${esc(M.name)} · ${esc(M.repHe)}</span></div>${av}</div>
    <div class="mgr-strip">${kpi('חוזק', J.strength)}${wdlKpi(M)}${kpi('מוניטין', M.rep)}${kpi('שכר לשבוע', J.wageHe.replace(' לשבוע', ''))}</div>
  </section>`;
}
/** W·D·L without spaces (stays on one line in a narrow tile; the neutral dot keeps the RTL order נ, ת, ה). */
function wdl(r) { return (r.w || 0) + '·' + (r.d || 0) + '·' + (r.l || 0); }
/** 'נ 12 · ת 13 · ה 13' with inline labels (trusted HTML). */
function wdlHtml(r) { return `<small>נ</small>${esc(r.w || 0)}<i class="sep">·</i><small>ת</small>${esc(r.d || 0)}<i class="sep">·</i><small>ה</small>${esc(r.l || 0)}`; }
/** Record tile of the hero: this season, or last season's record during the summer break. */
function wdlKpi(M) {
  const J = M.job;
  let r = J.season, label = 'מאזן העונה';
  if (M.phase === 'summer' && !(r.games > 0)) {
    const last = (M.seasons || []).find((s) => s.team && J.team && s.team.id === J.team.id && s.games > 0);
    if (last) { r = last; label = 'מאזן ' + last.seasonHe; }
  }
  return `<div class="mgr-kpi"><b class="num wdl">${wdlHtml(r)}</b><small>${esc(label)}</small></div>`;
}
function kpi(label, value, sub = '', cls = '') { return `<div class="mgr-kpi"><b class="num${cls ? ' ' + cls : ''}">${esc(value)}</b><small>${esc(label)}${sub ? ' ' + esc(sub) : ''}</small></div>`; }

function officeTpl(M) {
  const J = M.job;
  if (!J) {
    return `${M.offers.length ? card(M.offers.map(offerCard).join(''), { title: 'הצעות עבודה', cls: 'gold-card', testid: 'mgr-offers' }) : card(`<p class="muted">${esc(gtext('עוד אין הצעות. {{המשך|המשיכי}} לעקוב אחרי הליגות, הטלפון יצלצל.'))}</p>`, { title: 'מחכים להצעה' })}
      <section class="card"><div class="mgr-actions">
        <button type="button" class="btn btn-gold btn-xl grow" data-act="advance" data-testid="mgr-advance"><span>${esc(gtext('{{המשך|המשיכי}} לשבוע הבא'))}</span></button>
        <button type="button" class="btn btn-ff" data-act="ff" data-testid="mgr-ff" aria-label="קפיצה קדימה">${svgI('<path d="M3 6v12l8-6zM12 6v12l8-6z"/>')}</button></div></section>
      ${recentTpl(M)}${retireBtn()}`;
  }
  const o = M.phase === 'summer' ? null : J.objective;
  const objCard = o ? card(`<div class="mgr-obj"><span class="mgr-obj-ico">${ico('target')}</span><div class="grow"><b>${esc(o.he)}</b><small class="muted">${esc([o.rankHe, J.expRank ? 'צפי לפי חוזק: מקום ' + J.expRank : ''].filter(Boolean).join(' · '))}</small></div><span class="obj-st obj-${esc(o.status)}" data-testid="mgr-obj-status">${esc(o.statusHe)}</span></div>`, { title: J.kind === 'nation' ? 'היעד של ההתאחדות' : 'היעד של ההנהלה', testid: 'mgr-objective' })
    : card(`<div class="mgr-obj"><span class="mgr-obj-ico">${ico('calendar')}</span><div class="grow"><b>${esc(M.phase === 'summer' ? 'פגרת קיץ' : 'היעד לעונה')}</b><small class="muted">${esc('היעד החדש ייקבע בפגישת הפתיחה של העונה.')}</small></div></div>`, { title: J.kind === 'nation' ? 'היעד של ההתאחדות' : 'היעד של ההנהלה', testid: 'mgr-objective' });
  const bars = card(`<div class="mgr-bars">${J.bars.map((b) => bar(b.he, b.value, { testid: 'mgr-bar-' + b.key })).join('')}</div>`, { title: 'מדדים', testid: 'mgr-bars' });
  const nx = M.next;
  const mp = nx ? `<div class="mgr-mp">
      <div class="side${nx.isHome ? ' mine' : ''}">${crestOf(nx.home, 'l')}<b>${teamLabel(nx.home)}</b></div>
      <div class="mid"><span class="chip comp kind-${esc(nx.kind)}">${esc(nx.compHe)}</span><span class="mgr-vs">VS</span><small class="muted">${esc(nx.week === M.week ? 'השבוע' : nx.dateHe)}</small>${nx.big ? '<span class="big-tag">★ משחק גדול</span>' : ''}</div>
      <div class="side${!nx.isHome ? ' mine' : ''}">${crestOf(nx.away, 'l')}<b>${teamLabel(nx.away)}</b></div></div>`
    : `<p class="muted center">${esc('אין משחקים בשבועות הקרובים.')}</p>`;
  const T = M.tactic;
  const cur = T.options.find((x) => x.id === T.current) || T.options[1];
  const tac = `<div class="tac-grid" role="radiogroup" aria-label="טקטיקה">${T.options.map((x) => `<button type="button" class="tac${x.id === T.current ? ' on' : ''}" role="radio" aria-checked="${x.id === T.current}" data-act="tac" data-v="${esc(x.id)}" data-testid="mgr-tactic-${esc(x.id)}">${x.rec ? '<span class="tac-rec">מומלץ</span>' : ''}${svgI(TAC_ICO[x.id] || TAC_ICO.balanced)}<span>${esc(x.he)}</span></button>`).join('')}</div>
    <p class="tac-desc">${esc(cur ? cur.desc : '')}${T.pressWarn ? ' ' + ico('warn', 'warn') + ' ' + esc(gtext('{{השחקנים עייפים|השחקניות עייפות}} מהלחץ.')) : ''}${J.tacticNoteHe ? ' ' + esc(J.tacticNoteHe) : ''}</p>`;
  const week = `<section class="card week-card" data-testid="mgr-week"><h2 class="card-title"><span>${esc(M.dateHe)}</span></h2>${mp}
    <h3 class="sub">${esc(J.role === 'assistant' ? 'ההמלצה הטקטית שלך' : 'הטקטיקה למשחק')}</h3>${tac}
    <div class="mgr-actions">
      <button type="button" class="btn btn-gold btn-xl grow" data-act="advance" data-testid="mgr-advance"><span>${esc(gtext(nx && nx.week === M.week ? 'לשריקת הפתיחה!' : '{{שחק|שחקי}} את השבוע'))}</span></button>
      <button type="button" class="btn btn-ff" data-act="ff" data-testid="mgr-ff" aria-label="קפיצה קדימה">${svgI('<path d="M3 6v12l8-6zM12 6v12l8-6z"/>')}</button>
    </div></section>`;
  const tbl = M.table && M.table.rows.length ? card(`<div class="mgr-tbl">${tableGroup({ he: '', rows: M.table.rows }, { compact: true })}</div><a class="btn btn-ghost btn-sm" href="#/tables/${esc(encodeURIComponent(M.table.id))}">לטבלה המלאה ‹</a>`, { title: M.table.he || 'טבלה' }) : '';
  return `${objCard}${week}${bars}${recentTpl(M)}${tbl}`;
}

function recentTpl(M) {
  if (!M.recent.length) return '';
  return card(M.recent.map((r) => `<button type="button" class="mgr-res" data-act="reel" data-key="${esc(r.key)}" data-testid="mgr-result">
      ${resPill(r.res)}
      <span class="teams">${crestOf(r.home, 'xs')}<span class="tname">${teamLabel(r.home)}</span>${scoreBox(r.score)}<span class="tname">${teamLabel(r.away)}</span>${crestOf(r.away, 'xs')}</span>
      <span class="meta"><span>${esc(r.compHe)}</span><span class="mgr-play">${ico('play')} תקציר</span></span></button>`).join(''), { title: 'תוצאות אחרונות', testid: 'mgr-recent' });
}

function squadTpl(M) {
  const J = M.job;
  const T = J && J.transfers;
  if (!T) return card(empty('העברות זמינות רק {{למאמן ראשי|למאמנת ראשית}} של מועדון', '🔁'));
  const head = `<div class="mgr-budget"><div><small class="muted">תקציב העברות</small><br><b class="num" data-testid="mgr-budget">${esc(T.budgetHe)}</b></div>
    ${T.open ? `<button type="button" class="btn btn-sm" data-act="budget" data-testid="mgr-budget-req" ${T.canRequest ? '' : 'disabled'}>${esc(T.canRequest ? 'בקשת תקציב מההנהלה' : 'כבר ביקשת בחלון הזה')}</button>` : ''}</div>
    <p class="note${T.open ? ' good' : ''}">${T.open ? `${ico('swap')} חלון ההעברות פתוח · החתמת ${esc(T.used)} מתוך ${esc(T.max)}` : 'חלון ההעברות סגור. הוא נפתח בקיץ ובשבועות 22-26.'}</p>`;
  const targets = T.open && T.targets.length ? T.targets.map((t) => `<div class="mgr-tgt" data-testid="mgr-target">
      <span class="mgr-ovr num${t.ovr >= J.strength + 5 ? ' hi' : ''}">${esc(t.ovr)}</span>
      <span class="grow"><b>${esc(t.name)}</b><small class="muted"> · ${esc(t.posHe)} · גיל ${esc(t.age)}</small><br><small class="muted">${esc(t.feeHe)} · חוזק הקבוצה ${esc(ltr('+' + t.gain))}</small></span>
      ${t.signed ? `<span class="chip good">${ico('check')} ${esc(gtext('{{נחתם|נחתמה}}'))}</span>` : `<button type="button" class="btn btn-sm btn-primary" data-act="sign" data-id="${esc(t.id)}" data-testid="mgr-sign-${esc(t.id)}" ${t.affordable && T.used < T.max ? '' : 'disabled'}>${esc(t.affordable ? 'להחתים' : 'אין תקציב')}</button>`}</div>`).join('') : '';
  const signed = T.signed.length ? card(T.signed.map((x) => `<div class="kv"><span>${esc(x.name)} · ${esc(x.pos)} · ${esc(x.ovr)}</span><b class="num">${esc(x.feeHe)} <small class="muted">${esc(x.seasonHe)}</small></b></div>`).join(''), { title: 'החתמות' }) : '';
  return `${card(head + targets, { title: 'שוק ההעברות', testid: 'mgr-transfers' })}${signed}`;
}

function offerCard(o) {
  return `<div class="mgr-offer" data-testid="mgr-offer">
    <div class="top">${crestOf(o.team, 'l')}<div class="grow"><b>${esc(o.team.nameHe)}</b><small class="muted">${esc(o.roleHe)}${o.leagueHe ? ' · ' + esc(o.leagueHe) : ''}</small>${o.whyHe ? `<span class="why">${esc(o.whyHe)}</span>` : ''}</div></div>
    <div class="kvs"><div><small>חוזק</small><b class="num">${esc(o.strength)}</b></div><div><small>שכר לשבוע</small><b class="num">${esc(o.wageHe.replace(' לשבוע', ''))}</b></div><div><small>חוזה</small><b class="num">${esc(o.years)} שנים</b></div></div>
    ${o.objHe ? `<small class="muted">${ico('target')} ${esc(o.objHe)}</small>` : ''}${o.expHe ? `<small class="muted">${esc(o.expHe)}</small>` : ''}
    <div class="btn-row"><button type="button" class="btn btn-primary" data-act="offer" data-a="accept" data-id="${esc(o.id)}" data-testid="mgr-offer-accept-${esc(o.id)}">${esc(gtext('{{קבל|קבלי}} את התפקיד'))}</button>
      <button type="button" class="btn btn-ghost" data-act="offer" data-a="reject" data-id="${esc(o.id)}">לא מעוניין${esc(g('', 'ת'))}</button></div></div>`;
}
function offersTpl(M) {
  return M.offers.length ? card(M.offers.map(offerCard).join(''), { title: 'הצעות עבודה', cls: 'gold-card', testid: 'mgr-offers' })
    : card(empty('אין כרגע הצעות. הצלחה על הקווים מביאה הצעות ממועדונים גדולים יותר.', '📨'), { title: 'הצעות עבודה' });
}

function cabinetTpl(M) {
  const tr = M.trophies || [], aw = M.awards || [];
  if (!tr.length && !aw.length) return card(empty('ארון התארים של {{המאמן|המאמנת}} עוד ריק', '🏆'), { title: 'ארון התארים כ' + g('מאמן', 'מאמנת') });
  return card(`${tr.length ? `<div class="cabinet">${tr.map((x) => `<div class="cab-item"><span class="cab-ico">${trophyIco(x.key)}</span><b>${esc(x.he)}</b>${x.count > 1 ? `<span class="cab-n num">×${esc(x.count)}</span>` : ''}<small class="muted">${esc(x.seasonsHe)}</small></div>`).join('')}</div>` : ''}
    ${aw.length ? `<h3 class="sub">פרסים</h3><div class="cabinet">${aw.map((x) => `<div class="cab-item"><span class="cab-ico">${awardIco(x.key)}</span><b>${esc(x.he)}</b>${x.count > 1 ? `<span class="cab-n num">×${esc(x.count)}</span>` : ''}<small class="muted">${esc(x.seasonsHe)}</small></div>`).join('')}</div>` : ''}`,
  { title: 'ארון התארים כ' + g('מאמן', 'מאמנת'), cls: 'gold-card', testid: 'mgr-cabinet' });
}
function historyTpl(M) {
  const R = M.record;
  const rec = card(statGrid([{ label: 'משחקים', value: R.games }, { label: 'ניצחונות', value: R.w }, { label: 'תיקו', value: R.d }, { label: 'הפסדים', value: R.l }, { label: 'שערים', value: R.gf + ':' + R.ga }, { label: 'אחוז ניצחונות', value: R.winPct + '%' }]), { title: 'המאזן על הקווים' });
  const seasons = M.seasons.length ? card(`<div class="tbl-scroll"><table class="tbl simple mgr-hist"><thead><tr><th>עונה</th><th class="tm">קבוצה</th><th>מקום</th><th>נ · ת · ה</th><th>יעד</th></tr></thead><tbody>
      ${M.seasons.map((s) => `<tr><td class="num">${esc(s.seasonHe)}</td><td class="tm"><b>${esc(s.team.nameHe)}</b><small class="muted">${esc(s.roleHe)}${s.leagueHe ? ' · ' + esc(s.leagueHe) : ''}</small>${s.trophies.length ? `<small class="chip gold">${trophyIco('', '')} ${esc(s.trophies.join(', '))}</small>` : ''}</td>
        <td class="num">${esc(s.rank || '-')}</td><td class="num">${esc(s.w + ' · ' + s.d + ' · ' + s.l)}</td><td>${s.met === true ? ico('check', 'good') : s.met === false ? ico('cross', 'bad') : '·'}</td></tr>`).join('')}
    </tbody></table></div>`, { title: 'עונות' }) : '';
  const jobs = M.jobs.length ? card(M.jobs.map((j) => `<div class="kv"><span>${crestOf(j.team, 'xs')} ${esc(j.he)} · <small class="muted">${esc(j.roleHe)}</small></span><b><span dir="ltr" class="num">${esc(j.fromHe === j.toHe ? j.fromHe : j.fromHe + "–" + j.toHe)}</span>${j.endHe ? ` <small class="muted">${esc(j.endHe)}</small>` : ''}</b></div>`).join(''), { title: 'תפקידים' }) : '';
  return `${cabinetTpl(M)}${rec}${seasons}${jobs}${retireBtn()}`;
}
function retireBtn() {
  return `<div class="mgr-retire"><button type="button" class="btn btn-danger btn-lg" data-act="retire" data-testid="mgr-retire">${esc(g('לפרוש מאימון', 'לפרוש מאימון'))}</button>
    <p class="muted small center">${esc(gtext('הקריירה תיכנס להיכל התהילה {{כשחקן וכמאמן|כשחקנית וכמאמנת}}.'))}</p></div>`;
}

function doneTpl(M, meta) {
  const c = M.coach;
  return `<div class="mgr" data-testid="manager"><section class="card hero-card center" data-testid="mgr-done">
      <div class="mgr-av" style="width:96px;margin:0 auto 8px" aria-hidden="true">${coachAvatar(meta, null, 96)}</div>
      <h1 class="big-title">${esc(g('תודה, המאמן', 'תודה, המאמנת'))}</h1>
      <p class="muted">${esc(M.name)} · ${c ? esc(c.seasons) + ' עונות על הקווים' : ''}</p></section>
    ${c ? card(statGrid([{ label: 'משחקים', value: c.games }, { label: 'ניצחונות', value: c.w }, { label: 'אחוז ניצחונות', value: c.winPct + '%' }, { label: 'תארים', value: c.trophyCount }, { label: 'מוניטין', value: c.rep }, { label: 'מורשת אימון', value: Math.round(c.legacy) }]), { title: 'קריירת האימון' }) : ''}
    ${cabinetTpl(M)}
    <div class="btn-col">
      <button type="button" class="btn btn-primary btn-lg" data-act="go" data-to="#/hof" data-testid="mgr-hof">${ico('hof')}להיכל התהילה</button>
      <button type="button" class="btn" data-act="go" data-to="#/career">${ico('doc')}הקריירה שלי</button>
      <button type="button" class="btn" data-act="go" data-to="#/new">${ico('ball')}קריירה חדשה</button>
    </div></div>`;
}

/* ------------------------------------------------------------------ */
/* Watch mode: result reel                                             */
/* ------------------------------------------------------------------ */
function playReel(r, { lines = null } = {}) {
  ensureCss();
  return new Promise((resolve) => {
    const reel = Array.isArray(r.reel) ? r.reel : [];
    const total = reel.length ? Math.max(90, reel[reel.length - 1].minute) : 90;
    const reduce = reducedMotion();
    const ms = reduce ? 0 : 6200;
    let shown = 0, timer = null, done = false, result = 'ok';
    const close = openModal(`<div class="mgr-reel">
        <div class="muted small center">${esc(r.compHe || '')}${r.roundHe ? ' · ' + esc(r.roundHe) : ''}</div>
        <div class="rl-board">
          <div class="rl-side">${crestOf(r.home, 'l')}<span>${teamLabel(r.home)}</span></div>
          <div class="rl-mid" style="display:grid;gap:6px;justify-items:center"><b class="rl-score num" data-testid="mgr-reel-score">0 - 0</b><span class="rl-clock num">0'</span></div>
          <div class="rl-side">${crestOf(r.away, 'l')}<span>${teamLabel(r.away)}</span></div>
        </div>
        <div class="rl-bar"><i></i></div>
        <div class="rl-log" aria-live="polite"></div>
        <div class="rl-end" hidden><p class="center"><b class="rl-final"></b></p><div class="mgr-delta">${(lines ? lines.concat((r.effectsHe || []).filter((x) => x === 'דרבי!')) : (r.effectsHe || [])).map(lineChip).join('')}</div></div>
        <div class="btn-row"><button type="button" class="btn btn-ghost" data-a="skip" data-testid="mgr-reel-skip">${ico('skip')}דלג</button><button type="button" class="btn btn-primary" data-a="next" data-testid="mgr-reel-next" hidden>המשך</button></div>
      </div>`, { testid: 'mgr-reel', cls: 'mgr-reel-modal', dismissible: false, label: 'תקציר המשחק', onClose: (why) => { if (timer) clearInterval(timer); resolve(why === 'nav' ? 'nav' : result); } });
    const el = close.el;
    const scoreEl = el.querySelector('.rl-score'), clockEl = el.querySelector('.rl-clock'), barEl = el.querySelector('.rl-bar i'), log = el.querySelector('.rl-log');
    // the board is LTR: away score on the left (next to the away crest), home score on the right
    const sc = (x) => x[1] + ' - ' + x[0];
    const ICO = { goal: 'ball', chance: 'spark', card: 'card', ht: 'pause', ft: 'flag', et: 'clock', pens: 'target', kickoff: 'whistle' };
    const push = (e) => {
      const d = document.createElement('div');
      d.className = 'rl-ev ' + esc(e.ev) + (e.own ? ' own' : '');
      d.innerHTML = `<span class="m num">${esc(e.ev === 'kickoff' ? '' : e.minute + "'")}</span><span>${ico(ICO[e.ev] || 'info')}${esc(e.textHe)}</span>`;
      log.prepend(d);
      if (e.ev === 'goal') { scoreEl.textContent = sc(e.score); scoreEl.classList.remove('rl-flash'); void scoreEl.offsetWidth; scoreEl.classList.add('rl-flash'); }
    };
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearInterval(timer);
      while (shown < reel.length) push(reel[shown++]);
      scoreEl.textContent = sc(r.score);
      clockEl.textContent = (r.extraHe ? r.extraHe : 'סיום');
      barEl.style.width = '100%';
      const fin = el.querySelector('.rl-final');
      fin.textContent = (r.res === 'W' ? 'ניצחון!' : r.res === 'L' ? 'הפסד' : 'תיקו') + (r.tacticHe ? ' · טקטיקה: ' + r.tacticHe : '');
      el.querySelector('.rl-end').hidden = false;
      el.querySelector('[data-a="skip"]').hidden = true;
      el.querySelector('[data-a="next"]').hidden = false;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'skip') finish();
      else close('ok');
    });
    if (!ms) { finish(); return; }
    const t0 = Date.now();
    timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - t0) / ms);
      const minute = Math.round(t * total);
      clockEl.textContent = minute + "'";
      barEl.style.width = (t * 100).toFixed(1) + '%';
      while (shown < reel.length && reel[shown].minute <= minute) push(reel[shown++]);
      if (t >= 1) finish();
    }, 80);
  });
}

/* ------------------------------------------------------------------ */
/* Week summary + season review                                        */
/* ------------------------------------------------------------------ */
function showSummary(sum, { ffWeeks = 0, stopped = null, agg = null } = {}) {
  return new Promise((resolve) => {
    const multi = ffWeeks > 1;
    const rows = (sum.results || []).map((r) => `<div class="row">${resPill(r.res)}<span style="display:flex;flex-direction:column;gap:3px;min-width:0;flex:1"><span class="teams" style="display:flex;gap:6px;align-items:center">${crestOf(r.home, 'xs')}<span>${teamLabel(r.home)}</span>${scoreBox(r.score)}<span>${teamLabel(r.away)}</span>${crestOf(r.away, 'xs')}</span><small class="muted">${esc(r.compHe)}</small></span></div>`).join('');
    const lines = (sum.linesHe || []).map(lineChip).join('');
    const stop = stopped && STOP_HE[stopped] ? `<p class="note">${STOP_ICO[stopped] ? ico(STOP_ICO[stopped]) + ' ' : ''}${esc(STOP_HE[stopped])}</p>` : '';
    if (!rows && !lines && !stop && !ffWeeks) { resolve(); return; }
    // fast-forward: the span's matches and W-D-L, then the last match (never "no matches this week" after 40 weeks)
    const kp = (v, l) => `<div class="mgr-kpi"><b class="num">${esc(v)}</b><small>${esc(l)}</small></div>`;
    const span = multi && agg ? (agg.g ? `<div class="agg">${kp(agg.g, 'משחקים')}${kp(agg.w, 'ניצחונות')}${kp(agg.d, 'תיקו')}${kp(agg.l, 'הפסדים')}</div>` : '<p class="muted">לא היו משחקים בתקופה הזו.</p>') : '';
    const body = multi ? span + (rows ? '<h3 class="sub">המשחק האחרון</h3><div class="rows">' + rows + '</div>' : '') : (rows ? '<div class="rows">' + rows + '</div>' : '<p class="muted">לא היו משחקים השבוע.</p>');
    openModal(`<div class="mgr-sum"><h2 class="modal-title">${ffWeeks > 1 ? 'קפצנו ' + esc(ffWeeks) + ' שבועות' : 'סיכום השבוע'}</h2>
      <div class="muted small">${esc(sum.dateHe || '')}</div>${stop}
      ${body}
      ${lines ? `<div class="mgr-delta">${lines}</div>` : ''}
      <div class="btn-row"><button type="button" class="btn btn-primary" data-close data-testid="mgr-summary-close">המשך</button></div></div>`, { testid: 'mgr-summary', onClose: () => resolve() });
  });
}

function showReview(rv) {
  return new Promise((resolve) => {
    const rows = rv.rows || [];
    const body = rows.map((r) => `<section class="card${r.met ? ' gold-card' : ''}">
        <div class="row" style="display:flex;gap:10px;align-items:center">${crestOf(r.team, 'l')}<div class="grow"><b>${esc(r.team.nameHe)}</b><br><small class="muted">${esc(r.roleHe)}${r.leagueHe ? ' · ' + esc(r.leagueHe) : ''}</small></div>
          ${r.rank ? `<div class="mgr-kpi"><b class="num">${esc(r.rank)}</b><small>מקום</small></div>` : ''}</div>
        ${r.objHe && r.met !== null && r.met !== undefined ? `<p class="note ${r.met ? 'good' : 'warn'}">${r.met ? ico('check', 'good') + ' עמדת ביעד' : ico('cross', 'bad') + ' לא עמדת ביעד'}: ${esc(r.objHe)}</p>` : ''}
        ${statGrid([{ label: 'משחקים', value: r.games }, { label: 'נ · ת · ה', value: wdl(r) }, { label: 'שערים', value: r.gf + ':' + r.ga }]).replace('<b class="num">' + esc(wdl(r)), '<b class="num wdl">' + esc(wdl(r)))}
        ${r.trophies.length ? `<div class="chips">${r.trophies.map((t) => `<span class="chip gold">${trophyIco('', '')} ${esc(t)}</span>`).join('')}</div>` : ''}</section>`).join('');
    const close = openModal(`<h2 class="modal-title">${ico('flag', 'gold')} סיכום העונה ${esc(rv.seasonHe)}</h2>${body || '<p class="muted">עונה ללא משחקים.</p>'}
      <div class="btn-row"><button type="button" class="btn btn-gold btn-lg" data-a="ack" data-testid="mgr-review-ack">לעונה הבאה ›</button></div>`, { testid: 'mgr-review', onClose: () => resolve() });
    close.el.addEventListener('click', (e) => {
      if (!e.target.closest('[data-a="ack"]')) return;
      call(() => game.mgrAckReview(), { quiet: true });
      close();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Signing confirm sheet (same pattern as the shop's buy sheet)        */
/* ------------------------------------------------------------------ */
function signSheet(t, T) {
  return new Promise((resolve) => {
    let ok = false;
    const close = openModal(`<div class="mgr-sign">
        <h2 class="modal-title">${esc(gtext('להחתים את ' + t.name + '?'))}</h2>
        <p class="muted small">${esc(t.posHe)} · גיל ${esc(t.age)} · דירוג ${esc(t.ovr)}</p>
        <div class="kv"><span>דמי העברה</span><b class="num">${esc(t.feeHe)}</b></div>
        <div class="kv"><span>חוזק הקבוצה</span><b class="num" style="color:#2BD07A">${esc(ltr('+' + t.gain))}</b></div>
        <div class="kv"><span>תקציב אחרי ההחתמה</span><b class="num">${esc(money(Math.max(0, (T.budget || 0) - (t.fee || 0))))}</b></div>
        <div class="btn-row">
          <button type="button" class="btn btn-gold" data-a="yes" data-testid="btn-confirm-yes">להחתים</button>
          <button type="button" class="btn btn-ghost" data-a="no" data-testid="btn-confirm-no">ביטול</button>
        </div></div>`, { sheet: true, testid: 'mgr-sign-sheet', onClose: () => resolve(ok) });
    close.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      ok = b.dataset.a === 'yes';
      close();
    });
  });
}
