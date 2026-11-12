// Gradient descent on L(a) = (a^2 - 1)^2 / 4, one column per step size.
//
// The update is a <- a - eta * a * (a^2 - 1). The minimum a = 1 has curvature (sharpness) 2, so it
// is stable only while eta < 2 / 2 = 1. Past that the iterates double in period, turn chaotic, spill
// across to the other minimum near eta = 1.6, and stay bounded up to eta = 2. Each column plots
// where the iterates are after the transient has died away. This one is computed, not stylised.

import type { Env, Plate } from './types';

const ETA_MAX = 2;
// The iterates never leave [-sqrt 2, sqrt 2], but the picture only shows the upper branch in full:
// the plot runs from A_TOP down to A_BOTTOM, and whatever spills below that fades out.
const A_TOP = 1.5;
const A_BOTTOM = -0.5;
const A_START = 0.5;
const SAMPLES = 240;

const step = (a: number, eta: number) => a - eta * a * (a * a - 1);
// Wide screens start at eta = 1/3 so the stable line runs above the name; narrow ones skip ahead.
const eta0 = (e: Env) => (e.wide ? 1 / 3 : 0.6);
const yAt = (e: Env, a: number) => e.top + ((A_TOP - a) / (A_TOP - A_BOTTOM)) * (e.H - e.top - e.bottom);

function settle(eta: number, burn: number, out: Float64Array) {
  let a = A_START;
  for (let i = 0; i < burn; i++) a = step(a, eta);
  for (let i = 0; i < out.length; i++) out[i] = a = step(a, eta);
}

/** Period of the settled orbit, or 0 if it does not repeat within 64 steps. */
function periodOf(s: Float64Array) {
  const half = s.length >> 1;
  for (let p = 1; p <= 64 && p <= half; p++) {
    let ok = true;
    for (let i = 0; i < half; i++) {
      if (Math.abs(s[i + p] - s[i]) > 1e-4) {
        ok = false;
        break;
      }
    }
    if (ok) return p;
  }
  return 0;
}

export const bifurcation: Plate = {
  // Each sample is a faint dot one device pixel wide, so a periodic orbit piles up into a solid
  // line and a chaotic one stays a mist whose density is the invariant measure.
  render(ctx, e) {
    const cols = Math.round(e.W * e.dpr);
    const px = 1 / e.dpr;
    const size = Math.max(1, Math.round(e.dpr * 0.9)) * px;
    const buf = new Float64Array(SAMPLES);
    const e0 = eta0(e);
    const dot = (i: number, a: number) => ctx.fillRect(i * px, Math.round(yAt(e, a) * e.dpr) * px - size / 2, px, size);
    for (let i = 0; i < cols; i++) {
      const eta = e0 + ((ETA_MAX - e0) * (i + 0.5)) / cols;
      // convergence is slow near eta = 1, so burn longer there
      settle(eta, Math.abs(eta - 1) < 0.05 ? 6000 : 600, buf);
      ctx.fillStyle = e.ink;
      ctx.globalAlpha = 0.13;
      for (let k = 0; k < SAMPLES; k++) if (buf[k] >= 0) dot(i, buf[k]);
      // iterates that have been thrown across to the other minimum
      ctx.fillStyle = e.mark;
      ctx.globalAlpha = 0.2;
      for (let k = 0; k < SAMPLES; k++) if (buf[k] < 0) dot(i, buf[k]);
    }
    // fade out what runs past the bottom of the plot, and cut everything below it
    const floor = e.H - e.bottom;
    const fade = ctx.createLinearGradient(0, floor - 90, 0, floor);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fade;
    ctx.fillRect(0, floor - 90, e.W, 90);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, floor, e.W, e.H - floor);
    ctx.globalCompositeOperation = 'source-over';

    // mark the fork: the step size at which the minimum stops being stable
    const x1 = ((1 - e0) / (ETA_MAX - e0)) * e.W;
    const y1 = yAt(e, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = e.muted;
    ctx.fillRect(Math.round(x1), y1 - 7, 1, 14);
    ctx.font = `500 12px ${e.sans}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const label = 'η = 2 / sharpness';
    // keep the label on the canvas when the fork is close to the left edge
    ctx.fillText(label, Math.max(x1 - 8, ctx.measureText(label).width + 6), y1 - 7);
  },

  pick(ctx, e, px) {
    const x = Math.min(e.W - 1, Math.max(0, px));
    const e0 = eta0(e);
    const eta = e0 + ((ETA_MAX - e0) * x) / e.W;
    // a long burn-in everywhere, so the description is right close to a bifurcation too
    const s = new Float64Array(160);
    settle(eta, 6000, s);
    const p = periodOf(s);

    const n = p || s.length;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, e.W, e.H - e.bottom);
    ctx.clip();
    ctx.fillStyle = e.mark;
    ctx.globalAlpha = p ? 1 : 0.55;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(x + 0.5, yAt(e, s[i]), p ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = e.ink;
    ctx.globalAlpha = p ? 1 : 0.7;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(x + 0.5, yAt(e, s[i]), p ? 2 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const what = p === 1 ? 'settles at the minimum' : p ? `cycles through ${p} values` : 'never settles';
    return { html: `<b>η = ${eta.toFixed(2)}</b> ${what}`, x };
  },
};
