// ext.js: the one place where the UI pulls the art modules (crests C6, avatar C7, intro C8),
// plus small adapters the screens share (wizard look pickers).
import { crestSVG, crestFor } from './crests.js';
import { avatarSVG, avatarFromMeta, SKIN_TONES, HAIR_STYLES, HAIR_COLORS } from './avatar.js';
import { playIntro } from './scene/intro.js';

export { crestSVG, crestFor, avatarSVG, avatarFromMeta, playIntro };

const toColor = (x) => (typeof x === 'string' ? x : (x && (x.hex || x.color || x.c)) || '#C98C62');
const toLabel = (x) => (typeof x === 'string' ? x : (x && (x.he || x.labelHe || x.nameHe || x.name)) || '');

/** Picker data for the creation wizard: { skins: [cssColor], hairs: [labelHe], hairColors: [cssColor] }. Indexes are what avatarSVG takes. */
export function avatarLooks(gender = 'm') {
  const gd = gender === 'f' ? 'f' : 'm';
  const hairs = (HAIR_STYLES && (HAIR_STYLES[gd] || HAIR_STYLES.m)) || [];
  return {
    skins: (SKIN_TONES || []).map(toColor),
    hairs: hairs.map(toLabel),
    hairColors: (HAIR_COLORS || []).map(toColor),
  };
}
