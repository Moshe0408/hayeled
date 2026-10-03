// Fixture generation: round robins, split groups, cup pairing, European league-phase draw.

// Returns rounds: [[h, a], ...][] ; cycles 1..3 (even cycles mirror home/away).
export function roundRobin(ids, cycles, rng) {
  const t = ids.slice();
  if (rng) rng.shuffle(t);
  if (t.length % 2 === 1) t.push(null);
  const n = t.length;
  const half = n / 2;
  const base = [];
  let arr = t.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      // alternate home/away round by round (circle method; at most one double home/away when a team changes half)
      const flip = r % 2 === 1;
      pairs.push(flip ? [b, a] : [a, b]);
    }
    base.push(pairs);
    arr = [arr[0], arr[n - 1]].concat(arr.slice(1, n - 1));
  }
  const rounds = [];
  for (let c = 0; c < cycles; c++) {
    for (const pr of base) rounds.push(c % 2 === 0 ? pr.map((p) => [p[0], p[1]]) : pr.map((p) => [p[1], p[0]]));
  }
  return rounds;
}

export function splitGroups(rankedIds, groups) {
  return groups.map((g) => rankedIds.slice(g.from - 1, g.to));
}

// Random pairing of an even list -> [[a, b], ...]
export function cupBracket(ids, rng) {
  const t = ids.slice();
  rng.shuffle(t);
  const out = [];
  for (let i = 0; i + 1 < t.length; i += 2) out.push([t[i], t[i + 1]]);
  return out;
}

// Edge colouring with Kempe-chain repair. edges: [u, v][] over vertex indices; k colours.
function colourEdges(nv, edges, k, rng, maxRestarts) {
  let best = null, bestBad = Infinity;
  for (let attempt = 0; attempt < maxRestarts; attempt++) {
    const order = edges.map((_, i) => i);
    if (attempt > 0) rng.shuffle(order);
    const col = new Array(edges.length).fill(-1);
    const at = [];
    for (let v = 0; v < nv; v++) at.push(new Array(k).fill(-1));
    let bad = 0;
    const other = (e, x) => (edges[e][0] === x ? edges[e][1] : edges[e][0]);
    for (const e of order) {
      const [u, v] = edges[e];
      let c = -1;
      for (let x = 0; x < k; x++) if (at[u][x] < 0 && at[v][x] < 0) { c = x; break; }
      if (c < 0) {
        let done = false;
        const freeU = [], freeV = [];
        for (let x = 0; x < k; x++) { if (at[u][x] < 0) freeU.push(x); if (at[v][x] < 0) freeV.push(x); }
        for (const alpha of freeU) {
          for (const beta of freeV) {
            if (alpha === beta) continue;
            // path from v alternating alpha, beta
            const path = [];
            let x = v, cc = alpha, reachedU = false, guard = 0;
            while (at[x][cc] >= 0 && guard++ < 400) {
              const e2 = at[x][cc];
              path.push(e2);
              x = other(e2, x);
              if (x === u) { reachedU = true; break; }
              cc = cc === alpha ? beta : alpha;
            }
            if (reachedU || guard >= 400) continue;
            for (const e2 of path) { const [a, b] = edges[e2]; at[a][col[e2]] = -1; at[b][col[e2]] = -1; }
            for (const e2 of path) {
              const nc = col[e2] === alpha ? beta : alpha;
              col[e2] = nc;
              const [a, b] = edges[e2];
              at[a][nc] = e2; at[b][nc] = e2;
            }
            if (at[u][alpha] < 0 && at[v][alpha] < 0) { c = alpha; done = true; break; }
          }
          if (done) break;
        }
        if (c < 0) {
          bad++;
          // least-conflict colour
          let bx = 0, bs = Infinity;
          for (let x = 0; x < k; x++) {
            const s = (at[u][x] >= 0 ? 1 : 0) + (at[v][x] >= 0 ? 1 : 0);
            if (s < bs) { bs = s; bx = x; }
          }
          col[e] = bx;
          if (at[u][bx] < 0) at[u][bx] = e;
          if (at[v][bx] < 0) at[v][bx] = e;
          continue;
        }
      }
      col[e] = c; at[u][c] = e; at[v][c] = e;
    }
    if (bad < bestBad) { best = col; bestBad = bad; }
    if (bad === 0) break;
  }
  return best;
}

// ids36 -> { pots: id[][], fx: [md, h, a, null, null][] }
export function leaguePhaseDraw(ids36, strengthFn, rng) {
  const sorted = ids36.slice().sort((a, b) => (strengthFn(b) - strengthFn(a)) || (a < b ? -1 : a > b ? 1 : 0));
  const pots = [0, 1, 2, 3].map((p) => sorted.slice(p * 9, p * 9 + 9));
  const games = [];
  for (let a = 0; a < 4; a++) {
    for (let b = a; b < 4; b++) {
      if (a === b) {
        const perm = rng.shuffle(pots[a].slice());
        for (let i = 0; i < 9; i++) games.push([perm[i], perm[(i + 1) % 9]]);
      } else {
        const pi = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        for (let i = 0; i < 9; i++) {
          games.push([pots[a][i], pots[b][pi[i]]]);
          games.push([pots[b][pi[(i + 1) % 9]], pots[a][i]]);
        }
      }
    }
  }
  const idx = {};
  sorted.forEach((id, i) => { idx[id] = i; });
  const edges = games.map((g) => [idx[g[0]], idx[g[1]]]);
  const col = colourEdges(sorted.length, edges, 8, rng, 200);
  const fx = games.map((g, i) => [col[i] + 1, g[0], g[1], null, null]);
  fx.sort((x, y) => (x[0] - y[0]) || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
  return { pots, fx };
}
