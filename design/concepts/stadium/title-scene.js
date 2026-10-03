/* =========================================================
   Title hero: "the kid from the neighbourhood looks at the big stadium"
   Canvas 2D, layered + pre-rendered static art, animated lights.
   createTitleScene(canvas) -> { start(), stop(), destroy() }
   ========================================================= */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function off(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function sprite(r, inner, outer) {
    const c = off(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, inner); gr.addColorStop(.25, inner.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
  }
  // tapered capsule (same shape language as the crest pictogram)
  function cap(g, x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const phi = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
    g.moveTo(x1 + r1 * Math.cos(a + phi), y1 + r1 * Math.sin(a + phi));
    g.arc(x2, y2, r2, a + phi, a - phi, true);
    g.arc(x1, y1, r1, a - phi, a + phi, true);
    g.closePath();
  }

  function createTitleScene(canvas) {
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, k = 1, HY = 0, raf = 0, running = false, last = 0, T = 0;
    let L = {};                       // pre-rendered layers
    let par = 0, parT = 0;            // parallax (-1..1)
    const motes = [], sparks = [], twinkles = [];
    let nextFw = 1.2;
    const glowTeal = sprite(64, 'rgba(210,255,250,1)', 'rgba(47,227,207,0)');
    const glowWarm = sprite(64, 'rgba(255,214,150,1)', 'rgba(255,170,70,0)');
    const glowGold = sprite(32, 'rgba(255,240,190,1)', 'rgba(244,195,90,0)');
    const glowRed  = sprite(32, 'rgba(255,170,190,1)', 'rgba(255,60,90,0)');

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height; if (!W || !H) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      k = W / 390; HY = Math.round(H * 0.5);
      build();
      if (!running) frame(performance.now(), true);
    }

    /* ---------------- static layers ---------------- */
    function build() {
      const R = rng(42), M = 24 * k; // parallax margin
      // stars
      L.stars = [];
      for (let i = 0; i < 90; i++) L.stars.push({ x: R() * W, y: R() * HY * 0.95, r: R() < .1 ? 1.3 : .6 + R() * .5, p: R() * TAU, s: .5 + R() * 2 });

      /* stadium */
      const sw = W * 0.86, sx = W / 2, top = HY - 70 * k;
      const S = off((W + M * 2) * dpr, HY * dpr), g = S.getContext('2d');
      g.scale(dpr, dpr); g.translate(M, 0);
      L.stadium = { c: S, sw, sx, top, M };
      // bowl silhouette
      g.beginPath();
      g.moveTo(sx - sw / 2, HY);
      g.lineTo(sx - sw / 2 + 6 * k, top + 26 * k);
      g.quadraticCurveTo(sx, top - 26 * k, sx + sw / 2 - 6 * k, top + 26 * k);
      g.lineTo(sx + sw / 2, HY); g.closePath();
      let gr = g.createLinearGradient(0, top - 20 * k, 0, HY);
      gr.addColorStop(0, '#0C1E3E'); gr.addColorStop(.5, '#081631'); gr.addColorStop(1, '#050D20');
      g.fillStyle = gr; g.fill();
      // facade ribs
      g.save(); g.clip();
      g.strokeStyle = 'rgba(125,200,255,.07)'; g.lineWidth = 1;
      for (let i = -24; i <= 24; i++) { const x = sx + i * sw / 48; g.beginPath(); g.moveTo(x, HY); g.lineTo(sx + (x - sx) * 0.93, top - 10 * k); g.stroke(); }
      // lit concourse band + gates
      gr = g.createLinearGradient(0, HY - 26 * k, 0, HY);
      gr.addColorStop(0, 'rgba(47,227,207,0)'); gr.addColorStop(1, 'rgba(47,227,207,.22)');
      g.fillStyle = gr; g.fillRect(sx - sw / 2, HY - 26 * k, sw, 26 * k);
      for (let i = 0; i < 9; i++) { const x = sx - sw * 0.4 + i * sw * 0.1; g.fillStyle = 'rgba(255,214,150,.55)'; g.fillRect(x - 4 * k, HY - 9 * k, 8 * k, 9 * k); }
      g.restore();
      // roof ring (LED rim)
      g.beginPath();
      g.moveTo(sx - sw / 2 + 6 * k, top + 26 * k);
      g.quadraticCurveTo(sx, top - 26 * k, sx + sw / 2 - 6 * k, top + 26 * k);
      g.lineWidth = 9 * k; g.strokeStyle = '#0F2852'; g.stroke();
      g.lineWidth = 1.6 * k; g.strokeStyle = 'rgba(160,255,245,.95)'; g.shadowColor = '#2FE3CF'; g.shadowBlur = 12 * k; g.stroke();
      g.beginPath();
      g.moveTo(sx - sw / 2 + 9 * k, top + 33 * k);
      g.quadraticCurveTo(sx, top - 16 * k, sx + sw / 2 - 9 * k, top + 33 * k);
      g.lineWidth = 1 * k; g.strokeStyle = 'rgba(244,195,90,.65)'; g.shadowColor = '#F4C35A'; g.shadowBlur = 8 * k; g.stroke();
      g.shadowBlur = 0;
      // floodlight masts
      L.lamps = [];
      [[-0.56, 150], [0.56, 150], [-0.34, 118], [0.34, 118]].forEach(([f, h], i) => {
        const x = sx + f * sw, y = HY - h * k, far = i > 1;
        g.strokeStyle = far ? '#0A1835' : '#0B1A3A'; g.lineWidth = (far ? 2.2 : 3) * k;
        g.beginPath(); g.moveTo(x - 5 * k, HY); g.lineTo(x, y + 6 * k); g.lineTo(x + 5 * k, HY); g.stroke();
        g.lineWidth = .8 * k; g.strokeStyle = 'rgba(120,170,230,.18)';
        for (let yy = y + 14 * k; yy < HY; yy += 9 * k) { const s = (yy - y) / (HY - y) * 5 * k; g.beginPath(); g.moveTo(x - s, yy); g.lineTo(x + s, yy + 9 * k); g.stroke(); }
        const hw = (far ? 13 : 17) * k, hh = (far ? 7 : 9) * k;
        g.fillStyle = '#0B1733'; g.fillRect(x - hw, y - hh, hw * 2, hh * 2);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
          g.fillStyle = 'rgba(235,255,252,.95)';
          g.fillRect(x - hw + 2 * k + c * (hw * 2 - 4 * k) / 6, y - hh + 2 * k + r * (hh * 2 - 4 * k) / 3, (hw * 2 - 4 * k) / 6 - 1.2 * k, (hh * 2 - 4 * k) / 3 - 1.2 * k);
        }
        L.lamps.push({ x, y, far, hw });
      });

      /* neighbourhood blocks (shikunim) */
      const C = off((W + M * 2) * dpr, (HY + 40 * k) * dpr), c = C.getContext('2d');
      c.scale(dpr, dpr); c.translate(M, 0);
      L.city = { c: C, M };
      L.windows = [];
      const blocks = [
        { x: -M, w: W * 0.30 + M, h: 128, side: 1 },
        { x: W * 0.17, w: W * 0.17, h: 92, side: 1, back: true },
        { x: W * 0.71, w: W * 0.29 + M, h: 140, side: -1 },
        { x: W * 0.64, w: W * 0.15, h: 84, side: -1, back: true }
      ];
      blocks.sort((a, b) => (b.back ? 1 : 0) - (a.back ? 1 : 0));
      const base = HY + 34 * k;
      blocks.forEach(b => {
        const y0 = base - b.h * k;
        c.fillStyle = b.back ? '#060E22' : '#040A19';
        c.fillRect(b.x, y0, b.w, b.h * k);
        // rim light on the edge facing the stadium
        const ex = b.side > 0 ? b.x + b.w : b.x;
        const rg = c.createLinearGradient(0, y0, 0, base);
        rg.addColorStop(0, 'rgba(125,240,226,.75)'); rg.addColorStop(1, 'rgba(125,240,226,0)');
        c.fillStyle = rg; c.fillRect(ex - (b.side > 0 ? 1.5 * k : 0), y0, 1.5 * k, b.h * k);
        c.fillStyle = 'rgba(125,240,226,.5)'; c.fillRect(b.x, y0, b.w, 1.2 * k);
        // floors, balconies, windows
        const floors = Math.floor((b.h - 14) / 15), fh = (b.h * k - 14 * k) / floors;
        for (let f = 0; f < floors; f++) {
          const fy = y0 + 6 * k + f * fh;
          c.fillStyle = 'rgba(120,160,220,.07)'; c.fillRect(b.x, fy + fh - 2 * k, b.w, 1.2 * k);
          for (let wx = b.x + 8 * k; wx < b.x + b.w - 10 * k; wx += 15 * k) {
            const lit = R(), warm = R() < .8;
            const win = { x: wx, y: fy + 3 * k, w: 8 * k, h: fh - 7 * k, a: 0, warm, back: !!b.back };
            if (lit < .3) { win.a = .35 + R() * .5; L.windows.push(win); }
            c.fillStyle = 'rgba(30,50,90,.35)'; c.fillRect(win.x, win.y, win.w, win.h);
          }
        }
        // pilotis at ground floor
        c.fillStyle = b.back ? '#060E22' : '#040A19';
        // roof: solar water heaters (dud shemesh) + antennas
        for (let rx = b.x + 10 * k; rx < b.x + b.w - 14 * k; rx += 26 * k) {
          if (R() < .25) continue;
          c.fillStyle = b.back ? '#081430' : '#060D20';
          c.beginPath(); c.moveTo(rx, y0); c.lineTo(rx + 4 * k, y0 - 9 * k); c.lineTo(rx + 16 * k, y0 - 9 * k); c.lineTo(rx + 13 * k, y0); c.fill();
          c.beginPath(); c.ellipse(rx + 10 * k, y0 - 11 * k, 7 * k, 2.8 * k, 0, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(125,240,226,.35)'; c.lineWidth = .8 * k;
          c.beginPath(); c.moveTo(rx + 4 * k, y0 - 9 * k); c.lineTo(rx + 16 * k, y0 - 9 * k); c.stroke();
          if (R() < .4) { c.strokeStyle = '#08112A'; c.lineWidth = 1 * k; c.beginPath(); c.moveTo(rx + 20 * k, y0); c.lineTo(rx + 20 * k, y0 - 22 * k); c.moveTo(rx + 15 * k, y0 - 18 * k); c.lineTo(rx + 25 * k, y0 - 18 * k); c.moveTo(rx + 16 * k, y0 - 14 * k); c.lineTo(rx + 24 * k, y0 - 14 * k); c.stroke(); }
        }
      });
      // palm trees
      [[W * 0.36, 128, -0.05], [W * 0.585, 104, 0.08]].forEach(([x, h, lean]) => {
        const by = base + 2 * k, ty = by - h * k, tx = x + lean * h * k;
        c.strokeStyle = '#030816'; c.lineCap = 'round';
        c.lineWidth = 4 * k; c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + lean * h * k * 0.2, by - h * k * 0.5, tx, ty); c.stroke();
        c.fillStyle = '#030816';
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * 0.42, len = (24 + (i % 2) * 6) * k;
          const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.55 + len * 0.35;
          c.beginPath(); c.moveTo(tx, ty);
          c.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - 4 * k, ex, ey);
          c.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.5 + 2 * k, tx, ty + 2 * k);
          c.fill();
        }
        c.strokeStyle = 'rgba(125,240,226,.35)'; c.lineWidth = 1 * k;
        c.beginPath(); c.moveTo(tx - 1 * k, ty); c.quadraticCurveTo(x + lean * h * k * 0.2 + 1.5 * k, by - h * k * 0.5, x + 1.5 * k, by - 10 * k); c.stroke();
      });
      // chain-link fence along the far edge of the court
      const fy0 = base - 30 * k, fy1 = base + 6 * k;
      c.save(); c.beginPath(); c.rect(-M, fy0, W + M * 2, fy1 - fy0); c.clip();
      c.strokeStyle = 'rgba(150,190,230,.10)'; c.lineWidth = .8 * k;
      for (let x = -M - 40 * k; x < W + M + 40 * k; x += 6 * k) { c.beginPath(); c.moveTo(x, fy0); c.lineTo(x + 36 * k, fy1); c.moveTo(x + 36 * k, fy0); c.lineTo(x, fy1); c.stroke(); }
      c.restore();
      c.fillStyle = '#040A18';
      for (let x = -M; x < W + M; x += 46 * k) c.fillRect(x, fy0 - 2 * k, 2.2 * k, fy1 - fy0 + 2 * k);
      c.fillRect(-M, fy0 - 2 * k, W + M * 2, 1.8 * k);

      /* ground / court */
      const G = off((W + M * 2) * dpr, (H - base + 10 * k) * dpr), q = G.getContext('2d');
      q.scale(dpr, dpr); q.translate(M, -base);
      L.ground = { c: G, M, y: base };
      gr = q.createLinearGradient(0, base, 0, H);
      gr.addColorStop(0, '#0C1A33'); gr.addColorStop(.35, '#08132A'); gr.addColorStop(1, '#03070F');
      q.fillStyle = gr; q.fillRect(-M, base, W + M * 2, H - base);
      // glow of stadium spilling on the court
      const sg = q.createRadialGradient(W / 2, base, 0, W / 2, base, W * 0.75);
      sg.addColorStop(0, 'rgba(47,227,207,.22)'); sg.addColorStop(1, 'rgba(47,227,207,0)');
      q.fillStyle = sg; q.fillRect(-M, base, W + M * 2, H - base);
      // asphalt speckle
      for (let i = 0; i < 900; i++) { q.fillStyle = `rgba(180,210,255,${(R() * .05).toFixed(3)})`; q.fillRect(-M + R() * (W + M * 2), base + R() * (H - base), 1, 1); }
      // faded court lines in perspective (vanishing point at stadium)
      const vx = W / 2, vy = HY - 30 * k;
      q.strokeStyle = 'rgba(220,235,255,.13)'; q.lineWidth = 2 * k;
      [-1.25, 1.25].forEach(f => { q.beginPath(); const bx = vx + f * W; q.moveTo(vx + (bx - vx) * ((base - vy) / (H - vy)), base); q.lineTo(bx, H); q.stroke(); });
      q.beginPath(); q.ellipse(W / 2, H * 0.735, W * 0.36, 22 * k, 0, 0, TAU); q.stroke();
      q.beginPath(); q.moveTo(-M, H * 0.735); q.lineTo(W + M, H * 0.735); q.stroke();
      // street goal on the left
      const gx = W * 0.07, gyb = base + 26 * k;
      q.strokeStyle = 'rgba(210,230,255,.5)'; q.lineWidth = 2 * k;
      q.beginPath(); q.moveTo(gx, gyb); q.lineTo(gx, gyb - 26 * k); q.lineTo(gx + 34 * k, gyb - 30 * k); q.lineTo(gx + 34 * k, gyb - 4 * k); q.stroke();
      q.strokeStyle = 'rgba(210,230,255,.12)'; q.lineWidth = .7 * k;
      for (let i = 1; i < 7; i++) { q.beginPath(); q.moveTo(gx + i * 34 * k / 7, gyb - 26 * k - i * .6 * k); q.lineTo(gx + i * 34 * k / 7 - 3 * k, gyb - 2 * k); q.stroke(); }
      // street lamp (left foreground)
      L.lamp = { x: W * 0.13, y: H * 0.36 };
      q.strokeStyle = '#030714'; q.lineWidth = 5 * k; q.lineCap = 'round';
      q.beginPath(); q.moveTo(W * 0.04, H + 10); q.lineTo(W * 0.04, H * 0.37); q.quadraticCurveTo(W * 0.04, H * 0.345, W * 0.08, H * 0.345); q.lineTo(L.lamp.x, H * 0.35); q.stroke();
      q.fillStyle = '#030714'; q.beginPath(); q.ellipse(L.lamp.x, H * 0.354, 12 * k, 4.5 * k, 0, 0, TAU); q.fill();

      /* the kid (back view), pre-rendered with rim light */
      const KH = 168 * k, s = KH / 200, kw = 120 * s, kh = 210 * s;
      const KC = off(kw * dpr, kh * dpr), kg = KC.getContext('2d');
      kg.scale(dpr, dpr); kg.translate(10 * s, 4 * s); kg.scale(s, s);
      L.kid = { c: KC, w: kw, h: kh, s, x: W / 2 - 60 * s, y: H * 0.69 - 202 * s };
      const parts = [];
      const P = d => { const p = new Path2D(d); parts.push(p); return p; };
      const E = (x, y, rx, ry, rot) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot || 0, 0, TAU); parts.push(p); };
      const CP = (...v) => { const p = new Path2D(); cap({ moveTo: (...q) => p.moveTo(...q), arc: (...q) => p.arc(...q), closePath: () => p.closePath() }, ...v); parts.push(p); };
      E(50, 20, 10.5, 12.5); E(39.6, 23, 2.4, 3.4); E(60.4, 23, 2.4, 3.4);
      P('M45.5 29h9v12h-9Z');
      P('M34 41C40 37 60 37 66 41L77 47Q80 49 81 53L84 66L74 69L68 58L67 99L33 99L32 58L26 69L16 66L19 53Q20 49 23 47Z');
      P('M33 96L67 96L70 127L53 129L50 117L47 129L30 127Z');
      CP(21, 67, 4.8, 19, 102, 3.8); CP(79, 67, 4.8, 82, 101, 3.8); E(19, 106, 4.2, 4.6); E(82, 105, 4.2, 4.6);
      CP(40, 124, 7.6, 40.5, 158, 5.6); CP(40.5, 158, 5.6, 40, 189, 4.2);
      CP(59, 124, 7.6, 66, 152, 5.6); CP(66, 152, 5.6, 69.5, 170, 4.4);
      E(41, 194, 6.6, 4); E(72.5, 171.5, 7.2, 4, -0.2);
      const mk = (color, dx, dy) => { const m = off(kw * dpr, kh * dpr), mg = m.getContext('2d'); mg.scale(dpr, dpr); mg.translate(10 * s + dx * s, 4 * s + dy * s); mg.scale(s, s); mg.fillStyle = color; parts.forEach(p => mg.fill(p)); return m; };
      kg.setTransform(1, 0, 0, 1, 0, 0);
      // outer bloom (backlit)
      kg.save(); kg.shadowColor = 'rgba(47,227,207,.85)'; kg.shadowBlur = 14 * s * dpr; kg.drawImage(mk('#0A1328', 0, 0), 0, 0); kg.restore();
      // body + kit details, then rim lights (edges = mask minus shifted mask)
      const rim = mk('#0A1328', 0, 0), rg2 = rim.getContext('2d');
      rg2.globalCompositeOperation = 'source-atop';
      rg2.setTransform(dpr, 0, 0, dpr, 0, 0); rg2.translate(10 * s, 4 * s); rg2.scale(s, s);
      rg2.fillStyle = '#132750'; rg2.fill(new Path2D('M34 41C40 37 60 37 66 41L77 47Q80 49 81 53L84 66L74 69L68 58L67 99L33 99L32 58L26 69L16 66L19 53Q20 49 23 47Z'));
      rg2.fillStyle = '#0B1736'; rg2.fill(new Path2D('M33 96L67 96L70 127L53 129L50 117L47 129L30 127Z'));
      rg2.fillStyle = 'rgba(244,195,90,.9)'; rg2.font = '900 25px Rubik, Heebo, sans-serif'; rg2.textAlign = 'center';
      rg2.fillText('10', 50.5, 84);
      rg2.fillStyle = 'rgba(244,195,90,.7)'; rg2.font = '800 7.5px Heebo, sans-serif'; rg2.fillText('אזולאי', 50.5, 58);
      rg2.fillStyle = '#132750'; rg2.fillRect(33, 166, 15, 21); rg2.fillRect(63, 157, 11, 12);
      rg2.fillStyle = '#04081A'; rg2.fill(new Path2D('M39.5 14C40 3 60 3 60.5 14C58 11 54 10 50 10C46 10 42 11 39.5 14Z'));
      rg2.setTransform(1, 0, 0, 1, 0, 0);
      const edge = (color, dx, dy) => { const t = mk(color, 0, 0), tg = t.getContext('2d'); tg.globalCompositeOperation = 'destination-out'; tg.drawImage(mk('#000', dx, dy), 0, 0); return t; };
      rg2.drawImage(edge('#B5FFF6', 0, 2.6), 0, 0);
      rg2.drawImage(edge('#7DF0E2', -1.6, 0.4), 0, 0);
      rg2.globalAlpha = .9; rg2.drawImage(edge('#FFC27A', 1.8, 0.6), 0, 0); rg2.globalAlpha = 1;
      kg.drawImage(rim, 0, 0);
      kg.setTransform(dpr, 0, 0, dpr, 0, 0); kg.translate(10 * s, 4 * s); kg.scale(s, s);
      // the ball under his foot
      kg.save();
      const bx = 73, by = 185, br = 13;
      let bgr = kg.createRadialGradient(bx - 4, by - 6, 1, bx, by, br);
      bgr.addColorStop(0, '#E9F2FF'); bgr.addColorStop(.6, '#9FB1CC'); bgr.addColorStop(1, '#3A4A66');
      kg.fillStyle = bgr; kg.beginPath(); kg.arc(bx, by, br, 0, TAU); kg.fill();
      kg.fillStyle = 'rgba(10,20,40,.75)';
      kg.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; kg.lineTo(bx + Math.cos(a) * 4.6, by + 1 + Math.sin(a) * 4.6); } kg.fill();
      kg.strokeStyle = 'rgba(10,20,40,.4)'; kg.lineWidth = .9;
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; kg.beginPath(); kg.moveTo(bx + Math.cos(a) * 4.6, by + 1 + Math.sin(a) * 4.6); kg.lineTo(bx + Math.cos(a) * 12, by + 1 + Math.sin(a) * 12); kg.stroke(); }
      kg.strokeStyle = 'rgba(180,255,246,.9)'; kg.lineWidth = 1.4; kg.beginPath(); kg.arc(bx, by, br - .6, -2.6, -0.6); kg.stroke();
      kg.restore();

      // dust motes
      motes.length = 0;
      for (let i = 0; i < 34; i++) motes.push({ x: R() * W, y: HY * 0.6 + R() * H * 0.45, r: .6 + R() * 1.6, vx: (R() - .5) * 4, vy: -2 - R() * 5, p: R() * TAU });
    }

    /* ---------------- animated frame ---------------- */
    function firework() {
      const R = Math.random, x = W * (0.25 + R() * 0.5), y = HY - (110 + R() * 70) * k, gold = R() < .6;
      for (let i = 0; i < 46; i++) { const a = R() * TAU, v = (30 + R() * 46) * k; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.4 + R() * .6, t: 0, gold }); }
    }

    function frame(now, single) {
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; T += dt;
      if (!reduce) { parT = Math.sin(T * 0.25) * 0.35 + parTarget; par += (parT - par) * Math.min(1, dt * 2.5); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, HY + 20 * k);
      sky.addColorStop(0, '#02050D'); sky.addColorStop(.45, '#06122A'); sky.addColorStop(.8, '#0B2A48'); sky.addColorStop(1, '#0F4256');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // stars
      for (const s of L.stars) { ctx.globalAlpha = .35 + .45 * (reduce ? .7 : (Math.sin(T * s.s + s.p) * .5 + .5)); ctx.fillStyle = '#DDEBFF'; ctx.fillRect(s.x + par * 2, s.y, s.r, s.r); }
      ctx.globalAlpha = 1;
      // light dome
      const dome = ctx.createRadialGradient(W / 2, HY - 30 * k, 0, W / 2, HY - 30 * k, W * 0.75);
      const pulse = reduce ? 1 : 0.92 + Math.sin(T * 1.3) * 0.04 + Math.sin(T * 3.1) * 0.02;
      dome.addColorStop(0, `rgba(160,255,240,${0.42 * pulse})`); dome.addColorStop(.35, `rgba(47,227,207,${0.16 * pulse})`); dome.addColorStop(1, 'rgba(47,227,207,0)');
      ctx.fillStyle = dome; ctx.fillRect(0, 0, W, HY + 40 * k);

      ctx.globalCompositeOperation = 'lighter';
      // sweeping searchlights from the stadium into the sky
      for (let i = 0; i < 2; i++) {
        const a = -Math.PI / 2 + (i ? 1 : -1) * (0.28 + Math.sin(T * 0.35 + i * 2) * 0.22);
        const ox = W / 2 + (i ? 1 : -1) * 70 * k, oy = HY - 60 * k, len = H * 0.7, wd = 0.05;
        const gr = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
        gr.addColorStop(0, 'rgba(190,255,248,.16)'); gr.addColorStop(1, 'rgba(190,255,248,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a - wd) * len, oy + Math.sin(a - wd) * len); ctx.lineTo(ox + Math.cos(a + wd) * len, oy + Math.sin(a + wd) * len); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // stadium layer
      const st = L.stadium;
      ctx.drawImage(st.c, -st.M + par * 4, 0, st.c.width / dpr, st.c.height / dpr);
      // floodlight beams + lamp bloom
      ctx.globalCompositeOperation = 'lighter';
      for (const l of L.lamps) {
        const lx = l.x + par * 4, ly = l.y, flick = reduce ? 1 : .9 + Math.sin(T * 7 + lx) * .05;
        const tx = W / 2 + (lx - W / 2) * 0.15, tyy = HY - 10 * k;
        const gr = ctx.createLinearGradient(lx, ly, tx, tyy);
        gr.addColorStop(0, `rgba(220,255,250,${(l.far ? .2 : .26) * flick})`); gr.addColorStop(1, 'rgba(220,255,250,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(lx - l.hw * .8, ly); ctx.lineTo(lx + l.hw * .8, ly);
        ctx.lineTo(tx + 60 * k, tyy); ctx.lineTo(tx - 60 * k, tyy); ctx.fill();
        const bs = (l.far ? 48 : 64) * k * flick;
        ctx.globalAlpha = .85; ctx.drawImage(glowTeal, lx - bs, ly - bs, bs * 2, bs * 2); ctx.globalAlpha = 1;
      }
      // crowd phone lights on the roof ring
      if (!reduce && Math.random() < .5) twinkles.push({ x: st.sx + (Math.random() - .5) * st.sw * 0.85, y: 0, life: .5 + Math.random() * .6, t: 0 });
      for (let i = twinkles.length - 1; i >= 0; i--) {
        const p = twinkles[i]; p.t += dt; if (p.t > p.life) { twinkles.splice(i, 1); continue; }
        const u = (p.x - st.sx) / (st.sw / 2); const yy = st.top + 26 * k - (1 - u * u) * 26 * k + 9 * k;
        const a = Math.sin(p.t / p.life * Math.PI);
        ctx.globalAlpha = a; ctx.drawImage(glowGold, p.x + par * 4 - 5 * k, yy - 5 * k, 10 * k, 10 * k);
      }
      ctx.globalAlpha = 1;
      // fireworks
      if (!reduce) { nextFw -= dt; if (nextFw <= 0) { firework(); nextFw = 3.5 + Math.random() * 3; } }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]; p.t += dt; if (p.t > p.life) { sparks.splice(i, 1); continue; }
        p.vx *= .985; p.vy = p.vy * .985 + 26 * k * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const a = 1 - p.t / p.life, sz = 6 * k * a + 2 * k;
        ctx.globalAlpha = a; ctx.drawImage(p.gold ? glowGold : glowTeal, p.x - sz, p.y - sz, sz * 2, sz * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

      // haze band
      const hz = ctx.createLinearGradient(0, HY - 40 * k, 0, HY + 40 * k);
      hz.addColorStop(0, 'rgba(47,227,207,0)'); hz.addColorStop(.6, 'rgba(60,170,190,.16)'); hz.addColorStop(1, 'rgba(47,227,207,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, HY - 40 * k, W, 80 * k);

      // city layer + animated windows
      const cy = L.city;
      ctx.drawImage(cy.c, -cy.M + par * 9, 0, cy.c.width / dpr, cy.c.height / dpr);
      for (const w of L.windows) {
        const fl = reduce ? 1 : (w.warm ? 1 : .75 + Math.sin(T * 9 + w.x) * .25);
        ctx.fillStyle = w.warm ? `rgba(255,200,120,${w.a * fl})` : `rgba(140,210,255,${w.a * fl})`;
        ctx.fillRect(w.x + par * 9, w.y, w.w, w.h);
      }

      // ground
      const gd = L.ground;
      ctx.drawImage(gd.c, -gd.M + par * 14, gd.y, gd.c.width / dpr, gd.c.height / dpr);
      // street lamp warm pool
      ctx.globalCompositeOperation = 'lighter';
      const flick = reduce ? 1 : (Math.sin(T * 23) > .97 ? .55 : 1);
      const lx = L.lamp.x + par * 14;
      let lg = ctx.createLinearGradient(lx, L.lamp.y, lx, H * 0.8);
      lg.addColorStop(0, `rgba(255,190,110,${.28 * flick})`); lg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(lx - 10 * k, L.lamp.y); ctx.lineTo(lx + 10 * k, L.lamp.y); ctx.lineTo(lx + 120 * k, H * 0.8); ctx.lineTo(lx - 80 * k, H * 0.8); ctx.fill();
      ctx.globalAlpha = flick; ctx.drawImage(glowWarm, lx - 40 * k, L.lamp.y - 34 * k, 80 * k, 80 * k); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // kid: long backlit shadow toward camera + figure
      const kd = L.kid, kx = kd.x + par * 20;
      const footY = H * 0.69;
      const sh = ctx.createLinearGradient(0, footY, 0, H);
      sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh; ctx.beginPath();
      ctx.moveTo(kx + kd.w * 0.36, footY - 2 * k); ctx.lineTo(kx + kd.w * 0.72, footY - 2 * k);
      ctx.lineTo(kx + kd.w * 0.95, H); ctx.lineTo(kx + kd.w * 0.05, H); ctx.fill();
      ctx.drawImage(kd.c, kx, kd.y, kd.w, kd.h);

      // dust motes (foreground bokeh)
      ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        if (!reduce) { m.x += (m.vx + Math.sin(T + m.p) * 3) * dt * k; m.y += m.vy * dt * k; if (m.y < HY * 0.45) { m.y = H * 0.95; m.x = Math.random() * W; } }
        ctx.globalAlpha = .25 + .25 * Math.sin(T * 2 + m.p);
        const sz = m.r * 3 * k; ctx.drawImage(glowTeal, m.x + par * 26 - sz, m.y - sz, sz * 2, sz * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // vignette
      const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      if (running && !single) raf = requestAnimationFrame(frame);
    }

    let parTarget = 0;
    function onMove(e) { const x = (e.touches ? e.touches[0].clientX : e.clientX); parTarget = ((x / innerWidth) - .5) * 1.6; }
    function onTilt(e) { if (e.gamma != null) parTarget = Math.max(-1, Math.min(1, e.gamma / 25)); }
    function onVis() { if (document.hidden) stop(); else if (wanted) start(); }
    let wanted = false;
    function start() { wanted = true; if (running || reduce) { if (reduce) frame(performance.now(), true); return; } running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('deviceorientation', onTilt, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (W) build(); });
    return {
      start, stop: () => { wanted = false; stop(); },
      destroy() { stop(); ro.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('deviceorientation', onTilt); document.removeEventListener('visibilitychange', onVis); }
    };
  }
  window.createTitleScene = createTitleScene;
})();
