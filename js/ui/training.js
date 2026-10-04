// training.js (v2.2): training-load UI pieces shared by the hub, the profile and the week summary.
// Intensity segmented control, live preview line, load bar (coloured by band), match-sharpness tag, 8-week sparkline.
// All numbers come from the engine (getHub().player.load / loadBand / sharp / sharpHe, getTrainingPreview()).
import { esc } from './dom.js';
import { gtext } from './gender.js';
import { sgn, ltr } from './format.js';
import { ico } from './icons.js';

export const INTENSITIES = ['light', 'normal', 'hard', 'extreme'];
export const INT_HE = { light: 'קל', normal: 'רגיל', hard: 'קשה', extreme: 'קיצוני' };
export const BAND_HE = { fresh: 'רענן{{|ה}}', tired: 'עייף{{|ה}}', heavy: 'עמוס{{|ה}}', burnt: 'שחוק{{|ה}}' };
const INT_N = { light: 1, normal: 2, hard: 3, extreme: 4 };

/** Band id for a load value (same thresholds as the engine, spec §3.4). Used only when the VM has no band. */
export function bandOf(load) {
  const v = Number(load) || 0;
  return v >= 80 ? 'burnt' : v >= 60 ? 'heavy' : v >= 40 ? 'tired' : 'fresh';
}
export function bandHe(band) { return gtext(BAND_HE[band] || BAND_HE.fresh); }
export function normInt(id) { return INTENSITIES.indexOf(id) >= 0 ? id : 'normal'; }

