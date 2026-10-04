// js/admin/admin.js - admin dashboard entry + hash router (#/login, #/dash, #/players, #/feedback, #/tools, #/config).
// Never initialises telemetry (the owner's visits must not count as players).
import { BACKEND_ENABLED } from '../config.js';
import * as api from './api.js';
import { renderLogin, renderDash, renderPlayers, renderFeedback, renderTools, renderConfig, renderMessage, renderHeader, clear, h, toast } from './views.js';

const root = document.getElementById('adm-app');
const ROUTES = ['login', 'dash', 'players', 'feedback', 'tools', 'config'];
let cleanup = null;
let pendingLoginError = '';

function currentRoute() {
  const m = /^#\/([a-z]+)/.exec(location.hash || '');
  return m && ROUTES.includes(m[1]) ? m[1] : '';
}

function go(name) {
  if (location.hash !== '#/' + name) location.hash = '#/' + name;
  else render();
}

async function logout() {
  await api.logout();
  pendingLoginError = '';
  go('login');
}

function render() {
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  clear(root);

  if (!BACKEND_ENABLED) {
    renderMessage(root, {
      title: 'הבקאנד עוד לא מוגדר. ראה docs/ADMIN_SETUP.md',
      text: 'צריך ליצור פרויקט Supabase, להריץ את supabase/schema.sql, ולהדביק את Project URL ואת ה-anon key בקובץ js/config.js.',
    });
    return;
  }

  let r = currentRoute();
  const signedIn = api.hasSession();
  if (!r) { go(signedIn ? 'dash' : 'login'); return; }
  if (r !== 'login' && !signedIn) { go('login'); return; }
  if (r === 'login' && signedIn) { go('dash'); return; }

  document.title = 'ניהול - הילד מהשכונה';
  if (r === 'login') {
    const err = pendingLoginError;
    pendingLoginError = '';
    renderLogin(root, { onSuccess: () => go('dash'), initialError: err });
    return;
  }

  root.appendChild(renderHeader(r, { onLogout: logout }));
  const main = h('main', { class: 'adm-main' });
  root.appendChild(main);
  if (r === 'dash') cleanup = renderDash(main);
  else if (r === 'players') cleanup = renderPlayers(main);
  else if (r === 'feedback') cleanup = renderFeedback(main);
  else if (r === 'tools') cleanup = renderTools(main);
  else if (r === 'config') cleanup = renderConfig(main);
}

api.setAuthLostHandler((reason) => {
  if (currentRoute() === 'login') return;   // login screen shows its own error
  pendingLoginError = reason === 'forbidden' ? 'למשתמש הזה אין הרשאת מנהל' : 'פג תוקף ההתחברות. התחבר שוב.';
  go('login');
});

window.addEventListener('hashchange', render);
window.addEventListener('unhandledrejection', (e) => {
  try { console.warn('admin: unhandled', e.reason); } catch { /* ignore */ }
});

try {
  render();
} catch (e) {
  try { toast('שגיאה בטעינת לוח הניהול', { error: true }); console.warn(e); } catch { /* ignore */ }
}
