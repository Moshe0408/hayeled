// icons.js: the shared line-icon set (v2.1 polish). Same language as the tab bar and the settings list:
// 24x24, round caps, stroke = currentColor. ico(name) -> inline SVG string (trusted, no user data).

const P = {
  ball: '<circle cx="12" cy="12" r="8.6"/><path d="m12 7.7 3.2 2.3-1.2 3.8h-4L8.8 10z"/><path d="M12 3.4v4.3M15.2 10l4.1-1.4M14 13.8l2.5 3.5M10 13.8l-2.5 3.5M8.8 10 4.7 8.6"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6v4H9z"/>',
  medal: '<path d="M7.5 3h3.2L12 8.2 13.3 3h3.2l-2.6 6.7"/><path d="M10.1 9.7 7.5 3"/><circle cx="12" cy="15.4" r="5.1"/><path d="m12 12.9.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z"/>',
  star: '<path d="m12 3.2 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.6l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  hof: '<path d="M3 9.2 12 4l9 5.2M4 20.5h16M3.5 18h17M6 10.5v7.5M10 10.5v7.5M14 10.5v7.5M18 10.5v7.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.4 7.4 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.4 7.4 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.4 7.4 0 0 0 2.6-1.5l2.4.9 2-3.4z"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7v7M9.2 11.2 12 14l2.8-2.8M10.5 18.5h3"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  chat: '<path d="M4.5 5h15A1.5 1.5 0 0 1 21 6.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-5 4v-4h-.5A1.5 1.5 0 0 1 3 14.5v-8A1.5 1.5 0 0 1 4.5 5z"/><path d="M7.5 9.5h9M7.5 12.5h6"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.6 7.2 8.4 6 8.4-6"/>',
  flag: '<path d="M5.5 21V3.8M5.5 4.2h12l-2.6 4.2 2.6 4.2h-12"/>',
  check: '<path d="M5 12.5 10 17l9-10"/>',
  cross: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  warn: '<path d="M12 3.6 21.4 20H2.6z"/><path d="M12 10v4.4M12 17.2v.2"/>',
  shield: '<path d="M12 3l7.5 3v6c0 4.5-3.3 7.8-7.5 9-4.2-1.2-7.5-4.5-7.5-9V6z"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 5.3a3.5 3.5 0 0 1 0 6.4M17.5 14a6.5 6.5 0 0 1 4 6"/>',
  stadium: '<ellipse cx="12" cy="8" rx="9" ry="3.2"/><path d="M3 8v6.5c0 1.8 4 3.3 9 3.3s9-1.5 9-3.3V8"/><path d="M7.5 10.8v6.4M12 11.2v6.6M16.5 10.8v6.4"/>',
  bag: '<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
  pen: '<path d="M4 20l1.1-4.6L16.2 4.3a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.6 18.9z"/><path d="M14.5 6l3.5 3.5"/>',
  plane: '<path d="M2.5 13 21 5l-4.4 15-4.3-5.6z"/><path d="M12.3 14.4 21 5"/>',
  sprout: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-6.5 7.5-6.5 0 4.5-3 6.5-7.5 6.5zM12 15.5c0-3-2.3-5-6-5 0 3.5 2.3 5 6 5z"/>',
  boot: '<path d="M4 6.5h6.2l1 4.4 7.3 2.4a2.6 2.6 0 0 1 1.8 2.5v1.7H4z"/><path d="M4 17.5h16.3M7 20.3h1M11 20.3h1M15 20.3h1"/>',
  medic: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  wave: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6.5-6 6.5S5.5 18.5 4.5 15l-1.2-3.2a1.4 1.4 0 0 1 2.5-1.2L8 13"/>',
  up: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  arrowUp: '<path d="M12 20V5M6 11l6-6 6 6"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.5 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.5-3.5-8.5s1.1-6 3.5-8.5z"/>',
  calendar: '<path d="M7 2v3M17 2v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5z"/>',
  table: '<path d="M4 5h16M4 10h16M4 15h16M4 20h16M9 3v19"/>',
  card: '<rect x="7" y="3.5" width="10" height="17" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  mega: '<path d="M3.5 10v4h3l8 4.5v-13l-8 4.5z"/><path d="m6.5 14 1.2 5h2.3l-1-4.4M18 9.5a3.5 3.5 0 0 1 0 5"/>',
  ff: '<path d="M3.5 6.5v11l7.5-5.5zM12.5 6.5v11l7.5-5.5z"/>',
  skip: '<path d="M5.5 6v12l9-6zM18 6v12"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/>',
  battery: '<rect x="3" y="7.5" width="16" height="9" rx="2"/><path d="M21 10.5v3M6 10.5v3"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.7-8 10.6-8 10.6z"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
  hat: '<path d="M7 15V7.5A1.5 1.5 0 0 1 8.5 6h7A1.5 1.5 0 0 1 17 7.5V15"/><path d="M3 15.5c0 1.4 4 2.5 9 2.5s9-1.1 9-2.5S17 13 12 13s-9 1.1-9 2.5z"/>',
  bank: '<path d="M3 9.2 12 4l9 5.2zM5 10.5v7M9.7 10.5v7M14.3 10.5v7M19 10.5v7M3.5 20.5h17"/>',
  whistle: '<path d="M2.5 10h10.8a5 5 0 1 1-4.7 6.8"/><circle cx="13" cy="15" r="1.4"/><path d="M12 10V6.5h4"/>',
  sparkle: '<path d="M12 3.5 13.8 10 20.5 12l-6.7 2-1.8 6.5-1.8-6.5L3.5 12l6.7-2z"/>',
  undo: '<path d="M9 7H4.5V2.5"/><path d="M4.8 7A8 8 0 1 1 4 13"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3.5"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3.5"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
  chevron: '<path d="M15 6l-6 6 6 6"/>',
  // v2.2: training load + coach talk
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3M12 14.5v2.5"/>',
  talk: '<path d="M3.5 5.5h11A1.5 1.5 0 0 1 16 7v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h-2A1.5 1.5 0 0 1 2 13V7a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M16 9h4.5A1.5 1.5 0 0 1 22 10.5v6a1.5 1.5 0 0 1-1.5 1.5h-1.5v3l-3.5-3H11a1.5 1.5 0 0 1-1.5-1.5v-1.5"/>',
  bench: '<path d="M3 11h18M4.5 11v7M19.5 11v7M3 15h18M6 7.5h12"/>',
  promise: '<path d="M12 3.2 19 6v5.5c0 4.3-3 7.7-7 9.3-4-1.6-7-5-7-9.3V6z"/><path d="m8.8 12 2.2 2.2 4.4-4.6"/>',
  fist: '<path d="M7 11V8.5a1.5 1.5 0 0 1 3 0V11M10 10V7.5a1.5 1.5 0 0 1 3 0V10M13 10V8a1.5 1.5 0 0 1 3 0v2.5M16 10.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 6 15.5V12a1.5 1.5 0 0 1 3 0v1.5"/>',
};
const FILLED = { ff: 1, skip: 1, play: 1, card: 1 };

