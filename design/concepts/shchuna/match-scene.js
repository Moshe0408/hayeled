/* =====================================================================
   "הילד מהשכונה" - live match scene (concept: shchuna)
   Canvas-2D, no dependencies. One rAF loop, fixed-step sim, pauses when hidden.

   const scene = createMatchScene(canvas, {
     home: { name:'מכבי ת"א', colors:{ shirt:'#FFD200', trim:'#0A47B5', shorts:'#0A47B5', gk:'#2BD07A' }, chant:'יאללה יאללה מכבי!' },
     away: { name:'בית"ר',   colors:{ shirt:'#15171C', trim:'#FFD200', shorts:'#15171C', gk:'#E0508C' } },
     hero: { name:'אזולאי' },
     reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
   });
   scene.play('dribble-shot', { outcome:'goal' })   // 'dribble-shot' | 'cross' | 'pass-back' | 'goal' | 'save' | 'miss' | 'shot'
   scene.say('קדימה! לחץ גבוה!', 'angry')           // coach speech bubble (mood: 'normal' | 'angry' | 'happy')
   scene.crowd('goal')                               // 'chant' | 'tense' | 'goal' | 'groan'
   scene.setScore(1, 0); scene.on('goal', fn); scene.pause(); scene.resume(); scene.destroy();
   ===================================================================== */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const L = 105, WD = 68; // field metres
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hyp = Math.hypot;
  const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  function makeRng(seed) { let s = seed >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  function sprite(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
  function glow(r, g, b) {
    return sprite(96, (x, s) => {
      const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.25, `rgba(${r},${g},${b},.55)`);
      gr.addColorStop(0.6, `rgba(${r},${g},${b},.14)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, s, s);
    });
  }
  function shade(hex, f) { // f<0 darken, f>0 lighten
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  const HOME_433 = [[.03, .5], [.2, .14], [.17, .38], [.17, .62], [.2, .86], [.38, .3], [.33, .5], [.38, .7], [.62, .2], [.66, .48], [.62, .82]];
  const AWAY_442 = [[.03, .5], [.2, .15], [.17, .39], [.17, .61], [.2, .85], [.4, .15], [.36, .4], [.36, .6], [.4, .85], [.6, .42], [.62, .6]];
  const SKIN = ['#F1C7A0', '#D9A273', '#B97A4E', '#8A5636', '#E8B48A'];
  const HAIR = ['#1B140F', '#2E2018', '#4A3020', '#0E0B0A', '#6B4428'];

  const LINES = {
    build: ['קדימה! לחץ גבוה!', 'תזיזו את הכדור!', 'רחב! תפתחו אגף!', 'יאללה, תעלו!'],
    chance: ['יאללה, תן לו!', 'עכשיו! תבעט!', 'אחד על אחד, קח אותו!'],
    goal: ['כל הכבוד ילד!', 'זהו! ככה משחקים!', 'איזה גול!!'],
    miss: ['מה אתה עושה?!', 'נו באמת! מקודם!', 'יאללה, הבא!'],
    save: ['כמעט! עוד אחד!', 'מה אתה עושה?!', 'שוער גדול... הבא!'],
    away: ['חזרה! כולם חזרה!', 'תסגרו אותו!', 'לחץ! לחץ!'],
    passback: ['יפה, בשקט.', 'סבלנות! לבנות מחדש!'],
  };

  function createMatchScene(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const rnd = makeRng(opts.seed || 20261003);
    const pick = (a) => a[(rnd() * a.length) | 0];
    const reduced = !!opts.reducedMotion;
    const home = Object.assign({ name: 'מכבי ת"א', chant: 'יאללה יאללה מכבי!' }, opts.home);
    const away = Object.assign({ name: 'בית"ר' }, opts.away);
    home.colors = Object.assign({ shirt: '#FFD200', trim: '#0A47B5', shorts: '#0A47B5', gk: '#2BD07A' }, home.colors);
    away.colors = Object.assign({ shirt: '#15171C', trim: '#FFD200', shorts: '#15171C', gk: '#E0508C' }, away.colors);
    const heroName = (opts.hero && opts.hero.name) || 'אזולאי';
    const listeners = {};
    const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));

    // ---------- layout ----------
    let W = 0, H = 0, dpr = 1, SH = 0, BT = 0, PT = 0, lx0 = 0, lx1 = 0, ly0 = 0, ly1 = 0, kx = 1, ky = 1;
    let pitchCanvas = null, standBg = null, bannerCanvas = null, ledCanvas = null;
    const G_FLARE = glow(255, 96, 54), G_LIGHT = glow(255, 236, 190), G_SMOKE = sprite(64, (x, s) => {
      const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(232,206,214,.55)'); gr.addColorStop(.6, 'rgba(200,170,190,.22)'); gr.addColorStop(1, 'rgba(180,150,170,0)');
      x.fillStyle = gr; x.fillRect(0, 0, s, s);
    });
    const sx = (fx) => lx0 + (1 - fx / L) * (lx1 - lx0); // home attacks toward screen-left
    const sy = (fy) => ly0 + (fy / WD) * (ly1 - ly0);

    function layout() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(300, Math.round(r.width)); H = Math.max(300, Math.round(r.height));
      dpr = Math.min(global.devicePixelRatio || 1, opts.maxDpr || 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      SH = Math.round(H * 0.25); BT = 14; PT = SH + BT;
      lx0 = 22; lx1 = W - 22; ly0 = PT + 13; ly1 = H - 58;
      kx = (lx1 - lx0) / L; ky = (ly1 - ly0) / WD;
      buildPitch(); buildStand(); buildBanner(); buildLed(); buildFans();
    }

    // ---------- static layers ----------
    function off(w, h, s = dpr) { const c = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s); const g = c.getContext('2d'); g.scale(s, s); return [c, g]; }
    function buildPitch() {
      const s = dpr * 1.25; const h = H - PT;
      const [c, g] = off(W, h, s); g.translate(0, -PT);
      // run-off
      g.fillStyle = '#1F7A43'; g.fillRect(0, PT, W, h);
      // mowing stripes
      const n = 14, bw = (lx1 - lx0) / n;
      for (let i = -2; i < n + 2; i++) { g.fillStyle = i % 2 ? '#2C9653' : '#279049'; g.fillRect(lx0 + i * bw, PT, bw + 0.5, h); }
      // diagonal subtle checker
      g.globalAlpha = 0.05; g.fillStyle = '#fff';
      for (let j = 0; j < 8; j++) if (j % 2) g.fillRect(0, ly0 + j * (ly1 - ly0) / 8, W, (ly1 - ly0) / 8);
      g.globalAlpha = 1;
      // floodlight pools
      for (const [px, py] of [[lx0 + 30, ly0 + 10], [lx1 - 30, ly0 + 10], [lx0 + 30, ly1 - 10], [lx1 - 30, ly1 - 10], [W / 2, (ly0 + ly1) / 2]]) {
        g.globalAlpha = 0.18; g.drawImage(G_LIGHT, px - 150, py - 110, 300, 220);
      }
      g.globalAlpha = 1;
      // lines
      g.strokeStyle = 'rgba(255,255,255,.86)'; g.lineWidth = 1.4; g.lineJoin = 'round';
      const X = sx, Y = sy;
      g.strokeRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
      g.beginPath(); g.moveTo(X(52.5), ly0); g.lineTo(X(52.5), ly1); g.stroke();
      g.beginPath(); g.ellipse(X(52.5), Y(34), 9.15 * kx, 9.15 * ky, 0, 0, TAU); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(X(52.5), Y(34), 1.6, 0, TAU); g.fill();
      for (const side of [0, 1]) {
        const gx = side ? 105 : 0, dir = side ? -1 : 1;
        g.strokeRect(Math.min(X(gx), X(gx + dir * 16.5)), Y(34 - 20.16), Math.abs(X(gx + dir * 16.5) - X(gx)), Y(34 + 20.16) - Y(34 - 20.16));
        g.strokeRect(Math.min(X(gx), X(gx + dir * 5.5)), Y(34 - 9.16), Math.abs(X(gx + dir * 5.5) - X(gx)), Y(34 + 9.16) - Y(34 - 9.16));
        g.beginPath(); g.arc(X(gx + dir * 11), Y(34), 1.3, 0, TAU); g.fill();
        // D arc
        g.save(); g.beginPath(); const bx = X(gx + dir * 16.5);
        g.rect(side ? 0 : bx, 0, side ? bx : W - bx, H); g.clip();
        // because X is flipped, region outside the box is toward the centre
        g.restore();
        g.save(); g.beginPath();
        if (X(gx) > W / 2) g.rect(0, PT, bx, H); else g.rect(bx, PT, W - bx, H);
        g.clip(); g.beginPath(); g.ellipse(X(gx + dir * 11), Y(34), 9.15 * kx, 9.15 * ky, 0, 0, TAU); g.stroke(); g.restore();
      }
      // corner arcs
      for (const [cx, cy, a0] of [[lx0, ly0, 0], [lx1, ly0, Math.PI / 2], [lx1, ly1, Math.PI], [lx0, ly1, -Math.PI / 2]]) { g.beginPath(); g.arc(cx, cy, 3, a0, a0 + Math.PI / 2); g.stroke(); }
      // technical area + bench pad (on the ground)
      g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.45)';
      g.strokeRect(W * 0.40, ly1 + 6, W * 0.42, H - ly1 - 4); g.setLineDash([]);
      // vignette at the edges of the frame
      const vg = g.createLinearGradient(0, PT, 0, H);
      vg.addColorStop(0, 'rgba(6,12,30,.42)'); vg.addColorStop(.12, 'rgba(6,12,30,0)'); vg.addColorStop(.86, 'rgba(6,12,30,0)'); vg.addColorStop(1, 'rgba(6,12,30,.35)');
      g.fillStyle = vg; g.fillRect(0, PT, W, h);
      pitchCanvas = c;
    }
    function buildStand() {
      const [c, g] = off(W, SH);
      const gr = g.createLinearGradient(0, 0, 0, SH);
      gr.addColorStop(0, '#070C1F'); gr.addColorStop(.35, '#111A3A'); gr.addColorStop(1, '#1B2550');
      g.fillStyle = gr; g.fillRect(0, 0, W, SH);
      // tiers
      for (let i = 0; i < 6; i++) { const y = 14 + i * (SH - 14) / 6; g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, y, W, 1); }
      // aisles
      for (const ax of [W * 0.33, W * 0.67]) { g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(ax - 5, 10, 10, SH); }
      // roof edge + floodlight glare
      g.fillStyle = '#05091A'; g.fillRect(0, 0, W, 9);
      g.globalCompositeOperation = 'lighter';
      for (const fx of [W * 0.1, W * 0.5, W * 0.9]) { g.globalAlpha = .5; g.drawImage(G_LIGHT, fx - 46, -40, 92, 80); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      for (const fx of [W * 0.1, W * 0.5, W * 0.9]) { g.fillStyle = '#FFF6DA'; for (let i = 0; i < 5; i++) g.fillRect(fx - 12 + i * 5, 2, 3.5, 3.5); }
      standBg = c;
    }
    function buildBanner() {
      const bw = W - 56, bh = 21;
      const [c, g] = off(bw, bh, dpr);
      const col = home.colors;
      g.fillStyle = col.trim; g.fillRect(0, 0, bw, bh);
      g.fillStyle = col.shirt; g.fillRect(0, 2.5, bw, bh - 5);
      g.fillStyle = col.trim; g.font = '400 15px "Secular One", "Rubik", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      g.fillText(home.chant || 'יאללה יאללה!', bw / 2, bh / 2 + 1);
      // stars at the ends
      g.font = '700 11px Rubik, sans-serif'; g.fillText('★', 12, bh / 2 + 1); g.fillText('★', bw - 12, bh / 2 + 1);
      bannerCanvas = c;
    }
    function buildLed() {
      const txt = `   הילד מהשכונה  ●  ליגת העל לנוער  ●  ${home.name} - ${away.name}  ●  מהשכונה ועד הבאלון ד'אור  ●`;
      const tmp = document.createElement('canvas').getContext('2d');
      tmp.font = '400 11px "Secular One", Rubik, sans-serif';
      const tw = Math.ceil(tmp.measureText(txt).width) + 20;
      const [c, g] = off(tw, BT, dpr);
      g.fillStyle = '#05070F'; g.fillRect(0, 0, tw, BT);
      g.font = tmp.font; g.fillStyle = '#FF9B3D'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.textAlign = 'right';
      g.fillText(txt, tw - 6, BT / 2 + 1);
      // dot matrix
      g.fillStyle = 'rgba(5,7,15,.55)';
      for (let x = 0; x < tw; x += 2) g.fillRect(x, 0, .7, BT);
      for (let y = 0; y < BT; y += 2) g.fillRect(0, y, tw, .7);
      ledCanvas = c;
    }

    // ---------- fans ----------
    let fans = [], flags = [], flares = [];
    function buildFans() {
      fans = []; flags = []; flares = [];
      const rows = 5; const hc = home.colors;
      const palette = [hc.shirt, hc.shirt, hc.shirt, hc.trim, hc.trim, '#F4F1EA', '#20263A'];
      for (let r = 0; r < rows; r++) {
        const sc = 0.78 + r * 0.075; const y = 24 + r * ((SH - 26) / rows) + 6;
        const step = 10.5 * sc;
        for (let x = 4 + (r % 2) * step / 2; x < W - 2; x += step * (0.92 + rnd() * 0.2)) {
          if (Math.abs(x - W * 0.33) < 6 || Math.abs(x - W * 0.67) < 6) { if (rnd() < 0.8) continue; }
          const type = rnd() < 0.2 ? 'scarf' : rnd() < 0.12 ? 'arms' : 'n';
          fans.push({ x: x + (rnd() - .5) * 2, y, r, sc, shirt: pick(palette), skin: pick(SKIN), hair: pick(HAIR), ph: rnd() * TAU, type, jumpK: 0.7 + rnd() * 0.6 });
        }
      }
      // flags held above the crowd
      const fdefs = [[W * 0.14, 'club'], [W * 0.41, 'il'], [W * 0.6, 'club2'], [W * 0.86, 'club']];
      for (const [fx, kind] of fdefs) flags.push({ x: fx, y: 36, kind, ph: rnd() * TAU, w: 38, h: 22 });
      // flares (some lit always, more on goal)
      for (const [fx, row, always] of [[W * 0.22, 2, true], [W * 0.74, 1, true], [W * 0.08, 3, false], [W * 0.5, 2, false], [W * 0.92, 2, false], [W * 0.36, 1, false]]) {
        flares.push({ x: fx, y: 24 + row * ((SH - 26) / 5) - 8, always, ph: rnd() * 10, on: always ? 1 : 0 });
      }
    }

    // ---------- teams ----------
    function makeTeam(side, base, team) {
      return base.map((b, i) => ({ side, i, base: b, team, x: 0, y: 0, vx: 0, vy: 0, face: side === 'home' ? Math.PI : 0, phase: rnd() * TAU, gk: i === 0, ov: null, wob: rnd() * TAU, skin: pick(SKIN), hair: pick(HAIR), kick: 0, dive: null, slide: 0, celebrate: 0 }));
    }
    const H11 = makeTeam('home', HOME_433, home), A11 = makeTeam('away', AWAY_442, away);
    const ALL = H11.concat(A11);
    const hero = H11[10], striker = H11[9];
    const toField = (p, u, v) => (p.side === 'home' ? [u * L, v * WD] : [(1 - u) * L, (1 - v) * WD]);

    const ball = { x: 52.5, y: 34, z: 0, mode: 'held', owner: null, from: null, to: null, t: 0, dur: 1, peak: 0, recv: null, onArrive: null, spin: 0, vx: 0, vy: 0 };
    let possession = 'home';

    // ---------- world state ----------
    let time = 0, phase = 'kickoff', pt = 0, passes = 0, planPasses = 3, nextPassAt = 1, plan = null, scoreH = 0, scoreA = 0, loops = 0;
    let crowdMode = 'chant', crowdT = 0, flash = 0, shake = 0, goalT = -1, fadeT = -1, fadeCb = null, netRipple = { t: -1, y: 34, side: 0 }, slowmo = 1;
    const cam = { x: 0, y: 0, z: 1 };
    const smoke = [], confetti = [];
    const coach = { x: 0, pose: 'hips', angles: [0.55, -1.9, 0.55, -1.9], jump: 0, lean: 0, bubble: null, lastSay: -10, shoutT: 0 };
    let lastLine = 0;

    function kickoffPositions(kicking) {
      for (const p of ALL) {
        const [u, v] = p.base; let uu = u * 0.46 + 0.02; if (!p.gk && uu > 0.47) uu = 0.47;
        const [fx, fy] = toField(p, uu, v); p.x = fx; p.y = fy; p.vx = p.vy = 0; p.ov = null; p.dive = null; p.slide = 0; p.celebrate = 0;
        p.face = p.side === 'home' ? Math.PI : 0;
      }
      const team = kicking === 'home' ? H11 : A11;
      const k = team[9]; const [kfx, kfy] = toField(k, 0.497, 0.5); k.x = kfx; k.y = kfy;
      ball.x = 52.5; ball.y = 34; ball.z = 0; ball.mode = 'held'; ball.owner = k; possession = kicking;
      phase = 'kickoff'; pt = 0;
    }

    function shapeTarget(p) {
      const att = possession === p.side;
      const bu = p.side === 'home' ? ball.x / L : 1 - ball.x / L;
      const bv = p.side === 'home' ? ball.y / WD : 1 - ball.y / WD;
      let u, v;
      if (p.gk) { u = 0.025 + (att ? 0.05 : 0) + Math.max(0, bu - 0.6) * 0; v = 0.5 + (bv - 0.5) * 0.28; }
      else {
        u = att ? p.base[0] * 0.62 + 0.12 + bu * 0.3 : p.base[0] * 0.55 + 0.04 + bu * 0.28;
        v = p.base[1] + (bv - 0.5) * (att ? 0.2 : 0.3);
        u += Math.sin(time * 0.5 + p.wob) * 0.01; v += Math.cos(time * 0.42 + p.wob) * 0.012;
        u = clamp(u, 0.03, 0.9); v = clamp(v, 0.04, 0.96);
      }
      return toField(p, u, v);
    }

    function passTo(from, to, o = {}) {
      const speed = o.speed || (o.lofted ? 16 : 19);
      let ax, ay;
      if (o.point) { [ax, ay] = o.point; } else if (to.ov) { ax = to.ov.x; ay = to.ov.y; } else { const [tx, ty] = shapeTarget(to); ax = lerp(to.x, tx, 0.6); ay = lerp(to.y, ty, 0.6); }
      const d = hyp(ax - ball.x, ay - ball.y);
      const dur = clamp(d / speed, 0.35, 1.7);
      ball.mode = 'pass'; ball.from = { x: ball.x, y: ball.y }; ball.to = { x: ax, y: ay }; ball.t = 0; ball.dur = dur;
      ball.peak = o.lofted ? Math.min(7, d * 0.16) : 0.15; ball.recv = to; ball.owner = null; ball.onArrive = o.onArrive || null;
      if (from) from.kick = 0.3;
      to.ov = { x: ax, y: ay, s: 9 };
      possession = to.side;
    }

    function chooseReceiver(owner) {
      const team = owner.side === 'home' ? H11 : A11; const fwd = owner.side === 'home' ? 1 : -1;
      let best = null, bs = -1e9;
      for (const p of team) {
        if (p === owner || p.gk) continue;
        const d = hyp(p.x - owner.x, p.y - owner.y); if (d < 8 || d > 34) continue;
        const prog = (p.x - owner.x) * fwd;
        let s = prog + rnd() * 10 - Math.abs(d - 18) * 0.3;
        if (p === hero && owner.side === 'home') s -= 30; // hero gets the ball in the final phase only
        if (s > bs) { bs = s; best = p; }
      }
      return best || team[6];
    }

    function nearest(list, x, y, excl) { let b = null, bd = 1e9; for (const p of list) { if (p === excl || p.gk) continue; const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; b = p; } } return b; }

    function line(kind, mood) {
      if (time - lastLine < 2.6 && kind !== 'goal' && kind !== 'miss' && kind !== 'save') return;
      say(pick(LINES[kind]), mood || (kind === 'miss' || kind === 'save' ? 'angry' : kind === 'goal' ? 'happy' : 'normal'));
    }

    function setPhase(p) { phase = p; pt = 0; emit('phase', p); }

    // ---------- director ----------
    function director(dt) {
      pt += dt;
      // execute a queued plan when the home side has a settled ball
      if (plan && !plan.started) {
        if (['away', 'saved', 'miss', 'kickoff'].includes(phase) && fadeT < 0) {
          // win the ball back instantly (tackle) then feed the hero
          const m = nearest(H11, ball.x, ball.y);
          if (ball.mode === 'held' || ball.mode === 'pass') {
            ball.mode = 'held'; ball.owner = m; ball.recv = null; possession = 'home'; m.ov = null;
            for (const p of A11) if (!p.gk) p.ov = null;
            setPhase('build'); nextPassAt = 0.25;
          }
        }
        if ((phase === 'build' || phase === 'chance') && ball.mode === 'held' && ball.owner && ball.owner.side === 'home') {
          plan.started = true;
          if (ball.owner === hero) startHeroAction();
          else feedHero();
          return;
        }
      }
      switch (phase) {
        case 'kickoff':
          if (pt > 0.9) {
            const team = possession === 'home' ? H11 : A11;
            passTo(ball.owner, team[6], { onArrive: () => { setPhase(possession === 'home' ? 'build' : 'away'); nextPassAt = 0.8; passes = 0; planPasses = 2 + ((rnd() * 2) | 0); } });
            setPhase('kickoff-pass');
          }
          break;
        case 'build': {
          if (ball.mode !== 'held') break;
          const o = ball.owner;
          o.ov = { x: clamp(o.x + 7, 3, 96), y: clamp(o.y + Math.sin(time * 1.3 + o.wob) * 5, 4, 64), s: 5.5 };
          const a = nearest(A11, o.x, o.y); if (a) a.ov = { x: o.x + 3, y: o.y + (o.y < 34 ? 1.5 : -1.5), s: 6.8 };
          if (pt > nextPassAt) {
            if (passes >= planPasses || o.x > 64) { feedHero(); }
            else {
              const r = chooseReceiver(o); passes++;
              passTo(o, r, { onArrive: () => { nextPassAt = pt + 0.7 + rnd() * 0.9; } });
              if (rnd() < 0.5) line('build');
            }
          }
          break;
        }
        case 'feed': break; // waiting for ball to reach hero
        case 'chance': {
          hero.ov = { x: Math.min(hero.x + 2.6, 88), y: lerp(hero.y, 50, 0.02), s: 2.8 };
          const d = nearest(A11, hero.x, hero.y); if (d) d.ov = { x: hero.x + 3.2, y: hero.y - 0.8, s: 4 };
          slowmo = lerp(slowmo, 0.55, 0.05);
          if (pt > 1.6 && !plan) {
            const r = rnd();
            const action = r < 0.62 ? 'dribble-shot' : r < 0.86 ? 'cross' : 'pass-back';
            const o = rnd(); plan = { action, outcome: o < 0.38 ? 'goal' : o < 0.75 ? 'save' : 'miss', started: true, auto: true };
            startHeroAction();
          }
          break;
        }
        case 'dribble':
          if (pt > (plan && plan.action === 'cross' ? 0.75 : 0.9)) {
            if (plan.action === 'cross') doCross(); else shoot(hero, plan.outcome);
          }
          break;
        case 'cross': case 'shot': break;
        case 'goal':
          if (pt > 4.2 && fadeT < 0) cut(() => { kickoffPositions('away'); loops++; slowmo = 1; });
          break;
        case 'saved':
          if (pt > 1.5) {
            const gk = A11[0]; const r = A11[2 + ((rnd() * 2) | 0)];
            passTo(gk, r, { onArrive: () => { setPhase('away'); nextPassAt = 0.7; passes = 0; planPasses = 2 + ((rnd() * 2) | 0); } });
            setPhase('restart');
          }
          break;
        case 'miss':
          if (pt > 1.6) {
            const gk = A11[0]; ball.mode = 'held'; ball.owner = gk; ball.z = 0; gk.ov = null; possession = 'away';
            const r = A11[3];
            passTo(gk, r, { onArrive: () => { setPhase('away'); nextPassAt = 0.7; passes = 0; planPasses = 2 + ((rnd() * 2) | 0); } });
            setPhase('restart');
          }
          break;
        case 'restart': case 'kickoff-pass': case 'passback': break;
        case 'away': {
          if (ball.mode !== 'held') break;
          const o = ball.owner;
          o.ov = { x: clamp(o.x - 6, 8, 100), y: clamp(o.y + Math.sin(time + o.wob) * 4, 4, 64), s: 5.5 };
          const hp = nearest(H11, o.x, o.y); if (hp) hp.ov = { x: o.x - 3, y: o.y, s: 6.6 };
          if (pt > 0.4 && time - lastLine > 4) line('away');
          if (pt > nextPassAt) {
            if (passes >= planPasses) {
              // interception: a home midfielder steps in front of the pass
              const r = chooseReceiver(o);
              const mx = lerp(o.x, r.x, 0.55), my = lerp(o.y, r.y, 0.55);
              const m = nearest(H11, mx, my);
              passTo(o, m, { point: [mx, my], speed: 15, onArrive: () => { setPhase('build'); passes = 0; planPasses = 2 + ((rnd() * 3) | 0); nextPassAt = 0.6; crowd('chant'); } });
              emit('turnover', 'home');
            } else {
              const r = chooseReceiver(o); passes++;
              passTo(o, r, { onArrive: () => { nextPassAt = pt + 0.8 + rnd() * 0.8; } });
            }
          }
          break;
        }
      }
    }

    function feedHero() {
      const o = ball.owner;
      const spot = [clamp(Math.max(hero.x + 6, 74), 70, 84), WD * 0.8];
      hero.ov = { x: spot[0], y: spot[1], s: 8.5 };
      passTo(o, hero, { point: spot, lofted: hyp(spot[0] - ball.x, spot[1] - ball.y) > 26, onArrive: () => {
        if (plan && plan.started && !plan.running) startHeroAction();
        else { setPhase('chance'); emit('chance', { minute: null }); line('chance'); crowd('tense'); }
      } });
      setPhase('feed');
    }

    function startHeroAction() {
      plan.running = true;
      const act = plan.action;
      crowd('tense');
      if (act === 'pass-back') {
        const m = H11[6]; m.ov = { x: hero.x - 14, y: 40, s: 6 };
        passTo(hero, m, { point: [hero.x - 14, 40], onArrive: () => { setPhase('build'); passes = 0; planPasses = 2; nextPassAt = 0.9; crowd('chant'); emit('result', { action: act, outcome: 'kept' }); plan = null; } });
        setPhase('passback'); line('passback', 'normal');
        return;
      }
      setPhase('dribble');
      slowmo = 1;
      const d = nearest(A11, hero.x, hero.y);
      if (act === 'dribble-shot') {
        hero.ov = { x: Math.min(hero.x + 7, 92), y: hero.y - 10, s: 9.5 };
        if (d) { d.ov = { x: hero.x + 1.2, y: hero.y + 0.6, s: 10 }; d.slide = 0.9; }
      } else {
        hero.ov = { x: Math.min(hero.x + 11, 98), y: Math.min(hero.y + 2, 62), s: 9.5 };
        if (d) { d.ov = { x: hero.x + 6, y: hero.y + 2, s: 9 }; }
        striker.ov = { x: 97, y: 33, s: 9 };
      }
      say(pick(LINES.chance), 'normal');
    }

    function doCross() {
      setPhase('cross');
      const ty = 30 + rnd() * 6;
      striker.ov = { x: 97.5, y: ty, s: 9 };
      const cb = nearest(A11, 97, ty); if (cb) cb.ov = { x: 96.5, y: ty + 1.6, s: 8 };
      passTo(hero, striker, { point: [97.5, ty], lofted: true, speed: 18, onArrive: () => { shoot(striker, plan.outcome, true); } });
    }

    function shoot(p, outcome, header) {
      setPhase('shot');
      const gk = A11[0];
      let ty, tz;
      const side = rnd() < 0.5 ? -1 : 1;
      if (outcome === 'goal') { ty = 34 + side * (2.3 + rnd() * 0.9); tz = header ? 0.8 : 1.6; }
      else if (outcome === 'save') { ty = 34 + side * (0.6 + rnd() * 1.6); tz = 0.9; }
      else { ty = 34 + side * (4.6 + rnd() * 2.6); tz = 1.2; }
      const tx = outcome === 'goal' ? 106.6 : outcome === 'miss' ? 108 : 104.2;
      ball.mode = 'shot'; ball.from = { x: ball.x, y: ball.y }; ball.to = { x: tx, y: ty }; ball.t = 0;
      ball.dur = hyp(tx - ball.x, ty - ball.y) / (header ? 20 : 28); ball.peak = tz; ball.recv = null; ball.owner = null; ball.outcome = outcome;
      p.kick = 0.35;
      // keeper reaction
      setTimeout(() => {}, 0);
      gk.reactIn = 0.12;
      gk.diveTo = outcome === 'goal' ? gk.y + (ty - gk.y) * 0.55 : outcome === 'save' ? ty : gk.y + (ty - gk.y) * 0.25;
      gk.diveOutcome = outcome;
      emit('shot', { outcome });
    }

    function resolveShot() {
      const o = ball.outcome; const gk = A11[0];
      if (o === 'goal') {
        ball.mode = 'net'; ball.z = 0.5; netRipple = { t: 0, y: ball.y, side: 0 }; scoreH++;
        setPhase('goal'); goalT = 0; flash = 1; shake = reduced ? 0 : 1; crowd('goal');
        const scorer = plan && plan.action === 'cross' ? striker : hero;
        celebrate(scorer);
        say(pick(LINES.goal), 'happy');
        emit('goal', { team: 'home', scorer: scorer === hero ? heroName : 'striker', score: [scoreH, scoreA] });
      } else if (o === 'save') {
        ball.mode = 'held'; ball.owner = gk; ball.z = 0; possession = 'away';
        setPhase('saved'); crowd('groan'); say(pick(LINES.save), 'angry');
        emit('save', {});
      } else {
        ball.mode = 'loose'; ball.vx = 9; ball.vy = (ball.y - 34) * 0.4; ball.z = 0.6;
        setPhase('miss'); crowd('groan'); say(pick(LINES.miss), 'angry');
        emit('miss', {});
      }
      if (plan) emit('result', { action: plan.action, outcome: o, auto: !!plan.auto });
      plan = null;
    }

    function celebrate(scorer) {
      scorer.ov = { x: 101, y: 4, s: 8.5 }; scorer.celebrate = 1;
      let k = 0;
      for (const p of H11) { if (p === scorer || p.gk) continue; k++; if (k > 6) { p.ov = null; continue; } p.ov = { x: 96 - k * 1.6 + rnd() * 2, y: 6 + (k % 3) * 2.2 + rnd() * 2, s: 7 + rnd() }; p.celebrate = 1; }
      for (const p of A11) { if (!p.gk) p.ov = { x: lerp(p.x, 70, 0.3), y: p.y, s: 1.5 }; }
    }

    function cut(cb) { fadeT = 0; fadeCb = cb; }

    // ---------- simulation step ----------
    function stepPlayers(dt) {
      for (const p of ALL) {
        if (p.kick > 0) p.kick -= dt;
        if (p.slide > 0) p.slide -= dt * 0.9;
        // keeper dive
        if (p.gk && p.reactIn !== undefined && p.reactIn !== null) {
          p.reactIn -= dt;
          if (p.reactIn <= 0) { p.dive = { t: 0, dir: Math.sign(p.diveTo - p.y) || 1, to: p.diveTo }; p.reactIn = null; }
        }
        let tx, ty, spd;
        if (p.dive) {
          p.dive.t += dt; tx = p.gk && p.side === 'away' ? 104 : 1; ty = p.dive.to; spd = p.dive.t < 0.45 ? 11 : 0;
          if (p.dive.t > 1.6) p.dive = null;
        } else if (p.ov) { tx = p.ov.x; ty = p.ov.y; spd = p.ov.s || 7; }
        else { [tx, ty] = shapeTarget(p); spd = 5.4; }
        if (p.gk && !p.dive && phase !== 'goal') { const [gx, gy] = shapeTarget(p); if (!p.ov || ball.owner !== p) { tx = gx; ty = gy; } }
        const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
        const want = d > 0.05 ? Math.min(spd, d * 2.2) : 0;
        const dvx = d > 0.05 ? (dx / d) * want : 0, dvy = d > 0.05 ? (dy / d) * want : 0;
        const k = 1 - Math.exp(-dt * (p.dive ? 14 : 5));
        p.vx = lerp(p.vx, dvx, k); p.vy = lerp(p.vy, dvy, k);
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = clamp(p.x, -2, 107); p.y = clamp(p.y, -1.5, 69.5);
        const s = hyp(p.vx, p.vy);
        p.phase += s * dt * 1.7;
        let tf;
        if (s > 0.6) tf = Math.atan2(p.vy * ky, -p.vx * kx);
        else tf = Math.atan2((ball.y - p.y) * ky, -(ball.x - p.x) * kx);
        if (!p.dive) { let df = tf - p.face; df = Math.atan2(Math.sin(df), Math.cos(df)); p.face += df * Math.min(1, dt * 8); }
        p.speed = s;
      }
    }
    function stepBall(dt) {
      ball.spin += dt * (ball.mode === 'held' ? hyp(ball.owner ? ball.owner.vx : 0, ball.owner ? ball.owner.vy : 0) * 3 : 18);
      if (ball.mode === 'held' && ball.owner) {
        const o = ball.owner;
        const fx = -Math.cos(o.face) / kx * 3, fy = Math.sin(o.face) / ky * 3; // ~ 3px ahead in screen space
        const touch = 0.25 + Math.abs(Math.sin(o.phase * 0.5)) * 0.5;
        ball.x = lerp(ball.x, o.x + fx * touch, 0.5); ball.y = lerp(ball.y, o.y + fy * touch, 0.5); ball.z = 0;
        if (o.gk) { ball.x = o.x; ball.y = o.y; ball.z = 0.8; }
      } else if (ball.mode === 'pass' || ball.mode === 'shot') {
        ball.t += dt / ball.dur; const t = Math.min(1, ball.t);
        ball.x = lerp(ball.from.x, ball.to.x, t); ball.y = lerp(ball.from.y, ball.to.y, t);
        ball.z = ball.mode === 'shot' ? ball.peak * Math.sin(t * Math.PI * 0.8) : ball.peak * 4 * t * (1 - t);
        if (ball.mode === 'shot') {
          const gk = A11[0];
          if (ball.outcome === 'save' && t > 0.86 && hyp(gk.x - ball.x, gk.y - ball.y) < 3.2) { resolveShot(); return; }
          if (t >= 1) resolveShot();
        } else if (t >= 1) {
          const r = ball.recv; ball.mode = 'held'; ball.owner = r; ball.z = 0; possession = r.side;
          r.ov = null; const cb = ball.onArrive; ball.onArrive = null; if (cb) cb();
        }
      } else if (ball.mode === 'net') {
        ball.x = lerp(ball.x, 106.8, 0.1); ball.z = Math.max(0, ball.z - dt);
      } else if (ball.mode === 'loose') {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.vx *= 0.97; ball.vy *= 0.97; ball.z = Math.max(0, ball.z - dt * 1.5);
      }
    }
    function stepCrowd(dt) {
      crowdT += dt;
      if ((crowdMode === 'goal' && crowdT > 6) || (crowdMode === 'groan' && crowdT > 2.6)) crowd('chant');
      const goalish = crowdMode === 'goal';
      for (const f of flares) {
        f.on = lerp(f.on, f.always || goalish ? 1 : 0, dt * 2);
        if (reduced) continue;
        if (f.on > 0.3 && smoke.length < (goalish ? 90 : 44) && rnd() < dt * (goalish ? 12 : 5)) {
          smoke.push({ x: f.x + (rnd() - .5) * 4, y: f.y - 4, vx: (rnd() - .5) * 5 - 2, vy: -6 - rnd() * 6, r: 5 + rnd() * 3, a: 0.5 + rnd() * 0.2, life: 0, max: 2.6 + rnd() * 1.6 });
        }
      }
      for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i]; s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= 0.995; s.r += dt * 9;
        if (s.life > s.max) smoke.splice(i, 1);
      }
      if (goalish && !reduced && crowdT < 2.2 && confetti.length < 110 && rnd() < dt * 60) {
        confetti.push({ x: rnd() * W, y: -4, vx: (rnd() - .5) * 20, vy: 30 + rnd() * 30, r: rnd() * TAU, vr: (rnd() - .5) * 12, c: pick([home.colors.shirt, home.colors.trim, '#FFFFFF', '#FF9B3D']), life: 0 });
      }
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i]; c.life += dt; c.x += (c.vx + Math.sin(c.life * 4 + c.r) * 14) * dt; c.y += c.vy * dt; c.r += c.vr * dt;
        if (c.y > H * 0.62 || c.life > 6) confetti.splice(i, 1);
      }
    }
    function stepCoach(dt) {
      const bx = sx(ball.x);
      const target = clamp(lerp(W * 0.62, bx, 0.28), W * 0.46, W * 0.78);
      coach.x = lerp(coach.x || target, target, 1 - Math.exp(-dt * 1.2));
      // pose by context
      let pose = 'hips';
      if (coach.bubble && coach.bubble.t < coach.bubble.dur) pose = coach.bubble.mood === 'angry' ? (phase === 'miss' || phase === 'saved' ? 'head' : 'shout') : coach.bubble.mood === 'happy' ? 'up' : 'point';
      if (phase === 'goal' && pt < 4) pose = 'up';
      if (phase === 'chance' || phase === 'dribble') pose = 'wave';
      coach.pose = pose;
      const t = time;
      const sideBall = Math.atan2(sy(ball.y) - (H - 46), bx - coach.x); // screen angle to ball
      // convert to "from straight down, outward" for right arm (side +1): vector(sin a, cos a)
      const toArm = (ang, side) => { const vx = Math.cos(ang) * side, vy = Math.sin(ang); return Math.atan2(vx, vy); };
      let tgt;
      switch (pose) {
        case 'up': tgt = [2.75 + Math.sin(t * 9) * 0.15, 0.1, 2.75 + Math.cos(t * 9) * 0.15, 0.1]; break;
        case 'head': tgt = [2.25, 2.15, 2.25, 2.15]; break;
        case 'shout': tgt = [1.95, 1.75, 0.5, -1.9]; break;
        case 'wave': tgt = [2.55 + Math.sin(t * 7) * 0.45, 0.35, 0.55, -1.9]; break;
        case 'point': { const a = toArm(sideBall, 1); tgt = [clamp(a, 0.4, 3.0), 0.05, 0.55, -1.9]; break; }
        default: tgt = [0.55, -1.9, 0.55, -1.9];
      }
      const k = 1 - Math.exp(-dt * 10);
      for (let i = 0; i < 4; i++) coach.angles[i] = lerp(coach.angles[i], tgt[i], k);
      coach.jump = pose === 'up' && !reduced ? Math.abs(Math.sin(t * 7)) * 4 : lerp(coach.jump, 0, k);
      if (coach.bubble) coach.bubble.t += dt;
    }

    // ---------- drawing ----------
    function drawStand() {
      ctx.drawImage(standBg, 0, 0, W, SH);
      const t = time; const m = crowdMode;
      const amp = reduced ? 0.6 : m === 'goal' ? 7 : m === 'tense' ? 1.2 : m === 'groan' ? 0.3 : 2.4;
      const beat = m === 'goal' ? 1.9 : 1.15;
      // flags (behind first rows)
      let drewFlags = false;
      for (const f of fans) {
        if (!drewFlags && f.r >= 2) { drawFlags(); drewFlags = true; }
        const jump = Math.abs(Math.sin(t * Math.PI * beat + (m === 'goal' ? f.ph : f.ph * 0.25))) * amp * f.jumpK;
        const s = f.sc, x = f.x, y = f.y - jump;
        const armsUp = m === 'goal' || f.type === 'arms' || (f.type === 'scarf' && m !== 'groan');
        // body
        ctx.fillStyle = f.shirt;
        ctx.beginPath(); ctx.roundRect(x - 4.4 * s, y - 9 * s, 8.8 * s, 12 * s, 3 * s); ctx.fill();
        if (m === 'groan') {
          ctx.strokeStyle = f.shirt; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - 3.5 * s, y - 7.5 * s); ctx.lineTo(x - 4.5 * s, y - 14.5 * s); ctx.lineTo(x - 1.5 * s, y - 15 * s);
          ctx.moveTo(x + 3.5 * s, y - 7.5 * s); ctx.lineTo(x + 4.5 * s, y - 14.5 * s); ctx.lineTo(x + 1.5 * s, y - 15 * s); ctx.stroke();
        } else if (armsUp) {
          const sw = m === 'goal' ? Math.sin(t * 10 + f.ph) * 1.5 : Math.sin(t * 2.4 + f.ph) * 1.2;
          ctx.strokeStyle = f.shirt; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - 3.4 * s, y - 7.5 * s); ctx.lineTo(x - 6 * s + sw, y - 19 * s);
          ctx.moveTo(x + 3.4 * s, y - 7.5 * s); ctx.lineTo(x + 6 * s + sw, y - 19 * s); ctx.stroke();
          if (f.type === 'scarf') {
            ctx.strokeStyle = home.colors.shirt; ctx.lineWidth = 3 * s;
            ctx.beginPath(); ctx.moveTo(x - 6 * s + sw, y - 19.5 * s); ctx.lineTo(x + 6 * s + sw, y - 19.5 * s); ctx.stroke();
            ctx.strokeStyle = home.colors.trim; ctx.lineWidth = 1.2 * s; ctx.setLineDash([2 * s, 2 * s]);
            ctx.beginPath(); ctx.moveTo(x - 6 * s + sw, y - 19.5 * s); ctx.lineTo(x + 6 * s + sw, y - 19.5 * s); ctx.stroke(); ctx.setLineDash([]);
          }
          ctx.fillStyle = f.skin; ctx.beginPath(); ctx.arc(x - 6 * s + sw, y - 19.5 * s, 1.3 * s, 0, TAU); ctx.arc(x + 6 * s + sw, y - 19.5 * s, 1.3 * s, 0, TAU); ctx.fill();
        }
        // head
        ctx.fillStyle = f.skin; ctx.beginPath(); ctx.arc(x, y - 11.6 * s, 3.1 * s, 0, TAU); ctx.fill();
        ctx.fillStyle = f.hair; ctx.beginPath(); ctx.arc(x, y - 12.3 * s, 3.1 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      }
      if (!drewFlags) drawFlags();
      // drummer (front left)
      const dx = W * 0.3, dy = SH - 24;
      const hit = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * (beat * 0.5))), 12);
      ctx.fillStyle = '#E9E2D2'; ctx.beginPath(); ctx.ellipse(dx, dy, 8, 6.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = home.colors.trim; ctx.fillRect(dx - 8, dy, 16, 6); ctx.beginPath(); ctx.ellipse(dx, dy + 6, 8, 2.2, 0, 0, TAU); ctx.fill();
      if (hit > 0.2 && !reduced) { ctx.strokeStyle = `rgba(255,240,200,${hit * 0.6})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(dx, dy, 10 + hit * 6, 8 + hit * 4, 0, 0, TAU); ctx.stroke(); }
      // flares
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flares) {
        if (f.on < 0.05) continue;
        const fl = 0.75 + Math.sin(t * 31 + f.ph) * 0.12 + Math.sin(t * 13 + f.ph) * 0.13;
        const R = (34 + fl * 14) * f.on;
        ctx.globalAlpha = 0.85 * f.on; ctx.drawImage(G_FLARE, f.x - R, f.y - R, R * 2, R * 2);
        ctx.globalAlpha = f.on; ctx.fillStyle = '#FFF2DA'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.2 * fl, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // banner on the rail (gentle wave)
      const bw = W - 56, bh = 21, by = SH - 23; const strips = 28, sw = bw / strips; const src = bannerCanvas;
      for (let i = 0; i < strips; i++) {
        const off = reduced ? 0 : Math.sin(t * 2.2 + i * 0.45) * (m === 'goal' ? 2.4 : 1.1);
        ctx.drawImage(src, (i * sw) * (src.width / bw), 0, sw * (src.width / bw) + 1, src.height, 28 + i * sw, by + off, sw + 0.6, bh);
      }
      // rail
      ctx.fillStyle = '#0A0F22'; ctx.fillRect(0, SH - 2, W, 2);
    }
    function drawFlags() {
      const t = time;
      for (const f of flags) {
        const amp = reduced ? 0.6 : crowdMode === 'goal' ? 4 : 2.2, sp = crowdMode === 'goal' ? 7 : 4;
        const sway = reduced ? 0 : Math.sin(t * 1.4 + f.ph) * 3;
        // pole
        ctx.strokeStyle = '#C9C3B5'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(f.x, f.y + 26); ctx.lineTo(f.x + sway, f.y - 6); ctx.stroke();
        const segs = 9; const top = [], bot = [];
        for (let i = 0; i <= segs; i++) {
          const u = i / segs; const w = Math.sin(t * sp - u * 5 + f.ph) * amp * u;
          top.push([f.x + sway + u * f.w, f.y - 6 + w]); bot.push([f.x + sway + u * f.w * 0.97, f.y - 6 + f.h + w * 1.15]);
        }
        const poly = (from, to, col) => {
          ctx.fillStyle = col; ctx.beginPath();
          for (let i = 0; i <= segs; i++) { const p = [lerp(top[i][0], bot[i][0], from), lerp(top[i][1], bot[i][1], from)]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
          for (let i = segs; i >= 0; i--) ctx.lineTo(lerp(top[i][0], bot[i][0], to), lerp(top[i][1], bot[i][1], to));
          ctx.closePath(); ctx.fill();
        };
        if (f.kind === 'il') {
          poly(0, 1, '#F7F7F2'); poly(0.12, 0.24, '#1F4FD8'); poly(0.76, 0.88, '#1F4FD8');
          const mi = segs / 2 | 0; const cx = lerp(top[mi][0], bot[mi][0], .5), cy = lerp(top[mi][1], bot[mi][1], .5);
          ctx.strokeStyle = '#1F4FD8'; ctx.lineWidth = 1.1;
          for (const rot of [0, Math.PI]) { ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = rot - Math.PI / 2 + k * TAU / 3; const px = cx + Math.cos(a) * 4.2, py = cy + Math.sin(a) * 4.2; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }
        } else if (f.kind === 'club2') {
          poly(0, 1, home.colors.trim); poly(0.36, 0.64, home.colors.shirt);
        } else { poly(0, 0.5, home.colors.shirt); poly(0.5, 1, home.colors.trim); }
      }
    }
    function drawSmokeAndConfetti() {
      for (const s of smoke) {
        const a = s.a * (1 - s.life / s.max);
        ctx.globalAlpha = a; ctx.drawImage(G_SMOKE, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
      }
      ctx.globalAlpha = 1;
      for (const c of confetti) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-2, -1, 4, 2 + Math.abs(Math.sin(c.r * 2)) * 1.5); ctx.restore();
      }
    }
    let ledX = 0;
    function drawLed(dt) {
      ledX = (ledX + dt * 26) % ledCanvas.width;
      const tw = ledCanvas.width / dpr;
      ctx.fillStyle = '#05070F'; ctx.fillRect(0, SH, W, BT);
      for (let x = -tw + (ledX / dpr) % tw; x < W; x += tw) ctx.drawImage(ledCanvas, x, SH, tw, BT);
      ctx.fillStyle = 'rgba(255,155,61,.18)'; ctx.fillRect(0, SH + BT - 1, W, 1);
    }

    function drawNet(gxScreen, dir, rip) {
      // dir: -1 net extends to the left of the line, +1 to the right
      const y0 = sy(34 - 3.66), y1 = sy(34 + 3.66), depth = 2.2 * kx;
      const bulge = (yy) => {
        if (!rip || rip.t < 0) return 0;
        const env = Math.exp(-rip.t * 2.4) * Math.cos(rip.t * 13) * 5.5;
        const iy = sy(rip.y); const d = (yy - iy) / 8;
        return env * Math.exp(-d * d);
      };
      ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 0.6;
      const n = 7;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) { // horizontal strands
        const yy = lerp(y0, y1, i / 10); const b = bulge(yy);
        ctx.moveTo(gxScreen, yy); ctx.lineTo(gxScreen + dir * (depth + b), yy);
      }
      for (let j = 1; j <= n; j++) { // vertical strands
        const f = j / n;
        for (let i = 0; i <= 12; i++) { const yy = lerp(y0, y1, i / 12); const xx = gxScreen + dir * f * (depth + bulge(yy)); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      }
      ctx.stroke();
      // frame
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gxScreen + dir * depth, y0 - 1); ctx.lineTo(gxScreen, y0); ctx.lineTo(gxScreen, y1); ctx.lineTo(gxScreen + dir * depth, y1 + 1); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gxScreen, y0, 1.3, 0, TAU); ctx.arc(gxScreen, y1, 1.3, 0, TAU); ctx.fill();
    }

    function drawPlayer(p) {
      const X = sx(p.x), Y = sy(p.y);
      const kit = p.team.colors;
      const shirt = p.gk ? kit.gk : kit.shirt;
      const sc = 1;
      // floodlight cross-shadows
      ctx.fillStyle = 'rgba(4,20,10,.28)'; ctx.beginPath(); ctx.ellipse(X + 2.6, Y + 2.4, 5, 2.4, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(4,20,10,.14)'; ctx.beginPath(); ctx.ellipse(X - 2.6, Y + 2.4, 5, 2.4, -0.5, 0, TAU); ctx.fill();
      if (p === hero) {
        const pul = 0.5 + Math.sin(time * 5) * 0.5;
        ctx.strokeStyle = `rgba(255,155,61,${0.55 + pul * 0.45})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(X, Y + 1, 8 + pul * 1.5, 4.6 + pul, 0, 0, TAU); ctx.stroke();
      }
      ctx.save(); ctx.translate(X, Y); ctx.rotate(p.face);
      let jumpScale = 1;
      if (p.celebrate && phase === 'goal') jumpScale = 1 + Math.abs(Math.sin(time * 8 + p.wob)) * 0.12;
      ctx.scale(sc * jumpScale, sc * jumpScale);
      if (p.dive) {
        // stretched dive: body along the dive direction (screen y)
        ctx.rotate(-p.face + (p.dive.dir > 0 ? Math.PI / 2 : -Math.PI / 2));
        ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 3.4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = shirt; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(5, -2.5); ctx.lineTo(11, -3.5); ctx.moveTo(5, 2.5); ctx.lineTo(11, 3.5); ctx.stroke();
        ctx.fillStyle = '#F4F1EA'; ctx.beginPath(); ctx.arc(11.5, -3.6, 1.5, 0, TAU); ctx.arc(11.5, 3.6, 1.5, 0, TAU); ctx.fill();
        ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(7, 0, 2.7, 0, TAU); ctx.fill();
        ctx.restore(); return;
      }
      const run = Math.min(1, (p.speed || 0) / 5);
      const stride = Math.sin(p.phase * 2.2) * 3.4 * run;
      // legs (boots)
      ctx.fillStyle = '#121418';
      if (p.slide > 0.1) { ctx.beginPath(); ctx.ellipse(6, 1.5, 4, 1.6, 0, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(stride + (p.kick > 0 ? 3 : 0), -2.1, 1.9, 1.35, 0, 0, TAU); ctx.ellipse(-stride, 2.1, 1.9, 1.35, 0, 0, TAU); ctx.fill();
      // arms
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(-stride * 0.6, -5.6, 1.4, 0, TAU); ctx.arc(stride * 0.6, 5.6, 1.4, 0, TAU); ctx.fill();
      // shoulders / shirt
      ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 5.9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = p.gk ? shade(shirt, -0.35) : kit.trim; ctx.lineWidth = 1.1; ctx.stroke();
      // head
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(0.5, 0, 2.75, 0, TAU); ctx.fill();
      ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(0.1, 0, 2.75, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
      ctx.restore();
    }

    function drawBall() {
      const X = sx(ball.x), Y = sy(ball.y), z = ball.z * 2.6;
      ctx.fillStyle = `rgba(4,20,10,${0.38 - Math.min(0.25, z * 0.02)})`;
      ctx.beginPath(); ctx.ellipse(X + 1 + z * 0.3, Y + 1.2 + z * 0.15, 2.4, 1.4, 0, 0, TAU); ctx.fill();
      const r = 2.3 + z * 0.04;
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(X, Y - z, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#20263A'; ctx.beginPath(); ctx.arc(X + Math.cos(ball.spin) * r * 0.45, Y - z + Math.sin(ball.spin * 0.7) * r * 0.35, r * 0.42, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(X, Y - z, r, 0, TAU); ctx.stroke();
      if (ball.mode === 'shot') { // speed trail
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        const bx = sx(ball.from.x), byy = sy(ball.from.y); const ang = Math.atan2(Y - byy, X - bx);
        ctx.beginPath(); ctx.moveTo(X, Y - z); ctx.lineTo(X - Math.cos(ang) * 14, Y - z - Math.sin(ang) * 14); ctx.stroke();
      }
    }
    function drawHeroTag() {
      const X = sx(hero.x), Y = sy(hero.y) - 13;
      ctx.font = '700 8.5px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      const label = heroName; const w = ctx.measureText(label).width + 10;
      ctx.fillStyle = '#FF7A2F'; ctx.beginPath(); ctx.roundRect(X - w / 2, Y - 6, w, 12, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X - 3, Y + 5.5); ctx.lineTo(X + 3, Y + 5.5); ctx.lineTo(X, Y + 9); ctx.fill();
      ctx.fillStyle = '#0B1433'; ctx.fillText(label, X, Y + 0.5);
    }

    function drawBench() {
      const x0 = 12, y0 = H - 40, w = W * 0.3, h = 34;
      // subs (back view) in training bibs
      for (let i = 0; i < 5; i++) {
        const x = x0 + 12 + i * (w - 20) / 4, y = y0 + 22;
        ctx.fillStyle = '#FF7A2F'; ctx.beginPath(); ctx.roundRect(x - 6, y - 4, 12, 13, 4); ctx.fill();
        ctx.fillStyle = SKIN[(i * 3) % 5]; ctx.beginPath(); ctx.arc(x, y - 7, 3.8, 0, TAU); ctx.fill();
        ctx.fillStyle = HAIR[i % 5]; ctx.beginPath(); ctx.arc(x, y - 7.6, 3.8, 0, TAU); ctx.fill();
      }
      // dugout perspex shell
      ctx.fillStyle = 'rgba(160,200,255,.14)'; ctx.strokeStyle = 'rgba(220,235,255,.55)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x0, H); ctx.lineTo(x0, y0 + 8); ctx.quadraticCurveTo(x0, y0, x0 + 10, y0); ctx.lineTo(x0 + w - 10, y0); ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + 8); ctx.lineTo(x0 + w, H); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x0 + 6, y0 + 3, w * 0.4, 2);
    }

    function drawCoach() {
      const x = coach.x, feet = H - 3 - coach.jump; const t = time;
      const navy = '#16224D', stripe = '#FF7A2F';
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, H - 3, 15, 3.5, 0, 0, TAU); ctx.fill();
      // legs
      ctx.fillStyle = navy; ctx.beginPath(); ctx.roundRect(x - 9, feet - 25, 8, 23, 3); ctx.roundRect(x + 1, feet - 25, 8, 23, 3); ctx.fill();
      ctx.fillStyle = stripe; ctx.fillRect(x - 9, feet - 24, 1.4, 21); ctx.fillRect(x + 7.6, feet - 24, 1.4, 21);
      ctx.fillStyle = '#0B0E16'; ctx.beginPath(); ctx.roundRect(x - 10, feet - 4, 9.5, 4.5, 2); ctx.roundRect(x + 0.5, feet - 4, 9.5, 4.5, 2); ctx.fill();
      // arms (drawn before torso when hanging, after when raised)
      const sh = [[x - 10.5, feet - 45], [x + 10.5, feet - 45]];
      const arm = (side, a1, a2) => {
        const [ox, oy] = side > 0 ? sh[1] : sh[0];
        const ex = ox + Math.sin(a1) * 12 * side, ey = oy + Math.cos(a1) * 12;
        const hx = ex + Math.sin(a1 + a2) * 11 * side, hy = ey + Math.cos(a1 + a2) * 11;
        ctx.strokeStyle = navy; ctx.lineWidth = 6.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.strokeStyle = stripe; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(ox + side * 1.2, oy); ctx.lineTo(ex + side * 1.2, ey); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = '#D9A273'; ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, TAU); ctx.fill();
      };
      const [a1, a2, b1, b2] = coach.angles;
      // torso
      ctx.fillStyle = navy;
      ctx.beginPath(); ctx.moveTo(x - 12, feet - 44); ctx.quadraticCurveTo(x - 12, feet - 49, x - 6, feet - 49); ctx.lineTo(x + 6, feet - 49); ctx.quadraticCurveTo(x + 12, feet - 49, x + 12, feet - 44);
      ctx.lineTo(x + 10, feet - 23); ctx.lineTo(x - 10, feet - 23); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x - 10, feet - 30, 20, 2);
      ctx.fillStyle = '#FFF4E3'; ctx.font = '700 6.5px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      ctx.fillText('מאמן', x, feet - 37);
      arm(-1, b1, b2); arm(1, a1, a2);
      // head (back view)
      ctx.fillStyle = '#C98E62'; ctx.beginPath(); ctx.arc(x, feet - 55, 6.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2A2A2E'; ctx.beginPath(); ctx.arc(x, feet - 56.5, 6.6, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
      ctx.fillStyle = '#9B9BA3'; ctx.beginPath(); ctx.arc(x, feet - 57.6, 5.2, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
      ctx.fillStyle = '#C98E62'; ctx.beginPath(); ctx.ellipse(x - 6.6, feet - 55, 1.5, 2.3, 0, 0, TAU); ctx.ellipse(x + 6.6, feet - 55, 1.5, 2.3, 0, 0, TAU); ctx.fill();
      // shout lines
      if (coach.bubble && coach.bubble.t < coach.bubble.dur && !reduced) {
        const k = (Math.sin(t * 20) + 1) * 0.5;
        ctx.strokeStyle = `rgba(255,244,227,${0.5 + k * 0.4})`; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath();
        for (const a of [-2.3, -1.9, -1.5]) { const r0 = 10 + k, r1 = 14 + k * 2; ctx.moveTo(x + Math.cos(a) * r0, feet - 58 + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, feet - 58 + Math.sin(a) * r1); }
        ctx.stroke();
      }
    }
    function drawBubble() {
      const b = coach.bubble; if (!b || b.t > b.dur + 0.25) return;
      const appear = Math.min(1, b.t / 0.22), vanish = b.t > b.dur ? 1 - (b.t - b.dur) / 0.25 : 1;
      const s = reduced ? 1 : easeOutBack(appear);
      ctx.font = '800 13.5px Rubik, sans-serif'; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(b.text).width; const w = tw + 22, h = 28;
      const headX = coach.x, headY = H - 66;
      let cx = clamp(headX - 18, w / 2 + 6, W - w / 2 - 6), cy = headY - 26;
      const fill = b.mood === 'angry' ? '#EF4E5A' : b.mood === 'happy' ? '#F6C445' : '#FFF4E3';
      const ink = b.mood === 'angry' ? '#FFFFFF' : '#0B1433';
      ctx.save(); ctx.globalAlpha = vanish; ctx.translate(headX, headY - 8); ctx.scale(s, s); ctx.translate(-headX, -(headY - 8));
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.roundRect(cx - w / 2 + 2, cy - h / 2 + 3, w, h, 12); ctx.fill();
      ctx.fillStyle = fill; ctx.strokeStyle = '#0B1433'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 12); ctx.fill(); ctx.stroke();
      // tail
      const tx = clamp(headX, cx - w / 2 + 14, cx + w / 2 - 14);
      ctx.beginPath(); ctx.moveTo(tx - 6, cy + h / 2 - 1); ctx.lineTo(headX + 2, headY - 6); ctx.lineTo(tx + 5, cy + h / 2 - 1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx - 6, cy + h / 2); ctx.lineTo(headX + 2, headY - 6); ctx.lineTo(tx + 5, cy + h / 2); ctx.stroke();
      ctx.fillStyle = fill; ctx.fillRect(tx - 6.5, cy + h / 2 - 3, 12, 3);
      ctx.fillStyle = ink; ctx.fillText(b.text, cx, cy + 1);
      ctx.restore();
    }
    function drawGoalText() {
      if (goalT < 0) return;
      const t = goalT; if (t > 3.2) { goalT = -1; return; }
      const a = t < 2.7 ? 1 : 1 - (t - 2.7) / 0.5;
      const s = reduced ? 1 : t < 0.35 ? easeOutBack(t / 0.35) : 1 + Math.sin(t * 6) * 0.015;
      const cx = W / 2, cy = (PT + ly1) / 2 - 8;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(cx, cy); ctx.rotate(-0.07); ctx.scale(s, s);
      ctx.font = '400 74px "Secular One", Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#FFF4E3'; ctx.lineWidth = 20; ctx.strokeText('גול!', 0, 0);
      ctx.strokeStyle = '#0B1433'; ctx.lineWidth = 12; ctx.strokeText('גול!', 4, 6); ctx.strokeText('גול!', 0, 0);
      const gr = ctx.createLinearGradient(0, -34, 0, 30); gr.addColorStop(0, '#FFE08A'); gr.addColorStop(.5, '#FF9B3D'); gr.addColorStop(1, '#FF7A2F');
      ctx.fillStyle = gr; ctx.fillText('גול!', 0, 0);
      // scorer pill
      ctx.font = '800 13px Rubik, sans-serif';
      const nm = (plan && plan.action === 'cross') ? 'בישול של ' + heroName : heroName + ' כובש!';
      const w = ctx.measureText(nm).width + 24;
      ctx.fillStyle = '#0B1433'; ctx.beginPath(); ctx.roundRect(-w / 2, 40, w, 24, 12); ctx.fill();
      ctx.strokeStyle = '#F6C445'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#F6C445'; ctx.fillText(nm, 0, 52.5);
      ctx.restore();
    }

    function render(dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let ox = 0, oy = 0;
      if (shake > 0) { ox = (rnd() - .5) * 5 * shake; oy = (rnd() - .5) * 5 * shake; }
      ctx.translate(ox, oy);
      drawStand(); drawLed(dt);
      // pitch with camera
      ctx.save();
      ctx.beginPath(); ctx.rect(-6, PT, W + 12, H - PT + 6); ctx.clip();
      const vcx = W / 2, vcy = (PT + H) / 2;
      ctx.translate(vcx, vcy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
      ctx.drawImage(pitchCanvas, 0, PT, W, H - PT);
      drawNet(sx(105), -1, netRipple.side === 0 ? netRipple : null);
      drawNet(sx(0), 1, null);
      const order = ALL.slice().sort((a, b) => a.y - b.y);
      for (const p of order) drawPlayer(p);
      drawBall();
      drawHeroTag();
      ctx.restore();
      drawBench(); drawCoach();
      drawSmokeAndConfetti();
      drawBubble();
      drawGoalText();
      if (flash > 0) { ctx.fillStyle = `rgba(255,244,227,${flash * 0.45})`; ctx.fillRect(-10, -10, W + 20, H + 20); }
      if (fadeT >= 0) { const a = fadeT < 0.25 ? fadeT / 0.25 : 1 - (fadeT - 0.25) / 0.3; ctx.fillStyle = `rgba(5,8,20,${clamp(a, 0, 1)})`; ctx.fillRect(-10, PT, W + 20, H); }
    }

    function stepCamera(dt) {
      let z = 1, tx = W / 2, ty = (PT + H) / 2;
      if (!reduced) {
        const focus = ['chance', 'dribble', 'shot', 'cross'].includes(phase) ? 1.22 : phase === 'goal' ? 1.12 : 1.06;
        z = focus;
        tx = sx(ball.x); ty = sy(ball.y);
      }
      const hw = W / (2 * z), hh = (H - PT) / (2 * z);
      tx = clamp(tx, hw, W - hw); ty = clamp(ty, PT + hh, H - hh);
      const k = 1 - Math.exp(-dt * 2.2);
      cam.z = lerp(cam.z, z, k); cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k);
      // keep the clamp honest while zoom eases
      const hw2 = W / (2 * cam.z), hh2 = (H - PT) / (2 * cam.z);
      cam.x = clamp(cam.x, hw2, W - hw2); cam.y = clamp(cam.y, PT + hh2, H - hh2);
    }

    function step(dt) {
      const sdt = dt * slowmo;
      if (phase !== 'chance') slowmo = lerp(slowmo, 1, 0.05);
      time += sdt;
      director(sdt); stepPlayers(sdt); stepBall(sdt); stepCrowd(dt); stepCoach(dt); stepCamera(dt);
      if (netRipple.t >= 0) { netRipple.t += dt; if (netRipple.t > 3) netRipple.t = -1; }
      if (goalT >= 0) goalT += dt;
      flash = Math.max(0, flash - dt * 2.2); shake = Math.max(0, shake - dt * 1.8);
      if (fadeT >= 0) { const prev = fadeT; fadeT += dt; if (prev < 0.25 && fadeT >= 0.25 && fadeCb) { fadeCb(); fadeCb = null; } if (fadeT > 0.55) fadeT = -1; }
    }

    // ---------- public helpers ----------
    function say(text, mood = 'normal') { coach.bubble = { text, mood, t: 0, dur: Math.max(1.8, 0.9 + text.length * 0.08) }; lastLine = time; emit('say', { text, mood }); }
    function crowd(mode) { if (crowdMode !== mode) { crowdMode = mode; crowdT = 0; emit('crowd', mode); } }

    // ---------- loop ----------
    let raf = 0, last = 0, acc = 0, running = false, destroyed = false;
    function frame(ts) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts;
      acc += dt; const STEP = 1 / 60; let n = 0;
      while (acc >= STEP && n < 6) { step(STEP); acc -= STEP; n++; }
      render(dt);
    }
    function resume() { if (running || destroyed) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
    function pause() { running = false; cancelAnimationFrame(raf); }
    const onVis = () => (document.hidden ? pause() : opts.autoStart !== false && resume());
    document.addEventListener('visibilitychange', onVis);
    const ro = global.ResizeObserver ? new ResizeObserver(() => { layout(); }) : null;

    layout(); ro && ro.observe(canvas);
    kickoffPositions('home');
    coach.x = W * 0.62;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) { buildBanner(); buildLed(); } });
    if (opts.autoStart !== false) resume();

    return {
      play(type, o = {}) {
        let action = type, outcome = o.outcome;
        if (type === 'goal' || type === 'save' || type === 'miss') { action = 'dribble-shot'; outcome = type; }
        if (type === 'shot') { action = 'dribble-shot'; }
        if (!outcome) { const r = rnd(); outcome = r < 0.4 ? 'goal' : r < 0.75 ? 'save' : 'miss'; }
        if (plan && plan.running) return false;
        plan = { action, outcome, started: false };
        return true;
      },
      say, crowd,
      setScore(h, a) { scoreH = h; scoreA = a; },
      getScore: () => [scoreH, scoreA],
      get phase() { return phase; },
      on(e, f) { (listeners[e] = listeners[e] || []).push(f); return () => { listeners[e] = listeners[e].filter((x) => x !== f); }; },
      pause, resume,
      /** advance the simulation without rendering (used for deterministic screenshots / tests) */
      _advance(sec) { const STEP = 1 / 60; for (let i = 0; i < sec * 60; i++) step(STEP); render(0); },
      destroy() { destroyed = true; pause(); document.removeEventListener('visibilitychange', onVis); ro && ro.disconnect(); },
    };
  }

  // ---------- crowd audio (WebAudio, procedural, default muted) ----------
  function createCrowdAudio() {
    let ac = null, master, bed, bedFilter, chantGain, timer = 0, muted = true, step = 0, nextT = 0, roarUntil = 0;
    function noiseBuffer(sec) {
      const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate); const d = b.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.035 * w) / 1.035; d[i] = last * 3.2; }
      return b;
    }
    function init() {
      ac = new (global.AudioContext || global.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
      const src = ac.createBufferSource(); src.buffer = noiseBuffer(3); src.loop = true;
      bedFilter = ac.createBiquadFilter(); bedFilter.type = 'bandpass'; bedFilter.frequency.value = 650; bedFilter.Q.value = 0.5;
      bed = ac.createGain(); bed.gain.value = 0.35;
      src.connect(bedFilter); bedFilter.connect(bed); bed.connect(master); src.start();
      const src2 = ac.createBufferSource(); src2.buffer = noiseBuffer(2); src2.loop = true;
      const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 480; f2.Q.value = 2.2;
      chantGain = ac.createGain(); chantGain.gain.value = 0; src2.connect(f2); f2.connect(chantGain); chantGain.connect(master); src2.start();
    }
    function drum(t, v) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
    }
    function schedule() {
      if (!ac) return;
      const PAT = [1, 0, 1, 0, 1, 1, 1, 0]; const SP = 0.26;
      while (nextT < ac.currentTime + 0.3) {
        const s = step % 8; if (PAT[s]) drum(nextT, s === 0 ? 1 : 0.7);
        // chant syllables: "ya-la ya-la"
        const on = s % 2 === 0 && ac.currentTime > roarUntil;
        chantGain.gain.setTargetAtTime(on ? 0.22 : 0.04, nextT, 0.05);
        nextT += SP; step++;
      }
    }
    return {
      setMuted(m) {
        muted = m;
        if (!m && !ac) init();
        if (!ac) return;
        if (!m) { ac.resume(); nextT = ac.currentTime + 0.05; master.gain.setTargetAtTime(0.5, ac.currentTime, 0.3); clearInterval(timer); timer = setInterval(schedule, 100); }
        else { master.gain.setTargetAtTime(0, ac.currentTime, 0.15); clearInterval(timer); setTimeout(() => muted && ac.suspend(), 400); }
      },
      get muted() { return muted; },
      roar() { if (!ac || muted) return; const t = ac.currentTime; roarUntil = t + 3.5; bed.gain.cancelScheduledValues(t); bed.gain.setTargetAtTime(1.4, t, 0.12); bed.gain.setTargetAtTime(0.35, t + 2.6, 1.1); bedFilter.frequency.setTargetAtTime(1300, t, 0.2); bedFilter.frequency.setTargetAtTime(650, t + 2.6, 1); },
      groan() { if (!ac || muted) return; const t = ac.currentTime; bed.gain.setTargetAtTime(0.85, t, 0.15); bed.gain.setTargetAtTime(0.35, t + 1.2, 0.6); bedFilter.frequency.setTargetAtTime(330, t, 0.1); bedFilter.frequency.setTargetAtTime(650, t + 1.3, 0.6); },
      tense() { if (!ac || muted) return; const t = ac.currentTime; bed.gain.setTargetAtTime(0.6, t, 0.4); },
      pause() { if (ac && !muted) ac.suspend(); },
      resume() { if (ac && !muted) ac.resume(); },
      destroy() { clearInterval(timer); if (ac) ac.close(); },
    };
  }

  global.createMatchScene = createMatchScene;
  global.createCrowdAudio = createCrowdAudio;
})(window);
