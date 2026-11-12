// Fairness in assignment with uncertain priorities. Applicants along the top, seats along the
// bottom. With a certain priority order each applicant would get one thread to one seat. When
// the order itself is uncertain, a fair outcome is a lottery: each applicant's thread frays into
// several, weighted by chance. Some applicants are surer of their place than others.
// A drawing of the setting, not of a particular mechanism from the paper.

import { rng, type Env, type Plate } from './types';

interface Loom {
  n: number;
  xs: number[];
  yTop: number;
  yBot: number;
  /** w[i][j]: chance applicant i gets seat j (zero when negligible) */
  w: number[][];
}

function loom(e: Env): Loom {
  const r = rng(41);
  const n = e.wide ? 56 : 24;
  const xs = Array.from({ length: n }, (_, i) => ((i + 0.5) * e.W) / n);
  const w = xs.map((_, i) => {
    const centre = i + (r() - 0.5) * 9;
    const spread = 0.7 + r() * r() * 7; // most are fairly sure, a few are very unsure
    const row = xs.map((_, j) => Math.exp(-((j - centre) ** 2) / (2 * spread * spread)));
    const sum = row.reduce((s, v) => s + v, 0);
    return row.map((v) => (v / sum > 0.03 ? v / sum : 0));
  });
  return { n, xs, yTop: e.top + 12, yBot: e.H - e.bottom - 12, w };
}

function thread(ctx: CanvasRenderingContext2D, l: Loom, i: number, j: number) {
  const mid = (l.yTop + l.yBot) / 2;
  ctx.beginPath();
  ctx.moveTo(l.xs[i], l.yTop);
  ctx.bezierCurveTo(l.xs[i], mid, l.xs[j], mid, l.xs[j], l.yBot);
  ctx.stroke();
}

export const match: Plate = {
  render(ctx, e) {
    const l = loom(e);
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < l.n; i++) {
        const gold = i % 7 === 3;
        if (gold !== (pass === 1)) continue;
        ctx.strokeStyle = gold ? e.mark : e.ink;
        for (let j = 0; j < l.n; j++) {
          const p = l.w[i][j];
          if (!p) continue;
          ctx.globalAlpha = gold ? Math.min(1, 0.35 + p * 1.6) : Math.min(0.85, 0.12 + p * 1.3);
          ctx.lineWidth = 0.6 + p * 2.6;
          thread(ctx, l, i, j);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = e.ink;
    for (let i = 0; i < l.n; i++) {
      ctx.beginPath();
      ctx.arc(l.xs[i], l.yTop, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(l.xs[i] - 2.2, l.yBot - 2.2, 4.4, 4.4);
    }
  },

  // Pointing near the top picks an applicant and shows their lottery; near the bottom, a seat.
  pick(ctx, e, px, py) {
    const l = loom(e);
    let k = 0;
    for (let i = 1; i < l.n; i++) if (Math.abs(l.xs[i] - px) < Math.abs(l.xs[k] - px)) k = i;
    const seat = py > (l.yTop + l.yBot) / 2;
    let count = 0;
    ctx.lineCap = 'round';
    for (const [color, extra] of [[e.mark, 5], [e.ink, 0]] as const) {
      ctx.strokeStyle = color;
      for (let o = 0; o < l.n; o++) {
        const p = seat ? l.w[o][k] : l.w[k][o];
        if (!p) continue;
        if (!extra) count++;
        ctx.lineWidth = 0.8 + p * 2.6 + extra;
        if (seat) thread(ctx, l, o, k);
        else thread(ctx, l, k, o);
      }
    }
    const html = seat
      ? `<b>one seat</b> shared between ${count} applicant${count === 1 ? '' : 's'}`
      : `<b>one applicant</b> holds a lottery over ${count} seat${count === 1 ? '' : 's'}`;
    return { html, x: l.xs[k] };
  },
};
