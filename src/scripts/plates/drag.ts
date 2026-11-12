// Contextual drag. Lines of reasoning cross the page from the left. A wrong attempt (an orange
// mark) acts on whatever passes after it: lines near its level are pulled toward it and stay
// displaced, gathering into a wake. Nothing upstream of a mark is affected.
// A drawing of the phenomenon, not of the paper's data.

import { rng, type Env, type Plate } from './types';

interface Mark {
  x: number;
  y: number;
  s: number; // strength
  r: number; // vertical reach
}

function marks(e: Env): Mark[] {
  const r = rng(29);
  const plotH = e.H - e.top - e.bottom;
  const n = e.wide ? 7 : 4;
  return Array.from({ length: n }, (_, i) => ({
    x: e.W * (0.1 + (0.8 * (i + 0.2 + r() * 0.6)) / n),
    y: e.top + plotH * (0.12 + 0.76 * r()),
    s: 0.55 + r() * 0.45,
    r: plotH * (0.09 + r() * 0.08),
  }));
}

/** One line: its height at every `STEP` px, given the marks it passes. */
const STEP = 4;
function line(e: Env, y0: number, ms: Mark[]) {
  const ys: number[] = [];
  let y = y0;
  for (let x = -8; x <= e.W + 8; x += STEP) {
    let dy = 0;
    for (const m of ms) {
      const d = x - m.x;
      if (d <= 0) continue;
      const near = Math.exp(-((y - m.y) ** 2) / (2 * m.r * m.r));
      // the pull switches on just past the mark and fades slowly with distance
      dy += m.s * (m.y - y) * near * (1 - Math.exp(-d / 30)) * Math.exp(-d / 520);
    }
    y += dy * 0.0085 * STEP;
    ys.push(y);
  }
  return ys;
}

const starts = (e: Env) => {
  const gap = e.wide ? 6.5 : 6;
  const out: number[] = [];
  for (let y = e.top + 4; y < e.H - e.bottom - 2; y += gap) out.push(y);
  return out;
};

function stroke(ctx: CanvasRenderingContext2D, ys: number[], from = 0) {
  ctx.beginPath();
  for (let i = from; i < ys.length; i++) ctx[i === from ? 'moveTo' : 'lineTo'](-8 + i * STEP, ys[i]);
  ctx.stroke();
}

function cross(ctx: CanvasRenderingContext2D, e: Env, m: Mark) {
  ctx.fillStyle = e.mark;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 5 + 4 * m.s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = e.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(m.x - 3, m.y - 3);
  ctx.lineTo(m.x + 3, m.y + 3);
  ctx.moveTo(m.x + 3, m.y - 3);
  ctx.lineTo(m.x - 3, m.y + 3);
  ctx.stroke();
}

export const drag: Plate = {
  render(ctx, e) {
    const ms = marks(e);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = e.ink;
    starts(e).forEach((y0, i) => {
      const ys = line(e, y0, ms);
      const moved = Math.abs(ys[ys.length - 1] - y0);
      // lines that were pulled furthest are drawn heaviest
      ctx.globalAlpha = Math.min(0.85, 0.3 + moved / 60);
      ctx.lineWidth = i % 6 === 0 ? 1.15 : 0.85;
      stroke(ctx, ys);
    });
    ctx.globalAlpha = 1;
    for (const m of ms) cross(ctx, e, m);
  },

  // Pointing drops one more wrong attempt and shows which lines it would bend.
  pick(ctx, e, px, py) {
    const ms = marks(e);
    const extra: Mark = { x: px, y: py, s: 0.8, r: (e.H - e.top - e.bottom) * 0.085 };
    const from = Math.max(0, Math.floor((px + 8) / STEP));
    ctx.lineJoin = 'round';
    ctx.strokeStyle = e.mark;
    ctx.lineWidth = 1.7;
    let bent = 0;
    for (const y0 of starts(e)) {
      const a = line(e, y0, ms);
      const b = line(e, y0, [...ms, extra]);
      let shift = 0;
      for (let i = from; i < a.length; i++) shift = Math.max(shift, Math.abs(a[i] - b[i]));
      if (shift < 4) continue;
      bent++;
      ctx.globalAlpha = Math.min(1, 0.3 + shift / 40);
      stroke(ctx, b, from);
    }
    ctx.globalAlpha = 1;
    cross(ctx, e, extra);
    return { html: `<b>a wrong attempt here</b> bends ${bent} of the lines that follow`, x: px };
  },
};
