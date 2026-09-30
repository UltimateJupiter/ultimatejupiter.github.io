/* Figure 3 · how far gradients move from the (32, 32) anchor under fewer Jacobi iterations.
   Rows d_forward, columns d_backward; only d_backward <= d_forward exists. Values from the paper's Figure 7 (App. B.3). */
(function () {
  'use strict';
  const fig = document.getElementById('fx-grad');
  if (!fig) return;

  /* ---------- data (paper, Figure 7; each row runs from d_backward = min(d_forward, 32) down to 0) ---------- */
  const ROWS = [32, 16, 8, 4, 2, 1];
  const COLS = [32, 16, 8, 4, 2, 1, 0];
  const RAW = {
    all: {
      cos: [[1.00, 1.00, 1.00, 1.00, 0.98, 0.95, 0.88], [1.00, 1.00, 1.00, 0.99, 0.95, 0.88], [0.99, 0.99, 0.98, 0.96, 0.88],
        [0.48, 0.55, 0.61, 0.68], [0.13, 0.15, 0.17], [0.06, 0.06]],
      l2: [[0.00, 0.01, 0.01, 0.06, 0.16, 0.26, 0.45], [0.03, 0.03, 0.06, 0.17, 0.27, 0.45], [0.16, 0.15, 0.19, 0.28, 0.45],
        [1.77, 1.46, 1.16, 0.83], [5.43, 3.99, 3.10], [8.95, 6.18]]
    },
    fusion: {
      cos: [[1.00, 1.00, 1.00, 1.00, 0.70, 0.68, 0.62], [1.00, 1.00, 1.00, 0.99, 0.68, 0.62], [0.99, 0.99, 0.98, 0.96, 0.62],
        [0.26, 0.56, 0.61, 0.67], [-0.21, -0.21, -0.21], [-0.27, -0.27]],
      l2: [[0.00, 0.04, 0.03, 0.11, 0.32, 0.43, 0.81], [0.08, 0.06, 0.10, 0.28, 0.43, 0.81], [0.20, 0.22, 0.17, 0.29, 0.72],
        [2.15, 2.44, 3.28, 2.22], [30.06, 30.04, 15.91], [74.10, 74.10]]
    },
    layer15: {
      cos: [[1.00, 1.00, 1.00, 1.00, 0.99, 0.96, 0.87], [1.00, 1.00, 1.00, 0.99, 0.96, 0.87], [0.97, 0.97, 0.97, 0.95, 0.86],
        [0.40, 0.44, 0.51, 0.60], [0.15, 0.17, 0.17], [0.09, 0.09]],
      l2: [[0.00, 0.01, 0.01, 0.06, 0.16, 0.28, 0.50], [0.03, 0.03, 0.06, 0.17, 0.28, 0.50], [0.26, 0.22, 0.23, 0.31, 0.51],
        [3.01, 2.67, 1.93, 1.13], [4.54, 3.48, 3.01], [6.84, 4.41]]
    }
  };
  const GROUPS = { all: 'All parameters', fusion: 'Fusion module', layer15: 'Layer 15' };
  const METRICS = { cos: 'cosine', l2: 'relative ℓ2 distance' };
  const FIRST = ROWS.map(function (df) { return COLS.indexOf(Math.min(df, 32)); });   // first existing column per row
  function val(g, m, r, c) { return c < FIRST[r] ? null : RAW[g][m][r][c - FIRST[r]]; }
  function has(r, c) { return r >= 0 && r < ROWS.length && c >= FIRST[r] && c < COLS.length; }
  const TR = { r: ROWS.indexOf(16), c: COLS.indexOf(4) };   // training setting
  const AN = { r: 0, c: 0 };                                 // anchor (32, 32)
  const R4 = ROWS.indexOf(4);

  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';
  const GL = 46;         // left gutter: rotated axis title + row ticks
  const TOP = 36;        // x-axis title + column ticks above the grid

  const $ = function (s) { return fig.querySelector(s); };
  const body = $('.grad-body'), wrap = $('.grad-plot'), status = $('.fx-status');
  const scale = $('.fx-scale'), s0 = $('.grad-s0'), s1 = $('.grad-s1'), snote = $('.grad-snote');
  const segs = { group: $('.fx-seg[data-k="group"]'), metric: $('.fx-seg[data-k="metric"]') };
  const tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);

  const st = { group: 'all', metric: 'cos' };
  let G = null, svg = null, O = null, TK = null;
  let hov = null;        // {r, c} under the pointer
  let cur = null;        // {r, c} keyboard cursor while the chart has focus

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
  function sub(base, s) {   // HTML "d<sub>forward</sub>"
    const f = document.createDocumentFragment();
    f.append(base);
    f.appendChild(h('sub', null, s));
    return f;
  }
  function fmt(v) { const s = Math.abs(v).toFixed(2); return v < 0 ? MINUS + s : s; }
  function frac(v, m) {
    if (m === 'cos') return Math.min(1, Math.max(0, 1 - v));
    return Math.min(1, Math.max(0, Math.log10(1 + v) / Math.log10(11)));
  }
  function fillOf(v, m) {
    const p = Math.round(frac(v, m) * 100);
    return p ? 'color-mix(in oklab, var(--loss) ' + p + '%, var(--bg))' : null;
  }
  function snap(v) { const d = window.devicePixelRatio || 1; return Math.round(v * d) / d; }
  function local(e) {
    const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: (e.clientX - b.left) * (vb.width / (b.width || 1)), y: (e.clientY - b.top) * (vb.height / (b.height || 1)) };
  }
  function label(r, c) { return 'd_forward = ' + ROWS[r] + ', d_backward = ' + COLS[c]; }
  function tag(r, c) {
    if (r === TR.r && c === TR.c) return 'training setting';
    if (r === AN.r && c === AN.c) return 'anchor';
    return '';
  }

  /* ---------- geometry ---------- */
  function geom(avail) {
    const cw = Math.max(22, Math.min(56, Math.floor((avail - GL - 2) / COLS.length)));
    const ch = cw >= 48 ? 32 : Math.max(24, Math.round(cw * 0.72));
    const x = [], y = [];
    for (let c = 0; c <= COLS.length; c++) x.push(snap(GL + c * cw));
    for (let r = 0; r <= ROWS.length; r++) y.push(snap(TOP + r * ch));
    return { cw: cw, ch: ch, x: x, y: y, W: GL + COLS.length * cw + 2, H: TOP + ROWS.length * ch + 2, nums: cw >= 30 };
  }
  function cellAt(p) {
    const c = Math.floor((p.x - GL) / G.cw), r = Math.floor((p.y - TOP) / G.ch);
    return has(r, c) ? { r: r, c: c } : null;
  }

  /* ---------- draw ---------- */
  function subText(parent, attrs, base, s) {   // SVG "d" with a lowered subscript
    const t = el('text', attrs, parent);
    t.appendChild(document.createTextNode(base));
    const ts = el('tspan', { dy: '3', 'font-size': '8.5' }, t);
    ts.textContent = s;
    return t;
  }
  function draw() {
    const avail = Math.max(160, Math.floor(body.clientWidth));
    G = geom(avail);
    wrap.style.width = G.W + 'px';
    if (!svg) {
      svg = el('svg', { class: 'fx-svg', role: 'img', tabindex: '0', 'aria-keyshortcuts': 'ArrowUp ArrowDown ArrowLeft ArrowRight Home End Escape' });
      wrap.appendChild(svg);
      bind();
    }
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + G.W + ' ' + G.H);
    svg.setAttribute('width', G.W);
    svg.setAttribute('height', G.H);

    // axis titles and ticks
    const gx = (G.x[0] + G.x[COLS.length]) / 2, gy = (G.y[0] + G.y[ROWS.length]) / 2;
    // axis titles, each bracketed by hairlines spanning the grid so they read as belonging to all columns / rows
    const tx = subText(svg, { class: 'ttl', x: gx.toFixed(1), y: 10, 'text-anchor': 'middle' }, 'd', 'backward');
    const ty = subText(svg, { class: 'ttl', x: 0, y: 0, 'text-anchor': 'middle', transform: 'translate(10 ' + gy.toFixed(1) + ') rotate(-90)' }, 'd', 'forward');
    const lx = tx.getComputedTextLength ? tx.getComputedTextLength() : 60, ly = ty.getComputedTextLength ? ty.getComputedTextLength() : 56;
    const bx0 = G.x[0] + 2, bx1 = G.x[COLS.length] - 2, by0 = G.y[0] + 2, by1 = G.y[ROWS.length] - 2;
    el('path', { class: 'brk', d: 'M' + bx0 + ' 6.5H' + Math.round(gx - lx / 2 - 7) + 'M' + Math.round(gx + lx / 2 + 7) + ' 6.5H' + bx1 +
      'M' + bx0 + ' 4V9M' + bx1 + ' 4V9' }, svg);
    el('path', { class: 'brk', d: 'M6.5 ' + by0 + 'V' + Math.round(gy - ly / 2 - 7) + 'M6.5 ' + Math.round(gy + ly / 2 + 7) + 'V' + by1 +
      'M4 ' + by0 + 'H9M4 ' + by1 + 'H9' }, svg);
    TK = { r: [], c: [] };
    COLS.forEach(function (v, c) {
      const t = el('text', { class: 'tk', x: ((G.x[c] + G.x[c + 1]) / 2).toFixed(1), y: TOP - 8, 'text-anchor': 'middle' }, svg);
      t.textContent = v;
      TK.c.push(t);
    });
    ROWS.forEach(function (v, r) {
      const t = el('text', { class: 'tk', x: GL - 8, y: ((G.y[r] + G.y[r + 1]) / 2).toFixed(1), dy: '0.35em', 'text-anchor': 'end' }, svg);
      t.textContent = v;
      TK.r.push(t);
    });

    // cells
    const cells = el('g', null, svg), nums = el('g', null, svg);
    for (let r = 0; r < ROWS.length; r++) {
      for (let c = FIRST[r]; c < COLS.length; c++) {
        const v = val(st.group, st.metric, r, c);
        const rc = el('rect', { class: 'cell', x: G.x[c] + 0.5, y: G.y[r] + 0.5,
          width: +(G.x[c + 1] - G.x[c]).toFixed(3), height: +(G.y[r + 1] - G.y[r]).toFixed(3) }, cells);
        rc.style.fill = fillOf(v, st.metric) || 'var(--bg)';
        if (G.nums) {
          const t = el('text', { class: 'v' + (frac(v, st.metric) >= 0.75 ? ' hi' : ''),
            x: ((G.x[c] + G.x[c + 1]) / 2 + 0.5).toFixed(1), y: ((G.y[r] + G.y[r + 1]) / 2 + 0.5).toFixed(1),
            dy: '0.35em', 'text-anchor': 'middle' }, nums);
          if (G.cw < 42) t.style.fontSize = '10px';
          t.textContent = fmt(v);
        }
      }
    }

    // anchor (corner mark) and training setting (accent outline)
    const ax = G.x[AN.c] + 1, ay = G.y[AN.r] + 1;
    el('path', { class: 'an', d: 'M' + ax + ' ' + ay + 'h8l-8 8z' }, svg);
    el('rect', { class: 'tr', x: G.x[TR.c] + 0.5, y: G.y[TR.r] + 0.5, width: +(G.x[TR.c + 1] - G.x[TR.c]).toFixed(2),
      height: +(G.y[TR.r + 1] - G.y[TR.r]).toFixed(2) }, svg);

    const ov = el('g', { class: 'ov' }, svg);
    O = {
      row: el('rect', { class: 'ln', visibility: 'hidden' }, ov),
      col: el('rect', { class: 'ln', visibility: 'hidden' }, ov),
      cell: el('rect', { class: 'cur', visibility: 'hidden' }, ov)
    };
    svg.setAttribute('aria-label', ariaText());
    const a = hov || cur;
    if (a) mark(a);
  }

  /* ---------- hover / cursor marks ---------- */
  function box(rect, r0, r1, c0, c1) {   // outline around rows r0..r1, columns c0..c1 (inclusive)
    rect.setAttribute('x', G.x[c0] + 0.5);
    rect.setAttribute('y', G.y[r0] + 0.5);
    rect.setAttribute('width', +(G.x[c1 + 1] - G.x[c0]).toFixed(3));
    rect.setAttribute('height', +(G.y[r1 + 1] - G.y[r0]).toFixed(3));
    rect.setAttribute('visibility', 'visible');
  }
  function hide(e) { e.setAttribute('visibility', 'hidden'); }
  function lastRow(c) { let r = 0; while (r + 1 < ROWS.length && has(r + 1, c)) r++; return r; }
  function mark(a) {
    box(O.row, a.r, a.r, FIRST[a.r], COLS.length - 1);
    box(O.col, 0, lastRow(a.c), a.c, a.c);
    box(O.cell, a.r, a.r, a.c, a.c);
    TK.r.forEach(function (t, i) { t.classList.toggle('on', i === a.r); });
    TK.c.forEach(function (t, i) { t.classList.toggle('on', i === a.c); });
  }
  function unmark() {
    if (!O) return;
    hide(O.row); hide(O.col); hide(O.cell);
    TK.r.concat(TK.c).forEach(function (t) { t.classList.remove('on'); });
  }

  /* ---------- tooltip ---------- */
  function setTip(r, c) {
    const v = val(st.group, st.metric, r, c);
    tip.textContent = '';
    const l1 = h('div'), sw = h('span', 'sw');
    sw.style.background = fillOf(v, st.metric) || 'var(--bg)';
    l1.append(sw, h('b', 'v', fmt(v)), ' ');
    if (st.metric === 'cos') l1.appendChild(h('span', 'k', 'cosine similarity'));
    else { const k = h('span', 'k'); k.append(sub('relative ℓ', '2'), ' distance'); l1.appendChild(k); }
    const l2 = h('div');
    l2.append(sub('d', 'forward'), ' = ' + ROWS[r] + ', ', sub('d', 'backward'), ' = ' + COLS[c]);
    const l3 = h('div');
    l3.appendChild(h('span', 'k', GROUPS[st.group].toLowerCase() + ', vs (32, 32)'));
    const t = tag(r, c);
    if (t) l3.append(h('span', 'k', ' · '), h('span', 'tag', t));
    tip.append(l1, l2, l3);
  }
  function placeTip(cx, cy, dx, dy) {
    const fr = fig.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = cx - fr.left + dx, y = cy - fr.top + dy;
    if (x + tw > fr.width) x = cx - fr.left - dx - tw;
    x = Math.max(0, Math.min(x, fr.width - tw));
    if (y + th > fr.height) y = cy - fr.top - dy - th;
    y = Math.max(0, y);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
    tip.classList.add('on');
  }
  function tipAtCell(a) {   // keyboard: show the tooltip just below the grid, under the cursor's column
    const b = svg.getBoundingClientRect(), k = b.width / G.W;
    setTip(a.r, a.c);
    placeTip(b.left + G.x[a.c] * k, b.bottom, 0, 8);
  }

  function unhover() {
    if (!hov) return;
    hov = null;
    if (cur) { mark(cur); tipAtCell(cur); }
    else { unmark(); tip.classList.remove('on'); }
  }
  function bind() {
    function move(e) {
      if (!G) return;
      const a = cellAt(local(e));
      if (!a) { unhover(); return; }
      if (!hov || hov.r !== a.r || hov.c !== a.c) {
        hov = a;
        mark(a);
        setTip(a.r, a.c);
      }
      placeTip(e.clientX, e.clientY, 14, 16);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') move(e); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') unhover(); });
    svg.addEventListener('focus', function () {
      if (!svg.matches(':focus-visible')) return;
      if (!cur) cur = { r: TR.r, c: TR.c };
      hov = null;
      mark(cur); tipAtCell(cur); announce();
    });
    svg.addEventListener('blur', function () {
      if (!cur) return;
      cur = null;
      if (!hov) { unmark(); tip.classList.remove('on'); }
      announce();
    });
    svg.addEventListener('keydown', function (e) {
      let a = cur ? { r: cur.r, c: cur.c } : { r: TR.r, c: TR.c };
      switch (e.key) {
        case 'ArrowLeft': a.c = Math.max(FIRST[a.r], a.c - 1); break;
        case 'ArrowRight': a.c = Math.min(COLS.length - 1, a.c + 1); break;
        case 'ArrowUp': a.r = Math.max(0, a.r - 1); break;
        case 'ArrowDown': a.r = Math.min(ROWS.length - 1, a.r + 1); a.c = Math.max(a.c, FIRST[a.r]); break;
        case 'Home': a.c = FIRST[a.r]; break;
        case 'End': a.c = COLS.length - 1; break;
        case 'Escape':
          if (!cur) return;
          cur = null; hov = null; unmark(); tip.classList.remove('on'); announce(); e.preventDefault(); return;
        default: return;
      }
      e.preventDefault();
      cur = a; hov = null;
      mark(a); tipAtCell(a); announce();
    });
  }
  document.addEventListener('pointerdown', function (e) {   // touch: a tap elsewhere dismisses the tooltip
    if (!hov || e.pointerType === 'mouse' || (svg && svg.contains(e.target))) return;
    unhover();
  }, true);

  /* ---------- text ---------- */
  function metricHTML(parent) {
    if (st.metric === 'cos') parent.append('cosine');
    else parent.append(sub('relative ℓ', '2'), ' distance');
  }
  function announce() {
    const tr = val(st.group, st.metric, TR.r, TR.c);
    const row = RAW[st.group][st.metric][R4];
    const lo = Math.min.apply(null, row), hi = Math.max.apply(null, row);
    status.textContent = '';
    status.append(h('b', null, GROUPS[st.group]), ': ');
    metricHTML(status);
    const nw = h('span', 'nw');
    nw.append(sub('d', 'forward'), ' = 4.');
    status.append(' ', h('b', null, fmt(tr)), ' at the training setting (16, 4); ', h('b', null, fmt(lo)), ' to ',
      h('b', null, fmt(hi)), ' with ', nw);
    if (cur) {
      const v = val(st.group, st.metric, cur.r, cur.c);
      const a = h('span', 'nw'), b = h('span', 'nw');
      a.append(sub('d', 'forward'), ' = ' + ROWS[cur.r] + ',');
      b.append(sub('d', 'backward'), ' = ' + COLS[cur.c] + ': ', h('b', null, fmt(v)), '.');
      status.append(' Selected: ', a, ' ', b);
    }
  }
  function ariaText() {
    const m = st.metric === 'cos' ? 'cosine similarity' : 'relative l2 distance';
    const rows = ROWS.map(function (df, r) {
      const vs = [];
      for (let c = FIRST[r]; c < COLS.length; c++) vs.push(COLS[c] + ': ' + fmt(val(st.group, st.metric, r, c)));
      return 'd_forward ' + df + ' (by d_backward) ' + vs.join(', ');
    });
    return 'Triangular heatmap of the ' + m + ' between the gradient of ' + GROUPS[st.group].toLowerCase() +
      ' under (d_forward, d_backward) and under the anchor (32, 32). Training setting (16, 4) is outlined. ' + rows.join('; ') +
      '. Use the arrow keys to move between cells.';
  }
  function key() {
    if (st.metric === 'cos') {
      s0.textContent = '1.00'; s1.textContent = '≤ 0';
      snote.textContent = 'cosine similarity to (32, 32)';
      scale.setAttribute('aria-label', 'Color scale: background at cosine 1.00, full red at cosine 0 or below, linear');
    } else {
      s0.textContent = '0'; s1.textContent = '≥ 10';
      snote.textContent = '';
      snote.append(sub('relative ℓ', '2'), ', log scale');
      scale.setAttribute('aria-label', 'Color scale: background at relative l2 distance 0, full red at 10 or more, log scale');
    }
  }

  /* ---------- controls ---------- */
  Object.keys(segs).forEach(function (k) {
    segs[k].addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b || st[k] === b.dataset.v) return;
      st[k] = b.dataset.v;
      segs[k].querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      render();
    });
  });

  function render() {
    draw();
    key();
    announce();
    const a = hov || cur;
    if (a) { setTip(a.r, a.c); if (!hov) tipAtCell(a); }
  }
  render();

  let lastW = body.clientWidth, raf = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      const w = body.clientWidth;
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { hov = null; tip.classList.remove('on'); render(); });
    }).observe(body);
  }
})();
