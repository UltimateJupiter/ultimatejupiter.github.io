/* Figure 4 (fx-grad-acc): gradient prediction accuracy when rules are missing from the context, computed live.
   Soft surrogate SURR-MLT (paper App. G.5): V_{i+1} = SoftMax(T (C_i + W_i)) Shift(V_i), T = 25, cross-entropy averaged
   over columns, evaluated at W = 0 for every layer (an ICL-capable model), n = 10, d = 10, strings of 1,000 pairs.
   For each dropped rule c of phrasebook 1 we take the batch gradient on W_1[:, c] and ask whether it points at the
   correct output pair (Def. B.1: argmax of the negative gradient; "sign": the correct entry's gradient is negative,
   the quantity the released code and the paper's Figure 6 report). Monte Carlo over random strings and drop sets,
   time-sliced on the main thread and paused off-screen. */
(function () {
  'use strict';
  var fig = document.getElementById('fx-grad-acc');
  if (!fig) return;

  /* ENGINE-BEGIN (exact gradients at W = 0, O(n^2) per column per layer) */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeEngine(n, d, L, permSeed) {
    var N2 = n * n, T = 25;
    var Z = Math.exp(T) + N2 - 1, q = Math.exp(T) / Z, eps = 1 / Z, qe = q - eps, u = 1 / N2;
    // Pi*: d fixed random permutations of the n^2 pairs (Fisher-Yates, seeded)
    var pr = mulberry32(permSeed), perms = [], i, j;
    for (i = 0; i < d; i++) {
      var p = new Int32Array(N2);
      for (j = 0; j < N2; j++) p[j] = j;
      for (j = N2 - 1; j > 0; j--) { var k = Math.floor(pr() * (j + 1)), s = p[j]; p[j] = p[k]; p[k] = s; }
      perms.push(p);
    }
    var PA = [], PB = [], PI = [];                // pi_i(c) split into its two characters; inverse permutation
    for (i = 0; i < d; i++) {
      var pa = new Int32Array(N2), pb = new Int32Array(N2), pi = new Int32Array(N2);
      for (j = 0; j < N2; j++) { pa[j] = (perms[i][j] / n) | 0; pb[j] = perms[i][j] % n; pi[perms[i][j]] = j; }
      PA.push(pa); PB.push(pb); PI.push(pi);
    }
    var M1 = [], M2 = [], KQ = [], KP = [], KD = [], KA = [];
    for (i = 0; i < d; i++) {
      M1.push(new Float64Array(n * L)); M2.push(new Float64Array(n * L));   // marginals of layer i's input
      KQ.push(new Float64Array(N2)); KP.push(new Float64Array(N2)); KD.push(new Float64Array(N2)); KA.push(new Float64Array(N2));
    }
    var x = new Int32Array(L), y = new Int32Array(L), s0 = new Int32Array(L), s1 = new Int32Array(L), c1 = new Int32Array(L);
    var pOut = new Float64Array(L);
    var dA1 = new Float64Array(n * L), dA2 = new Float64Array(n * L), dB1 = new Float64Array(n * L), dB2 = new Float64Array(n * L);

    /* One random string of L pairs: add d(loss)/dP_1[:, c] to gP (m x N2, slot-major) for every dropped column c of
       layer 1 (slot[c] >= 0). drop: Uint8Array(N2) of dropped columns, applied to layers 1..k.
       P_i column c = eps + (q - eps) e_{pi_i(c)} if present, uniform 1/n^2 if dropped (softmax of 25 (C_i + 0)). */
    function sequence(rng, drop, k, slot, gP) {
      var t, t1, a, b, xx, yy, c, v, w, mx, li, tn, t1n, cb, p, kq, kp, kd, ka, pa, pb;
      for (li = 0; li < d; li++) {
        kq = KQ[li]; kp = KP[li]; kd = KD[li]; ka = KA[li];
        for (c = 0; c < N2; c++) {
          var dr = li < k && drop[c];
          kq[c] = dr ? 0 : qe; kp[c] = dr ? 0 : 1; kd[c] = dr ? 1 : 0; ka[c] = dr ? u : eps;
        }
      }
      for (t = 0; t < L; t++) x[t] = Math.floor(rng() * N2);
      // exact label MLT_Pi*(s1): circular shift left by one, then translate each pair
      var src = s0, dst = s1, tmp;
      for (t = 0; t < L; t++) src[t] = x[t];
      for (li = 0; li < d; li++) {
        p = perms[li];
        for (t = 0; t < L; t++) { t1 = t + 1 === L ? 0 : t + 1; dst[t] = p[(src[t] % n) * n + ((src[t1] / n) | 0)]; }
        tmp = src; src = dst; dst = tmp;
      }
      for (t = 0; t < L; t++) y[t] = src[t];
      // layer-1 input: one-hot pairs; its shifted column is one-hot at b_t * n + a_{t+1}
      var m1 = M1[0], m2 = M2[0];
      m1.fill(0); m2.fill(0);
      for (t = 0; t < L; t++) {
        a = (x[t] / n) | 0; b = x[t] % n;
        m1[t * n + a] = 1; m2[t * n + b] = 1;
        t1 = t + 1 === L ? 0 : t + 1;
        c1[t] = b * n + ((x[t1] / n) | 0);
      }
      // forward: V_{i+1}[:, t] = P_i Shift(V_i)[:, t], Shift(V_i)[x n + y, t] = m2_t[x] m1_{t+1}[y];
      // only the marginals of V_{i+1} are kept (and V_{d+1}[y_t, t] at the top)
      for (li = 0; li < d; li++) {
        kq = KQ[li]; kp = KP[li]; kd = KD[li]; pa = PA[li]; pb = PB[li];
        m1 = M1[li]; m2 = M2[li];
        var last = li === d - 1, n1 = last ? null : M1[li + 1], n2 = last ? null : M2[li + 1], pinv = PI[li];
        if (!last) { n1.fill(0); n2.fill(0); }
        for (t = 0; t < L; t++) {
          t1 = t + 1 === L ? 0 : t + 1; tn = t * n; t1n = t1 * n;
          var sP = 0, sD = 0;
          for (xx = 0; xx < n; xx++) {
            mx = m2[tn + xx];
            if (mx === 0) continue;
            cb = xx * n;
            if (last) {
              for (yy = 0; yy < n; yy++) { c = cb + yy; v = mx * m1[t1n + yy]; sP += kp[c] * v; sD += kd[c] * v; }
            } else {
              for (yy = 0; yy < n; yy++) {
                c = cb + yy; v = mx * m1[t1n + yy]; w = kq[c] * v;
                n1[tn + pa[c]] += w; n2[tn + pb[c]] += w;
                sP += kp[c] * v; sD += kd[c] * v;
              }
            }
          }
          var kap = eps * sP + u * sD;
          if (last) {
            c = pinv[y[t]];
            pOut[t] = kq[c] * m2[tn + ((c / n) | 0)] * m1[t1n + c % n] + kap;
            continue;
          }
          kap *= n;
          for (a = 0; a < n; a++) { n1[tn + a] += kap; n2[tn + a] += kap; }
        }
      }
      // backward from the loss -(1/L) sum_t log V_{d+1}[y_t, t] down to the output of layer 1. The gradient on
      // V_{i+1}[:, t] is kept as dm1_t[a] + dm2_t[b] at row a n + b; H = P_i^T G, then back through Shift.
      var dm1 = dA1, dm2 = dA2, nd1 = dB1, nd2 = dB2;
      for (li = d - 1; li >= 1; li--) {
        kq = KQ[li]; ka = KA[li]; pa = PA[li]; pb = PB[li];
        var top = li === d - 1, pinv2 = PI[li];
        m1 = M1[li]; m2 = M2[li];
        nd1.fill(0); nd2.fill(0);
        for (t = 0; t < L; t++) {
          t1 = t + 1 === L ? 0 : t + 1; tn = t * n; t1n = t1 * n;
          var sG, h, acc;
          if (top) {
            sG = -1 / (L * (pOut[t] + 1e-10));       // G[:, t] = sG at row y_t, 0 elsewhere
            for (xx = 0; xx < n; xx++) {
              mx = m2[tn + xx]; cb = xx * n; acc = 0;
              for (yy = 0; yy < n; yy++) { h = ka[cb + yy] * sG; acc += h * m1[t1n + yy]; nd1[t1n + yy] += h * mx; }
              nd2[tn + xx] += acc;
            }
            c = pinv2[y[t]]; h = kq[c] * sG; xx = (c / n) | 0; yy = c % n;
            nd2[tn + xx] += h * m1[t1n + yy]; nd1[t1n + yy] += h * m2[tn + xx];
          } else {
            var s1a = 0, s2a = 0;
            for (a = 0; a < n; a++) { s1a += dm1[tn + a]; s2a += dm2[tn + a]; }
            sG = n * (s1a + s2a);
            for (xx = 0; xx < n; xx++) {
              mx = m2[tn + xx]; cb = xx * n; acc = 0;
              for (yy = 0; yy < n; yy++) {
                c = cb + yy;
                h = kq[c] * (dm1[tn + pa[c]] + dm2[tn + pb[c]]) + ka[c] * sG;
                acc += h * m1[t1n + yy]; nd1[t1n + yy] += h * mx;
              }
              nd2[tn + xx] += acc;
            }
          }
        }
        tmp = dm1; dm1 = nd1; nd1 = tmp;
        tmp = dm2; dm2 = nd2; nd2 = tmp;
      }
      // dL/dP_1[:, c1_t] += dL/dV_2[:, t]
      for (t = 0; t < L; t++) {
        var sl = slot[c1[t]];
        if (sl < 0) continue;
        var base = sl * N2; tn = t * n;
        for (a = 0; a < n; a++) { v = dm1[tn + a]; for (b = 0; b < n; b++) gP[base + a * n + b] += v + dm2[tn + b]; }
      }
    }

    /* Score the dropped columns. The gradient on W_1[:, c] is (T / n^2) (gP[:, c] - mean), so argmax of the negative
       gradient = argmin of gP (ties fail), and "correct entry negative" = gP[pi_1(c)] < mean. */
    function score(cols, gP) {
      var A = 0, B = 0, p0 = perms[0];
      for (var sIdx = 0; sIdx < cols.length; sIdx++) {
        var base = sIdx * N2, gt = p0[cols[sIdx]], mean = 0, mi = Infinity, ai = -1, ties = 0;
        for (var r = 0; r < N2; r++) {
          var v = gP[base + r];
          mean += v;
          if (v < mi) { mi = v; ai = r; ties = 0; } else if (v === mi) ties++;
        }
        mean /= N2;
        if (ai === gt && ties === 0) A++;
        if (gP[base + gt] < mean) B++;
      }
      return { A: A, B: B, m: cols.length };
    }
    return { n: n, d: d, L: L, N2: N2, perms: perms, sequence: sequence, score: score };
  }
  /* ENGINE-END */

  /* ---------- settings ---------- */
  var NN = 10, DD = 10, LC = 1000, PERM_SEED = 7, MC_SEED = 20250301;
  var E = makeEngine(NN, DD, LC, PERM_SEED), N2 = E.N2;
  var MS = [];                                   // mask sizes 1, 6, ..., 96 (as in the released code)
  for (var mm = 1; mm < N2; mm += NN / 2) MS.push(mm);
  var BATCHES = [1, 10, 100], RATES = [0.1, 0.3, 0.5], KS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var SLICE = 12;                                // ms of work per slice

  var NS = 'http://www.w3.org/2000/svg';
  var ML = 38, MR = 12, MT = 12, MB = 40;
  var MINUS = '−';

  var $ = function (s) { return fig.querySelector(s); };
  var host = $('.gacc-plot'), statusEl = $('.fx-status'), legend = $('.fx-legend');
  var ptitle = $('.fx-ptitle'), psub = $('.fx-psub');
  var segView = $('.fx-seg[data-k="view"]'), segCrit = $('.fx-seg[data-k="crit"]');
  var segB = $('.fx-seg[data-k="batch"]'), segR = $('.fx-seg[data-k="rate"]');
  var ctlB = $('.gacc-ctl-batch'), ctlR = $('.gacc-ctl-rate');
  var btnRun = $('button[data-act="run"]'), btnReset = $('button[data-act="reset"]');
  if (!host || !statusEl || !segView || !segCrit || !segB || !segR || !btnRun || !btnReset) return;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var st = {
    view: 'one', crit: 'A',
    batches: [1, 10], hiB: 10,                   // pressed batch sizes; highlighted = last pressed
    hiR: 0.3,
    paused: !!(mq && mq.matches), started: !(mq && mq.matches),
    visible: !window.IntersectionObserver       // until the observer reports, assume off-screen
  };
  var hov = null;                                // index of the inspected x point

  /* ---------- Monte Carlo state ---------- */
  var rng, stats, passes, seqs, job, timer = 0;
  function newStats() {
    var o = { one: {}, multi: {} };
    BATCHES.forEach(function (B) { o.one[B] = MS.map(function (m) { return pt(m, 1, B); }); });
    RATES.forEach(function (r) { o.multi[r] = KS.map(function (k) { return pt(Math.round(r * N2), k, 10); }); });
    return o;
  }
  function pt(m, k, B) { return { m: m, k: k, B: B, nb: 0, cols: 0, A: 0, S: 0 }; }
  function resetAll() {
    rng = mulberry32(MC_SEED);
    stats = newStats();
    passes = { one: 0, multi: 0 };
    seqs = { one: 0, multi: 0 };
    job = null;
    queue = null;
  }
  function doneP(p) {
    if (p.B >= 100) return p.nb >= 8;
    return (p.cols >= 200 && p.nb >= 10) || p.nb >= 40;
  }
  function visiblePts() {   // in x order, series interleaved, so every curve fills in together
    var out = [], v = st.view;
    if (v === 'one') {
      var bs = BATCHES.filter(function (B) { return st.batches.indexOf(B) >= 0; });
      for (var j = 0; j < MS.length; j++) bs.forEach(function (B) { out.push(stats.one[B][j]); });
    } else {
      for (var i = 0; i < KS.length; i++) RATES.forEach(function (r) { out.push(stats.multi[r][i]); });
    }
    return out;
  }
  var queue = null;   // points still owed a batch in the current pass
  function nextJob() {
    for (;;) {
      if (!queue) {
        queue = visiblePts().filter(function (p) { return !doneP(p); });
        if (!queue.length) { queue = null; return null; }
      }
      while (queue.length) {
        var p = queue.shift();
        if (doneP(p) || !isVisible(p)) continue;
        return startJob(p);
      }
      queue = null;
      passes[st.view]++;
      dirty(true);
    }
  }
  function isVisible(p) {
    if (st.view === 'one') return p.k === 1 && stats.one[p.B] && stats.one[p.B].indexOf(p) >= 0 && st.batches.indexOf(p.B) >= 0;
    return p.k >= 1 && RATES.some(function (r) { return stats.multi[r].indexOf(p) >= 0; });
  }
  function startJob(p) {
    // m distinct rules chosen uniformly (partial Fisher-Yates), dropped from phrasebooks 1..k
    var idx = new Int32Array(N2), i, drop = new Uint8Array(N2), slot = new Int32Array(N2).fill(-1), cols = [];
    for (i = 0; i < N2; i++) idx[i] = i;
    for (i = 0; i < p.m; i++) {
      var j = i + Math.floor(rng() * (N2 - i)), s = idx[i]; idx[i] = idx[j]; idx[j] = s;
      drop[idx[i]] = 1; slot[idx[i]] = i; cols.push(idx[i]);
    }
    return { p: p, drop: drop, slot: slot, cols: cols, left: p.B, gP: new Float64Array(p.m * N2), view: st.view };
  }
  function running() { return !st.paused && st.visible && !document.hidden; }
  function schedule() {
    if (timer || !running()) return;
    timer = setTimeout(work, 0);
  }
  function work() {
    timer = 0;
    if (!running()) { setBusy(); return; }
    var t0 = performance.now();
    while (performance.now() - t0 < SLICE) {
      if (job && (job.view !== st.view || !isVisible(job.p))) job = null;
      if (!job) job = nextJob();
      if (!job) { setBusy(); dirty(true); return; }   // every visible point has enough samples
      E.sequence(rng, job.drop, job.p.k, job.slot, job.gP);
      job.left--;
      seqs[job.view]++;
      if (job.left === 0) {
        var r = E.score(job.cols, job.gP), p = job.p;
        p.nb++; p.cols += r.m; p.A += r.A; p.S += r.B;
        job = null;
        dirty(false);
      }
    }
    setBusy();
    schedule();
  }
  function allDone() { return visiblePts().every(doneP); }

  /* ---------- helpers ---------- */
  function S(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function T(parent, x, y, str, anchor, cls) {
    var t = S('text', { x: r2(x), y: r2(y), 'text-anchor': anchor || 'start', 'class': cls || null }, parent);
    t.textContent = str;
    return t;
  }
  function Hm(tag, cls, txt, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function crisp(v) { return Math.floor(v) + 0.5; }
  function f2(v) { return v.toFixed(2); }
  function fr(v) { return v === 0.1 || v === 0.3 || v === 0.5 ? v.toFixed(1) : v.toFixed(2); }
  function grp(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function wilson(k, N) {
    if (!N) return null;
    var z = 1.959964, z2 = z * z, ph = k / N, den = 1 + z2 / N;
    var c = (ph + z2 / (2 * N)) / den, h = z * Math.sqrt(ph * (1 - ph) / N + z2 / (4 * N * N)) / den;
    return { p: ph, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
  }
  function val(p) { return wilson(st.crit === 'A' ? p.A : p.S, p.cols); }
  function hits(p) { return st.crit === 'A' ? p.A : p.S; }
  function chance() { return st.crit === 'A' ? 1 / N2 : 0.5; }
  function critName() { return st.crit === 'A' ? 'argmax' : 'sign'; }
  function piSub(k) { return k === 1 ? 'π₁' : 'π₁ … π' + sub(k); }
  function sub(k) { return String(k).split('').map(function (ch) { return String.fromCharCode(0x2080 + +ch); }).join(''); }

  /* series currently drawn: { key, label, cls, pts[], x(j) } */
  function series() {
    if (st.view === 'one') {
      return BATCHES.filter(function (B) { return st.batches.indexOf(B) >= 0; }).map(function (B) {
        return { key: B, label: 'batch ' + B, short: 'batch ' + B, cls: 'b' + B + (B === st.hiB ? ' hi' : ''), hi: B === st.hiB, pts: stats.one[B] };
      });
    }
    return RATES.map(function (r) {
      return { key: r, label: 'rate ' + fr(r), short: 'rate ' + fr(r), cls: 'r' + Math.round(r * 10) + (r === st.hiR ? ' hi' : ''), hi: r === st.hiR, pts: stats.multi[r] };
    });
  }
  function nX() { return st.view === 'one' ? MS.length : KS.length; }

  /* ---------- chart ---------- */
  var svg = S('svg', { 'class': 'fx-svg', role: 'img', tabindex: '0' }, host);
  var C = { w: 0 };
  var gGrid, gData, gHov, hair, lastDraw = 0, drawPending = 0;

  function geo() {
    var w = C.w, pw = Math.max(80, w - ML - MR), ph = w < 480 ? 190 : 230;
    var one = st.view === 'one';
    var inset = one ? 0 : Math.min(14, pw * 0.04);
    return {
      w: w, pw: pw, ph: ph, h: MT + ph + MB, y0: MT + ph,
      xv: function (j) { return one ? MS[j] / N2 : KS[j]; },
      x: function (v) { return one ? ML + v * pw : ML + inset + (v - 1) / 9 * (pw - 2 * inset); },
      y: function (v) { return MT + ph * (1 - Math.max(0, Math.min(1, v))); }
    };
  }
  function drawFrame() {
    if (!C.w) return;
    var G = C.G = geo();
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + G.w + ' ' + G.h);
    svg.setAttribute('width', G.w);
    svg.setAttribute('height', G.h);
    gGrid = S('g', null, svg);
    [0.25, 0.5, 0.75, 1].forEach(function (v) {
      var y = crisp(G.y(v));
      S('line', { 'class': 'gr', x1: ML, x2: r2(ML + G.pw), y1: y, y2: y }, gGrid);
    });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      T(gGrid, ML - 7, G.y(v) + 3.5, v === 0 ? '0' : v === 1 ? '1' : v.toFixed(2), 'end');
    });
    if (st.view === 'one') {
      [0, 0.25, 0.5, 0.75, 1].forEach(function (v) { T(gGrid, G.x(v), G.y0 + 16, v === 0 ? '0' : v === 1 ? '1' : v.toFixed(2), 'middle'); });
      T(gGrid, ML + G.pw / 2, G.y0 + 34, 'fraction of π₁ rules dropped', 'middle');
    } else {
      KS.forEach(function (k) { T(gGrid, G.x(k), G.y0 + 16, String(k), 'middle'); });
      T(gGrid, ML + G.pw / 2, G.y0 + 34, 'rules dropped from π₁ … πₖ', 'middle');
    }
    var y = crisp(G.y0);
    S('line', { 'class': 'ax', x1: ML, x2: r2(ML + G.pw), y1: y, y2: y }, gGrid);
    C.chance = S('line', { 'class': 'gacc-chance' }, svg);
    gData = S('g', null, svg);
    gHov = S('g', { 'class': 'gacc-hov' }, svg);
    hair = S('line', { 'class': 'hair', y1: MT - 4, y2: G.y0 }, gHov);
    C.dots = S('g', null, gHov);
    drawData();
  }

  function drawData() {
    drawPending = 0;
    lastDraw = performance.now();
    if (!C.G) return;
    var G = C.G, ser = series();
    // chance level (named in the legend)
    var cy = crisp(G.y(chance()));
    C.chance.setAttribute('x1', ML); C.chance.setAttribute('x2', r2(ML + G.pw));
    C.chance.setAttribute('y1', cy); C.chance.setAttribute('y2', cy);

    gData.textContent = '';
    // context series first, highlighted last (on top)
    ser.slice().sort(function (a, b) { return (a.hi ? 1 : 0) - (b.hi ? 1 : 0); }).forEach(function (s) {
      var g = S('g', { 'class': 'gacc-s ' + s.cls }, gData);
      var P = s.pts.map(function (p, j) { var w = val(p); return w ? { x: G.x(G.xv(j)), w: w } : null; });
      // band + line over contiguous runs of points that have data
      var runs = [], cur = null;
      P.forEach(function (q) { if (q) { if (!cur) runs.push(cur = []); cur.push(q); } else cur = null; });
      runs.forEach(function (run) {
        var d = '', i;
        for (i = 0; i < run.length; i++) d += (i ? 'L' : 'M') + r2(run[i].x) + ',' + r2(G.y(run[i].w.hi));
        for (i = run.length - 1; i >= 0; i--) d += 'L' + r2(run[i].x) + ',' + r2(G.y(run[i].w.lo));
        S('path', { 'class': 'gacc-band', d: d + 'Z' }, g);
      });
      runs.forEach(function (run) {
        if (run.length < 2) return;
        var d = '';
        run.forEach(function (q, i) { d += (i ? 'L' : 'M') + r2(q.x) + ',' + r2(G.y(q.w.p)); });
        S('path', { 'class': 'gacc-line', d: d }, g);
      });
      P.forEach(function (q) { if (q) S('circle', { 'class': 'gacc-mk', cx: r2(q.x), cy: r2(G.y(q.w.p)), r: 3 }, g); });
    });
    drawLegend(ser);
    labelAll();
    if (hov != null) { mark(hov); refreshTip(); }
  }
  function dirty(now) {
    if (now || performance.now() - lastDraw > 180) { drawData(); return; }
    if (!drawPending) drawPending = setTimeout(drawData, 180);
  }

  function drawLegend(ser) {
    if (!legend) return;
    legend.textContent = '';
    ser.forEach(function (s) {
      var sp = Hm('span', 'gacc-lg ' + s.cls, null, legend);
      Hm('i', 'sw', null, sp);
      sp.appendChild(document.createTextNode(s.label));
    });
    var c = Hm('span', 'gacc-lg ch', null, legend);
    Hm('i', 'sw', null, c);
    c.appendChild(document.createTextNode('chance ' + (st.crit === 'A' ? '1/n\u00b2 = 0.01' : '0.5')));
  }

  /* ---------- text ---------- */
  function focusIdx() { return hov != null ? hov : st.view === 'one' ? 10 : 3; }   // rate 0.51, or k = 4
  function labelAll() {
    var one = st.view === 'one', j = focusIdx(), ser = series(), cn = critName();
    ptitle.textContent = one ? 'Rules dropped from π₁ only' : 'The same rules dropped from π₁ … πₖ · batch 10';
    psub.textContent = '';
    [(st.crit === 'A' ? 'argmax criterion (Def. B.1)' : 'sign criterion (released code)') + ' ·', 'n = 10, d = 10, W = 0'].forEach(function (t, i) {
      if (i) psub.appendChild(document.createTextNode(' '));
      Hm('span', 's', t, psub);
    });

    statusEl.textContent = '';
    var head = one ? 'Rules dropped from π₁ at rate ' + fr(MS[j] / N2) + ': ' : 'Rules dropped from ' + piSub(KS[j]) + ', batch 10: ';
    statusEl.appendChild(document.createTextNode(head + cn + ' accuracy '));
    ser.forEach(function (s, i) {
      if (i) statusEl.appendChild(document.createTextNode(i === ser.length - 1 ? ' and ' : ', '));
      var w = val(s.pts[j]);
      Hm('b', null, w ? f2(w.p) : '…', statusEl);
      statusEl.appendChild(document.createTextNode(one ? ' with batch ' + s.key : ' at rate ' + fr(s.key)));
    });
    var prog = Hm('span', 'gacc-prog', null, statusEl);
    prog.setAttribute('aria-hidden', 'true');
    var done = allDone();
    prog.textContent = !st.started ? ' · not computed yet: press Run' :
      ' · pass ' + (done ? passes[st.view] : passes[st.view] + 1) + ' · ' + grp(seqs[st.view]) + (seqs[st.view] === 1 ? ' string' : ' strings') +
      (done ? ' · done' : st.paused ? ' · paused' : '');
    btnRun.textContent = !st.started ? 'Run' : st.paused ? 'Resume' : 'Pause';
    btnRun.setAttribute('aria-label', !st.started ? 'Run the computation' : st.paused ? 'Resume the computation' : 'Pause the computation');
    btnRun.disabled = done && !st.paused;

    var parts = ser.map(function (s) {
      var a = s.pts.map(function (p) { var w = val(p); return w ? f2(w.p) : 'not yet computed'; });
      return s.label + ': ' + a.join(', ');
    });
    svg.setAttribute('aria-label', (one
      ? 'Gradient prediction accuracy (' + cn + ' criterion) against the fraction of rules dropped from the first phrasebook, rates 0.01 to 0.96, for '
      : 'Gradient prediction accuracy (' + cn + ' criterion) against the number of phrasebooks k the same rules are dropped from, k = 1 to 10, batch 10, for ') +
      ser.map(function (s) { return s.label; }).join(', ') + '. Chance level ' + (st.crit === 'A' ? '0.01' : '0.5') + '. ' + parts.join('. ') + '.');
  }
  function setBusy() { statusEl.setAttribute('aria-busy', String(running() && !allDone())); }

  /* ---------- hover, touch and keyboard ---------- */
  var tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);

  function mark(j) {
    if (!C.G) return;
    var G = C.G, x = r2(G.x(G.xv(j)));
    hair.setAttribute('x1', x); hair.setAttribute('x2', x);
    C.dots.textContent = '';
    series().forEach(function (s) {
      var w = val(s.pts[j]);
      if (w) S('circle', { 'class': 'gacc-dot ' + s.cls, cx: x, cy: r2(G.y(w.p)), r: s.hi ? 4 : 3.5 }, C.dots);
    });
    gHov.classList.add('on');
  }
  function fillTip(j) {
    var nar = fig.clientWidth < 480;
    tip.classList.toggle('narrow', nar);
    tip.textContent = '';
    var hd = Hm('div', 'gacc-th', null, tip);
    if (st.view === 'one') {
      hd.appendChild(document.createTextNode('rate '));
      Hm('b', null, fr(MS[j] / N2), hd);
      hd.appendChild(document.createTextNode(' · ' + MS[j] + ' of 100 π₁ rules dropped'));
    } else {
      Hm('b', null, 'k = ' + KS[j], hd);
      hd.appendChild(document.createTextNode(' · rules dropped from ' + piSub(KS[j])));
    }
    var g = Hm('div', 'gacc-tg', null, tip);
    series().forEach(function (s) {
      var p = s.pts[j], w = val(p);
      Hm('i', 'sw ' + s.cls, null, g);
      Hm('span', 'k', s.short, g);
      if (w) {
        Hm('b', 'v', f2(w.p), g);
        Hm('span', 'd', (nar ? '' : '(') + hits(p) + '/' + p.cols + ' rules, 95% CI ' + f2(w.lo) + '–' + f2(w.hi) + (nar ? '' : ')'), g);
      } else {
        Hm('b', 'v', '…', g);
        Hm('span', 'd', 'not computed yet', g);
      }
    });
  }
  function showTip(at) {
    var fw = fig.clientWidth, fh = fig.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight, x, y;
    x = at.x + 16;
    if (x + tw > fw) x = at.x - 16 - tw;
    y = at.touch ? at.y - th - 24 : at.y - th / 2;
    if (y < 0 && at.touch) y = at.y + 24;
    x = Math.max(0, Math.min(fw - tw, x));
    y = Math.max(0, Math.min(fh - th, y));
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
    tip.classList.add('on');
  }
  var lastAt = null;
  function setHover(j, at) {
    hov = j;
    mark(j);
    fillTip(j);
    lastAt = at;
    showTip(at);
    labelAll();
  }
  function refreshTip() { if (hov != null && lastAt) { fillTip(hov); showTip(lastAt); } }
  function clearHover() {
    if (hov == null) return;
    hov = null; lastAt = null;
    if (gHov) gHov.classList.remove('on');
    tip.classList.remove('on');
    labelAll();
  }
  function anchorAt(j) {
    var r = svg.getBoundingClientRect(), f = fig.getBoundingClientRect(), k = r.width / C.G.w;
    return { x: r.left - f.left + C.G.x(C.G.xv(j)) * k, y: r.top - f.top + (MT + C.G.ph / 2) * k, touch: false };
  }
  function nearest(px) {
    var G = C.G, best = 0, bd = Infinity;
    for (var j = 0; j < nX(); j++) { var dd = Math.abs(G.x(G.xv(j)) - px); if (dd < bd) { bd = dd; best = j; } }
    return best;
  }
  function onPtr(e) {
    if (!C.G) return;
    var r = svg.getBoundingClientRect(), f = fig.getBoundingClientRect();
    var px = (e.clientX - r.left) * (C.G.w / r.width);
    setHover(nearest(px), { x: e.clientX - f.left, y: e.clientY - f.top, touch: e.pointerType === 'touch' });
  }
  svg.addEventListener('pointermove', onPtr);
  svg.addEventListener('pointerdown', onPtr);
  svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') clearHover(); });
  svg.addEventListener('pointercancel', clearHover);
  svg.addEventListener('keydown', function (e) {
    if (!C.G) return;
    var j = hov != null ? hov : focusIdx(), k = e.key;
    if (k === 'ArrowRight') j += 1;
    else if (k === 'ArrowLeft') j -= 1;
    else if (k === 'Home') j = 0;
    else if (k === 'End') j = nX() - 1;
    else if (k === 'Escape') { clearHover(); return; }
    else return;
    e.preventDefault();
    j = Math.max(0, Math.min(nX() - 1, j));
    setHover(j, anchorAt(j));
  });
  svg.addEventListener('focus', function () {
    var kb = true;
    try { kb = svg.matches(':focus-visible'); } catch (err) { /* older engines: treat as keyboard focus */ }
    if (kb && C.G) { var j = hov != null ? hov : focusIdx(); setHover(j, anchorAt(j)); }
  });
  svg.addEventListener('blur', clearHover);
  document.addEventListener('pointerdown', function (e) { if (hov != null && !svg.contains(e.target)) clearHover(); });

  /* ---------- controls ---------- */
  function press(seg, fn) {
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(!!fn(b.getAttribute('data-v')))); });
  }
  function syncControls() {
    press(segView, function (v) { return v === st.view; });
    press(segCrit, function (v) { return v === st.crit; });
    press(segB, function (v) { return st.batches.indexOf(+v) >= 0; });
    press(segR, function (v) { return +v === st.hiR; });
    Array.prototype.forEach.call(segB.querySelectorAll('button'), function (b) { b.classList.toggle('hi', +b.getAttribute('data-v') === st.hiB); });
    ctlB.hidden = st.view !== 'one';
    ctlR.hidden = st.view === 'one';
  }
  function changed(frame) {
    clearHover();
    syncControls();
    if (frame) drawFrame(); else drawData();
    setBusy();
    schedule();
  }
  segView.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var v = b.getAttribute('data-v'); if (v === st.view) return;
    st.view = v; queue = null; job = null;
    changed(true);
  });
  segCrit.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    st.crit = b.getAttribute('data-v');
    changed(false);
  });
  segB.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var B = +b.getAttribute('data-v'), i = st.batches.indexOf(B);
    if (i < 0) { st.batches.push(B); st.hiB = B; }
    else {
      if (st.batches.length === 1) return;            // keep at least one curve
      st.batches.splice(i, 1);
      if (st.hiB === B) st.hiB = Math.max.apply(null, st.batches);
    }
    st.batches.sort(function (a, c) { return a - c; });
    queue = null;
    changed(false);
  });
  segR.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    st.hiR = +b.getAttribute('data-v');
    changed(false);
  });
  btnRun.addEventListener('click', function () {
    if (!st.started) { st.started = true; st.paused = false; }
    else st.paused = !st.paused;
    labelAll(); setBusy(); schedule();
  });
  btnReset.addEventListener('click', function () {
    if (timer) { clearTimeout(timer); timer = 0; }
    resetAll();
    changed(false);
  });

  /* ---------- init, width tracking, visibility ---------- */
  resetAll();
  function fit() {
    var w = Math.round(host.clientWidth);
    if (w > 0 && w !== C.w) { C.w = w; clearHover(); drawFrame(); }
  }
  syncControls();
  fit();
  if (!C.G) labelAll();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
  else window.addEventListener('resize', fit);
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      st.visible = es[es.length - 1].isIntersecting;
      setBusy();
      schedule();
    }, { rootMargin: '200px 0px' }).observe(fig);
  }
  document.addEventListener('visibilitychange', function () { setBusy(); schedule(); });
  schedule();
})();
