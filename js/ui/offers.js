// offers.js: #/offers. Contract card, offer cards, accept / reject / negotiate.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, toast, openModal, confirmDialog, hubSafe } from './app.js';
import { navigate } from './router.js';
import { badge, contractCard, card, empty } from './components.js';
import { money } from './format.js';
import { gtext } from './gender.js';
import { ico } from './icons.js';

const ROLE_ORDER = ['prospect', 'squad', 'rotation', 'key', 'star'];
const ROLE_HE = { star: '{{כוכב|כוכבת}} הקבוצה', key: '{{שחקן|שחקנית}} מפתח', rotation: 'רוטציה', squad: '{{שחקן|שחקנית}} סגל', prospect: 'כישרון צעיר' };
const TYPE_ICO = { transfer: 'plane', loan: 'swap', free: 'briefcase', precontract: 'doc', renewal: 'pen', pro: 'star' };

export function render(root) {
  function draw() {
    const offers = call(() => game.getOffers(), { quiet: true }) || [];
    const contract = call(() => game.getContract(), { quiet: true });
    const hub = hubSafe();
    const open = offers.filter((o) => o.status === 'open');
    const closed = offers.filter((o) => o.status !== 'open');
    root.innerHTML = `<div class="offers">
      ${card(contractCard(contract), { title: 'החוזה הנוכחי' })}
      ${hub && hub.windowOpen ? '<p class="note good">' + ico('swap') + ' חלון ההעברות פתוח</p>' : `<p class="muted small">${esc(gtext('הצעות מגיעות בעיקר בחלונות ההעברות (קיץ וינואר), או בכל שבוע {{כשאתה שחקן חופשי|כשאת שחקנית חופשייה}}.'))}</p>`}
      <h2 class="section-title">הצעות פתוחות</h2>
      ${open.length ? open.map(offerCard).join('') : empty('אין הצעות פתוחות כרגע. הסוכן עובד על זה...', '📨')}
      ${closed.length ? `<h2 class="section-title">הצעות קודמות</h2>${closed.map(offerCard).join('')}` : ''}
    </div>`;
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    const offers = call(() => game.getOffers(), { quiet: true }) || [];
    const o = offers.find((x) => x.id === id);
    if (!o) return;
    if (b.dataset.act === 'accept') {
      if (!o.canAccept) { toast('סיים קודם את השבוע'); return; }
      const ok = await confirmDialog({ title: 'לחתום?', text: `${o.typeHe} · ${o.club.nameHe} · ${money(o.wage)} לשבוע ל-${o.years} שנים`, yes: 'חותמים!' });
      if (!ok) return;
      const r = call(() => game.respondOffer(id, 'accept'));
      if (r) toast(r.messageHe || (r.ok ? 'סגרנו!' : 'לא הסתדר'), { ms: 4500 });
      if (r && r.ok && r.status === 'signed') { navigate('#/hub'); return; }
      draw();
    } else if (b.dataset.act === 'reject') {
      const r = call(() => game.respondOffer(id, 'reject'));
      if (r && r.messageHe) toast(r.messageHe);
      draw();
    } else if (b.dataset.act === 'negotiate') {
      negotiate(o, draw);
    }
  });
  draw();
}

