/* Figure 2 (fx-acc): accuracy by target-key position mod 24 at the final checkpoint.
   Left: full-attention baselines (1, 4, 8 KV heads; fixed). Right: one compressed run chosen with the select and the
   padding toggle, with window-start guides, boundary ticks and the same-KV full-attention run as a dashed ghost; compressed lines are dotted across period boundaries. */
(function () {
  'use strict';
  var fig = document.getElementById('fx-acc');
  if (!fig) return;
  var D = window.FIGDATA;
  if (!D || !D.runs || !D.acc) { console.error('fx-acc: window.FIGDATA is missing'); return; }

  var NS = 'http://www.w3.org/2000/svg';
  var N = 24;                                        // source-key positions mod 24
  var ML = 32, MR = 6, MT = 22, PH = 152, MB = 38;   // identical in both panels, so the scales match exactly
  var CH = 6.3;                                      // advance of the 10.5px mono face (0.6 em)
  var DUR = 260;                                     // morph duration (ms)

  var RUNS = D.runs.models, BY = {};
  RUNS.forEach(function (m) { BY[m.id] = m; });
  var FULL = D.acc.full.slice().sort(function (a, b) { return a.kv - b.kv; });
  var FKV = {};
  FULL.forEach(function (f) { FKV[f.kv] = f; });

  var sel = fig.querySelector('select.fx-select');
  var btns = Array.prototype.slice.call(fig.querySelectorAll('.fx-seg button[data-pad]'));
  var statusEl = fig.querySelector('.fx-status');
  var pFull = fig.querySelector('.fx-panel[data-panel="full"]');
  var pRun = fig.querySelector('.fx-panel[data-panel="run"]');
  if (!sel || !statusEl || !pFull || !pRun) return;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var st = { id: BY[D.runs.default] ? D.runs.default : RUNS[0].id, pad: 'pp' };
  var hov = null;      // {p, src} while a position is inspected
  var shown = null;    // right-panel arrays as currently drawn (possibly mid-morph)
  var raf = 0, fin = 0;

  var tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);

  /* ---------- helpers ---------- */
  function f1(v) { return (Math.round(v * 10 + 1e-7) / 10).toFixed(1); }   // half-up on the 2-decimal source values
  function r2(v) { return Math.round(v * 100) / 100; }
  function crisp(v) { return Math.floor(v) + 0.5; }
  function heads(kv) { return kv + ' KV head' + (kv === 1 ? '' : 's'); }
  function geo(m) { return 'W' + m.W + '/S' + m.S; }
  function argmin(a) { var j = 0; for (var i = 1; i < a.length; i++) if (a[i] < a[j]) j = i; return j; }
  function lo(a) { return Math.min.apply(null, a); }
  function hi(a) { return Math.max.apply(null, a); }
  function mix(a, b, t) { var o = new Array(N); for (var i = 0; i < N; i++) o[i] = a[i] + (b[i] - a[i]) * t; return o; }

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
  function H(tag, cls, txt, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, s) { parent.appendChild(document.createTextNode(s)); }

  function lineD(G, a) {
    var d = '';
    for (var i = 0; i < N; i++) d += (i ? 'L' : 'M') + r2(G.x(i)) + ',' + r2(G.y(a[i]));
    return d;
  }
  // compressed runs: solid within each stride period, dotted where the line crosses a period boundary (as in the paper)
  function segD(G, a, per) {
    var d = '';
    for (var i = 0; i < N; i++) d += (i % per ? 'L' : 'M') + r2(G.x(i)) + ',' + r2(G.y(a[i]));
    return d;
  }
  function crossD(G, a, per) {
    var d = '';
    for (var i = per - 1; i + 1 < N; i += per) d += 'M' + r2(G.x(i)) + ',' + r2(G.y(a[i])) + 'L' + r2(G.x(i + 1)) + ',' + r2(G.y(a[i + 1]));
    return d;
  }
  function bandD(G, l, h) {
    var d = '', i;
    for (i = 0; i < N; i++) d += (i ? 'L' : 'M') + r2(G.x(i)) + ',' + r2(G.y(h[i]));
    for (i = N - 1; i >= 0; i--) d += 'L' + r2(G.x(i)) + ',' + r2(G.y(l[i]));
    return d + 'Z';
  }

  /* the right panel's target state */
  function target() {
    var m = BY[st.id], d = m[st.pad], f = st.pad === 'pp' ? (FKV[m.kv] || null) : null;
    return { m: m, d: d, f: f };
  }

  /* ---------- charts ---------- */
  function chart(kind, panel) {
    var host = panel.querySelector('.fxa-plot');
    var svg = S('svg', { 'class': 'fx-svg', role: 'img', tabindex: '0' }, host);
    var c = { kind: kind, host: host, svg: svg, w: 0, G: null };
    bind(c);
    return c;
  }

  /* gridlines, y labels and axis title shared by both panels */
  function frame(c) {
    var w = c.w, pw = Math.max(60, w - ML - MR), step = pw / (N - 1), y0 = MT + PH;
    var G = c.G = {
      w: w, h: MT + PH + MB, pw: pw, step: step, y0: y0,
      x: function (p) { return ML + p * step; },
      y: function (v) { return MT + PH * (1 - Math.max(0, Math.min(100, v)) / 100); }
    };
    var svg = c.svg;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + G.h);
    svg.setAttribute('width', w);
    svg.setAttribute('height', G.h);
    var g = S('g', null, svg);
    [25, 50, 75, 100].forEach(function (v) {
      var y = crisp(G.y(v));
      S('line', { 'class': 'gr', x1: ML, x2: r2(ML + pw), y1: y, y2: y }, g);
    });
    [0, 25, 50, 75, 100].forEach(function (v) {
      T(g, ML - 6, G.y(v) + 3.5, v === 100 ? '100%' : String(v), 'end');
    });
    T(g, ML + pw / 2, y0 + 32, 'target-key position mod 24', 'middle');
    return G;
  }
  function axis(c) {
    var y = crisp(c.G.y0);
    S('line', { 'class': 'ax', x1: ML, x2: r2(ML + c.G.pw), y1: y, y2: y }, c.svg);
  }
  function hoverLayer(c, classes) {
    var g = S('g', { 'class': 'fxa-hov' }, c.svg);
    c.hair = S('line', { 'class': 'hair', y1: MT - 6, y2: c.G.y0 }, g);
    c.dots = classes.map(function (k) { return S('circle', { 'class': 'fxa-dot ' + k, r: k === 'run' ? 3.5 : 3, cx: 0, cy: 0 }, g); });
    c.hov = g;
  }

  function drawFull(c) {
    if (!c.w) return;
    var G = frame(c), svg = c.svg;
    c.series = FULL.map(function (f) {
      var g = S('g', { 'class': 'fxa-full k' + f.kv }, svg);
      S('path', { 'class': 'fxa-band', d: bandD(G, f.lo, f.hi) }, g);
      S('path', { 'class': 'fxa-line', d: lineD(G, f.acc) }, g);
      return { f: f, g: g };
    });
    /* direct labels at the right end, allocated top-down: above the band when there is room, else below it */
    var ceil = MT - 2;                                   // lowest y already taken by a band or a label above
    c.series.slice().sort(function (a, b) { return b.f.mean - a.f.mean; }).forEach(function (s, i, arr) {
      var tail = N - 4, top = G.y(hi(s.f.hi.slice(tail))), bot = G.y(lo(s.f.lo.slice(tail)));
      var next = arr[i + 1] ? G.y(hi(arr[i + 1].f.hi.slice(tail))) : G.y0;
      var yb = top - 4 - 8 >= ceil + 6 ? top - 4 : bot + 4 + 8;   // baseline; cap height ≈ 8px
      if (yb > next - 3 && top - 12 >= ceil) yb = top - 4;
      T(s.g, G.x(N - 1), yb, s.f.kv + ' KV', 'end', 'fxa-lab');
      ceil = Math.max(bot, yb + 2);
    });
    [0, 8, 16, 23].forEach(function (p) { T(svg, G.x(p), G.y0 + 16, String(p), 'middle'); });
    axis(c);
    hoverLayer(c, FULL.map(function (f) { return 'k' + f.kv; }));
    emphasize();
    labelFull();
  }

  function drawRun(c) {
    if (!c.w) return;
    frame(c);
    var svg = c.svg;
    c.per = S('g', null, svg);                    // window guides, x labels, boundary ticks (depend on S)
    var g = S('g', null, svg);
    c.band = S('path', { 'class': 'fxa-band run' }, g);
    c.ghost = S('path', { 'class': 'fxa-ghost', visibility: 'hidden' }, g);
    c.line = S('path', { 'class': 'fxa-line run' }, g);
    c.cross = S('path', { 'class': 'fxa-line run cross' }, g);
    c.key = S('g', null, svg);                    // top strip: key for the dashed line, or why it is missing
    axis(c);
    hoverLayer(c, ['k1', 'run']);
    drawPeriod(c);
    drawKey(c);
    if (shown) paint(c, shown);
  }

  function drawPeriod(c) {
    if (!c.G) return;
    var G = c.G, g = c.per, s = BY[st.id].S, p, x, labs = [];
    g.textContent = '';
    for (p = 0; p < N; p += s) {          // period boundaries (dashed), between positions p-1 and p; none at the left edge
      if (p) {
        x = crisp((G.x(p - 1) + G.x(p)) / 2);
        S('line', { 'class': 'fxa-guide', x1: x, x2: x, y1: crisp(G.y(100)), y2: G.y0 }, g);
      }
      labs.push(p);
    }
    if (N - 1 - labs[labs.length - 1] >= 2) labs.push(N - 1);
    labs.forEach(function (q) { T(g, G.x(q), G.y0 + 16, String(q), 'middle'); });
    for (p = s - 1; p < N; p += s) {      // boundary phase S-1: a small mark pointing up at the axis
      x = r2(G.x(p));
      S('path', { 'class': 'fxa-bnd', d: 'M' + x + ',' + r2(G.y0 + 2) + 'l3,4h-6z' }, g);
    }
  }

  function drawKey(c) {
    if (!c.G) return;
    var G = c.G, g = c.key, t = target(), xr = ML + G.pw, y = 8;
    g.textContent = '';
    if (t.f) {
      var s = 'full attention · ' + t.m.kv + ' KV', tw = s.length * CH;
      S('line', { 'class': 'fxa-ghost k' + t.m.kv, x1: r2(xr - tw - 22), x2: r2(xr - tw - 6), y1: y - 0.5, y2: y - 0.5 }, g);
      T(g, xr, y + 3.5, s, 'end');
    } else {
      T(g, xr, y + 3.5, st.pad === 'pp' ? 'no full-attention run with ' + heads(t.m.kv) : 'full attention: prefix padding only', 'end');
    }
  }

  function paint(c, s) {
    if (!c.G) return;
    c.band.setAttribute('d', bandD(c.G, s.lo, s.hi));
    var per = BY[st.id].S;
    c.line.setAttribute('d', segD(c.G, s.acc, per));
    c.cross.setAttribute('d', crossD(c.G, s.acc, per));
    if (s.g) c.ghost.setAttribute('d', lineD(c.G, s.g));
    c.ghost.setAttribute('class', 'fxa-ghost k' + s.kv);
    c.ghost.setAttribute('opacity', r2(s.gOp));        // faded by the morph, exact once it settles
    c.ghost.setAttribute('visibility', s.gOp > 0 ? 'visible' : 'hidden');
  }

  /* ---------- text around the charts ---------- */
  function labelFull() {
    var ps = pFull.querySelector('.fx-psub');
    ps.innerHTML =
      '<span class="l"><span class="s">mean ' + FULL.map(function (f) { return '<b>' + f1(f.mean) + '</b>'; }).join(' / ') + ' ·</span> ' +
      '<span class="s">gap ≤ <b>' + f1(hi(FULL.map(function (f) { return f.gap; }))) + '</b> pp</span></span>' +
      '<span class="l"><span class="s">val. loss ' + FULL.map(function (f) { return '<b>' + f.loss.toFixed(3) + '</b>'; }).join(' / ') + '</span></span>';
    CF.svg.setAttribute('aria-label', 'Full-attention baselines, prefix padding: accuracy by target-key position mod 24 for 1, 4, and 8 KV heads. ' +
      'Flat lines with means ' + FULL.map(function (f) { return f1(f.mean); }).join(', ') + ' percent; best-to-worst gap at most ' +
      f1(hi(FULL.map(function (f) { return f.gap; }))) + ' points.');
  }

  function labelRun() {
    var t = target(), m = t.m, d = t.d, pad = st.pad === 'pp' ? 'prefix' : 'in-sequence';
    pRun.querySelector('.fx-ptitle').textContent = m.name;
    var sub = pRun.querySelector('.fxa-sub');           // wraps only at the separators
    sub.textContent = '';
    [pad + ' padding'].forEach(function (s, i) {   // the title already names window, stride and KV heads
      if (i) txt(sub, ' ');
      H('span', 's', s, sub);
    });
    pRun.querySelector('.fx-psub').innerHTML =
      '<span class="l"><span class="s">mean <b>' + f1(d.mean[0]) + '</b> [' + f1(d.mean[1]) + ', ' + f1(d.mean[2]) + '] ·</span> ' +
      '<span class="s">worst <b>' + f1(lo(d.acc)) + '</b></span></span>' +
      '<span class="l"><span class="s">gap <b>' + f1(d.gap[0]) + '</b> pp [' + f1(d.gap[1]) + ', ' + f1(d.gap[2]) + '] ·</span> ' +
      '<span class="s">val. loss <b>' + m.loss.toFixed(3) + '</b></span></span>';

    var i = argmin(d.acc), r = i % m.S, bnd = r === m.S - 1;
    CR.svg.setAttribute('aria-label', m.name + ' (' + geo(m) + ', ' + heads(m.kv) + '), ' + pad + ' padding: accuracy by target-key position mod 24 ' +
      'ranges from ' + f1(lo(d.acc)) + ' to ' + f1(hi(d.acc)) + ' percent, mean ' + f1(d.mean[0]) + '; windows start every ' + m.S + ' positions. ' +
      (t.f ? 'Dashed line: full attention with ' + heads(m.kv) + ', ' + f1(lo(t.f.acc)) + ' to ' + f1(hi(t.f.acc)) + ' percent.'
           : st.pad === 'pp' ? 'There is no full-attention run with ' + heads(m.kv) + '.' : 'Full attention was evaluated with prefix padding only.'));

    statusEl.textContent = '';
    H('span', 'fxa-sr', m.name + ', ' + geo(m) + ', ' + heads(m.kv) + ', ' + pad + ' padding: mean ' + f1(d.mean[0]) +
      '%, gap ' + f1(d.gap[0]) + ' points. ', statusEl);
    txt(statusEl, 'Worst position ');
    H('b', null, String(i), statusEl);
    txt(statusEl, ' (' + i + ' mod ' + m.S + ' = ' + r + (bnd ? ', boundary' : '') + '): ');
    H('b', null, f1(d.acc[i]) + '%', statusEl);
    if (t.f) {
      txt(statusEl, ', full attention ');
      H('b', null, f1(t.f.acc[i]) + '%', statusEl);
      txt(statusEl, '.');
    } else {
      txt(statusEl, '.');
      H('span', 'fxa-sr', st.pad === 'pp' ? ' There is no full-attention run with ' + heads(m.kv) + '.' : ' Full attention was evaluated with prefix padding only.', statusEl);
    }
  }

  function emphasize() {
    var t = target(), on = t.f ? t.m.kv : 0;
    if (CF.series) CF.series.forEach(function (s) { s.g.classList.toggle('on', s.f.kv === on); });
  }

  /* ---------- state changes ---------- */
  function update(animate) {
    var t = target();
    clearHover();
    labelRun();
    emphasize();
    drawPeriod(CR);
    drawKey(CR);
    var from = shown;
    var to = {
      acc: t.d.acc, lo: t.d.lo, hi: t.d.hi,
      g: t.f ? t.f.acc : (from && from.g) || null,        // keep the old ghost's shape while it fades out
      kv: t.f ? t.m.kv : (from ? from.kv : 1),
      gOp: t.f ? 1 : 0
    };
    if (!animate || !from || document.hidden || (mq && mq.matches)) { settle(to); return; }
    settle(from);
    var t0 = performance.now();
    function step(now) {
      var k = Math.min(1, Math.max(0, (now - t0) / DUR)), e = 1 - Math.pow(1 - k, 3);
      if (k >= 1) { settle(to); return; }
      shown = {
        acc: mix(from.acc, to.acc, e), lo: mix(from.lo, to.lo, e), hi: mix(from.hi, to.hi, e),
        g: from.g && to.g ? mix(from.g, to.g, e) : to.g, kv: to.kv,
        gOp: from.gOp + (to.gOp - from.gOp) * Math.min(1, k * 1.6)
      };
      paint(CR, shown);
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    fin = setTimeout(function () { settle(to); }, DUR + 80);   // frames can be throttled: never leave a stale chart
  }
  function settle(s) {   // stop any morph and draw s exactly
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (fin) { clearTimeout(fin); fin = 0; }
    shown = s;
    paint(CR, s);
  }

  /* ---------- hover, touch and keyboard inspection ---------- */
  function place(dot, x, y) { dot.setAttribute('cx', r2(x)); dot.setAttribute('cy', r2(y)); dot.classList.remove('off'); }
  function mark(c, p) {
    if (!c.G || !c.hov) return;
    var x = r2(c.G.x(p));
    c.hair.setAttribute('x1', x);
    c.hair.setAttribute('x2', x);
    if (c.kind === 'full') {
      FULL.forEach(function (f, i) { place(c.dots[i], x, c.G.y(f.acc[p])); });
    } else {
      var t = target();
      place(c.dots[1], x, c.G.y(t.d.acc[p]));
      if (t.f) { c.dots[0].setAttribute('class', 'fxa-dot k' + t.m.kv); place(c.dots[0], x, c.G.y(t.f.acc[p])); }
      else c.dots[0].classList.add('off');
    }
    c.hov.classList.add('on');
  }
  function row(g, cls, v, l, h, label) {
    H('i', 'fxa-sw ' + cls, null, g);
    H('b', 'v', f1(v), g);
    H('span', 'k', '[' + f1(l) + ', ' + f1(h) + ']', g);
    H('span', 'k', label, g);
  }
  function fillTip(src, p) {
    tip.textContent = '';
    var hd = H('div', 'fxa-th', null, tip), g;
    txt(hd, 'position ');
    H('b', null, String(p), hd);
    if (src.kind === 'full') {
      g = H('div', 'fxa-tg', null, tip);
      FULL.slice().reverse().forEach(function (f) { row(g, 'k' + f.kv, f.acc[p], f.lo[p], f.hi[p], f.kv + ' KV'); });
    } else {
      var t = target(), m = t.m, r = p % m.S;
      txt(hd, ' · ' + p + ' mod ' + m.S + ' = ');
      H('b', null, String(r), hd);
      if (r === m.S - 1) txt(hd, ' · boundary');
      g = H('div', 'fxa-tg', null, tip);
      row(g, 'run', t.d.acc[p], t.d.lo[p], t.d.hi[p], 'compressed');
      if (t.f) row(g, 'k' + m.kv + ' dot', t.f.acc[p], t.f.lo[p], t.f.hi[p], 'full attention · ' + m.kv + ' KV');
    }
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
  function setHover(p, src, at) {
    if (!hov || hov.p !== p || hov.src !== src) {       // redraw only when the snapped position changes
      hov = { p: p, src: src };
      mark(CF, p);
      mark(CR, p);
      fillTip(src, p);
    }
    showTip(at);
  }
  function clearHover() {
    hov = null;
    [CF, CR].forEach(function (c) { if (c && c.hov) c.hov.classList.remove('on'); });
    tip.classList.remove('on');
  }
  function anchor(c, p) {   // keyboard: tooltip beside the crosshair, level with the plot's middle
    var r = c.svg.getBoundingClientRect(), fr = fig.getBoundingClientRect(), k = r.width / c.G.w;
    return { x: r.left - fr.left + c.G.x(p) * k, y: r.top - fr.top + (MT + PH / 2) * k, touch: false };
  }
  function bind(c) {
    var svg = c.svg;
    function onPtr(e) {
      if (!c.G) return;
      var r = svg.getBoundingClientRect(), fr = fig.getBoundingClientRect();
      var px = (e.clientX - r.left) * (c.G.w / r.width);
      var p = Math.max(0, Math.min(N - 1, Math.round((px - ML) / c.G.step)));
      setHover(p, c, { x: e.clientX - fr.left, y: e.clientY - fr.top, touch: e.pointerType === 'touch' });
    }
    svg.addEventListener('pointermove', onPtr);
    svg.addEventListener('pointerdown', onPtr);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') clearHover(); });
    svg.addEventListener('pointercancel', clearHover);   // a touch that turned into a scroll
    svg.addEventListener('keydown', function (e) {
      if (!c.G) return;
      var p = hov ? hov.p : 0, k = e.key;
      if (k === 'ArrowRight') p += 1;
      else if (k === 'ArrowLeft') p -= 1;
      else if (k === 'Home') p = 0;
      else if (k === 'End') p = N - 1;
      else if (k === 'Escape') { clearHover(); return; }
      else return;
      e.preventDefault();
      p = Math.max(0, Math.min(N - 1, p));
      setHover(p, c, anchor(c, p));
    });
    svg.addEventListener('focus', function () {
      var kb = true;
      try { kb = svg.matches(':focus-visible'); } catch (err) { /* older engines: treat as keyboard focus */ }
      if (kb && c.G) { var p = hov ? hov.p : 0; setHover(p, c, anchor(c, p)); }
    });
    svg.addEventListener('blur', clearHover);
  }
  document.addEventListener('pointerdown', function (e) {   // a tap elsewhere dismisses a touch readout
    if (hov && !CF.svg.contains(e.target) && !CR.svg.contains(e.target)) clearHover();
  });

  /* ---------- controls ---------- */
  function buildSelect() {
    var seen = {};
    sel.textContent = '';
    (D.runs.groups || []).forEach(function (gr) {
      var og = document.createElement('optgroup');
      og.label = gr.title;
      gr.ids.forEach(function (id) {
        if (!BY[id]) return;
        seen[id] = 1;
        var o = document.createElement('option');
        o.value = id;
        o.textContent = BY[id].name;
        og.appendChild(o);
      });
      if (og.children.length) sel.appendChild(og);
    });
    RUNS.forEach(function (m) {   // never drop a run that no group lists
      if (seen[m.id]) return;
      var o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.name;
      sel.appendChild(o);
    });
    sel.value = st.id;
  }
  sel.addEventListener('change', function () {
    if (!BY[sel.value] || sel.value === st.id) return;
    st.id = sel.value;
    update(true);
  });
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var pad = b.getAttribute('data-pad');
      if (pad === st.pad) return;
      st.pad = pad;
      btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      update(true);
    });
  });

  /* ---------- init + width tracking ---------- */
  var CF = chart('full', pFull), CR = chart('run', pRun);
  buildSelect();
  function fit() {
    [CF, CR].forEach(function (c) {
      var w = Math.round(c.host.clientWidth);
      if (w > 0 && w !== c.w) {
        c.w = w;
        if (c.kind === 'full') drawFull(c); else drawRun(c);
        if (hov) clearHover();
      }
    });
  }
  fit();
  update(false);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(fig.querySelector('.fx-panels'));
  else window.addEventListener('resize', fit);
})();
