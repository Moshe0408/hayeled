// gender.js: gendered UI text (contract C2). The engine resolves {{male|female}} markers in everything it returns;
// this module does the same for the UI's own strings, based on the gender of the career in memory (male if none).
import * as game from '../engine/game.js';

const MARK = /\{\{([^{}|]*)\|([^{}]*)\}\}/g;
let cached = null;   // 'm' | 'f' | null (no career)
let fresh = false;

/** Re-read the current career gender from the engine. Call after loading / creating / closing a career. */
export function refreshGender() {
  let gd = null;
  try { if (game.hasCareer()) { const m = game.getSaveMeta(); gd = m && m.gender === 'f' ? 'f' : 'm'; } } catch { gd = null; }
  cached = gd;
  fresh = true;
  return cached;
}

/** 'm' | 'f' for the career in memory ('m' without a career). */
export function currentGender() {
  if (!fresh) refreshGender();
  return cached === 'f' ? 'f' : 'm';
}

/** Gender of the career in memory, or null without a career. */
export function careerGender() {
  if (!fresh) refreshGender();
  return cached;
}

export function isFemale() { return currentGender() === 'f'; }

/** g('נפצעת', 'נפצעת') style pick by the current career gender. */
export function g(male, female) {
  return currentGender() === 'f' ? (female === undefined ? male : female) : male;
}

/** Pick by an explicit gender (wizard, Hall of Fame entries...). */
export function gBy(gender, male, female) {
  return gender === 'f' ? (female === undefined ? male : female) : male;
}

/** Resolve {{male|female}} markers. gender defaults to the current career gender. */
export function gtext(str, gender) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  if (s.indexOf('{{') < 0) return s;
  const f = (gender || currentGender()) === 'f';
  return s.replace(MARK, (_, m, w) => (f ? w : m));
}

try { game.subscribe(() => { fresh = false; }); } catch { /* engine without subscribe */ }