function offerCard(o) {
  const isOpen = o.status === 'open';
  const c = o.club || {};
  return `<section class="card offer${isOpen ? '' : ' closed'}" data-testid="offer-${esc(o.id)}">
    <div class="row">${badge(c)}<div class="grow"><b>${esc(c.nameHe || '')}</b>
      <small class="muted">${esc(c.flag || '')} ${esc(c.leagueHe || '')}${c.countryHe ? ' · ' + esc(c.countryHe) : ''}${c.strength ? ' · כוח ' + esc(Math.round(c.strength)) : ''}</small></div>
      <span class="chip type-${esc(o.type)}">${TYPE_ICO[o.type] ? ico(TYPE_ICO[o.type]) : ''} ${esc(o.typeHe || '')}</span></div>
    <div class="offer-terms">
      ${o.fee ? `<div><small>דמי העברה</small><b class="num">${esc(money(o.fee))}</b></div>` : ''}
      <div><small>שכר לשבוע</small><b class="num">${esc(money(o.wage))}</b></div>
      <div><small>שנים</small><b class="num">${esc(o.years)}</b></div>
      <div><small>תפקיד</small><b>${esc(gtext(o.roleHe || ROLE_HE[o.role] || ''))}</b></div>
      ${o.rc ? `<div><small>סעיף שחרור</small><b class="num">${esc(money(o.rc))}</b></div>` : ''}
    </div>
    ${(o.compareHe || []).length ? `<ul class="compare">${o.compareHe.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <div class="muted small">${esc(o.statusHe || '')}${isOpen && o.expiresHe ? ' · ' + esc(o.expiresHe) : ''}</div>
    ${isOpen ? `<div class="btn-row">
      <button type="button" class="btn btn-primary" data-act="accept" data-id="${esc(o.id)}" data-testid="btn-offer-accept-${esc(o.id)}" ${o.canAccept ? '' : 'aria-disabled="true"'}>קבל</button>
      ${o.negotiationsLeft > 0 ? `<button type="button" class="btn" data-act="negotiate" data-id="${esc(o.id)}" data-testid="btn-offer-negotiate-${esc(o.id)}">משא ומתן (${esc(o.negotiationsLeft)})</button>` : ''}
      <button type="button" class="btn btn-ghost" data-act="reject" data-id="${esc(o.id)}" data-testid="btn-offer-reject-${esc(o.id)}">דחה</button>
    </div>${o.canAccept ? '' : '<p class="muted small">אפשר לחתום רק בין שבועות (סיים קודם את השבוע).</p>'}` : ''}
  </section>`;
}

function negotiate(o, onDone) {
  const st = { wageMul: 1.1, years: o.years || 3, role: o.role || 'rotation', rc: o.rc ? 'default' : 'none' };
  const close = openModal('', { sheet: true, testid: 'negotiate-sheet' });
  const el = close.el;
  function draw() {
    el.innerHTML = `<h2 class="modal-title">משא ומתן מול ${esc(o.club && o.club.nameHe)}</h2>
      <p class="muted small">${esc(gtext('הסוכן: "{{תגיד|תגידי}} לי מה {{אתה|את}} {{רוצה|רוצה}}, אני אסגור את זה." ככל ש{{תבקש|תבקשי}} יותר, הסיכוי שיסכימו יורד.'))}</p>
      <h3 class="sub">שכר</h3>
      <div class="seg">${[1.1, 1.2, 1.35].map((m) => `<button type="button" class="seg-btn${st.wageMul === m ? ' on' : ''}" data-n="wage" data-v="${m}">+${Math.round((m - 1) * 100)}% <small class="num">${esc(money(o.wage * m))}</small></button>`).join('')}</div>
      <h3 class="sub">שנים בחוזה</h3>
      <div class="stepper"><button type="button" class="btn btn-sm" data-n="yminus" aria-label="פחות">−</button><b class="num">${st.years}</b><button type="button" class="btn btn-sm" data-n="yplus" aria-label="יותר">+</button></div>
      <h3 class="sub">תפקיד בקבוצה</h3>
      <div class="chips wrap">${ROLE_ORDER.map((r) => `<button type="button" class="chip chip-btn${st.role === r ? ' on' : ''}" data-n="role" data-v="${r}">${esc(gtext(ROLE_HE[r]))}</button>`).join('')}</div>
      <h3 class="sub">סעיף שחרור</h3>
      <div class="seg">${[['none', 'בלי'], ['low', 'נמוך'], ['default', 'רגיל']].map(([k, he]) => `<button type="button" class="seg-btn${st.rc === k ? ' on' : ''}" data-n="rc" data-v="${k}">${he}</button>`).join('')}</div>
      <div class="btn-row"><button type="button" class="btn btn-primary" data-n="send" data-testid="btn-negotiate-send">שלח הצעה נגדית</button><button type="button" class="btn btn-ghost" data-close>ביטול</button></div>`;
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    const n = b.dataset.n;
    if (n === 'wage') st.wageMul = Number(b.dataset.v);
    else if (n === 'yminus') st.years = Math.max(1, st.years - 1);
    else if (n === 'yplus') st.years = Math.min(5, st.years + 1);
    else if (n === 'role') st.role = b.dataset.v;
    else if (n === 'rc') st.rc = b.dataset.v;
    else if (n === 'send') {
      const r = call(() => game.respondOffer(o.id, 'negotiate', { wageMul: st.wageMul, years: st.years, role: st.role, rc: st.rc }));
      close();
      if (r) toast(r.messageHe || 'הסוכן חזר עם תשובה', { ms: 4500 });
      onDone();
      return;
    }
    draw();
  });
  draw();
}
