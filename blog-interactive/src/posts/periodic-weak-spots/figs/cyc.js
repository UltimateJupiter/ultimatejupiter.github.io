(function () {
  'use strict';
  const fig = document.getElementById('fx-cyc');
  if (!fig) return;
  const D = window.FIGDATA && window.FIGDATA.cyc;
  if (!D || !Array.isArray(D.runs) || !D.runs.length) { console.error('fx-cyc: FIGDATA.cyc is missing'); return; }

  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';
  const DV = [-3, -2, -1, 0, 1, 2, 3];   // slider stops; δ = 0 is the uncycled model
  const DS = DV.filter(d => d !== 0);    // cycles with data (grid columns)
  // committed δ change: the prediction slides first, the observed marks follow (total 300 ms);
  // marks fade in early when leaving δ = 0 and fade out late when arriving there
  const T_PRED = [0, 300], T_OBS = [60, 380], T_IN = [0, 200], T_OUT = [180, 380];
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(mq && mq.matches);

  const runs = D.runs;
  const byId = new Map(runs.map(r => [r.id, r]));
  const cond = (run, d) => run.conds.find(c => c.d === d) || run.conds[0];
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const mod = (a, n) => ((a % n) + n) % n;

  // one symmetric range per model for the scatter, so the axes stay put while δ changes
  const RANGE = new Map(runs.map(run => {
    let mx = 0;
    run.conds.forEach(c => c.pc.concat(c.oc).forEach(v => { mx = Math.max(mx, Math.abs(v)); }));
    return [run.id, Math.ceil(mx * 1.04 / 10) * 10];
  }));

  // ---------- formatting (plain Unicode, real minus signs) ----------
  const num = (v, n) => { const s = Math.abs(v).toFixed(n); return (v < 0 && Number(s) !== 0 ? MINUS : '') + s; };
  const sgn = (v, n) => { const s = Math.abs(v).toFixed(n); return Number(s) === 0 ? s : (v < 0 ? MINUS : '+') + s; };
  const fd = d => (d ? (d > 0 ? '+' : MINUS) + Math.abs(d) : '0');
  const r3 = v => v.toFixed(3);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const f2 = v => (Math.round(v * 100) / 100).toString();
  function linePath(a, X, Y) { return a.map((v, i) => (i ? 'L' : 'M') + f2(X(i)) + ',' + f2(Y(v))).join(''); }
  function bandPath(lo, hi, X, Y) {
    let d = hi.map((v, i) => (i ? 'L' : 'M') + f2(X(i)) + ',' + f2(Y(v))).join('');
    for (let i = lo.length - 1; i >= 0; i--) d += 'L' + f2(X(i)) + ',' + f2(Y(lo[i]));
    return d + 'Z';
  }

  // ---------- elements ----------
  const sel = fig.querySelector('select.fx-select');
  const rng = fig.querySelector('.cyc-range');
  const dval = fig.querySelector('.cyc-dval');
  const fillEl = fig.querySelector('.cyc-fill');
  const ticksBox = fig.querySelector('.cyc-ticks');
  const tickEls = Array.from(ticksBox.querySelectorAll('[data-v]'));
  const accBox = fig.querySelector('[data-chart="acc"]');
  const scBox = fig.querySelector('[data-chart="sc"]');
  const accPanel = accBox.parentElement, scPanel = scBox.parentElement;
  const subAcc = fig.querySelector('[data-sub="acc"]');
  const subSc = fig.querySelector('[data-sub="sc"]');
  const statusEl = fig.querySelector('.fx-status');
  const table = fig.querySelector('.cyc-grid');
  const ramp = fig.querySelector('.cyc-ramp');
  const tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);

  runs.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; sel.appendChild(o); });

  const st = { run: byId.has(D.default && D.default.run) ? D.default.run : runs[0].id, d: DV.includes(D.default && D.default.d) ? D.default.d : 1 };
  let shown = null;   // values on screen (between two states while animating)
  let raf = 0, fin = 0;
  let hover = null;   // hovered phase
  let A = null, B = null;   // chart handles
  let lastW = [0, 0];

  // δ = 0 is a real state: "after the cycle" equals the uncycled model and every change is 0, so marks
  // collapse onto the grey profile (and the scatter onto its origin) while they fade (k: 1 → 0)
  function target(d = st.d) {
    const run = byId.get(st.run);
    if (!d) {
      const z = run.clean.acc.map(() => 0);
      return { run: run.id, shift: 0, k: 0, obs: run.clean.acc, lo: run.clean.lo, hi: run.clean.hi, pc: z, oc: z };
    }
    const c = cond(run, d);
    return { run: run.id, shift: d, k: 1, obs: c.obs, lo: c.lo, hi: c.hi, pc: c.pc, oc: c.oc };
  }
  function mix(a, b, tp, to, tk) {
    const l = (x, y) => x.map((v, i) => v + (y[i] - v) * to);
    return { run: b.run, shift: a.shift + (b.shift - a.shift) * tp, k: a.k + (b.k - a.k) * tk,
      obs: l(a.obs, b.obs), lo: l(a.lo, b.lo), hi: l(a.hi, b.hi), pc: l(a.pc, b.pc), oc: l(a.oc, b.oc) };
  }
  const ease = t => 1 - Math.pow(1 - t, 3);   // ease-out: starts at once and settles softly
  const phase = (ms, [a, b]) => ease(Math.max(0, Math.min(1, (ms - a) / (b - a))));

  // ---------- left: accuracy by phase ----------
  function buildAcc(run, W, H) {
    const S = run.S, cl = run.clean;
    const m = { l: 30, r: 4, t: 22, b: 36 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, cw = pw / S;
    const X = r => m.l + (r + 0.5) * cw;
    const Y = v => m.t + ph * (1 - v / 100);
    accBox.textContent = '';
    const svg = el('svg', { class: 'fx-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' }, accBox);

    el('rect', { class: 'bnd', x: f2(m.l + (S - 1) * cw), y: m.t, width: f2(cw), height: ph }, svg);
    el('text', { class: 'bnd-lab', x: f2(m.l + S * cw), y: m.t - 7, 'text-anchor': 'end' }, svg, 'boundary');

    [0, 25, 50, 75, 100].forEach(v => {
      const y = Math.round(Y(v)) + 0.5;
      el('line', { class: v === 0 ? 'ax' : 'gr', x1: m.l, x2: f2(m.l + pw), y1: y, y2: y }, svg);
      el('text', { x: m.l - 6, y: f2(Y(v)), dy: '0.32em', 'text-anchor': 'end' }, svg, String(v));
    });
    for (let r = 0; r < S; r++) el('text', { x: f2(X(r)), y: m.t + ph + 15, 'text-anchor': 'middle' }, svg, String(r));
    el('text', { x: f2(m.l + pw / 2), y: H - 3, 'text-anchor': 'middle' }, svg, `phase r = target-key position mod ${S}`);

    el('path', { class: 'cl-band', d: bandPath(cl.lo, cl.hi, X, Y) }, svg);
    el('path', { class: 'cl-line', d: linePath(cl.acc, X, Y) }, svg);
    const gCyc = el('g', null, svg);   // everything that exists only for δ ≠ 0
    const obBand = el('path', { class: 'ob-band' }, gCyc);
    // the prediction is the uncycled profile translated by δ phases, wrapping around the window
    const prLine = el('path', { class: 'pr-line' }, gCyc);
    const seg = [];
    for (let k = 0; k < S; k++) seg.push(Math.hypot(cw, Y(cl.acc[(k + 1) % S]) - Y(cl.acc[k])));
    const obLine = el('path', { class: 'ob-line' }, gCyc);
    const mks = [];
    // shift arrow: δ phases, in the direction the pattern should move
    const arrow = el('path', { class: 'shift' }, gCyc);
    const head = el('path', { class: 'shift-head' }, gCyc);
    const alab = el('text', { y: m.t - 7 }, gCyc);
    // observed markers stay visible at δ = 0, where they sit on the uncycled values
    for (let r = 0; r < S; r++) mks.push(el('circle', { class: 'mk' + (r === S - 1 ? ' hollow' : ''), cx: f2(X(r)), cy: f2(Y(cl.acc[r])), r: 3.5 }, svg));
    const hair = el('line', { class: 'hair', x1: 0, x2: 0, y1: m.t, y2: m.t + ph, visibility: 'hidden' }, svg);
    el('rect', { class: 'hit', x: m.l, y: m.t - 4, width: f2(pw), height: ph + 8 }, svg);
    A = { svg, run, S, X, Y, cw, m, pw, ph, gCyc, obBand, prLine, obLine, hair, mks, arrow, head, alab, cl: cl.acc, seg };
  }
  // uncycled profile as a periodic, piecewise-linear function of a real phase v
  function prof(v) {
    const k = Math.floor(v), f = v - k, a = A.cl[mod(k, A.S)], b = A.cl[mod(k + 1, A.S)];
    return a + (b - a) * f;
  }
  // prediction for a (possibly fractional, mid-animation) shift s, exactly clipped to phases 0..S−1
  function predPath(s) {
    const { X, Y, S } = A, us = [0];
    for (let k = Math.ceil(-s); k <= Math.floor(S - 1 - s); k++) { const u = k + s; if (u > 1e-6 && u < S - 1 - 1e-6) us.push(u); }
    us.push(S - 1);
    return us.map((u, i) => (i ? 'L' : 'M') + f2(X(u)) + ',' + f2(Y(prof(u - s)))).join('');
  }
  // signed arc length of the uncycled profile from phase 0 to v: keeps the dashes riding on the moving curve
  function arc(v) {
    const k = Math.floor(v), f = v - k, n = A.S;
    let L = 0;
    if (k >= 0) for (let j = 0; j < k; j++) L += A.seg[j % n];
    else for (let j = k; j < 0; j++) L -= A.seg[mod(j, n)];
    return L + f * A.seg[mod(k, n)];
  }
  function paintAcc(s) {
    const { X, Y, S, m, cw } = A;
    A.svg.classList.toggle('unc', !st.d);
    A.gCyc.setAttribute('opacity', f2(s.k));
    A.gCyc.setAttribute('visibility', s.k > 0.005 ? 'visible' : 'hidden');
    A.obLine.setAttribute('d', linePath(s.obs, X, Y));
    A.obBand.setAttribute('d', bandPath(s.lo, s.hi, X, Y));
    A.prLine.setAttribute('d', predPath(s.shift));
    A.prLine.setAttribute('stroke-dashoffset', f2(arc(-s.shift)));
    for (let r = 0; r < S; r++) A.mks[r].setAttribute('cy', f2(Y(s.obs[r])));
    // "shift ±k" then an arrow |δ| phase columns long, pointing the way the pattern should move
    const lab = st.d ? 'shift ' + fd(st.d) : A.alab.textContent || 'shift';   // keep the old label while fading out
    const y = m.t - 11, ax = m.l + lab.length * 6.3 + 7;
    const len = Math.abs(s.shift) * cw, dir = s.shift >= 0 ? 1 : -1;
    const a = dir > 0 ? ax : ax + len, b = dir > 0 ? ax + len : ax;
    A.arrow.setAttribute('d', len > 1 ? `M${f2(a)},${y + 0.5}H${f2(b - dir * 4)}` : '');
    A.head.setAttribute('d', len > 1 ? `M${f2(b)},${y + 0.5}l${-dir * 5},-3v6z` : '');
    A.alab.setAttribute('x', m.l);
    A.alab.setAttribute('dy', '0.32em');
    A.alab.setAttribute('y', y + 0.5);
    A.alab.textContent = lab;
  }

  // ---------- right: predicted vs observed change ----------
  function buildSc(run, W) {
    const S = run.S, R = RANGE.get(run.id);
    const m = { l: 44, r: 8, t: 6, b: 36 };
    const side = Math.max(140, Math.min(W - m.l - m.r, 330));
    const ox = Math.max(0, (W - m.l - m.r - side) / 2);
    const H = m.t + side + m.b;
    const x0 = m.l + ox;
    const X = v => x0 + side * (v + R) / (2 * R);
    const Y = v => m.t + side * (R - v) / (2 * R);
    scBox.textContent = '';
    const root = el('svg', { class: 'fx-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' }, scBox);
    let svg = el('g', null, root);   // axes: faded while δ = 0
    const gAx = svg;
    const step = R / 30 >= 2 ? 30 : 20;
    const ticks = [];
    for (let v = -Math.floor(R / step) * step; v <= R + 1e-9; v += step) ticks.push(v);
    ticks.forEach(v => {
      const x = Math.round(X(v)) + 0.5, y = Math.round(Y(v)) + 0.5;
      el('line', { class: v === 0 ? 'zero' : 'gr', x1: x, x2: x, y1: m.t, y2: f2(m.t + side) }, svg);
      el('line', { class: v === 0 ? 'zero' : 'gr', x1: f2(x0), x2: f2(x0 + side), y1: y, y2: y }, svg);
      el('text', { x: f2(X(v)), y: f2(m.t + side + 15), 'text-anchor': 'middle' }, svg, num(v, 0));
      el('text', { x: f2(x0 - 6), y: f2(Y(v)), dy: '0.32em', 'text-anchor': 'end' }, svg, num(v, 0));
    });
    el('line', { class: 'ax', x1: f2(x0), x2: f2(x0 + side), y1: Math.round(m.t + side) + 0.5, y2: Math.round(m.t + side) + 0.5 }, svg);
    el('line', { class: 'ax', x1: Math.round(x0) - 0.5, x2: Math.round(x0) - 0.5, y1: m.t, y2: f2(m.t + side) }, svg);
    el('text', { x: f2(x0 + side / 2), y: H - 3, 'text-anchor': 'middle' }, svg, 'predicted change');
    el('text', { transform: `translate(${f2(x0 - 34)},${f2(m.t + side / 2)}) rotate(-90)`, 'text-anchor': 'middle' }, svg, 'observed change');
    el('line', { class: 'diag', x1: f2(X(-R)), y1: f2(Y(-R)), x2: f2(X(R)), y2: f2(Y(R)) }, svg);
    el('text', { x: f2(X(R) + 2), y: f2(Y(R) + 55), 'text-anchor': 'end' }, svg, 'y = x');
    svg = el('g', null, root);   // data: absent while δ = 0
    const gData = svg;
    // headline in the empty upper-left corner (predicted down, observed up never happens here)
    const hx = X(-R) + 9, hy = Y(R) + 18;
    const hbg = el('rect', { class: 'hl-bg', x: f2(hx - 5), y: f2(hy - 14), height: 36, rx: 2 }, svg);
    const hl = el('text', { class: 'hl', x: f2(hx), y: f2(hy) }, svg);
    const hl2 = el('text', { class: 'hl-sub', x: f2(hx), y: f2(hy + 16) }, svg);
    const ring = el('circle', { class: 'ring', r: 7.5, visibility: 'hidden' }, svg);
    const pts = [];
    for (let r = 0; r < S; r++) pts.push(el('circle', { class: 'pt' + (r === S - 1 ? ' hollow' : ''), r: 3.75 }, svg));
    const plab = el('text', { class: 'ptlab' }, svg, `phase ${S - 1}`);
    // empty state for δ = 0
    const note = el('g', { class: 'note' }, root);
    const cx = X(0), cy = Y(0);
    el('rect', { class: 'note-bg', x: f2(cx - 74), y: f2(cy - 21), width: 148, height: 40, rx: 2 }, note);
    el('text', { class: 'note1', x: f2(cx), y: f2(cy - 4), 'text-anchor': 'middle' }, note, 'δ = 0: no cycle');
    el('text', { class: 'note2', x: f2(cx), y: f2(cy + 12), 'text-anchor': 'middle' }, note, 'move the slider');
    B = { svg: root, run, S, R, X, Y, x0, side, m, gAx, gData, note, hbg, hl, hl2, ring, pts, plab, spot: null };
    return H;
  }
  function paintSc(s) {
    const { X, Y, S } = B;
    B.gAx.setAttribute('opacity', f2(0.35 + 0.65 * s.k));
    B.gData.setAttribute('opacity', f2(s.k));
    B.gData.setAttribute('visibility', s.k > 0.005 ? 'visible' : 'hidden');
    const nk = Math.max(0, Math.min(1, 1 - 2 * s.k));   // the note only shows once the points have mostly gone
    B.note.setAttribute('opacity', f2(nk));
    B.note.setAttribute('visibility', nk > 0.005 ? 'visible' : 'hidden');
    for (let r = 0; r < S; r++) { B.pts[r].setAttribute('cx', f2(X(s.pc[r]))); B.pts[r].setAttribute('cy', f2(Y(s.oc[r]))); }
    // label the hollow (boundary) point where it overlaps no other point (side chosen on the target state)
    if (st.d || !B.spot) B.spot = st.d ? labelSpot() : { dx: 11, dy: 0, anchor: 'start' };
    const spot = B.spot, bx = X(s.pc[S - 1]), by = Y(s.oc[S - 1]);
    B.plab.setAttribute('x', f2(bx + spot.dx));
    B.plab.setAttribute('y', f2(by + spot.dy));
    B.plab.setAttribute('dy', '0.32em');
    B.plab.setAttribute('text-anchor', spot.anchor);
  }
  function labelSpot() {
    const { X, Y, S, x0, side, m } = B, c = cond(byId.get(st.run), st.d);
    const bx = X(c.pc[S - 1]), by = Y(c.oc[S - 1]), w = B.plab.textContent.length * 6.1;
    const spots = [
      { dx: 11, dy: 0, anchor: 'start', x: bx + 11, y: by },
      { dx: -11, dy: 0, anchor: 'end', x: bx - 11 - w, y: by },
      { dx: 0, dy: 16, anchor: 'middle', x: bx - w / 2, y: by + 16 },
      { dx: 0, dy: -15, anchor: 'middle', x: bx - w / 2, y: by - 15 }
    ];
    let best = spots[0], bestN = Infinity;
    for (const sp of spots) {
      if (sp.x < x0 || sp.x + w > x0 + side || sp.y - 6 < m.t || sp.y + 5 > m.t + side) continue;
      let n = 0;
      for (let r = 0; r < S - 1; r++) {
        const px = X(c.pc[r]), py = Y(c.oc[r]);
        if (px > sp.x - 6 && px < sp.x + w + 6 && py > sp.y - 11 && py < sp.y + 10) n++;
      }
      if (n < bestN) { best = sp; bestN = n; }
      if (!n) break;
    }
    return best;
  }

  function paintHover() {
    if (!A || !B || !shown) return;
    const on = hover != null && hover < A.S;
    A.hair.setAttribute('visibility', on ? 'visible' : 'hidden');
    B.ring.setAttribute('visibility', on && st.d ? 'visible' : 'hidden');
    A.mks.forEach((c, r) => c.classList.toggle('on', on && r === hover));
    if (!on) return;
    const x = Math.round(A.X(hover)) + 0.5;
    A.hair.setAttribute('x1', x); A.hair.setAttribute('x2', x);
    B.ring.setAttribute('cx', f2(B.X(shown.pc[hover])));
    B.ring.setAttribute('cy', f2(B.Y(shown.oc[hover])));
  }
  function paint() { if (!A || !B || !shown) return; paintAcc(shown); paintSc(shown); paintHover(); }

  // ---------- text: headline, subtitles, labels, status ----------
  function describe() {
    const run = byId.get(st.run), S = run.S, cl = run.clean.acc, b = S - 1, r0 = v => Math.round(v);
    subSc.innerHTML = `hollow: boundary phase ${b}, not in R²`;
    if (!st.d) {
      // the headline keeps its old text while it fades out
      if (B) B.svg.setAttribute('aria-label', `Predicted against observed accuracy change for ${run.name}: empty, because δ = 0 applies no cycle. Move the slider to cycle the gates.`);
      if (A) A.svg.setAttribute('aria-label', `Accuracy by phase 0 to ${b} for the uncycled ${run.name} model (δ = 0): ${cl.map(r0).join(', ')} percent. Boundary phase ${b} is ${num(cl[b], 1)}%.`);
      subAcc.innerHTML = `mean ${mean(cl).toFixed(1)}% uncycled`;
      statusEl.innerHTML = [`<b>${esc(run.name)}</b>`, 'δ = <b>0</b>', 'uncycled', `mean accuracy <b>${mean(cl).toFixed(1)}%</b>`]
        .map(t => `<span class="nw">${t}</span>`).join(' · ');
      return;
    }
    const c = cond(run, st.d), dd = fd(st.d);
    if (B) {
      B.hl.textContent = '';
      el('tspan', null, B.hl, 'R² ' + r3(c.r2x[0]));
      el('tspan', { class: 'hl-ci', dx: 6 }, B.hl, `[${r3(c.r2x[1])}, ${r3(c.r2x[2])}]`);
      B.hl2.textContent = 'all phases ' + r3(c.r2a[0]);
      let w = 0;
      try { w = Math.max(B.hl.getComputedTextLength(), B.hl2.getComputedTextLength()); } catch (e) { w = 0; }
      B.hbg.setAttribute('width', f2((w || 160) + 10));
      B.svg.setAttribute('aria-label', `Predicted against observed accuracy change for each phase, ${run.name}, gates cycled by δ = ${dd}. ` +
        `R² excluding boundary phase ${b}: ${r3(c.r2x[0])} (95% interval ${r3(c.r2x[1])} to ${r3(c.r2x[2])}); ` +
        `excluding phases ${bset(c).join(' and ')}: ${r3(c.r2i[0])}; all phases: ${r3(c.r2a[0])}. ` +
        `Boundary phase ${b}: predicted ${sgn(c.pc[b], 1)} pp, observed ${sgn(c.oc[b], 1)} pp.`);
    }
    if (A) {
      A.svg.setAttribute('aria-label', `Accuracy by phase 0 to ${b} for ${run.name}, gates cycled by δ = ${dd}. ` +
        `After the cycle: ${c.obs.map(r0).join(', ')} percent. Predicted (uncycled shifted by ${dd}): ${c.pred.map(r0).join(', ')}. ` +
        `Uncycled: ${cl.map(r0).join(', ')}. Boundary phase ${b} is ${num(c.obs[b], 1)}% after the cycle against ${num(c.pred[b], 1)}% predicted.`);
    }
    subAcc.innerHTML = `mean ${mean(cl).toFixed(1)}% uncycled → <span class="ob">${c.accPct.toFixed(1)}%</span> after`;
    // segments never break inside; lines wrap only at the separators
    statusEl.innerHTML = [`<b>${esc(run.name)}</b>`, `δ = <b>${dd}</b>`,
      `R² (excl. phase ${b}) <b>${r3(c.r2x[0])}</b> [${r3(c.r2x[1])}, ${r3(c.r2x[2])}]`,
      `all phases ${r3(c.r2a[0])}`,
      `overall accuracy <b>${sgn(c.dAcc[0], 1)} pp</b> [${num(c.dAcc[1], 1)}, ${num(c.dAcc[2], 1)}]`]
      .map(t => `<span class="nw">${t}</span>`).join(' · ');
  }

  // ---------- R² index grid ----------
  const cells = [];
  const pOf = v => Math.max(0, Math.min(1, (v - 0.5) / 0.5)) * 45;
  const tint = v => `color-mix(in oklab, var(--accent) ${pOf(v).toFixed(1)}%, var(--bg))`;
  function buildGrid() {
    table.textContent = '';
    const cg = document.createElement('colgroup');
    const c0 = document.createElement('col'); c0.className = 'lab'; cg.appendChild(c0);
    DS.forEach(() => cg.appendChild(document.createElement('col')));
    table.appendChild(cg);
    const hr = table.createTHead().insertRow();
    const th0 = document.createElement('th'); th0.scope = 'col'; th0.textContent = 'cycle δ'; hr.appendChild(th0);
    DS.forEach(d => {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = fd(d); th.dataset.d = d;
      if (d === 1) th.classList.add('mid');
      hr.appendChild(th);
    });
    const tb = table.createTBody();
    let grp = null;
    runs.forEach((run, i) => {
      // group header rows: "W12/S12" over "1 KV" / "4 KV", and "W8/S8 · 1 KV" over "seed 42" / "seed 43" / "seed 44"
      const parts = run.name.split(' · '), cut = parts.length > 2 ? 2 : 1;
      const g = parts.length > 1 ? parts.slice(0, cut).join(' · ') : '', rest = parts.length > 1 ? parts.slice(cut).join(' · ') : run.name;
      if (g && g !== grp) {
        const gr = tb.insertRow(); gr.className = 'grp';
        const gth = document.createElement('th'); gth.colSpan = DS.length + 1; gth.scope = 'colgroup'; gth.textContent = g;
        gr.appendChild(gth);
      }
      const tr = tb.insertRow(); tr.dataset.run = run.id;
      if (i > 0 && g !== grp) tr.classList.add('gap');
      grp = g;
      const th = document.createElement('th'); th.scope = 'row';
      th.appendChild(document.createTextNode(rest));
      tr.appendChild(th);
      DS.forEach(d => {
        const c = cond(run, d), td = tr.insertCell();
        if (d === 1) td.classList.add('mid');
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cyc-cell'; b.tabIndex = -1;
        b.dataset.run = run.id; b.dataset.d = d;
        b.textContent = c.r2x[0].toFixed(2);
        b.style.background = tint(c.r2x[0]);
        b.setAttribute('aria-label', `${run.name}, δ = ${fd(d)}: R² ${c.r2x[0].toFixed(2)}`);
        b.addEventListener('click', () => {
          cells.forEach(x => { x.tabIndex = -1; }); b.tabIndex = 0;
          setState(run.id, d);
        });
        td.appendChild(b); cells.push(b);
      });
    });
    ramp.style.background = `linear-gradient(90deg, ${tint(0.5)}, ${tint(1)})`;
  }
  function paintGrid() {
    let cur = null;
    cells.forEach(b => {
      const on = !!st.d && b.dataset.run === st.run && +b.dataset.d === st.d;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) cur = b;
    });
    if (!table.contains(document.activeElement)) {
      // δ = 0 outlines no cell; the model's +1 cell stays the grid's tab stop
      const tab = cur || cells.find(b => b.dataset.run === st.run && +b.dataset.d === 1) || cells[0];
      cells.forEach(b => { b.tabIndex = b === tab ? 0 : -1; });
    }
    table.querySelectorAll('tbody tr[data-run]').forEach(tr => tr.classList.toggle('on', tr.dataset.run === st.run));
    table.querySelectorAll('thead th[data-d]').forEach(th => th.classList.toggle('on', +th.dataset.d === st.d));
  }
  table.addEventListener('keydown', e => {
    const b = e.target.closest && e.target.closest('.cyc-cell');
    if (!b) return;
    const i = cells.indexOf(b), n = DS.length, col = i % n;
    let j;
    switch (e.key) {
      case 'ArrowRight': j = col < n - 1 ? i + 1 : i; break;
      case 'ArrowLeft': j = col > 0 ? i - 1 : i; break;
      case 'ArrowDown': j = i + n < cells.length ? i + n : i; break;
      case 'ArrowUp': j = i - n >= 0 ? i - n : i; break;
      case 'Home': j = i - col; break;
      case 'End': j = i - col + n - 1; break;
      default: return;
    }
    e.preventDefault();
    cells.forEach(x => { x.tabIndex = -1; });
    cells[j].tabIndex = 0; cells[j].focus();
  });

  // ---------- tooltip ----------
  function showTip(html, cx, cy) {
    tip.innerHTML = html;
    tip.classList.add('on');
    const fr = fig.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = cx - fr.left + 14, y = cy - fr.top + 16;
    if (x + tw > fr.width) x = cx - fr.left - 14 - tw;
    x = Math.max(0, Math.min(x, fr.width - tw));
    if (y + th > fr.height) y = cy - fr.top - 12 - th;
    y = Math.max(0, y);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.classList.remove('on'); }
  const row = (k, v) => `<span class="k">${k}</span><span>${v}</span>`;
  function srcNote(r, S, d) {
    const src = mod(r - d, S);
    return `<span class="k">· predicted from phase ${src}${src === S - 1 ? ' (boundary)' : ''}</span>`;
  }
  function accTip(r) {
    const run = byId.get(st.run), S = run.S, cl = run.clean;
    if (!st.d) {
      return `<div><b>phase ${r}</b> <span class="k">· uncycled (δ = 0)</span></div><div class="cyc-tt">` +
        row('accuracy', `<b>${cl.acc[r].toFixed(1)}%</b> <span class="k">[${cl.lo[r].toFixed(1)}, ${cl.hi[r].toFixed(1)}]</span>`) + '</div>' +
        (r === S - 1 ? `<div class="k">boundary phase</div>` : '');
    }
    const c = cond(run, st.d);
    return `<div><b>phase ${r}</b> ${srcNote(r, S, st.d)}</div><div class="cyc-tt">` +
      row('observed', `<b>${c.obs[r].toFixed(1)}%</b> <span class="k">[${c.lo[r].toFixed(1)}, ${c.hi[r].toFixed(1)}]</span>`) +
      row('predicted', `${c.pred[r].toFixed(1)}%`) +
      row('uncycled', `${run.clean.acc[r].toFixed(1)}%`) + '</div>' +
      (r === S - 1 ? `<div class="k">boundary phase: not in R²</div>` : '');
  }
  function scTip(r) {
    const run = byId.get(st.run), c = cond(run, st.d), S = run.S;
    return `<div><b>phase ${r}</b> ${srcNote(r, S, st.d)}</div><div class="cyc-tt c3">` +
      '<span></span><span class="k">predicted</span><span class="k">observed</span>' +
      `<span class="k">change</span><span>${sgn(c.pc[r], 1)} pp</span><span><b>${sgn(c.oc[r], 1)} pp</b></span>` +
      `<span class="k">accuracy</span><span>${c.pred[r].toFixed(1)}%</span><span><b>${c.obs[r].toFixed(1)}%</b></span></div>` +
      (r === S - 1 ? `<div class="k">boundary phase: not in R²</div>` : '');
  }
  const bset = c => c.boundary.slice().sort((a, b) => a - b);
  function gridTip(run, c) {
    const bp = bset(c);
    return `<div><b>${esc(run.name)}</b> <span class="k">· δ = ${fd(c.d)}</span></div><div class="cyc-tt">` +
      row(`R² excl. phase ${run.S - 1}`, `<b>${r3(c.r2x[0])}</b> <span class="k">[${r3(c.r2x[1])}, ${r3(c.r2x[2])}]</span>`) +
      row(`excl. phases ${bp.join(', ')}`, r3(c.r2i[0])) +
      row('all phases', r3(c.r2a[0])) +
      row('accuracy change', `${sgn(c.dAcc[0], 1)} pp`) + '</div>';
  }
  function local(svg, e) {
    const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return [(e.clientX - b.left) * vb.width / b.width, (e.clientY - b.top) * vb.height / b.height];
  }
  function setHover(r) { if (hover !== r) { hover = r; paintHover(); } }
  function clearHover() { setHover(null); hideTip(); }
  function onAcc(e) {
    if (!A) return;
    const [x, y] = local(A.svg, e), { m, pw, ph, S, cw } = A;
    if (x < m.l || x > m.l + pw || y < m.t - 8 || y > m.t + ph + 8) { clearHover(); return; }
    const r = Math.max(0, Math.min(S - 1, Math.floor((x - m.l) / cw)));
    setHover(r); showTip(accTip(r), e.clientX, e.clientY);
  }
  function onSc(e) {
    if (!B || !shown) return;
    if (!st.d) { clearHover(); return; }
    const [x, y] = local(B.svg, e);
    let best = -1, bd = 22 * 22;
    for (let r = 0; r < B.S; r++) {
      const dx = B.X(shown.pc[r]) - x, dy = B.Y(shown.oc[r]) - y, q = dx * dx + dy * dy;
      if (q < bd) { bd = q; best = r; }
    }
    if (best < 0) { clearHover(); return; }
    setHover(best); showTip(scTip(best), e.clientX, e.clientY);
  }
  // a touch "leaves" as soon as the finger lifts: keep its tooltip until the next tap elsewhere
  const onLeave = e => { if (e.pointerType !== 'touch') clearHover(); };
  accBox.addEventListener('pointermove', onAcc);
  accBox.addEventListener('pointerdown', onAcc);
  accBox.addEventListener('pointerleave', onLeave);
  scBox.addEventListener('pointermove', onSc);
  scBox.addEventListener('pointerdown', onSc);
  scBox.addEventListener('pointerleave', onLeave);
  document.addEventListener('pointerdown', e => {
    if (hover != null && !accBox.contains(e.target) && !scBox.contains(e.target)) clearHover();
  }, { passive: true });
  table.addEventListener('pointermove', e => {
    const b = e.target.closest && e.target.closest('.cyc-cell');
    if (!b) { hideTip(); return; }
    const run = byId.get(b.dataset.run);
    showTip(gridTip(run, cond(run, +b.dataset.d)), e.clientX, e.clientY);
  });
  table.addEventListener('pointerleave', hideTip);

  // ---------- build, state, animation ----------
  function build() {
    const run = byId.get(st.run);
    const wA = Math.floor(accBox.clientWidth), wS = Math.floor(scBox.clientWidth);
    if (wA < 60 || wS < 60) return;
    lastW = [wA, wS];
    const side = Math.abs(accPanel.offsetTop - scPanel.offsetTop) < 2;
    const hS = buildSc(run, wS);
    buildAcc(run, wA, side ? hS : 252);
    describe();
    paint();
  }
  function cancelAnim() { if (raf) cancelAnimationFrame(raf); if (fin) clearTimeout(fin); raf = fin = 0; }
  function animateTo(tgt) {
    cancelAnim();
    if (reduced() || !shown || shown.run !== tgt.run) { shown = tgt; paint(); return; }
    const from = shown, t0 = performance.now(), end = T_OBS[1], tk = tgt.k > from.k ? T_IN : T_OUT;
    const finish = () => { cancelAnim(); shown = tgt; paint(); };
    const step = now => {
      const ms = now - t0;
      if (ms >= end) { finish(); return; }
      shown = mix(from, tgt, phase(ms, T_PRED), phase(ms, T_OBS), phase(ms, tk));
      paint();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    fin = setTimeout(finish, end + 100);   // rAF can stall (hidden tab, throttled frame): never leave stale marks
  }
  function syncControls() {
    if (sel.value !== st.run) sel.value = st.run;
    if (rng.value !== String(st.d)) rng.value = String(st.d);
    rng.setAttribute('aria-valuetext', st.d ? `δ = ${fd(st.d)}` : 'δ = 0, uncycled');
    dval.textContent = `δ = ${fd(st.d)}`;
    tickEls.forEach(t => t.classList.toggle('on', +t.dataset.v === st.d));
    setFill(st.d);
  }
  function setFill(v) {
    fillEl.style.left = `${(Math.min(v, 0) + 3) / 6 * 100}%`;
    fillEl.style.width = `${Math.abs(v) / 6 * 100}%`;
  }
  // while the thumb is dragged, the slider is continuous: blend the two neighbouring δ states
  function preview(v) {
    v = Math.max(-3, Math.min(3, v));
    const a = Math.min(2, Math.floor(v)), f = v - a, b = a + 1;
    const d = Math.round(v);
    if (d !== st.d) { st.d = d; hover = null; hideTip(); describe(); paintGrid(); }
    dval.textContent = `δ = ${fd(d)}`;
    tickEls.forEach(t => t.classList.toggle('on', +t.dataset.v === d));
    setFill(v);
    cancelAnim();
    shown = mix(target(a), target(b), f, f, f);
    paint();
  }
  // instant: while the thumb is dragged, follow it frame by frame; otherwise slide (≤ 300 ms)
  function setState(runId, d, instant, force) {
    if (!byId.has(runId) || !DV.includes(d)) return;
    const runChanged = runId !== st.run;
    if (!runChanged && d === st.d && !force) { syncControls(); return; }
    st.run = runId; st.d = d;
    syncControls();
    hover = null; hideTip();
    if (runChanged) {
      cancelAnim(); shown = target(); build();
      if (!reduced()) [A, B].forEach(h => {
        if (!h) return;
        h.svg.classList.add('enter');
        void h.svg.getBoundingClientRect();
        h.svg.classList.remove('enter');
      });
    } else if (instant) {
      cancelAnim(); shown = target(); describe(); paint();
    } else {
      describe();
      animateTo(target());
    }
    paintGrid();
  }

  sel.addEventListener('change', () => setState(sel.value, st.d));
  let dragging = false;
  rng.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointercancel', () => snap(), { passive: true });
  // pointer drags glide continuously and snap to the nearest δ on release; keys and clicks step by one
  const snap = () => { if (!dragging) return; dragging = false; setState(st.run, Math.round(+rng.value), false, true); };
  rng.addEventListener('input', () => { if (dragging && !reduced()) preview(+rng.value); else setState(st.run, Math.round(+rng.value)); });
  rng.addEventListener('change', snap);
  window.addEventListener('pointerup', snap, { passive: true });
  rng.addEventListener('keydown', e => {
    const k = e.key, step = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[k];
    let d = null;
    if (step) d = st.d + step; else if (k === 'Home') d = -3; else if (k === 'End') d = 3;
    if (d == null) return;
    e.preventDefault();
    setState(st.run, Math.max(-3, Math.min(3, d)));
  });
  ticksBox.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-v]');
    if (t) setState(st.run, +t.dataset.v);
  });

  buildGrid();
  syncControls();
  shown = target();
  build();
  describe();
  paintGrid();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => describe());

  if (window.ResizeObserver) {
    let pend = 0;
    new ResizeObserver(() => {
      if (pend) return;
      pend = requestAnimationFrame(() => {
        pend = 0;
        const wA = Math.floor(accBox.clientWidth), wS = Math.floor(scBox.clientWidth);
        if (wA !== lastW[0] || wS !== lastW[1]) { hover = null; hideTip(); build(); }
      });
    }).observe(fig);
  }
})();
