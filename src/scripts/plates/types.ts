export interface Env {
  /** Canvas size in CSS pixels; the context is already scaled by `dpr`. */
  W: number;
  H: number;
  /** Margins kept clear at the top and bottom of the canvas. */
  top: number;
  bottom: number;
  /** True in the wide home-page hero, where the lower left is given over to text. */
  wide: boolean;
  dpr: number;
  ink: string;
  mark: string;
  faint: string;
  muted: string;
  bg: string;
  sans: string;
}

export interface Picked {
  /** Readout shown above the figure. */
  html: string;
  /** Where to centre the readout, in CSS pixels. */
  x: number;
}

export interface Plate {
  /** Draw the whole picture. Called once per size or theme; the caller animates the reveal. */
  render(ctx: CanvasRenderingContext2D, env: Env): void;
  /** Draw the highlight for a pointer position on the (cleared) overlay and describe it. */
  pick(ctx: CanvasRenderingContext2D, env: Env, x: number, y: number): Picked | null;
}

/** Small seeded generator, so a picture is the same on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
