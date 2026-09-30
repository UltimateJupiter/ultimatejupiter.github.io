/* Figure 3 · knockout maps. Left: full attention (fixed). Right: any compressed run or DeepSeek-V4-Flash-Base.
   Rows = knocked-out KV head (layer*kv + head), columns = source-key position, fill = relative accuracy change. */
(function () {
  'use strict';
  const fig = document.getElementById('fx-ko');
  if (!fig || !window.FIGDATA || !window.FIGDATA.ko || !window.FIGDATA.runs) return;

  const D = window.FIGDATA;
  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';
  const LIM = D.ko.limit || 100;
  const GL = 38;        // left gutter for the layer labels (px); the profile uses the same gutter
  const T = 1;          // top inset so the outlines are never clipped
  const WGAP = 0;       // columns stay contiguous; windows are separated by dashed period boundaries
  const PROF = { top: 14, half: 46, bot: 18 };   // profile geometry: ±100% spans 2 × half
  const DS = 'deepseek';

  const byId = {};
  D.runs.models.forEach(function (m) { byId[m.id] = m; });

  const $ = function (s) { return fig.querySelector(s); };
  const sel = $('#fx-ko-model');
  const segs = { cols: $('.fx-seg[data-k="cols"]'), pad: $('.fx-seg[data-k="pad"]') };
  const rTitle = $('#fx-ko-rtitle'), rSub = $('#fx-ko-rsub'), pHead = $('#fx-ko-phead'), status = $('#fx-ko-status');
  const panels = $('.fx-panels');
  const tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);

  const st = { id: byId[D.runs.default] ? D.runs.default : D.runs.models[0].id, cols: 'S', pad: 'pp', pin: 0 };
  let hov = null;       // {M, r, c} while the pointer is on a map or on the profile

  /* ---------- helpers ---------- */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function num(v) { const r = Math.round(Math.abs(v)); return r === 0 ? '0' : (v < 0 ? MINUS : '+') + r; }   // half away from zero
  function pct(v) { return num(v) + '%'; }
  function fillOf(v) {
    const p = Math.round(Math.min(Math.abs(v), LIM) / LIM * 100);
    return p ? 'color-mix(in oklab, var(' + (v < 0 ? '--loss' : '--accent') + ') ' + p + '%, var(--bg))' : null;
  }
  function snap(v) { const d = window.devicePixelRatio || 1; return Math.round(v * d) / d; }
  function fold(rows, S) {
    return rows.map(function (r) {
      const n = r.length / S, o = [];
      for (let c = 0; c < S; c++) { let s = 0; for (let k = 0; k < n; k++) s += r[c + k * S]; o.push(s / n); }
      return o;
    });
  }
  // Default pinned row: the most phase-concentrated loss. loss = max(0, −v); score = max loss − mean loss.
  function concentrated(rows) {
    let best = 0, bs = -Infinity;
    rows.forEach(function (r, i) {
      let mx = 0, sum = 0;
      r.forEach(function (v) { const l = Math.max(0, -v); if (l > mx) mx = l; sum += l; });
      const s = mx - sum / r.length;
      if (s > bs + 1e-9) { bs = s; best = i; }
    });
    return best;
  }
  const pinCache = {};
  function defaultPin(id) {
    if (!(id in pinCache)) pinCache[id] = concentrated(id === DS ? D.ko.deepseek.rel : fold(byId[id].pp.ko, byId[id].S));
    return pinCache[id];
  }

  /* ---------- views ---------- */
  const LV = { side: 'L', ds: false, name: D.ko.full.name, rows: D.ko.full.rel, layers: D.ko.full.layers,
    kv: D.ko.full.kv || 1, ncol: D.ko.full.cols, mod: 8, gapEvery: 0 };
  let RV = null;
  function rightView() {
    if (st.id === DS) {
      const d = D.ko.deepseek;
      return { side: 'R', ds: true, name: d.name, rows: d.rel, layers: d.layers, kv: d.kv || 1, ncol: d.cols, mod: 8, S: d.S, gapEvery: 0 };
    }
    const m = byId[st.id], src = m[st.pad].ko, f = st.cols === 'S';
    return { side: 'R', ds: false, m: m, name: m.name, rows: f ? fold(src, m.S) : src, layers: m.layers, kv: m.kv,
      ncol: f ? m.S : src[0].length, mod: f ? m.S : src[0].length, S: m.S, gapEvery: f ? 0 : m.S };
  }
  function rowShort(v, r) { const l = Math.floor(r / v.kv); return v.kv > 1 ? 'L' + l + ' h' + (r % v.kv) : 'L' + l; }
  function rowLong(v, r) { const l = Math.floor(r / v.kv); return v.kv > 1 ? 'layer ' + l + ', head ' + (r % v.kv) : 'layer ' + l; }
  function modText(v) { return v.ds ? 'mod 8, S = ' + v.S : (st.cols === 'S' ? 'mod S = ' + v.S : 'mod 24, S = ' + v.S); }
  function padText(v) { return v.side === 'L' ? 'prefix padding' : v.ds ? 'whole-layer knockout' : (st.pad === 'pp' ? 'prefix' : 'in-sequence') + ' padding'; }

  // Short summary of one row: the concentrated losses (and gains) with their positions.
  function describe(vals) {
    const n = vals.length;
    function part(sign) {
      let mx = 0;
      vals.forEach(function (x) { if (sign * x > mx) mx = sign * x; });
      if (mx < 10) return null;
      const thr = Math.max(10, mx / 2), idx = [];
      vals.forEach(function (x, i) { if (sign * x >= thr) idx.push(i); });
      if (idx.length <= 3) return idx.map(function (i) { return pct(vals[i]) + ' at ' + i; }).join(', ');
      const vs = idx.map(function (i) { return vals[i]; });
      const a = pct(Math.min.apply(null, vs)), b = pct(Math.max.apply(null, vs));
      const range = a === b ? a : a + ' to ' + b;
      if (idx.length === n) return range + ' at every position';
      if (idx.length > 8) return range + ' at ' + idx.length + ' of ' + n + ' positions';
      return range + ' at ' + idx.join(', ');
    }
    const parts = [part(-1), part(1)].filter(Boolean);
    if (parts.length) return parts.join('; ');
    let m = 0;
    vals.forEach(function (x) { m = Math.max(m, Math.abs(x)); });
    return 'within ±' + Math.max(1, Math.round(m)) + '% everywhere';
  }

  /* ---------- geometry ---------- */
  function geom(W, v) {
    const P = Math.max(4, Math.round(364 / v.layers)), rh = (P - 1) / v.kv;   // 1px gutter between layers
    const nw = v.gapEvery ? v.ncol / v.gapEvery : 1;
    const cw = (W - GL - (nw - 1) * WGAP) / v.ncol;
    const x0 = [], x1 = [], y0 = [], y1 = [];
    for (let c = 0; c < v.ncol; c++) {
      const w = v.gapEvery ? Math.floor(c / v.gapEvery) : 0;
      x0.push(snap(GL + c * cw + w * WGAP));
      x1.push(snap(GL + (c + 1) * cw + w * WGAP));
    }
    const n = v.layers * v.kv;
    for (let r = 0; r < n; r++) {
      const l = Math.floor(r / v.kv), k = r % v.kv;
      y0.push(snap(T + l * P + k * rh));
      y1.push(snap(T + l * P + (k + 1) * rh));
    }
    return { W: W, P: P, rh: rh, cw: cw, x0: x0, x1: x1, y0: y0, y1: y1, n: n, ncol: v.ncol, kv: v.kv, layers: v.layers,
      bottom: T + v.layers * P - 1 };
  }
  function colAt(g, x) {
    if (x < GL - 1 || x > g.W + 1) return -1;
    let best = 0, bd = Infinity;
    for (let c = 0; c < g.ncol; c++) {
      if (x >= g.x0[c] && x < g.x1[c]) return c;
      const d = Math.min(Math.abs(x - g.x0[c]), Math.abs(x - g.x1[c]));
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function rowAt(g, y) {
    if (y < T - 1 || y > g.bottom + 1) return -1;
    const l = Math.min(g.layers - 1, Math.max(0, Math.floor((y - T) / g.P)));
    const k = Math.min(g.kv - 1, Math.max(0, Math.floor((y - T - l * g.P) / g.rh)));
    return l * g.kv + k;
  }
  function local(svg, e) {
    const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: (e.clientX - b.left) * (vb.width / (b.width || 1)), y: (e.clientY - b.top) * (vb.height / (b.height || 1)) };
  }

  /* ---------- maps ---------- */
  const L = { side: 'L', wrap: $('#fx-ko-left .fx-ko-map') };
  const R = { side: 'R', wrap: $('#fx-ko-right .fx-ko-map') };

  function drawMap(M, v) {
    const W = Math.max(120, Math.round(M.wrap.clientWidth));
    const g = geom(W, v), H = g.bottom + 19;
    if (!M.svg) {
      M.svg = el('svg', { class: 'fx-svg', role: 'img' });
      M.wrap.appendChild(M.svg);
      bindMap(M);
    }
    const svg = M.svg;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    const cells = el('g', { 'shape-rendering': 'crispEdges' });
    const frag = document.createDocumentFragment();
    for (let r = 0; r < g.n; r++) {
      const row = v.rows[r];
      for (let c = 0; c < g.ncol; c++) {
        const f = fillOf(row[c]);
        if (!f) continue;
        const e = el('rect', { x: g.x0[c], y: g.y0[r], width: +(g.x1[c] - g.x0[c]).toFixed(3), height: +(g.y1[r] - g.y0[r]).toFixed(3) });
        e.style.fill = f;
        frag.appendChild(e);
      }
    }
    cells.appendChild(frag);
    svg.appendChild(cells);
    if (v.kv > 1) {   // hairline separators between layers, drawn inside the 1px layer gutters
      let d = '';
      for (let l = 1; l < v.layers; l++) d += 'M' + GL + ' ' + (T + l * g.P - 0.5) + 'H' + W;
      el('path', { class: 'sep', d: d }, svg);
    }
    if (v.gapEvery) {   // dashed period boundaries between compression windows (mod-24 view)
      let d = '';
      for (let c = v.gapEvery; c < g.ncol; c += v.gapEvery) d += 'M' + (Math.round(g.x0[c]) + 0.5) + ' ' + (T - 3) + 'V' + (g.bottom + 3);
      el('path', { class: 'per', d: d }, svg);
    }

    const ticks = [];
    const yt = el('g', null, svg);
    for (let l = 0; l < v.layers; l += 4) {
      const yc = T + l * g.P + (g.P - 1) / 2;
      const t = el('text', { x: GL - 7, y: yc.toFixed(2), dy: '0.35em', 'text-anchor': 'end' }, yt);
      t.textContent = 'L' + l;
      ticks.push({ t: t, y: yc });
    }
    const xt = el('g', null, svg);
    for (let c = 0; c < g.ncol; c++) {
      if (v.gapEvery && c % v.gapEvery) continue;
      const t = el('text', { x: ((g.x0[c] + g.x1[c]) / 2).toFixed(2), y: g.bottom + 14, 'text-anchor': 'middle' }, xt);
      t.textContent = c;
    }
    const ov = el('g', { class: 'ov' }, svg);
    M.o = {
      pin: el('rect', { class: 'pin', visibility: 'hidden' }, ov),
      hr: el('rect', { class: 'hv', visibility: 'hidden' }, ov),
      hc: el('rect', { class: 'hv', visibility: 'hidden' }, ov),
      pl: el('text', { class: 'pl', x: GL - 7, dy: '0.35em', 'text-anchor': 'end', visibility: 'hidden' }, svg)
    };
    M.g = g; M.v = v; M.ticks = ticks;
  }
  function outlineRow(M, rect, r) {
    const g = M.g;
    rect.setAttribute('x', GL - 0.5);
    rect.setAttribute('y', g.y0[r] - 0.5);
    rect.setAttribute('width', g.W - GL + 1);
    rect.setAttribute('height', +(g.y1[r] - g.y0[r] + 1).toFixed(3));
    rect.setAttribute('visibility', 'visible');
  }
  function outlineCol(M, rect, c) {
    const g = M.g;
    rect.setAttribute('x', g.x0[c] - 0.5);
    rect.setAttribute('y', T - 0.5);
    rect.setAttribute('width', +(g.x1[c] - g.x0[c] + 1).toFixed(3));
    rect.setAttribute('height', g.bottom - T + 1);
    rect.setAttribute('visibility', 'visible');
  }
  function hide(e) { if (e) e.setAttribute('visibility', 'hidden'); }

  function markPin() {
    const g = R.g, r = st.pin;
    outlineRow(R, R.o.pin, r);
    const yc = (g.y0[r] + g.y1[r]) / 2;
    R.o.pl.setAttribute('y', yc.toFixed(2));
    R.o.pl.textContent = 'L' + Math.floor(r / g.kv);
    R.o.pl.setAttribute('visibility', 'visible');
    R.ticks.forEach(function (t) { t.t.classList.toggle('hide', Math.abs(t.y - yc) < 14); });
  }

  /* ---------- profile ---------- */
  const P = { wrap: $('#fx-ko-right .fx-ko-prof') };
  function drawProfile() {
    const g = R.g, W = g.W, z = PROF.top + PROF.half, H = PROF.top + 2 * PROF.half + PROF.bot;
    if (!P.svg) {
      P.svg = el('svg', { class: 'fx-svg', role: 'img' });
      P.wrap.appendChild(P.svg);
      bindProfile();
    }
    const svg = P.svg;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    P.band = el('rect', { class: 'band', y: PROF.top - 5, height: 2 * PROF.half + 10, visibility: 'hidden' }, svg);
    [-100, -50, 50, 100].forEach(function (t) {
      const y = Math.round(z - t / 100 * PROF.half) + 0.5;
      el('line', { class: 'gr', x1: GL, x2: W, y1: y, y2: y }, svg);
    });
    el('line', { class: 'ax', x1: GL, x2: W, y1: z + 0.5, y2: z + 0.5 }, svg);
    [[100, '+100%'], [0, '0'], [-100, MINUS + '100%']].forEach(function (t) {
      const lab = el('text', { x: GL - 7, y: (z - t[0] / 100 * PROF.half + 0.5).toFixed(1), dy: '0.35em', 'text-anchor': 'end' }, svg);
      lab.textContent = t[1];
    });
    P.bars = []; P.labs = [];
    const bars = el('g', null, svg), labs = el('g', null, svg);
    const showLabels = g.cw >= 21;
    for (let c = 0; c < g.ncol; c++) {
      const bw = g.x1[c] - g.x0[c];
      const inner = Math.min(22, bw - 2 * Math.max(1, Math.round(bw * 0.16)));
      const x = snap((g.x0[c] + g.x1[c]) / 2 - inner / 2);
      P.bars.push(el('rect', { class: 'bar', x: x, width: +(snap(x + inner) - x).toFixed(3), y: z, height: 0 }, bars));
      P.labs.push(showLabels ? el('text', { class: 'vl', x: ((g.x0[c] + g.x1[c]) / 2).toFixed(2), 'text-anchor': 'middle', visibility: 'hidden' }, labs) : null);
    }
    P.z = z;
  }
  function setProfile(r, col) {
    const v = RV, vals = v.rows[r], z = P.z;
    for (let c = 0; c < vals.length; c++) {
      const x = vals[c], len = snap(Math.min(Math.abs(x), LIM) / LIM * PROF.half);
      const b = P.bars[c];
      b.setAttribute('class', 'bar ' + (x < 0 ? 'lo' : 'hi'));
      b.setAttribute('y', x < 0 ? z : z - len);
      b.setAttribute('height', len);
      const t = P.labs[c];
      if (t) {
        if (Math.abs(x) >= 10) {
          t.textContent = num(x);
          t.setAttribute('y', (x < 0 ? z + len + 11 : z - len - 4).toFixed(1));
          t.setAttribute('visibility', 'visible');
          t.classList.toggle('on', c === col);
        } else hide(t);
      }
    }
    if (col != null && col >= 0) {
      P.band.setAttribute('x', R.g.x0[col]);
      P.band.setAttribute('width', +(R.g.x1[col] - R.g.x0[col]).toFixed(3));
      P.band.setAttribute('visibility', 'visible');
    } else hide(P.band);
    pHead.textContent = 'by position, ';
    pHead.appendChild(h('b', null, v.ds ? 'layer ' + Math.floor(r / v.kv) : rowLong(v, r)));
    pHead.appendChild(document.createTextNode(r === st.pin ? ' (pinned)' : ' (hover)'));
    P.svg.setAttribute('aria-label', 'Relative accuracy change of ' + rowLong(v, r) + ' by position ' +
      (v.ds ? 'mod 8' : 'mod ' + v.mod) + ': ' + vals.map(function (x, i) { return i + ': ' + pct(x); }).join(', ') + '.');
  }

  /* ---------- tooltip ---------- */
  function setTip(v, r, c) {
    const x = v.rows[r][c];
    tip.textContent = '';
    const l1 = h('div');
    const sw = h('span', 'sw');
    sw.style.background = fillOf(x) || 'var(--bg)';
    l1.append(sw, h('b', 'v', pct(x)), h('span', 'k', ' vs clean'));
    const l2 = h('div');
    const l = Math.floor(r / v.kv);
    l2.append(h('span', 'k', 'layer '), String(l), h('span', 'k', v.ds ? ' · whole layer' : ' · head '), v.ds ? '' : String(r % v.kv));
    const l3 = h('div');
    l3.append(h('span', 'k', 'position '), String(c), h('span', 'k', ' (mod ' + v.mod + ')'));
    tip.append(l1, l2, l3);
  }
  function placeTip(e) {
    const fr = fig.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = e.clientX - fr.left + 14, y = e.clientY - fr.top + 16;
    if (x + tw > fr.width) x = e.clientX - fr.left - 14 - tw;
    x = Math.max(0, Math.min(x, fr.width - tw));
    if (y + th > fr.height) y = e.clientY - fr.top - 16 - th;
    y = Math.max(0, y);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
    tip.classList.add('on');
  }

  /* ---------- hover / pin ---------- */
  function clearHover() {
    [L, R].forEach(function (M) { if (M.o) { hide(M.o.hr); hide(M.o.hc); } });
  }
  function dropHover() {   // forget the hover without redrawing (used right before a re-render)
    hov = null;
    clearHover();
    tip.classList.remove('on');
  }
  function unhover() {
    if (!hov) return;
    dropHover();
    setProfile(st.pin, null);
  }
  function hoverAt(M, r, c, e) {
    if (!hov || hov.M !== M || hov.r !== r || hov.c !== c) {
      hov = { M: M, r: r, c: c };
      clearHover();
      if (M === P) {
        outlineCol(R, R.o.hc, c);
        setProfile(st.pin, c);
        setTip(RV, st.pin, c);
      } else {
        outlineRow(M, M.o.hr, r);
        outlineCol(M, M.o.hc, c);
        if (M === R) setProfile(r, c); else setProfile(st.pin, null);
        setTip(M.v, r, c);
      }
    }
    placeTip(e);
  }
  function setPin(r) {
    const n = RV.layers * RV.kv;
    st.pin = Math.max(0, Math.min(n - 1, r));
    markPin();
    const showing = hov && hov.M === R ? hov : null;
    setProfile(showing ? showing.r : st.pin, showing ? showing.c : null);
    announce();
  }
  function bindMap(M) {
    const svg = M.svg;
    function move(e) {
      if (!M.g) return;
      const p = local(svg, e), r = rowAt(M.g, p.y), c = colAt(M.g, p.x);
      if (r < 0 || c < 0) { unhover(); return; }
      hoverAt(M, r, c, e);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') move(e); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') unhover(); });
    if (M.side !== 'R') return;
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown PageUp PageDown Home End');
    svg.addEventListener('click', function (e) {   // a cell or its layer label pins the row
      const p = local(svg, e), r = rowAt(M.g, p.y);
      if (r >= 0 && p.x >= 0 && p.x <= M.g.W + 1) setPin(r);
    });
    svg.addEventListener('keydown', function (e) {
      const n = RV.layers * RV.kv;
      let r = st.pin;
      switch (e.key) {
        case 'ArrowUp': r -= 1; break;
        case 'ArrowDown': r += 1; break;
        case 'PageUp': r -= 4 * RV.kv; break;
        case 'PageDown': r += 4 * RV.kv; break;
        case 'Home': r = 0; break;
        case 'End': r = n - 1; break;
        default: return;
      }
      e.preventDefault();
      unhover();
      setPin(r);
    });
  }
  function bindProfile() {
    const svg = P.svg;
    function move(e) {
      if (!R.g) return;
      const p = local(svg, e), c = colAt(R.g, p.x);
      if (c < 0) { unhover(); return; }
      hoverAt(P, st.pin, c, e);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') move(e); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') unhover(); });
  }
  // Touch: a tap elsewhere dismisses the tooltip.
  document.addEventListener('pointerdown', function (e) {
    if (!hov || e.pointerType === 'mouse') return;
    const t = e.target;
    if ((L.svg && L.svg.contains(t)) || (R.svg && R.svg.contains(t)) || (P.svg && P.svg.contains(t))) return;
    unhover();
  }, true);

  /* ---------- text: status and labels ---------- */
  function announce() {
    const v = RV;
    status.textContent = '';
    status.append(h('b', null, v.name),
      ' · ' + v.layers * v.kv + (v.ds ? ' layers' : ' heads') + ' × ' + v.ncol + ' positions (' + modText(v) + ') · ' + padText(v) + ' · pinned ',
      h('b', null, rowShort(v, st.pin)), ': ' + describe(v.rows[st.pin]));
    R.svg.setAttribute('aria-label', 'Knockout map for ' + v.name + ': ' + v.layers * v.kv + (v.ds ? ' layers' : ' KV heads') +
      ' by ' + v.ncol + ' target-key positions (' + modText(v) + '), ' + padText(v) + '. Pinned row: ' + rowLong(v, st.pin) + ', ' +
      describe(v.rows[st.pin]) + '. Click a row, or use the up and down arrow keys, to move the pinned row.');
  }
  function leftLabel() {
    const v = LV, big = [];
    let spread = 0;
    v.rows.forEach(function (r, i) {
      const m = r.reduce(function (a, b) { return a + b; }, 0) / r.length;
      if (m <= -20) { big.push('layer ' + i + ' (' + pct(m) + ' on average)'); spread = Math.max(spread, Math.max.apply(null, r) - Math.min.apply(null, r)); }
    });
    L.svg.setAttribute('aria-label', 'Knockout map for full attention with one KV head: ' + v.layers + ' layers by ' + v.ncol +
      ' target-key positions (mod 8), prefix padding. Largest losses: ' + big.join(', ') + '; each varies by at most ' +
      Math.ceil(spread) + ' points across positions.');
  }

  /* ---------- controls ---------- */
  (function buildSelect() {
    const og = document.createElement('optgroup');
    og.label = 'DeepSeek';
    const o = document.createElement('option');
    o.value = DS;
    o.textContent = D.ko.deepseek.name;
    og.appendChild(o);
    sel.appendChild(og);
    D.runs.groups.forEach(function (gr) {
      const g = document.createElement('optgroup');
      g.label = gr.title;
      gr.ids.forEach(function (id) {
        if (!byId[id]) return;
        const op = document.createElement('option');
        op.value = id;
        op.textContent = byId[id].name;
        g.appendChild(op);
      });
      sel.appendChild(g);
    });
    sel.value = st.id;
  })();
  function syncSegs() {
    const off = st.id === DS;
    Object.keys(segs).forEach(function (k) {
      segs[k].querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.v === st[k]));
        b.disabled = off;
      });
      segs[k].title = off ? 'Fixed for DeepSeek-V4-Flash-Base: position mod 8, whole-layer knockout' : '';
    });
  }
  sel.addEventListener('change', function () {
    st.id = sel.value;
    st.pin = defaultPin(st.id);
    renderRight();
  });
  Object.keys(segs).forEach(function (k) {
    segs[k].addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b || b.disabled || st[k] === b.dataset.v) return;
      st[k] = b.dataset.v;
      renderRight();
    });
  });

  /* ---------- render ---------- */
  function renderRight() {
    dropHover();
    RV = rightView();
    rTitle.textContent = RV.name;
    rSub.textContent = RV.ds ? 'whole layers · position mod 8 (S = ' + RV.S + ')'
      : 'position mod ' + RV.mod + ' · ' + (st.pad === 'pp' ? 'prefix' : 'in-sequence') + ' padding';
    syncSegs();
    drawMap(R, RV);
    drawProfile();
    markPin();
    setProfile(st.pin, null);
    announce();
  }
  function renderLeft() {
    drawMap(L, LV);
    leftLabel();
  }
  function renderAll() {
    dropHover();
    renderLeft();
    renderRight();
  }

  st.pin = defaultPin(st.id);
  renderAll();

  let lastW = panels.clientWidth, raf = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      const w = panels.clientWidth;
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(renderAll);
    }).observe(panels);
  }
  (function watchDpr() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    const on = function () { if (mq.removeEventListener) mq.removeEventListener('change', on); renderAll(); watchDpr(); };
    if (mq.addEventListener) mq.addEventListener('change', on);
  })();
})();
