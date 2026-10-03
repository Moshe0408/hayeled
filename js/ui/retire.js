// retire.js: #/retire. Farewell, legacy, totals, trophies. Records the Hall of Fame entry (idempotent).
import * as game from '../engine/game.js';
import * as save from '../core/save.js';
import { esc } from './dom.js';
import { call } from './app.js';
import { navigate } from './router.js';
import { statGrid, card, avatarFor, shirtNumber } from './components.js';
import { rating } from './format.js';
import { maybePromptFeedback } from './feedback.js';

export function render(root) {
  if (!game.hasCareer()) { navigate('#/title', { replace: true }); return; }
  const r = call(() => game.getRetirement(), { quiet: true });
  if (!r) { navigate('#/hub', { replace: true }); return; }

  // Record in the Hall of Fame (idempotent by careerId).
  try {
    const entry = game.buildHallOfFameEntry();
    if (entry) save.addHallOfFame(entry).catch((e) => console.warn('[hayeled] HoF', e));
  } catch (e) { console.warn('[hayeled] HoF entry', e); }

  const t = r.totals || {};
  root.innerHTML = `<div class="retire" data-testid="retire-screen">
    <section class="card hero-card retire-hero">
      <div class="retire-art" aria-hidden="true">${(() => { try { const m = game.getSaveMeta(); return avatarFor(m, { size: 110, pose: 'full', bg: false, number: shirtNumber(m.pos) }); } catch { return '<div class="big-ico">👋</div>'; } })()}</div>
      <h1 class="big-title">תודה, ${esc(r.name)}</h1>
      <p class="muted">${esc(r.reasonHe || '')} · גיל ${esc(r.age)} · ${esc(r.seasons)} עונות</p>
      <div class="legacy-big"><b class="num">${esc(Math.round(r.legacy || 0))}</b><span>${esc(r.tierHe || '')}</span><small class="muted">ציון מורשת</small></div>
    </section>
    ${(r.farewellHe || []).length ? `<section class="card"><div class="bubbles">${r.farewellHe.map((l) => `<div class="bub them"><span>${esc(l)}</span></div>`).join('')}</div></section>` : ''}
    ${card(statGrid([
      { label: 'הופעות', value: t.apps ?? 0 }, { label: 'שערים', value: t.goals ?? 0 }, { label: 'בישולים', value: t.assists ?? 0 },
      { label: 'ציון ממוצע', value: rating(t.avgRating) }, { label: 'נבחרת', value: t.caps ?? 0 }, { label: 'שיא OVR', value: r.peakOvr ?? 0 },
    ]), { title: 'הקריירה במספרים' })}
    ${(r.trophies || []).length ? card(`<div class="cabinet">${r.trophies.map((x) => `<div class="cab-item"><span class="cab-ico">🏆</span><b>${esc(x.he)}</b>${x.count > 1 ? `<span class="cab-n num">×${esc(x.count)}</span>` : ''}</div>`).join('')}</div>`, { title: 'ארון התארים', cls: 'gold-card' }) : ''}
    ${(r.awards || []).length ? card(`<div class="cabinet">${r.awards.map((x) => `<div class="cab-item"><span class="cab-ico">🏅</span><b>${esc(x.he)}</b>${x.count > 1 ? `<span class="cab-n num">×${esc(x.count)}</span>` : ''}</div>`).join('')}</div>`, { title: 'פרסים אישיים' }) : ''}
    ${(r.clubsHe || []).length ? card(`<p>${r.clubsHe.map((c) => esc(c)).join(' ← ')}</p>`, { title: 'המסלול' }) : ''}
    <div class="btn-col">
      <button type="button" class="btn btn-primary btn-lg" data-act="hof" data-testid="btn-retire-hof">🏛️ להיכל התהילה</button>
      <button type="button" class="btn" data-act="career">📜 הקריירה שלי</button>
      <button type="button" class="btn" data-act="new">⚽ קריירה חדשה</button>
      <button type="button" class="btn btn-ghost" data-act="fb">💬 שלח משוב</button>
    </div>
  </div>`;

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'hof') navigate('#/hof');
    else if (act === 'career') navigate('#/career');
    else if (act === 'new') navigate('#/new');
    else if (act === 'fb') navigate('#/feedback?trigger=retired');
  });

  const t1 = setTimeout(() => maybePromptFeedback('retired'), 1500);
  return () => clearTimeout(t1);
}
