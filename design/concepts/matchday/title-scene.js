/* =========================================================================
   Title hero — "the kid on the neighbourhood cage pitch, looking at the stadium"
   Canvas 2D. Static layers are pre-rendered once per resize; per frame we only
   composite them with parallax + draw light (beams, bloom, flashes, dust).
   API: const hero = createTitleScene(canvas); hero.pause(); hero.resume(); hero.destroy();
   ========================================================================= */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const rnd = mulberry(7);
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const lerp = (a, b, t) => a + (b - a) * t;

  function layer(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    return { c, g, w, h };
  }

  window.createTitleScene = function (canvas, opts = {}) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, L = {}, raf = 0, running = true, t0 = performance.now();
    const PAD = 24; // parallax bleed
    const par = { x: 0, y: 0, tx: 0, ty: 0 };
    const kitA = opts.shirt || '#FFD21F', kitB = opts.trim || '#0B3D91';
    let G = {}; // geometry

    function geo() {
      const hy = H * 0.44;               // horizon (stadium base)
      G = {
        hy,
        cx: W * 0.42,                      // stadium centre
        RX: W * 0.74, RY: H * 0.064,
        fenceTop: hy + H * 0.012, fenceBase: hy + H * 0.115,
        kidH: H * 0.215, kidX: W * 0.665, kidY: H * 0.672,
        lamp: { x: W * 0.96, y: hy - H * 0.06 },
      };
    }

    // ---------------------------------------------------------------- SKY
    function drawSky() {
      const l = layer(W + PAD * 2, H, dpr), g = l.g, { hy, cx } = G;
      const sky = g.createLinearGradient(0, 0, 0, hy + 40);
      sky.addColorStop(0, '#02040B'); sky.addColorStop(.45, '#071028'); sky.addColorStop(.8, '#132451'); sky.addColorStop(1, '#22386C');
      g.fillStyle = sky; g.fillRect(0, 0, l.w, hy + 60);
      // stadium light dome
      const dome = g.createRadialGradient(cx + PAD, hy - 10, 10, cx + PAD, hy - 10, W * 0.95);
      dome.addColorStop(0, 'rgba(210,235,255,.55)'); dome.addColorStop(.18, 'rgba(140,190,255,.26)'); dome.addColorStop(.45, 'rgba(70,120,220,.10)'); dome.addColorStop(1, 'rgba(40,80,180,0)');
      g.fillStyle = dome; g.fillRect(0, 0, l.w, hy + 60);
      // stars
      for (let i = 0; i < 90; i++) {
        const x = rnd() * l.w, y = rnd() * hy * 0.62, r = rnd() < .1 ? 1.1 : .6;
        g.fillStyle = `rgba(220,230,255,${.25 + rnd() * .5})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      // distant skyline (Azrieli-like trio + towers) far left, very faint
      g.fillStyle = 'rgba(30,48,92,.85)';
      const base = hy - 2, sx = PAD + W * 0.02;
      g.fillRect(sx, base - 70, 14, 70);                     // square tower
      g.beginPath(); g.arc(sx + 30, base - 76, 8, Math.PI, 0); g.rect(sx + 22, base - 76, 16, 76); g.fill(); // round tower
      g.beginPath(); g.moveTo(sx + 46, base); g.lineTo(sx + 46, base - 64); g.lineTo(sx + 60, base - 60); g.lineTo(sx + 60, base); g.fill(); // triangular
      for (let i = 0; i < 9; i++) { const x = sx + 70 + i * 13 + rnd() * 6, h = 14 + rnd() * 34; g.fillRect(x, base - h, 9 + rnd() * 6, h); }
      for (let i = 0; i < 6; i++) { const x = PAD + W * 0.82 + i * 15, h = 10 + rnd() * 26; g.fillRect(x, base - h, 11, h); }
      // window specks on skyline
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,${190 + rnd() * 50 | 0},120,${.25 + rnd() * .5})`; g.fillRect(sx + rnd() * 200, base - rnd() * 66, 1, 1); }
      return l;
    }

    // ---------------------------------------------------------------- STADIUM (glowing bowl in the valley)
    function drawStadium() {
      const l = layer(W + PAD * 2, H, dpr), g = l.g;
      const { hy, RX, RY } = G, cx = G.cx + PAD, cy = hy - RY * 0.15;
      // far stand interior (crowd band)
      g.save();
      g.beginPath(); g.ellipse(cx, cy, RX, RY, 0, Math.PI, 0); g.ellipse(cx, cy + RY * 0.42, RX * 0.6, RY * 0.5, 0, 0, Math.PI, true); g.closePath(); g.clip();
      const st = g.createLinearGradient(0, cy - RY, 0, cy + RY * .3);
      st.addColorStop(0, '#2B3E70'); st.addColorStop(1, '#6E86B8');
      g.fillStyle = st; g.fillRect(cx - RX, cy - RY, RX * 2, RY * 2);
      // tiers
      for (let k = 1; k < 6; k++) { g.strokeStyle = 'rgba(10,18,40,.35)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy + k * RY * .06, RX * (1 - k * .07), RY * (1 - k * .09), 0, Math.PI, 0); g.stroke(); }
      // crowd specks in club colours
      const cols = ['#FFD21F', '#FFD21F', '#2F6BFF', '#FFFFFF', '#FFE58A', '#0B3D91'];
      for (let i = 0; i < 1400; i++) {
        const a = Math.PI + rnd() * Math.PI, rr = .62 + rnd() * .38;
        const x = cx + Math.cos(a) * RX * rr, y = cy + RY * .42 * (1 - rr) / .38 * .0 + Math.sin(a) * RY * rr * .98 + (1 - rr) * RY * .3;
        g.fillStyle = cols[i % cols.length]; g.globalAlpha = .55 + rnd() * .45; g.fillRect(x, y, 1.3, 1.1);
      }
      g.globalAlpha = 1; g.restore();
      // pitch lens
      g.save();
      g.beginPath(); g.ellipse(cx, cy + RY * 0.42, RX * 0.6, RY * 0.5, 0, 0, TAU); g.clip();
      const pg = g.createLinearGradient(0, cy, 0, cy + RY);
      pg.addColorStop(0, '#5DF08F'); pg.addColorStop(1, '#14B652');
      g.fillStyle = pg; g.fillRect(cx - RX, cy - RY, RX * 2, RY * 3);
      for (let i = -12; i < 12; i += 2) { g.fillStyle = 'rgba(0,60,20,.13)'; g.beginPath(); const x = cx + i * RX * .06; g.moveTo(x, cy); g.lineTo(x + RX * .06, cy); g.lineTo(x + RX * .075, cy + RY); g.lineTo(x + RX * .012, cy + RY); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 1, cy + RY); g.stroke();
      g.beginPath(); g.ellipse(cx, cy + RY * .45, RX * .07, RY * .14, 0, 0, TAU); g.stroke();
      g.restore();
      // roof rim (far) – lit underside
      g.strokeStyle = 'rgba(235,245,255,.9)'; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(cx, cy, RX, RY, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
      // near facade (dark) – covers lower part of the bowl
      g.beginPath();
      g.ellipse(cx, cy, RX, RY, 0, Math.PI, 0, true);
      g.lineTo(cx + RX * 1.02, hy + 34); g.lineTo(cx - RX * 1.02, hy + 34); g.closePath();
      const fg = g.createLinearGradient(0, cy, 0, hy + 34);
      fg.addColorStop(0, '#16244A'); fg.addColorStop(1, '#070C1C');
      g.fillStyle = fg; g.fill();
      // near roof edge highlight (spill from inside)
      g.strokeStyle = 'rgba(190,220,255,.8)'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(cx, cy, RX, RY, 0, Math.PI * .04, Math.PI * .96); g.stroke();
      // facade ribs + concourse light band
      g.save(); g.beginPath(); g.ellipse(cx, cy, RX, RY, 0, Math.PI, 0, true); g.lineTo(cx + RX * 1.02, hy + 34); g.lineTo(cx - RX * 1.02, hy + 34); g.closePath(); g.clip();
      for (let i = -24; i <= 24; i++) {
        const a = Math.PI * (.5 + i / 52), x = cx + Math.cos(a) * RX;
        const yTop = cy + Math.sin(a) * RY;
        g.strokeStyle = 'rgba(120,160,230,.16)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, yTop); g.lineTo(x * 1 + (x - cx) * .02, hy + 34); g.stroke();
      }
      const bandY = cy + RY + 9;
      g.fillStyle = 'rgba(255,214,120,.0)';
      for (let i = 0; i < 160; i++) { const x = cx - RX + rnd() * RX * 2, y = bandY + rnd() * 3 + Math.abs(x - cx) / RX * -6; g.fillStyle = `rgba(255,${200 + rnd() * 40 | 0},140,${.35 + rnd() * .5})`; g.fillRect(x, y, 1.6, 1.2); }
      g.restore();
      // floodlight masts
      G.towers = [];
      for (const s of [-1, 1]) for (const k of [.62, .97]) {
        const a = Math.PI * (1.5 + s * .5 * k), x = cx + Math.cos(a) * RX * .98, y = cy + Math.sin(a) * RY * .98;
        const top = y - H * (k > .9 ? .085 : .105);
        g.strokeStyle = '#0A1226'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, top); g.stroke();
        g.lineWidth = .8; g.beginPath(); for (let j = 0; j < 6; j++) { const yy = lerp(y, top, j / 6), yy2 = lerp(y, top, (j + 1) / 6); g.moveTo(x - 2, yy); g.lineTo(x + 2, yy2); } g.stroke();
        // panel
        const pw = 16, ph = 8, px = x - pw / 2, py = top - ph;
        g.fillStyle = '#0E1834'; g.fillRect(px - 1, py - 1, pw + 2, ph + 2);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { g.fillStyle = '#FFFFFF'; g.fillRect(px + 1 + c * 3.8, py + 1 + r * 3.6, 2.8, 2.6); }
        G.towers.push({ x: x - PAD, y: py + ph / 2, dir: -s });
      }
      return l;
    }

    // ---------------------------------------------------------------- NEIGHBOURHOOD (shikun blocks + solar heaters)
    function drawCity() {
      const l = layer(W + PAD * 2, H, dpr), g = l.g, { hy } = G;
      const bodyCol = '#0A1124', topRim = 'rgba(140,175,240,.55)';
      function block(x, w, top, floors, opt = {}) {
        const base = hy + H * 0.08;
        const grd = g.createLinearGradient(0, top, 0, base);
        grd.addColorStop(0, opt.col || '#111B36'); grd.addColorStop(1, bodyCol);
        g.fillStyle = grd; g.fillRect(x, top, w, base - top);
        g.fillStyle = topRim; g.fillRect(x, top, w, 1.2);
        // side face (perspective) for depth
        if (opt.side) { g.fillStyle = '#070C1B'; g.beginPath(); g.moveTo(x + (opt.side > 0 ? w : 0), top); g.lineTo(x + (opt.side > 0 ? w + opt.side : -(-opt.side)), top + 6); g.lineTo(x + (opt.side > 0 ? w + opt.side : opt.side), base); g.lineTo(x + (opt.side > 0 ? w : 0), base); g.fill(); }
        const fh = (base - top - 8) / floors, cols = Math.floor(w / 14);
        for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
          const wx = x + 5 + c * (w - 10) / cols, wy = top + 7 + f * fh, ww = (w - 10) / cols - 5, wh = fh * .48;
          const r = rnd();
          if (r < .2) { g.fillStyle = `rgba(255,${170 + rnd() * 50 | 0},90,${.75 + rnd() * .25})`; }
          else if (r < .27) { g.fillStyle = 'rgba(120,170,255,.75)'; }
          else g.fillStyle = 'rgba(30,44,80,.9)';
          g.fillRect(wx, wy, ww, wh);
          // balcony rail
          g.fillStyle = 'rgba(8,13,28,.9)'; g.fillRect(wx - 2, wy + wh + 1, ww + 4, 2.2);
        }
        // rooftop solar water heaters (dud shemesh)
        const n = Math.max(1, Math.floor(w / 26));
        for (let i = 0; i < n; i++) {
          const sx = x + 6 + i * (w - 12) / n + rnd() * 4;
          g.fillStyle = '#0B1328';
          g.beginPath(); g.moveTo(sx, top); g.lineTo(sx + 12, top - 7); g.lineTo(sx + 14, top - 6); g.lineTo(sx + 4, top); g.fill();  // tilted panel
          g.fillRect(sx + 10, top - 13, 9, 5); g.beginPath(); g.arc(sx + 10, top - 10.5, 2.5, 0, TAU); g.arc(sx + 19, top - 10.5, 2.5, 0, TAU); g.fill(); // tank
          g.fillRect(sx + 13, top - 8, 1, 8);
          g.fillStyle = topRim; g.fillRect(sx + 9, top - 13.4, 10, .9);
        }
        // antenna
        g.strokeStyle = '#0B1328'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + w * .7, top); g.lineTo(x + w * .7, top - 18); g.moveTo(x + w * .7 - 5, top - 14); g.lineTo(x + w * .7 + 5, top - 14); g.moveTo(x + w * .7 - 3, top - 10); g.lineTo(x + w * .7 + 3, top - 10); g.stroke();
      }
      const P = PAD;
      block(P - 30, W * 0.30, hy - H * 0.035, 4, { side: 10 });
      block(P + W * 0.13, W * 0.16, hy - H * 0.005, 3, { col: '#0F1931' });
      block(P + W * 0.74, W * 0.36, hy - H * 0.055, 5, { side: -12 });
      // palms
      function palm(x, base, h) {
        g.strokeStyle = '#060A16'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + 4, base - h * .5, x + 2, base - h); g.stroke();
        g.fillStyle = '#060A16';
        for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .45; g.beginPath(); g.moveTo(x + 2, base - h); g.quadraticCurveTo(x + 2 + Math.cos(a) * 14, base - h + Math.sin(a) * 10 - 4, x + 2 + Math.cos(a) * 22, base - h + Math.sin(a) * 6 + 8); g.quadraticCurveTo(x + 2 + Math.cos(a) * 12, base - h + Math.sin(a) * 8, x + 2, base - h + 2); g.fill(); }
      }
      palm(P + W * 0.30, hy + H * 0.08, H * 0.12);
      palm(P + W * 0.70, hy + H * 0.08, H * 0.10);
      return l;
    }

    // ---------------------------------------------------------------- CAGE PITCH (fence, street goal, asphalt)
    function drawGround() {
      const l = layer(W + PAD * 2, H, dpr), g = l.g, { hy, fenceTop, fenceBase } = G, P = PAD;
      // asphalt
      const ag = g.createLinearGradient(0, fenceBase - 4, 0, H);
      ag.addColorStop(0, '#1B2645'); ag.addColorStop(.25, '#121A33'); ag.addColorStop(1, '#070A16');
      g.fillStyle = ag; g.fillRect(0, fenceBase - 2, l.w, H);
      // stadium glow reflected on wet asphalt
      const rg = g.createRadialGradient(G.cx + P, fenceBase + 10, 4, G.cx + P, fenceBase + 10, W * .7);
      rg.addColorStop(0, 'rgba(150,200,255,.22)'); rg.addColorStop(1, 'rgba(150,200,255,0)');
      g.fillStyle = rg; g.fillRect(0, fenceBase, l.w, H * .4);
      // grain / cracks
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * .035})`; g.fillRect(rnd() * l.w, fenceBase + rnd() * (H - fenceBase), 1, 1); }
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
      for (let i = 0; i < 6; i++) { let x = rnd() * l.w, y = fenceBase + 20 + rnd() * (H - fenceBase - 40); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - .5) * 30; y += rnd() * 14; g.lineTo(x, y); } g.stroke(); }
      // faded painted lines (perspective)
      g.strokeStyle = 'rgba(230,240,255,.20)'; g.lineWidth = 2.2;
      const vy = fenceBase - H * .2, vx = P + W * .45; // vanishing point
      g.beginPath(); g.moveTo(P - 40, fenceBase + 12); g.lineTo(P + W + 40, fenceBase + 10); g.stroke();
      g.beginPath(); g.ellipse(P + W * .42, fenceBase + H * .14, W * .42, H * .055, 0, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(P + W * .44, fenceBase + 12); g.lineTo(P + W * .38, H); g.stroke();
      // fence chain-link
      g.save();
      g.beginPath(); g.rect(0, fenceTop, l.w, fenceBase - fenceTop); g.clip();
      g.strokeStyle = 'rgba(170,195,235,.13)'; g.lineWidth = .7;
      const s = 7;
      for (let x = -200; x < l.w + 200; x += s) { g.beginPath(); g.moveTo(x, fenceTop); g.lineTo(x + (fenceBase - fenceTop), fenceBase); g.moveTo(x, fenceTop); g.lineTo(x - (fenceBase - fenceTop), fenceBase); g.stroke(); }
      g.restore();
      g.fillStyle = '#060A16';
      for (let x = P - 10; x < P + W + 30; x += W * .22) { g.fillRect(x, fenceTop - 6, 3, fenceBase - fenceTop + 8); g.fillStyle = 'rgba(160,190,240,.35)'; g.fillRect(x, fenceTop - 6, 1, fenceBase - fenceTop + 8); g.fillStyle = '#060A16'; }
      g.fillRect(0, fenceTop - 6, l.w, 2.4);
      g.fillStyle = 'rgba(160,190,240,.4)'; g.fillRect(0, fenceTop - 6, l.w, .8);
      // street goal (left)
      const gx = P + W * .02, gw = W * .30, gb = fenceBase + 6, gh = H * .075;
      g.strokeStyle = 'rgba(220,230,250,.18)'; g.lineWidth = .7;
      for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(gx + 6 + i * (gw - 12) / 12, gb - gh + 6); g.lineTo(gx + 10 + i * (gw - 20) / 12, gb - 6); g.stroke(); }
      for (let i = 0; i <= 5; i++) { g.beginPath(); g.moveTo(gx + 6, gb - gh + 6 + i * (gh - 12) / 5); g.lineTo(gx + gw - 6, gb - gh + 6 + i * (gh - 12) / 5); g.stroke(); }
      g.strokeStyle = '#C9D3E6'; g.lineWidth = 3; g.lineCap = 'square';
      g.beginPath(); g.moveTo(gx, gb); g.lineTo(gx, gb - gh); g.lineTo(gx + gw, gb - gh); g.lineTo(gx + gw, gb); g.stroke();
      g.strokeStyle = 'rgba(10,16,34,.55)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(gx + 1.5, gb); g.lineTo(gx + 1.5, gb - gh + 1.5); g.lineTo(gx + gw - 1.5, gb - gh + 1.5); g.stroke();
      // graffiti on wall strip under fence: club colours tag
      g.save(); g.translate(P + W * .54, fenceBase - 10); g.rotate(-.04);
      g.fillStyle = 'rgba(255,210,31,.55)'; g.font = `900 ${Math.round(H * .021)}px Rubik, sans-serif`; g.direction = 'rtl'; g.textAlign = 'center';
      g.fillText('מכבי 10', 0, 0); g.restore();
      // street lamp (right edge)
      const lx = P + W * .965;
      g.fillStyle = '#060A16'; g.fillRect(lx, G.lamp.y, 3.5, H * .3);
      g.beginPath(); g.moveTo(lx + 1.5, G.lamp.y); g.quadraticCurveTo(lx - 2, G.lamp.y - 14, lx - 18, G.lamp.y - 12); g.lineWidth = 3; g.strokeStyle = '#060A16'; g.stroke();
      g.fillStyle = '#FFE7B0'; g.beginPath(); g.ellipse(lx - 20, G.lamp.y - 9, 6, 2.4, 0, 0, TAU); g.fill();
      return l;
    }

    // ---------------------------------------------------------------- THE KID (back view, foot on the ball)
    function kidShapes(g, u, paint) {
      // u: px per unit (100 units = kid height). Origin = feet centre on ground.
      const P = (x, y) => [x * u, y * u];
      const poly = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fillStyle = paint(fill); g.fill(); };
      const curve = (fn, fill) => { g.beginPath(); fn(P); g.fillStyle = paint(fill); g.fill(); };
      const skin = '#B9784A', skinD = '#93573A', sock = '#F2F2F2', boot = '#101317', shorts = kitB;
      // standing (left) leg
      poly([[-8.6, -38], [-2.2, -38], [-2.6, -25], [-3, -20], [-3.2, -6], [-6.4, -6], [-7.1, -20], [-8.2, -26]], skin);
      poly([[-7.3, -21.5], [-2.9, -21.5], [-3.1, -5], [-6.5, -5]], sock);
      poly([[-7.3, -19.5], [-2.95, -19.5], [-2.95, -18.3], [-7.35, -18.3]], kitB);
      curve(P => { const [a, b] = P(-7.8, -5.5); const [c, d] = P(-2, 0); g.moveTo(a, b); g.lineTo(...P(-2.4, -5.5)); g.quadraticCurveTo(...P(-1.4, -2), c, d); g.lineTo(...P(-8.6, 0)); g.quadraticCurveTo(...P(-8.6, -3), a, b); }, boot);
      // raised (right) leg: knee bent, sole resting on the ball
      poly([[2.2, -38], [8.8, -38], [9.6, -27], [10.4, -23], [11.8, -17.6], [8.6, -16.6], [6.6, -22.5], [3.4, -27]], skin);
      poly([[6.9, -22.6], [10.6, -23.8], [12, -17.4], [8.7, -16.4]], sock);
      curve(P => { g.moveTo(...P(7.6, -17.4)); g.lineTo(...P(12.6, -18.2)); g.quadraticCurveTo(...P(14.2, -15.5), ...P(12.8, -14.4)); g.lineTo(...P(7.2, -14.2)); g.quadraticCurveTo(...P(6.6, -16), ...P(7.6, -17.4)); }, boot);
      // shorts
      poly([[-9.6, -52], [9.6, -52], [10.6, -37.6], [1.2, -37.6], [0, -41], [-1.2, -37.6], [-10.6, -37.6]], shorts);
      // arms (hang slightly away from body, relaxed)
      poly([[-12.2, -66], [-9.6, -65.5], [-10.6, -55], [-11.4, -48.6], [-13.8, -48.8], [-14, -56], [-14.8, -64.5]], skin);
      poly([[12.2, -66], [9.6, -65.5], [10.6, -55], [11.4, -48.6], [13.8, -48.8], [14, -56], [14.8, -64.5]], skin);
      curve(P => { const [x, y] = P(-12.6, -47.6); g.ellipse(x, y, 1.6 * u, 2 * u, 0, 0, TAU); }, skin);
      curve(P => { const [x, y] = P(12.6, -47.6); g.ellipse(x, y, 1.6 * u, 2 * u, 0, 0, TAU); }, skin);
      // shirt
      curve(P => {
        g.moveTo(...P(-3.2, -81.4)); g.quadraticCurveTo(...P(-9.4, -81), ...P(-11.6, -78));
        g.lineTo(...P(-15.4, -65.2)); g.lineTo(...P(-10.2, -63.4)); g.lineTo(...P(-9.6, -50.4));
        g.quadraticCurveTo(...P(0, -49), ...P(9.6, -50.4)); g.lineTo(...P(10.2, -63.4)); g.lineTo(...P(15.4, -65.2));
        g.lineTo(...P(11.6, -78)); g.quadraticCurveTo(...P(9.4, -81), ...P(3.2, -81.4)); g.closePath();
      }, kitA);
      // sleeve trims + collar
      poly([[-15.4, -65.2], [-10.2, -63.4], [-10.15, -64.6], [-15.1, -66.5]], kitB);
      poly([[15.4, -65.2], [10.2, -63.4], [10.15, -64.6], [15.1, -66.5]], kitB);
      curve(P => { g.moveTo(...P(-3.4, -81.4)); g.quadraticCurveTo(...P(0, -79.4), ...P(3.4, -81.4)); g.lineTo(...P(3.4, -80.2)); g.quadraticCurveTo(...P(0, -78.2), ...P(-3.4, -80.2)); }, kitB);
      // neck + head
      poly([[-2.6, -84], [2.6, -84], [2.9, -80.6], [-2.9, -80.6]], skinD);
      curve(P => { const [x, y] = P(0, -89); g.ellipse(x, y, 6.1 * u, 7.1 * u, 0, 0, TAU); }, skin);
      curve(P => { const [x, y] = P(-6, -88.6); g.ellipse(x, y, 1.2 * u, 2.1 * u, 0, 0, TAU); }, skin);
      curve(P => { const [x, y] = P(6, -88.6); g.ellipse(x, y, 1.2 * u, 2.1 * u, 0, 0, TAU); }, skin);
      // hair (short fade, back view)
      curve(P => { g.moveTo(...P(-6.2, -88)); g.quadraticCurveTo(...P(-6.6, -96.4), ...P(0, -96.6)); g.quadraticCurveTo(...P(6.6, -96.4), ...P(6.2, -88)); g.quadraticCurveTo(...P(3, -85.4), ...P(0, -85.2)); g.quadraticCurveTo(...P(-3, -85.4), ...P(-6.2, -88)); }, '#1E130C');
      // number + name on the back
      if (paint('x') !== '#fff') {
        g.save(); g.fillStyle = paint(kitB); g.textAlign = 'center'; g.direction = 'rtl';
        g.font = `900 ${10.5 * u}px Rubik, sans-serif`; g.fillText('10', 0, -57.5 * u);
        g.font = `800 ${2.6 * u}px Rubik, sans-serif`; g.fillText('אזולאי', 0, -72.4 * u);
        g.restore();
      }
    }
    function drawBall(g, x, y, r, dark) {
      g.save(); g.translate(x, y);
      g.fillStyle = dark ? '#fff' : '#E8EDF6'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      if (!dark) {
        g.save(); g.clip();
        g.fillStyle = '#1A2238';
        const pent = (cx, cy, rr, rot) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
        pent(-r * .1, -r * .05, r * .36, -.3);
        for (let i = 0; i < 5; i++) { const a = -.3 + i * TAU / 5 + Math.PI / 5; pent(Math.cos(a) * r * .95 - r * .1, Math.sin(a) * r * .95, r * .32, a); }
        g.restore();
      }
      g.restore();
    }
    function drawKid() {
      const kh = G.kidH, u = kh / 100, w = kh * .5, h = kh * 1.08, pad = 8;
      const l = layer(w + pad * 2, h + pad * 2, dpr), g = l.g;
      const ox = l.w / 2, oy = l.h - pad - kh * .02;
      const bx = 13.6 * u, by = -6.9 * u, br = 6.9 * u;
      // colour pass
      g.save(); g.translate(ox, oy);
      drawBall(g, bx, by, br, false);
      kidShapes(g, u, c => c);
      g.restore();
      // mask pass (used for shading + rim light)
      const m = layer(l.w, l.h, dpr), mg = m.g;
      mg.save(); mg.translate(ox, oy); drawBall(mg, bx, by, br, true); kidShapes(mg, u, () => '#fff'); mg.restore();
      // 1) backlit: darken everything (light is in front of him, we see his shaded back)
      g.globalCompositeOperation = 'source-atop';
      const sh = g.createLinearGradient(0, 0, 0, l.h);
      sh.addColorStop(0, 'rgba(8,14,34,.42)'); sh.addColorStop(.6, 'rgba(6,10,26,.62)'); sh.addColorStop(1, 'rgba(4,6,16,.8)');
      g.fillStyle = sh; g.fillRect(0, 0, l.w, l.h);
      // warm street-lamp fill from the right
      const wl = g.createLinearGradient(l.w, 0, l.w * .35, 0);
      wl.addColorStop(0, 'rgba(255,170,80,.30)'); wl.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = wl; g.fillRect(0, 0, l.w, l.h);
      g.globalCompositeOperation = 'source-over';
      // 2) rim light: mask minus offset mask
      const rim = (dx, dy, col) => {
        const r = layer(l.w, l.h, dpr), rg = r.g;
        rg.drawImage(m.c, 0, 0, l.w, l.h);
        rg.globalCompositeOperation = 'source-in'; rg.fillStyle = col; rg.fillRect(0, 0, l.w, l.h);
        rg.globalCompositeOperation = 'destination-out'; rg.drawImage(m.c, dx, dy, l.w, l.h);
        g.drawImage(r.c, 0, 0, l.w, l.h);
      };
      rim(1.6, 1.4, 'rgba(225,238,255,.95)');   // cool stadium rim (top-left)
      rim(-1.3, .9, 'rgba(255,186,110,.75)');   // warm lamp rim (right)
      return { ...l, ox, oy };
    }

    // ---------------------------------------------------------------- per-frame
    const dust = Array.from({ length: 34 }, () => ({ x: rnd(), y: rnd(), s: .4 + rnd() * 1.1, v: .2 + rnd() * .6, p: rnd() * TAU }));
    const flares = [{ a: Math.PI * 1.22 }, { a: Math.PI * 1.36 }, { a: Math.PI * 1.7 }];
    const smoke = Array.from({ length: 24 }, (_, i) => ({ f: i % 3, life: Math.random() * 3, max: 2.6 + Math.random() * 1.4, dx: (Math.random() - .5) * 8 }));
    const flashes = Array.from({ length: 26 }, () => ({ a: Math.PI + rnd() * Math.PI, r: .66 + rnd() * .3, t: rnd() * 4 }));

    function frame(now) {
      raf = running ? requestAnimationFrame(frame) : 0;
      const t = (now - t0) / 1000;
      // parallax target: pointer/tilt + slow drift
      const dx = reduce ? 0 : par.tx + Math.sin(t * .13) * .35, dy = reduce ? 0 : par.ty + Math.cos(t * .11) * .2;
      par.x = lerp(par.x, dx, .05); par.y = lerp(par.y, dy, .05);
      const off = k => [-PAD + par.x * PAD * k, par.y * 6 * k];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      let [ox, oy] = off(.15);
      ctx.drawImage(L.sky.c, ox, oy, L.sky.w, L.sky.h);
      // "goal roar" in the distant stadium every ~9s: glow surges
      const roarT = (t % 9.5), roar = reduce ? 0 : Math.max(0, 1 - Math.abs(roarT - 1.2) / 1.2) ** 2;
      // searchlight beams
      [ox, oy] = off(.3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const tw = G.towers || [];
      tw.forEach((tw, i) => {
        const x = tw.x + PAD + ox, y = tw.y + oy;
        const base = -Math.PI / 2 + tw.dir * (.32 + .1 * i % 2), sw = reduce ? 0 : Math.sin(t * .35 + i * 1.7) * .22;
        const a = base + sw, len = H * .55, spread = .07;
        const grd = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
        grd.addColorStop(0, `rgba(200,225,255,${.18 + roar * .1})`); grd.addColorStop(1, 'rgba(200,225,255,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a - spread) * len, y + Math.sin(a - spread) * len);
        ctx.lineTo(x + Math.cos(a + spread) * len, y + Math.sin(a + spread) * len); ctx.closePath(); ctx.fill();
      });
      ctx.restore();
      ctx.drawImage(L.stadium.c, ox, oy, L.stadium.w, L.stadium.h);
      // floodlight bloom + crowd camera flashes
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      tw.forEach((tw, i) => {
        const x = tw.x + PAD + ox, y = tw.y + oy, fl = .85 + .15 * Math.sin(t * 7 + i * 3) * (reduce ? 0 : .3);
        const b = ctx.createRadialGradient(x, y, 0, x, y, 34 + roar * 10);
        b.addColorStop(0, `rgba(255,255,255,${.95 * fl})`); b.addColorStop(.12, `rgba(210,232,255,${.55 * fl})`); b.addColorStop(1, 'rgba(120,170,255,0)');
        ctx.fillStyle = b; ctx.fillRect(x - 50, y - 50, 100, 100);
        // lens streak
        ctx.fillStyle = `rgba(200,225,255,${.18 * fl})`; ctx.fillRect(x - 36, y - .6, 72, 1.2);
      });
      const cx = G.cx + PAD + ox, cy = G.hy - G.RY * .15 + oy;
      if (roar > 0.01) { const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, G.RX); rg.addColorStop(0, `rgba(190,255,200,${roar * .22})`); rg.addColorStop(1, 'rgba(190,255,200,0)'); ctx.fillStyle = rg; ctx.fillRect(cx - G.RX, cy - G.RX, G.RX * 2, G.RX * 2); }
      if (!reduce) flashes.forEach(f => {
        const ph = (t * (1 + roar * 3) + f.t) % 4;
        if (ph < .12) { const x = cx + Math.cos(f.a) * G.RX * f.r, y = cy + Math.sin(f.a) * G.RY * f.r; ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(x - 1, y - 1, 2.2, 2.2); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - 4, y - .5, 8, 1); }
      });
      // red flares burning in the far stand + drifting smoke (Israeli derby night)
      flares.forEach((f, i) => {
        const x = cx + Math.cos(f.a) * G.RX * .8, y = cy + Math.sin(f.a) * G.RY * .8;
        const fl = reduce ? .8 : .7 + .3 * Math.sin(t * 13 + i * 2.1) * Math.sin(t * 7.3 + i);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 16 + roar * 6);
        gr.addColorStop(0, `rgba(255,235,220,${.95 * fl})`); gr.addColorStop(.15, `rgba(255,70,60,${.7 * fl})`); gr.addColorStop(1, 'rgba(255,40,40,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 24, y - 24, 48, 48);
      });
      ctx.restore();
      if (!reduce) {
        smoke.forEach(s => {
          s.life += 1 / 60; if (s.life > s.max) { s.life = 0; s.f = (Math.random() * flares.length) | 0; s.dx = (Math.random() - .5) * 8; }
          const f = flares[s.f], k = s.life / s.max;
          const x = cx + Math.cos(f.a) * G.RX * .8 + s.dx * k * 3 + k * 14, y = cy + Math.sin(f.a) * G.RY * .8 - k * 46;
          ctx.fillStyle = `rgba(255,${120 + k * 90 | 0},${130 + k * 90 | 0},${(1 - k) * .16})`;
          ctx.beginPath(); ctx.arc(x, y, 4 + k * 14, 0, TAU); ctx.fill();
        });
      }
      [ox, oy] = off(.5); ctx.drawImage(L.city.c, ox, oy, L.city.w, L.city.h);
      // low haze bank drifting
      const hz = ctx.createLinearGradient(0, G.hy - 30, 0, G.hy + 70);
      hz.addColorStop(0, 'rgba(120,160,230,0)'); hz.addColorStop(.5, `rgba(120,160,230,${.10 + roar * .05})`); hz.addColorStop(1, 'rgba(120,160,230,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, G.hy - 30, W, 100);
      [ox, oy] = off(.8); ctx.drawImage(L.ground.c, ox, oy, L.ground.w, L.ground.h);
      // lamp light cone + dust motes
      const lx = G.lamp.x + PAD * 0 + ox + PAD - 20 + 0, ly = G.lamp.y - 9 + oy;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cone = ctx.createRadialGradient(lx, ly, 2, lx, ly + H * .25, H * .32);
      cone.addColorStop(0, 'rgba(255,200,120,.30)'); cone.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(lx - 4, ly); ctx.lineTo(lx - W * .55, ly + H * .36); ctx.lineTo(lx + W * .1, ly + H * .36); ctx.closePath(); ctx.fill();
      const b2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22); b2.addColorStop(0, 'rgba(255,235,190,.9)'); b2.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = b2; ctx.fillRect(lx - 22, ly - 22, 44, 44);
      dust.forEach(d => {
        const yy = ((d.y - t * d.v * .02) % 1 + 1) % 1, xx = d.x + Math.sin(t * .5 + d.p) * .02;
        const x = lx - W * .45 + xx * W * .5, y = ly + 10 + yy * H * .3;
        ctx.fillStyle = `rgba(255,220,160,${.25 + .35 * Math.sin(t + d.p) ** 2})`; ctx.beginPath(); ctx.arc(x, y, d.s, 0, TAU); ctx.fill();
      });
      ctx.restore();
      // kid + long shadow toward the camera
      [ox, oy] = off(1.1);
      const K = L.kid, kx = G.kidX + ox + PAD, ky = G.kidY + oy;
      ctx.save(); ctx.translate(kx, ky); ctx.transform(1, 0, -.25, 1, 0, 0);
      const shd = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); shd.addColorStop(0, 'rgba(0,0,0,.55)'); shd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.scale(G.kidH * .2, G.kidH * .5); ctx.fillStyle = shd; ctx.beginPath(); ctx.arc(0, .55, 1, 0, TAU); ctx.fill();
      ctx.restore();
      const br = reduce ? 0 : Math.sin(t * 1.6) * .004;
      ctx.save(); ctx.translate(kx, ky); ctx.scale(1, 1 + br);
      ctx.drawImage(K.c, -K.ox, -K.oy, K.w, K.h);
      ctx.restore();
      // bottom fade for UI legibility + vignette
      const bf = ctx.createLinearGradient(0, H * .6, 0, H);
      bf.addColorStop(0, 'rgba(4,6,13,0)'); bf.addColorStop(.45, 'rgba(4,6,13,.72)'); bf.addColorStop(1, 'rgba(4,6,13,.96)');
      ctx.fillStyle = bf; ctx.fillRect(0, H * .6, W, H * .4);
      const vg = ctx.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .45, H * .75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    function build() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      geo();
      L.sky = drawSky(); L.stadium = drawStadium(); L.city = drawCity(); L.ground = drawGround(); L.kid = drawKid();
    }
    const onMove = e => { const p = e.touches ? e.touches[0] : e; par.tx = (p.clientX / innerWidth - .5) * 2; par.ty = (p.clientY / innerHeight - .5) * 2; };
    const onTilt = e => { if (e.gamma == null) return; par.tx = Math.max(-1, Math.min(1, e.gamma / 25)); par.ty = Math.max(-1, Math.min(1, (e.beta - 40) / 30)); };
    const onVis = () => { if (document.hidden) api.pause(); else api.resume(); };
    const ro = new ResizeObserver(() => build());
    const api = {
      pause() { running = false; cancelAnimationFrame(raf); raf = 0; },
      resume() { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
      destroy() { api.pause(); ro.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('deviceorientation', onTilt); document.removeEventListener('visibilitychange', onVis); },
    };
    build(); ro.observe(canvas);
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('deviceorientation', onTilt, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    // redraw kid once web fonts land (number/name on shirt)
    if (document.fonts) document.fonts.ready.then(() => { L.kid = drawKid(); L.ground = drawGround(); });
    raf = requestAnimationFrame(frame);
    return api;
  };
})();
