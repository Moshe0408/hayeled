// sharecard.js (v2.3, F10): a 1080x1350 PNG "player card" of a moment (mega goal, achievement, promotion, trophy,
// challenge) drawn on a canvas: night-stadium backdrop, FUT-style card with the avatar, OVR, crest and flag, the
// moment text, the game logo and the short link. Shared with the Web Share API (with the file); fallback: download
// the PNG + a WhatsApp text link. Telemetry: share {kind, method}.
import * as game from '../engine/game.js';
import * as STR from '../data/strings.js';
import { esc } from './dom.js';
import { svc, openModal, toast, call } from './app.js';
import { avatarFor, nationTeam, cardTier, shirtNumber, posShortHe } from './components.js';
import { crestDataURL } from './crests.js';
import { gtext } from './gender.js';
import { ico } from './icons.js';
import { visFor } from './cosmetics.js';

export const SHORT_LINK = 'tinyurl.com/hayeled';
export const PUBLIC_URL = 'https://moshe0408.github.io/hayeled/';
const W = 1080, H = 1350;
const FONT_D = 'Rubik, Heebo, "Arial Black", Arial, sans-serif';
const FONT = 'Heebo, Rubik, Arial, sans-serif';

const KIND_HE = { goal: 'גוללללל!', mega: 'גוללללל!', achievement: 'הישג חדש!', promotion: 'קפיצת מדרגה!', trophy: '{{אלופים|אלופות}}!', challenge: 'אתגר!', card: 'הכרטיס שלי', debut: 'ככה מתחילים אגדה' };
const TEXT_FB = {
  goal: '{name} {{הבקיע|הבקיעה}} ב{club}! ⚽',
  achievement: '{name} {{פתח|פתחה}} הישג: {title} 🏅',
  promotion: '{name}: {title} 🚀',
  trophy: '{name} {{זכה|זכתה}} ב{title}! 🏆',
  challenge: '{name} {{מאתגר|מאתגרת}} אותך! {{תצליח|תצליחי}} לעבור אותי?',
  card: 'זה הכרטיס שלי בהילד מהשכונה ⚽',
  debut: '{name} {{הבקיע|הבקיעה}} בהופעת הבכורה! ⚽',
  cta: 'בואו לשחק בחינם:',
};
// SHARE_TEXT (content): moment[kind] = headline variants, message = text sent with the PNG ({text} {name} {url} {ovr}...).
const MOMENT_KEY = { goal: 'goal', mega: 'mega_goal', debut: 'debut_goal', achievement: 'achievement', promotion: 'promotion', trophy: 'trophy', card: null, challenge: null };
const MISSING = '\u0001';
const fillAll = (str, vars) => String(str || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null && vars[k] !== '' ? String(vars[k]) : MISSING));
/** First variant whose placeholders are all filled (else ''). */
function pickFilled(list, vars, salt = 0) {
  const arr = (Array.isArray(list) ? list : [list]).filter((x) => typeof x === 'string' && x);
  for (let i = 0; i < arr.length; i++) { const out = fillAll(arr[(i + salt) % arr.length], vars); if (out.indexOf(MISSING) < 0) return out; }
  return '';
}
function shareText(kind, vars) {
  const t = STR.SHARE_TEXT && typeof STR.SHARE_TEXT === 'object' ? STR.SHARE_TEXT : {};
  const salt = Math.floor(Math.random() * 3);
  const mk = MOMENT_KEY[kind] !== undefined ? MOMENT_KEY[kind] : kind;
  const head = (mk && t.moment && pickFilled(t.moment[mk], vars, salt)) || '';
  const base = head || vars.title || fillAll(TEXT_FB[kind] || TEXT_FB.card, vars).split(MISSING).join('');
  const msg = pickFilled(t.message, { ...vars, text: base.replace(/[.!]+$/, ''), url: SHORT_LINK }, salt);
  const text = gtext(msg || (base + ' ' + TEXT_FB.cta + ' ' + SHORT_LINK)).replace(/\s{2,}/g, ' ').trim();
  return { head: gtext(head), text };
}

