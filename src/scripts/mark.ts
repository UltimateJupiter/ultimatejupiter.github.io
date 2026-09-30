// A small wireframe icosahedron used as the site mark. Idles slowly, spins up on hover,
// and nudges with scroll velocity.

const phi = (1 + Math.sqrt(5)) / 2;
const V: [number, number, number][] = [
  [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
  [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
  [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
];
// Edges are the vertex pairs at the minimal distance (2).
const E: [number, number][] = [];
for (let i = 0; i < V.length; i++)
  for (let j = i + 1; j < V.length; j++) {
    const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
    if (Math.abs(d - 2) < 1e-6) E.push([i, j]);
  }

export function mountMark(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const size = canvas.clientWidth || 28;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ax = 0.5, ay = 0.3, speed = 1, target = 1;
  let ink = '', accent = '';
  const readColors = () => {
    const s = getComputedStyle(document.documentElement);
    ink = s.getPropertyValue('--ink').trim();
    accent = s.getPropertyValue('--accent').trim();
  };
  readColors();
  window.addEventListener('themechange', readColors);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);

  const host = canvas.parentElement!;
  host.addEventListener('pointerenter', () => (target = 7));
  host.addEventListener('pointerleave', () => (target = 1));
  let lastY = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      speed += Math.min(Math.abs(window.scrollY - lastY) * 0.02, 3);
      lastY = window.scrollY;
    },
    { passive: true },
  );

  const r = size * 0.24;
  const c = size / 2;
  function draw() {
    ctx.clearRect(0, 0, size, size);
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    const P = V.map(([x, y, z]) => {
      const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
      const x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
      return [c + x2 * r, c + y1 * r, z2] as const;
    });
    ctx.lineWidth = 0.9;
    for (const [i, j] of E) {
      const depth = (P[i][2] + P[j][2]) / 2; // in [-phi, phi]
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.25 + 0.6 * ((depth + phi) / (2 * phi));
      ctx.beginPath();
      ctx.moveTo(P[i][0], P[i][1]);
      ctx.lineTo(P[j][0], P[j][1]);
      ctx.stroke();
    }
    // the vertex closest to the viewer is marked in the accent colour
    let front = 0;
    P.forEach((p, i) => p[2] > P[front][2] && (front = i));
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(P[front][0], P[front][1], 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (reduce) return draw();
  function tick() {
    speed += (target - speed) * 0.05;
    ax += 0.004 * speed;
    ay += 0.007 * speed;
    draw();
    requestAnimationFrame(tick);
  }
  tick();
}
