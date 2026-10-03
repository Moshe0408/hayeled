// title.js: #/title. Logo, slot cards, continue / new / hall of fame / settings / install.
import * as save from '../core/save.js';
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, toast, openModal, confirmDialog } from './app.js';
import { navigate } from './router.js';
import { ago } from './format.js';
import { isStandalone } from './install.js';
import { createTitleScene } from './scene/title-scene.js';

let scene = null;
function stopScene() { if (scene) { try { scene.destroy(); } catch { /* ignore */ } scene = null; } }
function startScene(root) {
  stopScene();
  const c = root.querySelector('.hero-canvas');
  if (!c) return;
  try { scene = createTitleScene(c); scene.start(); } catch (e) { console.warn('title scene', e); scene = null; }
}

export async function render(root) {
  root.innerHTML = `<div class="title-screen">${hero()}<div class="loading-line">טוען משבצות...</div></div>`;
  startScene(root);
  let slots = [];
  try { slots = await save.listSlots(); } catch (e) { console.warn(e); slots = [1, 2, 3].map((s) => ({ slot: s, empty: true })); }
  draw(root, slots);
  startScene(root);

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    const slot = Number(b.dataset.slot) || null;
    if (act === 'continue') {
      const s = continueSlot(slots);
      if (s) await load(s.slot);
    } else if (act === 'new') navigate('#/new');
    else if (act === 'hof') navigate('#/hof');
    else if (act === 'settings') navigate('#/settings');
    else if (act === 'install') navigate('#/install');
    else if (act === 'slot') {
      const s = slots.find((x) => x.slot === slot);
      if (!s) return;
      if (s.empty && !s.corrupt && !s.tooNew) navigate('#/new?slot=' + slot);
      else if (s.corrupt || s.tooNew) slotMenu(s);
      else await load(slot);
    } else if (act === 'menu') {
      e.stopPropagation();
      const s = slots.find((x) => x.slot === slot);
      if (s) slotMenu(s);
    }
  });

  // the router calls this when the route changes
  const cleanup = () => stopScene();

  async function refresh() {
    try { slots = await save.listSlots(); } catch { /* keep */ }
    draw(root, slots);
    startScene(root);
  }

  async function load(slot) {
    if (ctx.activeSlot === slot && game.hasCareer()) { navigate(ctx.hooks.routeForState()); return; }
    const r = await ctx.hooks.openSlot(slot);
    if (r && r.ok) navigate(ctx.hooks.routeForState());
    else refresh();
  }

  function slotMenu(s) {
    const items = [];
    if (!s.empty && !s.corrupt && !s.tooNew) items.push(['load', '▶️ טען קריירה']);
    if (s.corrupt || s.hasPrev) items.push(['prev', '⏪ שחזר שמירה קודמת']);
    if (s.corrupt) items.push(['import', '📥 ייבוא גיבוי']);
    if (s.hasDeleted) items.push(['undelete', '♻️ שחזר קריירה שנמחקה']);
    if (!s.empty || s.corrupt) items.push(['delete', '🗑️ מחק משבצת']);
    if (s.empty) items.push(['newhere', '✨ קריירה חדשה כאן']);
    const close = openModal(`<h2 class="modal-title">משבצת ${s.slot}</h2>
      ${s.corrupt ? '<p class="note warn">השמירה נפגמה. אפשר לנסות לשחזר את השמירה הקודמת או לייבא גיבוי.</p>' : ''}
      ${s.tooNew ? '<p class="note warn">השמירה נוצרה בגרסה חדשה יותר של המשחק. רענן כדי לעדכן.</p>' : ''}
      <div class="btn-col">${items.map(([k, t]) => `<button type="button" class="btn" data-m="${k}" data-testid="slot-menu-${k}">${esc(t)}</button>`).join('')}
      <button type="button" class="btn btn-ghost" data-close>סגור</button></div>`, { sheet: true });
    close.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const m = b.dataset.m;
      close();
      if (m === 'load') await load(s.slot);
      else if (m === 'newhere') navigate('#/new?slot=' + s.slot);
      else if (m === 'import') navigate('#/settings');
      else if (m === 'prev') {
        const r = await ctx.hooks.slotOp(s.slot, () => save.restorePrevious(s.slot), 'restore');
        toast(r && r.ok ? 'השמירה הקודמת שוחזרה ✓' : (r && r.messageHe) || 'אין שמירה קודמת לשחזור');
        refresh();
      } else if (m === 'undelete') {
        const r = await ctx.hooks.slotOp(s.slot, () => save.restoreDeleted(s.slot), 'restore');
        toast(r && r.ok ? 'הקריירה שוחזרה ✓' : (r && r.messageHe) || 'לא הצלחנו לשחזר');
        refresh();
      } else if (m === 'delete') {
        const idb = !!(ctx.storage && ctx.storage.idb);
        const ok = await confirmDialog({
          title: 'למחוק את המשבצת?',
          text: idb ? 'אפשר יהיה לשחזר את הקריירה מהתפריט של המשבצת ("שחזר קריירה שנמחקה"), עד שתתחיל בה קריירה חדשה. היכל התהילה לא נמחק.' : 'שים לב: בדפדפן הזה אין גיבוי פנימי, והמחיקה סופית. היכל התהילה לא נמחק.',
          yes: 'מחק', danger: true,
        });
        if (!ok) return;
        await ctx.hooks.slotOp(s.slot, () => save.deleteSlot(s.slot), 'delete');
        toast('המשבצת נמחקה');
        refresh();
      }
    });
  }
  return cleanup;
}

