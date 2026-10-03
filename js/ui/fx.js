// fx.js: small visual effects shared by screens: 3D tilt / parallax on player cards, static stadium backdrop.
import { reducedMotion } from './app.js';
import { createTitleScene } from './scene/title-scene.js';

/**
 * 3D tilt for every .tiltable inside root (pointer + device orientation). Returns a cleanup function.
 * Disabled with reduced motion.
 */
export function mountTilt(root) {
  if (!root || reducedMotion()) return () => {};
  let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, active = false;
  const els = () => root.querySelectorAll('.tiltable');
  function apply() {
    raf = 0;
    cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
    for (const el of els()) {
      el.style.setProperty('--rx', (cy * -9).toFixed(2) + 'deg');
      el.style.setProperty('--ry', (cx * 12).toFixed(2) + 'deg');
      el.style.setProperty('--gx', (50 + cx * 40).toFixed(1) + '%');
      el.style.setProperty('--gy', (30 + cy * 30).toFixed(1) + '%');
    }
    if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) raf = requestAnimationFrame(apply);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(apply); };
  function onMove(e) {
    const el = e.target && e.target.closest ? e.target.closest('.tiltable') : null;
    if (!el) { if (active) { active = false; tx = 0; ty = 0; kick(); } return; }
    const r = el.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    active = true;
    kick();
  }
  function onLeave() { active = false; tx = 0; ty = 0; kick(); }
  let base = null;
  function onTilt(e) {
    if (active || e.gamma === null || e.beta === null) return;
    if (!base) base = { b: e.beta, g: e.gamma };
    tx = Math.max(-1, Math.min(1, (e.gamma - base.g) / 25));
    ty = Math.max(-1, Math.min(1, (e.beta - base.b) / 25));
    kick();
  }
  root.addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('pointerleave', onLeave, { passive: true });
  root.addEventListener('pointerup', onLeave, { passive: true });
  window.addEventListener('deviceorientation', onTilt, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
    root.removeEventListener('pointerup', onLeave);
    window.removeEventListener('deviceorientation', onTilt);
  };
}

/**
 * Stadium backdrop on a canvas: one still frame of the title scene (no figure), so it costs nothing per frame.
 * Returns a cleanup function.
 */
export function mountStadium(canvas, { animate = false } = {}) {
  if (!canvas) return () => {};
  let scene = null;
  try {
    scene = createTitleScene(canvas, { kid: false });
    if (animate && !reducedMotion()) scene.start();
  } catch (e) { console.warn('[hayeled] stadium', e); scene = null; }
  // the still frame is drawn by the scene's ResizeObserver; stop listening shortly after
  const t = animate ? 0 : setTimeout(() => { try { if (scene) scene.destroy(); } catch { /* ignore */ } scene = null; }, 1600);
  return () => { clearTimeout(t); try { if (scene) scene.destroy(); } catch { /* ignore */ } scene = null; };
}
