/* Figure 5 · where the recurrent block sits. Rows = model configurations: a 30-cell layer strip (which layers recur or
   loop) and a dot plot of the selected score against the parameter-matched Transformer baseline.
   Data verbatim from the paper: zero-shot accuracy from Tables 1, 2 and 11 (135M, 10B FineWeb-Edu tokens);
   finetuned pass@1 from the bar labels of Figure 6. */
(function () {
  'use strict';
  const fig = document.getElementById('fx-placement');
  if (!fig) return;

  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';
  const NL = 30;   // layers in the 135M backbone

  /* ---------- data ---------- */
  const ZK = ['arcc', 'arce', 'hs', 'obqa', 'piqa', 'sciq', 'wg', 'avg'];
  const FK = ['va', 'prosqa', 'hotpot', 'gsms', 'gsmnl'];
  const NAME = {
    arcc: 'ARC-C', arce: 'ARC-E', hs: 'HellaSwag', obqa: 'OBQA', piqa: 'PIQA', sciq: 'SciQ', wg: 'Winogrande', avg: 'Average',
    va: 'Variable Assignment', prosqa: 'ProsQA-Hard', hotpot: 'HotpotQA (Easy)', gsms: 'GSM-Aug (Symbolic)', gsmnl: 'GSM-Aug (Natural Language)'
  };
  const SHORT = {
    arcc: 'ARC-C', arce: 'ARC-E', hs: 'HellaSwag', obqa: 'OBQA', piqa: 'PIQA', sciq: 'SciQ', wg: 'Winogrande', avg: 'Average',
    va: 'Var. Assignment', prosqa: 'ProsQA-Hard', hotpot: 'HotpotQA (Easy)', gsms: 'GSM-Aug (Sym.)', gsmnl: 'GSM-Aug (NL)'
  };
  function zs(a) { const o = {}; ZK.forEach(function (k, i) { o[k] = a[i]; }); return o; }
  function ft(a) { const o = {}; FK.forEach(function (k, i) { o[k] = a[i]; }); return o; }
  // Zero-shot order: ARC-C, ARC-E, HS, OBQA, PIQA, SciQ, WG | Avg. Finetuned order: VA, ProsQA-Hard, HotpotQA, GSM-Sym, GSM-NL.
  const R = {
    base:   { kind: 'base', name: 'Transformer baseline', zs: zs([24.74, 44.28, 29.81, 30.20, 61.53, 60.80, 48.46, 42.83]), ft: ft([0.494, 0.151, 0.214, 0.381, 0.265]) },
    r1_30:  { kind: 't2', s: 1, e: 30, zs: zs([24.49, 43.48, 29.98, 30.00, 60.72, 62.60, 52.25, 43.36]), ft: ft([0.773, 0.166, 0.246, 0.391, 0.268]), full: true },
    r5_26:  { kind: 't2', s: 5, e: 26, zs: zs([23.98, 46.13, 30.75, 29.80, 60.77, 62.80, 51.85, 43.73]), ft: ft([0.921, 0.178, 0.264, 0.436, 0.310]) },
    r9_22:  { kind: 't2', s: 9, e: 22, pos: 'middle', zs: zs([24.15, 45.24, 30.40, 29.20, 61.15, 66.40, 51.54, 44.01]), ft: ft([0.939, 0.167, 0.268, 0.409, 0.314]) },
    r13_18: { kind: 't2', s: 13, e: 18, pos: 'middle', zs: zs([24.23, 45.50, 29.95, 31.20, 61.70, 64.20, 52.17, 44.14]), ft: ft([0.945, 0.168, 0.216, 0.425, 0.281]) },
    r15_16: { kind: 't2', s: 15, e: 16, zs: zs([24.40, 45.83, 30.11, 29.20, 59.63, 60.20, 50.83, 42.89]) },
    r1_6:   { kind: 't2', s: 1, e: 6, pos: 'early', zs: zs([24.66, 45.08, 29.83, 30.00, 60.07, 61.00, 48.54, 42.74]) },
    r25_30: { kind: 't2', s: 25, e: 30, pos: 'late', zs: zs([25.09, 45.24, 29.65, 28.20, 60.12, 61.20, 50.59, 42.87]) },
    r1_14:  { kind: 't2', s: 1, e: 14, pos: 'early', zs: zs([23.38, 44.70, 28.59, 29.00, 59.25, 59.50, 51.07, 42.21]) },
    r17_30: { kind: 't2', s: 17, e: 30, pos: 'late', zs: zs([23.98, 44.02, 29.97, 31.40, 60.28, 61.90, 50.43, 43.14]) },
    pause:  { kind: 'pause', name: 'Pause tokens ×2', zs: zs([24.74, 44.57, 29.51, 31.60, 60.23, 61.90, 50.59, 43.31]) },
    loopF:  { kind: 'loop', name: 'Full-looped ×2', s: 1, e: 30, K: 2, zs: zs([24.83, 44.95, 29.84, 30.80, 60.23, 60.70, 49.57, 42.99]) },
    loopM:  { kind: 'loop', name: 'Middle-looped ×3', s: 9, e: 22, K: 3, zs: zs([23.04, 45.16, 30.12, 30.20, 60.17, 59.80, 50.28, 42.68]) }
  };
  Object.keys(R).forEach(function (k) {
    const r = R[k];
    r.id = k;
    if (r.kind === 't2') { r.D = r.e - r.s + 1; r.name = 'T2MLR (' + r.s + ',' + r.e + ')'; }
  });
  const GROUPS = {
    vary:  { name: 'vary the span', secs: [{ rows: ['r1_30', 'r5_26', 'r9_22', 'r13_18', 'r15_16'] }] },
    move:  { name: 'move a fixed span', pos: true, secs: [
      { t: 'blocks of 6 layers', st: 'D=6', rows: ['r1_6', 'r13_18', 'r25_30'] },
      { t: 'blocks of 14 layers', st: 'D=14', rows: ['r1_14', 'r9_22', 'r17_30'] }] },
    other: { name: 'other ways to add compute', secs: [
      { t: 'T2MLR', st: 'T2MLR', rows: ['r9_22', 'r13_18'] },
      { t: 'pause and looped (extra inference compute)', st: 'pause/looped', rows: ['pause', 'loopF', 'loopM'] }] },
    all:   { name: 'all', pos: true, secs: [
      { t: 'vary the span', st: 'span', rows: ['r1_30', 'r5_26', 'r9_22', 'r13_18', 'r15_16'] },
      { t: 'early and late blocks', st: 'early/late', rows: ['r1_6', 'r25_30', 'r1_14', 'r17_30'] },
      { t: 'pause and looped (extra inference compute)', st: 'pause/looped', rows: ['pause', 'loopF', 'loopM'] }] }
  };

  /* ---------- state + elements ---------- */
  const $ = function (s) { return fig.querySelector(s); };
  const sel = $('#fx-placement-metric');
  const seg = $('.fx-placement-grp .fx-seg');
  const wrap = $('.fx-placement-chart');
  const status = $('#fx-placement-status');
  const tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);
  const st = { m: sel.value || 'avg', g: 'vary' };
  let C = null;          // current layout: {svg, rows:[{r, y0, y1, yc, dx}], ...}
  let act = -1;          // index of the highlighted row, -1 = none
  let actBy = null;      // 'ptr' | 'key'

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
  function isFt(m) { return FK.indexOf(m) >= 0; }
  function val(r, m) { const src = isFt(m) ? r.ft : r.zs; return src && src[m] != null ? src[m] : null; }
  function dec(m) { return isFt(m) ? 3 : 2; }
  function fmt(v, m) { return v.toFixed(dec(m)); }
  function delta(v, b, m) {   // rounded difference of two printed values, as text with sign
    const p = Math.pow(10, dec(m)), d = Math.round((v - b) * p) / p;
    if (d === 0) return (0).toFixed(dec(m));
    return (d < 0 ? MINUS : '+') + Math.abs(d).toFixed(dec(m));
  }
  function cmp(v, b, m) { const p = Math.pow(10, dec(m)), d = Math.round((v - b) * p); return d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'; }
  function desc(r) {
    if (r.kind === 't2') return 'D=' + r.D + (GROUPS[st.g].pos && r.pos ? ' · ' + r.pos : '');
    if (r.kind === 'loop') return 'layers ' + r.s + '–' + r.e;
    return '';
  }
  function shortLab(r) {   // used in the status line
    if (r.kind === 't2' && GROUPS[st.g].pos && r.pos) return r.s + '–' + r.e + ' (' + r.pos + ')';
    return r.kind === 'base' ? 'baseline' : r.name;
  }
  function how(r) {
    if (r.kind === 'base') return 'standard Transformer, hidden size 584';
    if (r.kind === 't2') return 'recurrent block: layers ' + r.s + '–' + r.e + ' (D = ' + r.D + ')';
    if (r.kind === 'loop') return (r.s === 1 && r.e === NL ? 'all 30 layers' : 'layers ' + r.s + '–' + r.e) + ' run ' + (r.K === 2 ? 'twice' : r.K + ' times') + ' per token';
    return 'pause-token baseline; no recurrence';
  }
  function metricHead(m) { return SHORT[m] + (isFt(m) ? ', pass@1' : m === 'avg' ? ' of 7 tasks, %' : ', %'); }
  function metricLong(m) {
    if (m === 'avg') return 'Average zero-shot accuracy';
    return isFt(m) ? NAME[m] + ' pass@1 after finetuning' : NAME[m] + ' zero-shot accuracy';
  }
  function niceStep(span, n) {
    const c = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20];
    for (let i = 0; i < c.length; i++) if (span / c[i] <= n) return c[i];
    return c[c.length - 1];
  }
  function stepDec(s) { return s >= 1 ? 0 : s >= 0.1 ? (s === 0.25 ? 2 : 1) : (s === 0.025 ? 3 : 2); }

  /* ---------- rows for the current selection ---------- */
  function layoutRows() {
    const g = GROUPS[st.g], out = [{ r: R.base, sec: -1 }];
    g.secs.forEach(function (s, i) { s.rows.forEach(function (id) { out.push({ r: R[id], sec: i }); }); });
    return out;
  }

  /* ---------- render ---------- */
  function render(forceNarrow) {
    hideTip();
    const W = Math.max(260, Math.round(wrap.clientWidth));
    const narrow = forceNarrow === true || W < 540;
    const m = st.m, g = GROUPS[st.g], rows = layoutRows(), showHeads = g.secs.length > 1 || !!g.secs[0].t;
    const base = val(R.base, m);

    // Horizontal geometry.
    const pitch = narrow ? 4 : 5, stripW = NL * pitch - 1, sh = narrow ? 8 : 10;
    const LW = narrow ? 0 : Math.min(204, Math.round(W * 0.31));
    const sx = narrow ? 0 : LW + 8;
    const annW = 22;
    const px0 = sx + stripW + annW + (narrow ? 8 : 12);
    const padL = narrow ? 8 : 44, padR = narrow ? 10 : 44;
    const ax0 = px0 + padL, ax1 = W - padR;

    // Domain from the shown, evaluated rows.
    const vs = rows.map(function (o) { return val(o.r, m); }).filter(function (v) { return v != null; });
    const pad = isFt(m) ? 0.02 : 0.5;
    const lo = Math.min.apply(null, vs) - pad, hi = Math.max.apply(null, vs) + pad;
    const X = function (v) { return ax0 + (v - lo) / (hi - lo) * (ax1 - ax0); };

    // Vertical geometry.
    const HH = 22, RH = narrow ? 36 : 24, SH = 22, GAP = 8, AXH = 24;
    let y = HH;
    const L = [];
    let lastSec = -2;
    const heads = [];
    rows.forEach(function (o) {
      if (o.sec !== lastSec) {
        if (o.sec >= 0) {
          y += o.sec === 0 ? GAP : 4;
          if (showHeads && g.secs[o.sec].t) { heads.push({ t: g.secs[o.sec].t, y: y }); y += SH; }
        }
        lastSec = o.sec;
      }
      L.push({ r: o.r, y0: y, y1: y + RH });
      y += RH;
    });
    const rowsBottom = y;
    const H = rowsBottom + AXH;

    const svg = el('svg', { class: 'fx-svg', role: 'img', tabindex: '0', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H,
      'aria-keyshortcuts': 'ArrowUp ArrowDown Home End Escape' });
    const defs = el('defs', null, svg);
    const pat = el('pattern', { id: 'fx-placement-hatch', patternUnits: 'userSpaceOnUse', width: 3.2, height: 3.2, patternTransform: 'rotate(45)' }, defs);
    el('rect', { class: 'hb', width: 3.2, height: 3.2 }, pat);
    el('line', { class: 'hl', x1: 0.6, y1: 0, x2: 0.6, y2: 3.2 }, pat);

    const band = el('rect', { class: 'band', x: 0, width: W, visibility: 'hidden' }, svg);

    // Header: layer ticks over the strip, metric over the dot plot.
    const hy = 13;
    let t = el('text', { x: sx, y: hy }, svg); t.textContent = 'layer 1';
    t = el('text', { x: sx + stripW, y: hy, 'text-anchor': 'end' }, svg); t.textContent = '30';
    t = el('text', { class: 'hd', x: narrow ? W : ax0 - (padL - 8), y: hy, 'text-anchor': narrow ? 'end' : 'start' }, svg);
    t.textContent = metricHead(m);

    // Gridlines + ticks.
    const nt = Math.max(2, Math.floor((ax1 - ax0) / (narrow ? 40 : 42)));
    const step = niceStep(hi - lo, nt), sd = stepDec(step);
    const gy0 = HH + 2, gy1 = rowsBottom;
    const grid = el('g', null, svg);
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) {
      const x = Math.round(X(v)) + 0.5;
      el('line', { class: 'gr', x1: x, x2: x, y1: gy0, y2: gy1 }, grid);
      const tl = el('text', { x: x, y: gy1 + 14, 'text-anchor': 'middle' }, grid);
      tl.textContent = v.toFixed(sd);
    }
    el('line', { class: 'ax', x1: px0, x2: W, y1: gy1 + 0.5, y2: gy1 + 0.5 }, svg);

    // Section headers.
    heads.forEach(function (hd) {
      el('line', { class: 'sepl', x1: 0, x2: W, y1: hd.y + 0.5, y2: hd.y + 0.5 }, svg);
      const s = el('text', { class: 'sec', x: 0, y: hd.y + 15 }, svg);
      s.textContent = hd.t;
    });
    if (!heads.length) {   // a thin rule still separates the baseline from the variants
      const yb = L[0].y1 + GAP / 2;
      el('line', { class: 'sepl', x1: 0, x2: W, y1: Math.round(yb) + 0.5, y2: Math.round(yb) + 0.5 }, svg);
    }

    // Baseline line.
    const bx = Math.round(X(base)) + 0.5;
    el('line', { class: 'bl', x1: bx, x2: bx, y1: gy0, y2: gy1 }, svg);

    // Rows.
    const cellsG = el('g', null, svg), marks = el('g', null, svg);
    const labs = [];
    L.forEach(function (o) {
      const r = o.r;
      const yc = narrow ? o.y0 + 25 : (o.y0 + o.y1) / 2;
      o.yc = yc;
      // label
      const ly = narrow ? o.y0 + 12 : yc;
      const lab = el('text', { class: narrow ? 'nm halo' : 'nm', x: 0, y: ly, dy: narrow ? 0 : '0.35em' }, svg);
      lab.textContent = r.name;
      labs.push(lab);
      const d = desc(r);
      if (d) { const ts = el('tspan', { class: 'ds' }, lab); ts.textContent = '  ' + d; }
      // strip
      const top = Math.round(yc - sh / 2);
      for (let l = 1; l <= NL; l++) {
        let c = 'off';
        if ((r.kind === 't2' || r.kind === 'loop') && l >= r.s && l <= r.e) c = r.kind === 't2' ? 'rec' : 'loop';
        el('rect', { class: 'cell ' + c, x: sx + (l - 1) * pitch, y: top, width: pitch - 1, height: sh }, cellsG);
      }
      if (r.kind === 'loop') {
        const a = el('text', { class: 'ann', x: sx + stripW + 5, y: yc, dy: '0.35em' }, svg);
        a.textContent = '×' + (r.K || 2);
      }
      // dot
      const v = val(r, m);
      if (v == null) {
        const ne = el('text', { class: 'ne halo', x: bx + 7, y: yc, dy: '0.35em' }, marks);   // right of the baseline rule, never across it
        ne.textContent = 'not evaluated';
        o.dx = null;
        return;
      }
      const x = X(v), cls = r.kind === 'base' ? 'eq' : cmp(v, base, m);
      if (cls !== 'eq' && Math.abs(x - bx) > 4) el('line', { class: 'stem ' + cls, x1: bx, x2: x, y1: yc, y2: yc }, marks);
      el('circle', { class: cls, cx: x.toFixed(2), cy: yc, r: 3.5 }, marks);
      o.dx = x;
      if (narrow) {
        const vt = el('text', { class: 'val', x: W, y: ly, 'text-anchor': 'end' }, svg);
        vt.textContent = fmt(v, m);
      } else {
        const left = cls === 'dn';
        const vt = el('text', { class: 'val', x: (left ? x - 8 : x + 8).toFixed(1), y: yc, dy: '0.35em', 'text-anchor': left ? 'end' : 'start' }, marks);
        vt.textContent = fmt(v, m);
      }
    });

    svg.setAttribute('aria-label', ariaText(L, m));
    wrap.textContent = '';
    wrap.appendChild(svg);
    if (!narrow) {   // labels must end before the strip; otherwise use the stacked layout
      let mx = 0;
      labs.forEach(function (t) { try { mx = Math.max(mx, t.getComputedTextLength()); } catch (e) { /* not rendered */ } });
      if (mx > LW + 2) { render(true); return; }
    }
    C = { svg: svg, rows: L, band: band, W: W };
    bind(svg);
    if (act >= L.length) act = -1;
    announce(L, m);
  }

  /* ---------- text ---------- */
  function ariaText(L, m) {
    const b = val(R.base, m);
    return 'Dot plot of ' + metricLong(m).toLowerCase() + ' for ' + GROUPS[st.g].name + ' (' + L.length + ' models): ' +
      L.map(function (o) {
        const r = o.r, v = val(r, m), d = desc(r);
        const lab = r.name + (d ? ', ' + d.replace(/ · /g, ', ') : '') + (r.kind === 't2' ? ', recurrent layers ' + r.s + ' to ' + r.e : '');
        if (v == null) return lab + ': not evaluated';
        return lab + ': ' + fmt(v, m) + (r.kind === 'base' ? '' : ' (' + delta(v, b, m) + ' vs baseline)');
      }).join('; ') + '. Focus the chart and use the up and down arrow keys to read every score of one model.';
  }
  function announce(L, m) {
    const g = GROUPS[st.g], b = val(R.base, m);
    status.textContent = '';
    status.appendChild(h('b', null, metricLong(m)));
    const parts = [];
    let n = 0, up = 0;
    const missing = [], none = [];
    g.secs.forEach(function (s) {
      let best = null, full = null;
      const miss = [];
      s.rows.forEach(function (id) {
        const r = R[id], v = val(r, m);
        if (v == null) { miss.push(r); return; }
        n++; if (cmp(v, b, m) === 'up') up++;
        if (!best || v > val(best, m)) best = r;
        if (r.full) full = r;
      });
      if (!best) { none.push(s.st); return; }
      miss.forEach(function (r) { missing.push(r); });
      const pre = g.secs.length > 1 ? s.st + ': ' : '';
      parts.push([pre + 'best ' + shortLab(best) + ' ', fmt(val(best, m), m)]);
      if (full && full !== best) parts.push(['full recurrence ' + full.name + ' ', fmt(val(full, m), m)]);
    });
    parts.push(['baseline ', fmt(b, m)]);
    status.appendChild(document.createTextNode(': '));
    parts.forEach(function (p, i) {
      if (i) status.appendChild(document.createTextNode(g.secs.length > 1 ? '; ' : ', '));
      status.appendChild(document.createTextNode(p[0]));
      status.appendChild(h('b', null, p[1]));
    });
    let tail = '. ' + up + ' of ' + n + ' evaluated variants score above the baseline.';
    if (missing.length) tail += ' ' + missing.map(function (r) { return r.name; }).join(', ') + (missing.length === 1 ? ' was' : ' were') + ' not finetuned.';
    if (none.length) tail += ' Not evaluated: ' + none.join(', ') + ' rows.';
    status.appendChild(document.createTextNode(tail));
  }

  /* ---------- tooltip ---------- */
  function fillTip(r) {
    tip.textContent = '';
    const d = desc(r);
    tip.appendChild(h('div', 't1', r.name + (d ? ' · ' + d : '')));
    tip.appendChild(h('div', 't2', how(r)));
    const tt = h('div', 'tt');
    function line(k) {
      const v = val(r, k), b = val(R.base, k), on = k === st.m ? ' on' : '';
      tt.appendChild(h('span', 'n' + on, SHORT[k]));
      tt.appendChild(h('span', 'v' + on, v == null ? '–' : fmt(v, k)));
      if (v == null || r.kind === 'base') tt.appendChild(h('span', 'd', ''));
      else tt.appendChild(h('span', 'd ' + cmp(v, b, k), delta(v, b, k)));
    }
    tt.appendChild(h('span', 'hh', r.kind === 'base' ? 'zero-shot accuracy, %' : 'zero-shot accuracy, %  (Δ vs baseline)'));
    ZK.forEach(line);
    if (r.ft) { tt.appendChild(h('span', 'hh', 'finetuned, pass@1')); FK.forEach(line); }
    else if (isFt(st.m)) tt.appendChild(h('span', 'hh', 'finetuned tasks: not evaluated'));
    tip.appendChild(tt);
  }
  function placeTip(cx, cy) {   // cx, cy in client coordinates
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
  function hideTip() { tip.classList.remove('on'); }

  /* ---------- interaction ---------- */
  function setAct(i) {
    act = i;
    if (!C) return;
    if (i < 0) { C.band.setAttribute('visibility', 'hidden'); C.band.classList.remove('on'); hideTip(); return; }
    const o = C.rows[i];
    C.band.setAttribute('y', o.y0);
    C.band.setAttribute('height', o.y1 - o.y0);
    C.band.setAttribute('visibility', 'visible');
    C.band.classList.add('on');
    fillTip(o.r);
  }
  function rowAt(y) {
    const L = C.rows;
    for (let i = 0; i < L.length; i++) if (y >= L[i].y0 && y < L[i].y1) return i;
    return -1;
  }
  function local(svg, e) {
    const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: (e.clientX - b.left) * (vb.width / (b.width || 1)), y: (e.clientY - b.top) * (vb.height / (b.height || 1)) };
  }
  function keyTip() {   // anchor the tooltip at the active row's dot (or the row's plot start)
    const o = C.rows[act], b = C.svg.getBoundingClientRect(), vb = C.svg.viewBox.baseVal, s = b.width / (vb.width || 1);
    const x = o.dx != null ? o.dx : C.W * 0.6;
    placeTip(b.left + x * s, b.top + o.yc * s);
  }
  function bind(svg) {
    function move(e) {
      if (!C) return;
      const i = rowAt(local(svg, e).y);
      if (i < 0) { if (actBy === 'ptr') { setAct(-1); actBy = null; } return; }
      if (i !== act || actBy !== 'ptr') { actBy = 'ptr'; setAct(i); }
      placeTip(e.clientX, e.clientY);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') move(e); });
    svg.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch' || actBy !== 'ptr') return;
      setAct(-1); actBy = null;
    });
    svg.addEventListener('focus', function () {
      if (actBy === 'ptr') return;
      actBy = 'key';
      setAct(act < 0 ? 0 : act);
      keyTip();
    });
    svg.addEventListener('blur', function () { if (actBy === 'key') { setAct(-1); actBy = null; } });
    svg.addEventListener('keydown', function (e) {
      const n = C.rows.length;
      let i = act < 0 ? 0 : act;
      switch (e.key) {
        case 'ArrowUp': i = Math.max(0, i - 1); break;
        case 'ArrowDown': i = Math.min(n - 1, i + 1); break;
        case 'Home': i = 0; break;
        case 'End': i = n - 1; break;
        case 'Escape': setAct(-1); actBy = null; return;
        default: return;
      }
      e.preventDefault();
      actBy = 'key';
      setAct(i);
      keyTip();
    });
  }
  // Touch: a tap outside the chart dismisses the tooltip.
  document.addEventListener('pointerdown', function (e) {
    if (act < 0 || e.pointerType === 'mouse' || !C) return;
    if (C.svg.contains(e.target)) return;
    setAct(-1); actBy = null;
  }, true);

  /* ---------- controls ---------- */
  sel.addEventListener('change', function () {
    if (sel.value === st.m) return;
    st.m = sel.value;
    act = -1; actBy = null;
    render();
  });
  function syncSeg() {
    seg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === st.g)); });
  }
  seg.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b || st.g === b.dataset.v) return;
    st.g = b.dataset.v;
    syncSeg();
    act = -1; actBy = null;
    render();
  });

  syncSeg();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (act < 0) render(); });

  let lastW = wrap.clientWidth, raf = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      const w = wrap.clientWidth;
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { act = -1; actBy = null; render(); });
    }).observe(wrap);
  }
})();
