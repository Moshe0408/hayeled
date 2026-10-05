// career.js: #/career. Tabs: timeline, seasons, trophies + awards, clubs.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call } from './app.js';
import { gtext } from './gender.js';
import { segmented, empty, statGrid, badge, teamLabel, card } from './components.js';
import { rating } from './format.js';
import { ico, timelineIco, trophyIco, awardIco } from './icons.js';


/** R2: coaching record (getCareer().coach), shown under the player totals once a coaching career exists. */
function coachCard(k) {
  if (!k || !k.games) return '';
  return card(statGrid([
    { label: 'עונות', value: k.seasons ?? 0 }, { label: 'משחקים', value: k.games ?? 0 }, { label: 'אחוז ניצחונות', value: (k.winPct ?? 0) + '%' },
    { label: 'ניצחונות', value: k.w ?? 0 }, { label: 'תארים', value: k.trophyCount ?? 0 }, { label: 'מוניטין', value: k.rep ?? 0 },
  ]) + ((k.jobs || []).length ? `<p class="small muted">${k.jobs.map((j) => esc((j.roleHe ? j.roleHe + ' · ' : '') + j.he)).join(' ← ')}</p>` : ''), { title: gtext('{{הקריירה כמאמן|הקריירה כמאמנת}}'), testid: 'career-coach' });
}

export function render(root, params = {}) {
  const c = call(() => game.getCareer(), { quiet: true });
  if (!c) { root.innerHTML = empty('אין נתוני קריירה', '📜'); return; }
  let tab = ['timeline', 'seasons', 'trophies', 'clubs'].includes(params.tab) ? params.tab : 'timeline';
  const t = c.totals || {};

  function body() {
    if (tab === 'timeline') {
      const tl = c.timeline || [];
      return tl.length ? `<ol class="timeline">${tl.map((x) => `<li><span class="tl-ico" aria-hidden="true">${timelineIco(x.icon)}</span><div><b>${esc(x.textHe)}</b><small class="muted">${esc(x.dateHe || '')}</small></div></li>`).join('')}</ol>` : empty('הסיפור שלך רק מתחיל...', '📜');
    }
    if (tab === 'seasons') {
      const ss = c.seasons || [];
      return ss.length ? `<div class="tbl-scroll"><table class="tbl simple seasons"><thead><tr><th>עונה</th><th class="tm">קבוצה</th><th>גיל</th><th>הופ׳</th><th>שע׳</th><th>בי׳</th><th>ציון</th><th>דירוג</th></tr></thead><tbody>
        ${ss.map((s) => `<tr><td class="num">${esc(s.seasonHe)}</td><td class="tm"><b>${esc(s.clubHe || '-')}</b>${s.loan ? ' <small class="chip">השאלה</small>' : ''}<small class="muted">${esc(s.leagueHe || '')}${s.rank ? ' · מקום ' + esc(s.rank) : ''}</small></td>
          <td class="num">${esc(s.age)}</td><td class="num">${esc(s.apps)}</td><td class="num">${esc(s.goals)}</td><td class="num">${esc(s.assists)}</td><td class="num">${esc(rating(s.avgRating))}</td><td class="num">${esc(s.ovr)}</td></tr>`).join('')}
        </tbody></table></div>` : empty('עוד לא הושלמה עונה', '📅');
    }
    if (tab === 'trophies') {
      const tr = c.trophies || [];
      const aw = c.awards || [];
      return `${tr.length ? `<div class="cabinet">${tr.map((x) => `<div class="cab-item"><span class="cab-ico">${trophyIco(x.key)}</span><b>${esc(x.he)}</b>${x.count > 1 ? `<span class="cab-n num">×${esc(x.count)}</span>` : ''}<small class="muted">${esc(x.seasonsHe || '')}</small></div>`).join('')}</div>` : empty('ארון התארים עוד ריק. {{בוא|בואי}} נמלא אותו!', '🏆')}
        ${aw.length ? `<h3 class="sub">פרסים אישיים</h3><div class="cabinet">${aw.map((x) => `<div class="cab-item"><span class="cab-ico">${awardIco(x.key)}</span><b>${esc(x.he)}</b>${x.count > 1 ? `<span class="cab-n num">×${esc(x.count)}</span>` : ''}<small class="muted">${esc(x.seasonsHe || '')}</small></div>`).join('')}</div>` : ''}
        <a class="btn btn-ghost" href="#/awards">${esc(gtext('כל הפרסים וכדור הזהב{{| לנשים}} ‹'))}</a>`;
    }
    const cl = c.clubs || [];
    return cl.length ? `<div class="club-hist">${cl.map((x) => `<div class="ch-row">${badge(x.club)}<div class="grow"><b>${teamLabel(x.club, false)}</b>${x.loan ? ' <span class="chip">השאלה</span>' : ''}<small class="muted">${esc(x.fromHe || '')} – ${esc(x.toHe || 'היום')}</small></div><div class="small num">${esc(x.apps)} הופ׳ · ${esc(x.goals)} שע׳</div></div>`).join('')}</div>` : empty('אין עדיין מועדונים', '🏟️');
  }

  function draw() {
    root.innerHTML = `<div class="career">
      ${card(statGrid([
        { label: 'הופעות', value: t.apps ?? 0 }, { label: 'שערים', value: t.goals ?? 0 }, { label: 'בישולים', value: t.assists ?? 0 },
        { label: 'ציון ממוצע', value: rating(t.avgRating) }, { label: 'הופעות בנבחרת', value: t.caps ?? 0 }, { label: 'שערים בנבחרת', value: t.intlGoals ?? 0 },
        ...(t.youthCaps ? [{ label: 'נבחרות צעירות: הופעות', value: t.youthCaps }, { label: 'נבחרות צעירות: שערים', value: t.youthGoals ?? 0 }] : []),
      ]), { title: 'סה״כ בקריירה' })}
      ${coachCard(c.coach)}
      <div class="row gap career-links"><a class="btn btn-sm" href="#/profile">${ico('user')}פרופיל</a><a class="btn btn-sm" href="#/achievements" data-testid="btn-achievements">${ico('star')}הישגים</a><a class="btn btn-sm" href="#/friends" data-testid="btn-career-friends">${ico('users')}ליגת חברים</a><a class="btn btn-sm" href="#/leaderboard" data-testid="btn-career-board">${ico('table')}טבלת האגדות</a><a class="btn btn-sm" href="#/awards">${ico('medal')}פרסים</a></div>
      ${segmented('tab', [{ id: 'timeline', he: 'ציר זמן' }, { id: 'seasons', he: 'עונות' }, { id: 'trophies', he: 'תארים' }, { id: 'clubs', he: 'מועדונים' }], tab)}
      <div class="tab-body">${body()}</div>
    </div>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="seg"]');
    if (!b) return;
    tab = b.dataset.val;
    draw();
  });
  draw();
}
