// Hero figure: level sets of a slowly drifting 2-D "loss landscape", with a handful of
// heavy-ball gradient-descent particles rolling around on it. The pointer digs a well
// into the landscape; clicking drops a new particle.

type Well = { bx: number; by: number; rx: number; ry: number; w: number; ph: number; a: number; s: number };
type Particle = {
  x: number; y: number; vx: number; vy: number;
  lr: number; beta: number;
  trail: number[]; still: number; age: number; alpha: number; dying: boolean;
};

const GRID = 14; // css px between samples
const LEVEL0 = -3;
const LEVEL_STEP = 0.1;
const TRAIL = 70;
const MAX_PARTICLES = 9;
const NOISE = 1.6;
const MOUSE_A = 0.7; // depth of the basin under the pointer
const MOUSE_S = 0.07;
const MOUSE_IDLE_MS = 1800; // the basin fills back in once the pointer rests

export function mountLandscape(canvas: HTMLCanvasElement, dots: HTMLCanvasElement, host: HTMLElement) {
  const ctx = canvas.getContext('2d')!;
  const dctx = dots.getContext('2d')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1, aspect = 1, nx = 0, ny = 0;
  let field = new Float32Array(0);
  let wells: Well[] = [];
  const particles: Particle[] = [];
  const mouse = { x: 0, y: 0, k: 0, target: 0, moved: 0 };
  let ink = '#000', accent = '#f00', dark = false;
  let t = 0, running = true, visible = true;

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    ink = s.getPropertyValue('--ink').trim();
    accent = s.getPropertyValue('--accent').trim();
    dark = s.colorScheme === 'dark';
  }

  function makeWells() {
    // A few basins and ridges spread across the canvas, each wandering on a small ellipse.
    const spec = [-1.25, -1.0, -0.85, -0.7, 0.75, 0.6, 0.5];
    wells = spec.map((a, i) => ({
      bx: aspect * ((i + 0.5) / spec.length + rand(-0.06, 0.06)),
      by: rand(0.18, 0.82),
      rx: rand(0.05, 0.16) * aspect * 0.5,
      ry: rand(0.04, 0.12),
      w: rand(0.06, 0.14) * (Math.random() < 0.5 ? -1 : 1),
      ph: rand(0, Math.PI * 2),
      a,
      s: a < 0 ? rand(0.13, 0.22) : rand(0.08, 0.14),
    }));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const [c, x] of [[canvas, ctx], [dots, dctx]] as const) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const newAspect = W / H;
    if (!wells.length || Math.abs(newAspect - aspect) > 0.25) {
      aspect = newAspect;
      makeWells();
    }
    aspect = newAspect;
    nx = Math.ceil(W / GRID) + 1;
    ny = Math.ceil(H / GRID) + 1;
    field = new Float32Array(nx * ny);
    if (reduce) frame();
  }

  // Centres of the wells at time t (world units: height = 1, width = aspect).
  const cx = (w: Well) => w.bx + w.rx * Math.cos(w.w * t + w.ph);
  const cy = (w: Well) => w.by + w.ry * Math.sin(w.w * 1.3 * t + w.ph);

  function potential(x: number, y: number) {
    let f = 0.35 * ((x - aspect / 2) ** 2 / (aspect * aspect * 0.25) + (y - 0.5) ** 2 * 1.2);
    for (const w of wells) {
      const dx = x - cx(w), dy = y - cy(w);
      f += w.a * Math.exp(-(dx * dx + dy * dy) / (2 * w.s * w.s));
    }
    if (mouse.k > 0.001) {
      const dx = x - mouse.x, dy = y - mouse.y, s = MOUSE_S;
      f -= MOUSE_A * mouse.k * Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
    }
    return f;
  }

  function gradient(x: number, y: number): [number, number] {
    let gx = (0.7 * (x - aspect / 2)) / (aspect * aspect * 0.25);
    let gy = 0.84 * (y - 0.5);
    for (const w of wells) {
      const dx = x - cx(w), dy = y - cy(w), s2 = w.s * w.s;
      const e = w.a * Math.exp(-(dx * dx + dy * dy) / (2 * s2));
      gx -= (e * dx) / s2;
      gy -= (e * dy) / s2;
    }
    if (mouse.k > 0.001) {
      const dx = x - mouse.x, dy = y - mouse.y, s2 = MOUSE_S * MOUSE_S;
      const e = -MOUSE_A * mouse.k * Math.exp(-(dx * dx + dy * dy) / (2 * s2));
      gx -= (e * dx) / s2;
      gy -= (e * dy) / s2;
    }
    return [gx, gy];
  }

  function spawn(x?: number, y?: number, sharp = false): Particle {
    return {
      x: x ?? rand(0.05, 0.95) * aspect,
      y: y ?? rand(0.05, 0.95),
      vx: 0, vy: 0,
      // Most particles use momentum; the "sharp" one runs plain GD with a large step and
      // rattles across narrow basins instead of settling (a nod to edge-of-stability).
      lr: sharp ? 0.045 : rand(0.0001, 0.00018),
      beta: sharp ? 0 : rand(0.94, 0.97),
      trail: [], still: 0, age: 0, alpha: 0, dying: false,
    };
  }

  function stepParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const [gx, gy] = gradient(p.x, p.y);
      // a little minibatch noise keeps them exploring instead of freezing in the first basin
      const noise = p.beta === 0 ? 0 : NOISE;
      p.vx = p.beta * p.vx - p.lr * (gx + noise * gauss());
      p.vy = p.beta * p.vy - p.lr * (gy + noise * gauss());
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 0.02) (p.vx *= 0.02 / sp), (p.vy *= 0.02 / sp);
      p.x += p.vx;
      p.y += p.vy;
      p.age++;
      p.trail.push(p.x, p.y);
      if (p.trail.length > TRAIL * 2) p.trail.splice(0, 2);

      p.still = sp < 0.0006 ? p.still + 1 : 0;
      const out = p.x < -0.1 || p.x > aspect + 0.1 || p.y < -0.1 || p.y > 1.1;
      if (p.still > 240 || p.age > 60 * 24 || out) p.dying = true;
      p.alpha = p.dying ? p.alpha - 0.02 : Math.min(1, p.alpha + 0.03);
      if (p.dying && p.alpha <= 0) {
        const wasSharp = p.beta === 0;
        particles.splice(i, 1);
        if (particles.length < 6) particles.push(spawn(undefined, undefined, wasSharp));
      }
    }
  }

  function sampleField() {
    const S = H; // world -> px scale
    for (let j = 0; j < ny; j++) {
      const y = (j * GRID) / S;
      for (let i = 0; i < nx; i++) field[j * nx + i] = potential((i * GRID) / S, y);
    }
  }

  function drawContours() {
    const minor: number[] = [];
    const major: number[] = [];
    const lerp = (v0: number, v1: number, L: number) => (L - v0) / (v1 - v0);

    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = field[j * nx + i], b = field[j * nx + i + 1];
        const c = field[(j + 1) * nx + i + 1], d = field[(j + 1) * nx + i];
        const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
        const k0 = Math.ceil((lo - LEVEL0) / LEVEL_STEP), k1 = Math.floor((hi - LEVEL0) / LEVEL_STEP);
        const x0 = i * GRID, y0 = j * GRID;
        for (let k = k0; k <= k1; k++) {
          const L = LEVEL0 + k * LEVEL_STEP;
          const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const T = () => [x0 + GRID * lerp(a, b, L), y0];
          const R = () => [x0 + GRID, y0 + GRID * lerp(b, c, L)];
          const B = () => [x0 + GRID * lerp(d, c, L), y0 + GRID];
          const Lf = () => [x0, y0 + GRID * lerp(a, d, L)];
          const out = k % 5 === 0 ? major : minor;
          const seg = (p: number[], q: number[]) => out.push(p[0], p[1], q[0], q[1]);
          switch (idx) {
            case 1: case 14: seg(Lf(), B()); break;
            case 2: case 13: seg(B(), R()); break;
            case 3: case 12: seg(Lf(), R()); break;
            case 4: case 11: seg(T(), R()); break;
            case 6: case 9: seg(T(), B()); break;
            case 7: case 8: seg(Lf(), T()); break;
            case 5: seg(Lf(), B()); seg(T(), R()); break;
            case 10: seg(Lf(), T()); seg(B(), R()); break;
          }
        }
      }
    }
    const stroke = (segs: number[], alpha: number, width: number) => {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      for (let s = 0; s < segs.length; s += 4) {
        ctx.moveTo(segs[s], segs[s + 1]);
        ctx.lineTo(segs[s + 2], segs[s + 3]);
      }
      ctx.stroke();
    };
    stroke(minor, dark ? 0.13 : 0.11, 0.8);
    stroke(major, dark ? 0.3 : 0.26, 0.9);
  }

  function drawParticles() {
    const S = H;
    dctx.clearRect(0, 0, W, H);
    dctx.lineCap = 'round';
    for (const p of particles) {
      const n = p.trail.length / 2;
      dctx.strokeStyle = accent;
      dctx.lineWidth = 1.2;
      for (let s = 1; s < n; s++) {
        dctx.globalAlpha = p.alpha * (s / n) * 0.85;
        dctx.beginPath();
        dctx.moveTo(p.trail[(s - 1) * 2] * S, p.trail[(s - 1) * 2 + 1] * S);
        dctx.lineTo(p.trail[s * 2] * S, p.trail[s * 2 + 1] * S);
        dctx.stroke();
      }
      dctx.globalAlpha = p.alpha;
      dctx.fillStyle = accent;
      dctx.beginPath();
      dctx.arc(p.x * S, p.y * S, 2.6, 0, Math.PI * 2);
      dctx.fill();
    }
    // Cursor marker: a small open circle that fades with the well.
    if (mouse.k > 0.02) {
      dctx.globalAlpha = mouse.k * 0.7;
      dctx.strokeStyle = accent;
      dctx.lineWidth = 1;
      dctx.beginPath();
      dctx.arc(mouse.x * S, mouse.y * S, 7, 0, Math.PI * 2);
      dctx.stroke();
    }
    dctx.globalAlpha = 1;
  }

  function frame() {
    if (performance.now() - mouse.moved > MOUSE_IDLE_MS) mouse.target = 0;
    mouse.k += (mouse.target - mouse.k) * 0.05;
    ctx.clearRect(0, 0, W, H);
    sampleField();
    drawContours();
    if (!reduce) {
      stepParticles();
      drawParticles();
    }
  }

  let last = performance.now();
  function loop(now: number) {
    if (running && visible) {
      t += Math.min(now - last, 50) / 1000;
      frame();
    }
    last = now;
    requestAnimationFrame(loop);
  }

  // ---- wiring
  readColors();
  resize();
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('themechange', () => (readColors(), reduce && frame()));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => (readColors(), reduce && frame()));

  if (reduce) return;

  for (let i = 0; i < 6; i++) particles.push(spawn(undefined, undefined, i === 0));

  const toWorld = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / H, (e.clientY - r.top) / H] as const;
  };
  host.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    [mouse.x, mouse.y] = toWorld(e);
    mouse.target = 1;
    mouse.moved = performance.now();
  });
  host.addEventListener('pointerleave', () => (mouse.target = 0));
  host.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('a, button')) return;
    const [x, y] = toWorld(e);
    if (particles.length >= MAX_PARTICLES) particles[0].dying = true;
    particles.push(spawn(x, y));
  });

  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  document.addEventListener('visibilitychange', () => (running = !document.hidden));
  requestAnimationFrame(loop);
}
