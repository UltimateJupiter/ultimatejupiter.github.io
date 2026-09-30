// Hero figure: level sets of a slowly drifting 2-D "loss landscape", with a single
// heavy-ball gradient-descent particle rolling down it. The particle is released on high
// ground, descends with smooth (temporally correlated) noise, and fades out once it has
// settled; a fresh one is released a moment later. The pointer raises a soft hill in the
// landscape; clicking drops a new particle where you click.

// A (possibly curved, rotated) Gaussian basin or bump. In its own frame (u along the axis,
// v across it) the profile is  a · exp(-½ (u²/sx² + (v - bend·u²)²/sy²)).
type Well = {
  bx: number; by: number; rx: number; ry: number; w: number; ph: number; // wandering centre
  a: number; bw: number; // depth, and how fast it breathes
  sx: number; sy: number; th: number; spin: number; bend: number; // shape
};
// Per-frame snapshot of a well, so the field sampler does no trig.
type Live = { x: number; y: number; a: number; c: number; s: number; isx2: number; isy2: number; bend: number };
type Particle = {
  x: number; y: number; vx: number; vy: number;
  lr: number; beta: number;
  nx: number; ny: number; // correlated noise state
  losses: number[]; // loss sampled every LOSS_EVERY frames, most recent last
  marks: number[]; // positions (x, y) sampled alongside
  trail: number[]; age: number; alpha: number; dying: boolean; fast?: boolean;
};

