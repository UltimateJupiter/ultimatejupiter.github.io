// T²MLR. Tokens run left to right and layers bottom to top, on a plain grid of constant height.
// Besides the usual pass up each column, a middle-layer state is handed from one token down to an
// earlier layer of the next, so the middle of the stack becomes one long thread through time.
//
// Each hand-off is drawn as a long wavy stroke: it leaves the upper middle of one token heading
// forward, swings out past the next couple of columns, doubles back, and comes into the lower
// middle of the very next token. Every stroke connects neighbours, but because each swings wide
// they overlap into one rolling band. A tighter echo of each stroke runs inside it. The band
// warms from ink to orange as it carries more of the past.
// A drawing of the wiring, not to scale with any model.

import type { Env, Plate } from './types';

interface Grid {
  dx: number;
  cols: number;
  layers: number;
  lo: number;
  hi: number;
  x(t: number): number;
  /** height of layer l (may be fractional) at horizontal position x */
  y(x: number, l: number): number;
}

function grid(e: Env): Grid {
  const dx = e.wide ? 40 : 28;
  const layers = e.wide ? 14 : 9;
  const cols = Math.ceil(e.W / dx) + 2;
  const pad = 16;
  const plotH = e.H - e.top - e.bottom - 2 * pad;
  const swell = plotH * 0.06;
  const usable = plotH - 2 * swell;
  const x = (t: number) => (t - 0.5) * dx;
  // the whole sheet rises and falls a little across the page; its height never changes
  const y = (px: number, l: number) =>
    e.H - e.bottom - pad - swell - (l * usable) / (layers - 1) + Math.sin((px / e.W) * Math.PI * 1.7 + 0.5) * swell;
  return { dx, cols, layers, lo: Math.round(layers * 0.26), hi: Math.round(layers * 0.76), x, y };
}

const TAU = Math.PI * 2;
const SWEEP = 2.3; // how far, in columns, a hand-off swings out before it turns back

/** The hand-off into token t: out of the upper middle of t - 1, down into the lower middle of t. */
function handoff(ctx: CanvasRenderingContext2D, g: Grid, t: number, sweep = SWEEP) {
  const x0 = g.x(t - 1), x1 = g.x(t);
  const y0 = g.y(x0, g.hi), y1 = g.y(x1, g.lo);
  const d = g.dx * sweep;
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(x0 + d, y0, x1 - d, y1, x1, y1);
}

export const lattice: Plate = {
  render(ctx, e) {
    const g = grid(e);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const age = (t: number) => Math.min(1, Math.max(0, g.x(t) / e.W));
    const warm = ctx.createLinearGradient(0, 0, e.W, 0);
    warm.addColorStop(0, e.ink);
    warm.addColorStop(0.5, e.mark);
    warm.addColorStop(1, e.mark);

    // the grid: layers across, the ordinary pass up each column
    ctx.strokeStyle = e.ink;
    ctx.lineWidth = 0.9;
    for (let l = 0; l < g.layers; l++) {
      ctx.globalAlpha = l >= g.lo && l <= g.hi ? 0.12 : 0.07;
      ctx.beginPath();
      for (let px = -g.dx; px <= e.W + g.dx; px += 8) ctx[px === -g.dx ? 'moveTo' : 'lineTo'](px, g.y(px, l));
      ctx.stroke();
    }
    for (let t = 0; t < g.cols; t++) {
      const px = g.x(t);
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(px, g.y(px, 0));
      ctx.lineTo(px, g.y(px, g.layers - 1));
      ctx.stroke();
    }

    // the recurrence: a tighter echo of every hand-off first, then the hand-offs themselves
    for (let t = -2; t < g.cols + 3; t++) {
      ctx.strokeStyle = e.ink;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      handoff(ctx, g, t, SWEEP * 0.55);
      ctx.stroke();
    }
    for (let t = -2; t < g.cols + 3; t++) {
      const a = age(t);
      ctx.strokeStyle = warm;
      ctx.globalAlpha = 0.55 + 0.4 * a;
      ctx.lineWidth = 0.9 + 0.9 * Math.pow(a, 1.5);
      ctx.beginPath();
      handoff(ctx, g, t);
      ctx.stroke();
    }

    // the looped block of each column, and the layers it passes through
    ctx.fillStyle = e.ink;
    ctx.strokeStyle = e.ink;
    for (let t = 0; t < g.cols; t++) {
      const px = g.x(t);
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px, g.y(px, g.lo));
      ctx.lineTo(px, g.y(px, g.hi));
      ctx.stroke();
      for (let l = 0; l < g.layers; l++) {
        const end = l === g.lo || l === g.hi;
        const mid = l >= g.lo && l <= g.hi;
        ctx.globalAlpha = mid ? 1 : 0.4;
        ctx.beginPath();
        ctx.arc(px, g.y(px, l), end ? 2.6 : mid ? 1.4 : 1.1, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  // Pointing at a token follows its thread back through the tokens before it.
  pick(ctx, e, px) {
    const g = grid(e);
    const t = Math.min(g.cols - 1, Math.max(0, Math.round(px / g.dx + 0.5)));
    const back = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [color, width] of [[e.bg, 8], [e.ink, 2.2]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (let i = 0; i < back && t - i >= 0; i++) {
        ctx.globalAlpha = Math.pow(1 - i / back, 1.3);
        const cx = g.x(t - i);
        ctx.beginPath();
        ctx.moveTo(cx, g.y(cx, g.lo));
        ctx.lineTo(cx, g.y(cx, g.hi));
        handoff(ctx, g, t - i);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    return { html: `<b>token ${t + 1}</b> keeps a thread to every token before it`, x: g.x(t) };
  },
};
