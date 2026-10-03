/* =====================================================================
   Title scene - "from the neighbourhood court to the big stadium".
   Canvas-2D, layered + cached; only lights/particles animate per frame.
   createTitleScene(canvas, { reducedMotion, kidEl }) -> { pause, resume, destroy }
   ===================================================================== */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  function rng(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function sprite(size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
  }

  function createTitleScene(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const reduced = !!opts.reducedMotion;
    const R = rng(1948);
    let W = 0, H = 0, dpr = 1, HZ = 0;
    let L = {}; // cached layers
    const GLOW = sprite(128, [[0, 'rgba(255,240,200,1)'], [0.2, 'rgba(255,214,140,.6)'], [0.55, 'rgba(255,170,90,.15)'], [1, 'rgba(255,150,80,0)']]);
    const WGLOW = sprite(64, [[0, 'rgba(255,190,110,.9)'], [1, 'rgba(255,190,110,0)']]);
    let stars = [], windows = [], flashes = [], fireworks = [], motes = [];
    let px = 0, py = 0, tpx = 0, tpy = 0, t = 0;

    function layer(draw) { const c = document.createElement('canvas'); c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); const g = c.getContext('2d'); g.scale(dpr, dpr); draw(g); return c; }

    function layout() {
      const r = canvas.getBoundingClientRect();
      W = Math.round(r.width) || 390; H = Math.round(r.height) || 844;
      dpr = Math.min(global.devicePixelRatio || 1, opts.maxDpr || 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      HZ = Math.round(H * 0.6);
      build();
    }

    // stadium geometry (far)
    const st = () => ({ cx: W * 0.6, w: W * 0.62, top: HZ - 64 });

    function build() {
      stars = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * HZ * 0.62, r: R() * 1.1 + 0.3, ph: R() * TAU, sp: 0.6 + R() * 2 }));
      L.sky = layer((g) => {
        const gr = g.createLinearGradient(0, 0, 0, HZ);
        gr.addColorStop(0, '#070D26'); gr.addColorStop(0.38, '#16205A'); gr.addColorStop(0.62, '#3B2A6E');
        gr.addColorStop(0.8, '#B8445E'); gr.addColorStop(0.92, '#F2713A'); gr.addColorStop(1, '#FFB25A');
        g.fillStyle = gr; g.fillRect(0, 0, W, HZ + 2);
        // sun just below the horizon: warm dome
        g.globalAlpha = 0.9; g.drawImage(GLOW, W * 0.6 - 260, HZ - 170, 520, 340); g.globalAlpha = 1;
        // thin cloud streaks
        g.fillStyle = 'rgba(255,170,120,.16)';
        for (const [y, x, w] of [[HZ - 120, W * 0.05, W * 0.5], [HZ - 98, W * 0.45, W * 0.55], [HZ - 150, W * 0.55, W * 0.3]]) { g.beginPath(); g.roundRect(x, y, w, 3, 2); g.fill(); }
        // far city line
        g.fillStyle = '#2A1F4F';
        let x = 0; while (x < W) { const w = 8 + R() * 22, h = 6 + R() * 18; g.fillRect(x, HZ - h, w, h); x += w; }
        g.fillStyle = 'rgba(255,205,140,.8)';
        for (let i = 0; i < 60; i++) g.fillRect(R() * W, HZ - 4 - R() * 14, 1, 1);
      });
      L.stadium = layer((g) => {
        const { cx, w, top } = st();
        const x0 = cx - w / 2, x1 = cx + w / 2;
        // light dome above the bowl
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.55; g.drawImage(GLOW, cx - w * 0.75, top - 120, w * 1.5, 220);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        // bowl silhouette
        g.fillStyle = '#141A3F';
        g.beginPath(); g.moveTo(x0 - 10, HZ); g.lineTo(x0, top + 22); g.quadraticCurveTo(cx, top - 10, x1, top + 22); g.lineTo(x1 + 10, HZ); g.closePath(); g.fill();
        // roof rim, lit from inside
        g.strokeStyle = 'rgba(255,226,170,.85)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x0, top + 22); g.quadraticCurveTo(cx, top - 10, x1, top + 22); g.stroke();
        // facade ribs
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
        for (let i = 1; i < 18; i++) { const x = lerp(x0, x1, i / 18); g.beginPath(); g.moveTo(x, HZ); g.lineTo(x, top + 22 + Math.pow((x - cx) / (w / 2), 2) * -10 + 8); g.stroke(); }
        // concourse glow band
        const band = g.createLinearGradient(0, top + 30, 0, top + 44);
        band.addColorStop(0, 'rgba(255,190,110,0)'); band.addColorStop(.5, 'rgba(255,190,110,.55)'); band.addColorStop(1, 'rgba(255,190,110,0)');
        g.fillStyle = band; g.fillRect(x0 + 4, top + 30, w - 8, 14);
        // masts
        for (const mx of [x0 + 8, x0 + w * 0.3, x0 + w * 0.7, x1 - 8]) {
          const mt = top - 58 - (Math.abs(mx - cx) < w * 0.3 ? 8 : 0);
          g.fillStyle = '#0D1233'; g.beginPath(); g.moveTo(mx - 1.6, top + 26); g.lineTo(mx - 0.8, mt); g.lineTo(mx + 0.8, mt); g.lineTo(mx + 1.6, top + 26); g.fill();
          g.fillStyle = '#0D1233'; g.fillRect(mx - 9, mt - 7, 18, 9);
          g.fillStyle = '#FFF6DE'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.fillRect(mx - 7.5 + i * 4, mt - 5.5 + j * 3.6, 2.6, 2.4);
        }
      });
      L.blocks = layer(drawBlocks);
      L.court = layer(drawCourt);
      // window flicker candidates
      flashes = []; fireworks = [];
      motes = Array.from({ length: 26 }, () => ({ x: R(), y: R(), ph: R() * TAU, sp: 0.2 + R() * 0.4 }));
    }

    function drawBlock(g, x, w, top, shade, opt = {}) {
      g.fillStyle = shade; g.fillRect(x, top, w, HZ - top + 2);
      // balcony rails (shikun signature horizontal bands)
      const floors = Math.floor((HZ - top - 22) / 19);
      for (let f = 0; f < floors; f++) {
        const y = top + 12 + f * 19;
        for (let c = 0; c < opt.cols; c++) {
          const wx = x + 8 + c * ((w - 16) / opt.cols); const ww = (w - 16) / opt.cols - 7;
          const lit = R() < 0.42; const warm = R() < 0.7;
          g.fillStyle = lit ? (warm ? '#FFB35C' : '#9FD1FF') : '#1C2552';
          g.fillRect(wx, y, ww, 9);
          if (lit) { windows.push({ x: wx, y, w: ww, h: 9, warm, ph: R() * 100 }); }
          // shutter (trisim) half-down on some
          if (R() < 0.3) { g.fillStyle = shade; g.fillRect(wx, y, ww, 3 + R() * 4); }
        }
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 4, y + 11, w - 8, 2.2);
      }
      // pilotis
      g.fillStyle = '#060A1C'; g.fillRect(x + 6, HZ - 16, w - 12, 16);
      g.fillStyle = shade; for (let i = 0; i <= 4; i++) g.fillRect(x + 6 + i * ((w - 18) / 4), HZ - 16, 5, 16);
      // roof: solar water heaters + tanks
      if (opt.boilers) {
        for (let i = 0; i < opt.boilers; i++) {
          const bx = x + 10 + i * (w - 30) / Math.max(1, opt.boilers - 1);
          g.fillStyle = shade; g.beginPath(); g.roundRect(bx, top - 9, 16, 7, 3.5); g.fill();
          g.fillRect(bx + 3, top - 3, 2, 3); g.fillRect(bx + 11, top - 3, 2, 3);
          g.beginPath(); g.moveTo(bx + 18, top); g.lineTo(bx + 24, top - 13); g.lineTo(bx + 36, top - 13); g.lineTo(bx + 30, top); g.fill();
        }
      }
      if (opt.dish) { g.strokeStyle = shade; g.lineWidth = 2; g.beginPath(); g.arc(x + w - 14, top - 8, 6, Math.PI * 0.8, Math.PI * 1.8); g.stroke(); g.fillStyle = shade; g.fillRect(x + w - 15, top - 8, 2, 8); }
    }
    function drawBlocks(g) {
      windows = [];
      // left cluster
      drawBlock(g, -20, W * 0.3, HZ - 250, '#0E1538', { cols: 3, boilers: 2 });
      drawBlock(g, W * 0.16, W * 0.22, HZ - 150, '#0A1030', { cols: 2, boilers: 1, dish: true });
      // right cluster
      drawBlock(g, W * 0.84, W * 0.3, HZ - 290, '#0E1538', { cols: 2, boilers: 1 });
      // laundry line between left blocks
      g.strokeStyle = 'rgba(200,210,255,.35)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(W * 0.28, HZ - 200); g.quadraticCurveTo(W * 0.33, HZ - 186, W * 0.38, HZ - 138); g.stroke();
      // palm tree (right, in front of the block)
      const pxm = W * 0.9, base = HZ + 4;
      g.strokeStyle = '#070B20'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(pxm, base); g.quadraticCurveTo(pxm - 16, HZ - 90, pxm - 6, HZ - 170); g.stroke();
      g.fillStyle = '#070B20';
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i - 3.5) * 0.42; const len = 52 + (i % 2) * 10;
        const ex = pxm - 6 + Math.cos(a) * len, ey = HZ - 170 + Math.sin(a) * len * 0.55 + 20;
        g.beginPath(); g.moveTo(pxm - 6, HZ - 170);
        g.quadraticCurveTo(pxm - 6 + Math.cos(a) * len * 0.5, HZ - 175 + Math.sin(a) * len * 0.5 - 8, ex, ey);
        g.quadraticCurveTo(pxm - 6 + Math.cos(a) * len * 0.5, HZ - 168 + Math.sin(a) * len * 0.5, pxm - 6, HZ - 166); g.fill();
      }
    }
    function drawCourt(g) {
      // fence at the back of the court (chain-link)
      const fy = HZ - 40;
      g.strokeStyle = 'rgba(190,200,240,.13)'; g.lineWidth = 0.8;
      g.beginPath();
      for (let x = -60; x < W + 60; x += 9) { g.moveTo(x, HZ); g.lineTo(x + 40, fy); g.moveTo(x, fy); g.lineTo(x + 40, HZ); }
      g.stroke();
      g.fillStyle = '#0B112C';
      for (let x = 8; x < W; x += 64) g.fillRect(x, fy - 4, 3, 44);
      g.fillRect(0, fy - 4, W, 2.5);
      // asphalt ground
      const gr = g.createLinearGradient(0, HZ, 0, H);
      gr.addColorStop(0, '#2A2550'); gr.addColorStop(0.18, '#1A1F48'); gr.addColorStop(1, '#090E26');
      g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);
      // warm bounce light on the ground near the horizon
      g.globalAlpha = 0.35; g.drawImage(GLOW, W * 0.6 - 300, HZ - 60, 600, 160); g.globalAlpha = 1;
      // asphalt speckle
      for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.12)'; g.fillRect(R() * W, HZ + R() * (H - HZ), 1.2, 1.2); }
      // chalk court in perspective (vanishing point on the horizon)
      const vx = W * 0.5; const proj = (u, d) => { const k = d; return [vx + u * (0.25 + k * 1.25) * W, HZ + 6 + k * k * (H - HZ) * 1.0]; };
      const chalk = (pts, a = 0.5, w = 2) => {
        g.strokeStyle = `rgba(255,244,227,${a})`; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
        g.setLineDash([18, 4, 30, 3]); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
      };
      chalk([proj(-0.6, 0.06), proj(-0.6, 0.95)], 0.35, 2);
      chalk([proj(0.6, 0.06), proj(0.6, 0.95)], 0.35, 2);
      chalk([proj(-0.6, 0.06), proj(0.6, 0.06)], 0.3, 1.6);
      // centre circle
      const [ccx, ccy] = proj(0, 0.52);
      g.strokeStyle = 'rgba(255,244,227,.42)'; g.lineWidth = 2.4; g.setLineDash([26, 5, 40, 4]);
      g.beginPath(); g.ellipse(ccx, ccy, W * 0.36, 34, 0, 0, TAU); g.stroke(); g.setLineDash([]);
      chalk([proj(-0.62, 0.52), proj(0.62, 0.52)], 0.38, 2.2);
      // graffiti on the low wall: chalk crown + "10"
      g.save(); g.translate(W * 0.1, fy - 30); g.rotate(-0.08);
      g.strokeStyle = 'rgba(255,155,61,.55)'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 14); g.lineTo(4, 2); g.lineTo(10, 10); g.lineTo(16, 0); g.lineTo(22, 10); g.lineTo(28, 2); g.lineTo(32, 14); g.closePath(); g.stroke();
      g.restore();
      // mini goal (left, near the fence)
      const gx = W * 0.07, gy = HZ + 34, gw = 70, gh = 40;
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.7;
      g.beginPath(); for (let i = 1; i < 12; i++) { g.moveTo(gx + i * gw / 12, gy - gh); g.lineTo(gx + i * gw / 12 + 6, gy - gh + 10); g.lineTo(gx + i * gw / 12 + 6, gy + 6); } for (let j = 1; j < 6; j++) { g.moveTo(gx, gy - gh + j * gh / 6); g.lineTo(gx + gw, gy - gh + j * gh / 6); } g.stroke();
      g.strokeStyle = '#E9E4DA'; g.lineWidth = 3; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx, gy - gh); g.lineTo(gx + gw, gy - gh); g.lineTo(gx + gw, gy); g.stroke();
      // street lamp (right)
      const lx = W * 0.94, ly = H * 0.44;
      g.strokeStyle = '#05091C'; g.lineWidth = 5; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(lx, H * 0.86); g.lineTo(lx, ly + 10); g.quadraticCurveTo(lx, ly, lx - 14, ly); g.lineTo(lx - 30, ly); g.stroke();
      g.fillStyle = '#05091C'; g.beginPath(); g.roundRect(lx - 46, ly - 4, 22, 8, 3); g.fill();
    }

    // ---------- animated bits ----------
    function drawBeams() {
      const { cx, w, top } = st();
      const x0 = cx - w / 2, x1 = cx + w / 2;
      g2d.globalCompositeOperation = 'lighter';
      const masts = [x0 + 8, x0 + w * 0.3, x0 + w * 0.7, x1 - 8];
      masts.forEach((mx, i) => {
        const mt = top - 58 - (Math.abs(mx - cx) < w * 0.3 ? 8 : 0) - 3;
        const sway = reduced ? 0 : Math.sin(t * 0.35 + i * 1.7) * 0.12;
        const dir = (mx < cx ? -1 : 1) * (0.28 + (i % 2) * 0.1) + sway;
        const len = H * 0.55;
        const ex = mx + Math.sin(dir) * len, ey = mt - Math.cos(dir) * len;
        const gr = g2d.createLinearGradient(mx, mt, ex, ey);
        gr.addColorStop(0, 'rgba(255,236,190,.22)'); gr.addColorStop(1, 'rgba(255,236,190,0)');
        g2d.fillStyle = gr;
        const nx = Math.cos(dir), ny = Math.sin(dir);
        g2d.beginPath(); g2d.moveTo(mx - nx * 3, mt - ny * 3); g2d.lineTo(ex - nx * 46, ey - ny * 46); g2d.lineTo(ex + nx * 46, ey + ny * 46); g2d.lineTo(mx + nx * 3, mt + ny * 3); g2d.fill();
        const pul = 0.8 + Math.sin(t * 2 + i) * 0.08;
        g2d.globalAlpha = pul; g2d.drawImage(GLOW, mx - 30, mt - 30, 60, 60); g2d.globalAlpha = 1;
      });
      g2d.globalCompositeOperation = 'source-over';
    }
    let g2d = ctx;
    function frameDraw(dt) {
      const c = ctx; g2d = c;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      // parallax offsets per depth
      const ox = px, oy = py;
      c.drawImage(L.sky, -ox * 4 - 6, -oy * 3 - 4, W + 12, H + 8);
      // stars
      for (const s of stars) {
        const a = reduced ? 0.6 : 0.35 + 0.65 * Math.abs(Math.sin(t * s.sp + s.ph));
        c.fillStyle = `rgba(255,244,227,${a})`; c.fillRect(s.x - ox * 4, s.y - oy * 3, s.r, s.r);
      }
      // fireworks over the stadium (occasional)
      if (!reduced) {
        if (R() < dt * 0.35 && fireworks.length < 2) { const { cx, top } = st(); fireworks.push({ x: cx + (R() - .5) * 140, y: top - 70 - R() * 80, t: 0, n: 22, hue: R() < 0.5 ? '255,209,90' : '255,140,80' }); }
        c.globalCompositeOperation = 'lighter';
        for (let i = fireworks.length - 1; i >= 0; i--) {
          const f = fireworks[i]; f.t += dt; const k = f.t / 1.8; if (k > 1) { fireworks.splice(i, 1); continue; }
          const rr = 6 + Math.sqrt(k) * 38;
          for (let j = 0; j < f.n; j++) { const a = j * TAU / f.n; const x = f.x + Math.cos(a) * rr - ox * 3, y = f.y + Math.sin(a) * rr + k * k * 18 - oy * 2; c.fillStyle = `rgba(${f.hue},${(1 - k) * 0.9})`; c.fillRect(x, y, 1.6, 1.6); }
        }
        c.globalCompositeOperation = 'source-over';
      }
      c.save(); c.translate(-ox * 6, -oy * 2);
      drawBeams();
      c.drawImage(L.stadium, 0, 0, W, H);
      // camera flashes in the bowl
      if (!reduced) {
        const { cx, w, top } = st();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) if (R() < 0.18) { const fx = cx + (R() - .5) * w * 0.85, fy = top + 26 + R() * 30; c.globalAlpha = 0.9; c.drawImage(WGLOW, fx - 4, fy - 4, 8, 8); }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      c.restore();
      c.save(); c.translate(-ox * 10, -oy * 4);
      c.drawImage(L.blocks, 0, 0, W, H);
      // window flicker: a few windows breathe/blink
      for (let i = 0; i < windows.length; i += 3) {
        const w = windows[i]; const v = Math.sin(t * 0.7 + w.ph) > 0.93 ? 0 : 1;
        if (!v) { c.fillStyle = '#1C2552'; c.fillRect(w.x, w.y, w.w, w.h); }
        else if (!reduced && (i % 2 === 0)) { c.globalAlpha = 0.25 + 0.1 * Math.sin(t * 3 + w.ph); c.globalCompositeOperation = 'lighter'; c.drawImage(WGLOW, w.x - 6, w.y - 6, w.w + 12, w.h + 12); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
      }
      c.restore();
      c.save(); c.translate(-ox * 16, -oy * 6);
      c.drawImage(L.court, -10, 0, W + 20, H);
      // street lamp cone + glow
      const lx = W * 0.94 - 35, ly = H * 0.44 + 4;
      c.globalCompositeOperation = 'lighter';
      const cone = c.createLinearGradient(lx, ly, lx - 30, H * 0.86);
      cone.addColorStop(0, 'rgba(255,214,150,.26)'); cone.addColorStop(1, 'rgba(255,214,150,0)');
      c.fillStyle = cone; c.beginPath(); c.moveTo(lx - 8, ly); c.lineTo(lx - 120, H * 0.86); c.lineTo(lx + 60, H * 0.86); c.lineTo(lx + 8, ly); c.fill();
      c.globalAlpha = 0.9 + (reduced ? 0 : Math.sin(t * 17) * 0.04); c.drawImage(GLOW, lx - 34, ly - 30, 68, 60); c.globalAlpha = 1;
      // dust motes in the lamp light
      if (!reduced) for (const m of motes) {
        const mx = lx - 60 + (m.x * 150) + Math.sin(t * m.sp + m.ph) * 10, my = ly + 20 + ((m.y + t * 0.02 * m.sp) % 1) * (H * 0.36);
        c.fillStyle = `rgba(255,230,180,${0.25 + 0.3 * Math.abs(Math.sin(t + m.ph))})`; c.fillRect(mx, my, 1.4, 1.4);
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();
      // bottom legibility veil
      const veil = c.createLinearGradient(0, H * 0.66, 0, H);
      veil.addColorStop(0, 'rgba(7,12,34,0)'); veil.addColorStop(0.5, 'rgba(7,12,34,.72)'); veil.addColorStop(1, 'rgba(7,12,34,.96)');
      c.fillStyle = veil; c.fillRect(0, H * 0.66, W, H * 0.34);
      // kid (DOM image) parallax
      if (opts.kidEl) opts.kidEl.style.transform = `translate3d(${(-ox * 22).toFixed(2)}px, ${(-oy * 8).toFixed(2)}px, 0)`;
    }

    // parallax input: pointer / tilt + slow drift
    const onMove = (e) => { const p = e.touches ? e.touches[0] : e; tpx = (p.clientX / W - 0.5) * 2; tpy = (p.clientY / H - 0.5) * 2; };
    const onTilt = (e) => { if (e.gamma == null) return; tpx = Math.max(-1, Math.min(1, e.gamma / 25)); tpy = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); };
    if (!reduced) { global.addEventListener('pointermove', onMove, { passive: true }); global.addEventListener('deviceorientation', onTilt, { passive: true }); }

    let raf = 0, last = 0, running = false;
    function loop(ts) {
      if (!running) return; raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts; t += dt;
      const drift = reduced ? 0 : Math.sin(t * 0.25) * 0.25;
      px = lerp(px, (reduced ? 0 : tpx * 0.6) + drift, 1 - Math.exp(-dt * 3)); py = lerp(py, reduced ? 0 : tpy * 0.4, 1 - Math.exp(-dt * 3));
      frameDraw(dt);
    }
    function resume() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
    function pause() { running = false; cancelAnimationFrame(raf); }
    const onVis = () => (document.hidden ? pause() : resume());
    document.addEventListener('visibilitychange', onVis);
    const ro = global.ResizeObserver ? new ResizeObserver(() => layout()) : null;
    layout(); ro && ro.observe(canvas);
    resume();
    return {
      pause, resume,
      _advance(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { t += 1 / 60; px = lerp(px, Math.sin(t * 0.25) * 0.25, 0.05); } frameDraw(1 / 60); },
      destroy() { pause(); document.removeEventListener('visibilitychange', onVis); global.removeEventListener('pointermove', onMove); global.removeEventListener('deviceorientation', onTilt); ro && ro.disconnect(); },
    };
  }
  global.createTitleScene = createTitleScene;
})(window);
