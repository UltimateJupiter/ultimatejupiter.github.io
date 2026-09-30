/* Figure 2 (fx-sample-efficiency): test accuracy without context against the number of training samples, for the
   curricula of the paper's Figure 2 (Sec. 3.2) on MLT(5, 8) and MLT(5, 10), with the three ablations on request.
   Values were read from the vector graphics of the paper's Figure 2 (marker centres mapped through the drawn ticks;
   about ±0.005) and are kept at 2 decimals. Each series keeps exactly the dataset sizes it was plotted at. */
(function () {
  'use strict';
  var fig = document.getElementById('fx-sample-efficiency');
  if (!fig) return;

  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- data (paper Figure 2, digitized) ---------- */
  var SER = [   // legend order
    { id: 'ann', name: 'Annealing Dropout', mk: 'star' },
    { id: 'fix', name: 'Fixed Dropout', mk: 'sq' },
    { id: 'noc', name: 'No Context', mk: 'circ' },
    { id: 'nod', name: 'No Dropout', mk: 'x', abl: true },
    { id: 'wrc', name: 'Wrong Context', mk: 'x', abl: true },
    { id: 'nic', name: 'No ICL', mk: 'x', abl: true }
  ];
  var DRAW = ['nic', 'wrc', 'nod', 'noc', 'fix', 'ann'];   // paint order: main curricula on top
  var PANELS = [
    { title: 'MLT(5, 8)', n: 8, d: {
      noc: [[1e4, .13], [1e5, .13], [2.5e5, .13], [5e5, .14], [1e6, .76]],
      fix: [[2.5e4, .17], [5e4, .60], [1e5, .94], [2.5e5, 1.00], [5e5, 1.00]],
      ann: [[1e4, .13], [2.5e4, .20], [5e4, 1.00], [1e5, 1.00], [2.5e5, 1.00]],
      nod: [[1e4, .13], [1e5, .12], [2.5e5, .12], [5e5, .12], [1e6, .13]],
      wrc: [[1e4, .13], [1e5, .13], [2.5e5, .13], [5e5, .36], [1e6, .15]],
      nic: [[1e4, .13], [1e5, .13], [5e5, .13], [1e6, .13]]
    } },
    { title: 'MLT(5, 10)', n: 10, d: {
      noc: [[1e4, .10], [1e5, .10], [2.5e5, .10], [5e5, .10], [1e6, .10]],
      fix: [[2.5e4, .10], [5e4, .14], [1e5, .51], [2.5e5, .98], [5e5, .99]],
      ann: [[1e4, .11], [2.5e4, .11], [5e4, .10], [7.5e4, 1.00], [1e5, 1.00], [2.5e5, 1.00]],
      nod: [[1e4, .10], [1e5, .11], [2.5e5, .10], [5e5, .10], [1e6, .11]],
      wrc: [[1e4, .10], [1e5, .10], [2.5e5, .10], [5e5, .09], [1e6, .10]],
      nic: [[1e4, .10], [1e5, .10], [5e5, .10], [1e6, .10]]
    } }
  ];
  var BY = {};
  SER.forEach(function (s) { BY[s.id] = s; });

  /* ---------- geometry ---------- */
  var ML = 38, MR = 8, MT = 22, PH = 168, MB = 42;
  var X0 = Math.log10(8e3), X1 = Math.log10(1.25e6), YMAX = 1.05;

  var st = { all: false, hl: null };
  var hov = null;   // {c, i} : chart and index into its visible sizes

  var segBtns = Array.prototype.slice.call(fig.querySelectorAll('.fx-seg button[data-mode]'));
  var legend = fig.querySelector('.fxse-legend');
  var statusEl = fig.querySelector('.fx-status');
  var panelEls = Array.prototype.slice.call(fig.querySelectorAll('.fx-panel[data-panel]'));
  var panelsBox = fig.querySelector('.fx-panels');
  if (!legend || !statusEl || panelEls.length !== 2 || !panelsBox) return;

  var tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);

  /* ---------- helpers ---------- */
  function r2(v) { return Math.round(v * 100) / 100; }
  function crisp(v) { return Math.floor(v) + 0.5; }
  function f2(v) { return v.toFixed(2); }
  function num(v) { return Math.round(v).toLocaleString('en-US'); }
  function S(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function T(parent, x, y, str, anchor, cls) {
    var t = S('text', { x: r2(x), y: r2(y), 'text-anchor': anchor || 'start', 'class': cls || null }, parent);
    if (str != null) t.textContent = str;
    return t;
  }
  function H(tag, cls, txt, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  }
  function visible(s) { return !BY[s].abl || st.all; }

  /* markers, centred at (x, y); size in px as in FIGURES.md (≥ 6px) */
  function marker(kind, x, y, parent) {
    var p;
    if (kind === 'star') {
      var d = '', R = 5.4, r = 2.3;
      for (var k = 0; k < 10; k++) {
        var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r : R;
        d += (k ? 'L' : 'M') + r2(x + rr * Math.cos(a)) + ',' + r2(y + rr * Math.sin(a));
      }
      p = S('path', { 'class': 'mk-star', d: d + 'Z' }, parent);
    } else if (kind === 'sq') {
      p = S('rect', { 'class': 'mk-sq', x: r2(x - 3.4), y: r2(y - 3.4), width: 6.8, height: 6.8 }, parent);
    } else if (kind === 'circ') {
      p = S('circle', { 'class': 'mk-circ', cx: r2(x), cy: r2(y), r: 3.4 }, parent);
    } else {
      var e = 3.1;
      p = S('path', { 'class': 'mk-x', d: 'M' + r2(x - e) + ',' + r2(y - e) + 'l' + 2 * e + ',' + 2 * e + 'M' + r2(x - e) + ',' + r2(y + e) + 'l' + 2 * e + ',' + -2 * e }, parent);
    }
    return p;
  }
  function swatch(s, parent) {   // line + marker, as drawn in the charts
    var svg = S('svg', { 'class': 'fxse-sw s-' + s.id + (s.abl ? ' abl' : ''), width: 22, height: 12, viewBox: '0 0 22 12', 'aria-hidden': 'true' }, parent);
    S('path', { 'class': 'fxse-line', d: 'M1,6H21' }, svg);
    marker(s.mk, 11, 6, svg);
    return svg;
  }

  /* ---------- verbal summaries (status line and aria-labels) ---------- */
  function describe(pi, id) {
    var pts = PANELS[pi].d[id], near = 1 / PANELS[pi].n + 0.05, last = pts.length - 1, k = -1, i, out = '';
    while (k < last && pts[k + 1][1] <= near) k++;
    function run(j) {   // the initial near-chance stretch pts[0..j]
      var lo = Infinity, hi = -Infinity;
      for (var q = 0; q <= j; q++) { lo = Math.min(lo, pts[q][1]); hi = Math.max(hi, pts[q][1]); }
      if (j === 0) return 'is at ' + f2(pts[0][1]) + ' at ' + num(pts[0][0]) + ' samples';
      return 'stays ' + (f2(lo) === f2(hi) ? 'at ' + f2(lo) : 'between ' + f2(lo) + ' and ' + f2(hi)) + ' up to ' + num(pts[j][0]) + ' samples';
    }
    if (k === last) return run(k);
    if (k >= 0) out = run(k) + ', then ';
    var top = 0;
    for (i = 0; i <= last; i++) if (pts[i][1] > pts[top][1]) top = i;
    if (pts[top][1] >= 0.9) {
      for (i = 0; pts[i][1] < 0.9; i++);
      out += 'reaches ' + f2(pts[i][1]) + ' at ' + num(pts[i][0]) + (k < 0 ? ' samples' : '');
      if (f2(pts[i][1]) !== '1.00') {
        for (var j = i + 1; j <= last; j++) if (f2(pts[j][1]) === '1.00') { out += ' and 1.00 at ' + num(pts[j][0]); break; }
      }
    } else {
      out += 'rises to ' + f2(pts[top][1]) + ' at ' + num(pts[top][0]) + (k < 0 ? ' samples' : '');
      if (top < last) out += ', then falls to ' + f2(pts[last][1]) + ' at ' + num(pts[last][0]);
    }
    return out;
  }
  function firstAbove(pi, id, v) {
    var pts = PANELS[pi].d[id];
    for (var i = 0; i < pts.length; i++) if (pts[i][1] >= v) return pts[i];
    return null;
  }
  function range(ids) {
    var lo = Infinity, hi = -Infinity;
    ids.forEach(function (id) { PANELS.forEach(function (P) { P.d[id].forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }); }); });
    return [lo, hi];
  }

  function setStatus() {
    statusEl.textContent = '';
    function b(s) { H('b', null, s, statusEl); }
    function t(s) { statusEl.appendChild(document.createTextNode(s)); }
    if (st.hl) {
      b(BY[st.hl].name);
      PANELS.forEach(function (P, pi) {
        t((pi ? '; on ' : ': on ') + P.title + ' it ' + describe(pi, st.hl));
      });
      t('.');
      return;
    }
    var a = firstAbove(1, 'ann', 0.9), f = firstAbove(1, 'fix', 0.9);
    t(PANELS[1].title + ': Annealing Dropout reaches ');
    b(f2(a[1]));
    t(' at ' + num(a[0]) + ' samples and Fixed Dropout ');
    b(f2(f[1]));
    t(' at ' + num(f[0]) + '; No Context ' + describe(1, 'noc').replace(' samples', '') + '.');
    if (st.all) {
      var rr = range(['nod', 'nic']), w = PANELS[0].d.wrc, top = w[0];
      w.forEach(function (p) { if (p[1] > top[1]) top = p; });
      t(' No Dropout and No ICL stay between ' + f2(rr[0]) + ' and ' + f2(rr[1]) + ' in both panels; Wrong Context peaks at ');
      b(f2(top[1]));
      t(' at ' + num(top[0]) + ' on ' + PANELS[0].title + '.');
    }
  }

  function ariaLabel(c) {
    var P = PANELS[c.pi], ids = SER.filter(function (s) { return visible(s.id); }).map(function (s) { return s.id; });
    var lab = 'Test accuracy without context versus training samples for ' + P.title + ', ' +
      (st.all ? 'three curricula and three ablations' : 'three curricula') + '; random guess 1/' + P.n + ' = ' + (1 / P.n) + '. ';
    if (st.hl && visible(st.hl)) ids = [st.hl].concat(ids.filter(function (id) { return id !== st.hl; }));
    lab += ids.map(function (id) { return BY[id].name + ' ' + describe(c.pi, id) + '.'; }).join(' ');
    c.svg.setAttribute('aria-label', lab);
  }

  /* ---------- charts ---------- */
  function chart(pi) {
    var host = panelEls[pi].querySelector('.fxse-plot');
    var svg = S('svg', { 'class': 'fx-svg', role: 'img', tabindex: '0' }, host);
    var c = { pi: pi, host: host, svg: svg, w: 0, G: null, ser: {} };
    bind(c);
    return c;
  }

  function draw(c) {
    if (!c.w) return;
    var P = PANELS[c.pi], w = c.w, pw = Math.max(80, w - ML - MR), y0 = MT + PH;
    var G = c.G = {
      w: w, h: MT + PH + MB, pw: pw, y0: y0,
      x: function (v) { return ML + (Math.log10(v) - X0) / (X1 - X0) * pw; },
      y: function (a) { return MT + PH * (1 - a / YMAX); }
    };
    var svg = c.svg;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + G.h);
    svg.setAttribute('width', w);
    svg.setAttribute('height', G.h);

    var g = S('g', null, svg);
    [0.25, 0.5, 0.75, 1].forEach(function (v) {
      var y = crisp(G.y(v));
      S('line', { 'class': 'gr', x1: ML, x2: r2(ML + pw), y1: y, y2: y }, g);
    });
    [4, 5, 6].forEach(function (e) {
      var x = crisp(G.x(Math.pow(10, e)));
      S('line', { 'class': 'gr v', x1: x, x2: x, y1: r2(G.y(YMAX)), y2: y0 }, g);
    });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) { T(g, ML - 6, G.y(v) + 3.5, v.toFixed(2), 'end'); });
    if (c.pi === 0 || stacked) T(g, 0, 9, 'test accuracy without context', 'start');

    // x axis: decades with minor ticks at 2..9 × 10^k
    S('line', { 'class': 'ax', x1: ML, x2: r2(ML + pw), y1: crisp(y0), y2: crisp(y0) }, g);
    for (var e = 3; e <= 6; e++) {
      for (var m = 1; m <= 9; m++) {
        var v = m * Math.pow(10, e);
        if (v < 8e3 || v > 1.25e6) continue;
        var x = crisp(G.x(v));
        S('line', { 'class': 'tk', x1: x, x2: x, y1: crisp(y0), y2: crisp(y0) + (m === 1 ? 5 : 3) }, g);
        if (m === 1) {
          var t = T(g, x - 2, y0 + 19, '10', 'middle');
          var sup = S('tspan', { 'class': 'sup', dy: -4.5 }, t);
          sup.textContent = String(e);
        }
      }
    }
    T(g, ML + pw / 2, y0 + 37, 'training samples', 'middle');

    // random guess 1/n
    var yr = r2(G.y(1 / P.n));
    S('line', { 'class': 'fxse-rg', x1: ML + 1, x2: r2(ML + pw), y1: yr, y2: yr }, g);
    T(g, ML + pw - 2, yr + 12, 'random guess', 'end', 'fxse-rgl');

    // series
    c.layer = S('g', null, svg);
    c.ser = {};
    DRAW.forEach(function (id) {
      var s = BY[id], pts = P.d[id];
      var sg = S('g', { 'class': 'fxse-ser s-' + id + (s.abl ? ' abl' : '') }, c.layer);
      var d = '';
      pts.forEach(function (p, i) { d += (i ? 'L' : 'M') + r2(G.x(p[0])) + ',' + r2(G.y(p[1])); });
      S('path', { 'class': 'fxse-line', d: d }, sg);
      pts.forEach(function (p) { marker(s.mk, G.x(p[0]), G.y(p[1]), sg); });
      c.ser[id] = sg;
    });

    var hg = S('g', { 'class': 'fxse-hov' }, svg);
    c.hair = S('line', { 'class': 'hair', y1: r2(G.y(YMAX)), y2: y0 }, hg);
    c.hov = hg;
    paintSeries(c);
    ariaLabel(c);
  }

  function paintSeries(c) {
    if (!c.G) return;
    DRAW.forEach(function (id) {
      var sg = c.ser[id];
      sg.classList.toggle('hid', !visible(id));
      sg.classList.toggle('dim', !!st.hl && st.hl !== id);
    });
    DRAW.forEach(function (id) { if (id !== st.hl) c.layer.appendChild(c.ser[id]); });
    if (st.hl) c.layer.appendChild(c.ser[st.hl]);   // the highlighted series on top
  }

  /* ---------- hover, touch and keyboard ---------- */
  function sizes(c) {   // dataset sizes with at least one visible point in this panel
    var set = {};
    SER.forEach(function (s) { if (visible(s.id)) PANELS[c.pi].d[s.id].forEach(function (p) { set[p[0]] = 1; }); });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }
  function fillTip(c, v) {
    tip.textContent = '';
    var hd = H('div', 'fxse-th', null, tip);
    H('b', null, num(v), hd);
    hd.appendChild(document.createTextNode(' samples · ' + PANELS[c.pi].title));
    var g = H('div', 'fxse-tg', null, tip);
    SER.forEach(function (s) {
      if (!visible(s.id)) return;
      var p = PANELS[c.pi].d[s.id].filter(function (q) { return q[0] === v; })[0];
      if (!p) return;
      swatch(s, g);
      H('span', 'k' + (st.hl === s.id ? ' hl' : ''), s.name, g);
      H('b', 'v', f2(p[1]), g);
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
  function setHover(c, v, at) {
    if (!hov || hov.c !== c || hov.v !== v) {
      clearMarks();
      hov = { c: c, v: v };
      var x = r2(c.G.x(v));
      c.hair.setAttribute('x1', x);
      c.hair.setAttribute('x2', x);
      c.hov.classList.add('on');
      fillTip(c, v);
    }
    showTip(at);
  }
  function clearMarks() { CH.forEach(function (c) { if (c.hov) c.hov.classList.remove('on'); }); }
  function clearHover() {
    hov = null;
    clearMarks();
    tip.classList.remove('on');
  }
  function anchor(c, v) {
    var r = c.svg.getBoundingClientRect(), fr = fig.getBoundingClientRect(), k = r.width / c.G.w;
    return { x: r.left - fr.left + c.G.x(v) * k, y: r.top - fr.top + (MT + PH / 2) * k, touch: false };
  }
  function bind(c) {
    var svg = c.svg;
    function onPtr(e) {
      if (!c.G) return;
      var r = svg.getBoundingClientRect(), fr = fig.getBoundingClientRect();
      var px = (e.clientX - r.left) * (c.G.w / r.width);
      var lv = X0 + (px - ML) / c.G.pw * (X1 - X0), xs = sizes(c), best = xs[0];
      xs.forEach(function (v) { if (Math.abs(Math.log10(v) - lv) < Math.abs(Math.log10(best) - lv)) best = v; });
      setHover(c, best, { x: e.clientX - fr.left, y: e.clientY - fr.top, touch: e.pointerType === 'touch' });
    }
    svg.addEventListener('pointermove', onPtr);
    svg.addEventListener('pointerdown', onPtr);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') clearHover(); });
    svg.addEventListener('pointercancel', clearHover);
    svg.addEventListener('keydown', function (e) {
      if (!c.G) return;
      var xs = sizes(c), i = hov && hov.c === c ? xs.indexOf(hov.v) : -1, k = e.key;
      if (k === 'ArrowRight') i = i < 0 ? 0 : i + 1;
      else if (k === 'ArrowLeft') i = i < 0 ? 0 : i - 1;
      else if (k === 'Home') i = 0;
      else if (k === 'End') i = xs.length - 1;
      else if (k === 'Escape') { clearHover(); return; }
      else return;
      e.preventDefault();
      i = Math.max(0, Math.min(xs.length - 1, i));
      setHover(c, xs[i], anchor(c, xs[i]));
    });
    svg.addEventListener('focus', function () {
      var kb = true;
      try { kb = svg.matches(':focus-visible'); } catch (err) { /* older engines: treat as keyboard focus */ }
      if (kb && c.G) { var v = sizes(c)[0]; setHover(c, v, anchor(c, v)); }
    });
    svg.addEventListener('blur', clearHover);
  }
  document.addEventListener('pointerdown', function (e) {   // a tap elsewhere dismisses a touch readout
    if (hov && !CH.some(function (c) { return c.svg.contains(e.target); })) clearHover();
  });

  /* ---------- controls ---------- */
  var lgBtns = {};
  function buildLegend() {
    legend.textContent = '';
    SER.forEach(function (s, i) {
      if (s.abl && !SER[i - 1].abl) {
        H('span', 'brk', null, legend);
        H('span', 'grp', 'ablations', legend);
      }
      var b = H('button', 'fxse-lg', null, legend);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      swatch(s, b);
      H('span', null, s.name, b);
      b.addEventListener('click', function () {
        if (s.abl && !st.all) setMode(true);
        st.hl = st.hl === s.id ? null : s.id;
        refresh();
      });
      lgBtns[s.id] = b;
    });
  }
  function paintLegend() {
    SER.forEach(function (s) {
      var b = lgBtns[s.id], on = st.hl === s.id;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('off', !visible(s.id));
      b.setAttribute('aria-label', s.name + (s.abl ? ' (ablation)' : '') + (visible(s.id) ? '' : ', hidden; selecting it shows the ablations'));
    });
    legend.classList.toggle('has-sel', !!st.hl);
  }
  function setMode(all) {
    st.all = all;
    if (!all && st.hl && BY[st.hl].abl) st.hl = null;
    segBtns.forEach(function (x) { x.setAttribute('aria-pressed', String((x.getAttribute('data-mode') === 'all') === all)); });
  }
  segBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var all = b.getAttribute('data-mode') === 'all';
      if (all === st.all) return;
      setMode(all);
      refresh();
    });
  });
  function refresh() {
    clearHover();
    CH.forEach(function (c) { paintSeries(c); if (c.G) ariaLabel(c); });
    paintLegend();
    setStatus();
  }

  /* ---------- init + width tracking ---------- */
  var stacked = false;
  var CH = [chart(0), chart(1)];
  buildLegend();
  function fit() {
    var nowStacked = panelEls[1].offsetTop > panelEls[0].offsetTop + 4;
    var force = nowStacked !== stacked;
    stacked = nowStacked;
    CH.forEach(function (c) {
      var w = Math.round(c.host.clientWidth);
      if (w > 0 && (w !== c.w || force)) {
        c.w = w;
        draw(c);
        if (hov) clearHover();
      }
    });
  }
  fit();
  refresh();
  var fitRaf = 0;   // redraw on the next frame, so a redraw never feeds back into the same observation
  if (window.ResizeObserver) new ResizeObserver(function () { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fit); }).observe(panelsBox);
  else window.addEventListener('resize', fit);
})();
