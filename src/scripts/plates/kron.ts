// Dissecting Hessian. The paper's conjecture is that a layer's Hessian is close to a Kronecker
// product of two much smaller matrices. A Kronecker product looks like this: a grid of blocks,
// every block the same small pattern, each scaled by one number. Dot size is magnitude, filled
// dots are positive and rings negative; the few dominant blocks are in orange.
// Both small matrices here are made up (low rank plus a little noise), as is the page-wide shape.

import { rng, type Env, type Plate } from './types';

const NB = 6; // the small repeated pattern is NB x NB

interface Quilt {
  cell: number;
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  a: number[][]; // block scales
  b: number[][]; // the repeated pattern
  top: number; // magnitude above which a block counts as dominant
}

function quilt(e: Env): Quilt {
  const r = rng(5);
  const cell = e.wide ? 9.5 : 7.5;
  const cols = Math.ceil(e.W / cell / NB) * NB;
  const rows = Math.max(NB, Math.floor((e.H - e.top - e.bottom) / cell / NB) * NB);
  const x0 = (e.W - cols * cell) / 2;
  const y0 = e.top + (e.H - e.top - e.bottom - rows * cell) / 2;
  const vec = (n: number, wave: number) =>
    Array.from({ length: n }, (_, i) => Math.cos(i * wave + r() * 0.8) * (0.4 + 0.6 * r()));
  // low rank: two outer products
  const u1 = vec(NB, 1.1), u2 = vec(NB, 2.3);
  const b = u1.map((p, i) => u1.map((q, j) => p * q + 0.55 * u2[i] * u2[j]));
  const br = rows / NB, bc = cols / NB;
  const p1 = vec(br, 0.9), q1 = vec(bc, 0.37), p2 = vec(br, 2.1), q2 = vec(bc, 0.83);
  const a = p1.map((p, i) => q1.map((q, j) => p * q + 0.5 * p2[i] * q2[j] + (r() - 0.5) * 0.12));
  const norm = (m: number[][]) => {
    const mx = Math.max(...m.flat().map(Math.abs));
    return m.map((row) => row.map((v) => v / mx));
  };
  const an = norm(a);
  const mags = an.flat().map(Math.abs).sort((x, y) => y - x);
  return { cell, x0, y0, cols, rows, a: an, b: norm(b), top: mags[Math.floor(mags.length * 0.05)] };
}

export const kron: Plate = {
  render(ctx, e) {
    const q = quilt(e);
    ctx.lineWidth = 1;
    for (let i = 0; i < q.rows; i++) {
      for (let j = 0; j < q.cols; j++) {
        const scale = q.a[Math.floor(i / NB)][Math.floor(j / NB)];
        const v = scale * q.b[i % NB][j % NB];
        const m = Math.abs(v);
        if (m < 0.002) continue;
        const rad = q.cell * 0.5 * Math.min(1, Math.pow(m, 0.33));
        const color = Math.abs(scale) >= q.top ? e.mark : e.ink;
        ctx.beginPath();
        ctx.arc(q.x0 + (j + 0.5) * q.cell, q.y0 + (i + 0.5) * q.cell, Math.max(0.5, rad - 0.5), 0, Math.PI * 2);
        if (v > 0) {
          ctx.fillStyle = color;
          ctx.globalAlpha = color === e.mark ? 1 : 0.88;
          ctx.fill();
        } else {
          ctx.strokeStyle = color;
          ctx.globalAlpha = color === e.mark ? 1 : 0.6;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  },

  // Pointing at one entry shows the same entry in every other block.
  pick(ctx, e, px, py) {
    const q = quilt(e);
    const j = Math.floor((px - q.x0) / q.cell), i = Math.floor((py - q.y0) / q.cell);
    if (i < 0 || j < 0 || i >= q.rows || j >= q.cols) return null;
    ctx.fillStyle = e.mark;
    ctx.globalAlpha = 0.6;
    for (let bi = i % NB; bi < q.rows; bi += NB) {
      for (let bj = j % NB; bj < q.cols; bj += NB) {
        ctx.fillRect(q.x0 + bj * q.cell, q.y0 + bi * q.cell, q.cell, q.cell);
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = e.mark;
    ctx.lineWidth = 2;
    const size = NB * q.cell;
    ctx.strokeRect(q.x0 + Math.floor(j / NB) * size, q.y0 + Math.floor(i / NB) * size, size, size);
    return { html: '<b>one entry</b> sits in the same place in every block, only rescaled', x: px };
  },
};
