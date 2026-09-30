/* Figure 3 (fx-surr-train): live training of the soft surrogate SURR-MLT (paper App. G.5, eqs. 74-76; Algorithms 4 and 5).
   n characters, depth d, N2 = n² pair states (pair (a, b) -> index a·n + b). Ground truth: d random permutations of the pairs.
   One fixed random training string of Lc = 10·n² pair columns; label = the exact multi-level translation.
   Soft forward: V_{i+1} = softmax_col(25 (C_i + W_i)) · Shift(V_i), Shift(V)[x·n+y, t] = m2(V_t)[x] · m1(V_{t+1})[y].
   Loss: mean over columns of −log V_{d+1}[y_t, t]. Curriculum: step s masks column s mod n² of phrasebook ⌊s/n²⌋ mod d.
   Layer-wise (Alg. 4) updates only the masked layer; all layers (Alg. 5) updates every W_l; no context sets every C_l = 0.
   Updates: W <- clip(W − η ∇W, 0, 1). Init W ~ N(0, 1)/n (the authors' released notebook). Gradients follow the numpy/torch-checked
   reference (check/surr_train.mjs); with the same seed this reproduces its step counts exactly. */
(function () {
  'use strict';
  var fig = document.getElementById('fx-surr-train');
  if (!fig) return;

  var NS = 'http://www.w3.org/2000/svg';
  var TEMP = 25, EPS = 1e-10, CYCLES0 = 6, TEST_L = 400, TEST_EVERY = 20, BUDGET = 10;
  var LOW = 'abcdefgh', UP = 'ABCDEFGH';

  var modeBtns = Array.prototype.slice.call(fig.querySelectorAll('.sut-mode button[data-mode]'));
  var selSize = fig.querySelector('select.sut-size'), selLr = fig.querySelector('select.sut-lr'), selLayer = fig.querySelector('select.sut-layer');
  var bPlay = fig.querySelector('.sut-play'), bReset = fig.querySelector('.sut-reset');
  var statusEl = fig.querySelector('.fx-status'), selName = fig.querySelector('.sut-selname'), kMask = fig.querySelector('.sut-kmask');
  var hostC = fig.querySelector('.sut-plot[data-chart="curve"]'), hostH = fig.querySelector('.sut-plot[data-chart="heat"]');
  if (!selSize || !selLr || !selLayer || !bPlay || !statusEl || !hostC || !hostH) return;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches); }

  /* ================= simulation ================= */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 0, v; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* exact MLT on a circular pair string: shift left by one character, then translate every pair */
  function translate(src, perms, n) {
    var L = src.length, s = Int32Array.from(src), nx = new Int32Array(L), i, t, p, tmp;
    for (i = 0; i < perms.length; i++) {
      p = perms[i];
      for (t = 0; t < L; t++) nx[t] = p[(s[t] % n) * n + Math.floor(s[(t + 1) % L] / n)];
      tmp = s; s = nx; nx = tmp;
    }
    return s;
  }

  function Sim(n, d, mode, lr, seed) {
    var N2 = n * n, L = 10 * N2, r = mulberry32(seed), i, j, t;
    var perms = [], inv = [];
    for (i = 0; i < d; i++) {
      var p = new Int32Array(N2), q = new Int32Array(N2);
      for (j = 0; j < N2; j++) p[j] = j;
      for (j = N2 - 1; j > 0; j--) { var k = Math.floor(r() * (j + 1)), tt = p[j]; p[j] = p[k]; p[k] = tt; }
      for (j = 0; j < N2; j++) q[p[j]] = j;
      perms.push(p); inv.push(q);
    }
    var x = new Int32Array(L);
    for (t = 0; t < L; t++) x[t] = Math.floor(r() * N2);
    var y = translate(x, perms, n);
    var W = [];                                  // column-major: W[c·N2 + row]; drawn in row-major order as the reference
    for (i = 0; i < d; i++) {
      var w = new Float64Array(N2 * N2);
      for (j = 0; j < N2 * N2; j++) w[(j % N2) * N2 + Math.floor(j / N2)] = gauss(r) / n;
      W.push(w);
    }
    var tx = new Int32Array(TEST_L);
    for (t = 0; t < TEST_L; t++) tx[t] = Math.floor(r() * N2);
    var ty = translate(tx, perms, n);

    var V = [], Vt = [], P = [], M1 = [], M2 = [];
    for (i = 0; i <= d; i++) V.push(new Float64Array(N2 * L));
    for (i = 0; i < d; i++) { Vt.push(new Float64Array(N2 * L)); P.push(new Float64Array(N2 * N2)); M1.push(new Float64Array(n * L)); M2.push(new Float64Array(n * L)); }
    var G = new Float64Array(N2 * L), H = new Float64Array(N2 * L), gP = new Float64Array(N2 * N2);
    var D1 = new Float64Array(n * L), D2 = new Float64Array(n * L), am = new Int32Array(N2), buf0 = new Int32Array(TEST_L), buf1 = new Int32Array(TEST_L);
    for (t = 0; t < L; t++) V[0][t * N2 + x[t]] = 1;

    var me = {
      n: n, d: d, N2: N2, L: L, mode: mode, lr: lr, seed: seed, perms: perms, inv: inv, W: W,
      s: 0, cycle: d * N2, cap: 0, cnt: null, loss: null, test: [], done: -1
    };
    function grow(len) {
      var cnt = new Uint16Array((len + 1) * d), loss = new Float64Array(len + 1);
      if (me.cnt) { cnt.set(me.cnt); loss.set(me.loss); }
      me.cnt = cnt; me.loss = loss; me.cap = len;
    }
    me.grow = grow;
    me.mask = function (s) { return { layer: Math.floor(s / N2) % d, rule: s % N2 }; };

    function count(at) {
      var all = true;
      for (var i = 0; i < d; i++) {
        var w = W[i], p = perms[i], c = 0;
        for (var col = 0; col < N2; col++) {
          var b = col * N2, bi = 0, bv = -1e300;
          for (var rr = 0; rr < N2; rr++) if (w[b + rr] > bv) { bv = w[b + rr]; bi = rr; }
          if (bi === p[col]) c++;
        }
        me.cnt[at * d + i] = c;
        if (c !== N2) all = false;
      }
      if (all && me.done < 0) me.done = at;
    }
    /* HardMax(W) with no context on the fixed test string */
    function testAcc() {
      var s = buf0, nx = buf1, i, t, tmp, ok = 0;
      s.set(tx);
      for (i = 0; i < d; i++) {
        var w = W[i];
        for (var col = 0; col < N2; col++) {
          var b = col * N2, bi = 0, bv = -1e300;
          for (var rr = 0; rr < N2; rr++) if (w[b + rr] > bv) { bv = w[b + rr]; bi = rr; }
          am[col] = bi;
        }
        for (t = 0; t < TEST_L; t++) nx[t] = am[(s[t] % n) * n + Math.floor(s[(t + 1) % TEST_L] / n)];
        tmp = s; s = nx; nx = tmp;
      }
      for (t = 0; t < TEST_L; t++) if (s[t] === ty[t]) ok++;
      return ok / TEST_L;
    }

    me.step = function () {
      var s = me.s, li = Math.floor(s / N2) % d, k = s % N2, ctx = mode !== 'none';
      var i, t, c, rr, o, b, v, a;
      /* P_i = column-wise softmax(T (C_i + W_i)); C_i = Matrix(π_i) with column k zeroed for the masked layer */
      for (i = 0; i < d; i++) {
        var Pi = P[i], w = W[i], p = perms[i];
        for (c = 0; c < N2; c++) {
          var tg = ctx && !(i === li && c === k) ? p[c] : -1, mx = -1e300, sum = 0;
          b = c * N2;
          for (rr = 0; rr < N2; rr++) { v = TEMP * (w[b + rr] + (rr === tg ? 1 : 0)); Pi[b + rr] = v; if (v > mx) mx = v; }
          for (rr = 0; rr < N2; rr++) { v = Math.exp(Pi[b + rr] - mx); Pi[b + rr] = v; sum += v; }
          for (rr = 0; rr < N2; rr++) Pi[b + rr] /= sum;
        }
      }
      /* forward */
      for (i = 0; i < d; i++) {
        var Vi = V[i], Vti = Vt[i], m1 = M1[i], m2 = M2[i], Pf = P[i], Vn = V[i + 1];
        m1.fill(0); m2.fill(0);
        for (t = 0; t < L; t++) {
          o = t * N2;
          for (a = 0; a < n; a++) for (var bb = 0; bb < n; bb++) { v = Vi[o + a * n + bb]; m1[t * n + a] += v; m2[t * n + bb] += v; }
        }
        for (t = 0; t < L; t++) {
          var o1 = ((t + 1) % L) * n, o2 = t * n;
          o = t * N2;
          for (var xx = 0; xx < n; xx++) { var mv = m2[o2 + xx]; for (var yy = 0; yy < n; yy++) Vti[o + xx * n + yy] = mv * m1[o1 + yy]; }
        }
        Vn.fill(0);
        for (t = 0; t < L; t++) {
          o = t * N2;
          for (c = 0; c < N2; c++) {
            v = Vti[o + c];
            if (v === 0) continue;
            b = c * N2;
            for (rr = 0; rr < N2; rr++) Vn[o + rr] += Pf[b + rr] * v;
          }
        }
      }
      var loss = 0, Vd = V[d];
      G.fill(0);
      for (t = 0; t < L; t++) { var pt = Vd[t * N2 + y[t]]; loss -= Math.log(pt + EPS) / L; G[t * N2 + y[t]] = -1 / (L * (pt + EPS)); }
      /* backward (layer-wise: only down to the masked layer) */
      var lowest = mode === 'layer' ? li : 0;
      for (i = d - 1; i >= lowest; i--) {
        var Pb = P[i], Vtb = Vt[i];
        if (mode !== 'layer' || i === li) {
          gP.fill(0);
          for (t = 0; t < L; t++) {
            o = t * N2;
            for (c = 0; c < N2; c++) {
              v = Vtb[o + c];
              if (v === 0) continue;
              b = c * N2;
              for (rr = 0; rr < N2; rr++) gP[b + rr] += G[o + rr] * v;
            }
          }
          var wu = W[i], step = lr * TEMP;
          for (c = 0; c < N2; c++) {
            b = c * N2;
            var dot = 0;
            for (rr = 0; rr < N2; rr++) dot += Pb[b + rr] * gP[b + rr];
            for (rr = 0; rr < N2; rr++) {
              v = wu[b + rr] - step * Pb[b + rr] * (gP[b + rr] - dot);
              wu[b + rr] = v < 0 ? 0 : v > 1 ? 1 : v;
            }
          }
        }
        if (i > lowest) {
          for (t = 0; t < L; t++) {
            o = t * N2;
            for (c = 0; c < N2; c++) {
              b = c * N2;
              var hs = 0;
              for (rr = 0; rr < N2; rr++) hs += Pb[b + rr] * G[o + rr];
              H[o + c] = hs;
            }
          }
          /* through Shift: dm2_t[x] = Σ_y H[x,y,t] m1_{t+1}[y];  dm1_{t+1}[y] = Σ_x H[x,y,t] m2_t[x] */
          var mb1 = M1[i], mb2 = M2[i];
          D1.fill(0); D2.fill(0);
          for (t = 0; t < L; t++) {
            var q1 = ((t + 1) % L) * n, q2 = t * n;
            o = t * N2;
            for (var x2 = 0; x2 < n; x2++) {
              var g2 = 0, m2x = mb2[q2 + x2];
              for (var y2 = 0; y2 < n; y2++) { var h = H[o + x2 * n + y2]; g2 += h * mb1[q1 + y2]; D1[q1 + y2] += h * m2x; }
              D2[q2 + x2] += g2;
            }
          }
          for (t = 0; t < L; t++) {
            o = t * N2;
            var q = t * n;
            for (a = 0; a < n; a++) for (var b2 = 0; b2 < n; b2++) G[o + a * n + b2] = D1[q + a] + D2[q + b2];
          }
        }
      }
      me.s = s + 1;
      if (me.s > me.cap) grow(me.cap + me.cycle);
      me.loss[me.s] = loss;
      count(me.s);
      if (me.s % TEST_EVERY === 0) me.test[me.s / TEST_EVERY] = testAcc();
    };
    me.lastLoss = function () { return me.s ? me.loss[me.s] : NaN; };
    me.testAt = function (s) { var j = Math.floor(s / TEST_EVERY); return me.test[j]; };
    me.testStep = function (s) { return Math.floor(s / TEST_EVERY) * TEST_EVERY; };

    grow(CYCLES0 * me.cycle);
    count(0);
    me.test[0] = testAcc();
    return me;
  }

  /* ================= state ================= */
  var st = { mode: 'layer', n: 6, d: 5, lr: 100, seed: 1, sel: 0, runLen: 0 };
  var sim = null;
  var want = !reduced(), vis = !window.IntersectionObserver, raf = 0, lastDraw = 0;
  var hovC = null, hovH = null;

  var tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);

  /* ================= helpers ================= */
  function S(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function T(parent, x, y, str, anchor, cls, extra) {
    var t = S('text', { x: r2(x), y: r2(y), 'text-anchor': anchor || 'start', 'class': cls || null }, parent);
    if (extra) for (var k in extra) t.setAttribute(k, extra[k]);
    t.textContent = str;
    return t;
  }
  function E(tag, cls, txt, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function crisp(v) { return Math.floor(v) + 0.5; }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function pairIn(c) { return LOW[Math.floor(c / st.n)] + ' ' + LOW[c % st.n]; }
  function pairOut(c) { return UP[Math.floor(c / st.n)] + ' ' + UP[c % st.n]; }
  function fmtLoss(v) { if (!isFinite(v)) return '–'; v = Math.max(0, v); return v >= 10 ? v.toFixed(1) : v.toFixed(3); }
  function curMask() { return sim.mask(Math.max(0, sim.s - 1)); }
  var FILL = [];
  for (var qi = 0; qi <= 50; qi++) FILL.push('color-mix(in oklab, var(--accent) ' + (qi * 2) + '%, var(--bg))');

  /* ================= curve chart ================= */
  var C = { host: hostC, w: 0, svg: S('svg', { 'class': 'fx-svg sut-curve', role: 'img', tabindex: '0' }, hostC) };
  var ML = 30, MR = 26, MT = 10, MB = 38;

  function buildCurve() {
    var w = C.w;
    if (!w || !sim) return;
    var PH = w < 400 ? 168 : 196, pw = Math.max(60, w - ML - MR), y0 = MT + PH, N = st.runLen;
    var G = C.G = {
      w: w, h: MT + PH + MB, pw: pw, y0: y0, PH: PH,
      x: function (s) { return ML + pw * s / N; },
      y: function (v) { return MT + PH * (1 - v); }
    };
    var svg = C.svg;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + G.h);
    svg.setAttribute('width', w);
    svg.setAttribute('height', G.h);
    C.bands = S('g', null, svg);
    var g = S('g', null, svg), cyc = sim.cycle, nc = Math.round(N / cyc), m = 1, q;
    while (pw * cyc * m / N < 38) m++;
    for (q = 1; q <= nc; q++) { var xc = crisp(G.x(q * cyc)); S('line', { 'class': 'sut-cyc', x1: xc, x2: xc, y1: MT, y2: y0 }, g); }
    [0.5, 1].forEach(function (v) { var yy = crisp(G.y(v)); S('line', { 'class': 'gr', x1: ML, x2: r2(ML + pw), y1: yy, y2: yy }, g); });
    [[0, '0'], [0.5, '0.5'], [1, '1']].forEach(function (a) { T(g, ML - 6, G.y(a[0]) + 3.5, a[1], 'end'); });
    for (q = 0; q <= nc; q += m) T(g, G.x(q * cyc), y0 + 15, String(q * cyc), q === 0 ? 'start' : 'middle');
    T(g, ML + pw / 2, y0 + 32, 'training step · one cycle = ' + cyc + ' steps', 'middle', 'sut-atitle');
    var ych = crisp(G.y(1 / sim.N2));
    S('line', { 'class': 'sut-chance', x1: ML, x2: r2(ML + pw), y1: ych, y2: ych }, g);
    C.lines = S('g', null, svg);
    C.paths = [];
    for (var i = 0; i < st.d; i++) C.paths.push(S('path', { 'class': 'sut-line', 'data-l': i }, C.lines));
    T(svg, ML + pw - 3, ych - 4, 'chance', 'end', 'sut-lab');   // right end: away from the crowded start of every curve
    S('line', { 'class': 'ax', x1: ML, x2: r2(ML + pw), y1: crisp(y0), y2: crisp(y0) }, svg);
    C.lab = T(svg, 0, 0, '', 'start', 'sut-lab on');
    var hv = C.hov = S('g', { 'class': 'sut-hov' }, svg);
    C.hair = S('line', { 'class': 'hair', y1: MT - 4, y2: y0 }, hv);
    C.dots = [];
    for (i = 0; i < st.d; i++) C.dots.push(S('circle', { 'class': 'sut-dot', r: 2.75, cx: 0, cy: 0 }, hv));
    drawBands();
    emphasize();
    paintCurve();
  }
  function drawBands() {
    if (!C.G) return;
    var G = C.G, g = C.bands, cyc = sim.cycle, N2 = sim.N2, nc = Math.round(st.runLen / cyc);
    g.textContent = '';
    if (st.mode === 'none') return;
    for (var q = 0; q < nc; q++) {
      var s0 = q * cyc + st.sel * N2;
      S('rect', { 'class': 'sut-band', x: r2(G.x(s0)), y: MT, width: r2(G.x(s0 + N2) - G.x(s0)), height: G.PH }, g);
    }
  }
  function emphasize() {
    if (!C.paths) return;
    C.paths.forEach(function (p, i) { p.classList.toggle('on', i === st.sel); });
    C.lines.appendChild(C.paths[st.sel]);          // selected line on top
    C.dots.forEach(function (dt, i) { dt.classList.toggle('on', i === st.sel); });
    C.hov.appendChild(C.dots[st.sel]);
  }
  function paintCurve() {
    if (!C.G || !sim) return;
    var G = C.G, d = st.d, N2 = sim.N2, s1 = sim.s, stride = Math.max(1, Math.floor(st.runLen / (G.pw * 1.5)));
    for (var i = 0; i < d; i++) {
      var str = '', s = 0;
      for (;;) {
        str += (s ? 'L' : 'M') + r2(G.x(s)) + ',' + r2(G.y(sim.cnt[s * d + i] / N2));
        if (s === s1) break;
        s = Math.min(s1, s + stride);
      }
      C.paths[i].setAttribute('d', str);
    }
    var v = sim.cnt[s1 * d + st.sel] / N2;
    C.lab.textContent = 'W' + (st.sel + 1);
    C.lab.setAttribute('x', r2(G.x(s1) + 5));
    C.lab.setAttribute('y', r2(Math.max(MT + 8, Math.min(G.y0 - 3, G.y(v) + 3.5))));
    if (hovC) markCurve(hovC.s);
  }
  function markCurve(s) {
    var G = C.G;
    if (!G) return;
    var x = r2(G.x(s));
    C.hair.setAttribute('x1', x);
    C.hair.setAttribute('x2', x);
    for (var i = 0; i < st.d; i++) { C.dots[i].setAttribute('cx', x); C.dots[i].setAttribute('cy', r2(G.y(sim.cnt[s * st.d + i] / sim.N2))); }
    C.hov.classList.add('on');
  }
  function curveTip(s) {
    tip.textContent = '';
    var hd = E('div', 'sut-th', null, tip);
    hd.appendChild(document.createTextNode('step '));
    E('b', null, String(s), hd);
    if (s > 0 && st.mode !== 'none') {
      var mk = sim.mask(s - 1);
      hd.appendChild(document.createTextNode(' · rule ' + (mk.rule + 1) + ' of phrasebook ' + (mk.layer + 1) + ' removed'));
    }
    var g = E('div', 'sut-tg', null, tip);
    for (var i = 0; i < st.d; i++) {
      var c = sim.cnt[s * st.d + i], on = i === st.sel ? 'on' : null;
      E('span', on || 'k', 'W' + (i + 1), g);
      E('b', 'v' + (on ? ' on' : ''), (c / sim.N2).toFixed(2), g);
      E('span', 'k', c + '/' + sim.N2, g);
    }
    var ts = sim.testStep(s), ta = sim.testAt(s), ft = E('div', 'k', null, tip);
    ft.style.marginTop = '3px';
    ft.textContent = s > 0 ? 'loss ' + fmtLoss(sim.loss[s]) + ' · ' : '';
    ft.textContent += 'no-context test ' + (ta != null ? pct(ta) : '–') + (ts !== s ? ' (step ' + ts + ')' : '');
  }

  /* ================= heatmap ================= */
  var Hm = { host: hostH, w: 0, svg: S('svg', { 'class': 'fx-svg sut-heat', role: 'img', tabindex: '0' }, hostH) };
  var HL = 16, HB = 20, HT = 2;
  function buildHeat() {
    var w = Hm.w;
    if (!w || !sim) return;
    var N2 = sim.N2, side = Math.min(w - HL - 2, 280), cs = side / N2, x0 = HL, y0 = HT;
    Hm.G = { side: side, cs: cs, x0: x0, y0: y0, h: HT + side + HB };
    var svg = Hm.svg;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + Hm.G.h);
    svg.setAttribute('width', w);
    svg.setAttribute('height', Hm.G.h);
    var g = S('g', null, svg), ov = cs > 3 ? 0.4 : 0;
    Hm.cells = new Array(N2 * N2);
    Hm.lvl = new Int16Array(N2 * N2).fill(-1);
    for (var r = 0; r < N2; r++) for (var p = 0; p < N2; p++) {
      Hm.cells[r * N2 + p] = S('rect', { 'class': 'sut-cell', x: r2(x0 + p * cs), y: r2(y0 + r * cs), width: r2(cs + ov), height: r2(cs + ov) }, g);
    }
    var dg = S('g', null, svg), ins = Math.min(1, cs * 0.12);
    for (var k = 0; k < N2; k++) S('rect', { 'class': 'sut-diag', x: r2(x0 + k * cs + ins), y: r2(y0 + k * cs + ins), width: r2(cs - 2 * ins), height: r2(cs - 2 * ins) }, dg);
    S('rect', { 'class': 'sut-frame', x: crisp(x0) - 1, y: crisp(y0) - 1, width: Math.round(side) + 1, height: Math.round(side) + 1 }, svg);
    Hm.mask = S('rect', { 'class': 'sut-mask', y: r2(y0 - 1), width: r2(cs), height: r2(side + 2) }, svg);
    Hm.hcell = S('rect', { 'class': 'sut-hcell', width: r2(cs), height: r2(cs) }, svg);
    T(svg, x0 + side / 2, y0 + side + 14, 'rule (column)', 'middle', 'sut-atitle');
    T(svg, 0, 0, 'output pair (row)', 'middle', 'sut-atitle', { transform: 'translate(' + (HL - 5) + ',' + r2(y0 + side / 2) + ') rotate(-90)' });
    paintHeat();
  }
  function paintHeat() {
    if (!Hm.G || !sim) return;
    var N2 = sim.N2, w = sim.W[st.sel], perm = sim.perms[st.sel], cells = Hm.cells, lvl = Hm.lvl;
    for (var c = 0; c < N2; c++) {
      var pos = perm[c], b = c * N2;
      for (var r = 0; r < N2; r++) {
        var v = w[b + r], q = v <= 0 ? 0 : v >= 1 ? 50 : Math.round(v * 50), idx = r * N2 + pos;
        if (lvl[idx] !== q) { lvl[idx] = q; cells[idx].style.fill = FILL[q]; }
      }
    }
    var mk = curMask(), show = st.mode !== 'none' && mk.layer === st.sel;
    Hm.mask.setAttribute('visibility', show ? 'visible' : 'hidden');
    if (show) Hm.mask.setAttribute('x', r2(Hm.G.x0 + perm[mk.rule] * Hm.G.cs));
    if (hovH) heatTip(hovH.r, hovH.p);
  }
  function heatTip(r, p) {
    var N2 = sim.N2, i = st.sel, c = sim.inv[i][p], w = sim.W[i], b = c * N2, rs = sim.perms[i][c], am = 0, bv = -1e300;
    for (var rr = 0; rr < N2; rr++) if (w[b + rr] > bv) { bv = w[b + rr]; am = rr; }
    tip.textContent = '';
    var hd = E('div', 'sut-th', null, tip);
    hd.appendChild(document.createTextNode('phrasebook ' + (i + 1) + ' · rule '));
    E('b', null, String(c + 1), hd);
    hd.appendChild(document.createTextNode(': ' + pairIn(c) + ' → ' + pairOut(rs)));
    var g = E('div', 'sut-tg', null, tip);
    function row(k, pr, val, on) { E('span', on ? 'on' : 'k', k, g); E('span', null, pr, g); E('b', 'v' + (on ? ' on' : ''), val.toFixed(2), g); }
    row('correct', pairOut(rs), w[b + rs], am === rs);
    row('argmax', pairOut(am), w[b + am], am === rs);
    if (r !== rs && r !== am) row('this cell', pairOut(r), w[b + r], false);
    var mk = curMask();
    if (st.mode !== 'none' && mk.layer === i && mk.rule === c) E('div', 'k', 'removed from the context at this step', tip);
  }

  /* ================= tooltip, hover, keyboard ================= */
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
  function clearHover() {
    hovC = null; hovH = null;
    if (C.hov) C.hov.classList.remove('on');
    if (Hm.hcell) Hm.hcell.classList.remove('on');
    tip.classList.remove('on');
  }
  function local(svg, e, G) {
    var r = svg.getBoundingClientRect(), fr = fig.getBoundingClientRect(), k = G.w ? G.w / r.width : 1;
    return { px: (e.clientX - r.left) * k, py: (e.clientY - r.top) * k, at: { x: e.clientX - fr.left, y: e.clientY - fr.top, touch: e.pointerType === 'touch' } };
  }
  function anchorAt(svg, x, y, vw) {
    var r = svg.getBoundingClientRect(), fr = fig.getBoundingClientRect(), k = r.width / vw;
    return { x: r.left - fr.left + x * k, y: r.top - fr.top + y * k, touch: false };
  }
  function stepAt(px) {
    var G = C.G, s = Math.round((px - ML) / G.pw * st.runLen);
    return Math.max(0, Math.min(sim.s, s));
  }
  function setCurveHover(s, at) {
    hovH = null;
    if (Hm.hcell) Hm.hcell.classList.remove('on');
    hovC = { s: s, at: at };
    markCurve(s);
    curveTip(s);
    showTip(at);
  }
  function selectLayer(i) {
    i = Math.max(0, Math.min(st.d - 1, i));
    if (i === st.sel) return;
    st.sel = i;
    selLayer.value = String(i);
    selName.textContent = 'W' + (i + 1);
    emphasize();
    drawBands();
    if (Hm.lvl) Hm.lvl.fill(-1);
    paintCurve();
    paintHeat();
    paintStatus();
  }
  (function bindCurve() {
    var svg = C.svg;
    function onPtr(e) {
      if (!C.G) return;
      var l = local(svg, e, { w: C.G.w });
      setCurveHover(stepAt(l.px), l.at);
    }
    svg.addEventListener('pointermove', onPtr);
    svg.addEventListener('pointerdown', onPtr);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') clearHover(); });
    svg.addEventListener('pointercancel', clearHover);
    svg.addEventListener('click', function (e) {     // pick the layer whose line is nearest to the pointer
      if (!C.G) return;
      var l = local(svg, e, { w: C.G.w }), s = stepAt(l.px), best = 0, bd = 1e9;
      for (var i = 0; i < st.d; i++) {
        var dy = Math.abs(C.G.y(sim.cnt[s * st.d + i] / sim.N2) - l.py) + (i === st.sel ? 0.01 : 0);
        if (dy < bd) { bd = dy; best = i; }
      }
      if (bd < 24) selectLayer(best);
      if (hovC) curveTip(hovC.s);
    });
    svg.addEventListener('keydown', function (e) {
      if (!C.G) return;
      var s = hovC ? hovC.s : sim.s, k = e.key, jump = Math.max(1, Math.round(st.runLen / 60));
      if (k === 'ArrowRight') s += jump;
      else if (k === 'ArrowLeft') s -= jump;
      else if (k === 'Home') s = 0;
      else if (k === 'End') s = sim.s;
      else if (k === 'ArrowUp') selectLayer(st.sel - 1);
      else if (k === 'ArrowDown') selectLayer(st.sel + 1);
      else if (k === 'Escape') { clearHover(); return; }
      else return;
      e.preventDefault();
      s = Math.max(0, Math.min(sim.s, s));
      setCurveHover(s, anchorAt(svg, C.G.x(s), MT + C.G.PH / 2, C.G.w));
    });
    svg.addEventListener('focus', function () {
      var kb = true;
      try { kb = svg.matches(':focus-visible'); } catch (err) { /* older engines: treat as keyboard focus */ }
      if (kb && C.G) { var s = hovC ? hovC.s : sim.s; setCurveHover(s, anchorAt(svg, C.G.x(s), MT + C.G.PH / 2, C.G.w)); }
    });
    svg.addEventListener('blur', clearHover);
  })();

  function setHeatHover(r, p, at) {
    hovC = null;
    if (C.hov) C.hov.classList.remove('on');
    var G = Hm.G;
    hovH = { r: r, p: p };
    Hm.hcell.setAttribute('x', r2(G.x0 + p * G.cs));
    Hm.hcell.setAttribute('y', r2(G.y0 + r * G.cs));
    Hm.hcell.classList.add('on');
    heatTip(r, p);
    showTip(at);
  }
  (function bindHeat() {
    var svg = Hm.svg;
    function onPtr(e) {
      if (!Hm.G) return;
      var G = Hm.G, l = local(svg, e, { w: Hm.w }), p = Math.floor((l.px - G.x0) / G.cs), r = Math.floor((l.py - G.y0) / G.cs);
      if (p < 0 || r < 0 || p >= sim.N2 || r >= sim.N2) { if (hovH) clearHover(); return; }
      setHeatHover(r, p, l.at);
    }
    svg.addEventListener('pointermove', onPtr);
    svg.addEventListener('pointerdown', onPtr);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') clearHover(); });
    svg.addEventListener('pointercancel', clearHover);
    function kbAt(r, p) { var G = Hm.G; return anchorAt(svg, G.x0 + (p + 1) * G.cs, G.y0 + (r + 0.5) * G.cs, Hm.w); }
    svg.addEventListener('keydown', function (e) {
      if (!Hm.G) return;
      var r = hovH ? hovH.r : 0, p = hovH ? hovH.p : 0, k = e.key, N2 = sim.N2;
      if (k === 'ArrowRight') p++;
      else if (k === 'ArrowLeft') p--;
      else if (k === 'ArrowDown') r++;
      else if (k === 'ArrowUp') r--;
      else if (k === 'Home') { r = 0; p = 0; }
      else if (k === 'End') { r = N2 - 1; p = N2 - 1; }
      else if (k === 'Escape') { clearHover(); return; }
      else return;
      e.preventDefault();
      r = Math.max(0, Math.min(N2 - 1, r)); p = Math.max(0, Math.min(N2 - 1, p));
      setHeatHover(r, p, kbAt(r, p));
    });
    svg.addEventListener('focus', function () {
      var kb = true;
      try { kb = svg.matches(':focus-visible'); } catch (err) { /* treat as keyboard focus */ }
      if (kb && Hm.G) { var r = hovH ? hovH.r : 0, p = hovH ? hovH.p : 0; setHeatHover(r, p, kbAt(r, p)); }
    });
    svg.addEventListener('blur', clearHover);
  })();
  document.addEventListener('pointerdown', function (e) {
    if ((hovC || hovH) && !C.svg.contains(e.target) && !Hm.svg.contains(e.target)) clearHover();
  });

  /* ================= status and labels ================= */
  function paintStatus() {
    if (!sim) return;
    var d = st.d, N2 = sim.N2, s = sim.s, cnt = [], i, mk = curMask(), ta = sim.testAt(s);
    for (i = 0; i < d; i++) cnt.push(sim.cnt[s * d + i]);
    statusEl.textContent = '';
    function seg(parts, last) {
      var sp = E('span', 's', null, statusEl);
      parts.forEach(function (p, j) { if (j % 2) E('b', null, p, sp); else sp.appendChild(document.createTextNode(p)); });
      if (!last) statusEl.appendChild(document.createTextNode(' · '));
    }
    seg(['Step ', String(s), ' of ' + st.runLen]);
    if (st.mode === 'none') seg(['no phrasebook in context']);
    else seg(['masking rule ', String(mk.rule + 1), ' of phrasebook ', String(mk.layer + 1)]);
    seg(['loss ', fmtLoss(sim.lastLoss())]);
    seg(['columns learned ', cnt.join(', '), ' of ' + N2]);
    seg(['no-context test accuracy ', ta != null ? pct(ta) : '–'], sim.done < 0);
    if (sim.done >= 0) seg(['all rules stored at step ', String(sim.done)], true);

    var sc = cnt[st.sel];
    C.svg.setAttribute('aria-label', 'Fraction of columns of HardMax(W_i) that match the phrasebook, per layer, over ' + s + ' training steps (' +
      modeName() + '). Now: ' + cnt.map(function (c, j) { return 'W' + (j + 1) + ' ' + (c / N2).toFixed(2); }).join(', ') + '; chance is ' + (1 / N2).toFixed(3) + '.');
    Hm.svg.setAttribute('aria-label', 'Heatmap of the weights W' + (st.sel + 1) + ', ' + N2 + ' by ' + N2 + ', columns ordered so the correct rule lies on the diagonal. ' +
      sc + ' of ' + N2 + ' columns have their largest weight on the correct output.');
  }
  function modeName() { return st.mode === 'layer' ? 'context, layer-wise updates' : st.mode === 'full' ? 'context, all layers updated' : 'no context'; }
  function syncPlay() {
    var fin = sim && sim.s >= st.runLen;
    bPlay.textContent = want ? 'pause' : fin ? 'continue' : 'play';
    bPlay.setAttribute('aria-pressed', String(want));
    bPlay.setAttribute('aria-label', want ? 'Pause the training' : fin ? 'Continue the training for one more cycle' : 'Run the training');
    statusEl.setAttribute('aria-live', want ? 'off' : 'polite');   // no stream of announcements while it runs
  }

  /* ================= run loop ================= */
  function draw() {
    lastDraw = performance.now();
    paintCurve();
    paintHeat();
    paintStatus();
  }
  function schedule() { if (!raf && want && vis) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (!want || !vis || !sim) return;
    var t0 = performance.now();
    do { sim.step(); } while (sim.s < st.runLen && performance.now() - t0 < BUDGET);
    var fin = sim.s >= st.runLen;
    if (fin) { want = false; syncPlay(); }
    if (fin || !reduced() || now - lastDraw >= 100) draw();
    schedule();
  }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  function restart() {
    stop();
    clearHover();
    sim = Sim(st.n, st.d, st.mode, st.lr, st.seed);
    st.runLen = CYCLES0 * sim.cycle;
    if (st.sel >= st.d) st.sel = 0;
    selLayer.textContent = '';
    for (var i = 0; i < st.d; i++) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = 'layer ' + (i + 1);
      selLayer.appendChild(o);
    }
    selLayer.value = String(st.sel);
    selName.textContent = 'W' + (st.sel + 1);
    if (kMask) kMask.hidden = st.mode === 'none';
    buildCurve();
    buildHeat();
    paintStatus();
    syncPlay();
    schedule();
  }
  function userChange() { if (!reduced()) want = true; restart(); }

  /* ================= controls ================= */
  modeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var m = b.getAttribute('data-mode');
      if (m === st.mode) return;
      st.mode = m;
      modeBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      userChange();
    });
  });
  selSize.addEventListener('change', function () {
    var a = selSize.value.split(',').map(Number);
    if (a[0] === st.n && a[1] === st.d) return;
    st.n = a[0]; st.d = a[1];
    userChange();
  });
  selLr.addEventListener('change', function () {
    var v = Number(selLr.value);
    if (v === st.lr) return;
    st.lr = v;
    userChange();
  });
  selLayer.addEventListener('change', function () { selectLayer(Number(selLayer.value)); });
  bPlay.addEventListener('click', function () {
    if (want) { want = false; stop(); syncPlay(); draw(); return; }
    if (sim.s >= st.runLen) {                       // continue: one more curriculum cycle
      st.runLen += sim.cycle;
      sim.grow(st.runLen);
      buildCurve();
    }
    want = true;
    syncPlay();
    schedule();
  });
  if (bReset) bReset.addEventListener('click', function () { st.seed += 1; userChange(); });

  /* ================= init, width tracking, visibility ================= */
  function fit() {
    var changed = false, wc = Math.round(hostC.clientWidth), wh = Math.round(hostH.clientWidth);
    if (wc > 0 && wc !== C.w) { C.w = wc; changed = true; buildCurve(); }
    if (wh > 0 && wh !== Hm.w) { Hm.w = wh; changed = true; buildHeat(); }
    if (changed) clearHover();
  }
  restart();
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(fig.querySelector('.sut-panels'));
  else window.addEventListener('resize', fit);
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      vis = es[es.length - 1].isIntersecting;
      if (vis) schedule(); else stop();
    }, { threshold: 0.15 }).observe(fig);
  }
})();