const GRID = 11; // css px between samples
const LEVEL0 = -3;
const LEVEL_STEP = 0.1;
const TRAIL = 140; // trail points, one every TRAIL_EVERY frames
const TRAIL_EVERY = 2;
const POPULATION = 1; // particles kept alive when nobody is clicking
const MAX_PARTICLES = 1; // including ones dropped by clicking
const BOWL = 0.18; // weak confining quadratic
const MAX_STEP = 0.00175; // world units per frame (height = 1)
const NOISE = 1.2; // noise scale, in gradient units
const NOISE_CORR = 0.995; // per-frame correlation of the noise (Ornstein–Uhlenbeck)
// Settling: a particle whose loss has dropped by less than SETTLE_DROP *and* that has moved
// less than SETTLE_DIST over the last LOSS_WINDOW samples (~3 s) has come to rest (or is
// circling / being carried along in the valley) and fades out.
const LOSS_EVERY = 30;
const LOSS_WINDOW = 6;
const SETTLE_DROP = 0.015;
const SETTLE_DIST = 0.025;
const MAX_AGE = 60 * 90;
const MOUSE_A = 0.45; // height of the hill under the pointer
const MOUSE_S = 0.15; // and its width (broad, so it nudges rather than traps)
const MOUSE_IDLE_MS = 1800; // the hill settles back down once the pointer rests

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
    // One curved valley that slowly turns, sitting on a few very broad, low Gaussian swells.
    // The swells tilt and bend the valley floor, so where a particle ends up along it varies.
    // A weak bowl keeps particles on screen.
    const wide = aspect >= 1;
    const sc = Math.min(1, aspect / 0.9); // shrink features on portrait screens
    const at = (along: number, across: number): [number, number] =>
      wide ? [along * aspect, across] : [across * aspect, along];
    const well = (pos: [number, number], w: Partial<Well>): Well => ({
      bx: pos[0], by: pos[1],
      rx: rand(0.03, 0.06) * sc, ry: rand(0.03, 0.06) * sc,
      w: rand(0.05, 0.09) * (Math.random() < 0.5 ? -1 : 1),
      ph: rand(0, Math.PI * 2),
      bw: rand(0.03, 0.06),
      a: -1, sx: 0.1, sy: 0.1, th: 0, spin: 0, bend: 0,
      ...w,
    });
    const j = () => rand(-0.05, 0.05);
    const swell = (a: number): Well =>
      well(at(rand(0.1, 0.9), rand(0.15, 0.85)), {
        a, sx: rand(0.45, 0.65), sy: rand(0.45, 0.65),
        rx: rand(0.08, 0.15), ry: rand(0.06, 0.12), w: rand(0.03, 0.05) * (Math.random() < 0.5 ? -1 : 1),
      });
    wells = [
      // the valley
      well(at(0.62 + j(), 0.5 + j()), {
        a: -0.75, sx: 0.42 * sc, sy: 0.09 * sc, bend: 1.8 / sc,
        th: rand(0, Math.PI * 2), spin: rand(0.025, 0.04) * (Math.random() < 0.5 ? -1 : 1),
      }),
      // large-scale structure
      swell(-rand(0.25, 0.35)),
      swell(rand(0.25, 0.35)),
      swell(rand(-0.3, 0.3)),
    ];
    updateWells();
  }

  let live: Live[] = [];
  function updateWells() {
    const snap = (w: Well): Live => {
      const th = w.th + w.spin * t;
      return {
        x: w.bx + w.rx * Math.cos(w.w * t + w.ph),
        y: w.by + w.ry * Math.sin(w.w * 1.3 * t + w.ph),
        // depth slowly breathes, so basins deepen and fill back in over time
        a: w.a * (1 + 0.15 * Math.sin(w.bw * t + 2 * w.ph)),
        c: Math.cos(th), s: Math.sin(th),
        isx2: 1 / (w.sx * w.sx), isy2: 1 / (w.sy * w.sy), bend: w.bend,
      };
    };
    live = wells.map(snap);
    if (mouse.k > 0.001)
      live.push({ x: mouse.x, y: mouse.y, a: MOUSE_A * mouse.k, c: 1, s: 0, isx2: 1 / MOUSE_S ** 2, isy2: 1 / MOUSE_S ** 2, bend: 0 });
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

  function potential(x: number, y: number) {
    let f = BOWL * ((x - aspect / 2) ** 2 / (aspect * aspect * 0.25) + (y - 0.5) ** 2 * 1.2);
    for (const w of live) {
      const dx = x - w.x, dy = y - w.y;
      const u = dx * w.c + dy * w.s, q = -dx * w.s + dy * w.c - w.bend * u * u;
      f += w.a * Math.exp(-0.5 * (u * u * w.isx2 + q * q * w.isy2));
    }
    return f;
  }

  function gradient(x: number, y: number): [number, number] {
    let gx = (2 * BOWL * (x - aspect / 2)) / (aspect * aspect * 0.25);
    let gy = 2 * BOWL * 1.2 * (y - 0.5);
    for (const w of live) {
      const dx = x - w.x, dy = y - w.y;
      const u = dx * w.c + dy * w.s, q = -dx * w.s + dy * w.c - w.bend * u * u;
      const e = w.a * Math.exp(-0.5 * (u * u * w.isx2 + q * q * w.isy2));
      const du = e * (-u * w.isx2 + q * w.isy2 * 2 * w.bend * u); // ∂/∂u
      const dv = e * (-q * w.isy2); // ∂/∂v
      gx += du * w.c - dv * w.s;
      gy += du * w.s + dv * w.c;
    }
    return [gx, gy];
  }

  // Release on high ground: best of a few random candidates, so it has somewhere to roll.
  function spawn(x?: number, y?: number): Particle {
    if (x === undefined || y === undefined) {
      let best = -Infinity;
      // (few candidates, away from the edges, where the confining bowl is always highest)
      for (let k = 0; k < 3; k++) {
        const cx = rand(0.15, 0.9) * aspect, cy = rand(0.12, 0.88);
        const f = potential(cx, cy);
        if (f > best) (best = f), (x = cx), (y = cy);
      }
    }
    return {
      x: x!, y: y!, vx: 0, vy: 0,
      lr: rand(0.0000125, 0.0000225),
      beta: rand(0.95, 0.97),
      nx: gauss(), ny: gauss(),
      losses: [], marks: [],
      trail: [], age: 0, alpha: 0, dying: false,
    };
  }

  const aliveCount = () => particles.reduce((n, p) => n + (p.dying ? 0 : 1), 0);
  let pending: number[] = []; // countdown (frames) until the next automatic release

  function stepParticles() {
    const rho = NOISE_CORR, kick = Math.sqrt(1 - rho * rho);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const [gx, gy] = gradient(p.x, p.y);
      p.nx = rho * p.nx + kick * gauss();
      p.ny = rho * p.ny + kick * gauss();
      p.vx = p.beta * p.vx - p.lr * (gx + NOISE * p.nx);
      p.vy = p.beta * p.vy - p.lr * (gy + NOISE * p.ny);
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > MAX_STEP) (p.vx *= MAX_STEP / sp), (p.vy *= MAX_STEP / sp);
      p.x += p.vx;
      p.y += p.vy;
      p.age++;
      if (p.age % TRAIL_EVERY === 0) {
        p.trail.push(p.x, p.y);
        if (p.trail.length > TRAIL * 2) p.trail.splice(0, 2);
      }

      // Settling: compare the loss now with ~3 s ago. Rolling downhill keeps it falling;
      // sitting in (or orbiting, or being carried along with) a basin does not.
      if (p.age % LOSS_EVERY === 0) {
        p.losses.push(potential(p.x, p.y));
        p.marks.push(p.x, p.y);
        if (p.losses.length > LOSS_WINDOW + 1) p.losses.shift(), p.marks.splice(0, 2);
        const n = p.losses.length;
        const moved = Math.hypot(p.x - p.marks[0], p.y - p.marks[1]);
        if (n > LOSS_WINDOW && p.losses[0] - p.losses[n - 1] < SETTLE_DROP && moved < SETTLE_DIST) p.dying = true;
      }

      const out = p.x < -0.1 || p.x > aspect + 0.1 || p.y < -0.1 || p.y > 1.1;
      if (p.age > MAX_AGE || out) p.dying = true;
      p.alpha = p.dying ? p.alpha - (p.fast ? 0.08 : 0.005) : Math.min(1, p.alpha + 0.01);
      if (p.dying && p.alpha <= 0) particles.splice(i, 1);
    }
    // Keep a small population, releasing replacements one at a time with a pause.
    pending = pending.map((n) => n - 1);
    while (pending.length && pending[0] <= 0) {
      pending.shift();
      // wait until the previous one has fully faded, so only one is ever on screen
      if (particles.length < MAX_PARTICLES) particles.push(spawn());
    }
    const alive = aliveCount();
    for (let k = alive + pending.length; k < POPULATION; k++) pending.push(Math.round(rand(90, 300)) + pending.length * 120);
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
      dctx.lineWidth = 1.1;
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
    updateWells();
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

  for (let i = 0; i < POPULATION; i++) particles.push(spawn());

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
    // at most MAX_PARTICLES in play: the oldest one bows out for the new one
    const live = particles.filter((p) => !p.dying);
    if (live.length >= MAX_PARTICLES) (live[0].dying = true), (live[0].fast = true);
    particles.push(spawn(x, y));
  });

  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  document.addEventListener('visibilitychange', () => (running = !document.hidden));
  requestAnimationFrame(loop);
}
