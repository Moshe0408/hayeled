// profile.js: #/profile. FM-style player profile: card hero + tabbed panels (overview, attributes, contract, stats).
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, toast, confirmDialog, hubSafe } from './app.js';
import { navigate } from './router.js';
import { attrRow, attrTable, bar, stars, contractCard, statGrid, card, empty, playerCard, nationTeam, moraleIcon, formDots, segmented, badge } from './components.js';
import { money, rating } from './format.js';
import { g, gtext } from './gender.js';
import { mountTilt } from './fx.js';

const TABS = [{ id: 'overview', he: 'סקירה' }, { id: 'attrs', he: 'יכולות' }, { id: 'contract', he: 'חוזה וכסף' }, { id: 'stats', he: 'סטטיסטיקה' }];

export function render(root, params = {}) {
  let tab = TABS.some((t) => t.id === params.tab) ? params.tab : 'overview';
  let untilt = () => {};

  function draw() {
    const p = call(() => game.getProfile(), { quiet: true });
    const hub = hubSafe();
    if (!p) { root.innerHTML = empty('אין פרופיל להצגה', '👤'); return; }
    let meta = null;
    try { meta = game.getSaveMeta(); } catch { meta = null; }
    const st = p.status || {};
    const rep = st.rep || {};
    const retired = hub && hub.status === 'retired';
    const canReq = !!(hub && hub.canRequestTransfer);
    const hasClub = !!(hub && hub.club);
    const club = hub && hub.club;
    const nat = meta ? nationTeam(meta.nation) : null;
    const cardHtml = playerCard({ name: p.name, nick: p.nick, ovr: p.ovr, pos: meta && meta.pos, gk: p.gk, attrs: p.attrs, meta: meta || {}, club, nation: nat }, { size: 'l' });

    const head = `<section class="prof-hero">
      <div class="ph-card">${cardHtml}</div>
      <div class="ph-info">
        <b class="pname">${esc(p.name)}</b>${p.nick ? `<span class="pnick">"${esc(p.nick)}"</span>` : ''}
        <div class="ph-rows">
          <div class="ph-row"><small>עמדה</small><b>${esc(gtext(p.posHe || ''))}</b></div>
          <div class="ph-row"><small>גיל</small><b class="num">${esc(p.age)}</b></div>
          <div class="ph-row"><small>רגל</small><b>${esc(p.footHe || '')}</b></div>
          <div class="ph-row"><small>נבחרת</small><b>${nat ? badge(nat, 'xs') : ''} ${esc(p.nationHe || '')}</b></div>
          <div class="ph-row"><small>מועדון</small><b>${club ? badge(club, 'xs') : ''} ${esc(p.clubHe || 'ללא קבוצה')}</b></div>
          <div class="ph-row"><small>שלב</small><b>${esc(gtext(p.stageHe || ''))}</b></div>
        </div>
        <div class="pot-line"><span class="lbl">פוטנציאל</span>${stars(p.potStars, 'פוטנציאל')}<span class="muted small num" dir="ltr">${esc((p.potRange || []).join('-'))}</span></div>
      </div>
      ${(p.traitsHe || []).length ? `<div class="chips ph-traits">${p.traitsHe.map((t) => `<span class="chip gold">${esc(gtext(t))}</span>`).join('')}</div>` : ''}
    </section>`;

    let body = '';
    if (tab === 'overview') {
      body = `${card(`<div class="ov-kpis">
          <div class="kpi"><small>מורל</small>${moraleIcon(st.morale)}</div>
          <div class="kpi"><small>כושר אחרון</small>${formDots(hub && hub.player ? hub.player.form : [], { max: 5 })}</div>
        </div>
        ${bar('אנרגיה', st.energy)}${bar('מורל', st.morale)}${bar('אמון המאמן', st.trust)}${bar('אהבת הקהל', st.fans)}${bar('יחסים בקבוצה', st.mates)}`, { title: 'מצב' })}
        ${card(`${bar('בארץ', rep.l)}${bar('ביבשת', rep.c)}${bar('בעולם', rep.w)}`, { title: 'מוניטין' })}
        ${card(attrTable(p.attrs || []), { title: p.gk ? 'יכולות שוער' : 'יכולות', extra: '<a class="small" href="#/profile?tab=attrs" data-act="tab" data-v="attrs">לפירוט ‹</a>' })}`;
    } else if (tab === 'attrs') {
      body = `${card(`<div class="attrs">${(p.attrs || []).map(attrRow).join('')}</div>
        <div class="attr-legend"><span class="av-1">מתחת ל-40</span><span class="av-2">40-59</span><span class="av-3">60-69</span><span class="av-4">70-79</span><span class="av-5">80+</span></div>`, { title: p.gk ? 'יכולות שוער' : 'יכולות' })}
        ${card(`<p class="muted small">${esc(gtext('החצים מראים את השינוי מתחילת העונה. האימון השבועי והדקות במגרש קובעים כמה תשתפר{{|י}}.'))}</p>`, { title: 'התפתחות' })}`;
    } else if (tab === 'contract') {
      body = `${card(`<div class="money-row">
          <div class="mr-item"><small>בבנק</small><b class="num">${esc(money(p.money))}</b></div>
          <div class="mr-item"><small>שכר שבועי</small><b class="num">${esc(money(p.wage))}</b></div>
          <div class="mr-item"><small>שווי שוק</small><b class="num">${esc(money(p.value))}</b></div></div>`, { title: 'כסף' })}
        ${card(contractCard(p.contract), { title: 'חוזה' })}
        ${card((p.owned || []).length ? `<div class="chips">${p.owned.map((o) => `<span class="chip">${esc(gtext(o.he))}</span>`).join('')}</div>` : `<p class="muted small">${esc(g('עוד לא קנית כלום. החנות מחכה.', 'עוד לא קנית כלום. החנות מחכה.'))}</p>`, { title: 'הרכוש שלי', extra: ' <a class="small" href="#/shop">לחנות ‹</a>' })}`;
    } else {
      body = `${card(statGrid([
        { label: 'הופעות', value: (p.season || {}).apps ?? 0 }, { label: 'שערים', value: (p.season || {}).goals ?? 0 }, { label: 'בישולים', value: (p.season || {}).assists ?? 0 },
        { label: 'ציון', value: rating((p.season || {}).avgRating) }, { label: g('מצטיין', 'מצטיינת'), value: (p.season || {}).motm ?? 0 },
      ]), { title: 'העונה' })}
      ${card(statGrid([
        { label: 'הופעות', value: (p.career || {}).apps ?? 0 }, { label: 'שערים', value: (p.career || {}).goals ?? 0 }, { label: 'בישולים', value: (p.career || {}).assists ?? 0 },
        { label: 'נבחרת', value: (p.career || {}).caps ?? 0 }, { label: 'שערי נבחרת', value: (p.career || {}).intlGoals ?? 0 }, { label: 'תארים', value: (p.career || {}).trophies ?? 0 },
      ]), { title: 'קריירה' })}`;
    }

    untilt();
    root.innerHTML = `<div class="profile">
      ${head}
      ${segmented('ptab', TABS, tab)}
      <div class="tab-body">${body}</div>
      ${retired ? '' : `<div class="btn-col">
        ${canReq ? '<button type="button" class="btn" data-act="treq" data-testid="btn-transfer-request">📢 בקשת העברה</button>'
          : hasClub && p.stageHe && hub.player.stage === 'pro' ? '<button type="button" class="btn btn-ghost" data-act="treq-cancel" data-testid="btn-transfer-cancel">ביטול בקשת העברה</button>' : ''}
        ${hub && hub.canRetire ? `<button type="button" class="btn btn-danger" data-act="retire" data-testid="btn-retire">👋 ${esc(g('לפרוש', 'לפרוש'))}</button>` : ''}
      </div>`}
    </div>`;
    untilt = mountTilt(root);
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'seg') { tab = b.dataset.val; draw(); return; }
    if (act === 'tab') { e.preventDefault(); tab = b.dataset.v; draw(); return; }
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
      const ok = await confirmDialog({ title: 'לתלות את הנעליים?', text: 'הפרישה סופית. הקריירה תיכנס להיכל התהילה ות{{וכל|וכלי}} עדיין לדפדף בה.', yes: 'כן, אני {{פורש|פורשת}}', danger: true });
      if (!ok) return;
      const r = call(() => game.retire());
      if (r && r.ok !== false) navigate('#/retire');
      else toast((r && r.messageHe) || 'אי אפשר לפרוש עכשיו');
    }
  });
  draw();
  return () => untilt();
}
