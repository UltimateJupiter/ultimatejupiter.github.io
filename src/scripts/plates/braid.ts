// Context-enhanced learning. The paper's task is a translation in several steps: a sequence is
// rewritten by one phrasebook after another. Here every strand is a token crossing the page, and
// each column of dots is a phrasebook that shuffles the strands a little.
// A drawing of the task's shape, not of any particular phrasebook.

import { rng, type Env, type Plate } from './types';

interface Weave {
  xs: number[];
  ys: number[];
  /** pos[k][s]: slot of strand s at column k */
  pos: number[][];
}

function weave(e: Env): Weave {
  const r = rng(7);
  const n = e.wide ? 52 : 26;
  const stages = e.wide ? 8 : 5;
  const pad = 14;
  const plotH = e.H - e.top - e.bottom - 2 * pad;
  const ys = Array.from({ length: n }, (_, i) => e.top + pad + (i * plotH) / (n - 1));
  const xs = Array.from({ length: stages + 1 }, (_, k) => -30 + (k * (e.W + 60)) / stages);
  const pos: number[][] = [Array.from({ length: n }, (_, i) => i)];
  for (let k = 0; k < stages; k++) {
    const prev = pos[k];
    // nudge every strand by a few slots and re-rank: a local shuffle, never a long jump
    const keyed = prev.map((p, s) => ({ s, key: p + (r() - 0.5) * 9 }));
    keyed.sort((a, b) => a.key - b.key);
    const next = new Array<number>(n);
    keyed.forEach((o, rank) => (next[o.s] = rank));
    pos.push(next);
  }
  return { xs, ys, pos };
}

function trace(ctx: CanvasRenderingContext2D, w: Weave, s: number) {
  ctx.beginPath();
  ctx.moveTo(w.xs[0], w.ys[w.pos[0][s]]);
  for (let k = 0; k < w.xs.length - 1; k++) {
    const xm = (w.xs[k] + w.xs[k + 1]) / 2;
    ctx.bezierCurveTo(xm, w.ys[w.pos[k][s]], xm, w.ys[w.pos[k + 1][s]], w.xs[k + 1], w.ys[w.pos[k + 1][s]]);
  }
}

/** Height of strand s at horizontal position x (the curve's x is monotone, so bisect on t). */
function heightAt(w: Weave, s: number, x: number) {
  let k = 0;
  while (k < w.xs.length - 2 && x > w.xs[k + 1]) k++;
  const x0 = w.xs[k], x1 = w.xs[k + 1], xm = (x0 + x1) / 2;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    const u = 1 - t;
    const xt = u * u * u * x0 + 3 * u * t * xm + t * t * t * x1;
    if (xt < x) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2, u = 1 - t;
  const y0 = w.ys[w.pos[k][s]], y1 = w.ys[w.pos[k + 1][s]];
  return u * u * (u + 3 * t) * y0 + t * t * (t + 3 * u) * y1;
}

export const braid: Plate = {
  render(ctx, e) {
    const w = weave(e);
    const n = w.ys.length;
    ctx.strokeStyle = e.ink;
    ctx.lineCap = 'round';
    const gold = (s: number) => s % 9 === 4;
    for (let s = 0; s < n; s++) {
      if (gold(s)) continue;
      const heavy = s % 4 === 1;
      ctx.globalAlpha = heavy ? 0.85 : 0.3;
      ctx.lineWidth = heavy ? 1.2 : 0.9;
      trace(ctx, w, s);
      ctx.stroke();
    }
    // a few tokens picked out, so the eye can follow a path through the shuffles
    ctx.strokeStyle = e.mark;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.8;
    for (let s = 0; s < n; s++) {
      if (!gold(s)) continue;
      trace(ctx, w, s);
      ctx.stroke();
    }
    // the phrasebooks
    ctx.fillStyle = e.ink;
    for (let k = 1; k < w.xs.length - 1; k++) {
      ctx.globalAlpha = 0.16;
      ctx.fillRect(Math.round(w.xs[k]), w.ys[0] - 8, 1, w.ys[n - 1] - w.ys[0] + 16);
      ctx.globalAlpha = 1;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(w.xs[k] + 0.5, w.ys[i], 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  // Pointing follows one token all the way across.
  pick(ctx, e, px, py) {
    const w = weave(e);
    let best = 0, dist = Infinity;
    for (let s = 0; s < w.ys.length; s++) {
      const d = Math.abs(heightAt(w, s, px) - py);
      if (d < dist) {
        dist = d;
        best = s;
      }
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = e.mark;
    ctx.lineWidth = 8;
    trace(ctx, w, best);
    ctx.stroke();
    ctx.strokeStyle = e.ink;
    ctx.lineWidth = 1.6;
    trace(ctx, w, best);
    ctx.stroke();
    return { html: `<b>one token</b> rewritten ${w.xs.length - 2} times on its way across`, x: px };
  },
};