/** Inline line icon. cls: extra classes ('gold', 'teal', 'good', 'bad', 'warn', 'lg'...). */
export function ico(name, cls = '') {
  const d = P[name] || P.info;
  return `<svg class="ico${FILLED[name] ? ' ico-fill' : ''}${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
}
export function hasIco(name) { return !!P[name]; }

/** Emoji -> icon name (empty states, legacy call sites that still pass an emoji). */
const EMO = {
  '⚽': 'ball', '🏆': 'trophy', '🏅': 'medal', '🎖️': 'medal', '⭐': 'star', '🏛️': 'hof', '🏛': 'hof', '⚙️': 'gear', '📲': 'phone', '📱': 'phone',
  '📜': 'doc', '💬': 'chat', '🎯': 'target', '🔁': 'swap', '📨': 'mail', '🏁': 'flag', '✅': 'check', '❌': 'cross', '⚠️': 'warn',
  '🛡️': 'shield', '📂': 'folder', '📋': 'clipboard', '👤': 'user', '🏟️': 'stadium', '🏟': 'stadium', '🛍️': 'bag', '✍️': 'pen', '📝': 'doc',
  '✈️': 'plane', '🌱': 'sprout', '👟': 'boot', '🤕': 'medic', '👋': 'wave', '📈': 'up', '🌍': 'globe', '📅': 'calendar', '📊': 'table',
  '🟨': 'card', '🟥': 'card', '⏱': 'clock', '💥': 'spark', '📣': 'mega', '📢': 'mega', '⏩': 'ff', '⏭': 'skip', '💼': 'briefcase', '🪫': 'battery',
  '🏳️': 'flag', '🏋️': 'dumbbell', '🙏': 'heart', '❤️': 'heart', '🎉': 'sparkle', '✨': 'sparkle', '♻️': 'undo', '🗑️': 'trash', '📥': 'download', '⏪': 'undo',
};
export function emojiIco(e, cls = '') { const n = EMO[e]; return n ? ico(n, cls) : null; }

/** Trophy / award key -> icon (cabinets, HoF, timeline). */
const TROPHY = { league2: 'arrowUp', youth_league: 'sprout', u17: 'flag', u19: 'flag', u21: 'flag', wc: 'globe', ballon_dor: 'ball' };
export function trophyIco(key, cls = 'gold') { return ico(TROPHY[key] || 'trophy', cls); }
export function awardIco(key, cls = 'gold') { return ico(key === 'ballon_dor' ? 'ball' : key === 'golden_boy' ? 'star' : 'medal', cls); }

/** Timeline entry kind -> icon. */
const TL = {
  league: 'trophy', league2: 'arrowUp', cup: 'trophy', ucl: 'trophy', uel: 'trophy', uecl: 'trophy', wc: 'trophy', euro: 'trophy', copa: 'trophy', afcon: 'trophy', asian: 'trophy', gold: 'trophy',
  u17: 'flag', u19: 'flag', u21: 'flag', youth_league: 'sprout', debut: 'boot', goal: 'ball', transfer: 'plane', loan: 'swap', injury: 'medic', callup: 'flag',
  start: 'sprout', award: 'medal', ballon_dor: 'ball', info: 'info', pro: 'pen', contract: 'pen', retired: 'wave', record: 'up', golden_boy: 'star',
};
export function timelineIco(kind) {
  const n = TL[kind] || 'info';
  const tone = n === 'trophy' || n === 'medal' || n === 'ball' && kind === 'ballon_dor' ? 'gold' : n === 'medic' ? 'bad' : n === 'sprout' || n === 'arrowUp' ? 'good' : '';
  return ico(n, tone);
}

/** Inbox sender -> icon + tint (no emoji avatars). */
const PERSONA = {
  mom: ['heart', 'p-rose'], dad: ['user', 'p-blue'], grandma: ['heart', 'p-rose'], brother: ['user', 'p-teal'], partner: ['heart', 'p-rose'],
  friends: ['users', 'p-teal'], agent: ['briefcase', 'p-gold'], coach: ['clipboard', 'p-green'], staff: ['clipboard', 'p-green'], journalist: ['mic', 'p-blue'],
  sponsor: ['briefcase', 'p-gold'], social: ['phone', 'p-violet'], captain: ['shield', 'p-green'], fan: ['mega', 'p-teal'], national_coach: ['flag', 'p-blue'],
  owner: ['hat', 'p-gold'], doctor: ['medic', 'p-red'], physio: ['medic', 'p-red'], club: ['stadium', 'p-green'], system: ['star', 'p-gold'], board: ['bank', 'p-gold'], federation: ['flag', 'p-blue'],
};
export function personaIco(from) {
  const p = PERSONA[from] || ['chat', 'p-blue'];
  return { svg: ico(p[0]), tint: p[1] };
}