/** Four rising bars, the first n lit (the intensity glyph; line-icon language, no emoji). */
export function intGlyph(n) {
  let d = '';
  for (let i = 0; i < 4; i++) {
    const h = 5 + i * 4;
    const x = 3.5 + i * 5;
    d += `<rect x="${x}" y="${20 - h}" width="3" height="${h}" rx="1.2" class="${i < n ? 'on' : 'off'}"/>`;
  }
  return `<svg class="int-glyph" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
}

/**
 * Intensity segmented control. opts: { current, lockExtreme, lockHe }
 * Buttons: data-act="int" data-v="<id>", data-testid="intensity-<id>".
 */
export function intensityRow({ current = 'normal', lockExtreme = false, lockHe = '', titleHe = '' } = {}) {
  const cur = normInt(current);
  return `<div class="int-seg" role="radiogroup" aria-label="עוצמת אימון" data-testid="intensity-row">${INTENSITIES.map((id) => {
    const locked = id === 'extreme' && lockExtreme;
    const on = id === cur;
    return `<button type="button" role="radio" aria-checked="${on}" class="int-btn int-${id}${on ? ' on' : ''}${locked ? ' locked' : ''}" data-act="int" data-v="${id}" data-testid="intensity-${id}"${locked ? ` disabled title="${esc(titleHe || lockHe || 'נפתח מגיל 16')}"` : ''}>
      ${locked ? ico('lock') : intGlyph(INT_N[id])}<span>${esc(INT_HE[id])}</span>${locked ? `<small>${esc(lockHe || 'מגיל 16')}</small>` : ''}</button>`;
  }).join('')}</div>`;
}

/** Risk text -> tone (the engine sends Hebrew: נמוך / בינוני / גבוה / גבוה מאוד ...). */
function riskTone(he, band) {
  if (band) return band === 'none' || band === 'low' ? 'good' : band === 'mid' ? 'warn' : 'bad';
  const s = String(he || '');
  if (/מאוד|גבוה מאד|קיצוני/.test(s)) return 'bad';
  if (/גבוה/.test(s)) return 'bad';
  if (/בינוני/.test(s)) return 'warn';
  if (/אין|ללא|אפס/.test(s)) return 'good';
  return 'good';
}

/**
 * Preview (spec §3.2): the cost of the training alone - אנרגיה -9 · עומס +9 · התקדמות ×1.25 · סיכון פציעה: בינוני -
 * and the expected energy / load at the end of the week before any match (pv.energyAfter / pv.loadAfter).
 * pv = getTrainingPreview(focus, intensity). intensity colours the frame. opts.noteHe: an extra note (the physio's week).
 */
export function previewLine(pv, intensity, { rest = false, noteHe = '' } = {}) {
  if (!pv) return '';
  const e = Number(pv.energyDelta) || 0;
  const l = Number(pv.loadDelta) || 0;
  const gm = Number(pv.growthMult);
  const sd = Number(pv.sharpDelta) || 0;
  const items = [];
  items.push(`<span class="tp-i ${e < -10 ? 'bad' : e < 0 ? 'warn' : 'good'}">${ico('battery')}<span>אנרגיה</span><b class="num">${esc(e ? sgn(e) : ltr('0'))}</b></span>`);
  items.push(`<span class="tp-i ${l >= 9 ? 'bad' : l > 0 ? 'warn' : 'good'}">${ico('dumbbell')}<span>עומס</span><b class="num">${esc(l ? sgn(l) : ltr('0'))}</b></span>`);
  if (Number.isFinite(gm) && gm > 0) items.push(`<span class="tp-i ${gm > 1 ? 'good' : gm < 1 ? 'warn' : ''}">${ico('up')}<span>התקדמות</span><b class="num">${esc(ltr('×' + (Math.round(gm * 100) / 100).toFixed(2)))}</b></span>`);
  else items.push(`<span class="tp-i warn">${ico('up')}<span>ללא התקדמות</span></span>`);
  if (sd < 0) items.push(`<span class="tp-i warn">${ico('target')}<span>חדות</span><b class="num">${esc(sgn(sd))}</b></span>`);
  if (pv.injuryRiskHe) items.push(`<span class="tp-i ${riskTone(pv.injuryRiskHe, pv.riskBand)}">${ico('medic')}<span>סיכון פציעה: ${esc(gtext(pv.injuryRiskHe))}</span></span>`);
  const k = rest ? 'rest' : normInt(intensity);
  const ea = Number(pv.energyAfter), la = Number(pv.loadAfter);
  const after = Number.isFinite(ea) && Number.isFinite(la)
    ? `<p class="tp-after" data-testid="training-after">${ico('clock')}<span>בסוף השבוע, לפני משחקים: אנרגיה <b class="num">${esc(Math.round(ea))}</b> · עומס <b class="num">${esc(Math.round(la))}</b></span></p>` : '';
  const lvl = ['good', 'warn', 'bad', 'info'].indexOf(pv.warnLevel) >= 0 ? pv.warnLevel : 'warn';
  const wIco = lvl === 'good' ? 'check' : lvl === 'info' ? 'info' : 'warn';
  return `<div class="train-prev tp-${k}" data-testid="training-preview" aria-live="polite">
    <div class="tp-head">${esc(rest ? 'מה המנוחה עושה השבוע' : 'עלות האימון השבוע')}</div>
    <div class="tp-row">${items.join('')}</div>
    ${after}
    ${noteHe ? `<p class="tp-warn tp-note info" data-testid="training-physio">${ico('medic')}<span>${esc(gtext(noteHe))}</span></p>` : ''}
    ${pv.warnHe ? `<p class="tp-warn ${lvl}" data-testid="training-warn" data-level="${lvl}">${ico(wIco)}<span>${esc(gtext(pv.warnHe))}</span></p>` : ''}</div>`;
}

/** Load bar coloured by band (high = bad, unlike the energy / morale bars). */
export function loadBar(load, band, { testid = 'hub-load', bandLabel = '' } = {}) {
  const v = Math.max(0, Math.min(100, Math.round(Number(load) || 0)));
  const b = BAND_HE[band] ? band : bandOf(v);
  return `<div class="bar load-bar lb-${b}" data-testid="${esc(testid)}" data-band="${b}">
    <div class="bar-top"><span class="bar-label"><i class="bi bi-load" aria-hidden="true"></i>עומס</span>
      <span class="lb-val"><span class="lb-band">${esc(bandLabel ? gtext(bandLabel) : bandHe(b))}</span><b class="num">${v}</b></span></div>
    <div class="bar-track"><i style="width:${v}%"></i><span class="lb-ticks" aria-hidden="true"><s style="inset-inline-start:40%"></s><s style="inset-inline-start:60%"></s><s style="inset-inline-start:80%"></s></span></div></div>`;
}

/** Match-sharpness tag: "חדות: גבוהה" ("כושר" is the word for match form only). */
export function sharpTag(sharp, sharpHe) {
  if (sharp === undefined || sharp === null) return '';
  const v = Math.round(Number(sharp) || 0);
  const tone = v >= 70 ? 'good' : v < 35 ? 'warn' : '';
  const label = sharpHe ? gtext(sharpHe) : v >= 70 ? 'גבוהה' : v < 35 ? 'נמוכה' : 'רגילה';
  return `<span class="chip sharp-tag ${tone}" data-testid="hub-sharp" title="חדות ${v}">${ico('target')}חדות: <b>${esc(gtext(label))}</b></span>`;
}

/**
 * 8-week load sparkline (simple SVG, spec §6). hist: numbers oldest -> newest.
 * Band guide lines at 40 / 60 / 80; each point has a hover / long-press title.
 */
export function loadSparkline(hist, { weeksHe = 'ב-8 השבועות האחרונים' } = {}) {
  const pts = (Array.isArray(hist) ? hist : []).map((x) => Math.max(0, Math.min(100, Number(x) || 0))).slice(-8);
  if (pts.length < 2) return '';
  const W = 280, H = 64, PX = 8, PY = 6;
  const x = (i) => PX + (i * (W - 2 * PX)) / (pts.length - 1);
  const y = (v) => PY + ((100 - v) * (H - 2 * PY)) / 100;
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)} ${H - PY} L${x(0).toFixed(1)} ${H - PY} Z`;
  const guides = [40, 60, 80].map((g) => `<line x1="${PX}" x2="${W - PX}" y1="${y(g).toFixed(1)}" y2="${y(g).toFixed(1)}" class="sp-g sp-g${g}"/>`).join('');
  const n = pts.length;
  const dots = pts.map((v, i) => {
    const ago = n - 1 - i;
    const t = ago === 0 ? `השבוע: ${Math.round(v)} (${bandHe(bandOf(v))})` : `לפני ${ago} ${ago === 1 ? 'שבוע' : 'שבועות'}: ${Math.round(v)}`;
    return `<g class="sp-pt"><circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="12" class="sp-hit"><title>${esc(t)}</title></circle>`
      + `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === n - 1 ? 4.5 : 3.2}" class="sp-dot lb-${bandOf(v)}${i === n - 1 ? ' last' : ''}"/></g>`;
  }).join('');
  const last = pts[n - 1];
  const first = pts[0];
  const d = Math.round(last - first);
  return `<figure class="load-spark" data-testid="load-sparkline">
    <figcaption><span>עומס ${esc(weeksHe)}</span><b class="num">${Math.round(last)}</b>${d ? `<span class="delta ${d > 0 ? 'down' : 'up'}">${esc(sgn(d))}</span>` : ''}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc('גרף עומס: ' + pts.map((v) => Math.round(v)).join(', '))}">
      <defs><linearGradient id="spFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F59B45" stop-opacity=".35"/><stop offset="1" stop-color="#F59B45" stop-opacity="0"/></linearGradient></defs>
      ${guides}<path d="${area}" class="sp-area" fill="url(#spFill)"/><path d="${line}" class="sp-line"/>${dots}</svg>
    <div class="sp-legend">${['fresh', 'tired', 'heavy', 'burnt'].map((b) => `<span class="lg lg-${b}">${esc(bandHe(b))}</span>`).join('')}</div>
  </figure>`;
}

