// retire.js: #/retire. Farewell, legacy, totals, trophies. Records the Hall of Fame entry (idempotent).
// v2.1: coaching offers (R2) - legends get big clubs / the national team, good players assistant or lower-league jobs,
// average players youth / lower-league jobs. Accepting one starts the manager career (#/manager).
// The farewell avatar wears the last club's kit (R8).
import * as game from '../engine/game.js';
import * as save from '../core/save.js';
import { esc } from './dom.js';
import { ctx, call, confirmDialog, toast } from './app.js';
import { navigate } from './router.js';
import { statGrid, card, avatarFor, shirtNumber, badge, nationTeam } from './components.js';
import { rating } from './format.js';
import { maybePromptFeedback } from './feedback.js';
import { g, gtext } from './gender.js';
import { ico, trophyIco, awardIco } from './icons.js';

function crestOf(team, size) {
  if (team && (team.nation || team.flag)) return badge(nationTeam(team.nation || team.id) || team, size);
  return badge(team, size);
}
function recordHof() {
  try {
    const entry = game.buildHallOfFameEntry();
    if (entry) save.addHallOfFame(entry).catch((e) => console.warn('[hayeled] HoF', e));
  } catch (e) { console.warn('[hayeled] HoF entry', e); }
}

const RET_CSS = `.co-offer{display:grid;gap:10px;padding:12px;border-radius:12px;background:var(--well);box-shadow:var(--sh-1);margin-bottom:10px}
.co-offer:last-child{margin-bottom:0}.co-offer .top{display:flex;align-items:center;gap:10px}.co-offer .top .grow{display:grid;gap:2px;min-width:0}
.co-offer .why{font-size:12px;color:var(--gold)}.co-offer .kvs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.co-offer .kvs div{display:grid;gap:1px;padding:6px;border-radius:9px;background:rgba(255,255,255,.03);text-align:center}.co-offer .kvs small{font-size:11px;color:var(--muted)}
.co-intro{display:flex;gap:10px;align-items:center;margin-bottom:12px}.co-intro .ico{width:30px;height:30px;color:var(--gold)}
.co-offer.rec{box-shadow:var(--sh-1),0 0 0 1.5px rgba(244,195,90,.55) inset}
.co-offer .rec-tag{justify-self:start;font-size:11px;font-weight:900;color:#2a1b00;background:linear-gradient(180deg,var(--gold-hi),var(--gold));border-radius:999px;padding:2px 9px}
.co-offer .btn{min-height:44px}
.retire-sum{border-radius:var(--r);background:var(--panel);box-shadow:var(--sh-2);overflow:hidden}
.retire-sum>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:14px 16px;font:800 15px/1.2 var(--font-d)}
.retire-sum>summary::-webkit-details-marker{display:none}
.retire-sum>summary .chev{margin-inline-start:auto;transition:transform .2s;color:var(--muted)}
.retire-sum[open]>summary .chev{transform:rotate(-90deg)}
.retire-sum .rs-body{display:grid;gap:12px;padding:0 12px 12px}
.retire-sum .rs-body .card{margin:0}`;
function ensureCss() {
  if (document.getElementById('retire-css')) return;
  const st = document.createElement('style');
  st.id = 'retire-css';
  st.textContent = RET_CSS;
  document.head.appendChild(st);
}

const BAND_HE = {
  legend: 'אגדה כמוך לא נשארת בבית. המועדונים הגדולים והנבחרת כבר מתקשרים.',
  good: 'הקריירה שלך פתחה דלתות: אפשר להתחיל כ{{עוזר מאמן|עוזרת מאמן}} במועדון גדול או כ{{מאמן ראשי|מאמנת ראשית}} בליגה נמוכה.',
  average: 'כל {{מאמן|מאמנת}} גדול{{|ה}} התחיל{{|ה}} מלמטה: מחלקת {{הנוער|הנערות}} או ליגה נמוכה מחכות לך.',
};