function continueSlot(slots) {
  const usable = slots.filter((s) => !s.empty && !s.corrupt && !s.tooNew);
  if (!usable.length) return null;
  const last = ctx.settings && ctx.settings.lastSlot;
  return usable.find((s) => s.slot === last) || usable.slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
}

function hero() {
  return `<div class="title-hero"><canvas class="hero-canvas" aria-hidden="true"></canvas>
    <h1 class="title-logo-wrap"><img class="title-logo" src="./icons/logo.svg" alt="הילד מהשכונה - מהשכונה ועד הבאלון ד'אור" width="330" height="250"></h1></div>`;
}

function slotCard(s) {
  const tid = `data-testid="slot-${s.slot}"`;
  if (s.corrupt) {
    return `<div class="slot-card corrupt" ${tid} data-act="slot" data-slot="${s.slot}" role="button" tabindex="0">
      <div class="slot-num num">${s.slot}</div><div class="grow"><b>השמירה נפגמה</b><div class="muted small">לחץ לאפשרויות שחזור</div></div>
      <button type="button" class="icon-btn" data-act="menu" data-slot="${s.slot}" aria-label="אפשרויות">⋯</button></div>`;
  }
  if (s.tooNew) {
    return `<div class="slot-card" ${tid} data-act="slot" data-slot="${s.slot}" role="button" tabindex="0">
      <div class="slot-num num">${s.slot}</div><div class="grow"><b>שמירה מגרסה חדשה</b><div class="muted small">רענן את הדף כדי לעדכן</div></div></div>`;
  }
  if (s.empty || !s.meta) {
    return `<div class="slot-card is-empty" ${tid} data-act="slot" data-slot="${s.slot}" role="button" tabindex="0">
      <div class="slot-num num">${s.slot}</div><div class="grow"><b>משבצת ריקה</b><div class="muted small">לחץ כדי להתחיל קריירה כאן</div></div>
      ${s.hasDeleted ? `<button type="button" class="icon-btn" data-act="menu" data-slot="${s.slot}" aria-label="אפשרויות">⋯</button>` : ''}</div>`;
  }
  const m = s.meta;
  const isLast = ctx.settings && ctx.settings.lastSlot === s.slot;
  return `<div class="slot-card${isLast ? ' last' : ''}" ${tid} data-act="slot" data-slot="${s.slot}" role="button" tabindex="0">
    <div class="slot-ovr"><b class="num">${esc(m.ovr)}</b><small>${esc(m.posHe || m.pos || '')}</small></div>
    <div class="grow">
      <b>${esc(m.flag || '')} ${esc(m.name || '')}${m.nick ? ` <span class="muted">"${esc(m.nick)}"</span>` : ''}</b>
      <div class="small">${esc(m.clubHe || 'ללא קבוצה')} · גיל ${esc(m.age)}${m.retired ? ' · <span class="chip gold">פרש</span>' : ''}</div>
      <div class="muted small">${esc(m.dateHe || '')} · עונה ${esc(m.seasons || 1)}${s.savedAt ? ' · נשמר ' + esc(ago(s.savedAt)) : ''}</div>
    </div>
    <button type="button" class="icon-btn" data-act="menu" data-slot="${s.slot}" aria-label="אפשרויות">⋯</button></div>`;
}

function draw(root, slots) {
  const cont = continueSlot(slots);
  const standalone = (() => { try { return isStandalone(); } catch { return false; } })();
  root.innerHTML = `<div class="title-screen">
    ${hero()}
    <div class="title-actions">
      ${cont ? `<button type="button" class="btn btn-gold btn-xl" data-act="continue" data-testid="btn-continue">▶ המשך קריירה<small>${esc(cont.meta.name)} · ${esc(cont.meta.clubHe || '')}</small></button>` : ''}
      <button type="button" class="btn ${cont ? 'btn-glass' : 'btn-gold btn-xl'}" data-act="new" data-testid="btn-new-career">⚽ קריירה חדשה</button>
    </div>
    <h2 class="section-title">המשבצות שלך</h2>
    <div class="slots">${slots.map(slotCard).join('')}</div>
    <div class="title-links">
      <button type="button" class="btn btn-ghost" data-act="hof" data-testid="btn-hof">🏛️ היכל התהילה</button>
      <button type="button" class="btn btn-ghost" data-act="settings" data-testid="btn-settings">⚙️ הגדרות וגיבוי</button>
      ${standalone ? '' : '<button type="button" class="btn btn-ghost" data-act="install">📲 התקנה למסך הבית</button>'}
    </div>
    <p class="muted small center">ההתקדמות נשמרת אוטומטית במכשיר הזה. כדאי לייצא גיבוי מדי פעם מההגדרות.</p>
  </div>`;
}
