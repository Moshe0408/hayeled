/* Prototype glue: screen switching, hub interactions, live-match wiring. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  if (params.has('shot')) document.body.classList.add('shot');

  let hero = null, scene = null;
  function go(id) {
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    $$('.proto-nav button').forEach(b => b.classList.toggle('on', b.dataset.go === id));
    if (id === 'title') { hero ? hero.resume() : (hero = createTitleScene($('#heroCanvas'))); } else if (hero) hero.pause();
    if (id === 'match') { scene ? scene.resume() : startMatch(); } else if (scene) scene.pause();
    $('#' + id).scrollTop = 0;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); go(b.dataset.go); } });

  // ---------------- hub: training chips
  const notes = ['קצת מהכול. התקדמות יציבה בכל התכונות.', 'דגש על סיומות: +בעיטה, מעט עייפות.', 'מסירות קצרות וכדרור: +מסירה, +כדרור.', 'ריצות ספרינט וכוח: +מהירות, +פיזיות, -אנרגיה.'];
  $$('#trainChips .train').forEach((b, i) => b.addEventListener('click', () => {
    $$('#trainChips .train').forEach(x => x.classList.toggle('on', x === b)); $('#trainNote').textContent = notes[i];
  }));

  // ---------------- live match
  const score = { h: 1, a: 0 };
  let clockS = 67 * 60 + 12, clockTimer = 0;
  function setScoreUI(side) {
    $('#sH').textContent = score.h; $('#sA').textContent = score.a;
    const el = side === 'h' ? $('#sH') : side === 'a' ? $('#sA') : null;
    if (el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }
  function startMatch() {
    scene = createMatchScene($('#matchCanvas'), {
      home: { name: 'מכבי ת״א', short: 'מכ״ת', shirt: '#FFD21F', shorts: '#0B3D91', trim: '#0B3D91', socks: '#FFD21F', keeper: '#2BD27A', fans: ['#FFD21F', '#FFD21F', '#0B3D91', '#FFFFFF'] },
      away: { name: 'בית״ר', short: 'בית״ר', shirt: '#F4F4F4', shorts: '#141414', trim: '#FFD21F', socks: '#141414', keeper: '#FF7A1A', fans: ['#FFD21F', '#141414'] },
      hero: { num: 9, name: 'אזולאי' },
      chant: 'יאללה יאללה מכבי!',
      onEvent(ev) {
        if (ev.type === 'goal') { if (ev.team === 'home') score.h++; else score.a++; setScoreUI(ev.team === 'home' ? 'h' : 'a'); scene.setScore(score.h, score.a); }
      },
    });
    scene.setScore(score.h, score.a);
    clockTimer = setInterval(() => { if (document.hidden) return; clockS++; $('#clock').textContent = `${Math.floor(clockS / 60)}:${String(clockS % 60).padStart(2, '0')}`; }, 1000);
  }
  // mute toggle (default muted)
  $('#muteBtn').addEventListener('click', () => {
    const on = scene && scene.toggleSound();
    $('#muteBtn use').setAttribute('href', on ? '#i-sound' : '#i-mute');
    $('#muteBtn').setAttribute('aria-label', on ? 'השתקת קול קהל' : 'הפעלת קול קהל');
  });
  // key-moment choices -> scene reacts
  const odds = { dribble: .32, cross: .5, recycle: .9 };
  $$('.choice').forEach(b => b.addEventListener('click', () => {
    if ($('#moment').dataset.done) return;
    const act = b.dataset.act; $('#moment').dataset.done = 1;
    $$('.choice').forEach(x => x.classList.toggle('picked', x === b)); $$('.choice').forEach(x => { if (x !== b) x.classList.add('dim'); });
    const forced = params.get('outcome');
    let outcome;
    if (act === 'recycle') outcome = 'keep';
    else outcome = forced || (Math.random() < odds[act] ? 'goal' : (Math.random() < .6 ? 'save' : 'miss'));
    scene.play(act, { outcome }).then(res => {
      const r = $('#result');
      const txt = { goal: 'גול! אזולאי הכניס את הקהל לטירוף. +1.2 לציון', save: 'השוער של בית״ר עף ומציל. +0.2 לציון', miss: 'מעל המשקוף... הקהל מחזיק את הראש. -0.3 לציון', keep: 'שמרת על הכדור. המאמן מרוצה. +0.1 לציון' }[res];
      r.className = 'result on ' + (res === 'keep' ? 'save' : res); r.textContent = txt;
      setTimeout(() => { delete $('#moment').dataset.done; $$('.choice').forEach(x => x.classList.remove('picked', 'dim')); r.className = 'result'; }, 6500);
    });
  }));

  // deep links for screenshots: ?screen=hub|match
  go(params.get('screen') || 'title');
  window.__proto = { go, get scene() { return scene; } };
})();
