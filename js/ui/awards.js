// awards.js: #/awards. Personal awards, Ballon d'Or history, rival benchmarks.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call } from './app.js';
import { card, empty } from './components.js';

export function render(root) {
  const a = call(() => game.getAwards(), { quiet: true });
  if (!a) { root.innerHTML = empty('אין נתוני פרסים', '🏅'); return; }
  const mine = a.mine || [];
  const bdo = a.ballonDor || [];
  const bench = a.seasonBenchmarks || [];
  root.innerHTML = `<div class="awards">
    ${card(mine.length ? `<div class="award-list">${mine.map((m) => `<div class="award-row"><span class="aw-ico">${m.key === 'ballon_dor' ? '🟡' : '🏅'}</span><div class="grow"><b>${esc(m.he)}</b>${m.detailHe ? `<small class="muted">${esc(m.detailHe)}</small>` : ''}</div><span class="muted small num">${esc(m.seasonHe)}</span></div>`).join('')}</div>` : empty('עוד אין פרסים אישיים. העונה הבאה שלך!', '🏅'), { title: 'הפרסים שלי' })}
    ${card(bdo.length ? `<div class="bdo-list">${bdo.map((b) => `<div class="bdo-row${b.rank === 1 ? ' won' : ''}"><div class="bdo-top"><b class="num">${esc(b.seasonHe)}</b><span class="chip${b.rank && b.rank <= 3 ? ' gold' : ''}">${esc(b.rankHe || (b.rank ? 'מקום ' + b.rank : 'לא היית מועמד'))}</span></div>
        ${(b.top3 || []).length ? `<ol class="top3">${b.top3.map((t) => `<li>${esc(t.flag || '')} <b>${esc(t.name)}</b> <small class="muted">${esc(t.clubHe || '')}</small></li>`).join('')}</ol>` : ''}</div>`).join('')}</div>` : empty('טקס כדור הזהב מתקיים בסוף כל קיץ', '🟡'), { title: '🟡 כדור הזהב' })}
    ${bench.length ? card(`<p class="muted small">כדי לזכות בתואר מלך השערים, צריך לעבור את המתחרים האלה:</p>${bench.map((b) => `<div class="kv"><span>${esc(b.compHe)}</span><b>${esc(b.scorerHe)}</b></div>`).join('')}`, { title: 'המתחרים העונה' }) : ''}
  </div>`;
}