function loadImg(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
    setTimeout(() => resolve(null), 4000);
  });
}
const svgURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function info() {
  let meta = {}, hub = null, prof = null;
  try { meta = game.getSaveMeta() || {}; } catch { meta = {}; }
  try { hub = game.getHub(); } catch { hub = null; }
  try { prof = game.getProfile(); } catch { prof = null; }
  const p = (hub && hub.player) || {};
  const club = hub && hub.club ? hub.club : null;
  return { meta, p, club, prof, gender: meta.gender === 'f' ? 'f' : 'm' };
}

const TIER_BG = {
  bronze: ['#F2C6A0', '#C08050', '#7A4524', '#D49A6E'], silver: ['#FFFFFF', '#C5CDD8', '#7E8A9A', '#E1E7EE'],
  gold: ['#FFF6CC', '#F4C35A', '#B07A18', '#FBE08A'], icon: ['#FFE7A3', '#C98E2B', '#3A2160', '#FFF1C4'],
};
function cardPath(g, x, y, w, h) {
  const P = [[0.5, 0], [0.64, 0.032], [1, 0.045], [1, 0.86], [0.5, 1], [0, 0.86], [0, 0.045], [0.36, 0.032]];
  g.beginPath();
  P.forEach(([px, py], i) => (i ? g.lineTo(x + px * w, y + py * h) : g.moveTo(x + px * w, y + py * h)));
  g.closePath();
}

