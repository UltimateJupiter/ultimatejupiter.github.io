// Inline PDF slide viewer, built on pdf.js. Loaded on demand the first time a deck is opened.
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

export interface SlideViewer {
  destroy(): void;
}

export async function mountSlides(root: HTMLElement, url: string): Promise<SlideViewer> {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const prev = root.querySelector<HTMLButtonElement>('[data-prev]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-next]')!;
  const counter = root.querySelector<HTMLElement>('[data-counter]')!;
  const full = root.querySelector<HTMLButtonElement>('[data-full]')!;

  root.dataset.state = 'loading';
  const task = getDocument({ url });
  let pdf: PDFDocumentProxy;
  try {
    pdf = await task.promise;
  } catch (err) {
    root.dataset.state = 'error';
    throw err;
  }

  let page = 1;
  let render: RenderTask | undefined;
  let drawn = '';

  const draw = async () => {
    const p = await pdf.getPage(page);
    const base = p.getViewport({ scale: 1 });
    // Show the whole slide inside the stage (which is the screen in fullscreen).
    const fit = Math.min(stage.clientWidth / base.width, (stage.clientHeight || Infinity) / base.height);
    const scale = fit * (window.devicePixelRatio || 1);
    const key = `${page}@${scale.toFixed(3)}`;
    if (key === drawn) return;
    stage.style.setProperty('--ratio', `${base.width} / ${base.height}`);
    const viewport = p.getViewport({ scale });
    render?.cancel();
    // Draw off-screen, then swap, so the old slide stays up until the new one is ready.
    const off = document.createElement('canvas');
    off.width = Math.floor(viewport.width);
    off.height = Math.floor(viewport.height);
    render = p.render({ canvas: off, viewport });
    try {
      await render.promise;
    } catch {
      return; // cancelled by a newer draw
    }
    canvas.width = off.width;
    canvas.height = off.height;
    canvas.style.width = `${off.width / (window.devicePixelRatio || 1)}px`;
    canvas.style.height = `${off.height / (window.devicePixelRatio || 1)}px`;
    canvas.getContext('2d')!.drawImage(off, 0, 0);
    drawn = key;
    root.dataset.state = 'ready';
  };

  // A draw can still be in flight when the viewer is torn down; that rejection is expected.
  let alive = true;
  const redraw = () => {
    draw().catch((err) => {
      if (alive) console.error(err);
    });
  };

  const go = (n: number) => {
    const to = Math.min(Math.max(n, 1), pdf.numPages);
    if (to === page && drawn) return;
    page = to;
    counter.textContent = `${page} / ${pdf.numPages}`;
    prev.disabled = page === 1;
    next.disabled = page === pdf.numPages;
    redraw();
  };

  const onPrev = () => go(page - 1);
  const onNext = () => go(page + 1);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') onPrev();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') onNext();
    else if (e.key === 'Home') go(1);
    else if (e.key === 'End') go(pdf.numPages);
    else return;
    e.preventDefault();
  };
  // Click the left third to go back, anywhere else to go forward.
  const onStageClick = (e: MouseEvent) => {
    const r = stage.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 3) onPrev();
    else onNext();
  };
  let touchX: number | undefined;
  const onTouchStart = (e: TouchEvent) => (touchX = e.touches[0]?.clientX);
  const onTouchEnd = (e: TouchEvent) => {
    const dx = (e.changedTouches[0]?.clientX ?? 0) - (touchX ?? 0);
    if (touchX !== undefined && Math.abs(dx) > 40) (dx < 0 ? onNext : onPrev)();
    touchX = undefined;
  };
  const onFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen?.();
  };
  const onFullChange = () => {
    full.setAttribute('aria-pressed', String(document.fullscreenElement === root));
    if (document.fullscreenElement === root) root.focus();
  };

  prev.addEventListener('click', onPrev);
  next.addEventListener('click', onNext);
  root.addEventListener('keydown', onKey);
  stage.addEventListener('click', onStageClick);
  stage.addEventListener('touchstart', onTouchStart, { passive: true });
  stage.addEventListener('touchend', onTouchEnd);
  full.addEventListener('click', onFull);
  document.addEventListener('fullscreenchange', onFullChange);
  if (!root.requestFullscreen) full.hidden = true;

  let resizeTimer: number | undefined;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(redraw, 120);
  });
  ro.observe(stage);

  go(1);

  return {
    destroy() {
      alive = false;
      ro.disconnect();
      render?.cancel();
      prev.removeEventListener('click', onPrev);
      next.removeEventListener('click', onNext);
      root.removeEventListener('keydown', onKey);
      stage.removeEventListener('click', onStageClick);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchend', onTouchEnd);
      full.removeEventListener('click', onFull);
      document.removeEventListener('fullscreenchange', onFullChange);
      if (document.fullscreenElement === root) void document.exitFullscreen();
      void task.destroy();
    },
  };
}
