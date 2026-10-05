// title.js: #/title. Logo, slot cards, continue / new / hall of fame / settings / install.
import * as save from '../core/save.js';
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, toast, openModal, confirmDialog } from './app.js';
import { navigate } from './router.js';
import { ago } from './format.js';
import { isStandalone } from './install.js';
import { createTitleScene } from './scene/title-scene.js';
import { avatarFor, badge, shirtNumber, cardTier } from './components.js';
import { gBy, gtext } from './gender.js';
import { CLUB_INDEX } from '../data/leagues.js';
import { ico } from './icons.js';
import { titleChallenge, acceptChallenge } from './leaderboard.js';

let scene = null;
function stopScene() { if (scene) { try { scene.destroy(); } catch { /* ignore */ } scene = null; } }
function startScene(root) {
  stopScene();
  const c = root.querySelector('.hero-canvas');
  if (!c) return;
  try { scene = createTitleScene(c, { kid: false }); scene.start(); } catch (e) { console.warn('title scene', e); scene = null; }
}

export async function render(root) {
  root.innerHTML = `<div class="title-screen">${hero(null)}<div class="loading-line">טוען משבצות...</div></div>`;
  startScene(root);
  let slots = [];
  try { slots = await save.listSlots(); } catch (e) { console.warn(e); slots = [1, 2, 3].map((s) => ({ slot: s, empty: true })); }
  draw(root, slots);
  startScene(root);
  let chal = null;
  const paintChallenge = async () => {
    try { if (!chal) chal = await titleChallenge(); } catch { chal = null; }
    const slotEl = root.querySelector('.ch-slot');
    if (slotEl && chal && chal.html) slotEl.innerHTML = chal.html;
  };
  paintChallenge();

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
    else if (act === 'friends') navigate('#/friends');
    else if (act === 'settings') navigate('#/settings');
    else if (act === 'install') navigate('#/install');
    else if (act === 'board') navigate('#/leaderboard');
    else if (act === 'ch-accept') acceptChallenge(chal && chal.mod);
    else if (act === 'ch-later') { try { if (chal && chal.mod && chal.mod.stripChallengeFromUrl) chal.mod.stripChallengeFromUrl(); } catch { /* ignore */ } chal = null; const el = root.querySelector('.ch-slot'); if (el) el.innerHTML = ''; }
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
    paintChallenge();
  }

  async function load(slot) {
    if (ctx.activeSlot === slot && game.hasCareer()) { navigate(ctx.hooks.routeForState()); return; }
    const r = await ctx.hooks.openSlot(slot);
    if (r && r.ok) navigate(ctx.hooks.routeForState());
    else refresh();
  }

  function slotMenu(s) {
    const items = [];
    if (!s.empty && !s.corrupt && !s.tooNew) items.push(['load', 'טען קריירה', 'play']);
    if (s.corrupt || s.hasPrev) items.push(['prev', 'שחזר שמירה קודמת', 'undo']);
    if (s.corrupt) items.push(['import', 'ייבוא גיבוי', 'upload']);
    if (s.hasDeleted) items.push(['undelete', 'שחזר קריירה שנמחקה', 'undo']);
    if (!s.empty || s.corrupt) items.push(['delete', 'מחק משבצת', 'trash']);
    if (s.empty) items.push(['newhere', 'קריירה חדשה כאן', 'sparkle']);
    const close = openModal(`<h2 class="modal-title">משבצת ${s.slot}</h2>
      ${s.corrupt ? '<p class="note warn">השמירה נפגמה. אפשר לנסות לשחזר את השמירה הקודמת או לייבא גיבוי.</p>' : ''}
      ${s.tooNew ? '<p class="note warn">השמירה נוצרה בגרסה חדשה יותר של המשחק. כדאי לרענן כדי לעדכן.</p>' : ''}
      <div class="btn-col">${items.map(([k, t, ic]) => `<button type="button" class="btn${k === 'delete' ? ' btn-danger' : ''}" data-m="${k}" data-testid="slot-menu-${k}">${ic ? ico(ic) : ''}${esc(t)}</button>`).join('')}
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

function kitFor(meta) {
  const ci = meta && meta.clubId && CLUB_INDEX[meta.clubId];
  return ci && ci.club && Array.isArray(ci.club.colors) ? ci.club.colors.slice(0, 2) : ['#1D4ED8', '#FFFFFF'];
}

function clubTeam(meta) {
  const ci = meta && meta.clubId && CLUB_INDEX[meta.clubId];
  if (!ci || !ci.club) return null;
  return { id: ci.club.id, nameHe: ci.club.nameHe, shortHe: ci.club.shortHe || ci.club.nameHe, colors: (ci.club.colors || []).slice(0, 2) };
}

function hero(meta) {
  const m = meta || { gender: 'm', careerId: 'default-kid', look: { skin: 1, hair: 0 }, pos: 'ST' };
  const art = avatarFor(m, { kitColors: kitFor(meta), number: shirtNumber(m.pos), size: 150, pose: 'full', bg: false });
  return `<div class="title-hero"><canvas class="hero-canvas" aria-hidden="true"></canvas>
    <div class="hero-kid" aria-hidden="true"><i class="hk-shadow"></i>${art}</div>
    <h1 class="title-logo-wrap"><img class="title-logo" src="./icons/logo.svg" alt="הילד מהשכונה - מהשכונה ועד הבאלון ד'אור" width="330" height="250"></h1></div>`;
}

function slotCard(s) {
  const tid = `data-testid="slot-${s.slot}"`;
  if (s.corrupt) {
    return `<div class="slot-card corrupt" ${tid} data-act="slot" data-slot="${s.slot}" role="button" tabindex="0">
      <div class="slot-num num">${s.slot}</div><div class="grow"><b>השמירה נפגמה</b><div class="muted small">לחצו לאפשרויות שחזור</div></div>
      <button type="button" class="icon-btn" data-act="menu" data-slot="${s.slot}" aria-label="אפשרויות">⋯</button></div>`;
  }
  if (s.tooNew) {
    return `<div class="slot-card" ${tid} data-act="slot" data-slot="${s.slot}" role="button" tabindex="0">
      <div class="slot-num num">${s.slot}</div><div class="grow"><b>שמירה מגרסה חדשה</b><div class="muted small">רעננו את הדף כדי לעדכן</div></div></div>`;
  }
  if (s.empty || !s.meta) {
    return `<div class="slot-card is-empty" ${tid} data-act="slot" data-slot="${s.slot}" role="button" tabindex="0">
      <div class="slot-num num">${s.slot}</div><div class="grow"><b>משבצת ריקה</b><div class="muted small">לחצו כדי להתחיל קריירה כאן</div></div>
      <span class="slot-plus" aria-hidden="true">+</span>
      ${s.hasDeleted ? `<button type="button" class="icon-btn" data-act="menu" data-slot="${s.slot}" aria-label="אפשרויות">⋯</button>` : ''}</div>`;
  }
  const m = s.meta;
  const gd = m.gender === 'f' ? 'f' : 'm';
  const isLast = ctx.settings && ctx.settings.lastSlot === s.slot;
  const club = clubTeam(m);
  const art = avatarFor(m, { kitColors: kitFor(m), number: shirtNumber(m.pos), size: 52, pose: 'portrait' });
  return `<div class="slot-card${isLast ? ' last' : ''}" ${tid} data-act="slot" data-slot="${s.slot}" role="button" tabindex="0">
    <div class="slot-av tier-${cardTier(m.ovr)}"><span class="sa-art" aria-hidden="true">${art}</span><b class="num">${esc(m.ovr)}</b></div>
    <div class="grow">
      <b class="slot-name">${esc(m.name || '')}${m.nick ? ` <span class="muted">"${esc(m.nick)}"</span>` : ''}</b>
      <div class="small slot-club">${club ? badge(club, 'xs') : ''}<span>${esc(gtext(m.clubHe || 'ללא קבוצה', gd))} · ${esc(gtext(m.posHe || m.pos || '', gd))} · גיל ${esc(m.age)}</span>${m.retired ? ` <span class="chip gold">${gBy(gd, 'פרש', 'פרשה')}</span>` : ''}</div>
      <div class="muted small">${esc(m.dateHe || '')} · עונה ${esc(m.seasons || 1)}</div>${s.savedAt ? `<div class="muted small">נשמר ${esc(ago(s.savedAt))}</div>` : ''}
    </div>
    <button type="button" class="icon-btn" data-act="menu" data-slot="${s.slot}" aria-label="אפשרויות">⋯</button></div>`;
}

function draw(root, slots) {
  const cont = continueSlot(slots);
  const standalone = (() => { try { return isStandalone(); } catch { return false; } })();
  root.innerHTML = `<div class="title-screen">
    ${hero(cont ? cont.meta : null)}
    <div class="ch-slot"></div>
    <div class="title-actions">
      ${cont ? `<button type="button" class="btn btn-gold btn-xl" data-act="continue" data-testid="btn-continue"><span>${ico('play')}המשך קריירה</span><small>${esc(cont.meta.name)} · ${esc(gtext(cont.meta.clubHe || '', cont.meta.gender))}</small></button>` : ''}
      <button type="button" class="btn ${cont ? 'btn-glass' : 'btn-gold btn-xl'}" data-act="new" data-testid="btn-new-career">${cont ? ico('ball') + 'קריירה חדשה' : '<span>' + ico('ball') + 'קריירה חדשה</span><small>שני צעדים, ובכורה בבוגרים</small>'}</button>
    </div>
    ${slots.some((s) => !s.empty || s.corrupt || s.tooNew) ? `<h2 class="section-title"><span>המשבצות שלך</span></h2>
    <div class="slots">${slots.map(slotCard).join('')}</div>` : ''}
    <div class="title-links">
      <button type="button" class="btn btn-ghost" data-act="friends" data-testid="btn-friends">${ico('users')}ליגת חברים</button>
      <button type="button" class="btn btn-ghost" data-act="board" data-testid="btn-leaderboard">${ico('table')}טבלת האגדות</button>
      <button type="button" class="btn btn-ghost" data-act="hof" data-testid="btn-hof">${ico('hof')}היכל התהילה</button>
      <button type="button" class="btn btn-ghost" data-act="settings" data-testid="btn-settings">${ico('gear')}הגדרות וגיבוי</button>
      ${standalone ? '' : '<button type="button" class="btn btn-ghost" data-act="install">' + ico('phone') + 'התקנה למסך הבית</button>'}
    </div>
    <p class="muted small center">ההתקדמות נשמרת אוטומטית במכשיר הזה. כדאי לייצא גיבוי מדי פעם מההגדרות.</p>
  </div>`;
}
