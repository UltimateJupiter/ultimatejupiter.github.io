// Periodic weak spots, as a tiling. This one follows the paper's mechanism rather than its curves.
//
// Columns are token positions, cut into compression windows of eight. Rows are attention heads.
// A compressed head cannot keep a whole window: its gate weighs the eight slots, and what it
// weighs most is what survives. Every cell holds a square whose size is that weight, so the page
// is a halftone of the gates. The paper finds two kinds:
//   - static: the same slot in every window, so its heavy squares line up down the page with
//     period eight. An outlined square after each is the successor the head stores as its value.
//     These heads sit anywhere in the stack, in no particular order.
//   - input-dependent: a slot that changes with the content. Their squares scatter.
// A phase is retrievable only if some static head keeps it. Where none does, an orange shaft
// drops through that column to the strip along the bottom, which records the weak spots. The last slot of a window is always one, because a token there is cut
// off from its successor.
//
// Pointing at a head knocks it out, as in the paper's ablations: if it was the only head keeping
// its slot, a new shaft opens through that column in every window.
// The heads and their slots are made up; the logic is the paper's.

import { rng, type Env, type Plate } from './types';

const S = 8; // window length and stride

type Kind = 'static' | 'dynamic' | 'broad';
interface Head {
  kind: Kind;
  /** static: the slot it keeps */
  slot: number;
  /** dynamic: the slot it keeps in each window */
  slots: number[];
}

interface Tiling {
  c: number; // tile size
  x0: number;
  y0: number;
  cols: number;
  windows: number;
  heads: Head[];
  stripY: number;
}

// the slots static heads settle on; two of them share slot 3, slot 2 is left to no one
const SETTLED = [5, 3, 1, 3, 0, 4, 6];

function tiling(e: Env): Tiling {
  const r = rng(17);
  const plotH = e.H - e.top - e.bottom;
  const c = e.wide ? 22 : Math.max(8, Math.min(15, Math.floor(plotH / 13)));
  const rows = Math.max(4, Math.floor(plotH / c) - 2); // head rows; then a gap, then the strip
  const windows = Math.ceil(e.W / (c * S)) + 1;
  const cols = windows * S;
  const x0 = Math.round((e.W - cols * c) / 2);
  const y0 = Math.round(e.top + (plotH - (rows + 2) * c) / 2);
  const nStatic = Math.min(SETTLED.length, Math.max(3, Math.round(rows * 0.58)));
  // Static and input-dependent heads are mixed through the stack in no particular order, as in
  // a real model; only the first layer, which reads every slot, has a fixed place at the bottom.
  const order: (number | null)[] = [
    ...SETTLED.slice(0, nStatic),
    ...new Array<null>(Math.max(0, rows - 1 - nStatic)).fill(null),
  ];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const heads: Head[] = [];
  for (let row = 0; row < rows; row++) {
    const slots = Array.from({ length: windows }, () => Math.floor(r() * (S - 1)));
    const slot = order[row];
    if (row === rows - 1) heads.push({ kind: 'broad', slot: -1, slots });
    else if (slot != null) heads.push({ kind: 'static', slot, slots });
    else heads.push({ kind: 'dynamic', slot: -1, slots });
  }
  return { c, x0, y0, cols, windows, heads, stripY: y0 + (rows + 1) * c };
}

/** How many static heads keep each phase, optionally with one head knocked out. */
function coverage(t: Tiling, without = -1) {
  const kept = new Array<number>(S).fill(0);
  t.heads.forEach((h, i) => {
    if (h.kind === 'static' && i !== without) kept[h.slot]++;
  });
  return kept;
}

/** A square centred in its cell; `fill` is its side as a fraction of the cell. */
function tile(ctx: CanvasRenderingContext2D, t: Tiling, col: number, y: number, fill: number) {
  const side = Math.max(1.5, t.c * fill);
  const o = (t.c - side) / 2;
  ctx.fillRect(t.x0 + col * t.c + o, y + o, side, side);
}

/** How much a head's gate weighs slot i of window w. */
function weight(h: Head, w: number, i: number) {
  if (h.kind === 'broad') return 0.3;
  const d = Math.abs(i - (h.kind === 'static' ? h.slot : h.slots[w]));
  const peak = h.kind === 'static' ? 1 : 0.62;
  return d === 0 ? peak : d === 1 ? 0.16 : 0.035;
}

