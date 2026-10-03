// profile.js: #/profile. Attributes, OVR, potential, status, contract, money, owned items, transfer request, retire.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, toast, confirmDialog, hubSafe } from './app.js';
import { navigate } from './router.js';
import { attrRow, bar, stars, ovrCircle, contractCard, statGrid, card, empty } from './components.js';
import { money, rating } from './format.js';

export function render(root) {
  function draw() {
    const p = call(() => game.getProfile(), { quiet: true });
    const hub = hubSafe();
    if (!p) { root.innerHTML = empty('אין פרופיל להצגה', '👤'); return; }
    const st = p.status || {};
    const rep = st.rep || {};
    const retired = hub && hub.status === 'retired';
    const canReq = !!(hub && hub.canRequestTransfer);
    const hasClub = !!(hub && hub.club);
    root.innerHTML = `<div class="profile">
      <section class="card prof-head">
        <div class="hh-top">${ovrCircle(p.ovr, { size: 'l' })}
          <div class="grow"><b class="pname">${esc(p.name)}${p.nick ? ` <span class="muted">"${esc(p.nick)}"</span>` : ''}</b>
            <div class="small">${esc(p.flag || '')} ${esc(p.nationHe || '')} · ${esc(p.posHe || '')} · רגל ${esc(p.footHe || '')} · גיל ${esc(p.age)}</div>
            <div class="small muted">${esc(p.clubHe || 'ללא קבוצה')} · ${esc(p.stageHe || '')}</div>
            <div class="pot-line">${stars(p.potStars, 'פוטנציאל')}<span class="muted small num" dir="ltr">${esc((p.potRange || []).join('-'))}</span></div>
          </div></div>
        ${(p.traitsHe || []).length ? `<div class="chips">${p.traitsHe.map((t) => `<span class="chip gold">${esc(t)}</span>`).join('')}</div>` : ''}
      </section>
      ${card(`<div class="attrs">${(p.attrs || []).map(attrRow).join('')}</div>`, { title: p.gk ? 'יכולות שוער' : 'יכולות' })}
      ${card(`${bar('⚡ אנרגיה', st.energy)}${bar('😊 מורל', st.morale)}${bar('📋 אמון המאמן', st.trust)}${bar('📣 אהבת הקהל', st.fans)}${bar('🤝 יחסים בקבוצה', st.mates)}
        <h3 class="sub">מוניטין</h3>${bar('בארץ', rep.l)}${bar('ביבשת', rep.c)}${bar('בעולם', rep.w)}`, { title: 'מצב' })}
      ${card(`<div class="kv"><span>בבנק</span><b class="num">${esc(money(p.money))}</b></div>
        <div class="kv"><span>שכר שבועי</span><b class="num">${esc(money(p.wage))}</b></div>
        <div class="kv"><span>שווי שוק</span><b class="num">${esc(money(p.value))}</b></div>`, { title: 'כסף' })}
      ${card(contractCard(p.contract), { title: 'חוזה' })}
      ${card(statGrid([
        { label: 'הופעות', value: (p.season || {}).apps ?? 0 }, { label: 'שערים', value: (p.season || {}).goals ?? 0 }, { label: 'בישולים', value: (p.season || {}).assists ?? 0 },
        { label: 'ציון', value: rating((p.season || {}).avgRating) }, { label: 'מצטיין', value: (p.season || {}).motm ?? 0 },
      ]), { title: 'העונה' })}
      ${card(statGrid([
        { label: 'הופעות', value: (p.career || {}).apps ?? 0 }, { label: 'שערים', value: (p.career || {}).goals ?? 0 }, { label: 'בישולים', value: (p.career || {}).assists ?? 0 },
        { label: 'נבחרת', value: (p.career || {}).caps ?? 0 }, { label: 'שערי נבחרת', value: (p.career || {}).intlGoals ?? 0 }, { label: 'תארים', value: (p.career || {}).trophies ?? 0 },
      ]), { title: 'קריירה' })}
      ${card((p.owned || []).length ? `<div class="chips">${p.owned.map((o) => `<span class="chip">${esc(o.he)}</span>`).join('')}</div>` : '<p class="muted small">עוד לא קנית כלום. החנות מחכה.</p>', { title: 'הרכוש שלי', extra: ' <a class="small" href="#/shop">לחנות ‹</a>' })}
      ${retired ? '' : `<div class="btn-col">
        ${canReq ? '<button type="button" class="btn" data-act="treq" data-testid="btn-transfer-request">📢 בקש העברה</button>'
          : hasClub && p.stageHe && hub.player.stage === 'pro' ? '<button type="button" class="btn btn-ghost" data-act="treq-cancel" data-testid="btn-transfer-cancel">בטל בקשת העברה</button>' : ''}
        ${hub && hub.canRetire ? '<button type="button" class="btn btn-danger" data-act="retire" data-testid="btn-retire">👋 לפרוש</button>' : ''}
      </div>`}
    </div>`;
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'treq') {
      const ok = await confirmDialog({ title: 'לבקש העברה?', text: 'האמון של המאמן והאוהדים ירד, אבל יגיעו יותר הצעות.', yes: 'כן, אני רוצה לעזוב' });
      if (!ok) return;
      const r = call(() => game.requestTransfer());
      if (r) toast(r.messageHe || (r.ok ? 'הבקשה נשלחה' : 'אי אפשר כרגע'));
      draw();
    } else if (act === 'treq-cancel') {
      const r = call(() => game.cancelTransferRequest());
      if (r) toast(r.messageHe || (r.ok ? 'הבקשה בוטלה' : 'אין בקשת העברה פעילה'));
      draw();
    } else if (act === 'retire') {
      const ok = await confirmDialog({ title: 'לתלות את הנעליים?', text: 'הפרישה סופית. הקריירה תיכנס להיכל התהילה ותוכל עדיין לדפדף בה.', yes: 'כן, אני פורש', danger: true });
      if (!ok) return;
      const r = call(() => game.retire());
      if (r && r.ok !== false) navigate('#/retire');
      else toast((r && r.messageHe) || 'אי אפשר לפרוש עכשיו');
    }
  });
  draw();
}