export function render(root) {
  ensureCss();
  if (!game.hasCareer()) { navigate('#/title', { replace: true }); return; }
  let r = call(() => game.getRetirement(), { quiet: true });
  if (!r) { navigate('#/hub', { replace: true }); return; }
  // retired v2 careers (no coaching state yet) get their coaching offers now
  if (!r.coaching) { call(() => game.ensureCoachingOffers(), { quiet: true }); r = call(() => game.getRetirement(), { quiet: true }) || r; }
  const co = r.coaching;
  if (co && (co.st === 'active' || co.st === 'unemployed')) { navigate('#/manager', { replace: true }); return; }

  // Record in the Hall of Fame (idempotent by careerId).
  recordHof();

  const t = r.totals || {};
  const kit = r.lastClub && Array.isArray(r.lastClub.colors) ? r.lastClub.colors : null;
  const offers = co && co.st === 'offers' ? (co.offers || []) : [];
  const coach = co && co.record ? co.record : null;

  root.innerHTML = `<div class="retire" data-testid="retire-screen">
    <section class="card hero-card retire-hero">
      <div class="retire-art" aria-hidden="true">${(() => { try { const m = game.getSaveMeta(); return avatarFor(m, { size: 110, pose: 'full', bg: false, number: shirtNumber(m.pos, m.num), ...(kit ? { kitColors: kit } : {}) }); } catch { return '<div class="big-ico">' + ico('wave', 'gold') + '</div>'; } })()}</div>
      <h1 class="big-title">תודה, ${esc(r.name)}</h1>
      <p class="muted">${esc(r.reasonHe || '')} · גיל ${esc(r.age)} · ${esc(r.seasons)} עונות${r.lastClub ? ' · ' + esc(r.lastClub.nameHe) : ''}</p>
      <div class="legacy-big"><b class="num">${esc(Math.round(r.legacy || 0))}</b><span>${esc(r.tierHe || '')}</span><small class="muted">ציון מורשת</small></div>
    </section>
    ${offers.length ? card(`<div class="co-intro">${ico('clipboard')}<p class="small">${esc(gtext(BAND_HE[co.band] || BAND_HE.average))}</p></div>
      ${offers.map((o, i) => `<div class="co-offer${i === 0 ? ' rec' : ''}" data-testid="coach-offer">
        ${i === 0 && offers.length > 1 ? '<span class="rec-tag">ההצעה המומלצת</span>' : ''}
        <div class="top">${crestOf(o.team, 'l')}<div class="grow"><b>${esc(o.team.nameHe)}</b><small class="muted">${esc(o.roleHe)}${o.leagueHe ? ' · ' + esc(o.leagueHe) : ''}</small>${o.whyHe ? `<span class="why">${esc(o.whyHe)}</span>` : ''}</div></div>
        <div class="kvs"><div><small>חוזק</small><b class="num">${esc(o.strength)}</b></div><div><small>שכר לשבוע</small><b class="num">${esc(String(o.wageHe || '').replace(' לשבוע', ''))}</b></div><div><small>חוזה</small><b class="num">${esc(o.years)} שנים</b></div></div>
        ${o.objHe ? `<small class="muted">${ico('target')} ${esc(o.objHe)}</small>` : ''}
        <button type="button" class="btn ${i === 0 ? 'btn-gold' : ''}" data-act="coach" data-id="${esc(o.id)}" data-testid="coach-accept-${esc(o.id)}">${esc(gtext('{{קבל|קבלי}} את התפקיד ›'))}</button>
      </div>`).join('')}
      <button type="button" class="btn btn-ghost" data-act="decline" data-testid="coach-decline">${esc(g('לא תודה, אני פורש לגמרי', 'לא תודה, אני פורשת לגמרי'))}</button>`,
    { title: 'קריירה שנייה: על הקווים', cls: 'gold-card', testid: 'coach-offers' }) : ''}
    ${offers.length ? '<details class="retire-sum" data-testid="retire-summary"><summary>' + ico('doc', 'gold') + 'סיכום הקריירה' + ico('chevron', 'chev') + '</summary><div class="rs-body">' : ''}
    ${(r.farewellHe || []).length ? `<section class="card"><div class="bubbles">${r.farewellHe.map((l) => `<div class="bub them"><span>${esc(l)}</span></div>`).join('')}</div></section>` : ''}
    ${card(statGrid([
      { label: 'הופעות', value: t.apps ?? 0 }, { label: 'שערים', value: t.goals ?? 0 }, { label: 'בישולים', value: t.assists ?? 0 },
      { label: 'ציון ממוצע', value: rating(t.avgRating) }, { label: 'נבחרת', value: t.caps ?? 0 }, { label: 'דירוג שיא', value: r.peakOvr ?? 0 },
    ]), { title: 'הקריירה במספרים' })}
    ${coach ? card(statGrid([
      { label: 'עונות', value: coach.seasons }, { label: 'משחקים', value: coach.games }, { label: 'אחוז ניצחונות', value: coach.winPct + '%' },
      { label: 'תארים', value: coach.trophyCount }, { label: 'מוניטין', value: coach.rep }, { label: 'מורשת אימון', value: Math.round(coach.legacy) },
    ]) + (coach.jobs.length ? `<p class="small">${coach.jobs.slice().reverse().map((j) => esc(j.he)).join(' ← ')}</p>` : ''), { title: g('הקריירה כמאמן', 'הקריירה כמאמנת'), testid: 'retire-coach' }) : ''}
    ${(r.trophies || []).length ? card(`<div class="cabinet">${r.trophies.map((x) => `<div class="cab-item"><span class="cab-ico">${trophyIco(x.key)}</span><b>${esc(x.he)}</b>${x.count > 1 ? `<span class="cab-n num">×${esc(x.count)}</span>` : ''}</div>`).join('')}</div>`, { title: 'ארון התארים', cls: 'gold-card' }) : ''}
    ${(r.awards || []).length ? card(`<div class="cabinet">${r.awards.map((x) => `<div class="cab-item"><span class="cab-ico">${awardIco(x.key)}</span><b>${esc(x.he)}</b>${x.count > 1 ? `<span class="cab-n num">×${esc(x.count)}</span>` : ''}</div>`).join('')}</div>`, { title: 'פרסים אישיים' }) : ''}
    ${(r.clubsHe || []).length ? card(`<p>${r.clubsHe.map((c) => esc(c)).join(' ← ')}</p>`, { title: 'המסלול' }) : ''}
    ${offers.length ? '</div></details>' : ''}
    <div class="btn-col">
      <button type="button" class="btn btn-primary btn-lg" data-act="hof" data-testid="btn-retire-hof">${ico('hof')}להיכל התהילה</button>
      <button type="button" class="btn" data-act="career">${ico('doc')}הקריירה שלי</button>
      <button type="button" class="btn" data-act="new">${ico('ball')}קריירה חדשה</button>
      <button type="button" class="btn btn-ghost" data-act="fb">${ico('chat')}שלח משוב</button>
    </div>
  </div>`;

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'hof') navigate('#/hof');
    else if (act === 'career') navigate('#/career');
    else if (act === 'new') navigate('#/new');
    else if (act === 'fb') navigate('#/feedback?trigger=retired');
    else if (act === 'coach') {
      const o = offers.find((x) => x.id === b.dataset.id);
      if (!o) return;
      const ok = await confirmDialog({ title: o.roleHe + ' · ' + o.team.nameHe, text: gtext('{{מתחיל|מתחילה}} קריירה חדשה על הקווים. ההנהלה, האוהדים והשחקנים מחכים לך.'), yes: 'חותמים' });
      if (!ok) return;
      const res = call(() => game.mgrRespondOffer(o.id, 'accept'));
      import('../core/friends.js').then((m) => m.syncMyCareer({ force: true })).catch(() => {});
      if (res && res.ok) {
        try { if (ctx.hooks && ctx.hooks.saveNow) ctx.hooks.saveNow(); } catch { /* ignore */ }
        toast(g('ברוך הבא לקווים!', 'ברוכה הבאה לקווים!'), { tone: 'good' });
        navigate('#/manager', { replace: true });
      } else if (res && res.messageHe) toast(res.messageHe);
    } else if (act === 'decline') {
      const ok = await confirmDialog({ title: g('לפרוש לגמרי?', 'לפרוש לגמרי?'), text: 'ההצעות יבוטלו והקריירה תסתיים כאן.', yes: 'כן, לפרוש', danger: true });
      if (!ok) return;
      call(() => game.declineCoaching());
      recordHof();
      navigate('#/retire', { replace: true });
    }
  });

  const t1 = setTimeout(() => maybePromptFeedback('retired'), 1500);
  return () => clearTimeout(t1);
}
