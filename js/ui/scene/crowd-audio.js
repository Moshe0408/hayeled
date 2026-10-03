// crowd-audio.js: synthesized stadium crowd (filtered noise bed, roar swells, drum beats).
// No audio files. Muted by default; the choice is remembered in localStorage ('hy.sound').
const KEY = 'hy.sound';
let ac = null, master = null, bed = null, roarG = null, on = false;

export function soundWanted() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

function init() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
    d[i] = (b0 + b1 + b2) * 0.6;
  }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.6;
  bed = ac.createGain(); bed.gain.value = 0.55;
  const bp2 = ac.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 1400; bp2.Q.value = 0.9;
  roarG = ac.createGain(); roarG.gain.value = 0;
  src.connect(bp).connect(bed).connect(master);
  src.connect(bp2).connect(roarG).connect(master);
  src.start();
  const lfo = ac.createOscillator(), lg = ac.createGain();
  lfo.frequency.value = 0.18; lg.gain.value = 0.15; lfo.connect(lg).connect(bed.gain); lfo.start();
  return true;
}

/** Turn the crowd on/off (must be called from a tap so browsers allow audio). Returns the new state. */
export function setSound(want) {
  on = !!want;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (on && !ac && !init()) { on = false; return false; }
  if (!ac) return on;
  if (ac.state === 'suspended') ac.resume();
  master.gain.setTargetAtTime(on ? 0.5 : 0, ac.currentTime, 0.2);
  return on;
}

export function isOn() { return on; }

export function roar(x = 1) {
  if (!ac || !on) return;
  const t = ac.currentTime;
  roarG.gain.cancelScheduledValues(t);
  roarG.gain.setTargetAtTime(1.2 * x, t, 0.12);
  roarG.gain.setTargetAtTime(0, t + 1.6 * x + 0.4, 0.9);
}

export function beat() {
  if (!ac || !on) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.32);
}

/** Fade out when leaving the match screen (keeps the user's preference). */
export function silence() {
  if (ac && master) master.gain.setTargetAtTime(0, ac.currentTime, 0.15);
  on = false;
}