/** Draw the PNG. o: { kind, titleHe, textHe, tier }. Resolves a canvas (never rejects). */
export async function drawShareCard(o = {}) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const I = info();
  const gd = I.gender;
  try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load(`900 120px Rubik`), document.fonts.load(`700 40px Heebo`)]), new Promise((r) => setTimeout(r, 1200))]); } catch { /* system fonts */ }
  // backdrop: night stadium
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0A1530'); bg.addColorStop(0.55, '#071022'); bg.addColorStop(1, '#04070E');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (const [x, col] of [[140, 'rgba(47,227,207,.30)'], [W - 140, 'rgba(111,183,255,.28)']]) {
    const r = g.createRadialGradient(x, -40, 10, x, -40, 760); r.addColorStop(0, col); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H);
  }
  const gl = g.createRadialGradient(W / 2, 600, 40, W / 2, 600, 620); gl.addColorStop(0, 'rgba(244,195,90,.30)'); gl.addColorStop(1, 'rgba(244,195,90,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H);
  // floodlight beams
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const s of [-1, 1]) {
    const x0 = W / 2 + s * 470;
    const lg = g.createLinearGradient(x0, 0, W / 2, 900); lg.addColorStop(0, 'rgba(210,255,250,.16)'); lg.addColorStop(1, 'rgba(210,255,250,0)');
    g.fillStyle = lg; g.beginPath(); g.moveTo(x0 - 30, 0); g.lineTo(x0 + 30, 0); g.lineTo(W / 2 + s * 40, 980); g.lineTo(W / 2 - s * 260, 980); g.closePath(); g.fill();
  }
  g.restore();
  // pitch stripes at the bottom
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? 'rgba(43,208,122,.07)' : 'rgba(43,208,122,.03)'; g.fillRect(i * 90, 1080, 90, 270); }
  const pf = g.createLinearGradient(0, 1060, 0, 1140); pf.addColorStop(0, '#071022'); pf.addColorStop(1, 'rgba(7,16,34,0)'); g.fillStyle = pf; g.fillRect(0, 1060, W, 80);
  // logo
  const logo = await loadImg('./icons/logo.svg');
  if (logo) g.drawImage(logo, W / 2 - 170, 34, 340, 221);
  // the card
  const tier = ['bronze', 'silver', 'gold', 'icon'].includes(o.cardTier) ? o.cardTier : cardTier(I.p.ovr);
  const cw = 470, ch = 672, cx = W / 2 - cw / 2, cy = 270;
  const frame = (visFor(I.meta).frame) || '';
  g.save();
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 50; g.shadowOffsetY = 24;
  cardPath(g, cx, cy, cw, ch);
  const cols = frame === 'holo' ? ['#7DF0E2', '#B78CFF', '#FF7AC8', '#FFE07A'] : frame === 'gold' ? TIER_BG.gold : TIER_BG[tier];
  const cg = g.createLinearGradient(cx, cy, cx + cw, cy + ch); cols.forEach((col, i) => cg.addColorStop([0, 0.3, 0.62, 1][i], col));
  g.fillStyle = cg; g.fill();
  g.restore();
  g.save(); cardPath(g, cx + 12, cy + 12, cw - 24, ch - 24);
  const ig = g.createLinearGradient(0, cy, 0, cy + ch);
  if (tier === 'icon') { ig.addColorStop(0, '#2C1C52'); ig.addColorStop(1, '#3B2A10'); } else { ig.addColorStop(0, 'rgba(255,255,255,.45)'); ig.addColorStop(0.5, 'rgba(255,255,255,.08)'); ig.addColorStop(1, 'rgba(0,0,0,.12)'); }
  g.fillStyle = ig; g.fill(); g.clip();
  // avatar
  const kit = (I.club && I.club.colors) || ['#1d4ed8', '#ffffff'];
  const av = avatarFor({ ...I.meta, gender: gd }, { kitColors: kit, number: shirtNumber(I.p.pos), size: 300, pose: 'portrait', bg: false });
  const avImg = av ? await loadImg(svgURL(av)) : null;
  if (avImg) g.drawImage(avImg, cx + cw * 0.03, cy + 40, cw * 0.7, cw * 0.7);
  g.restore();
  const ink = tier === 'icon' ? '#FFE7A3' : tier === 'gold' || frame === 'gold' ? '#2F2104' : tier === 'silver' ? '#1B2433' : '#2E1606';
  g.fillStyle = ink; g.textAlign = 'center'; g.direction = 'rtl';
  g.font = `900 120px ${FONT_D}`; g.fillText(String(Math.round(Number(I.p.ovr) || 0) || '?'), cx + cw - 92, cy + 170);
  g.font = `800 40px ${FONT_D}`; g.fillText(posShortHe(I.p.pos || I.meta.pos, gd), cx + cw - 92, cy + 218);
  const crest = I.club ? await loadImg(crestDataURL(I.club, 120)) : null;
  if (crest) g.drawImage(crest, cx + cw - 132, cy + 300, 80, 80);
  const nat = nationTeam(I.meta.nation);
  const flag = nat ? await loadImg(crestDataURL(nat, 120)) : null;
  if (flag) g.drawImage(flag, cx + cw - 132, cy + 236, 80, 60);
  // name band
  const parts = String(I.p.name || I.meta.name || '').trim().split(/\s+/);
  const shown = I.p.nick || I.meta.nick || parts.slice(1).join(' ') || parts[0] || '';
  g.strokeStyle = ink; g.globalAlpha = 0.3; g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx + 50, cy + 418); g.lineTo(cx + cw - 50, cy + 418); g.moveTo(cx + 50, cy + 494); g.lineTo(cx + cw - 50, cy + 494); g.stroke(); g.globalAlpha = 1;
  g.font = `900 52px ${FONT_D}`; fitText(g, shown, cx + cw / 2, cy + 474, cw - 110);
  // attributes row
  const attrs = (I.prof && I.prof.attrs) || [];
  const keys = I.p.pos === 'GK' ? ['div', 'han', 'kic', 'ref', 'pac', 'gkp'] : ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
  const AB = { pac: 'מהי׳', sho: 'בעי׳', pas: 'מסי׳', dri: 'כדר׳', def: 'הגנ׳', phy: 'פיז׳', div: 'זינ׳', han: 'תפי׳', ref: 'רפל׳', gkp: 'מיק׳', kic: 'בעי׳' };
  const amap = {}; for (const a of attrs) amap[a.key] = a.value;
  const ks = keys.filter((k) => amap[k] !== undefined);
  ks.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = cx + cw - 110 - col * 125, y = cy + 548 + row * 52;
    g.font = `900 38px ${FONT_D}`; g.fillText(String(amap[k]), x + 26, y);
    g.font = `800 24px ${FONT}`; g.globalAlpha = 0.75; g.fillText(AB[k] || k, x - 30, y); g.globalAlpha = 1;
  });
  // the moment
  const kind = o.kind || 'card';
  const head = gtext(o.headHe || KIND_HE[kind] || KIND_HE.card, gd);
  g.save();
  g.font = `900 104px ${FONT_D}`; g.textAlign = 'center'; g.direction = 'rtl';
  const hg = g.createLinearGradient(0, 1000, 0, 1090); hg.addColorStop(0, '#FFF8D6'); hg.addColorStop(0.5, '#F4C35A'); hg.addColorStop(1, '#C98E2B');
  g.lineWidth = 10; g.strokeStyle = '#2b1606'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(255,190,60,.6)'; g.shadowBlur = 30;
  fitText(g, head, W / 2, 1060, W - 120, true, hg);
  g.restore();
  const line = o.textHe && o.titleHe && String(o.textHe).includes(o.titleHe) ? o.textHe : [o.titleHe, o.textHe].filter(Boolean).join(' · ');
  g.fillStyle = '#EAF1FC'; g.font = `700 44px ${FONT}`; g.textAlign = 'center'; g.direction = 'rtl';
  wrapText(g, gtext(line || (I.club ? I.club.nameHe : ''), gd), W / 2, 1140, W - 140, 56, 2);
  // footer
  g.fillStyle = 'rgba(8,16,32,.85)'; g.fillRect(0, H - 104, W, 104);
  const fl = g.createLinearGradient(0, 0, W, 0); fl.addColorStop(0, 'rgba(47,227,207,0)'); fl.addColorStop(0.5, 'rgba(244,195,90,.9)'); fl.addColorStop(1, 'rgba(47,227,207,0)');
  g.fillStyle = fl; g.fillRect(0, H - 104, W, 3);
  g.fillStyle = '#FFE7A3'; g.font = `900 40px ${FONT_D}`; g.textAlign = 'center';
  g.fillText(gtext('{{בוא|בואי}} לשחק:', gd) + ' ' + SHORT_LINK, W / 2, H - 40);
  return c;
}
function fitText(g, s, x, y, max, stroke = false, fillStyle = null) {
  let size = parseInt(g.font.match(/(\d+)px/)[1], 10);
  const fam = g.font.replace(/^.*?\d+px\s*/, '');
  const wt = (g.font.match(/^(\d{3})/) || [0, '900'])[1];
  while (size > 18 && g.measureText(s).width > max) { size -= 4; g.font = `${wt} ${size}px ${fam}`; }
  if (stroke) g.strokeText(s, x, y);
  if (fillStyle) g.fillStyle = fillStyle;
  g.fillText(s, x, y);
}
function wrapText(g, s, x, y, max, lh, maxLines) {
  const words = String(s || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  lines.slice(0, maxLines).forEach((l, i) => g.fillText(l, x, y + i * lh));
}

function toBlob(c) {
  return new Promise((resolve) => { try { c.toBlob((b) => resolve(b), 'image/png'); } catch { resolve(null); } });
}
function track(kind, method) {
  try { if (typeof svc.telemetry.trackShare === 'function') svc.telemetry.trackShare(kind, method); else svc.telemetry.track('share', { kind, method }); } catch { /* ignore */ }
  // the engine counts shares for the "shared a card" achievement
  if (method !== 'cancel') { try { if (typeof game.noteShare === 'function' && game.hasCareer()) call(() => game.noteShare(kind), { quiet: true }); } catch { /* ignore */ } }
}

/**
 * Open the share sheet for a moment. o: { kind: 'goal'|'mega'|'achievement'|'promotion'|'trophy'|'challenge'|'card'|'debut',
 * titleHe, textHe, headHe?, url? (challenge link), tier? }. Never throws.
 */
export async function shareMoment(o = {}) {
  const kind = o.kind || 'card';
  const I = info();
  const first = String(I.p.name || I.meta.name || '').split(/\s+/)[0] || '';
  const vars = { name: I.p.name || I.meta.name || '', first, club: (I.club && I.club.nameHe) || '', title: o.titleHe || '', ovr: I.p.ovr || '', age: I.p.age || '',
    ach: o.titleHe || '', step: o.titleHe || '', trophy: o.titleHe || '', ...(o.vars || {}) };
  const st = shareText(kind, vars);
  const url = o.url || PUBLIC_URL;
  const text = o.messageHe || st.text;
  const fullText = o.url && !text.includes(url) ? text + ' ' + url : text;
  if (!o.textHe && st.head && st.head !== o.titleHe) o = { ...o, textHe: st.head };
  const close = openModal(`<div class="share-sheet" data-testid="share-sheet">
      <button type="button" class="modal-x" data-close aria-label="סגירה" data-testid="btn-share-close">✕</button>
      <h2 class="modal-title">${ico('upload', 'gold')} שיתוף</h2>
      <div class="share-prev"><div class="spinner" aria-hidden="true"></div></div>
      <p class="small share-text">${esc(text)}</p>
      <div class="btn-col">
        <button type="button" class="btn btn-gold btn-lg" data-a="native" data-testid="btn-share-native" disabled>${ico('upload')}שתף</button>
        <div class="btn-row"><a class="btn btn-wa" data-a="wa" data-testid="btn-share-whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(fullText)}">${ico('chat')}וואטסאפ</a>
          <button type="button" class="btn" data-a="dl" data-testid="btn-share-download" disabled>${ico('download')}הורדה</button></div>
        ${o.url ? `<button type="button" class="btn btn-ghost" data-a="copy" data-testid="btn-share-copy">${ico('copy')}העתקת הקישור</button>` : ''}
        <button type="button" class="btn btn-ghost" data-close>סגירה</button>
      </div></div>`, { sheet: true, testid: 'share' });
  let blob = null, file = null, objUrl = '';
  const fname = 'hayeled-' + kind + '.png';
  (async () => {
    try {
      const c = await drawShareCard({ ...o, kind });
      blob = await toBlob(c);
      if (blob) {
        objUrl = URL.createObjectURL(blob);
        try { file = new File([blob], fname, { type: 'image/png' }); } catch { file = null; }
      }
      const prev = close.el.querySelector('.share-prev');
      if (prev) prev.innerHTML = objUrl ? `<img src="${objUrl}" alt="כרטיס השיתוף" data-testid="share-img">` : '<p class="muted small">לא הצלחנו לצייר את הכרטיס</p>';
    } catch (e) { console.warn('[hayeled] share card', e); }
    for (const b of close.el.querySelectorAll('[data-a="native"],[data-a="dl"]')) b.disabled = false;
  })();
  close.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'wa') { track(kind, 'whatsapp'); return; }
    if (a === 'copy') {
      try { await navigator.clipboard.writeText(url); toast('הקישור הועתק ✓', { tone: 'good' }); track(kind, 'copy'); } catch { toast(url, { ms: 5000 }); }
      return;
    }
    if (a === 'dl') { download(blob, fname); track(kind, 'download'); return; }
    if (a === 'native') {
      const data = { title: 'הילד מהשכונה', text: fullText };
      if (o.url) data.url = url;
      try {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ ...data, files: [file] });
          track(kind, 'share');
        } else if (navigator.share) {
          await navigator.share(data);
          track(kind, 'share');
        } else {
          download(blob, fname);
          track(kind, 'download');
          toast('התמונה ירדה. אפשר לשלוח אותה בוואטסאפ ✓');
        }
      } catch (err) {
        if (err && err.name === 'AbortError') track(kind, 'cancel');
        else { download(blob, fname); track(kind, 'download'); }
      }
    }
  });
  return close;
}

function download(blob, name) {
  if (!blob) { toast('הכרטיס עוד לא מוכן'); return; }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch { toast('ההורדה נכשלה'); }
}
