// Mounts a paper illustration (or, on the home page, the set of them) into a host element.
//
// The host holds a plot ([data-plot]) with two stacked canvases and a readout. One canvas carries
// the picture, the other the highlight under the pointer. On the home page the host also has the
// caption, a counter and a "next" button inside a [data-quiet] title block docked along the bottom
// of the picture; on wide screens the picture keeps clear of it.

import { PLATES } from './meta';
import type { Env, Plate } from './types';
import { bifurcation } from './bifurcation';
import { phase } from './phase';
import { braid } from './braid';
import { lattice } from './lattice';
import { drag } from './drag';
import { kron } from './kron';
import { match } from './match';

const DRAW: Record<string, Plate> = { bifurcation, phase, drag, braid, lattice, kron, match };

export function mountPlates(host: HTMLElement) {
  const plot = host.querySelector<HTMLElement>('[data-plot]')!;
  const base = host.querySelector<HTMLCanvasElement>('[data-plate-base]')!;
  const over = host.querySelector<HTMLCanvasElement>('[data-plate-over]')!;
  const readout = host.querySelector<HTMLElement>('[data-readout]')!;
  const caption = host.querySelector<HTMLElement>('[data-plate-caption]');
  const count = host.querySelector<HTMLElement>('[data-plate-count]');
  const next = host.querySelector<HTMLButtonElement>('[data-plate-next]');
  const quiet = host.querySelector<HTMLElement>('[data-quiet]');
  const bctx = base.getContext('2d')!;
  const octx = over.getContext('2d')!;
  const sheet = document.createElement('canvas'); // the finished picture, revealed onto `base`
  const sctx = sheet.getContext('2d')!;
  const old = document.createElement('canvas'); // the picture being replaced, kept until covered
  const octxOld = old.getContext('2d')!;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wideQuery = matchMedia('(min-width: 1100px)');

  // A page for one paper shows that paper's illustration; the home page steps through all of
  // them, starting one further along on each visit.
  const fixed = host.dataset.plate;
  const list = fixed ? PLATES.filter((p) => p.id === fixed) : PLATES;
  let index = 0;
  if (!fixed) {
    try {
      const seen = localStorage.getItem('plate');
      index = seen === null ? 0 : (Number(seen) + 1) % list.length;
      localStorage.setItem('plate', String(index));
    } catch (_) {}
  }

  let env: Env;
  let raf = 0;
  let picked: [number, number] | null = null;

  function measure() {
    const r = plot.getBoundingClientRect();
    const s = getComputedStyle(document.documentElement);
    const cs = getComputedStyle(plot);
    const wide = !!quiet && wideQuery.matches;
    // keep the picture clear of the title block docked along the bottom
    if (wide) plot.style.setProperty('--pb', `${dockMargin()}px`);
    else plot.style.removeProperty('--pb');
    env = {
      W: Math.max(1, Math.round(r.width)),
      H: Math.max(1, Math.round(r.height)),
      top: parseFloat(cs.getPropertyValue('--pt')) || 0,
      bottom: parseFloat(cs.getPropertyValue('--pb')) || 0,
      wide,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      ink: s.getPropertyValue('--ink').trim(),
      mark: s.getPropertyValue('--mark').trim(),
      faint: s.getPropertyValue('--faint').trim(),
      muted: s.getPropertyValue('--muted').trim(),
      bg: s.getPropertyValue('--bg').trim(),
      sans: s.getPropertyValue('--sans').trim(),
    };
    for (const c of [base, over, sheet]) {
      c.width = Math.round(env.W * env.dpr);
      c.height = Math.round(env.H * env.dpr);
    }
    octx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    sctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
  }

  // How much of the bottom of the picture the title block takes. On wide screens the picture is
  // fixed to the viewport while the page scrolls, so this is measured within the hero, not on screen.
  function dockMargin() {
    const hero = host.getBoundingClientRect();
    return Math.round(plot.getBoundingClientRect().height - (quiet!.getBoundingClientRect().top - hero.top) + 22);
  }

  function describe() {
    const p = list[index];
    base.setAttribute('aria-label', p.text.replace(/<[^>]+>/g, ''));
    if (caption) caption.innerHTML = `${p.text} Drawn after <a href="/publications/${p.slug}/">${p.paper}</a>.`;
    if (count) count.textContent = `${index + 1} of ${list.length}`;
  }

  function draw(animate: boolean) {
    cancelAnimationFrame(raf);
    sctx.clearRect(0, 0, env.W, env.H);
    sctx.save();
    DRAW[list[index].id].render(sctx, env);
    sctx.restore();
    // The new picture slides in from the left over the old one, which stays until it is covered.
    const keep = animate && old.width === base.width && old.height === base.height;
    const show = (w: number) => {
      bctx.clearRect(0, 0, base.width, base.height);
      if (keep && w < base.width) bctx.drawImage(old, w, 0, base.width - w, old.height, w, 0, base.width - w, old.height);
      if (w > 0) bctx.drawImage(sheet, 0, 0, w, sheet.height, 0, 0, w, sheet.height);
    };
    if (!animate) return show(sheet.width);
    // The one piece of choreography on the site: the picture is drawn left to right, once.
    const t0 = performance.now();
    const dur = 1700;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      show(Math.round(sheet.width * (1 - Math.pow(1 - t, 2.2))));
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    show(0);
    raf = requestAnimationFrame(frame);
  }

  function drawPick() {
    octx.clearRect(0, 0, env.W, env.H);
    const got = picked && DRAW[list[index].id].pick(octx, env, picked[0], picked[1]);
    octx.globalAlpha = 1;
    if (!got) {
      readout.hidden = true;
      return;
    }
    readout.innerHTML = got.html;
    readout.hidden = false;
    const half = readout.offsetWidth / 2 + 8;
    readout.style.left = `${Math.min(env.W - half, Math.max(half, got.x))}px`;
  }

  function redraw(animate = false) {
    if (animate) {
      // remember what is on screen before the canvases are resized (which clears them)
      old.width = base.width;
      old.height = base.height;
      octxOld.drawImage(base, 0, 0);
    }
    measure();
    describe();
    draw(animate);
    drawPick();
  }

  // The pointer picks only while it is over the picture itself, never over the text or controls.
  const locate = (e: PointerEvent): [number, number] | null => {
    const r = plot.getBoundingClientRect();
    const inside = e.clientY >= r.top && e.clientY <= r.bottom && e.clientX >= r.left && e.clientX <= r.right;
    const onText = (e.target as HTMLElement).closest('[data-quiet], [data-plate-bar]');
    return inside && !onText ? [e.clientX - r.left, e.clientY - r.top] : null;
  };
  host.addEventListener('pointermove', (e) => {
    picked = locate(e);
    drawPick();
  });
  host.addEventListener('pointerdown', (e) => {
    picked = locate(e);
    drawPick();
  });
  host.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    picked = null;
    drawPick();
  });

  next?.addEventListener('click', () => {
    index = (index + 1) % list.length;
    try {
      localStorage.setItem('plate', String(index));
    } catch (_) {}
    picked = null;
    redraw(!reduce);
  });

  let ready = false;
  let timer = 0;
  const ro = new ResizeObserver(() => {
    if (!ready) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const r = plot.getBoundingClientRect();
      const dock = quiet && wideQuery.matches ? dockMargin() : env.bottom;
      if (Math.round(r.width) !== env.W || Math.round(r.height) !== env.H || dock !== env.bottom) redraw();
    }, 120);
  });
  ro.observe(plot);
  if (quiet) ro.observe(quiet);
  window.addEventListener('themechange', () => redraw());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => redraw());
  redraw(!reduce);
  ready = true;
}