/** An orange shaft down one phase, through every window, ending in a tile on the strip. */
function shaft(ctx: CanvasRenderingContext2D, e: Env, t: Tiling, ph: number, strength: number) {
  ctx.fillStyle = e.mark;
  for (let w = 0; w < t.windows; w++) {
    const x = t.x0 + (w * S + ph) * t.c;
    ctx.globalAlpha = strength;
    ctx.fillRect(x, t.y0, t.c, t.stripY - t.y0);
    ctx.globalAlpha = 1;
    tile(ctx, t, w * S + ph, t.stripY, 0.84);
  }
}

export const phase: Plate = {
  render(ctx, e) {
    const t = tiling(e);
    const kept = coverage(t);
    // the weak phases first, so the tiles sit on top of their shafts
    for (let ph = 0; ph < S; ph++) if (!kept[ph] || ph === S - 1) shaft(ctx, e, t, ph, 0.13);

    // window boundaries
    ctx.fillStyle = e.ink;
    ctx.globalAlpha = 0.22;
    for (let w = 0; w <= t.windows; w++) ctx.fillRect(t.x0 + w * S * t.c, t.y0 - 6, 1, t.stripY + t.c + 12 - t.y0);

    t.heads.forEach((h, row) => {
      const y = t.y0 + row * t.c;
      ctx.fillStyle = e.ink;
      const strong = h.kind === 'static' ? 0.92 : h.kind === 'dynamic' ? 0.42 : 0.5;
      for (let col = 0; col < t.cols; col++) {
        const wgt = weight(h, Math.floor(col / S), col % S);
        // the slots a gate all but ignores are specks, so the heavy squares carry the pattern
        ctx.globalAlpha = wgt < 0.1 ? strong * 0.4 : strong;
        tile(ctx, t, col, y, 0.02 + 0.82 * Math.sqrt(wgt));
      }
      if (h.kind === 'static') {
        // the successor it stores as the value: an open square after each key
        ctx.strokeStyle = e.ink;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.7;
        const side = t.c * 0.84, o = (t.c - side) / 2;
        for (let w = 0; w < t.windows; w++) {
          ctx.strokeRect(t.x0 + (w * S + h.slot + 1) * t.c + o + 0.6, y + o + 0.6, side - 1.2, side - 1.2);
        }
      }
    });

    // the strip: a small mark under every phase some static head keeps
    ctx.fillStyle = e.ink;
    ctx.globalAlpha = 0.6;
    for (let col = 0; col < t.cols; col++) {
      const ph = col % S;
      if (kept[ph] && ph !== S - 1) tile(ctx, t, col, t.stripY, 0.22);
    }
    ctx.globalAlpha = 1;
  },

  pick(ctx, e, px, py) {
    const t = tiling(e);
    const row = Math.floor((py - t.y0) / t.c);
    const col = Math.floor((px - t.x0) / t.c);
    const kept = coverage(t);

    // over the strip: say what this phase is
    if (py >= t.stripY - t.c * 0.5) {
      if (col < 0 || col >= t.cols) return null;
      const ph = col % S;
      ctx.strokeStyle = e.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(t.x0 + col * t.c + 0.5, t.stripY + 0.5, t.c - 1, t.c - 1);
      const what =
        ph === S - 1
          ? 'the window boundary: cut off from its successor, always weak'
          : kept[ph]
            ? `kept by ${kept[ph]} head${kept[ph] > 1 ? 's' : ''}`
            : 'kept by no head: a weak spot';
      return { html: `<b>phase ${ph + 1} of ${S}</b> ${what}`, x: px };
    }

    if (row < 0 || row >= t.heads.length) return null;
    const h = t.heads[row];
    const y = t.y0 + row * t.c;
    // knock the head out: blank its row
    ctx.fillStyle = e.bg;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, y, e.W, t.c);
    ctx.globalAlpha = 1;
    ctx.fillStyle = e.ink;
    ctx.fillRect(0, y, e.W, 1);
    ctx.fillRect(0, y + t.c - 1, e.W, 1);

    let what: string;
    if (h.kind === 'static') {
      const alone = kept[h.slot] === 1;
      if (alone) {
        // the phase it alone kept is now a weak spot: a shaft opens through its column
        shaft(ctx, e, t, h.slot, 0.26);
      }
      what = alone
        ? `nothing else keeps slot ${h.slot + 1}, so phase ${h.slot + 1} becomes a weak spot`
        : `another head keeps slot ${h.slot + 1} too, so nothing is lost`;
    } else if (h.kind === 'dynamic') {
      what = 'its slot changes with the content, so no one phase suffers';
    } else {
      what = 'it reads every slot, so every phase suffers alike';
    }
    return { html: `<b>knock out this head</b> ${what}`, x: Math.min(e.W - 190, Math.max(190, px)) };
  },
};
