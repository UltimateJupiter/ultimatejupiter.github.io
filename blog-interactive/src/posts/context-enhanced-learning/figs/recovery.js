/* Figure 5 · recovery of in-context phrasebook rules from the trained model (fx-recovery).
   Dot plot: two panels (greedy decoding, sampling at T = 1), three rows (token filters), two markers per row
   (π1–π4 filled, π5 hollow), dashed line at the random guess of a pair (1/n²).
   Data: Tables 2, 4 and 5 of Zhu, Panigrahi & Arora (ICML 2025), copied verbatim, in percent.
   Each row is [greedy π1–π4, greedy π5, sampling π1–π4, sampling π5]. Table 2 = Table 5, Annealing Dropout, 100,000. */
(function () {
  'use strict';
  const fig = document.getElementById('fx-recovery');
  if (!fig) return;

  const GROUPS = [
    { title: 'MLT(5, 10)', n: 10, rnd: 1, table: 'Table 5', models: [
      { id: 'n10-ann-100k', cur: 'Annealing Dropout', ns: 100000, table: 'Tables 2 and 5',
        base: [0.00, 0.20, 0.00, 0.89], think: [0.00, 0.20, 0.00, 0.90], alpha: [1.66, 0.20, 1.28, 0.94] },
      { id: 'n10-ann-250k', cur: 'Annealing Dropout', ns: 250000,
        base: [0.00, 1.80, 0.00, 1.12], think: [0.00, 1.80, 0.00, 1.13], alpha: [3.05, 1.80, 1.72, 1.23] },
      { id: 'n10-fix-250k', cur: 'Fixed Dropout', ns: 250000,
        base: [0.00, 1.60, 0.00, 1.07], think: [0.05, 1.60, 0.01, 1.07], alpha: [2.46, 2.15, 1.99, 1.39] },
      { id: 'n10-fix-500k', cur: 'Fixed Dropout', ns: 500000,
        base: [0.26, 2.05, 0.05, 1.13], think: [0.33, 2.05, 0.07, 1.13], alpha: [2.11, 2.05, 1.91, 1.34] }
    ] },
    { title: 'MLT(5, 8)', n: 8, rnd: 1.56, table: 'Table 4', models: [
      { id: 'n8-ann-50k', cur: 'Annealing Dropout', ns: 50000,
        base: [0.00, 0.00, 0.00, 0.01], think: [0.06, 1.95, 0.00, 0.54], alpha: [3.18, 1.95, 1.82, 1.49] },
      { id: 'n8-ann-100k', cur: 'Annealing Dropout', ns: 100000,
        base: [0.00, 0.00, 0.00, 0.64], think: [0.00, 0.08, 0.00, 1.25], alpha: [1.37, 0.08, 1.69, 1.80] },
      { id: 'n8-ann-250k', cur: 'Annealing Dropout', ns: 250000,
        base: [0.00, 0.23, 0.00, 1.25], think: [0.00, 0.23, 0.00, 1.28], alpha: [2.95, 0.23, 2.53, 1.38] },
      { id: 'n8-fix-50k', cur: 'Fixed Dropout', ns: 50000,
        base: [0.00, 0.00, 0.00, 0.00], think: [0.08, 0.78, 0.00, 0.09], alpha: [0.82, 0.86, 1.48, 1.43] },
      { id: 'n8-fix-100k', cur: 'Fixed Dropout', ns: 100000,
        base: [0.00, 0.00, 0.00, 0.21], think: [0.43, 0.00, 0.03, 0.80], alpha: [2.36, 0.00, 1.95, 1.32] },
      { id: 'n8-fix-250k', cur: 'Fixed Dropout', ns: 250000,
        base: [0.00, 0.47, 0.02, 0.51], think: [0.68, 1.09, 0.11, 0.73], alpha: [2.23, 1.09, 2.19, 1.10] }
    ] }
  ];
  const DEFAULT = 'n10-ann-100k';
  const ROWS = [
    { k: 'base', name: 'no filter' },
    { k: 'think', name: 'no <THINK>' },
    { k: 'alpha', name: 'only output alphabet' }
  ];
  const METHODS = [ { name: 'Greedy', long: 'Greedy decoding', off: 0 }, { name: 'Sampling', long: 'Sampling, T = 1', off: 2 } ];
  const STEPS = [ { name: 'π₁–π₄', long: 'π₁–π₄ (hidden steps)', cls: 'mid' }, { name: 'π₅', long: 'π₅ (last step)', cls: 'last' } ];
  const TICKS = { 4: [0, 1, 2, 3, 4], 100: [0, 25, 50, 75, 100] };

  const byId = {};
  GROUPS.forEach(function (g) { g.models.forEach(function (m) { m.g = g; byId[m.id] = m; }); });

  /* geometry (px) */
  const PL = 6, PR = 14, TOP = 20, RP = 36, R = 3.5, OFF = 4;
  const yLab = function (r) { return TOP + r * RP + 11; };
  const yTrk = function (r) { return TOP + r * RP + 25; };
  const Y_AX = TOP + 3 * RP + 1;
  const H = Y_AX + 38;

  const NS = 'http://www.w3.org/2000/svg';
  const $ = function (s) { return fig.querySelector(s); };
  const sel = $('#fx-recovery-model');
  const seg = $('.fx-seg');
  const status = $('#fx-recovery-status');
  const panelsEl = $('.fx-panels');
  const tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  const st = { id: DEFAULT, dom: 4 };
  let D = 4;            // domain currently drawn (animates between 4 and 100)
  let anim = 0;
  let hov = null;       // {p, r, j, kb}
  const P = [0, 1].map(function (i) {
    return { i: i, wrap: fig.querySelectorAll('.fxr-plot')[i], svg: null, W: 0, mk: [] };
  });

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
  function pct(v) { return v.toFixed(2) + '%'; }
  function rndText(g) { return g.rnd + '%'; }
  function nsText(ns) { return ns.toLocaleString('en-US'); }
  function modelName(m) { return m.cur + ', ' + nsText(m.ns) + ' samples'; }
  function fullName(m) { return m.g.title + ', ' + modelName(m); }
  function val(m, r, p, j) { return m[ROWS[r].k][METHODS[p].off + j]; }
  function xOf(v, W) { return PL + Math.min(v, D) / D * (W - PL - PR); }
  function markerText(m, p, r, j) {
    return METHODS[p].name + ', ' + ROWS[r].name + ', ' + STEPS[j].name + ': ' + pct(val(m, r, p, j)) +
      ' (random pair ' + rndText(m.g) + ')';
  }

  /* ---------- build (per model and width) ---------- */
  function build(pn) {
    const m = byId[st.id];
    const W = Math.max(200, Math.round(pn.wrap.clientWidth));
    pn.W = W;
    if (!pn.svg) {
      // tabindex −1: the markers are the tab stops; Chrome would otherwise add the svg itself to the tab order
      pn.svg = el('svg', { class: 'fx-svg', role: 'img', tabindex: '-1' });
      pn.wrap.appendChild(pn.svg);
      bind(pn);
    }
    const svg = pn.svg;
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    pn.grid = el('g', null, svg);
    ROWS.forEach(function (row, r) {
      el('line', { class: 'trk', x1: PL, x2: W - PR, y1: yTrk(r) + 0.5, y2: yTrk(r) + 0.5 }, svg);
    });
    el('line', { class: 'ax', x1: PL, x2: W - PR, y1: Y_AX + 0.5, y2: Y_AX + 0.5 }, svg);
    pn.ticks = el('g', null, svg);
    const at = el('text', { class: 'at', x: PL, y: Y_AX + 32 }, svg);
    at.textContent = '% of rules recovered';

    pn.rnd = el('path', { class: 'rnd' }, svg);
    pn.rndl = el('text', { class: 'rndl', y: TOP - 9 }, svg);
    pn.rndl.textContent = 'random pair';
    pn.labs = ROWS.map(function (row, r) {
      const t = el('text', { class: 'rl', x: PL - 2, y: yLab(r) }, svg);
      t.textContent = row.name;
      let w = row.name.length * 6.6;
      try { w = t.getComputedTextLength() || w; } catch (err) { /* not rendered yet: use the estimate */ }
      return { x0: PL - 2, x1: PL - 2 + w, y0: yLab(r) - 10, y1: yLab(r) + 4 };
    });

    const hv = el('g', { class: 'hv' }, svg);
    pn.hair = el('line', { class: 'hair', y1: TOP - 4, y2: Y_AX }, hv);
    pn.hvl = el('text', { class: 'hvl', y: Y_AX + 15, 'text-anchor': 'middle' }, hv);
    pn.hvg = hv;

    pn.mk = [];
    const mg = el('g', null, svg);
    ROWS.forEach(function (row, r) {
      pn.mk.push([0, 1].map(function (j) {
        const c = el('circle', { class: 'mk ' + STEPS[j].cls, r: R, tabindex: '0', role: 'img',
          'aria-label': markerText(m, pn.i, r, j) }, mg);
        c.dataset.r = r; c.dataset.j = j;
        return c;
      }));
    });
    pn.ring = el('circle', { class: 'ring', r: R + 3, visibility: 'hidden' }, svg);
    place(pn);
  }

  /* ---------- positions (per animation frame) ---------- */
  function place(pn) {
    const m = byId[st.id], W = pn.W;
    const xr = Math.round(xOf(m.g.rnd, W)) + 0.5;
    // the dashed line stops short of any row label it would cross
    let d = '', y = TOP - 4;
    pn.labs.forEach(function (b) {
      if (xr < b.x0 - 3 || xr > b.x1 + 3) return;
      d += 'M' + xr + ' ' + y + 'V' + b.y0;
      y = b.y1;
    });
    d += 'M' + xr + ' ' + y + 'V' + Y_AX;
    pn.rnd.setAttribute('d', d);
    const lw = 72;
    if (xr + 4 + lw <= W) { pn.rndl.setAttribute('x', xr + 4); pn.rndl.setAttribute('text-anchor', 'start'); }
    else { pn.rndl.setAttribute('x', xr - 4); pn.rndl.setAttribute('text-anchor', 'end'); }

    // ticks: the set of the target domain, positioned by the current domain; thinned so labels never collide
    pn.ticks.textContent = '';
    pn.grid.textContent = '';
    let last = -Infinity;
    TICKS[st.dom].forEach(function (v) {
      if (v > D * 1.0001) return;
      const x = Math.round(xOf(v, W));
      if (x - last < 18) return;
      last = x;
      if (v > 0) el('line', { class: 'gr', x1: x + 0.5, x2: x + 0.5, y1: TOP - 4, y2: Y_AX }, pn.grid);
      el('line', { class: 'ax', x1: x + 0.5, x2: x + 0.5, y1: Y_AX, y2: Y_AX + 4 }, pn.ticks);
      const t = el('text', { x: x + 0.5, y: Y_AX + 15, 'text-anchor': 'middle' }, pn.ticks);
      t.textContent = v;
      t.dataset.x = x;
    });

    ROWS.forEach(function (row, r) {
      const x0 = xOf(val(m, r, pn.i, 0), W), x1 = xOf(val(m, r, pn.i, 1), W);
      const meet = Math.abs(x0 - x1) < 2 * R + 1;
      const y = yTrk(r) + 0.5;
      pn.mk[r][0].setAttribute('cx', x0.toFixed(2));
      pn.mk[r][0].setAttribute('cy', meet ? y - OFF : y);
      pn.mk[r][1].setAttribute('cx', x1.toFixed(2));
      pn.mk[r][1].setAttribute('cy', meet ? y + OFF : y);
    });
    if (hov && hov.p === pn.i) mark(pn);
  }

  /* ---------- hover / focus ---------- */
  function mark(pn) {
    const c = pn.mk[hov.r][hov.j];
    const x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
    pn.ring.setAttribute('cx', x); pn.ring.setAttribute('cy', y);
    pn.ring.setAttribute('visibility', 'visible');
    pn.ring.setAttribute('class', 'ring' + (hov.kb ? ' kb' : ''));
    const xs = Math.round(x) + 0.5;
    pn.hair.setAttribute('x1', xs); pn.hair.setAttribute('x2', xs);
    const v = val(byId[st.id], hov.r, pn.i, hov.j);
    pn.hvl.textContent = pct(v);
    const half = 20;
    pn.hvl.setAttribute('x', Math.max(half, Math.min(pn.W - half, xs)));
    pn.hvg.classList.add('on');
    // hide axis tick labels under the value label
    pn.ticks.querySelectorAll('text').forEach(function (t) {
      t.style.visibility = Math.abs(+t.dataset.x - xs) < 30 ? 'hidden' : '';
    });
  }
  function clearMarks() {
    P.forEach(function (pn) {
      if (!pn.svg) return;
      pn.ring.setAttribute('visibility', 'hidden');
      pn.hvg.classList.remove('on');
      pn.ticks.querySelectorAll('text').forEach(function (t) { t.style.visibility = ''; });
    });
  }
  function setTip() {
    const m = byId[st.id], v = val(m, hov.r, hov.p, hov.j);
    tip.textContent = '';
    const l1 = h('div');
    l1.append(h('i', 'fxr-sw ' + STEPS[hov.j].cls), h('b', 'v', pct(v)), h('span', 'k', ' (random pair ' + rndText(m.g) + ')'));
    const l2 = h('div');
    l2.append(h('span', 'k', METHODS[hov.p].name.toLowerCase() + ' · '), ROWS[hov.r].name);
    const l3 = h('div');
    l3.append(h('span', 'k', 'rules of '), STEPS[hov.j].long);
    tip.append(l1, l2, l3);
  }
  function placeTip(cx, cy) {
    const fr = fig.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = cx - fr.left + 14, y = cy - fr.top + 16;
    if (x + tw > fr.width) x = cx - fr.left - 14 - tw;
    x = Math.max(0, Math.min(x, fr.width - tw));
    if (y + th > fr.height) y = cy - fr.top - 16 - th;
    y = Math.max(0, y);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
    tip.classList.add('on');
  }
  function show(pn, r, j, kb, cx, cy) {
    const same = hov && hov.p === pn.i && hov.r === r && hov.j === j && hov.kb === kb;
    if (!same) {
      clearMarks();
      hov = { p: pn.i, r: r, j: j, kb: kb };
      mark(pn);
      setTip();
    }
    if (cx == null) {
      const b = pn.mk[r][j].getBoundingClientRect();
      cx = b.left + b.width / 2; cy = b.top + b.height / 2;
    }
    placeTip(cx, cy);
  }
  function hide() {
    if (!hov) return;
    hov = null;
    clearMarks();
    tip.classList.remove('on');
  }
  function local(svg, e) {
    const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: (e.clientX - b.left) * (vb.width / (b.width || 1)), y: (e.clientY - b.top) * (vb.height / (b.height || 1)) };
  }
  function nearest(pn, p) {
    let best = null, bd = 16 * 16;
    pn.mk.forEach(function (row, r) {
      row.forEach(function (c, j) {
        const dx = +c.getAttribute('cx') - p.x, dy = +c.getAttribute('cy') - p.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { r: r, j: j }; }
      });
    });
    return best;
  }
  function bind(pn) {
    const svg = pn.svg;
    function move(e) {
      if (!pn.mk.length) return;
      const n = nearest(pn, local(svg, e));
      if (!n) { if (hov && !hov.kb) hide(); return; }
      show(pn, n.r, n.j, false, e.clientX, e.clientY);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') move(e); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch' && hov && !hov.kb) hide(); });
    svg.addEventListener('focusin', function (e) {
      const c = e.target;
      if (!c.classList || !c.classList.contains('mk')) return;
      let kb = true;
      try { kb = c.matches(':focus-visible'); } catch (err) { /* older engines: treat as keyboard focus */ }
      if (kb) show(pn, +c.dataset.r, +c.dataset.j, true);
    });
    svg.addEventListener('focusout', function (e) {
      if (!svg.contains(e.relatedTarget)) hide();
    });
    // arrow keys move between markers: ←/→ within a row (and across panels), ↑/↓ between rows
    svg.addEventListener('keydown', function (e) {
      const c = e.target;
      if (!c.classList || !c.classList.contains('mk')) return;
      let p = pn.i, r = +c.dataset.r, j = +c.dataset.j;
      switch (e.key) {
        case 'ArrowUp': r = Math.max(0, r - 1); break;
        case 'ArrowDown': r = Math.min(ROWS.length - 1, r + 1); break;
        case 'ArrowLeft': if (j > 0) j -= 1; else if (p > 0) { p -= 1; j = 1; } break;
        case 'ArrowRight': if (j < 1) j += 1; else if (p < 1) { p += 1; j = 0; } break;
        case 'Escape': hide(); return;
        default: return;
      }
      e.preventDefault();
      P[p].mk[r][j].focus();
    });
  }
  // touch: a tap outside the charts dismisses the tooltip
  document.addEventListener('pointerdown', function (e) {
    if (!hov || e.pointerType === 'mouse') return;
    if (P.some(function (pn) { return pn.svg && pn.svg.contains(e.target); })) return;
    hide();
  }, true);

  /* ---------- text ---------- */
  function announce() {
    const m = byId[st.id], g = m.g;
    const b0 = m.base[0], b1 = m.base[2];
    const a = Math.max(m.alpha[0], m.alpha[2]);
    status.textContent = '';
    status.append(h('b', null, fullName(m)), ': without filtering, ',
      h('b', null, b0 === b1 ? pct(b0) : pct(b0) + ' (greedy) and ' + pct(b1) + ' (sampling)'),
      ' of intermediate rules recovered' + (b0 === b1 ? ' (greedy and sampling)' : '') + '; with the strongest filter at most ',
      h('b', null, pct(a)), ' (random pair ' + rndText(g) + ').');
    P.forEach(function (pn) {
      const parts = ROWS.map(function (row, r) {
        return row.name + ' ' + pct(val(m, r, pn.i, 0)) + ' for π₁–π₄ and ' + pct(val(m, r, pn.i, 1)) + ' for π₅';
      });
      let mx = 0;
      ROWS.forEach(function (row, r) { mx = Math.max(mx, val(m, r, pn.i, 0), val(m, r, pn.i, 1)); });
      pn.svg.setAttribute('aria-label', METHODS[pn.i].long + ', ' + fullName(m) + ' (' + (m.table || g.table) +
        '): percent of phrasebook rules recovered; ' + parts.join('; ') + '. Maximum ' + pct(mx) +
        '; random guess of a pair ' + rndText(g) + '. Axis from 0 to ' + st.dom + '%.');
    });
  }

  /* ---------- controls ---------- */
  GROUPS.forEach(function (g) {
    const og = document.createElement('optgroup');
    og.label = g.title;
    g.models.forEach(function (m) {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = modelName(m);
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  sel.value = st.id;
  sel.addEventListener('change', function () {
    if (!byId[sel.value] || sel.value === st.id) return;
    st.id = sel.value;
    hide();
    render();
  });
  seg.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    const v = +b.dataset.v;
    if (v === st.dom) return;
    st.dom = v;
    seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(+x.dataset.v === v)); });
    animateTo(v);
    announce();
  });
  function animateTo(v) {
    cancelAnimationFrame(anim);
    const d0 = D, d1 = v, T = 280;
    if ((reduce && reduce.matches) || d0 === d1) { D = d1; P.forEach(place); if (hov) placeTipAtMarker(); return; }
    const t0 = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - t0) / T), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      D = d0 * Math.pow(d1 / d0, e);   // interpolate in log space so the motion is even
      if (t >= 1) D = d1;
      P.forEach(place);
      if (hov) placeTipAtMarker();
      if (t < 1) anim = requestAnimationFrame(step);
    })(t0);
  }
  function placeTipAtMarker() {
    const c = P[hov.p].mk[hov.r][hov.j], b = c.getBoundingClientRect();
    placeTip(b.left + b.width / 2, b.top + b.height / 2);
  }

  /* ---------- render ---------- */
  function render() {
    const focused = document.activeElement;
    let keep = null;
    P.forEach(function (pn) {
      if (pn.svg && pn.svg.contains(focused) && focused.classList.contains('mk')) keep = { p: pn.i, r: +focused.dataset.r, j: +focused.dataset.j };
    });
    hov = null;
    tip.classList.remove('on');
    P.forEach(build);
    announce();
    if (keep) P[keep.p].mk[keep.r][keep.j].focus();
  }

  render();

  let lastW = panelsEl.clientWidth, raf = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      const w = panelsEl.clientWidth;
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    }).observe(panelsEl);
  }
})();
