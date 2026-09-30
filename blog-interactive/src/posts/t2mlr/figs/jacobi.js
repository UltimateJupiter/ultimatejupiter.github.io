/* Figure 2 · Jacobi approximation of the recurrent cache (fx-jacobi).
   A toy T²MLR middle block with random weights: Eq. 2.3 (fusion), Eq. 2.4 (cache update) and
   Algorithm 1 (temporal-parallel Jacobi iterations), compared with the exact sequential recurrence.
   Left: relative error of R<k> at each position t (heatmap). Right: max over t against k (log scale). */
(function () {
  'use strict';
  const fig = document.getElementById('fx-jacobi');
  if (!fig) return;

  /* ---------- model: a line-for-line port of the reference check (check.mjs) ---------- */
  const D = 16, T = 48, NL = 2, K = 32, SEED0 = 7;

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeGauss(r) { return () => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }; }
  const mat = (g, m, n, sc) => Array.from({ length: m }, () => Float64Array.from({ length: n }, () => g() * sc));
  function mv(M, x) {
    const out = new Float64Array(M.length);
    for (let i = 0; i < M.length; i++) { const row = M[i]; let s = 0; for (let j = 0; j < row.length; j++) s = s + row[j] * x[j]; out[i] = s; }
    return out;
  }
  function rms(x) {           // RMSNorm, no gain, eps 1e-6
    let ss = 0; for (let i = 0; i < x.length; i++) ss = ss + x[i] * x[i];
    const n = Math.sqrt(ss / x.length + 1e-6), out = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = x[i] / n;
    return out;
  }
  function rmsCache(x) {      // Eq. 2.4 / Alg. 1 line 8: RMSNorm, but the zero vector stays zero
    let ss = 0; for (let i = 0; i < x.length; i++) ss = ss + x[i] * x[i];
    return ss === 0 ? new Float64Array(x.length) : rms(x);
  }
  const sig = z => 1 / (1 + Math.exp(-z));
  const gelu = z => 0.5 * z * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z * z * z)));
  function addv(a, b) { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] + b[i]; return o; }

  function build(seed) {
    const g = makeGauss(rng(seed)), s1 = 1 / Math.sqrt(D);
    const layers = [];
    for (let i = 0; i < NL; i++) layers.push({
      Wq: mat(g, D, D, s1), Wk: mat(g, D, D, s1), Wv: mat(g, D, D, s1), Wo: mat(g, D, D, s1),
      W1: mat(g, 4 * D, D, s1), W2: mat(g, D, 4 * D, 1 / Math.sqrt(4 * D)),
    });
    const fcur = mat(g, D, 2 * D, 1 / Math.sqrt(2 * D)), frec = mat(g, D, 2 * D, 1 / Math.sqrt(2 * D)), Wrec = mat(g, D, D, s1);
    const Hs = Array.from({ length: T }, () => Float64Array.from({ length: D }, () => g()));   // stands in for layers 1..l_start-1
    return { layers, fcur, frec, Wrec, Hs };
  }
  // One token through the middle block (pre-norm causal attention + GELU MLP per layer), appending to per-layer KV caches.
  // Row t depends only on rows 0..t, so this gives exactly the rows of a full causal pass.
  function rowPass(P, x, C) {
    let h = x;
    const sq = Math.sqrt(D);
    for (let l = 0; l < P.layers.length; l++) {
      const Ly = P.layers[l], c = C[l];
      const n = rms(h), q = mv(Ly.Wq, n);
      c.K.push(mv(Ly.Wk, n)); c.V.push(mv(Ly.Wv, n));
      const t = c.K.length - 1, sc = new Float64Array(t + 1);
      let m = -Infinity;
      for (let s = 0; s <= t; s++) { const k = c.K[s]; let a = 0; for (let j = 0; j < D; j++) a = a + q[j] * k[j]; sc[s] = a / sq; if (sc[s] > m) m = sc[s]; }
      let Z = 0; for (let s = 0; s <= t; s++) { sc[s] = Math.exp(sc[s] - m); Z = Z + sc[s]; }
      const o = new Float64Array(D);
      for (let s = 0; s <= t; s++) { const v = c.V[s], w = sc[s] / Z; for (let j = 0; j < D; j++) o[j] += w * v[j]; }
      h = addv(h, mv(Ly.Wo, o));
      const u = mv(Ly.W1, rms(h)); for (let i = 0; i < u.length; i++) u[i] = gelu(u[i]);
      h = addv(h, mv(Ly.W2, u));
    }
    return h;
  }
  const newCaches = P => P.layers.map(() => ({ K: [], V: [] }));
  function Fmid(P, X) { const C = newCaches(P); return X.map(x => rowPass(P, x, C)); }
  // Eq. 2.3: Φ(h,R) = h + tanh(γ_cur)·σ(f_cur([h,R]))⊙h + tanh(γ_rec)·σ(f_rec([h,R]))⊙(W_rec R)
  function Phi(P, h, R, gc, gr) {
    const c = new Float64Array(2 * D); c.set(h, 0); c.set(R, D);
    const a = mv(P.fcur, c), b = mv(P.frec, c), wr = mv(P.Wrec, R), tc = Math.tanh(gc), tr = Math.tanh(gr), out = new Float64Array(D);
    for (let i = 0; i < D; i++) out[i] = h[i] + tc * sig(a[i]) * h[i] + tr * sig(b[i]) * wr[i];
    return out;
  }
  // Exact sequential recurrence. Rin[t] is the cache token t reads (R_{t-1} in the paper); Rin[0] = 0.
  function exact(P, gc, gr) {
    const C = newCaches(P), Rin = [new Float64Array(D)];
    for (let t = 0; t < T; t++) {
      const hend = rowPass(P, Phi(P, P.Hs[t], Rin[t], gc, gr), C);
      Rin.push(rmsCache(addv(hend, Rin[t])));
    }
    return Rin.slice(0, T);
  }
  // Algorithm 1: returns iters[k-1] = R<k>, k = 1..K.
  function jacobi(P, gc, gr) {
    const shift = A => [new Float64Array(D)].concat(A.slice(0, T - 1));
    const iters = [];
    let R = shift(Fmid(P, P.Hs));                                               // lines 2-3: one pass without fusion
    iters.push(R);
    for (let k = 2; k <= K; k++) {
      const Hk = Fmid(P, P.Hs.map((h, t) => Phi(P, h, R[t], gc, gr)));        // line 5
      R = shift(Hk.map((h, t) => addv(h, R[t]))).map(rmsCache);               // line 8
      iters.push(R);
    }
    return iters;
  }
  const norm = x => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s); };
  function run(P, gc, gr) {
    const Rs = exact(P, gc, gr), it = jacobi(P, gc, gr);
    const E = new Float64Array(K * T), worst = new Float64Array(K), worstT = new Int16Array(K);
    for (let k = 0; k < K; k++) {
      let mx = -1, at = 0;
      for (let t = 1; t < T; t++) {
        const r = it[k][t], x = Rs[t], dlt = new Float64Array(D);
        for (let i = 0; i < D; i++) dlt[i] = r[i] - x[i];
        const e = norm(dlt) / norm(x);
        E[k * T + t] = e;
        if (e > mx) { mx = e; at = t; }
      }
      worst[k] = mx; worstT[k] = at;
    }
    return { E, worst, worstT };
  }
  /* ---------- end of model ---------- */

  const NS = 'http://www.w3.org/2000/svg', MINUS = '−';
  const $ = id => document.getElementById(id);
  const heat = $('fx-jacobi-heat'), hsvg = $('fx-jacobi-hsvg'), lbox = $('fx-jacobi-line'), lsvg = $('fx-jacobi-lsvg'),
        selDf = $('fx-jacobi-df'), bNew = $('fx-jacobi-new'), bReset = $('fx-jacobi-reset'),
        note = $('fx-jacobi-note'), status = $('fx-jacobi-status');
  const sliders = Array.from(fig.querySelectorAll('.jb-sl')).map(w => ({
    inp: w.querySelector('.jb-range'), out: w.querySelector('.jb-val'), fill: w.querySelector('.jb-fill'),
    key: w.querySelector('.jb-range').dataset.g,
  }));
  const tip = document.createElement('div'); tip.className = 'fx-tip'; tip.setAttribute('aria-hidden', 'true'); fig.appendChild(tip);

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const f1 = v => (Math.round(v * 10) / 10);
  const sg = v => { const r = f1(v); return r === 0 ? '0' : (r < 0 ? MINUS : '+') + Math.abs(r).toFixed(1); };
  const plainG = v => { const r = f1(v); return (r < 0 ? MINUS : '') + Math.abs(r).toFixed(1).replace(/\.0$/, ''); };
  // numbers: 0.1 ≤ v < 10 as two significant digits, otherwise m.m×10^e
  function sci(v, html) {
    if (v === 0) return '0';
    if (v >= 0.1 && v < 10) return v.toPrecision(2);
    const s = v.toExponential(1).split('e'), ex = +s[1];
    const e = (ex < 0 ? MINUS : '') + Math.abs(ex);
    return html ? s[0] + '×10<sup>' + e + '</sup>' : s[0] + '×10^' + e;
  }
  function tick10(parent, x, y, ex, anchor) {        // "10" with a raised exponent (or "1")
    const t = el('text', { x: x, y: y, 'text-anchor': anchor || 'end' }, parent);
    if (ex === 0) { t.textContent = '1'; return t; }
    t.appendChild(document.createTextNode('10'));
    el('tspan', { dy: -4, class: 'ex' }, t, (ex < 0 ? MINUS : '') + Math.abs(ex));
    return t;
  }

  /* ---------- state + computation ---------- */
  const DEF = { grec: 0.5, gcur: -0.5, df: 16, seed: SEED0 };
  const st = { grec: DEF.grec, gcur: DEF.gcur, df: DEF.df, seed: DEF.seed, hk: -1, ht: -1, lk: -1, ck: -1, ct: -1 };
  let P = null, pSeed = -1, zero = null, res = null;
  function compute() {
    if (pSeed !== st.seed) { P = build(st.seed); pSeed = st.seed; zero = run(P, 0, 0); }
    res = (f1(st.grec) === 0 && f1(st.gcur) === 0) ? zero : run(P, st.gcur, st.grec);
  }
  let pending = 0;
  function schedule() {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; compute(); paint(); });
  }

  /* ---------- heatmap ---------- */
  let H = null, cells = [], hOv = null, yTicks = {};
  function layoutH(W) {
    const mL = 30, mR = 2, top = 18, pw = W - mL - mR, cw = pw / T;
    const ch = clamp(Math.round(cw * 0.9 * 4) / 4, 4, 6.5), rowsH = K * ch;
    return { W, mL, mR, top, pw, cw, ch, rowsH, xl: top + rowsH + 15, Hh: top + rowsH + 20 };
  }
  const hx = t => Math.round(H.mL + t * H.cw);
  const hy = k => Math.round(H.top + (k - 1) * H.ch);
  function drawH() {
    const W = Math.round(heat.clientWidth); if (!W) return;
    H = layoutH(W);
    hsvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H.Hh); hsvg.setAttribute('width', W); hsvg.setAttribute('height', H.Hh);
    hsvg.textContent = '';
    const g = el('g', { 'shape-rendering': 'crispEdges' }, hsvg);
    cells = new Array(K * T);
    for (let k = 1; k <= K; k++) for (let t = 0; t < T; t++) {
      cells[(k - 1) * T + t] = el('rect', { x: hx(t), y: hy(k), width: hx(t + 1) - hx(t), height: hy(k + 1) - hy(k) }, g);
    }
    // frontier t = k − 1: positions to its left are exact by construction (ShiftRight)
    let d = 'M' + hx(1) + ',' + hy(1);
    for (let k = 1; k <= K; k++) d += 'V' + hy(k + 1) + (k < K ? 'H' + hx(k + 1) : '');
    el('path', { class: 'front', d: d }, hsvg);
    el('text', { class: 'exl', x: H.mL + 3, y: hy(K - 1) - 3 }, hsvg, 'exact by construction');
    // axes
    el('text', { x: H.mL - 7, y: 11, 'text-anchor': 'end' }, hsvg, 'k');
    yTicks = {};
    [1, 4, 8, 16, 32].forEach(k => { yTicks[k] = el('text', { x: H.mL - 7, y: (hy(k) + hy(k + 1)) / 2 + 3.6, 'text-anchor': 'end' }, hsvg, String(k)); });
    [0, 15, 31, 47].forEach(t => el('text', { x: (hx(t) + hx(t + 1)) / 2, y: H.xl, 'text-anchor': 'middle' }, hsvg, String(t + 1)));   // positions shown 1-based, as in the text
    el('text', { x: H.mL - 7, y: H.xl, 'text-anchor': 'end' }, hsvg, 't');
    hOv = el('g', {}, hsvg);
    el('rect', { class: 'hit', x: H.mL, y: H.top, width: H.pw, height: H.rowsH }, hsvg);
    paintH();
  }
  function fillOf(e) {
    if (!(e > 0)) return 'var(--bg)';
    const p = Math.round(clamp((Math.log10(e) + 6) / 6, 0, 1) * 100);
    return p < 1 ? 'var(--bg)' : 'color-mix(in oklab, var(--loss) ' + p + '%, var(--bg))';
  }
  function paintH() {
    if (!H || !res) return;
    for (let i = 0; i < K * T; i++) cells[i].style.fill = fillOf(res.E[i]);
    drawHOv();
    const w = res.worst;
    hsvg.setAttribute('aria-label', 'Relative error of the parallel cache at positions t = 1 to 48 after k = 1 to 32 Jacobi iterations. Positions t ≤ k are exact. Worst position: ' +
      [1, 4, 8, 16, 32].map(k => 'k = ' + k + ' ' + sci(w[k - 1])).join(', ') + '. Row k = ' + st.df + ' outlined.');
  }
  function curCell() {                 // heatmap hover, then line-chart hover (row only), then keyboard cursor
    if (st.hk > 0) return [st.hk, st.ht];
    if (st.lk > 0) return [st.lk, -1];
    if (st.ck > 0) return [st.ck, st.ct];
    return null;
  }
  function drawHOv() {
    if (!hOv) return;
    hOv.textContent = '';
    const r = st.df;
    el('rect', { class: 'dfrow', x: H.mL - 0.75, y: hy(r) - 0.75, width: H.pw + 1.5, height: hy(r + 1) - hy(r) + 1.5 }, hOv);
    Object.keys(yTicks).forEach(k => yTicks[k].setAttribute('class', +k === st.df ? 'df' : ''));
    const c = curCell();
    if (c) {
      const [k, t] = c;
      el('rect', { class: 'hrow', x: H.mL - 0.5, y: hy(k) - 0.5, width: H.pw + 1, height: hy(k + 1) - hy(k) + 1 }, hOv);
      if (t >= 0) el('rect', { class: 'hcell', x: hx(t) - 1, y: hy(k) - 1, width: hx(t + 1) - hx(t) + 2, height: hy(k + 1) - hy(k) + 2 }, hOv);
    }
  }
  function hPoint(ev) {
    const b = hsvg.getBoundingClientRect(); if (!H || !b.width) return null;
    const s = H.W / b.width, x = (ev.clientX - b.left) * s, y = (ev.clientY - b.top) * s;
    if (x < H.mL || x > H.mL + H.pw || y < H.top || y > H.top + H.rowsH) return null;
    return { t: clamp(Math.floor((x - H.mL) / H.cw), 0, T - 1), k: clamp(Math.floor((y - H.top) / H.ch) + 1, 1, K) };
  }
  function cellTip(k, t) {
    const e = res.E[(k - 1) * T + t];
    let s = '<b>iteration k = ' + k + ', token t = ' + (t + 1) + '</b><br>';
    if (t <= k - 1) s += '<span class="k">relative error</span> ' + (e < 1e-12 ? '0' : sci(e, true)) + '<br><span class="k">exact by construction</span>';
    else s += '<span class="k">relative error</span> ' + sci(e, true);
    return s;
  }
  function onHMove(ev) {
    const p = hPoint(ev);
    if (!p) { if (st.hk !== -1) { st.hk = -1; st.ht = -1; drawHOv(); drawLOv(); } hideTip(); return; }
    if (p.k !== st.hk || p.t !== st.ht) { st.hk = p.k; st.ht = p.t; drawHOv(); drawLOv(); }
    showTip(ev, cellTip(p.k, p.t));
  }
  hsvg.addEventListener('pointermove', onHMove);
  hsvg.addEventListener('pointerdown', onHMove);
  hsvg.addEventListener('pointerleave', () => { st.hk = -1; st.ht = -1; hideTip(); drawHOv(); drawLOv(); });
  heat.addEventListener('keydown', ev => {
    let k = st.ck, t = st.ct;
    if (k < 0) { k = st.df; t = st.df; }
    switch (ev.key) {
      case 'ArrowUp': if (st.ck > 0) k = Math.max(1, k - 1); break;
      case 'ArrowDown': if (st.ck > 0) k = Math.min(K, k + 1); break;
      case 'ArrowLeft': if (st.ck > 0) t = Math.max(0, t - 1); break;
      case 'ArrowRight': if (st.ck > 0) t = Math.min(T - 1, t + 1); break;
      case 'Home': t = 0; break;
      case 'End': t = T - 1; break;
      case 'PageUp': k = Math.max(1, k - 4); break;
      case 'PageDown': k = Math.min(K, k + 4); break;
      case 'Escape': if (st.ck < 0) return; k = -1; t = -1; break;
      default: return;
    }
    ev.preventDefault();
    st.ck = k; st.ct = t;
    drawHOv(); drawLOv(); updStatus();
  });
  heat.addEventListener('blur', () => { if (st.ck > 0) { st.ck = -1; st.ct = -1; drawHOv(); drawLOv(); updStatus(); } });

  /* ---------- line chart ---------- */
  let L = null, lOv = null;
  const LMIN = -10, LMAX = 1;   // down to 1e-10 so the γ = 0 curve (1.4e-9 at k = 32, seed 7) stays above the floor
  function layoutL(W) {
    const mL = 38, mR = 10, top = H ? H.top : 18, rowsH = H ? H.rowsH : 180;
    return { W, mL, mR, top, pw: W - mL - mR, ph: rowsH, xl: top + rowsH + 15, Hh: top + rowsH + 20 };
  }
  const lx = k => L.mL + (k - 1) / (K - 1) * L.pw;
  const ly = v => L.top + (1 - (clamp(Math.log10(Math.max(v, 1e-300)), LMIN, LMAX) - LMIN) / (LMAX - LMIN)) * L.ph;
  const f2 = v => (Math.round(v * 100) / 100).toString();
  const pathOf = a => Array.from(a, (v, i) => (i ? 'L' : 'M') + f2(lx(i + 1)) + ',' + f2(ly(v))).join('');
  let lSel = null, lZero = null, lDf = null, lDfLab = null, lLabs = null;
  function drawL() {
    const W = Math.round(lbox.clientWidth); if (!W) return;
    L = layoutL(W);
    lsvg.setAttribute('viewBox', '0 0 ' + W + ' ' + L.Hh); lsvg.setAttribute('width', W); lsvg.setAttribute('height', L.Hh);
    lsvg.textContent = '';
    const g = el('g', { 'shape-rendering': 'crispEdges' }, lsvg);
    for (let ex = LMIN; ex <= 0; ex += 2) {
      const y = Math.round(ly(Math.pow(10, ex))) + 0.5;
      el('line', { class: 'gr', x1: L.mL, x2: L.mL + L.pw, y1: y, y2: y }, g);
      tick10(lsvg, L.mL - 7, y + 3.6, ex);
    }
    el('line', { class: 'ax', x1: L.mL + 0.5, x2: L.mL + 0.5, y1: L.top, y2: L.top + L.ph }, g);
    el('line', { class: 'ax', x1: L.mL, x2: L.mL + L.pw, y1: Math.round(L.top + L.ph) + 0.5, y2: Math.round(L.top + L.ph) + 0.5 }, g);
    [1, 4, 8, 16, 32].forEach(k => el('text', { x: lx(k), y: L.xl, 'text-anchor': 'middle' }, lsvg, String(k)));
    el('text', { x: L.mL - 14, y: L.xl, 'text-anchor': 'end' }, lsvg, 'k');
    lDf = el('line', { class: 'dfm', y1: L.top - 4, y2: L.top + L.ph }, lsvg);
    lDfLab = el('text', { class: 'dfl', y: 10 }, lsvg);
    lZero = el('path', { class: 'l0' }, lsvg);
    lSel = el('path', { class: 'l1' }, lsvg);
    lLabs = el('g', {}, lsvg);
    lOv = el('g', {}, lsvg);
    el('rect', { class: 'hit', x: L.mL - 4, y: 0, width: L.pw + 8, height: L.Hh }, lsvg);
    paintL();
  }
  function paintL() {
    if (!L || !res) return;
    lZero.setAttribute('d', pathOf(zero.worst));
    lSel.setAttribute('d', pathOf(res.worst));
    placeDf();
    // direct labels: the selected setting above its line, γ = 0 below its line, at a k where they separate
    lLabs.textContent = '';
    const same = res === zero;
    // the curves fall to the right, so the space above-right and below-left of a line stays clear;
    // pick the first k whose label does not cross the d_forward marker
    const xm = lx(st.df), cw = 6.4;
    const pick = (ks, w, right) => ks.find(k => { const x0 = right ? lx(k) + 5 : lx(k) - 4 - w, x1 = x0 + w; return xm < x0 - 4 || xm > x1 + 4; }) || ks[0];
    const t1 = same ? 'γ = 0 (as set)' : 'as set';
    const kl = pick([3, 5, 9, 12], t1.length * cw, true);
    el('text', { class: 'lab1', x: lx(kl) + 5, y: Math.max(L.top + 9, ly(res.worst[kl - 1]) - 7) }, lLabs, t1);
    if (!same) {
      const kz = pick([9, 12, 7, 20], 5 * cw, false);
      el('text', { class: 'lab0', x: lx(kz) - 4, y: Math.min(L.top + L.ph - 4, ly(zero.worst[kz - 1]) + 13), 'text-anchor': 'end' }, lLabs, 'γ = 0');
    }
    drawLOv();
    const w = res.worst, z = zero.worst;
    lsvg.setAttribute('aria-label', 'Worst-position relative error against iterations k = 1 to 32, log scale. Gates as set: ' +
      [1, 4, 8, 16, 32].map(k => 'k = ' + k + ' ' + sci(w[k - 1])).join(', ') + '. Both gates at 0: ' +
      [1, 4, 8, 16, 32].map(k => 'k = ' + k + ' ' + sci(z[k - 1])).join(', ') + '. Marker at d forward = ' + st.df + '.');
  }
  function placeDf() {
    if (!L) return;
    const x = Math.round(lx(st.df)) + 0.5;
    lDf.setAttribute('x1', x); lDf.setAttribute('x2', x);
    const right = x + 100 > L.mL + L.pw;
    lDfLab.setAttribute('x', right ? x - 4 : x + 4);
    lDfLab.setAttribute('text-anchor', right ? 'end' : 'start');
    lDfLab.textContent = '';
    lDfLab.appendChild(document.createTextNode('d'));
    el('tspan', { class: 'sb', dy: 3 }, lDfLab, 'forward');
    el('tspan', { dy: -3 }, lDfLab, ' = ' + st.df);
  }
  function lineK() { const c = curCell(); return c ? c[0] : -1; }
  function drawLOv() {
    if (!lOv) return;
    lOv.textContent = '';
    const k = lineK(); if (k < 1) return;
    const x = Math.round(lx(k)) + 0.5;
    el('line', { class: 'hair', x1: x, x2: x, y1: L.top, y2: L.top + L.ph }, lOv);
    el('circle', { class: 'd0', cx: f2(lx(k)), cy: f2(ly(zero.worst[k - 1])), r: 3 }, lOv);
    el('circle', { class: 'd1', cx: f2(lx(k)), cy: f2(ly(res.worst[k - 1])), r: 3.5 }, lOv);
  }
  function lineTip(k) {
    return '<b>iteration k = ' + k + '</b><div class="jb-tt">' +
      '<span class="k">as set</span><span>' + sci(res.worst[k - 1], true) + ' <span class="k">at t = ' + (res.worstT[k - 1] + 1) + '</span></span>' +
      '<span class="k">γ = 0</span><span>' + sci(zero.worst[k - 1], true) + ' <span class="k">at t = ' + (zero.worstT[k - 1] + 1) + '</span></span></div>';
  }
  function onLMove(ev) {
    if (!L) return;
    const b = lsvg.getBoundingClientRect(); if (!b.width) return;
    const x = (ev.clientX - b.left) * L.W / b.width;
    const k = clamp(Math.round((x - L.mL) / L.pw * (K - 1)) + 1, 1, K);
    if (k !== st.lk) { st.lk = k; drawLOv(); drawHOv(); }
    showTip(ev, lineTip(k));
  }
  lsvg.addEventListener('pointermove', onLMove);
  lsvg.addEventListener('pointerdown', onLMove);
  lsvg.addEventListener('pointerleave', () => { st.lk = -1; hideTip(); drawLOv(); drawHOv(); });

  /* ---------- tooltip ---------- */
  function showTip(ev, html) {
    tip.innerHTML = html; tip.classList.add('on');
    const fr = fig.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = ev.clientX - fr.left + 14, y = ev.clientY - fr.top + 16;
    if (x + tw > fr.width) x = ev.clientX - fr.left - 14 - tw;
    if (y + th > fr.height) y = ev.clientY - fr.top - 12 - th;
    tip.style.left = clamp(x, 0, Math.max(0, fr.width - tw)) + 'px';
    tip.style.top = clamp(y, 0, Math.max(0, fr.height - th)) + 'px';
  }
  function hideTip() { tip.classList.remove('on'); }

  /* ---------- text ---------- */
  const gTxt = () => 'γ<sub>rec</sub> = ' + plainG(st.grec) + ', γ<sub>cur</sub> = ' + plainG(st.gcur);
  function updStatus() {
    if (!res) return;
    const df = st.df, w = res.worst[df - 1];
    let s = '<b>d<sub>forward</sub> = ' + df + '</b>: positions 1–' + df + ' are exact, and the worst of positions ' + (df + 1) + '–' + T +
      ' has relative error <b>' + sci(w, true) + '</b> (' + gTxt() + ')';
    s += res === zero ? '.' : '; with both gates at 0 it is ' + sci(zero.worst[df - 1], true) + '.';
    if (st.ck > 0) {
      const k = st.ck, t = st.ct, e = res.E[(k - 1) * T + t];
      s += ' Cursor: k = ' + k + ', t = ' + (t + 1) + ', relative error ' + (t <= k - 1 ? (e < 1e-12 ? '0' : sci(e, true)) + ', exact by construction' : sci(e, true)) +
        '; worst at this k ' + sci(res.worst[k - 1], true) + '.';
    }
    status.innerHTML = s;
  }
  const coarse = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
  function updNote() {
    note.textContent = 'random weights, seed ' + st.seed + ' · d = ' + D + ', T = ' + T + ', 2 layers · ' +
      (coarse ? 'tap a cell or the chart for values' : 'focus the map and use the arrow keys to read cells');
  }

  /* ---------- controls ---------- */
  function syncSliders() {
    sliders.forEach(s => {
      const v = s.key === 'rec' ? st.grec : st.gcur, p = (v + 2) / 4;
      s.inp.value = String(v);
      s.out.textContent = sg(v);
      s.inp.setAttribute('aria-valuetext', (s.key === 'rec' ? 'gamma rec ' : 'gamma cur ') + plainG(v));
      s.fill.style.left = (Math.min(p, 0.5) * 100) + '%';
      s.fill.style.width = (Math.abs(p - 0.5) * 100) + '%';
    });
  }
  sliders.forEach(s => {
    s.inp.setAttribute('aria-label', s.key === 'rec' ? 'gamma rec, the gate on the recurrent term' : 'gamma cur, the gate on the current term');
    s.inp.addEventListener('input', () => {
      const v = f1(+s.inp.value);
      if (s.key === 'rec') st.grec = v; else st.gcur = v;
      syncSliders(); schedule();
    });
  });
  selDf.addEventListener('change', () => { st.df = +selDf.value || 16; drawHOv(); placeDf(); paintH(); paintL(); updStatus(); });
  bNew.addEventListener('click', () => { st.seed += 1; updNote(); schedule(); });
  bReset.addEventListener('click', () => {
    st.grec = DEF.grec; st.gcur = DEF.gcur; st.df = DEF.df; st.seed = DEF.seed;
    selDf.value = String(DEF.df); selDf.dispatchEvent(new Event('change', { bubbles: true }));
    syncSliders(); updNote(); schedule();
  });

  function paint() { paintH(); paintL(); updStatus(); }
  let lastW = 0;
  function renderAll() { lastW = Math.round(fig.clientWidth); drawH(); drawL(); }
  syncSliders(); updNote(); compute(); renderAll(); updStatus();
  if (window.ResizeObserver) {
    new ResizeObserver(() => { const w = Math.round(fig.clientWidth); if (w && w !== lastW) renderAll(); }).observe(fig);
  }
})();
