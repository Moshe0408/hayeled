/* Prototype glue: screen switching, club badges, match moments, crowd audio. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const qs = new URLSearchParams(location.search);
  if (qs.has('shot')) document.body.classList.add('shot');

  /* ---------- club badges (generated SVG) ---------- */
  const CLUBS = {
    mta: { a: '#FFD21F', b: '#1546C9', ink: '#0A2A8A', l: 'מ', ring: '#1546C9' },
    bjr: { a: '#141414', b: '#FFD21F', ink: '#FFD21F', l: 'ב', ring: '#FFD21F' }
  };
  let bid = 0;
  function badge(key) {
    const c = CLUBS[key], id = 'bd' + (bid++);
    const sh = 'M20 1.5 37.5 6.5V22c0 11.5-7.5 18.8-17.5 22.5C10 40.8 2.5 33.5 2.5 22V6.5Z';
    return `<svg viewBox="0 0 40 46" width="100%" height="100%" aria-hidden="true"><defs>
      <clipPath id="${id}"><path d="${sh}"/></clipPath>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="${sh}" fill="${c.a}"/>
      <g clip-path="url(#${id})"><path d="M0 30 40 16V46H0Z" fill="${c.b}"/><rect width="40" height="46" fill="url(#${id}g)"/></g>
      <path d="${sh}" fill="none" stroke="${c.ring}" stroke-width="2.2"/>
      <path d="M20 5.3 35 9.6V22c0 9.6-6.2 15.8-15 19.3C11.2 37.8 5 31.6 5 22V9.6Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>
      <text x="20" y="28" text-anchor="middle" font-family="Rubik,Heebo,sans-serif" font-weight="900" font-size="19" fill="${key === 'mta' ? '#0A2A8A' : '#FFD21F'}" stroke="${key === 'mta' ? '#FFD21F' : '#141414'}" stroke-width="2.4" paint-order="stroke">${c.l}</text></svg>`;
  }
  $$('.badge-slot').forEach(el => { el.innerHTML = badge(el.dataset.badge); });

  /* ---------- screens ---------- */
  let titleScene = null, matchScene = null;
  function go(name) {
    $$('.screen').forEach(s => s.classList.toggle('is-active', s.dataset.screen === name));
    $$('.proto-nav button').forEach(b => b.classList.toggle('on', b.dataset.go === name));
    if (name === 'title') { titleScene = titleScene || createTitleScene($('#hero-canvas')); titleScene.start(); } else if (titleScene) titleScene.stop();
    if (name === 'match') { startMatch(); } else if (matchScene) matchScene.pause();
    try { history.replaceState(null, '', '?' + (qs.has('shot') ? 'shot&' : '') + 'screen=' + name); } catch (e) { }
  }
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  $$('.tchip').forEach(c => c.addEventListener('click', () => { $$('.tchip').forEach(x => x.classList.toggle('on', x === c)); }));

  /* ---------- match ---------- */
  const MOMENTS = [
    { kind: 'התקפה', min: 10, text: 'אחד על אחד באגף! <b>אזולאי</b> מול המגן של בית״ר.', choices: [
      { t: 'לעבור ולבעוט', s: 'כדרור פנימה ובעיטה לפינה', ic: 'i-shoot', odds: 'lo', lab: 'נמוך', p: .3, ev: 'dribble_shot' },
      { t: 'לעבור ולהגביה', s: 'לקו הרוחב והגבהה לרחבה', ic: 'i-cross', odds: 'mid', lab: 'בינוני', p: .45, ev: 'cross' },
      { t: 'להחזיר אחורה', s: 'מסירה חוזרת לקשר המגיע', ic: 'i-back', odds: 'hi', lab: 'גבוה', p: .6, ev: 'cutback' }] },
    { kind: 'הזדמנות', min: 34, text: 'כדור חוזר מגיע ל<b>אזולאי</b> מחוץ לרחבה. השוער יצא מהקו!', choices: [
      { t: 'לבעוט מיד', s: 'בעיטה חזקה מהמקום', ic: 'i-shoot', odds: 'mid', lab: 'בינוני', p: .4, ev: 'dribble_shot' },
      { t: 'לסובב לפינה', s: 'בעיטה מסובבת מעל השוער', ic: 'i-cross', odds: 'lo', lab: 'נמוך', p: .25, ev: 'dribble_shot' },
      { t: 'למסור לחלוץ', s: 'כדור עומק לאשכנזי', ic: 'i-back', odds: 'hi', lab: 'גבוה', p: .55, ev: 'cutback' }] }
  ];
  let mi = 0, score = [1, 0], minute = 10, busy = false;
  function renderMoment() {
    const m = MOMENTS[mi % MOMENTS.length];
    $('#m-kind').textContent = m.kind; $('#m-min').textContent = m.min + "'"; $('#m-idx').textContent = (mi % 4) + 1;
    $('#m-text').innerHTML = m.text;
    const ch = $('#choices'); ch.classList.remove('locked'); ch.innerHTML = '';
    m.choices.forEach(c => {
      const b = document.createElement('button'); b.className = 'choice';
      b.innerHTML = `<span class="ci"><svg class="i"><use href="#${c.ic}"/></svg></span><span class="ct"><b>${c.t}</b><small>${c.s}</small></span>
        <span class="odds ${c.odds}"><span class="sig"><i></i><i></i><i></i></span>${c.lab}</span>`;
      b.addEventListener('click', () => choose(c, b));
      ch.appendChild(b);
    });
    $('#result').className = 'result';
  }
  function choose(c, el) {
    if (busy || !matchScene) return; busy = true;
    el.classList.add('picked'); $('#choices').classList.add('locked');
    const forced = qs.get('outcome');
    const outcome = forced || (Math.random() < c.p ? 'goal' : (Math.random() < .6 ? 'save' : 'miss'));
    matchScene.say({ dribble_shot: 'יאללה, תן לו!', cross: 'תרים! תרים לרחבה!', cutback: 'תסתכל אחורה! יש לך!' }[c.ev], 'shout');
    matchScene.play(c.ev, outcome);
  }
  function onOutcome(o) {
    const r = $('#result');
    if (o === 'goal') {
      score[0]++; const sh = $('#sc-h'); sh.textContent = score[0]; sh.classList.remove('pop'); void sh.offsetWidth; sh.classList.add('pop');
      matchScene.setScore(score[0], score[1]);
      flash('גול!', ''); r.innerHTML = '<svg class="i"><use href="#i-ball"/></svg>גול! אזולאי מכניס את מכבי ל-' + score[0] + '-' + score[1] + '. ציון +0.8';
      r.className = 'result show goal'; addFeed('גול! אזולאי! הקהל בבלומפילד מתפוצץ.', true);
    } else {
      if (o === 'save') flash('הצלה!', 'save');
      r.innerHTML = '<svg class="i"><use href="#i-target"/></svg>' + (o === 'save' ? 'השוער של בית״ר עוצר. כמעט!' : 'החטאה. הכדור עף מעל המשקוף.');
      r.className = 'result show ' + o; addFeed(o === 'save' ? 'הצלה גדולה של שוער בית״ר מול אזולאי.' : 'אזולאי מחטיא מקרוב.', false);
    }
    setTimeout(() => { busy = false; mi++; renderMoment(); }, 3800);
  }
  function addFeed(t, g) {
    const d = document.createElement('div'); d.className = 'feed-i' + (g ? ' g' : '');
    d.innerHTML = `<span class="m">${MOMENTS[mi % MOMENTS.length].min}'</span><span>${t}</span>`; $('#feed').prepend(d);
  }
  function flash(t, cls) { const f = $('#goal-flash'); f.querySelector('b').textContent = t; f.className = 'goal-flash ' + cls; void f.offsetWidth; f.classList.add('show'); }
  function startMatch() {
    if (!matchScene) {
      matchScene = createMatchScene($('#match-canvas'), {
        home: { name: 'מכבי', shirt: '#FFD21F', shorts: '#1546C9', socks: '#FFD21F', trim: '#1546C9', gk: '#22C55E', fans: ['#FFD21F', '#FFD21F', '#1546C9', '#F4F4F4', '#FFE45C'] },
        away: { name: 'בית״ר', shirt: '#17181C', shorts: '#17181C', socks: '#FFD21F', trim: '#FFD21F', gk: '#FF7A1A' },
        chant: 'יאללה יאללה מכבי!',
        hero: 'אזולאי',
        seed: +(qs.get('seed') || 3)
      });
      matchScene.on('outcome', onOutcome);
      matchScene.on('beat', () => { const c = $('#chant'); c.classList.remove('beat'); void c.offsetWidth; c.classList.add('beat'); crowd.beat(); });
      matchScene.on('goal', () => crowd.roar(1));
      matchScene.on('chance', () => crowd.roar(.45));
      matchScene.setScore(score[0], score[1]);
      renderMoment();
    }
    matchScene.resume();
  }

  /* ---------- crowd audio (WebAudio noise; default muted) ---------- */
  const crowd = (function () {
    let ac = null, master, bed, roarG, on = false;
    function init() {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = .0; master.connect(ac.destination);
      const len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048; d[i] = (b0 + b1 + b2) * .6; }
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = .6;
      bed = ac.createGain(); bed.gain.value = .55;
      const bp2 = ac.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 1400; bp2.Q.value = .9;
      roarG = ac.createGain(); roarG.gain.value = 0;
      src.connect(bp).connect(bed).connect(master); src.connect(bp2).connect(roarG).connect(master); src.start();
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .18; lg.gain.value = .15; lfo.connect(lg).connect(bed.gain); lfo.start();
    }
    function toggle() {
      on = !on; if (!ac) init(); if (ac.state === 'suspended') ac.resume();
      master.gain.setTargetAtTime(on ? .5 : 0, ac.currentTime, .2); return on;
    }
    function roar(x) { if (!ac || !on) return; const t = ac.currentTime; roarG.gain.cancelScheduledValues(t); roarG.gain.setTargetAtTime(1.2 * x, t, .12); roarG.gain.setTargetAtTime(0, t + 1.6 * x + .4, .9); }
    function beat() {
      if (!ac || !on) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .18);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.7, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
      o.connect(g).connect(master); o.start(t); o.stop(t + .32);
    }
    return { toggle, roar, beat };
  })();
  $('#mute').addEventListener('click', e => {
    const on = crowd.toggle(); const b = e.currentTarget;
    b.classList.toggle('on', on); b.querySelector('use').setAttribute('href', on ? '#i-snd-on' : '#i-snd-off');
  });

  document.fonts && document.fonts.ready.then(() => { });
  go(qs.get('screen') || 'title');
  window.__proto = { go, get scene() { return matchScene; } };
})();
