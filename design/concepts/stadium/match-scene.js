/* =========================================================
   Live match scene - "Night Stadium Premium"
   Behind-the-goal broadcast camera (3/4, elevated), floodlit pitch,
   22 players in shape, scripted attacks, goal net ripple,
   home end with fans / flags / tifo / flares / phone lights,
   coach on the touchline with Hebrew speech bubbles.

   const scene = createMatchScene(canvas, {home, away, chant, hero, seed})
   scene.play(eventType, outcome)   eventType: 'dribble_shot' | 'cross' | 'cutback' | 'shot'
                                    outcome:   'goal' | 'save' | 'miss'
   scene.setScore(h, a)  scene.say(textHe, mood)  scene.on(evt, fn)
   scene.pause()  scene.resume()  scene.destroy()
   events: 'outcome' (o, info) · 'goal' ({auto}) · 'chance' · 'beat'
   ========================================================= */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function off(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function sprite(r, stops) {
    const c = off(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
  }
  function capsule(g, x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || .001, a = Math.atan2(dy, dx);
    const phi = Math.acos(clamp((r1 - r2) / d, -1, 1));
    g.beginPath(); g.moveTo(x1 + r1 * Math.cos(a + phi), y1 + r1 * Math.sin(a + phi));
    g.arc(x2, y2, r2, a + phi, a - phi, true); g.arc(x1, y1, r1, a - phi, a + phi, true); g.closePath(); g.fill();
  }

  const SPR = {
    flood: sprite(64, [[0, 'rgba(255,255,255,1)'], [.12, 'rgba(225,255,252,.9)'], [.35, 'rgba(120,240,230,.28)'], [1, 'rgba(47,227,207,0)']]),
    flare: sprite(48, [[0, 'rgba(255,240,240,1)'], [.15, 'rgba(255,90,110,.95)'], [.45, 'rgba(255,40,80,.3)'], [1, 'rgba(255,30,60,0)']]),
    smoke: sprite(48, [[0, 'rgba(235,215,225,.55)'], [.6, 'rgba(210,190,205,.22)'], [1, 'rgba(200,180,200,0)']]),
    phone: sprite(16, [[0, 'rgba(255,255,255,1)'], [.3, 'rgba(230,250,255,.6)'], [1, 'rgba(200,240,255,0)']]),
    pool: sprite(96, [[0, 'rgba(220,255,250,.5)'], [.5, 'rgba(160,240,230,.16)'], [1, 'rgba(120,230,220,0)']])
  };

  function createMatchScene(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d', { alpha: false });
    const wrap = canvas.parentElement;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const R = rng(opts.seed || 7);
    const home = Object.assign({ name: 'מכבי', shirt: '#FFD21F', shorts: '#1546C9', socks: '#FFD21F', trim: '#1546C9', gk: '#22C55E', fans: ['#FFD21F', '#1546C9', '#FFFFFF'] }, opts.home || {});
    const away = Object.assign({ name: 'בית״ר', shirt: '#17181C', shorts: '#17181C', socks: '#FFD21F', trim: '#FFD21F', gk: '#FF7A1A', fans: ['#17181C', '#FFD21F'] }, opts.away || {});
    const chantText = opts.chant || 'יאללה יאללה מכבי!';
    const heroName = opts.hero || 'אזולאי';
    const L = {};
    (function () { const s = (window.location && location.search) || ''; L.noAuto = /noauto/.test(s); })();
    const listeners = {};
    const emit = (e, a, b) => (listeners[e] || []).forEach(f => { try { f(a, b); } catch (err) { console.error(err); } });

    let W = 0, H = 0, dpr = 1, F = 700, HC = 26, HY = 0, quality = 1;
    let raf = 0, running = false, paused = false, last = 0, T = 0, timeScale = 1, slowT = 0;
    const cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1, px: 0, py: 0, shake: 0 };
    let cutA = 0, cutPhase = 0, cutFn = null;
    let crowdJump = 0, crowdHype = .25, flareBoost = 0, score = [0, 0];

    /* ---------------- projection ---------------- */
    function P(x, y, h) {
      const z = y - cam.y; if (z < 1.5) return null;
      const s = F / z; return { x: W / 2 + (x - cam.x) * s, y: HY + (HC - (h || 0)) * s, s };
    }

    /* ---------------- teams ---------------- */
    const SKIN = ['#E9B48A', '#D49A6A', '#B97A4E', '#8E5A36', '#6B4226', '#F1C7A0'];
    const HAIR = ['#120C08', '#2A1A10', '#3B2614', '#0B0B0B', '#5A3A1E'];
    const players = [];
    function mk(team, role, num, bx, by, extra) {
      const p = Object.assign({ team, role, num, bx, by, x: bx, y: by, vx: 0, vy: 0, tx: bx, ty: by, phase: R() * TAU, force: null, sprint: false,
        pose: null, poseT: 0, poseDur: 0, poseDir: 1, skin: SKIN[(R() * SKIN.length) | 0], hair: HAIR[(R() * HAIR.length) | 0], gk: role === 'GK' }, extra || {});
      players.push(p); return p;
    }
    const Hm = {
      GK: mk('H', 'GK', 1, 0, 6), RB: mk('H', 'RB', 2, 25, 50), RCB: mk('H', 'CB', 4, 9, 44), LCB: mk('H', 'CB', 5, -9, 44), LB: mk('H', 'LB', 3, -25, 50),
      RCM: mk('H', 'CM', 8, 13, 63), DM: mk('H', 'DM', 6, 0, 57), LCM: mk('H', 'CM', 10, -13, 63),
      RW: mk('H', 'RW', 9, 24, 80, { hero: true }), ST: mk('H', 'ST', 11, 3, 86), LW: mk('H', 'LW', 7, -24, 80)
    };
    const Aw = {
      GK: mk('A', 'GK', 1, 0, 103.6),
      D1: mk('A', 'D', 2, -20, 91), D2: mk('A', 'D', 4, -7, 94), D3: mk('A', 'D', 5, 7, 94), D4: mk('A', 'D', 3, 20, 91),
      M1: mk('A', 'M', 7, -22, 80), M2: mk('A', 'M', 6, -8, 82), M3: mk('A', 'M', 8, 8, 82), M4: mk('A', 'M', 11, 22, 80),
      F1: mk('A', 'F', 9, -5, 62), F2: mk('A', 'F', 10, 6, 60)
    };
    const hero = Hm.RW;
    const ball = { x: 0, y: 57, h: 0, owner: Hm.DM, fl: null, trail: [] };
    let net = null; // ripple

    function shapeTargets(dt) {
      const bx = ball.x, by = ball.y;
      const push = clamp((by - 68) * .55, -10, 14);
      const lastDef = Math.max(...[Aw.D1, Aw.D2, Aw.D3, Aw.D4].map(p => p.y)) ;
      for (const k in Hm) {
        const p = Hm[k]; if (p.force) { p.tx = p.force.x; p.ty = p.force.y; continue; }
        if (p.gk) { p.tx = clamp(bx * .08, -3, 3); p.ty = 8 + clamp((by - 60) * .25, 0, 9); continue; }
        p.tx = p.bx + bx * .22; p.ty = p.by + push + Math.sin(T * .5 + p.num) * 1.2;
        if (p.role === 'ST' || p.role === 'RW' || p.role === 'LW') p.ty = Math.min(p.ty, lastDef - .4);
      }
      const dl = clamp(by + 13, 86, 98.5);
      let presser = null, best = 1e9;
      if (ball.owner && ball.owner.team === 'H') for (const k in Aw) { const p = Aw[k]; if (p.gk || p.force) continue; const d = Math.hypot(p.x - ball.x, p.y - ball.y); if (d < best) { best = d; presser = p; } }
      for (const k in Aw) {
        const p = Aw[k]; if (p.force) { p.tx = p.force.x; p.ty = p.force.y; continue; }
        if (p.gk) { p.tx = clamp(bx * .12, -2.6, 2.6); p.ty = 103.6 - clamp((105 - by) < 20 ? 1.2 : 0, 0, 1.2); continue; }
        const lineY = p.role === 'D' ? dl : p.role === 'M' ? dl - 11 : dl - 30;
        p.tx = p.bx * .82 + bx * .42; p.ty = lineY + Math.sin(T * .4 + p.num) * .6;
        if (p === presser && best < 16) { p.tx = ball.x + (ball.x > 0 ? -.6 : .6); p.ty = ball.y + 1.6; p.sprint = true; } else p.sprint = false;
      }
    }
    function movePlayers(dt) {
      for (const p of players) {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        const vmax = p.sprint || p.force && p.force.sprint ? 8.6 : (p.force ? 7 : 5.6);
        const sp = Math.min(vmax, d * 1.6);
        const dvx = d > .05 ? dx / d * sp : 0, dvy = d > .05 ? dy / d * sp : 0;
        const acc = Math.min(1, dt * 4.5);
        p.vx += (dvx - p.vx) * acc; p.vy += (dvy - p.vy) * acc;
        if (!p.pose || p.pose === 'kick' || p.pose === 'celebrate') { p.x += p.vx * dt; p.y += p.vy * dt; }
        const v = Math.hypot(p.vx, p.vy); p.speed = v;
        p.phase += v * dt * 2.3;
        if (p.pose) { p.poseT += dt; if (p.poseDur && p.poseT > p.poseDur) { p.pose = null; p.poseT = 0; } }
      }
    }
    function setPose(p, pose, dur, dir) { p.pose = pose; p.poseT = 0; p.poseDur = dur || 0; p.poseDir = dir || 1; }

    /* ---------------- ball ---------------- */
    function flyBall(x1, y1, h1, dur, peak, onDone) {
      ball.owner = null;
      ball.fl = { x0: ball.x, y0: ball.y, h0: ball.h, x1, y1, h1, dur: Math.max(.08, dur), t: 0, peak: peak || 0, done: onDone };
    }
    function updateBall(dt) {
      if (ball.fl) {
        const f = ball.fl; f.t += dt / f.dur; const t = Math.min(1, f.t);
        const tt = f.peak > 0 ? t : 1 - Math.pow(1 - t, 1.5);
        ball.x = lerp(f.x0, f.x1, tt); ball.y = lerp(f.y0, f.y1, tt); ball.h = lerp(f.h0, f.h1, t) + f.peak * 4 * t * (1 - t);
        if (f.t >= 1) { ball.fl = null; f.done && f.done(); }
      } else if (ball.owner) {
        const o = ball.owner, v = Math.hypot(o.vx, o.vy);
        const dx = v > .4 ? o.vx / v : 0, dy = v > .4 ? o.vy / v : 1;
        const touch = .55 + .35 * Math.abs(Math.sin(o.phase * .5));
        ball.x += ((o.x + dx * touch) - ball.x) * Math.min(1, dt * 14);
        ball.y += ((o.y + dy * touch) - ball.y) * Math.min(1, dt * 14);
        ball.h = Math.max(0, ball.h - dt * 6);
      }
      ball.trail.unshift({ x: ball.x, y: ball.y, h: ball.h }); if (ball.trail.length > 6) ball.trail.pop();
    }

    /* ---------------- scripts ---------------- */
    let script = [], act = null, actT = 0;
    function run(list) { script = list.slice(); next(); }
    function next() { act = script.shift() || null; actT = 0; if (act && act.start) act.start(); }
    const A = {
      wait: (t, fn) => ({ start: fn, update: () => actT >= t }),
      call: fn => ({ start: fn, update: () => true }),
      dribble: (p, x, y, sprint, maxT) => ({
        start() { ball.owner = p; p.force = { x, y, sprint: !!sprint }; },
        update() { const done = Math.hypot(p.x - x, p.y - y) < .9 || actT > (maxT || 3.2); if (done) p.force = null; return done; }
      }),
      pass: (from, to, lx, ly, lofted) => ({
        start() {
          setPose(from, 'kick', .32, Math.sign(lx - from.x) || 1);
          const d = Math.hypot(lx - ball.x, ly - ball.y);
          to.force = { x: lx, y: ly, sprint: true };
          flyBall(lx, ly, lofted ? 1.6 : 0, d / (lofted ? 15 : 19) + .12, lofted ? Math.min(6, d * .16) : 0, () => { ball.owner = to; to.force = null; });
        },
        update() { return ball.owner === to; }
      }),
      shot: (p, outcome, header) => ({
        start() {
          const side = R() < .5 ? -1 : 1;
          let gx = side * (1.3 + R() * 2.1), gh = header ? 1.2 + R() * .9 : .25 + R() * 1.7;
          if (outcome === 'miss') { if (R() < .5) { gx = side * (4.4 + R() * 1.6); } else { gh = 2.75 + R() * .5; gx *= .6; } }
          if (outcome === 'save') { gx = side * (.9 + R() * 2); }
          setPose(p, header ? 'header' : 'kick', .4, Math.sign(gx - p.x) || 1);
          const d = Math.hypot(gx - ball.x, 105 - ball.y), dur = d / (header ? 17 : 27);
          if (!header) ball.h = .2;
          emit('chance'); crowdHype = 1;
          cam.tz = reduce ? 1 : 1.34; slowT = reduce ? 0 : .55;
          const gk = Aw.GK, reach = outcome === 'save';
          // keeper dive
          setTimeout0(() => { setPose(gk, 'dive', 1.7, Math.sign(gx - gk.x) || side); gk.dive = { x0: gk.x, x1: reach ? clamp(gx, -3.3, 3.3) : gk.x + (gx - gk.x) * .45, h: reach ? gh : gh * .6 }; }, dur * (reach ? .35 : .55));
          flyBall(gx, 105, gh, dur, header ? .4 : (gh > 1.5 ? .5 : .15), () => {
            if (outcome === 'goal') {
              net = { x: gx, h: gh, t: 0 }; cam.shake = reduce ? 0 : 1;
              flyBall(gx * 1.04, 106.9, Math.max(.2, gh * .7), .16, 0, () => flyBall(gx * 1.05, 106.6, 0, .35, 0, () => { }));
              this.res = 'goal';
            } else if (outcome === 'save') {
              const out = Math.sign(gx) || 1;
              flyBall(gx + out * 6, 101 + R() * 2, 0, .75, 2.2, () => { });
              this.res = 'save';
            } else {
              flyBall(gx * 1.5, 113, gh + 3, .45, 0, () => { });
              this.res = 'miss';
            }
          });
        },
        update() { return !!this.res; }
      })
    };
    // setTimeout bound to scene time (pauses with scene)
    const timers = [];
    function setTimeout0(fn, t) { timers.push({ fn, t }); }
    function tickTimers(dt) { for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } } }

    function reaction(res, scorer, info) {
      const list = [];
      list.push(A.call(() => {
        if (res === 'goal') {
          crowdJump = 1; flareBoost = 7; crowdHype = 1; emit('goal', { auto: !info.played });
          coachDo('arms_up', 3.2); say(pick(['כל הכבוד ילד!', 'איזה גול! איזה גול!', 'ככה! ככה משחקים!']), 'happy');
          const cx = scorer.x > 0 ? 29 : -29;
          scorer.force = { x: cx, y: 101.5, sprint: true };
          players.filter(p => p.team === 'H' && !p.gk && p !== scorer).forEach((p, i) => { if (Math.hypot(p.x - scorer.x, p.y - scorer.y) < 30) p.force = { x: cx - Math.sign(cx) * (2 + (i % 4) * 1.6), y: 99.5 - (i % 3) * 1.8, sprint: true }; });
          players.filter(p => p.team === 'A' && !p.gk).forEach(p => { p.force = { x: p.x * .9, y: p.y - 1, sprint: false }; });
          cam.tz = reduce ? 1 : 1.2;
        } else if (res === 'save') {
          crowdHype = .7; coachDo('hands_head', 2.2); say(pick(['איזה שוער...', 'אוףףף! כמעט!', 'עוד אחד כזה ונכנס!']), 'shout');
        } else {
          coachDo('hands_head', 2); say(pick(['מה אתה עושה?!', 'שים אותו בפנים!', 'נו באמת!']), 'angry');
        }
        if (info.played) emit('outcome', res, info);
      }));
      list.push(A.wait(res === 'goal' ? 1.6 : .9));
      if (res === 'goal') list.push(A.call(() => setPose(scorer, 'celebrate', 2.6)));
      list.push(A.wait(res === 'goal' ? 2.6 : 1.1));
      list.push(A.call(() => { cam.tz = 1; cut(() => resetShape()); }));
      list.push(A.wait(.7));
      return list;
    }
    function resetShape() {
      players.forEach(p => { p.force = null; p.pose = null; p.dive = null; p.x = p.bx + (R() - .5) * 2; p.y = p.by + (p.team === 'H' ? 0 : 0); p.vx = p.vy = 0; });
      ball.fl = null; ball.h = 0; ball.owner = Hm.DM; ball.x = Hm.DM.x; ball.y = Hm.DM.y + .6; net = null;
      cam.x = cam.tx = 0; cam.y = cam.ty = -2;
    }
    function pick(a) { return a[(R() * a.length) | 0]; }

    function genAttack() {
      const side = R() < .55 ? 1 : -1;
      const W1 = side > 0 ? Hm.RW : Hm.LW, CM = side > 0 ? Hm.RCM : Hm.LCM, CM2 = side > 0 ? Hm.LCM : Hm.RCM, ST = Hm.ST;
      const roll = R(), outcome = L.noAuto ? 'save' : (roll < .22 ? 'goal' : roll < .68 ? 'save' : 'miss');
      const s = [];
      s.push(A.wait(.5, () => { ball.owner = Hm.DM; if (R() < .5) say(pick(['קדימה! לחץ גבוה!', 'תפתחו את המגרש!', 'תזיזו את הכדור!']), 'shout'), coachDo('point', 1.8); }));
      s.push(A.dribble(Hm.DM, Hm.DM.x + (R() - .5) * 4, 62, false, 1.2));
      s.push(A.pass(Hm.DM, CM, side * (11 + R() * 4), 68 + R() * 3));
      s.push(A.dribble(CM, side * (13 + R() * 3), 75, false, 1.4));
      s.push(A.pass(CM, W1, side * (22 + R() * 3), 84 + R() * 3));
      s.push(A.dribble(W1, side * (19 + R() * 3), 93 + R() * 2, true, 1.8));
      const v = R();
      let shooter = W1, header = false;
      if (v < .38) {
        s.push(A.pass(W1, ST, side * -(.5 + R() * 2.5), 98.5 + R() * 1.5, true)); shooter = ST; header = true;
      } else if (v < .7) {
        s.push(A.pass(W1, CM2, side * (5 + R() * 4), 88 + R() * 2)); shooter = CM2;
      } else {
        s.push(A.dribble(W1, side * (13 + R() * 2), 93.5, true, 1.1));
        if (W1.hero && R() < .6) s.push(A.call(() => { say('יאללה, תן לו!', 'shout'); coachDo('point', 1.4); }));
      }
      const sh = A.shot(shooter, outcome, header); s.push(sh);
      s.push({ start() { script.unshift(...reaction(sh.res, shooter, { played: false })); }, update: () => true });
      return s;
    }

    function play(type, outcome) {
      outcome = outcome || 'goal';
      const info = { played: true, type };
      timers.length = 0;
      cut(() => {
        resetShape();
        // set-piece: hero isolated on the right wing vs full-back
        const D = Aw.D4;
        hero.x = 23; hero.y = 84.5; D.x = 19.5; D.y = 89; D.force = { x: 20.5, y: 88.5 };
        Hm.ST.x = 3; Hm.ST.y = 92; Hm.RCM.x = 11; Hm.RCM.y = 80; Hm.LW.x = -14; Hm.LW.y = 90;
        Aw.D3.x = 6; Aw.D3.y = 95; Aw.D2.x = -4; Aw.D2.y = 96; Aw.M4.x = 15; Aw.M4.y = 82;
        ball.owner = hero; ball.x = hero.x - .4; ball.y = hero.y + .6;
        cam.x = cam.tx = 10; cam.y = cam.ty = 22; cam.z = 1.08;
        const s = [A.wait(.9)];
        let shooter = hero, header = false;
        if (type === 'cross') {
          s.push(A.dribble(hero, 25.5, 99.5, true, 2.2));
          s.push(A.call(() => { D.force = { x: 24, y: 98 }; }));
          s.push(A.pass(hero, Hm.ST, 1 + R(), 99.2, true)); shooter = Hm.ST; header = true;
        } else if (type === 'cutback') {
          s.push(A.dribble(hero, 22.5, 99.5, true, 2));
          s.push(A.pass(hero, Hm.RCM, 9, 90)); shooter = Hm.RCM;
        } else {
          s.push(A.dribble(hero, 25, 88, true, .6));
          s.push(A.call(() => { setPose(D, 'tackle', 1.4, 1); D.force = { x: 24.5, y: 88.6 }; }));
          s.push(A.dribble(hero, 15.5, 92.5, true, 1.3));
          s.push(A.call(() => { D.force = null; }));
        }
        const sh = A.shot(shooter, outcome, header); s.push(sh);
        s.push({ start() { info.scorer = shooter === hero ? 'hero' : (shooter === Hm.ST ? 'st' : 'cm'); script.unshift(...reaction(sh.res, shooter, info)); }, update: () => true });
        run(s);
      });
    }

    function cut(fn) { cutPhase = 1; cutFn = fn; }

    /* ---------------- coach ---------------- */
    const coach = { pose: 'idle', t: 0, dur: 0, ang: null, mouth: 0 };
    const POSES = {
      idle: [100, 55, 80, 120], point: [198, 192, 75, 115], shout: [140, 280, 85, 110], arms_up: [238, 258, 300, 282],
      hands_head: [228, 342, 312, 200], clap: [150, 192, 158, 178], wave: [212, 245, 78, 118]
    };
    function coachDo(p, dur) { coach.pose = p; coach.t = 0; coach.dur = dur || 2; }
    let bubble = null, bubbleT = 0;
    function say(text, mood) {
      if (!bubble) { bubble = document.createElement('div'); bubble.className = 'coach-bubble'; wrap.appendChild(bubble); placeBubble(); }
      bubble.innerHTML = '<small>המאמן</small>' + text;
      bubble.className = 'coach-bubble ' + (mood || '') ; void bubble.offsetWidth; bubble.classList.add('in');
      bubble.style.opacity = 1; bubbleT = 2.8;
      if (mood === 'shout' && coach.pose === 'idle') coachDo(R() < .5 ? 'shout' : 'point', 1.6);
      if (mood === 'angry') coachDo('hands_head', 1.8);
      coach.mouth = 1.4;
    }
    function placeBubble() { if (!bubble) return; const c = coachGeom(); bubble.style.right = Math.round(W - c.x + 20) + 'px'; bubble.style.bottom = Math.round(H - c.y + c.s * 128) + 'px'; }
    function coachGeom() { const s = clamp(H / 470, .8, 1.15); return { x: W - 46 * s, y: H + 4, s }; }

    /* ---------------- crowd ---------------- */
    const fans = []; let flags = [], flares = [], smoke = [], phones = [];
    function buildCrowd() {
      fans.length = 0; flags = []; flares = []; phones = [];
      const rows = 10;
      for (let r = 0; r < rows; r++) {
        for (let x = -50; x <= 50; x += .78) {
          if (Math.abs(x - 31) < 1.2) continue; // segregation fence
          const awayEnd = x > 31;
          if (R() < .05) continue;
          const pal = awayEnd ? away.fans || [away.shirt, away.trim] : home.fans;
          fans.push({ x: x + (R() - .5) * .3, r, y: 109.4 + r * 1.55, h: .95 + r * 1.28, c: pal[(R() * pal.length) | 0], skin: R() < .5 ? '#C99470' : '#8E6446', ph: R() * TAU, amp: .6 + R() * .6, scarf: !awayEnd && R() < .22, away: awayEnd });
        }
      }
      [-24, -12, 3, 15, 25].forEach((x, i) => flags.push({ x, y: 109.4 + (3 + (i % 2)) * 1.55, h: .95 + (3 + (i % 2)) * 1.28 + 1.6, ph: i * 1.3, c: i % 2 ? [home.shorts, home.shirt, home.shorts] : [home.shirt, home.shorts, home.shirt] }));
      flags.push({ x: 40, y: 112.5, h: 6, ph: 2, c: ['#17181C', '#FFD21F', '#17181C'] });
      [-18.5, -4, 9.5, 21].forEach((x, i) => flares.push({ x, y: 109.4 + (2 + i % 3) * 1.55, h: .95 + (2 + i % 3) * 1.28 + .6, on: i === 1 ? 1 : 0, ph: R() * 10 }));
      // tifo banner texture
      const b = off(1100, 110), g = b.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 110); gr.addColorStop(0, home.shirt); gr.addColorStop(1, '#E0B000');
      g.fillStyle = gr; g.fillRect(0, 0, 1100, 110);
      g.fillStyle = home.shorts; g.fillRect(0, 0, 1100, 12); g.fillRect(0, 98, 1100, 12);
      g.font = 'italic 900 70px Rubik, Heebo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      g.fillStyle = home.shorts; g.fillText(chantText, 550, 58);
      L.banner = b;
      // LED board strip
      const led = off(1600, 40), lg = led.getContext('2d');
      lg.fillStyle = '#050B1A'; lg.fillRect(0, 0, 1600, 40);
      lg.font = '800 24px Heebo, sans-serif'; lg.textBaseline = 'middle'; lg.direction = 'rtl'; lg.textAlign = 'center';
      const ads = ['הילד מהשכונה', 'ליגת העל לנוער', 'מכבי תל אביב', 'הילד מהשכונה', '★ מהשכונה ועד הבאלון ד׳אור ★'];
      ads.forEach((t, i) => { lg.fillStyle = i % 2 ? '#2FE3CF' : '#F4C35A'; lg.fillText(t, 160 + i * 320, 21); });
      L.led = led;
      drawScoreboard();
    }
    function drawScoreboard() {
      const c = L.sb || (L.sb = off(300, 120)), g = c.getContext('2d');
      g.fillStyle = '#040914'; g.fillRect(0, 0, 300, 120);
      g.strokeStyle = 'rgba(47,227,207,.8)'; g.lineWidth = 4; g.strokeRect(2, 2, 296, 116);
      g.font = '800 26px Heebo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      g.fillStyle = home.shirt; g.fillText(home.name, 232, 40); g.fillStyle = '#E8E8E8'; g.fillText(away.name, 68, 40);
      g.font = '900 52px Rubik, Heebo, sans-serif'; g.fillStyle = '#fff'; g.fillText(score[0] + ' - ' + score[1], 150, 86);
      g.fillStyle = 'rgba(244,195,90,.9)'; g.font = '800 18px Heebo'; g.fillText('LIVE', 150, 30);
    }

    /* ---------------- resize ---------------- */
    function resize() {
      const r = canvas.getBoundingClientRect(); if (!r.width) return;
      W = r.width; H = r.height;
      dpr = Math.min(quality ? 2 : 1, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      F = 1.83 * W; HC = 26; HY = H * .37 - F * HC / 105;
      placeBubble();
      if (!running) frame(performance.now(), true);
    }

    /* ---------------- drawing ---------------- */
    function quad(a, b, c, d) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); }
    function line3(x1, y1, x2, y2, h) {
      const a = P(x1, y1, h || 0), b = P(x2, y2, h || 0); if (!a || !b) return; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    function drawSky() {
      const g = ctx.createLinearGradient(0, 0, 0, H * .5);
      g.addColorStop(0, '#01040B'); g.addColorStop(1, '#071A33');
      ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
    }
    function drawStadium() {
      // stand back wall + tiers
      const yb = 108.6, ye = 125.4;
      const a = P(-60, yb, 0), b = P(60, yb, 0), c = P(60, ye, 14.2), d = P(-60, ye, 14.2);
      if (!a) return;
      let g = ctx.createLinearGradient(0, d.y, 0, a.y); g.addColorStop(0, '#0A1430'); g.addColorStop(1, '#101E40');
      ctx.fillStyle = g; quad(a, b, c, d); ctx.fill();
      // tier lines
      ctx.strokeStyle = 'rgba(140,180,240,.08)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let r = 0; r <= 10; r++) line3(-60, 109.4 + r * 1.55 - .5, 60, 109.4 + r * 1.55 - .5, .95 + r * 1.28 - .7);
      ctx.stroke();
      // roof underside with floodlight gantry
      const r1 = P(-60, 126, 17), r2 = P(60, 126, 17), r3 = P(60, 134, 22), r4 = P(-60, 134, 22);
      ctx.fillStyle = '#060C1E'; quad(r1, r2, r3, r4); ctx.fill();
      ctx.fillStyle = '#060C1E'; ctx.fillRect(-W, r4.y - H, W * 3, H + 2);
      ctx.strokeStyle = 'rgba(120,200,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = -60; x <= 60; x += 6) line3(x, 126, x, 134, 17); ctx.stroke();
      // roof edge LED
      ctx.strokeStyle = 'rgba(47,227,207,.85)'; ctx.lineWidth = 1.4; ctx.beginPath(); line3(-60, 126, 60, 126, 16.6); ctx.stroke();
      // scoreboard screen (left corner)
      const s1 = P(-40, 125, 14.5), s2 = P(-26, 125, 14.5), s3 = P(-26, 125, 20.5);
      if (s1 && L.sb) { ctx.drawImage(L.sb, s1.x, s3.y, s2.x - s1.x, s1.y - s3.y); }
    }
    function drawFans(dt) {
      const beat = beatEnv, jump = crowdJump;
      const groups = {};
      const heads = [], arms = [], scarves = [];
      const minX = -W * .2, maxX = W * 1.2;
      const step = quality ? 1 : 2;
      for (let i = 0; i < fans.length; i += step) {
        const f = fans[i]; const z = f.y - cam.y; const s = F / z;
        const sx = W / 2 + (f.x - cam.x) * s; if (sx < minX || sx > maxX) continue;
        let bob = (reduce ? .05 : (f.away ? .05 : .12 * beat * f.amp + .05 * Math.sin(T * 2 + f.ph)));
        if (jump > 0 && !f.away) bob += Math.max(0, Math.sin(T * 9 + f.ph)) * .55 * jump * f.amp;
        const sy = HY + (HC - f.h - bob) * s;
        const bw = .52 * s, bh = .62 * s;
        (groups[f.c] || (groups[f.c] = [])).push(sx - bw / 2, sy - bh, bw, bh);
        heads.push(sx - .14 * s, sy - bh - .3 * s, .28 * s, .3 * s, f.skin);
        if ((jump > .2 || crowdHype > .8) && !f.away && (i % 3 === 0)) arms.push(sx, sy - bh, s, f.c);
        if (f.scarf && !f.away && beat > .3) scarves.push(sx, sy - bh - .55 * s, s, f.c);
      }
      for (const c in groups) { const a = groups[c]; ctx.fillStyle = c; ctx.beginPath(); for (let j = 0; j < a.length; j += 4) ctx.rect(a[j], a[j + 1], a[j + 2], a[j + 3]); ctx.fill(); }
      ctx.fillStyle = '#B98563'; ctx.beginPath(); for (let j = 0; j < heads.length; j += 5) ctx.rect(heads[j], heads[j + 1], heads[j + 2], heads[j + 3]); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = '#C99470'; ctx.beginPath();
      for (let j = 0; j < arms.length; j += 4) { const x = arms[j], y = arms[j + 1], s = arms[j + 2]; ctx.moveTo(x - .2 * s, y); ctx.lineTo(x - .35 * s, y - .7 * s); ctx.moveTo(x + .2 * s, y); ctx.lineTo(x + .35 * s, y - .7 * s); }
      ctx.stroke();
      for (let j = 0; j < scarves.length; j += 4) { const x = scarves[j], y = scarves[j + 1], s = scarves[j + 2]; ctx.fillStyle = home.shirt; ctx.fillRect(x - .7 * s, y, 1.4 * s, .22 * s); ctx.fillStyle = home.shorts; ctx.fillRect(x - .2 * s, y, .4 * s, .22 * s); }
      // phone flashlights
      if (!reduce && R() < .6) { const f = fans[(R() * fans.length) | 0]; phones.push({ f, t: 0, life: .4 + R() * .9 }); }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = phones.length - 1; i >= 0; i--) {
        const p = phones[i]; p.t += dt; if (p.t > p.life) { phones.splice(i, 1); continue; }
        const q = P(p.f.x, p.f.y, p.f.h + .9); if (!q) continue; const a = Math.sin(p.t / p.life * Math.PI), sz = 1.6 * q.s * .5 + 2;
        ctx.globalAlpha = a; ctx.drawImage(SPR.phone, q.x - sz, q.y - sz, sz * 2, sz * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    function drawFlags() {
      for (const f of flags) {
        const base = P(f.x, f.y, f.h); if (!base) continue; const s = base.s;
        const pole = P(f.x, f.y, f.h - 2.2);
        ctx.strokeStyle = '#7A8496'; ctx.lineWidth = Math.max(1, .08 * s); ctx.beginPath(); ctx.moveTo(base.x, pole.y); ctx.lineTo(base.x, base.y - 1.9 * s); ctx.stroke();
        const wv = 3.4, hv = 2.1, n = 8, sw = wv * s / n;
        const lift = crowdJump * 0.5 * Math.max(0, Math.sin(T * 6 + f.ph));
        for (let i = 0; i < n; i++) {
          const w0 = Math.sin(T * 4.2 + f.ph - i * .7) * .22 * (i / n) * s, w1 = Math.sin(T * 4.2 + f.ph - (i + 1) * .7) * .22 * ((i + 1) / n) * s;
          const x0 = base.x + i * sw, top = base.y - (1.9 + lift) * s;
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = f.c[k];
            const y0 = top + k * hv * s / 3;
            ctx.beginPath(); ctx.moveTo(x0, y0 + w0); ctx.lineTo(x0 + sw + .5, y0 + w1); ctx.lineTo(x0 + sw + .5, y0 + w1 + hv * s / 3 + .5); ctx.lineTo(x0, y0 + w0 + hv * s / 3 + .5); ctx.fill();
          }
          ctx.fillStyle = `rgba(0,0,0,${(.18 * (Math.sin(T * 4.2 + f.ph - i * .7) * .5 + .5)).toFixed(3)})`;
          ctx.fillRect(x0, top + w0, sw + .5, hv * s);
        }
      }
    }
    function drawBanner() {
      // tifo held by first two rows
      const x0 = -13, x1 = 13, n = 18, y = 109.6, hb = 1.15, ht = 2.75;
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n;
        const wa = Math.sin(T * 3 + i * .6) * .12 + crowdJump * .25 * Math.sin(T * 8 + i), wb = Math.sin(T * 3 + (i + 1) * .6) * .12 + crowdJump * .25 * Math.sin(T * 8 + i + 1);
        const a = P(lerp(x0, x1, u0), y, ht + wa), b = P(lerp(x0, x1, u1), y, ht + wb), c = P(lerp(x0, x1, u1), y, hb + wb), d = P(lerp(x0, x1, u0), y, hb + wa);
        if (!a) return;
        const sw = L.banner.width / n;
        ctx.save(); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + .6, b.y); ctx.lineTo(c.x + .6, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.clip();
        const sh = d.y - a.y, dy = (b.y - a.y);
        ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, ctx.getTransform().e, ctx.getTransform().f);
        ctx.transform((b.x - a.x) / sw, dy / sw, 0, sh / L.banner.height, a.x - (b.x - a.x) / sw * i * sw, a.y - dy * i);
        ctx.drawImage(L.banner, 0, 0);
        ctx.restore();
      }
    }
    function drawLED() {
      const y = 107.9, a = P(-42, y, .95), b = P(42, y, .95), c = P(42, y, 0), d = P(-42, y, 0);
      if (!a) return;
      ctx.fillStyle = '#050B1A'; quad(a, b, c, d); ctx.fill();
      const off = (T * 60) % (L.led.width / 2);
      ctx.save(); quad(a, b, c, d); ctx.clip();
      const sx = (b.x - a.x) / (L.led.width * 1.0);
      ctx.globalAlpha = .95;
      for (let k = -1; k < 2; k++) ctx.drawImage(L.led, a.x + (k * L.led.width - off) * sx * 1, a.y, L.led.width * sx, d.y - a.y);
      ctx.globalAlpha = 1; ctx.restore();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(47,227,207,.06)';
      const e = P(-42, y - 3, 0), f = P(42, y - 3, 0); quad(d, c, f, e); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawPitch() {
      const near = Math.max(cam.y + 2, 0);
      // run-off
      let a = P(-46, near, 0), b = P(46, near, 0), c = P(46, 108.6, 0), d = P(-46, 108.6, 0);
      ctx.fillStyle = '#0E4A2A'; quad(a, b, c, d); ctx.fill();
      for (let i = 0; i < 22; i++) {
        let y0 = i * 5.25, y1 = y0 + 5.25; if (y1 < near) continue; y0 = Math.max(y0, near);
        const p0 = P(-34, y0, 0), p1 = P(34, y0, 0), p2 = P(34, y1, 0), p3 = P(-34, y1, 0);
        ctx.fillStyle = i % 2 ? '#1D7A3F' : '#196C37'; quad(p0, p1, p2, p3); ctx.fill();
      }
      // floodlight pools
      ctx.globalCompositeOperation = 'lighter';
      [[-22, 92], [22, 92], [-20, 62], [20, 62], [0, 78]].forEach(([x, y]) => {
        const q = P(x, y, 0); if (!q) return; const r = 30 * q.s;
        ctx.globalAlpha = .22; ctx.drawImage(SPR.pool, q.x - r, q.y - r * .5, r * 2, r);
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // lines
      ctx.strokeStyle = 'rgba(240,250,255,.82)'; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, .14 * F / (88 - cam.y));
      ctx.beginPath();
      line3(-34, near, -34, 105); line3(34, near, 34, 105); line3(-34, 105, 34, 105);
      line3(-34, 52.5, 34, 52.5);
      line3(-20.16, 105, -20.16, 88.5); line3(20.16, 105, 20.16, 88.5); line3(-20.16, 88.5, 20.16, 88.5);
      line3(-9.16, 105, -9.16, 99.5); line3(9.16, 105, 9.16, 99.5); line3(-9.16, 99.5, 9.16, 99.5);
      ctx.stroke();
      ctx.beginPath(); let first = true;
      for (let i = 0; i <= 48; i++) { const a2 = i / 48 * TAU, q = P(Math.cos(a2) * 9.15, 52.5 + Math.sin(a2) * 9.15, 0); if (!q) { first = true; continue; } first ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); first = false; }
      ctx.stroke();
      ctx.beginPath(); first = true;
      for (let i = 0; i <= 24; i++) { const a2 = Math.PI + .64 + i / 24 * (Math.PI - 1.28), q = P(Math.cos(a2) * 9.15, 94 + Math.sin(a2) * 9.15, 0); if (!q) continue; first ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); first = false; }
      ctx.stroke();
      const ps = P(0, 94, 0); if (ps) { ctx.fillStyle = '#F0FAFF'; ctx.beginPath(); ctx.ellipse(ps.x, ps.y, .25 * ps.s, .12 * ps.s, 0, 0, TAU); ctx.fill(); }
    }
    function drawGoalBack() {
      const gw = 3.66, gh = 2.44, back = 107.1;
      const disp = (x, h) => {
        if (!net) return 0; const t = net.t, d2 = (x - net.x) ** 2 + (h - net.h) ** 2;
        return Math.exp(-d2 / 1.6) * (1.1 * Math.exp(-t * 1.6) + .35 * Math.sin(t * 16 - Math.sqrt(d2) * 3) * Math.exp(-t * 2.4));
      };
      ctx.strokeStyle = 'rgba(235,245,255,.42)'; ctx.lineWidth = .8; ctx.beginPath();
      const nx = 12, nh = 6;
      for (let i = 0; i <= nx; i++) {
        const x = -gw + i * 2 * gw / nx; let first = true;
        for (let j = 0; j <= nh; j++) { const h = j * 2.25 / nh, q = P(x, back + disp(x, h), h); if (!q) continue; first ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); first = false; }
        const top = P(x, back + disp(x, 2.25), 2.25), fr = P(x, 105, gh); if (top && fr) ctx.lineTo(fr.x, fr.y);
      }
      for (let j = 0; j <= nh; j++) {
        const h = j * 2.25 / nh; let first = true;
        for (let i = 0; i <= nx; i++) { const x = -gw + i * 2 * gw / nx, q = P(x, back + disp(x, h), h); if (!q) continue; first ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); first = false; }
      }
      for (const sx of [-gw, gw]) for (let j = 0; j <= nh; j++) { const h = j * 2.25 / nh; line3(sx, 105, sx, back, Math.min(h, gh)); }
      ctx.stroke();
    }
    function drawGoalFrame() {
      const gw = 3.66, gh = 2.44;
      const a = P(-gw, 105, 0), b = P(-gw, 105, gh), c = P(gw, 105, gh), d = P(gw, 105, 0); if (!a) return;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(2, .14 * a.s) + 1.5; ctx.beginPath(); ctx.moveTo(a.x + 1, a.y); ctx.lineTo(b.x + 1, b.y + 1); ctx.lineTo(c.x + 1, c.y + 1); ctx.lineTo(d.x + 1, d.y); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1.8, .14 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    const LIGHTS = [[-46, 126, 17], [46, 126, 17], [-46, -14, 26], [46, -14, 26]];
    function drawPlayer(p) {
      const g = P(p.x, p.y, 0); if (!g) return; if (g.x < -60 || g.x > W + 60) return;
      const u = g.s * 1.32; // exaggerate figures for legibility
      const kit = p.team === 'H' ? home : away;
      const shirt = p.gk ? kit.gk : kit.shirt, shorts = p.gk ? '#101418' : kit.shorts, socks = p.gk ? kit.gk : kit.socks;
      // floodlight shadows (4 faint)
      if (quality) {
        ctx.strokeStyle = 'rgba(0,10,5,.16)'; ctx.lineWidth = .32 * u; ctx.lineCap = 'round'; ctx.beginPath();
        for (const L4 of LIGHTS) { let dx = p.x - L4[0], dy = p.y - L4[1]; const d = Math.hypot(dx, dy); dx /= d; dy /= d; const q = P(p.x + dx * 1.5, p.y + dy * 1.5, 0); if (q) { ctx.moveTo(g.x, g.y); ctx.lineTo(q.x, q.y); } }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, .32 * u, .1 * u, 0, 0, TAU); ctx.fill();
      if (p.hero) {
        const pr = .55 + .08 * Math.sin(T * 5);
        ctx.strokeStyle = 'rgba(244,195,90,.95)'; ctx.lineWidth = Math.max(1.4, .07 * u);
        ctx.beginPath(); ctx.ellipse(g.x, g.y, pr * u, pr * u * .32, 0, 0, TAU); ctx.stroke();
      }
      ctx.save();
      let rot = 0, lift = 0, sq = 1;
      const v = p.speed || 0, run = clamp(v / 6, 0, 1);
      const sdx = p.vx * g.s, dir = Math.abs(sdx) > .3 ? Math.sign(sdx) : (p.team === 'H' ? 1 : -1);
      let lean = run * .08 * dir;
      if (p.pose === 'dive' && p.dive) {
        const t = clamp(p.poseT / .45, 0, 1), e = ease(t);
        p.x = lerp(p.dive.x0, p.dive.x1, e);
        const gg = P(p.x, p.y, 0); if (gg) { g.x = gg.x; g.y = gg.y; }
        rot = p.poseDir * (Math.PI / 2) * .92 * e; lift = Math.sin(Math.min(1, t) * Math.PI) * p.dive.h * .55 + (t >= 1 ? 0 : 0);
        if (p.poseT > .5) { rot = p.poseDir * Math.PI / 2 * .98; lift = .15; }
      } else if (p.pose === 'tackle') { rot = -.95 * p.poseDir * Math.min(1, p.poseT * 4); lift = .1; }
      else if (p.pose === 'header') { lift = Math.sin(clamp(p.poseT / .4, 0, 1) * Math.PI) * .55; }
      else if (p.pose === 'celebrate') { lift = Math.abs(Math.sin(p.poseT * 7)) * .35; }
      ctx.translate(g.x, g.y - lift * u); ctx.rotate(rot);
      const swing = Math.sin(p.phase) * run, swing2 = Math.sin(p.phase + Math.PI) * run;
      const kick = p.pose === 'kick' ? Math.sin(clamp(p.poseT / .32, 0, 1) * Math.PI) : 0;
      // legs
      const hipY = -.92 * u, hx = .1 * u;
      const fL = { x: -hx + swing * .26 * u * dir, y: -Math.max(0, Math.sin(p.phase)) * .16 * u * run };
      const fR = { x: hx + swing2 * .26 * u * dir + kick * .45 * u * p.poseDir, y: -Math.max(0, Math.sin(p.phase + Math.PI)) * .16 * u * run - kick * .35 * u };
      if (u < 7) {
        ctx.strokeStyle = socks; ctx.lineWidth = Math.max(1, .13 * u); ctx.beginPath(); ctx.moveTo(-hx * .6, hipY); ctx.lineTo(fL.x, fL.y); ctx.moveTo(hx * .6, hipY); ctx.lineTo(fR.x, fR.y); ctx.stroke();
      } else {
        ctx.fillStyle = p.skin; capsule(ctx, -hx * .7, hipY, .085 * u, fL.x, fL.y - .1 * u, .06 * u); capsule(ctx, hx * .7, hipY, .085 * u, fR.x, fR.y - .1 * u, .06 * u);
        ctx.fillStyle = socks; capsule(ctx, lerp(-hx * .7, fL.x, .5), lerp(hipY, fL.y, .5), .065 * u, fL.x, fL.y - .08 * u, .058 * u); capsule(ctx, lerp(hx * .7, fR.x, .5), lerp(hipY, fR.y, .5), .065 * u, fR.x, fR.y - .08 * u, .058 * u);
        ctx.fillStyle = '#0B0F18'; ctx.beginPath(); ctx.ellipse(fL.x + .03 * u * dir, fL.y - .04 * u, .09 * u, .05 * u, 0, 0, TAU); ctx.ellipse(fR.x + .03 * u * dir, fR.y - .04 * u, .09 * u, .05 * u, 0, 0, TAU); ctx.fill();
      }
      // shorts
      ctx.fillStyle = shorts; rr(-.22 * u + lean * u * .3, -1.06 * u, .44 * u, .26 * u, .06 * u);
      // torso
      const tx = lean * u;
      const shY = -1.5 * u;
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.moveTo(-.25 * u + tx, shY); ctx.lineTo(.25 * u + tx, shY); ctx.lineTo(.21 * u + tx * .5, -.98 * u); ctx.lineTo(-.21 * u + tx * .5, -.98 * u); ctx.closePath(); ctx.fill();
      // arms
      const celebrate = p.pose === 'celebrate', diving = p.pose === 'dive';
      const armUp = celebrate || diving || p.pose === 'header';
      const aL = armUp ? { x: -.34 * u + tx, y: -2.0 * u } : { x: -.33 * u + tx - swing * .14 * u * dir, y: -1.08 * u + Math.abs(swing) * .05 * u - kick * .25 * u };
      const aR = armUp ? { x: .34 * u + tx, y: -2.0 * u } : { x: .33 * u + tx - swing2 * .14 * u * dir, y: -1.08 * u - kick * .25 * u };
      if (u >= 7) {
        ctx.fillStyle = shirt; capsule(ctx, -.24 * u + tx, shY + .05 * u, .07 * u, lerp(-.24 * u + tx, aL.x, .45), lerp(shY, aL.y, .45), .06 * u); capsule(ctx, .24 * u + tx, shY + .05 * u, .07 * u, lerp(.24 * u + tx, aR.x, .45), lerp(shY, aR.y, .45), .06 * u);
        ctx.fillStyle = p.gk ? '#E8F0FF' : p.skin; capsule(ctx, lerp(-.24 * u + tx, aL.x, .45), lerp(shY, aL.y, .45), .055 * u, aL.x, aL.y, .05 * u); capsule(ctx, lerp(.24 * u + tx, aR.x, .45), lerp(shY, aR.y, .45), .055 * u, aR.x, aR.y, .05 * u);
        // trim + number
        ctx.fillStyle = p.gk ? '#0B0F18' : kit.trim;
        ctx.fillRect(-.25 * u + tx, shY, .5 * u, .05 * u);
        if (u > 13 && p.team === 'H' && !p.gk) { ctx.font = `900 ${(.3 * u).toFixed(1)}px Rubik, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(String(p.num), tx * .8, -1.12 * u); }
        if (u > 13 && p.team === 'A') { ctx.fillRect(-.03 * u + tx, shY, .06 * u, .5 * u); }
      } else {
        ctx.strokeStyle = shirt; ctx.lineWidth = Math.max(1, .1 * u); ctx.beginPath(); ctx.moveTo(-.22 * u + tx, shY + .05 * u); ctx.lineTo(aL.x, aL.y); ctx.moveTo(.22 * u + tx, shY + .05 * u); ctx.lineTo(aR.x, aR.y); ctx.stroke();
      }
      // head
      const hy = -1.68 * u, hr = .135 * u;
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(tx * 1.1, hy, hr, 0, TAU); ctx.fill();
      ctx.fillStyle = p.hair; ctx.beginPath();
      if (p.team === 'H') ctx.arc(tx * 1.1, hy - hr * .1, hr * 1.02, Math.PI * .95, Math.PI * 2.05); else ctx.arc(tx * 1.1, hy - hr * .3, hr * .98, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      // floodlight rim (top-left highlight)
      if (u >= 7) { ctx.strokeStyle = 'rgba(220,255,250,.55)'; ctx.lineWidth = Math.max(.8, .03 * u); ctx.beginPath(); ctx.arc(tx * 1.1, hy, hr, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke(); }
      ctx.restore();
      if (p.hero && u > 6) {
        const ty = g.y - 2.15 * u - lift * u - 8;
        ctx.font = '800 10.5px Heebo, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
        const tw = ctx.measureText(heroName).width + 14;
        ctx.fillStyle = 'rgba(5,11,26,.82)'; rrAt(g.x - tw / 2, ty - 15, tw, 15, 7.5);
        ctx.strokeStyle = 'rgba(244,195,90,.9)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#FFE7A3'; ctx.fillText(heroName, g.x, ty - 4);
        ctx.fillStyle = '#F4C35A'; ctx.beginPath(); ctx.moveTo(g.x - 3.5, ty); ctx.lineTo(g.x + 3.5, ty); ctx.lineTo(g.x, ty + 4); ctx.fill();
      }
    }
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); }
    function rrAt(x, y, w, h, r) { rr(x, y, w, h, r); }
    function drawBall() {
      const q = P(ball.x, ball.y, ball.h), gq = P(ball.x, ball.y, 0); if (!q) return;
      const r = Math.max(2.2, .2 * q.s * 1.5);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(gq.x, gq.y, r * 1.1, r * .4, 0, 0, TAU); ctx.fill();
      if (ball.fl && !reduce) {
        for (let i = 1; i < ball.trail.length; i++) { const t = ball.trail[i], tq = P(t.x, t.y, t.h); if (!tq) continue; ctx.fillStyle = `rgba(255,255,255,${(.22 - i * .035).toFixed(3)})`; ctx.beginPath(); ctx.arc(tq.x, tq.y - r, r * (1 - i * .1), 0, TAU); ctx.fill(); }
      }
      const gr = ctx.createRadialGradient(q.x - r * .4, q.y - r * 1.4, r * .1, q.x, q.y - r, r);
      gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#AEB9CC');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y - r, r, 0, TAU); ctx.fill();
      if (r > 3) { ctx.fillStyle = '#18213A'; ctx.beginPath(); ctx.arc(q.x + Math.sin(T * 9) * r * .3, q.y - r, r * .32, 0, TAU); ctx.fill(); }
    }
    function drawFlares(dt) {
      for (const f of flares) {
        const lit = f.on || flareBoost > 0 || (Math.sin(T * .2 + f.ph) > .6);
        if (!lit) continue;
        const q = P(f.x, f.y, f.h); if (!q) continue;
        if (!reduce && R() < (flareBoost > 0 ? .9 : .35) * dt * 30) smoke.push({ x: f.x + (R() - .5) * .6, y: f.y, h: f.h + .3, r: .8, a: .5, vx: .5 + R() * .8, vh: 1 + R() * 1.4, t: 0, life: 4 + R() * 3 });
        ctx.globalCompositeOperation = 'lighter';
        const fl = reduce ? 1 : .75 + R() * .35, sz = (2.6 + flareBoost * .08) * q.s * fl;
        ctx.globalAlpha = .9; ctx.drawImage(SPR.flare, q.x - sz, q.y - sz, sz * 2, sz * 2);
        ctx.globalAlpha = .22; ctx.drawImage(SPR.flare, q.x - sz * 3.2, q.y - sz * 2.6, sz * 6.4, sz * 5.2);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#FFF4F4'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, .18 * q.s), 0, TAU); ctx.fill();
      }
      for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i]; s.t += dt; if (s.t > s.life || smoke.length > 70) { smoke.splice(i, 1); continue; }
        s.x += s.vx * dt; s.h += s.vh * dt; s.y += .25 * dt; s.r += dt * 1.1;
        const q = P(s.x, s.y, s.h); if (!q) continue;
        const a = (1 - s.t / s.life) * .55, rad = s.r * q.s * 1.5;
        ctx.globalAlpha = a; ctx.drawImage(SPR.smoke, q.x - rad, q.y - rad, rad * 2, rad * 2);
      }
      ctx.globalAlpha = 1;
    }
    function drawFloodlights() {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) {
        const x = -42 + i * 12, q = P(x, 126, 16.4); if (!q) continue;
        const sz = 9 * q.s * .5 + 14;
        ctx.globalAlpha = .9; ctx.drawImage(SPR.flood, q.x - sz, q.y - sz, sz * 2, sz * 2);
        // light cone down onto the pitch
        const t = P(x * .55, 84, 0);
        if (t) {
          const gr = ctx.createLinearGradient(q.x, q.y, t.x, t.y);
          gr.addColorStop(0, 'rgba(200,255,248,.10)'); gr.addColorStop(1, 'rgba(200,255,248,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(q.x - 3, q.y); ctx.lineTo(q.x + 3, q.y); ctx.lineTo(t.x + 22 * t.s / 6, t.y); ctx.lineTo(t.x - 22 * t.s / 6, t.y); ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    function drawCoach(dt) {
      const c = coachGeom(), s = c.s;
      coach.t += dt; if (coach.pose !== 'idle' && coach.t > coach.dur) coachDo('idle', 0);
      const target = POSES[coach.pose].slice();
      if (coach.pose === 'clap') { target[1] += Math.sin(T * 18) * 14; target[3] -= Math.sin(T * 18) * 14; }
      if (coach.pose === 'wave' || coach.pose === 'point') target[1] += Math.sin(T * 9) * 10;
      if (coach.pose === 'arms_up') { target[0] += Math.sin(T * 10) * 6; target[2] -= Math.sin(T * 10) * 6; }
      if (!coach.ang) coach.ang = target.slice();
      for (let i = 0; i < 4; i++) coach.ang[i] += (target[i] - coach.ang[i]) * Math.min(1, dt * 10);
      coach.mouth = Math.max(0, coach.mouth - dt);
      const D2R = Math.PI / 180, an = coach.ang.map(a => a * D2R);
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(s, s);
      const bob = coach.pose === 'arms_up' ? Math.abs(Math.sin(T * 8)) * -6 : (coach.mouth > 0 ? Math.sin(T * 14) * 1 : 0);
      ctx.translate(0, bob);
      // technical area line + shadow
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(0, -4, 34, 7, 0, 0, TAU); ctx.fill();
      // legs (trousers)
      ctx.fillStyle = '#0A1226'; capsule(ctx, -6, -64, 8.5, -11, -4, 6.5); capsule(ctx, 6, -64, 8.5, 9, -4, 6.5);
      ctx.fillStyle = '#05080F'; ctx.beginPath(); ctx.ellipse(-15, -3, 9, 4.5, 0, 0, TAU); ctx.ellipse(6, -3, 9, 4.5, 0, 0, TAU); ctx.fill();
      // back arm
      const sB = { x: 12, y: -110 }, eB = { x: sB.x + Math.cos(an[2]) * 24, y: sB.y + Math.sin(an[2]) * 24 }, hB = { x: eB.x + Math.cos(an[3]) * 22, y: eB.y + Math.sin(an[3]) * 22 };
      ctx.fillStyle = '#0F2556'; capsule(ctx, sB.x, sB.y, 7.5, eB.x, eB.y, 6); capsule(ctx, eB.x, eB.y, 6, hB.x, hB.y, 5);
      ctx.fillStyle = '#B9805A'; ctx.beginPath(); ctx.arc(hB.x, hB.y, 5, 0, TAU); ctx.fill();
      // torso (club jacket)
      const jg = ctx.createLinearGradient(-24, 0, 24, 0); jg.addColorStop(0, '#1C3F86'); jg.addColorStop(1, '#0E2458');
      ctx.fillStyle = jg; ctx.beginPath();
      ctx.moveTo(-20, -116); ctx.quadraticCurveTo(0, -122, 20, -116); ctx.lineTo(22, -62); ctx.quadraticCurveTo(0, -56, -20, -62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = home.shirt; ctx.fillRect(-3, -118, 2.6, 56);
      ctx.beginPath(); ctx.moveTo(-20, -116); ctx.lineTo(-24, -98); ctx.lineTo(-20, -97); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(160,240,255,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-19, -114); ctx.quadraticCurveTo(-22, -90, -20, -64); ctx.stroke();
      // club crest on chest
      ctx.fillStyle = home.shirt; ctx.beginPath(); ctx.moveTo(8, -104); ctx.lineTo(15, -102); ctx.lineTo(15, -96); ctx.quadraticCurveTo(14, -91, 11.5, -90); ctx.quadraticCurveTo(9, -91, 8, -96); ctx.closePath(); ctx.fill();
      // head (profile facing left, toward the pitch)
      ctx.fillStyle = '#B9805A'; ctx.fillRect(-6, -128, 11, 12);
      ctx.fillStyle = '#C68B62'; ctx.beginPath(); ctx.ellipse(-2, -138, 11, 13, -.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12, -142); ctx.lineTo(-17, -134); ctx.lineTo(-12, -132); ctx.fill(); // nose
      ctx.fillStyle = '#9A6646'; ctx.beginPath(); ctx.ellipse(5, -137, 3, 4, 0, 0, TAU); ctx.fill(); // ear
      ctx.fillStyle = '#2B2A2E'; ctx.beginPath(); ctx.ellipse(1, -146, 10.5, 6.5, -.25, Math.PI * .9, Math.PI * 2.1); ctx.fill();
      ctx.fillRect(4, -146, 6, 9);
      ctx.strokeStyle = '#2B2A2E'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-12, -143); ctx.lineTo(-6, -144); ctx.stroke();
      // mouth: open when shouting
      ctx.fillStyle = '#3A1414';
      const mo = coach.mouth > 0 ? (2.4 + Math.abs(Math.sin(T * 16)) * 2.4) : .9;
      ctx.beginPath(); ctx.ellipse(-11, -128.5, 2.6, mo, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(190,255,248,.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-2, -138, 11.5, Math.PI * 1.15, Math.PI * 1.7); ctx.stroke();
      // front arm
      const sF = { x: -14, y: -110 }, eF = { x: sF.x + Math.cos(an[0]) * 24, y: sF.y + Math.sin(an[0]) * 24 }, hF = { x: eF.x + Math.cos(an[1]) * 22, y: eF.y + Math.sin(an[1]) * 22 };
      ctx.fillStyle = '#183A7E'; capsule(ctx, sF.x, sF.y, 7.5, eF.x, eF.y, 6); capsule(ctx, eF.x, eF.y, 6, hF.x, hF.y, 5);
      ctx.fillStyle = home.shirt; ctx.beginPath(); ctx.arc(lerp(eF.x, hF.x, .78), lerp(eF.y, hF.y, .78), 5.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#C68B62'; ctx.beginPath(); ctx.arc(hF.x, hF.y, 5.2, 0, TAU); ctx.fill();
      if (coach.pose === 'point') { ctx.fillStyle = '#C68B62'; capsule(ctx, hF.x, hF.y, 3, hF.x + Math.cos(an[1]) * 8, hF.y + Math.sin(an[1]) * 8, 1.8); }
      ctx.restore();
    }

    /* ---------------- chant / beat ---------------- */
    let beatT = 0, beatI = 0, beatEnv = 0;
    const PATTERN = [0, .28, .56, 1.12, 1.4]; // "boom boom boom . boom boom"
    function tickBeat(dt) {
      beatT += dt; beatEnv = Math.max(0, beatEnv - dt * 3.2);
      const cyc = 1.7, tt = beatT % cyc, prev = (beatT - dt) % cyc;
      for (const b of PATTERN) if ((prev < b && tt >= b) || (prev > tt && b === 0)) { beatEnv = 1; emit('beat'); }
    }

    /* ---------------- frame ---------------- */
    let ftAvg = 16, ftN = 0;
    function frame(now, single) {
      let dtR = Math.min(.05, (now - last) / 1000 || .016); last = now;
      if (!single && quality) { ftAvg = ftAvg * .95 + dtR * 1000 * .05; if (++ftN > 90 && ftAvg > 26) { quality = 0; resize(); } }
      if (slowT > 0) { slowT -= dtR; timeScale = .42; } else timeScale += (1 - timeScale) * Math.min(1, dtR * 4);
      const dt = single ? 0 : dtR * timeScale;
      T += dt;
      if (!single) {
        tickTimers(dt);
        if (cutPhase) {
          cutA += dtR * (cutPhase > 0 ? 6 : -4);
          if (cutPhase > 0 && cutA >= 1) { cutA = 1; cutPhase = -1; const f = cutFn; cutFn = null; f && f(); }
          if (cutPhase < 0 && cutA <= 0) { cutA = 0; cutPhase = 0; }
        }
        if (!(cutPhase > 0)) {
          if (act) { actT += dt; if (act.update(dt)) next(); } else run(genAttack());
        }
        shapeTargets(dt); movePlayers(dt); updateBall(dt);
        if (net) { net.t += dt; if (net.t > 3) net = null; }
        crowdJump = Math.max(0, crowdJump - dt * .16); crowdHype += (.3 - crowdHype) * dt * .5; flareBoost = Math.max(0, flareBoost - dt);
        tickBeat(dtR);
        if (bubble && bubbleT > 0) { bubbleT -= dtR; if (bubbleT <= 0) bubble.style.opacity = 0; }
        // camera
        cam.tx = clamp(ball.x * .72, -13, 13); cam.ty = clamp(ball.y - 60, -4, 22);
        const k = Math.min(1, dtR * 2.2);
        cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k * .8; cam.z += (cam.tz - cam.z) * Math.min(1, dtR * 2.5);
        cam.shake = Math.max(0, cam.shake - dtR * 2);
      }
      // ---- render
      const bq = P(ball.x, ball.y, ball.h) || { x: W / 2, y: H / 2 };
      cam.px += ((bq.x * .6 + W / 2 * .4) - cam.px) * .1; cam.py += ((Math.min(bq.y, H * .8) * .6 + H * .45 * .4) - cam.py) * .1;
      const z = cam.z, shx = cam.shake ? (Math.random() - .5) * 5 * cam.shake : 0, shy = cam.shake ? (Math.random() - .5) * 4 * cam.shake : 0;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cam.px - cam.px * z + shx), dpr * (cam.py - cam.py * z + shy));
      drawSky();
      drawStadium();
      drawFans(dtR);
      drawFlags();
      drawBanner();
      drawFlares(dtR);
      drawLED();
      drawPitch();
      drawGoalBack();
      // depth-sorted players + ball
      const list = players.slice().sort((a, b) => b.y - a.y);
      const ballBehind = ball.y > 105;
      if (ballBehind) drawBall();
      drawGoalFrame();
      let ballDrawn = ballBehind;
      for (const p of list) { if (!ballDrawn && ball.y > p.y) { drawBall(); ballDrawn = true; } drawPlayer(p); }
      if (!ballDrawn) drawBall();
      drawFloodlights();
      // screen-space layers
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vg = ctx.createRadialGradient(W / 2, H * .45, H * .3, W / 2, H * .5, H * .85);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,4,12,.6)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      drawCoach(dtR);
      if (cutA > 0) { ctx.fillStyle = `rgba(2,6,16,${cutA})`; ctx.fillRect(0, 0, W, H); }
      if (running && !single) raf = requestAnimationFrame(frame);
    }

    /* ---------------- lifecycle ---------------- */
    function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    function onVis() { if (document.hidden) stop(); else if (!paused) start(); }
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { es.forEach(e => { if (!e.isIntersecting) stop(); else if (!paused && !document.hidden) start(); }); }) : null;
    io && io.observe(canvas);
    document.addEventListener('visibilitychange', onVis);
    buildCrowd();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => buildCrowd());
    resetShape();
    run(genAttack());
    say('קדימה! לחץ גבוה!', 'shout'); coachDo('point', 2);

    return {
      play, say,
      setScore(h, a) { score = [h, a]; drawScoreboard(); },
      on(e, f) { (listeners[e] || (listeners[e] = [])).push(f); return this; },
      pause() { paused = true; stop(); },
      resume() { paused = false; if (!document.hidden) start(); },
      destroy() { stop(); ro.disconnect(); io && io.disconnect(); document.removeEventListener('visibilitychange', onVis); bubble && bubble.remove(); },
      _debug: { cam, players, ball, get T() { return T; }, step(n) { for (let i = 0; i < n; i++) frame(last + 16.7); } }
    };
  }
  window.createMatchScene = createMatchScene;
})();