/** "אנרגיה 72 ← 58 · עומס 41 ← 50 (עייף)" for the week summary. s = week summary. Returns '' without data. */
export function weekLoadLine(s) {
  if (!s) return '';
  if (s.loadLineHe) return gtext(s.loadLineHe);
  const eb = s.energyBefore, ea = s.energy, lb = s.loadBefore, la = s.load;
  if (la === undefined || la === null) return '';
  const parts = [];
  if (eb !== undefined && eb !== null && ea !== undefined && ea !== null) parts.push(`אנרגיה ${Math.round(eb)} ← ${Math.round(ea)}`);
  const band = s.loadBand || bandOf(la);
  parts.push((lb !== undefined && lb !== null ? `עומס ${Math.round(lb)} ← ${Math.round(la)}` : `עומס ${Math.round(la)}`) + ` (${bandHe(band)})`);
  return parts.join(' · ');
}

/** "5 משחקים רצופים בלי לפתוח בהרכב" / "4 משחקים רצופים עם פחות מ-30 דקות" (shown up to 10, then "יותר מ-10"). */
export function benchRunHe(ct) {
  if (!ct) return '';
  const thr = typeof ct.threshold === 'number' ? ct.threshold : 3;
  const n = (k) => (k > 10 ? 'יותר מ-10' : String(k));
  if (ct.benchRun >= thr) return `${n(ct.benchRun)} משחקים רצופים בלי לפתוח בהרכב`;
  if (ct.lowMin >= 2) return `${n(ct.lowMin)} משחקים רצופים עם פחות מ-30 דקות`;
  return '';
}
