// Seeded deterministic RNG (mulberry32). Pure: no DOM, no platform randomness except randomSeed().
// The whole state of a stream is one uint32, so it can be stored in the game state.

export function hash32(...parts) {
  const str = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let s = (Number(seed) >>> 0);
  const rng = {
    next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      if (max < min) { const x = min; min = max; max = x; }
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    float(min, max) {
      return min + rng.next() * (max - min);
    },
    chance(p) {
      return rng.next() < p;
    },
    pick(arr) {
      if (!arr || arr.length === 0) return undefined;
      return arr[Math.floor(rng.next() * arr.length)];
    },
    weighted(arr, fn) {
      if (!arr || arr.length === 0) return undefined;
      let total = 0;
      const w = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        const v = Number(fn(arr[i], i));
        w[i] = v > 0 && Number.isFinite(v) ? v : 0;
        total += w[i];
      }
      if (total <= 0) return rng.pick(arr);
      let r = rng.next() * total;
      for (let i = 0; i < arr.length; i++) {
        r -= w[i];
        if (r < 0) return arr[i];
      }
      for (let i = arr.length - 1; i >= 0; i--) if (w[i] > 0) return arr[i];
      return arr[arr.length - 1];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },
    normal(mean = 0, sd = 1) {
      const u1 = 1 - rng.next();
      const u2 = rng.next();
      return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
    poisson(lambda) {
      let l = Number(lambda);
      if (!(l > 0)) return 0;
      if (l > 10) l = 10;
      const L = Math.exp(-l);
      let k = 0, p = 1;
      do { k++; p *= rng.next(); } while (p > L);
      return k - 1;
    },
    getState() { return s >>> 0; },
    setState(u32) { s = (Number(u32) >>> 0); },
  };
  return rng;
}

export function rngFor(...parts) {
  return createRng(hash32(...parts));
}

export function randomSeed() {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === 'function') {
      const a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0] >>> 0;
    }
  } catch (e) { /* fall through */ }
  let perf = 0;
  try { perf = Math.floor((globalThis.performance?.now?.() || 0) * 1000); } catch (e) { perf = 0; }
  return (Date.now() ^ perf) >>> 0;
}
