// inbox.js: #/inbox (WhatsApp-style list) and #/chat/:id (thread with choices).
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, toast, setHeader, reducedMotion, hubSafe } from './app.js';
import { navigate } from './router.js';
import { bubble, empty } from './components.js';
import { personaIco, ico } from './icons.js';
// v2.2: threads that link to a screen (bench nudge -> #/coach-talk). The engine may send thread.route; ev id as fallback.
const ROUTE_HE = { '#/coach-talk': 'לדבר עם המאמן' };
function threadRoute(t) {
  if (t && typeof t.route === 'string' && t.route.startsWith('#/')) return t.route;
  if (t && (t.ev === 'bench_nudge' || /bench_nudge/.test(String(t.id || '')))) return '#/coach-talk';
  return null;
}
function avatar(from) { const p = personaIco(from); return `<span class="avatar ${p.tint}" aria-hidden="true">${p.svg}</span>`; }

export function render(root, params = {}) {
  if (params.id) return renderChat(root, params.id);
  return renderList(root);
}

function renderList(root) {
  function draw() {
    const rows = call(() => game.getInbox(), { quiet: true }) || [];
    const unread = rows.filter((r) => r.unread).length;
    root.innerHTML = `<div class="inbox">
      ${unread ? '<div class="row end"><button type="button" class="btn btn-sm btn-ghost" data-act="allread">סמן הכל כנקרא</button></div>' : ''}
      ${rows.length ? `<div class="chat-list">${rows.map((r) => `<a class="chat-row${r.unread ? ' unread' : ''}" href="#/chat/${encodeURIComponent(r.id)}" data-testid="inbox-item-${esc(r.id)}">
          ${avatar(r.from)}
          <span class="grow cr-body"><span class="cr-top"><b>${esc(r.fromHe)}</b><small class="muted">${esc(r.dateHe || '')}</small></span>
          <span class="cr-prev">${esc(r.previewHe || '')}</span></span>
          <span class="cr-side">${r.needsAnswer ? '<span class="chip warn">מחכה לתשובה</span>' : ''}${r.unread ? '<i class="dot"></i>' : ''}</span>
        </a>`).join('')}</div>` : empty('אין הודעות עדיין. אמא בטח תכתוב בקרוב...', '💬')}
    </div>`;
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="allread"]');
    if (!b) return;
    call(() => game.markAllRead());
    draw();
  });
  draw();
}

function renderChat(root, id) {
  let thread = call(() => game.getThread(id), { quiet: true });
  if (!thread) { root.innerHTML = empty('השיחה לא נמצאה', '💬'); return; }
  call(() => game.markRead(id), { quiet: true });
  setHeader({ title: thread.fromHe || 'צ׳אט' });
  let busy = false;
  let timer = null;

  function draw(messages, typing = false, showChoices = true) {
    const msgs = messages || thread.messages || [];
    let link = threadRoute(thread);
    if (link === '#/coach-talk') { const h = hubSafe(); if (!(h && h.coachTalk && h.coachTalk.ok)) link = null; }
    root.innerHTML = `<div class="chat">
      <div class="chat-head">${avatar(thread.from)}<b>${esc(thread.fromHe)}</b><small class="muted">${esc(thread.dateHe || '')}</small></div>
      <div class="bubbles">${msgs.map((m) => bubble(m, thread.isGroup)).join('')}${typing ? '<div class="bub them typing" aria-label="מקליד"><i></i><i></i><i></i></div>' : ''}</div>
      ${showChoices && thread.choices && thread.choices.length ? `<div class="chat-choices">${thread.choices.map((c, i) => `<button type="button" class="btn chat-choice" data-act="choice" data-i="${esc(c.index ?? i)}" data-testid="chat-choice-${esc(c.index ?? i)}" ${c.disabled ? 'disabled' : ''}>${esc(c.he)}</button>`).join('')}</div>` : ''}
      ${link && !typing ? `<div class="chat-link"><button type="button" class="btn btn-gold btn-lg" data-act="route" data-to="${esc(link)}" data-testid="chat-link">${ico('talk')}${esc(thread.routeHe || ROUTE_HE[link] || 'פתח')}</button></div>` : ''}
    </div>`;
    const last = root.querySelector('.bubbles > :last-child');
    if (last && last.scrollIntoView) { try { last.scrollIntoView({ block: 'nearest' }); } catch { /* ignore */ } }
  }

  root.addEventListener('click', (e) => {
    const lk = e.target.closest('[data-act="route"]');
    if (lk && !busy) { navigate(lk.dataset.to); return; }
    const b = e.target.closest('[data-act="choice"]');
    if (!b || busy || b.disabled) return;
    busy = true;
    const before = (thread.messages || []).length;
    const r = call(() => game.answerEvent(id, Number(b.dataset.i)));
    if (!r || !r.ok) {
      busy = false;
      if (r && r.thread) thread = r.thread;
      toast('אי אפשר לבחור באפשרות הזו כרגע');
      draw();
      return;
    }
    thread = r.thread;
    const all = thread.messages || [];
    const added = all.slice(before);
    const mineIdx = added.findIndex((m) => m.mine);
    const upToMine = all.slice(0, before + (mineIdx >= 0 ? mineIdx + 1 : 0));
    const hasFollow = all.length > upToMine.length;
    const finish = () => {
      busy = false;
      draw(all);
      if (r.effectsHe && r.effectsHe.length) toast(r.effectsHe.join(' · '));
    };
    if (hasFollow && !reducedMotion()) {
      draw(upToMine, true, false);
      timer = setTimeout(finish, 600);
    } else finish();
  });

  draw();
  return () => { clearTimeout(timer); };
}

export function goInbox() { navigate('#/inbox'); }
