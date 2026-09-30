/* data figures, bundled from figs/*.js by build.py */
/* ---- niah ---- */
/* fx-niah: DeepSeek needle accuracy by residue r = t_K mod 8. The table selects the model; "fold" overlays its stride cycles. */
(function(){
  'use strict';
  const fig = document.getElementById('fx-niah');
  if(!fig) return;
  const D = window.FIGDATA && window.FIGDATA.niah;
  const plot = fig.querySelector('.niah-plot'), tbody = fig.querySelector('.niah-tbl tbody');
  if(!D || !Array.isArray(D.models) || !D.models.length || !plot || !tbody) return;

  const NS = 'http://www.w3.org/2000/svg', NB = '\u00a0';
  const M = D.models, NR = 8, Y0 = 20, Y1 = 100;
  // folded view: one line per stride cycle; the first solid with dots, later ones dashed with rings
  const CYC = [{dash: null, op: 1}, {dash: [5, 3], op: .9}, {dash: [2.4, 2.4], op: .8}, {dash: [1, 2.4], op: .7}];
  const FOLD_MS = 280, MORPH_MS = 260;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const still = () => !!(mq && mq.matches);
  const status = fig.querySelector('.fx-status');
  const segs = Array.from(fig.querySelectorAll('.fx-seg button[data-fold]'));
  const sOut = fig.querySelector('.niah-s');

  const f1 = v => v.toFixed(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  // accuracy and 95% Wilson bounds recomputed from the counts (the export rounds them to 2 decimals)
  const Z = 1.959964;
  const E = D.models.map(m => {
    if(!Array.isArray(m.correct) || !m.n) return {acc: m.acc, lo: m.lo, hi: m.hi};
    const o = {acc: [], lo: [], hi: []}, n = m.n, z2 = Z * Z;
    m.correct.forEach((c, r) => {
      const p = c / n, den = 1 + z2 / n, mid = (p + z2 / (2 * n)) / den, hw = Z / den * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
      o.acc[r] = 100 * p; o.lo[r] = 100 * (mid - hw); o.hi[r] = 100 * (mid + hw);
    });
    return o;
  });
  const vals = m => { const e = E[M.indexOf(m)]; return e.acc.concat(e.lo, e.hi); };
  function el(tag, at, parent){ const e = document.createElementNS(NS, tag); if(at) for(const k in at) e.setAttribute(k, at[k]); if(parent) parent.appendChild(e); return e; }
  function tx(parent, s, at){ const e = el('text', at, parent); e.textContent = s; return e; }
  function hh(tag, cls, s){ const e = document.createElement(tag); if(cls) e.className = cls; if(s != null) e.textContent = s; return e; }
  function nameNode(m, tag){ // "DeepSeek-" is hidden visually on narrow screens; screen readers still read it
    const s = hh(tag || 'span', 'niah-nm'), mm = /^(DeepSeek-)(.+)$/.exec(m.name);
    if(mm) s.append(hh('span', 'niah-pre', mm[1]), mm[2]); else s.textContent = m.name;
    return s;
  }
  // mean |A(r) − A(r+S)| over every pair of residues one stride apart, exact from the counts
  const MAD = M.map(m => { let s = 0, k = 0; for(let r = 0; r + m.S < NR; r++, k++) s += Math.abs(m.correct[r] - m.correct[r + m.S]); return 100 * s / k / m.n; });

  const st = {sel: 0, fold: false, t: 0, fade: 1, v: vals(M[0]), hov: null, ptr: null, peek: -1, w: 0};
  let G = null;

  /* ---------- table ---------- */
  const rows = M.map((m, i) => {
    const tr = document.createElement('tr'), td = document.createElement('td'), lab = document.createElement('label');
    const inp = document.createElement('input');
    inp.type = 'radio'; inp.name = 'fx-niah-model'; inp.value = m.id; inp.className = 'niah-rb';
    const key = hh('span', 'niah-key'); key.setAttribute('aria-hidden', 'true');
    lab.append(inp, key, nameNode(m)); td.appendChild(lab); tr.appendChild(td);
    [String(m.S), f1(m.mean), f1(m.worst), f1(m.best), f1(m.gap)].forEach((s, j) => {
      const c = hh('td', j === 2 ? 'lo' : '', s); tr.appendChild(c);
    });
    tbody.appendChild(tr);
    inp.addEventListener('change', () => { if(inp.checked) select(i); });
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); choose(i); } });
    tr.addEventListener('click', e => {
      if(e.target.closest('label')) return;              // the label already checks its radio
      choose(i); inp.focus({preventScroll: true});
    });
    tr.addEventListener('pointerenter', () => { st.peek = i; paintHover(); });
    tr.addEventListener('pointerleave', () => { if(st.peek === i){ st.peek = -1; paintHover(); } });
    return {tr, inp};
  });
  function choose(i){ rows[i].inp.checked = true; select(i); }

  /* ---------- chart ---------- */
  const svg = el('svg', {class: 'fx-svg', role: 'img', tabindex: '0'}, plot);
  const tip = hh('div', 'fx-tip'); tip.setAttribute('aria-hidden', 'true'); fig.appendChild(tip);

  function xAt(r, t){ const g = G, pw = g.R - g.L, a = g.L + (r + .5) * pw / NR, b = g.L + (r % g.S + .5) * pw / g.S; return a + (b - a) * t; }
  function yAt(v){ const g = G; return g.B - (v - Y0) / (Y1 - Y0) * (g.B - g.T); }

  function build(){
    const w = Math.round(plot.clientWidth);
    if(!w) return;
    st.w = w;
    const narrow = w < 480, H = narrow ? 236 : 262;
    const m = M[st.sel], S = m.S, nc = NR / S;
    const g = G = {w, H, S, nc, L: 34, R: w - (narrow ? 42 : 46), T: 30, B: H - 40};
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`);
    svg.setAttribute('width', w); svg.setAttribute('height', H);
    svg.textContent = '';
    const layer = cls => el('g', {class: cls}, svg);
    const pw = g.R - g.L;

    // stride cycles of the selected model: dashed period boundaries between cycles, each cycle labelled at the top
    const lb = layer('niah-bands');
    g.cyc = []; g.cycLab = [];
    for(let k = 0; k < nc; k++){
      if(k > 0) g.cyc[k] = el('line', {class: 'niah-cyc', y1: g.T - 24, y2: g.B}, lb);
      g.cycLab[k] = tx(lb, 'cycle ' + (k + 1), {class: 'niah-cl', y: g.T - 11});
    }
    // y grid on a fixed 20–100 domain so models compare honestly
    const lg = layer('niah-grid');
    for(let v = Y0; v <= Y1; v += 20){
      const y = Math.round(yAt(v)) + .5;
      el('line', {class: v === Y0 ? 'ax' : 'gr', x1: g.L, x2: g.R, y1: y, y2: y}, lg);
      tx(lg, v === Y1 ? '100%' : String(v), {x: g.L - 7, y: y + 3.5, 'text-anchor': 'end'});
    }
    // x ticks: residues (move with their points when folding) and fold phases
    const lx = layer('niah-x');
    g.xt = []; for(let r = 0; r < NR; r++) g.xt[r] = tx(lx, String(r), {y: g.B + 16, 'text-anchor': 'middle'});
    g.xf = []; for(let c = 0; c < S; c++) g.xf[c] = tx(lx, String(c), {x: (g.L + (c + .5) * pw / S).toFixed(2), y: g.B + 16, 'text-anchor': 'middle'});
    const cx = ((g.L + g.R) / 2).toFixed(1);
    g.titleR = el('text', {x: cx, y: g.B + 33, 'text-anchor': 'middle'}, lx);
    g.titleR.append('residue r = t');
    el('tspan', {dy: 3, 'font-size': 8}, g.titleR).textContent = 'K';
    el('tspan', {dy: -3}, g.titleR).textContent = ' mod 8';
    g.titleF = tx(lx, `r mod ${S} · cycles overlaid`, {x: cx, y: g.B + 33, 'text-anchor': 'middle'});

    // selected model: interval band (one piece per cycle plus connectors while folding)
    const lc = layer('niah-cis');
    g.ciAll = el('path', {class: 'niah-ci'}, lc);
    g.ciK = []; g.ciC = [];
    for(let k = 0; k < nc; k++){ g.ciK[k] = el('path', {class: 'niah-ci'}, lc); if(k < nc - 1) g.ciC[k] = el('path', {class: 'niah-ci'}, lc); }
    // context: the other models as thin grey lines (fixed at residue positions; they fade out when folded)
    g.lctx = layer('niah-ctxs');
    g.ctx = [];
    const pwn = pw / NR;
    M.forEach((mm, j) => {
      if(j === st.sel) return;
      // solid within each stride period, dotted where the line crosses a period boundary (as in the paper)
      const q = r => (g.L + (r + .5) * pwn).toFixed(2) + ',' + yAt(E[j].acc[r]).toFixed(2);
      let solid = '', dot = '';
      for(let r = 0; r < NR; r++){
        solid += (r % mm.S ? 'L' : 'M') + q(r);
        if(r % mm.S === mm.S - 1 && r + 1 < NR) dot += 'M' + q(r) + 'L' + q(r + 1);
      }
      const p = el('g', {class: 'niah-ctx', 'data-j': j}, g.lctx);
      el('path', {d: solid}, p); el('path', {class: 'dot', d: dot}, p);
      g.ctx.push(p);
    });
    // selected model: lines per cycle + connectors, then markers (cycle 1 drawn on top)
    g.lsel = layer('niah-sel');
    g.lnC = []; g.lnK = [];
    for(let k = 0; k < nc - 1; k++) g.lnC[k] = el('path', {class: 'niah-ln dot'}, g.lsel);   // dotted across period boundaries
    for(let k = nc - 1; k >= 0; k--) g.lnK[k] = el('path', {class: 'niah-ln' + (k ? ' dsh' : '')}, g.lsel);
    g.mr = []; g.mk = [];
    for(let r = S; r < NR; r++) g.mr[r] = el('circle', {class: 'niah-mr', r: 4.75}, g.lsel);
    for(let r = NR - 1; r >= 0; r--) g.mk[r] = el('circle', {class: 'niah-mk', r: 3.25}, g.lsel);
    // gap bracket: best minus worst group
    const lp = layer('niah-gapg');
    g.gap = el('path', {class: 'niah-gap'}, lp);
    g.gapK = tx(lp, 'gap', {x: g.R + 13});
    g.gapV = tx(lp, '', {class: 'niah-gv', x: g.R + 13});
    // folded legend (top row): which line is which cycle
    g.leg = layer('niah-leg');
    const labs = Array.from({length: nc}, (_, k) => `r ${k * S}–${k * S + S - 1}`);
    const fit = [[24, 16], [18, 12], [14, 9]].find(([sw, gp]) => g.L + labs.reduce((a, l) => a + sw + 6 + l.length * 6.3 + gp, -gp) <= w - 2) || [14, 9];
    let lx0 = g.L;
    labs.forEach((lab, k) => {
      const y = g.T - 15, sw = fit[0];
      const ln = el('line', {class: 'niah-ln' + (k ? ' dsh' : ''), x1: lx0, x2: lx0 + sw, y1: y, y2: y}, g.leg);
      if(k){ ln.setAttribute('stroke-dasharray', CYC[k].dash.join(' ')); ln.style.opacity = CYC[k].op; }
      if(k) el('circle', {class: 'niah-mr', cx: lx0 + sw / 2, cy: y, r: 3.75, style: `opacity:${CYC[k].op}`}, g.leg);
      else el('circle', {class: 'niah-mk pl', cx: lx0 + sw / 2, cy: y, r: 3}, g.leg);
      tx(g.leg, lab, {x: lx0 + sw + 6, y: y + 3.5});
      lx0 += sw + 6 + lab.length * 6.3 + fit[1];
    });
    // hover marks
    const lh = layer('niah-hov');
    g.hair = el('line', {class: 'hair', y1: g.T, y2: g.B, style: 'display:none'}, lh);
    g.hr = [el('circle', {class: 'niah-hr', r: 6.5, style: 'display:none'}, lh)];
    g.hd = el('circle', {class: 'niah-hd', r: 3.25, style: 'display:none'}, lh);
  }

  function draw(){
    const g = G;
    if(!g) return;
    const S = g.S, nc = g.nc, t = st.t, v = st.v, pw = g.R - g.L;
    const A = r => v[r], LO = r => v[NR + r], HI = r => v[2 * NR + r];
    const pt = (r, a) => xAt(r, t).toFixed(2) + ',' + yAt(a).toFixed(2);
    const line = rs => 'M' + rs.map(r => pt(r, A(r))).join('L');
    const band = rs => 'M' + rs.map(r => pt(r, HI(r))).join('L') + 'L' + rs.slice().reverse().map(r => pt(r, LO(r))).join('L') + 'Z';
    const span = (a, b) => { const o = []; for(let r = a; r <= b; r++) o.push(r); return o; };
    const conn = Math.max(0, 1 - 2 * t), ctxOp = Math.max(0, 1 - 2.5 * t);

    for(let k = 0; k < nc; k++){
      const a = g.L + k * S * pw / NR, b = g.L + (k + 1) * S * pw / NR;
      const x0 = a + (g.L - a) * t, x1 = b + (g.R - b) * t;
      if(g.cyc[k]){ const xb = (Math.round(x0) + .5).toFixed(1); g.cyc[k].setAttribute('x1', xb); g.cyc[k].setAttribute('x2', xb); g.cyc[k].style.opacity = 1 - t; }
      g.cycLab[k].setAttribute('x', (x0 + 6).toFixed(2));
      g.cycLab[k].style.opacity = conn;
    }
    for(let r = 0; r < NR; r++){ g.xt[r].setAttribute('x', xAt(r, t).toFixed(2)); g.xt[r].style.opacity = conn; }
    const fin = Math.max(0, 2 * t - 1);
    g.xf.forEach(e => { e.style.opacity = fin; });
    g.titleR.style.opacity = conn; g.titleF.style.opacity = fin;
    g.leg.style.opacity = fin * st.fade;
    g.lctx.style.opacity = ctxOp;
    g.lctx.style.display = ctxOp ? '' : 'none';

    // interval band: one continuous path at rest, pieces while folding
    const split = t > 0;
    g.ciAll.style.display = split ? 'none' : '';
    if(!split) g.ciAll.setAttribute('d', band(span(0, NR - 1)));
    for(let k = 0; k < nc; k++){
      g.ciK[k].style.display = split ? '' : 'none';
      if(split) g.ciK[k].setAttribute('d', band(span(k * S, k * S + S - 1)));
      if(k < nc - 1){
        g.ciC[k].style.display = split && conn ? '' : 'none';
        if(split) g.ciC[k].setAttribute('d', band([k * S + S - 1, (k + 1) * S]));
        g.ciC[k].style.opacity = conn;
      }
    }
    g.ciAll.parentNode.style.opacity = st.fade;
    // lines: cycles fold onto the first; later cycles turn dashed and lighter
    for(let k = 0; k < nc; k++){
      const p = g.lnK[k];
      p.setAttribute('d', line(span(k * S, k * S + S - 1)));
      if(k){
        const c = CYC[Math.min(k, CYC.length - 1)];
        p.setAttribute('stroke-dasharray', (c.dash[0] + (1 - t) * 40).toFixed(2) + ' ' + (c.dash[1] * t).toFixed(2));
        p.style.opacity = 1 + (c.op - 1) * t;
      }
      if(k < nc - 1){
        g.lnC[k].setAttribute('d', line([k * S + S - 1, (k + 1) * S]));
        g.lnC[k].style.opacity = conn;
        g.lnC[k].style.display = conn ? '' : 'none';
      }
    }
    for(let r = 0; r < NR; r++){
      const x = xAt(r, t).toFixed(2), y = yAt(A(r)).toFixed(2), k = Math.floor(r / S);
      g.mk[r].setAttribute('cx', x); g.mk[r].setAttribute('cy', y);
      g.mk[r].style.opacity = k ? 1 - t : 1;
      if(g.mr[r]){
        g.mr[r].setAttribute('cx', x); g.mr[r].setAttribute('cy', y);
        g.mr[r].style.opacity = t * CYC[Math.min(k, CYC.length - 1)].op;
        g.mr[r].style.display = t ? '' : 'none';
      }
    }
    g.lsel.style.opacity = st.fade;
    // gap bracket follows the displayed values
    let hi = -1, lo = 101;
    for(let r = 0; r < NR; r++){ hi = Math.max(hi, A(r)); lo = Math.min(lo, A(r)); }
    const yb = yAt(hi), yw = yAt(lo), bx = g.R + 7;
    g.gap.setAttribute('d', `M${bx - 4},${yb.toFixed(2)}H${bx}V${yw.toFixed(2)}H${bx - 4}`);
    const ym = (yb + yw) / 2;
    g.gapK.setAttribute('y', (ym - 2).toFixed(2));
    g.gapV.setAttribute('y', (ym + 10).toFixed(2));
    g.gapV.textContent = f1(hi - lo);
    paintHover();
  }

  /* ---------- tweening (≤ 300 ms, skipped under reduced motion) ---------- */
  const tw = {};
  let raf = 0;
  function tween(key, from, to, dur, set){
    if(still() || dur <= 0){ delete tw[key]; set(to); draw(); return; }
    const a = tw[key] = {from, to, t0: performance.now(), dur, set};
    if(!raf) raf = requestAnimationFrame(loop);
    // if frames stall (throttled or headless rendering), land on the final state anyway
    setTimeout(() => { if(tw[key] === a){ delete tw[key]; set(to); draw(); } }, dur + 120);
  }
  function loop(now){
    raf = 0;
    let live = false;
    for(const k in tw){
      const a = tw[k], p = clamp((now - a.t0) / a.dur, 0, 1), e = ease(p);
      a.set(Array.isArray(a.to) ? a.to.map((x, i) => a.from[i] + (x - a.from[i]) * e) : a.from + (a.to - a.from) * e);
      if(p >= 1) delete tw[k]; else live = true;
    }
    draw();
    if(live) raf = requestAnimationFrame(loop);
  }

  /* ---------- hover, tooltip ---------- */
  function swatch(k, sel){
    const s = el('svg', {class: 'niah-sw', width: 22, height: 10, viewBox: '0 0 22 10', 'aria-hidden': 'true'});
    const l = el('line', {class: sel ? 'niah-ln' + (k ? ' dsh' : '') : 'niah-ctx hl', x1: 1, x2: 21, y1: 5, y2: 5}, s);
    if(sel && k){ l.setAttribute('stroke-dasharray', CYC[k].dash.join(' ')); l.style.opacity = CYC[k].op; }
    if(sel) el('circle', k ? {class: 'niah-mr', cx: 11, cy: 5, r: 3.4, style: `opacity:${CYC[k].op}`} : {class: 'niah-mk pl', cx: 11, cy: 5, r: 2.8}, s);
    return s;
  }
  function tipResidue(j, r){
    const m = M[j], e = E[j];
    tip.textContent = '';
    const top = hh('div', 'niah-th'); top.append(swatch(0, j === st.sel), hh('span', null, m.name));
    const l2 = hh('div');
    l2.append(hh('span', 'k', 'r' + NB + '=' + NB + r + NB + NB), hh('b', null, f1(e.acc[r]) + '%'), hh('span', 'k', NB + NB + '[' + f1(e.lo[r]) + ', ' + f1(e.hi[r]) + ']'));
    tip.append(top, l2, hh('div', 'k', m.correct[r] + ' of ' + m.n + ' correct'));
  }
  function tipFold(c){
    const m = M[st.sel], e = E[st.sel], S = m.S, nc = NR / S;
    tip.textContent = '';
    const top = hh('div', 'niah-th'); top.append(hh('span', null, m.name), hh('span', 'k', 'r mod ' + S + ' = ' + c));
    const grid = hh('div', 'niah-tg');
    let cmax = -1, cmin = Infinity;
    for(let k = 0; k < nc; k++){
      const r = c + k * S;
      cmax = Math.max(cmax, m.correct[r]); cmin = Math.min(cmin, m.correct[r]);
      grid.append(swatch(k, true), hh('span', 'k', 'r' + NB + '=' + NB + r), hh('b', 'n', f1(e.acc[r]) + '%'),
        hh('span', 'k', '[' + f1(e.lo[r]) + ', ' + f1(e.hi[r]) + ']'), hh('span', 'k n', m.correct[r] + '/' + m.n));
    }
    const sp = 100 * (cmax - cmin) / m.n;
    tip.append(top, grid, hh('div', 'k', (nc === 2 ? `|A(${c}) − A(${c + S})|` : 'spread across cycles') + ' = ' + f1(sp) + ' pp'));
  }
  function placeTip(ax, ay){
    tip.classList.add('on');
    const fw = fig.clientWidth, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ax + 14, y = ay - h - 12;
    if(x + w > fw) x = ax - w - 14;
    x = clamp(x, 0, Math.max(0, fw - w));
    if(y < 0) y = ay + 18;
    tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px';
  }
  function show(e, x, y){ e.setAttribute('cx', x.toFixed(2)); e.setAttribute('cy', y.toFixed(2)); e.style.display = ''; }

  function paintHover(){
    const g = G;
    if(!g) return;
    const hv = st.hov;
    const hl = hv && hv.m != null && hv.m !== st.sel ? hv.m : (st.peek >= 0 && st.peek !== st.sel ? st.peek : -1);
    g.ctx.forEach(p => {
      const on = +p.getAttribute('data-j') === hl;
      if(on !== p.classList.contains('hl')){ p.classList.toggle('hl', on); if(on) p.parentNode.appendChild(p); }
    });
    rows.forEach((row, j) => row.tr.classList.toggle('peek', !!hv && hv.m === j && j !== st.sel));
    svg.classList.toggle('niah-can', !!hv && hv.m != null && hv.m !== st.sel && !!hv.near);
    g.hair.style.display = 'none'; g.hd.style.display = 'none'; g.hr.forEach(c => { c.style.display = 'none'; });
    if(!hv){ tip.classList.remove('on'); return; }
    let px, py;
    if(hv.c != null){
      const x = xAt(hv.c, 1);
      let top = Infinity;
      for(let k = 0; k < g.nc; k++) top = Math.min(top, yAt(st.v[hv.c + k * g.S]));
      px = x; py = top;
      tipFold(hv.c);
    } else {
      const x = xAt(hv.r, 0), a = hv.m === st.sel ? st.v[hv.r] : E[hv.m].acc[hv.r], y = yAt(a);
      show(hv.m === st.sel ? g.hr[0] : g.hd, x, y);
      px = x; py = y;
      tipResidue(hv.m, hv.r);
    }
    const hx = Math.round(px) + .5;
    g.hair.setAttribute('x1', hx); g.hair.setAttribute('x2', hx); g.hair.style.display = '';
    let ax, ay;
    if(st.ptr){ ax = st.ptr.x; ay = st.ptr.y; }
    else {
      const sr = svg.getBoundingClientRect(), fr = fig.getBoundingClientRect(), k = sr.width / g.w || 1;
      ax = sr.left - fr.left + px * k; ay = sr.top - fr.top + py * k;
    }
    placeTip(ax, ay);
  }

  // nearest line at the pointer's residue; the selected line wins inside its band or within 8 px
  function pick(sx, sy){
    const g = G, pw = g.R - g.L;
    if(st.t >= .5) return {c: clamp(Math.floor((sx - g.L) / (pw / g.S)), 0, g.S - 1)};
    const r = clamp(Math.floor((sx - g.L) / (pw / NR)), 0, NR - 1);
    const ys = yAt(st.v[r]), ylo = yAt(st.v[NR + r]), yhi = yAt(st.v[2 * NR + r]);
    let best = st.sel, bd = sy >= yhi && sy <= ylo ? 0 : Math.max(0, Math.abs(ys - sy) - 8);
    M.forEach((m, j) => {
      if(j === st.sel) return;
      const d = Math.abs(yAt(E[j].acc[r]) - sy);
      if(d < bd){ bd = d; best = j; }
    });
    return {r, m: best, near: bd <= 14};
  }
  function onPointer(e){
    if(!G || e.isPrimary === false) return;
    const sr = svg.getBoundingClientRect(), fr = fig.getBoundingClientRect(), k = G.w / (sr.width || G.w);
    st.hov = pick((e.clientX - sr.left) * k, (e.clientY - sr.top) * k);
    st.ptr = {x: e.clientX - fr.left, y: e.clientY - fr.top};
    paintHover();
  }
  function clearHover(){ st.hov = null; st.ptr = null; paintHover(); }
  svg.addEventListener('pointermove', onPointer);
  svg.addEventListener('pointerdown', onPointer);
  svg.addEventListener('pointerleave', e => { if(e.pointerType !== 'touch') clearHover(); });
  document.addEventListener('pointerdown', e => { if(st.hov && !svg.contains(e.target)) clearHover(); });
  svg.addEventListener('click', () => {
    const hv = st.hov;
    if(hv && hv.m != null && hv.m !== st.sel && hv.near){ const r = hv.r; choose(hv.m); st.hov = {r, m: st.sel, near: true}; paintHover(); }
  });
  // keyboard: ←/→ residue (or phase when folded), ↑/↓ step between lines, Enter selects the line under the cursor
  svg.addEventListener('keydown', e => {
    if(!G) return;
    const fold = st.t >= .5, S = G.S, had = !!st.hov, o = st.hov || {};
    let hv = fold ? {c: o.c != null ? o.c : (o.r != null ? o.r % S : 0)}
                  : {r: o.r != null ? o.r : (o.c != null ? o.c : 0), m: o.m != null ? o.m : st.sel};
    switch(e.key){
      case 'ArrowRight': case 'ArrowLeft': {
        const d = had ? (e.key === 'ArrowRight' ? 1 : -1) : 0;
        if(fold) hv.c = clamp(hv.c + d, 0, S - 1); else hv.r = clamp(hv.r + d, 0, NR - 1);
        break;
      }
      case 'ArrowUp': case 'ArrowDown':
        if(!fold && had){
          const at = j => j === st.sel ? st.v[hv.r] : E[j].acc[hv.r];
          const order = M.map((_, j) => j).sort((a, b) => at(b) - at(a));
          hv.m = order[clamp(order.indexOf(hv.m) + (e.key === 'ArrowDown' ? 1 : -1), 0, order.length - 1)];
        }
        break;
      case 'Home': if(fold) hv.c = 0; else hv.r = 0; break;
      case 'End': if(fold) hv.c = S - 1; else hv.r = NR - 1; break;
      case 'Enter': case ' ':
        if(!fold && hv.m !== st.sel){ const r = hv.r; choose(hv.m); hv = {r, m: st.sel}; }
        break;
      case 'Escape': if(!had) return; hv = null; break;
      default: return;
    }
    e.preventDefault();
    st.hov = hv; st.ptr = null;
    paintHover();
  });
  const keyFocus = () => { try { return svg.matches(':focus-visible'); } catch(_){ return true; } };
  svg.addEventListener('focus', () => { if(!st.hov && keyFocus()){ st.hov = st.t >= .5 ? {c: 0} : {r: 0, m: st.sel}; st.ptr = null; paintHover(); } });
  svg.addEventListener('blur', clearHover);

  /* ---------- state changes ---------- */
  function select(i){
    if(i === st.sel) return;
    const prevS = M[st.sel].S, from = st.v.slice(), to = vals(M[i]);
    st.sel = i;
    rows.forEach((row, j) => { row.tr.classList.toggle('on', j === i); if(j === i) row.inp.checked = true; });
    st.hov = null; st.ptr = null;                // callers that keep a hover set it again afterwards
    build();
    if(prevS !== M[i].S && st.t > 0){          // folded geometry changes: show the new model directly, fading in
      delete tw.v; st.v = to;
      tween('fade', 0, 1, MORPH_MS, x => { st.fade = x; });
    } else {
      tween('v', from, to, MORPH_MS, x => { st.v = x; });
    }
    draw();
    describe();
  }
  function setFold(f){
    if(f === st.fold) return;
    st.fold = f;
    segs.forEach(b => b.setAttribute('aria-pressed', String((b.getAttribute('data-fold') === '1') === f)));
    if(st.hov){ st.hov = null; st.ptr = null; }
    tween('t', st.t, f ? 1 : 0, FOLD_MS, x => { st.t = x; });
    describe();
  }
  segs.forEach(b => b.addEventListener('click', () => setFold(b.getAttribute('data-fold') === '1')));

  function describe(){
    const m = M[st.sel], S = m.S, nc = NR / S;
    if(sOut) sOut.textContent = String(S);
    if(status){
      status.textContent = '';
      const wide = hh('span', 'niah-ww'), narrow = hh('span', 'niah-nw');   // one is display:none, so it is never announced
      wide.append(' against a ', hh('b', null, f1(m.gap) + NB + 'pp'), ' gap');
      narrow.append(' · gap ', hh('b', null, f1(m.gap) + NB + 'pp'));
      status.append(nameNode(m, 'b'), ` · S${NB}=${NB}${S} · mean |A(r)${NB}−${NB}A(r+${S})|${NB}=${NB}`, hh('b', null, f1(MAD[st.sel]) + NB + 'pp'), wide, narrow);
    }
    const list = a => a.map(f1).join(', ');
    let s;
    const e = E[st.sel];
    if(!st.fold) s = `Needle accuracy at 128K tokens by residue r of the target key position mod 8, for ${m.name} (stride ${S}): ${list(e.acc)} percent for r = 0 to 7; the other four models are drawn in grey. Gap ${f1(m.gap)} points.`;
    else s = `${m.name} folded mod ${S}, one line per stride cycle: ` + Array.from({length: nc}, (_, k) => `r = ${k * S} to ${k * S + S - 1}: ${list(e.acc.slice(k * S, k * S + S))} percent`).join('; ') + '.';
    svg.setAttribute('aria-label', s);
  }

  rows[0].inp.checked = true; rows[0].tr.classList.add('on');
  build(); draw(); describe();
  if(window.ResizeObserver){
    // Re-render on width changes. The control bar spans the same width as the chart, and a rebuild never
    // changes its size, so rebuilding synchronously here cannot re-trigger this observer.
    new ResizeObserver(() => { const w = Math.round(plot.clientWidth); if(w && w !== st.w){ build(); draw(); } })
      .observe(fig.querySelector('.fx-bar') || plot);
  }
})();

/* ---- acc ---- */
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

/* ---- ko ---- */
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

/* ---- conc ---- */
/* Figure 4 · two ways a gate can concentrate (fx-conc).
   A square plane with one point per KV head's key gate at the final checkpoint: the static effective number of
   offsets exp(H(E[α])) (x) against the per-window effective number E[exp(H(α))] (y), both from 1 (one offset) to W
   (uniform); colour = layer depth. For the reference run (W8/S8 · 1 KV · seed 42) the pretraining paths of three key
   gates are drawn, with a replay that moves a marker along each path by arc length. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-conc');
  if(!fig) return;
  const FD=window.FIGDATA||{}, C=FD.conc;
  if(!C||!C.models||!C.models.length){ console.error('fx-conc: FIGDATA.conc missing'); return; }

  const NS='http://www.w3.org/2000/svg', DUR=2500, RT2=Math.SQRT2;
  const $=id=>document.getElementById(id);
  const sel=$('fx-conc-model'), bPaths=$('fx-conc-paths'), bReplay=$('fx-conc-replay'), main=$('fx-conc-main'),
        plot=$('fx-conc-plot'), svg=$('fx-conc-svg'), key=$('fx-conc-key'), track=$('fx-conc-track'),
        hint=$('fx-conc-hint'), status=$('fx-conc-status');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);
  const mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):null;
  const reduced=()=>!!(mq&&mq.matches);
  const coarse=!!(window.matchMedia&&matchMedia('(hover: none) and (pointer: coarse)').matches);

  /* ---------- helpers ---------- */
  function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function txt(parent,x,y,s,cls,anchor){ const t=el('text',{x:x,y:y},parent); if(cls) t.setAttribute('class',cls); if(anchor) t.setAttribute('text-anchor',anchor); t.textContent=s; return t; }
  function span(parent,s,attrs){ const t=el('tspan',attrs||{},parent); t.textContent=s; return t; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f2=v=>(Math.round(v*100+(v<0?-1e-6:1e-6))/100).toFixed(2);   // half-up on the printed decimals (3.335 → 3.34)
  const nice=v=>String(+(+v).toFixed(2));
  const fx=v=>(+v).toFixed(1);
  const ease=p=>p<.5?4*p*p*p:1-Math.pow(2-2*p,3)/2;
  function measure(t,cw){
    try{ const b=t.getBBox(); if(b&&b.width>0) return {x:b.x,y:b.y,w:b.width,h:b.height}; }catch(e){ /* not rendered yet */ }
    return {x:0,y:-10,w:(t.textContent||'').length*(cw||6.3),h:13};
  }
  /* axis-aligned obstacle boxes [x0,y0,x1,y1] for label placement */
  function Obs(){ this.b=[]; }
  Obs.prototype.add=function(x0,y0,x1,y1){ this.b.push([x0,y0,x1,y1]); };
  Obs.prototype.hits=function(x0,y0,x1,y1,pad){ let n=0; for(const o of this.b) if(x0-pad<o[2]&&x1+pad>o[0]&&y0-pad<o[3]&&y1+pad>o[1]) n++; return n; };
  function polyDist(px,x,y){
    let best=Infinity;
    for(let j=0;j<px.length-1;j++){
      const a=px[j], b=px[j+1], dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy;
      const t=L?clamp(((x-a[0])*dx+(y-a[1])*dy)/L,0,1):0, d=Math.hypot(a[0]+t*dx-x,a[1]+t*dy-y);
      if(d<best) best=d;
    }
    return best;
  }

  /* ---------- data ---------- */
  const byId={}; C.models.forEach(m=>{ byId[m.id]=m; });
  const T=(C.traj&&C.traj.heads&&C.traj.heads.length&&byId[C.traj.run])?C.traj:null;
  const FROM=(T&&T.from)||'step 1', TO=(T&&T.to)||'step 47,518';
  const DEF=byId[C.default]?C.default:C.models[0].id;
  const st={id:DEF, paths:true, hov:null, anim:null};
  const M=()=>byId[st.id];
  const hasT=()=>!!T&&st.id===T.run;
  const showT=()=>hasT()&&st.paths;
  const nearTh=W=>W*15/16;                // "near uniform on average": static above 15/16 of W (7.5 of 8)
  const lname=(m,i)=>'L'+Math.floor(i/m.kv)+(m.kv>1?'·h'+(i%m.kv):'');
  const TP=T?T.heads.map(h=>{
    const P=h.path.map(q=>[+q[0],+q[1]]), n=P.length;
    // The replay marker glides along a lightly smoothed copy: checkpoint jitter doubles back on itself. Only nearby
    // vertices (±4, within 0.2 offsets) are averaged, so the sparse fast stretches and both endpoints stay exact.
    const Sm=P.map((p,i)=>{
      if(i===0||i===n-1) return p.slice();
      const k=Math.min(4,i,n-1-i); let sx=0, sy=0, c=0;
      for(let j=i-k;j<=i+k;j++){ const q=P[j]; if(Math.hypot(q[0]-p[0],q[1]-p[1])<=0.2){ sx+=q[0]; sy+=q[1]; c++; } }
      return [sx/c,sy/c];
    });
    return {layer:h.layer, P:P, Sm:Sm, start:h.start||P[0], end:h.end||P[n-1]};
  }):[];

  /* Layer colour: sequential ramp through three tokens, as inline style so a theme switch needs no redraw. */
  function layerFill(l,n){
    const t=n>1?l/(n-1):0;
    if(t<=.5){ const p=Math.round(t*200); return p<=0?'var(--fx-conc-d0)':'color-mix(in oklab, var(--fx-conc-d1) '+p+'%, var(--fx-conc-d0))'; }
    const p=Math.round((t-.5)*200); return p>=100?'var(--fx-conc-d2)':'color-mix(in oklab, var(--fx-conc-d2) '+p+'%, var(--fx-conc-d1))';
  }

  /* ---------- controls ---------- */
  (function(){
    const used={};
    (C.groups||[]).forEach(g=>{
      const og=document.createElement('optgroup'); og.label=g.title;
      (g.ids||[]).forEach(id=>{ const m=byId[id]; if(!m||used[id]) return; used[id]=1;
        const o=document.createElement('option'); o.value=id; o.textContent=m.name; og.appendChild(o); });
      if(og.children.length) sel.appendChild(og);
    });
    C.models.forEach(m=>{ if(used[m.id]) return; const o=document.createElement('option'); o.value=m.id; o.textContent=m.name; sel.appendChild(o); });
    sel.value=st.id;
  })();
  (function(){
    const na=key.querySelector('.fxc-na'); if(!na||!T) return;
    const ends=key.querySelectorAll('.fxc-ends span'); if(ends.length===2){ ends[0].textContent=FROM; ends[1].textContent=TO; }
    na.textContent='recorded for ';
    const nw=document.createElement('span'); nw.className='nw'; nw.textContent=byId[T.run].name; na.appendChild(nw);
  })();
  function syncCtl(){
    const ok=hasT();
    bPaths.disabled=!ok; bReplay.disabled=!ok;
    bPaths.setAttribute('aria-pressed',String(ok&&st.paths));
    bReplay.classList.toggle('on',!!st.anim);
    key.classList.toggle('na',!ok);
    key.classList.toggle('off',ok&&!st.paths);
    key.classList.toggle('playing',!!st.anim);
    const what=showT()?'a point or a path':'a point';
    hint.textContent=(coarse?'tap ':'hover over ')+what+' for its values';
  }

  /* ---------- geometry ---------- */
  let G=null, PTS=[], TR=[];
  function geom(){
    const m=M(), W=m.W, cw=Math.round(fig.clientWidth)||640, wide=cw>=560;
    main.classList.toggle('wide',wide);
    const pw=Math.max(220,Math.round(plot.clientWidth)||cw);
    const pad=8, mL=30, mR=wide?16:10, mT=30, mB=44;
    const S=Math.floor(clamp(pw-mL-mR-2*pad,150,420));
    const x0=mL+pad, y0=mT+pad+S, u=S/(W-1);
    return {m:m, W:W, wide:wide, pw:pw, pad:pad, S:S, u:u, H:y0+pad+mB, r:m.kv===1?2.9:2,
            X:v=>x0+(v-1)*u, Y:v=>y0-(v-1)*u,
            xL:x0-pad, xR:x0+S+pad, yT:y0-S-pad, yB:y0+pad};
  }

  /* ---------- render ---------- */
  function render(){
    const g=G=geom(), m=g.m, W=g.W, X=g.X, Y=g.Y, kv=m.kv, rr=g.r;
    svg.setAttribute('viewBox','0 0 '+g.pw+' '+g.H); svg.setAttribute('width',g.pw); svg.setAttribute('height',g.H);
    svg.textContent='';
    const Lb=el('g',{},svg), Lp=el('g',{},svg), Lt=el('g',{},svg), La=el('g',{},svg);
    g.Lo=el('g',{},svg);
    // label placement: hard obstacles (points, markers, text) must stay clear; soft ones (lines) may be crossed by a
    // haloed label when nothing better exists
    const hard=new Obs(), soft=new Obs(), tx=new Obs();   // marks, lines, text
    const inPlot=b=>b[0]>=g.xL&&b[1]>=g.yT&&b[2]<=g.xR&&b[3]<=g.yB;

    // right-edge band: uniform on average (static above 15/16 of W, the threshold counted in the status)
    const xb=X(nearTh(W));
    el('rect',{class:'band',x:fx(xb),y:g.yT,width:fx(g.xR-xb),height:g.yB-g.yT},Lb);
    // integer grid, axes, diagonal y = x
    const gr=el('g',{'shape-rendering':'crispEdges'},Lb);
    for(let v=1;v<=W;v++){
      const x=Math.round(X(v))+.5, y=Math.round(Y(v))+.5;
      el('line',{class:'gr',x1:x,x2:x,y1:g.yT,y2:g.yB},gr);
      el('line',{class:'gr',x1:g.xL,x2:g.xR,y1:y,y2:y},gr);
    }
    el('line',{class:'ax',x1:g.xL,x2:g.xR,y1:Math.round(g.yB)+.5,y2:Math.round(g.yB)+.5},gr);
    el('line',{class:'ax',x1:Math.round(g.xL)+.5,x2:Math.round(g.xL)+.5,y1:g.yT,y2:g.yB},gr);
    el('line',{class:'diag',x1:fx(X(1)),y1:fx(Y(1)),x2:fx(X(W)),y2:fx(Y(W))},Lb);
    for(let s=0;s<=g.S;s+=4){ const x=X(1)+s, y=Y(1)-s; soft.add(x-1.5,y-1.5,x+1.5,y+1.5); }
    const step=g.u>=24?1:2;
    for(let v=1;v<=W;v++){
      if(v!==1&&v%step) continue;
      txt(Lb,fx(X(v)),fx(g.yB+15),String(v),null,'middle');
      txt(Lb,fx(g.xL-7),fx(Y(v)+3.6),String(v),null,'end');
    }
    // axis titles: name (sans) + formula (mono)
    const yt=el('text',{x:0,y:14},La); span(yt,'per window',{class:'tn'}); span(yt,'E[exp(H(α))]',{dx:7});
    const xt=el('text',{x:fx(g.xR),y:fx(g.yB+36),'text-anchor':'end'},La); span(xt,'static',{class:'tn'}); span(xt,'exp(H(E[α]))',{dx:7});
    [yt,xt].forEach(t=>{ const b=measure(t); tx.add(b.x,b.y,b.x+b.w,b.y+b.h); });

    // key gates, deeper layers drawn last
    PTS=[];
    m.pts.forEach((q,i)=>{
      const l=Math.floor(i/kv), x=X(q[0]), y=Y(q[1]);
      const c=el('circle',{class:'pt'+(kv>1?' sm':''),cx:fx(x),cy:fx(y),r:rr,'data-i':i},Lp);
      c.style.fill=layerFill(l,m.layers);
      PTS.push({i:i,l:l,h:i%kv,x:x,y:y,c:c});
      hard.add(x-rr-1,y-rr-1,x+rr+1,y+rr+1);
    });

    // training paths (reference run only)
    TR=[];
    if(showT()){
      TP.forEach((tp,k)=>{
        const px=tp.P.map(q=>[X(q[0]),Y(q[1])]), sp=tp.Sm.map(q=>[X(q[0]),Y(q[1])]);
        const cs=[0]; for(let j=1;j<sp.length;j++) cs.push(cs[j-1]+Math.hypot(sp[j][0]-sp[j-1][0],sp[j][1]-sp[j-1][1]));
        const segs=px.map((p,j)=>(j?'L':'M')+fx(p[0])+' '+fx(p[1])), d=segs.join('');
        const grp=el('g',{class:'trp','data-k':k},Lt);
        el('path',{class:'tr-ghost',d:d},grp);
        const tr=el('path',{class:'tr',d:d},grp);
        const s0=px[0], e0=[X(tp.end[0]),Y(tp.end[1])];
        el('circle',{class:'tr-start',cx:fx(s0[0]),cy:fx(s0[1]),r:3.3},grp);
        el('circle',{class:'tr-end',cx:fx(e0[0]),cy:fx(e0[1]),r:3.4},grp);
        const mk=el('circle',{class:'tr-mk',cx:fx(s0[0]),cy:fx(s0[1]),r:3.4},grp);
        [s0,e0].forEach(p=>hard.add(p[0]-4.5,p[1]-4.5,p[0]+4.5,p[1]+4.5));
        for(let j=0;j<px.length-1;j++){
          const a=px[j], b=px[j+1], n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4));
          for(let q=0;q<n;q++){ const x=a[0]+(b[0]-a[0])*q/n, y=a[1]+(b[1]-a[1])*q/n; soft.add(x-1.5,y-1.5,x+1.5,y+1.5); }
        }
        TR.push({k:k, layer:tp.layer, g:grp, tr:tr, mk:mk, px:px, sp:sp, cs:cs, len:cs[cs.length-1], segs:segs, e:e0, lab:null});
      });
      // one arrowhead per path, on a long early stretch, kept apart from the others
      const heads=[];
      TR.forEach(tr=>{
        const px=tr.px, half=Math.max(2,px.length>>1), cand=[];
        for(let j=0;j<half&&j<px.length-1;j++){ const l=Math.hypot(px[j+1][0]-px[j][0],px[j+1][1]-px[j][1]); if(l>=16) cand.push([l,j]); }
        cand.sort((a,b)=>b[0]-a[0]);
        let pos=null;
        search: for(const c of cand.slice(0,4)) for(const f of [.5,.62,.38,.72,.28]){
          const a=px[c[1]], b=px[c[1]+1], x=a[0]+(b[0]-a[0])*f, y=a[1]+(b[1]-a[1])*f;
          if(heads.some(h=>Math.hypot(h[0]-x,h[1]-y)<24)||hard.hits(x-3.5,y-3.5,x+3.5,y+3.5,0)) continue;
          pos=[x,y,(b[0]-a[0])/c[0],(b[1]-a[1])/c[0]]; break search;
        }
        if(!pos) return;
        const x=pos[0], y=pos[1], ux=pos[2], uy=pos[3], ah=6.2, aw=3.2;
        el('path',{class:'tr-arrow',d:'M'+fx(x+ux*ah/2)+' '+fx(y+uy*ah/2)+'L'+fx(x-ux*ah/2-uy*aw)+' '+fx(y-uy*ah/2+ux*aw)+
          'L'+fx(x-ux*ah/2+uy*aw)+' '+fx(y-uy*ah/2-ux*aw)+'Z'},tr.g);
        heads.push([x,y]); hard.add(x-4.5,y-4.5,x+4.5,y+4.5);
      });
      // direct labels beside the end markers; first choice is the empty side of the diagonal (upper left)
      TR.forEach(tr=>{
        const t=txt(La,0,0,'L'+tr.layer,'tr-lab'); t.setAttribute('data-k',tr.k); tr.lab=t;
        const b=measure(t), w=b.w, h=b.h, ex=tr.e[0], ey=tr.e[1], cands=[];
        for(const gp of [4,10]) cands.push([ex-gp-w,ey-gp-h+4],[ex-gp-2-w,ey-h/2],[ex-w/2,ey-gp-h+1],[ex+gp,ey-gp-h+4],
                                            [ex+gp+2,ey-h/2],[ex+gp,ey+gp-4],[ex-w/2,ey+gp-1],[ex-gp-w,ey+gp-4]);
        let best=null, bs=Infinity;
        for(const c of cands){
          const bx=[c[0],c[1],c[0]+w,c[1]+h];
          if(bx[0]<0||bx[1]<0||bx[2]>g.pw||bx[3]>g.H) continue;
          const sc=10*(hard.hits(bx[0]+1,bx[1]+2.5,bx[2]-1,bx[3]-2.5,1.5)+tx.hits(bx[0],bx[1]+1,bx[2],bx[3]-1,2))+soft.hits(bx[0]+1,bx[1]+2.5,bx[2]-1,bx[3]-2.5,0);
          if(sc<bs){ bs=sc; best=bx; if(!sc) break; }
        }
        if(!best){ t.remove(); tr.lab=null; return; }
        t.setAttribute('x',fx(best[0]-b.x)); t.setAttribute('y',fx(best[1]-b.y));
        tx.add(best[0],best[1]+2,best[2],best[3]-2);
      });
    }

    // band label above the right edge (dropped if it would touch the y title)
    const bt=txt(La,fx(g.xR),14,'uniform on average','ann','end');
    const bb=measure(bt,5.8);
    if(tx.hits(bb.x,bb.y,bb.x+bb.w,bb.y+bb.h,10)) bt.remove(); else tx.add(bb.x,bb.y,bb.x+bb.w,bb.y+bb.h);

    // diagonal label on the empty side of y = x, toward its upper end
    const dl=el('text',{class:'ann','text-anchor':'middle'},La); dl.textContent='same scores in every window';
    const dw=measure(dl,5.8).w;
    let placed=false;
    const half=dw/2/(g.S*RT2);                        // half the label's length, as a fraction of the diagonal
    for(const f of [0.74,0.66,0.58,0.5,0.42,0.82,0.34,0.26]){
      if(f+half>0.97||f-half<0.04) continue;           // keep clear of both corners
      const ax=X(1)+f*g.S-6/RT2, ay=Y(1)-f*g.S-6/RT2, bx=[];
      for(let s=-dw/2;s<=dw/2+.1;s+=5){ const qx=ax+s/RT2-4/RT2, qy=ay-s/RT2-4/RT2; bx.push([qx-4.5,qy-4.5,qx+4.5,qy+4.5]); }
      if(!bx.every(inPlot)||bx.some(b=>hard.hits(b[0],b[1],b[2],b[3],2)||tx.hits(b[0],b[1],b[2],b[3],3))) continue;
      dl.setAttribute('transform','translate('+fx(ax)+' '+fx(ay)+') rotate(-45)');
      bx.forEach(b=>tx.add(b[0],b[1],b[2],b[3])); placed=true; break;
    }
    if(!placed) dl.remove();

    // lower-left note: toward the lower left along the diagonal, the same few offsets win in every window
    const nt=el('text',{class:'ann'},La);
    span(nt,'same few offsets',{x:0,dy:0}); span(nt,'in every window',{x:0,dy:14.5});
    const nb=measure(nt,5.8), gapN=16;
    const nx=X(1)+4, nby=Y(1)-(nx+nb.w-X(1))-gapN*RT2, nty=nby-nb.h, nbox=[nx,nty,nx+nb.w,nby];
    if(nty<g.yT+4||hard.hits(nbox[0],nbox[1],nbox[2],nbox[3],8)||tx.hits(nbox[0],nbox[1],nbox[2],nbox[3],18)||soft.hits(nbox[0],nbox[1],nbox[2],nbox[3],6)) nt.remove();
    else{
      nt.setAttribute('transform','translate('+fx(nx-nb.x)+' '+fx(nty-nb.y)+')');
      tx.add(nbox[0],nbox[1],nbox[2],nbox[3]);
    }

    if(st.anim){ svg.classList.add('playing'); drawAnim(ease(animP())); } else svg.classList.remove('playing');
    drawOver(); buildTrack(); setTrack(st.anim?ease(animP()):1); updAria();
  }

  /* ---------- hover ---------- */
  function locate(ev){ const b=svg.getBoundingClientRect(); if(!b.width||!G) return null; const s=G.pw/b.width; return [(ev.clientX-b.left)*s,(ev.clientY-b.top)*s]; }
  function pick(x,y){
    let bi=-1, bd=Infinity;
    for(const p of PTS){ const d=Math.hypot(p.x-x,p.y-y); if(d<bd){ bd=d; bi=p.i; } }
    if(bi>=0&&bd<=G.r+6) return {t:'pt',i:bi};
    if(TR.length&&!st.anim){
      let bk=-1, bdk=Infinity;
      for(const tr of TR){ const d=polyDist(tr.px,x,y); if(d<bdk){ bdk=d; bk=tr.k; } }
      if(bk>=0&&bdk<=6) return {t:'path',k:bk};
    }
    if(bi>=0&&bd<=G.r+11) return {t:'pt',i:bi};
    return null;
  }
  const sameHov=(a,b)=>a===b||(!!a&&!!b&&a.t===b.t&&a.i===b.i&&a.k===b.k);
  function drawOver(){
    if(!G||!G.Lo) return;
    G.Lo.textContent='';
    const h=st.hov, hp=!!h&&h.t==='path';
    TR.forEach(tr=>{
      tr.g.classList.toggle('hot',hp&&h.k===tr.k); tr.g.classList.toggle('dim',hp&&h.k!==tr.k);
      if(tr.lab) tr.lab.classList.toggle('dim',hp&&h.k!==tr.k);
    });
    if(h&&h.t==='pt'&&PTS[h.i]){
      const p=PTS[h.i], traced=TR.some(tr=>tr.layer*G.m.kv===p.i);
      if(!traced){ const c=el('circle',{class:'pt'+(G.m.kv>1?' sm':''),cx:fx(p.x),cy:fx(p.y),r:G.r},G.Lo); c.style.fill=p.c.style.fill; }
      el('circle',{class:'ring',cx:fx(p.x),cy:fx(p.y),r:G.r+(traced?4.5:3.5)},G.Lo);
    }
  }
  function ptTip(i){
    const m=M(), q=m.pts[i];
    return '<b>layer '+Math.floor(i/m.kv)+' (head '+(i%m.kv)+')</b><div class="fxc-tt"><span class="k">static</span><span>'+f2(q[0])+
      '</span><span class="k">per window</span><span>'+f2(q[1])+'</span></div><span class="k fxc-w">of W = '+m.W+'</span>';
  }
  function pathTip(k){
    const tp=TP[k], m=M(), fin=m.pts[tp.layer*m.kv]||tp.end;
    return '<b>layer '+tp.layer+' · training path</b><div class="fxc-tt3"><span></span><span class="k">static</span><span class="k">per window</span>'+
      '<span class="k">'+FROM+'</span><span>'+f2(tp.start[0])+'</span><span>'+f2(tp.start[1])+'</span>'+
      '<span class="k">'+TO+'</span><span>'+f2(fin[0])+'</span><span>'+f2(fin[1])+'</span></div>';
  }
  function showTip(ev,html){
    tip.innerHTML=html; tip.classList.add('on');
    const fr=fig.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight;
    let x=ev.clientX-fr.left+14, y=ev.clientY-fr.top+16;
    if(x+tw>fr.width) x=ev.clientX-fr.left-14-tw;
    if(y+th>fr.height) y=ev.clientY-fr.top-12-th;
    tip.style.left=clamp(x,0,Math.max(0,fr.width-tw))+'px';
    tip.style.top=clamp(y,0,Math.max(0,fr.height-th))+'px';
  }
  function hideTip(){ tip.classList.remove('on'); }
  function clearHov(){ if(st.hov){ st.hov=null; drawOver(); } hideTip(); }
  function onMove(ev){
    const q=locate(ev); if(!q) return;
    const h=pick(q[0],q[1]);
    if(!sameHov(h,st.hov)){ st.hov=h; drawOver(); }
    if(h) showTip(ev,h.t==='pt'?ptTip(h.i):pathTip(h.k)); else hideTip();
  }
  svg.addEventListener('pointermove',onMove);
  svg.addEventListener('pointerdown',onMove);
  // touch: the lifted finger "leaves" at once, so keep the tapped item until the next tap elsewhere
  svg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse'||!st.hov) clearHov(); });
  document.addEventListener('pointerdown',ev=>{ if(st.hov&&!svg.contains(ev.target)) clearHov(); },true);

  /* ---------- replay ---------- */
  function animP(){ const a=st.anim; return a?clamp((performance.now()-a.t0)/DUR,0,1):1; }
  function drawAnim(e){
    TR.forEach(tr=>{
      const n=tr.px.length, s=e*tr.len, cs=tr.cs;
      let lo=0, hi=n-1;                                   // last smoothed vertex at or before arc length s
      while(hi-lo>1){ const mid=(lo+hi)>>1; if(cs[mid]<=s) lo=mid; else hi=mid; }
      const i=Math.min(lo,n-2), seg=cs[i+1]-cs[i], f=e>=1?1:(seg>0?clamp((s-cs[i])/seg,0,1):0);
      const a=tr.sp[i], b=tr.sp[i+1];
      tr.mk.setAttribute('cx',fx(a[0]+(b[0]-a[0])*f)); tr.mk.setAttribute('cy',fx(a[1]+(b[1]-a[1])*f));
      const p=tr.px[i], q=tr.px[i+1];                     // trace: the raw path up to the same place
      tr.tr.setAttribute('d',tr.segs.slice(0,i+1).join('')+'L'+fx(p[0]+(q[0]-p[0])*f)+' '+fx(p[1]+(q[1]-p[1])*f));
    });
    setTrack(e);
  }
  function frame(){
    const a=st.anim; if(!a) return;
    const p=animP();
    drawAnim(ease(p));
    if(p>=1){ finishAnim(); return; }
    cancelAnimationFrame(a.raf); clearTimeout(a.to);
    a.raf=requestAnimationFrame(frame);
    a.to=setTimeout(frame,60);                            // frames can stall (hidden tab, headless): keep going on a timer
  }
  function stopAnim(){
    const a=st.anim; if(!a) return;
    cancelAnimationFrame(a.raf); clearTimeout(a.to); st.anim=null;
    svg.classList.remove('playing');
    TR.forEach(tr=>tr.tr.setAttribute('d',tr.segs.join('')));
    setTrack(1); syncCtl();
  }
  function finishAnim(){ stopAnim(); drawOver(); }
  function startAnim(){
    stopAnim(); clearHov();
    if(reduced()||!TR.length){ setTrack(1); return; }  // reduced motion: straight to the end state
    st.anim={t0:performance.now(), raf:0, to:0};
    svg.classList.add('playing'); syncCtl();
    frame();
  }

  /* ---------- key track (legend + replay progress) ---------- */
  let TK=null;
  function buildTrack(){
    const w=Math.max(60,Math.round(track.getBoundingClientRect().width)||140), h=12, y=6, xa=4.5, xb=w-4.5;
    track.setAttribute('viewBox','0 0 '+w+' '+h); track.textContent='';
    el('line',{class:'tk-base',x1:xa,x2:xb,y1:y,y2:y},track);
    const pr=el('line',{class:'tk-prog',x1:xa,x2:xb,y1:y,y2:y},track);
    el('circle',{class:'tk-start',cx:xa,cy:y,r:3.3},track);
    const en=el('circle',{class:'tk-end',cx:xb,cy:y,r:3.4},track);
    const mk=el('circle',{class:'tk-mk',cx:xb,cy:y,r:3.4},track);
    TK={xa:xa,xb:xb,pr:pr,en:en,mk:mk};
  }
  function setTrack(e){
    if(!TK) buildTrack();
    const x=TK.xa+(TK.xb-TK.xa)*e;
    TK.pr.setAttribute('x2',fx(x)); TK.mk.setAttribute('cx',fx(x));
    TK.en.classList.toggle('open',e<1);
  }

  /* ---------- text ---------- */
  function summary(m){
    const W=m.W, th=nearTh(W), n=m.pts.length, near=m.pts.filter(q=>q[0]>th);
    const ord=m.pts.map((q,i)=>i).sort((a,b)=>m.pts[a][0]-m.pts[b][0]).slice(0,3);
    let lo=Infinity, hi=-Infinity; near.forEach(q=>{ lo=Math.min(lo,q[1]); hi=Math.max(hi,q[1]); });
    return {W:W, th:th, n:n, near:near.length, lo:lo, hi:hi, ord:ord};
  }
  function updStatus(){
    const m=M(), s=summary(m);
    status.innerHTML='<b>'+m.name+'</b> · '+s.n+' key gates · <b>'+s.near+'</b> near uniform on average (static &gt;&nbsp;'+nice(s.th)+
      ') · most concentrated: '+s.ord.map(i=>lname(m,i)+'&nbsp;'+f2(m.pts[i][0])).join(', ');
  }
  function updAria(){
    const m=M(), s=summary(m);
    let a=m.name+': '+s.n+' key gates, one per KV head, at '+TO+'. Horizontal: static effective number of offsets, 1 to '+s.W+
      '. Vertical: per-window effective number, 1 to '+s.W+'. Dashed diagonal: the two are equal. '+s.near+' of '+s.n+' have static above '+nice(s.th)+
      (s.near?', with per-window values from '+f2(s.lo)+' to '+f2(s.hi):'')+'. Most concentrated: '+
      s.ord.map(i=>'layer '+Math.floor(i/m.kv)+(m.kv>1?' head '+(i%m.kv):'')+' at '+f2(m.pts[i][0])+' and '+f2(m.pts[i][1])).join('; ')+'.';
    if(showT()) a+=' Lines trace the key gates of layers '+TP.map(t=>t.layer).join(', ').replace(/, (\d+)$/,' and $1')+' from '+FROM+' to '+TO+'.';
    svg.setAttribute('aria-label',a);
  }

  /* ---------- state changes ---------- */
  sel.addEventListener('change',()=>{
    if(!byId[sel.value]||sel.value===st.id) return;
    stopAnim(); st.id=sel.value; st.hov=null; hideTip();
    syncCtl(); render(); updStatus();
  });
  bPaths.addEventListener('click',()=>{
    if(!hasT()) return;
    stopAnim(); st.paths=!st.paths; st.hov=null; hideTip();
    syncCtl(); render();
  });
  bReplay.addEventListener('click',()=>{
    if(!hasT()) return;
    if(!st.paths){ stopAnim(); st.paths=true; syncCtl(); render(); }
    startAnim();
  });

  let lastW=0;
  function renderAll(){ lastW=Math.round(fig.clientWidth); render(); }
  syncCtl(); renderAll(); updStatus();
  if(window.ResizeObserver){
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW){ TK=null; renderAll(); } }).observe(fig);
  }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ TK=null; render(); });
})();

/* ---- gate ---- */
/* Figure 4 · gate profiles vs knockouts (fx-gate).
   Overview: one row per KV head (row = layer*kv + head) in three aligned columns:
   key-gate static concentration (n_eff), gate profile map (key or value), knockout map.
   Detail: the selected head's key/value profiles and knockout bars on a shared phase axis. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-gate');
  if(!fig) return;
  const FD=window.FIGDATA||{}, G=FD.gates;
  if(!G||!G.models||!G.models.length){ console.error('fx-gate: FIGDATA.gates missing'); return; }

  const NS='http://www.w3.org/2000/svg', MINUS='−';
  const $=id=>document.getElementById(id);
  const selM=$('fx-gate-model'), mapSeg=$('fx-gate-map'), over=$('fx-gate-over'), osvg=$('fx-gate-osvg'),
        keys=$('fx-gate-keys'), note=$('fx-gate-note'), detail=$('fx-gate-detail'),
        picks=$('fx-gate-picks'), pickLab=$('fx-gate-picklab'), title=$('fx-gate-title'),
        dsvg=$('fx-gate-dsvg'), status=$('fx-gate-status');
  const smax=keys.querySelector('.fxg-smax'), gKey=keys.querySelector('.fxg-gs'), kKey=keys.querySelector('.fxg-ks');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);

  /* ---------- helpers ---------- */
  function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function txt(parent,x,y,s,cls,anchor){ const t=el('text',{x:x,y:y},parent); if(cls) t.setAttribute('class',cls); if(anchor) t.setAttribute('text-anchor',anchor); t.textContent=s; return t; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const argmax=a=>{ let k=0; for(let i=1;i<a.length;i++) if(a[i]>a[k]) k=i; return k; };
  const argmin=a=>{ let k=0; for(let i=1;i<a.length;i++) if(a[i]<a[k]) k=i; return k; };
  function neff(a){ let s=0; for(const x of a) s+=x; if(!(s>0)) return NaN; let H=0; for(const x of a) if(x>0){ const p=x/s; H-=p*Math.log(p); } return Math.exp(H); }
  const pct=(v,d)=>{ const s=Math.abs(v).toFixed(d===undefined?1:d); return (+s===0?'':v<0?MINUS:'+')+s+'%'; };
  const xx=(v,d)=>v.toFixed(d===undefined?2:d)+'×';

  /* ---------- data ---------- */
  const runName={}; ((FD.runs&&FD.runs.models)||[]).forEach(r=>{ runName[r.id]=r.name; });
  const isRef=id=>/^kvc_w8s8_1kv_baseline/.test(id);
  const models=G.models.map(m=>{
    const rows=[]; let top=0;
    for(let l=0;l<m.layers;l++) for(let h=0;h<m.kv;h++){
      const kg=m.kg[l][h], vg=m.vg[l][h], ko=m.ko[l][h];
      for(const v of kg) top=Math.max(top,v);
      for(const v of vg) top=Math.max(top,v);
      rows.push({i:rows.length,l:l,h:h,kg:kg,vg:vg,ko:ko,nk:neff(kg),nv:neff(vg),kp:argmax(kg),vp:argmax(vg),km:argmin(ko)});
    }
    return {m:m, rows:rows, name:runName[m.id]||m.name.replace(/, /g,' · '),
            gmax:Math.max(2,Math.ceil(top-1e-9)), unit:m.W===m.S?'offsets':'phases'};
  });
  const DEF='kvc_w8s8_1kv_baseline';
  const st={mi:Math.max(0,models.findIndex(e=>e.m.id===DEF)), gate:'k', sel:0, hov:-1, hr:-1, cur:-1, dr:-1};
  const E=()=>models[st.mi];
  const rowName=(e,R,long)=>e.m.kv>1?(long?'Layer '+R.l+' · head '+R.h:'L'+R.l+'·h'+R.h):(long?'Layer '+R.l:'L'+R.l);
  function pickRows(e){
    const hl=G.highlight&&G.highlight[e.m.id];
    if(hl&&hl.length) return {lab:'examples in the text', rows:hl.map(l=>l*e.m.kv)};
    const s=e.rows.filter(r=>isFinite(r.nk)).sort((a,b)=>a.nk-b.nk).slice(0,3);
    return {lab:'sharpest key gates', rows:s.map(r=>r.i)};
  }
  let PK=pickRows(E()); st.sel=PK.rows[0]||0;

  /* ---------- colour ---------- */
  // Gate cells: log scale from 1 (uniform, = --bg) to S/2 (half of all gate mass on one phase), clipped above.
  const gTop=S=>Math.max(2,S/2);
  function gateFill(g,S){
    if(!(g>1)) return 'var(--bg)';
    const p=Math.round(100*Math.min(1,Math.log2(g)/Math.log2(gTop(S))));
    return p<1?'var(--bg)':'color-mix(in oklab, var(--fx-gate) '+p+'%, var(--bg))';
  }
  function koFill(v){ const c=clamp(v,-100,100), p=Math.round(Math.abs(c)); return p<1?'var(--bg)':'color-mix(in oklab, '+(c<0?'var(--loss)':'var(--accent)')+' '+p+'%, var(--bg))'; }

  /* ---------- controls ---------- */
  (function(){
    const g1=document.createElement('optgroup'); g1.label='Seeds';
    const g2=document.createElement('optgroup'); g2.label='Other models';
    models.forEach(e=>{ const o=document.createElement('option'); o.value=e.m.id; o.textContent=e.name; (isRef(e.m.id)?g1:g2).appendChild(o); });
    if(g1.children.length) selM.appendChild(g1);
    if(g2.children.length) selM.appendChild(g2);
    selM.value=E().m.id;
  })();
  function buildPicks(){
    picks.textContent=''; pickLab.textContent=PK.lab;
    PK.rows.forEach(i=>{
      const R=E().rows[i], b=document.createElement('button');
      b.type='button'; b.textContent=rowName(E(),R,false); b.dataset.row=String(i);
      b.setAttribute('aria-label','Select '+rowName(E(),R,true));
      b.addEventListener('click',()=>{ st.cur=-1; select(i); });
      picks.appendChild(b);
    });
    updPicks();
  }
  function updPicks(){ picks.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.row===st.sel))); }

  /* ---------- overview ---------- */
  let O=null, ovG=null, underG=null, oTicks=[[],[]], baseLab=[];
  function layoutO(W){
    const m=E().m, S=m.S, kv=m.kv, narrow=W<480;
    const gL=narrow?25:30;
    const cN=narrow?Math.max(40,Math.round(W*0.14)):Math.round(clamp(W*0.19,80,124));
    const g1=narrow?10:20, g2=narrow?10:20;
    const Mw=Math.floor((W-gL-cN-g1-g2)/2);
    const rowH=kv===1?11:Math.max(2,Math.round(12/kv)), layH=kv*rowH+1;
    const top=40, rowsH=m.layers*layH-1;
    return {W:W,narrow:narrow,S:S,kv:kv,layers:m.layers,gL:gL,cN:cN,g1:g1,g2:g2,Mw:Mw,
            xN:gL,xG:gL+cN+g1,xK:gL+cN+g1+Mw+g2,rowH:rowH,layH:layH,top:top,rowsH:rowsH,cw:Mw/S,H:top+rowsH+6};
  }
  const rowY=i=>O.top+Math.floor(i/O.kv)*O.layH+(i%O.kv)*O.rowH;
  const cx0=r=>Math.round(r*O.cw);
  function rowAt(y){
    const yy=y-O.top; if(yy<-4||yy>O.rowsH+4) return -1;
    const c=clamp(yy,0,O.rowsH-1), l=clamp(Math.floor(c/O.layH),0,O.layers-1);
    const h=clamp(Math.floor((c-l*O.layH)/O.rowH),0,O.kv-1);
    return l*O.kv+h;
  }
  function phaseAt(x){
    for(const x0 of [O.xG,O.xK]) if(x>=x0-1&&x<x0+O.Mw) return clamp(Math.floor((x-x0)/O.cw),0,O.S-1);
    return -1;
  }
  function drawO(){
    const W=Math.round(over.clientWidth); if(!W) return;
    O=layoutO(W);
    const e=E(), S=O.S;
    osvg.setAttribute('viewBox','0 0 '+W+' '+O.H); osvg.setAttribute('width',W); osvg.setAttribute('height',O.H);
    osvg.textContent='';
    // column titles and ticks
    txt(osvg,O.narrow?0:O.xN,13,'eff. '+e.unit+(O.narrow?'':' (key)'),'t');
    txt(osvg,O.xG,13,st.gate==='k'?'key gate at r':'value gate at r + 1','t');
    txt(osvg,O.xK,13,'knockout at r','t');
    const ty=31, xn=v=>O.xN+(v-1)/(S-1)*O.cN;
    txt(osvg,O.xN,ty,'1',null,'start'); txt(osvg,O.xN+O.cN,ty,String(S),null,'end');
    const nStep=S<=4?1:2, gl=el('g',{'shape-rendering':'crispEdges'},osvg);
    if(!O.narrow) for(let v=2;v<S;v+=nStep){ const x=Math.round(xn(v))+0.5; el('line',{class:'gr',x1:x,x2:x,y1:O.top,y2:O.top+O.rowsH},gl); }
    if(!O.narrow&&S%2===0&&S>=8) txt(osvg,Math.round(xn(S/2))+0.5,ty,String(S/2),null,'middle');
    const need=String(S-1).length*6.4+4, step=O.cw>=need?1:(2*O.cw>=need?2:3);
    oTicks=[[],[]];
    [O.xG,O.xK].forEach((x0,j)=>{ for(let r=0;r<S;r++){ const w=cx0(r+1)-cx0(r)-1; oTicks[j][r]=r%step?null:txt(osvg,x0+cx0(r)+w/2,ty,String(r),null,'middle'); } });
    underG=el('g',{},osvg);             // row bands (hover / selection) sit under the cells
    // cells: the 1px gaps between cells show a faint tint, so the grid reads without an outer box
    const cells=el('g',{'shape-rendering':'crispEdges'},osvg);
    [O.xG,O.xK].forEach(x0=>el('rect',{class:'grid',x:x0,y:O.top,width:O.Mw-1,height:O.rowsH},cells));
    for(const R of e.rows){
      const y=rowY(R.i), h=O.rowH, gv=st.gate==='k'?R.kg:R.vg;
      for(let r=0;r<S;r++){
        const x=cx0(r), w=cx0(r+1)-x-1;
        el('rect',{x:O.xG+x,y:y,width:w,height:h},cells).style.fill=gateFill(gv[r],S);
        el('rect',{x:O.xK+x,y:y,width:w,height:h},cells).style.fill=koFill(R.ko[r]);
      }
      if(isFinite(R.nk)){
        const bw=clamp((S-R.nk)/(S-1),0,1)*O.cN;
        if(bw>=0.5) el('rect',{class:'nbar',x:O.xN+O.cN-bw,y:y,width:bw,height:h},cells);
      }
    }
    el('line',{class:'ax',x1:O.xN+O.cN+0.5,x2:O.xN+O.cN+0.5,y1:O.top-3,y2:O.top+O.rowsH+3},osvg);
    baseLab=[];
    for(let l=0;l<O.layers;l+=5){ const yc=O.top+l*O.layH+(O.layH-1)/2; baseLab.push({yc:yc,t:txt(osvg,O.gL-8,yc+3.6,'L'+l,null,'end')}); }
    ovG=el('g',{},osvg);
    drawOv(); syncKeys(); ariaO();
  }
  function activeCell(){
    if(st.hov>=0&&st.hr>=0) return [st.hov,st.hr];
    if(st.dr>=0) return [st.sel,st.dr];
    if(st.cur>=0) return [st.sel,st.cur];
    return null;
  }
  function drawOv(){
    if(!ovG||!O) return;
    ovG.textContent=''; underG.textContent='';
    const e=E();
    const mark=(i,kind)=>{
      const y=rowY(i), pad=O.kv>1?1:0;
      el('rect',{class:'band-'+kind,x:0,y:y-pad,width:O.W,height:O.rowH+2*pad},underG);
      [O.xG,O.xK].forEach(x0=>el('rect',{class:'row-'+kind,x:x0-0.5,y:y-0.5,width:O.Mw,height:O.rowH+1},ovG));
    };
    const labs=[];
    const lab=(i)=>{ const R=e.rows[i], yc=rowY(i)+O.rowH/2; labs.push(yc); txt(ovG,O.gL-8,yc+3.6,'L'+R.l,'on','end'); };
    const hv=st.hov>=0&&st.hov!==st.sel;
    if(hv) mark(st.hov,'hov');
    mark(st.sel,'sel');
    lab(st.sel);
    if(hv){ const yh=rowY(st.hov)+O.rowH/2, ys=rowY(st.sel)+O.rowH/2; if(Math.abs(yh-ys)>=12) lab(st.hov); }
    baseLab.forEach(b=>b.t.classList.toggle('off',labs.some(y=>Math.abs(y-b.yc)<14)));
    const ac=activeCell();
    oTicks.forEach(a=>a.forEach((t,r)=>{ if(t) t.classList.toggle('on',!!ac&&ac[1]===r); }));
    if(ac){
      const y=rowY(ac[0]), x=cx0(ac[1]), w=cx0(ac[1]+1)-x-1;
      [O.xG,O.xK].forEach(x0=>el('rect',{class:'cell-cur',x:x0+x-1,y:y-1,width:w+2,height:O.rowH+2},ovG));
    }
  }
  function ariaO(){
    if(!O) return;
    const e=E(); let lo=null, hi=null;
    e.rows.forEach(R=>{ if(!isFinite(R.nk)) return; if(!lo||R.nk<lo.nk) lo=R; if(!hi||R.nk>hi.nk) hi=R; });
    osvg.setAttribute('aria-label',e.name+': '+e.rows.length+' KV heads, layer 0 at the top, by '+O.S+' phases. Left, effective '+e.unit+' of each key gate, from '+
      (lo?lo.nk.toFixed(2)+' ('+rowName(e,lo,true)+')':'n/a')+' to '+(hi?hi.nk.toFixed(2):'n/a')+' of '+O.S+'. Middle, '+(st.gate==='k'?'key':'value')+
      ' gate: mean score by phase. Right, knockout effect by phase. Selected: '+rowName(e,e.rows[st.sel],true)+'.');
  }
  function syncKeys(){
    if(!O) return;
    const gt=gTop(O.S), over1=E().rows.some(R=>(st.gate==='k'?R.kg:R.vg).some(v=>v>gt+1e-9));
    smax.textContent=(over1?'≥':'')+gt+'×';
    if(O.narrow){
      keys.style.gridTemplateColumns='minmax(0,1fr)';
      gKey.style.gridColumn='1'; kKey.style.gridColumn='1';
    } else {
      keys.style.gridTemplateColumns=O.xG+'px '+O.Mw+'px '+O.g2+'px '+O.Mw+'px';
      gKey.style.gridColumn='2'; kKey.style.gridColumn='4';
    }
  }
  function oPoint(ev){ if(!O) return null; const b=osvg.getBoundingClientRect(); if(!b.width) return null; const s=O.W/b.width; return {x:(ev.clientX-b.left)*s, y:(ev.clientY-b.top)*s}; }
  const tRow=(k,v)=>'<span class="k">'+k+'</span><span>'+v+'</span>';
  function oTip(i,r){
    const e=E(), R=e.rows[i], S=O.S, gv=st.gate==='k'?R.kg:R.vg;
    let s='<b>'+rowName(e,R,true)+'</b><div class="fxg-tt">';
    s+=tRow('eff. '+e.unit,R.nk.toFixed(2)+' <span class="k">of '+S+'</span>');
    s+=tRow('key peak','r = '+R.kp+' <span class="k">·</span> '+xx(R.kg[R.kp]));
    s+=tRow('knockout at peak',pct(R.ko[R.kp]));
    if(r>=0&&r!==R.kp) s+=tRow('at r = '+r,(st.gate==='k'?'key ':'value ')+xx(gv[r])+' <span class="k">·</span> '+pct(R.ko[r]));
    return s+'</div>';
  }
  function onOMove(ev){
    const p=oPoint(ev); if(!p) return;
    const i=rowAt(p.y);
    if(i<0){ if(st.hov!==-1||st.hr!==-1){ st.hov=-1; st.hr=-1; drawOv(); drawDOv(); } hideTip(); return; }
    const r=phaseAt(p.x);
    if(i!==st.hov||r!==st.hr){ st.hov=i; st.hr=r; drawOv(); drawDOv(); }
    showTip(ev,oTip(i,r));
  }
  osvg.addEventListener('pointermove',onOMove);
  osvg.addEventListener('pointerdown',onOMove);
  osvg.addEventListener('pointerleave',()=>{ st.hov=-1; st.hr=-1; hideTip(); drawOv(); drawDOv(); });
  osvg.addEventListener('click',ev=>{ const p=oPoint(ev); if(!p) return; const i=rowAt(p.y); if(i>=0&&i!==st.sel){ st.cur=-1; select(i); } });
  over.addEventListener('keydown',ev=>{
    const e=E(), n=e.rows.length, kv=e.m.kv, S=e.m.S;
    let i=st.sel, c=st.cur;
    switch(ev.key){
      case 'ArrowUp': i=Math.max(0,i-1); break;
      case 'ArrowDown': i=Math.min(n-1,i+1); break;
      case 'PageUp': i=Math.max(0,i-(kv>1?kv:5)); break;
      case 'PageDown': i=Math.min(n-1,i+(kv>1?kv:5)); break;
      case 'Home': i=0; break;
      case 'End': i=n-1; break;
      case 'ArrowLeft': c=c<0?e.rows[i].kp:(c+S-1)%S; break;
      case 'ArrowRight': c=c<0?e.rows[i].kp:(c+1)%S; break;
      case 'Escape': if(c<0) return; c=-1; break;
      default: return;
    }
    ev.preventDefault();
    st.cur=c;
    if(i!==st.sel) select(i); else { drawOv(); drawDOv(); updStatus(); }
  });

  /* ---------- detail ---------- */
  let D=null, dOv=null, dTicks=[];
  function drawD(){
    const W=Math.round(detail.clientWidth); if(!W) return;
    const e=E(), S=e.m.S, R=e.rows[st.sel], narrow=W<480;
    const mL=narrow?36:44, mR=narrow?4:10, pw=W-mL-mR, bw=pw/S;
    const t1=24, h1=narrow?104:122, t2=t1+h1+44, h2=narrow?92:104, xl=t2+h2+18, H=xl+5;
    const gm=e.gmax, y1=v=>t1+h1*(1-clamp(v,0,gm)/gm);
    const top=clamp(Math.ceil(Math.max(20,Math.max.apply(null,R.ko))/10)*10,20,100);
    const y2=v=>t2+h2*(top-clamp(v,-100,top))/(top+100);
    const xc=r=>mL+(r+0.5)*bw;
    D={W:W,mL:mL,pw:pw,bw:bw,t1:t1,h1:h1,t2:t2,h2:h2,S:S};
    dsvg.setAttribute('viewBox','0 0 '+W+' '+H); dsvg.setAttribute('width',W); dsvg.setAttribute('height',H);
    dsvg.textContent='';
    // soft band at the key gate's peak phase, through both panels
    el('rect',{class:'peak',x:mL+R.kp*bw,y:t1-8,width:bw,height:t2+h2-t1+8},dsvg);
    // panel 1: gate profile
    txt(dsvg,0,12,'mean gate score','t');
    txt(dsvg,mL+pw,12,'relative to a uniform share',null,'end');
    const s1=gm<=5?1:2, g=el('g',{'shape-rendering':'crispEdges'},dsvg);
    for(let v=0;v<=gm;v+=s1){
      const y=Math.round(y1(v))+0.5;
      if(v===0) el('line',{class:'ax',x1:mL,x2:mL+pw,y1:y,y2:y},g); else if(v!==1) el('line',{class:'gr',x1:mL,x2:mL+pw,y1:y,y2:y},g);
      txt(dsvg,mL-8,y+3.6,String(v),null,'end');
    }
    if(s1!==1) txt(dsvg,mL-8,Math.round(y1(1))+4.1,'1',null,'end');
    const yu=Math.round(y1(1))+0.5;
    el('line',{class:'uref',x1:mL,x2:mL+pw,y1:yu,y2:yu},dsvg);
    const pts=a=>a.map((v,r)=>xc(r).toFixed(1)+','+y1(v).toFixed(1)).join(' ');
    el('polyline',{class:'vline',points:pts(R.vg)},dsvg);
    el('polyline',{class:'kline',points:pts(R.kg)},dsvg);
    R.vg.forEach((v,r)=>el('circle',{class:'vdot',cx:xc(r).toFixed(1),cy:y1(v).toFixed(1),r:4.5},dsvg));
    R.kg.forEach((v,r)=>el('circle',{class:'kdot',cx:xc(r).toFixed(1),cy:y1(v).toFixed(1),r:3.25},dsvg));
    // panel 2: knockout
    txt(dsvg,0,t2-14,'knockout','t');
    txt(dsvg,mL+pw,t2-14,'relative accuracy change',null,'end');
    const g2=el('g',{'shape-rendering':'crispEdges'},dsvg);
    [top,-50,-100].forEach(v=>{ const y=Math.round(y2(v))+0.5; el('line',{class:'gr',x1:mL,x2:mL+pw,y1:y,y2:y},g2); txt(dsvg,mL-8,y+3.6,(v>0?'+':v<0?MINUS:'')+Math.abs(v)+'%',null,'end'); });
    const bwB=Math.min(24,Math.max(5,Math.round(bw*0.46)));
    const yz=Math.round(y2(0));
    R.ko.forEach((v,r)=>{
      const y=Math.round(y2(v)), h=Math.abs(y-yz); if(h<1) return;
      el('rect',{class:v<0?'bar-l':'bar-g',x:Math.round(xc(r)-bwB/2),y:Math.min(y,yz),width:bwB,height:h},g2);
    });
    el('line',{class:'ax',x1:mL,x2:mL+pw,y1:yz+0.5,y2:yz+0.5},g2);
    txt(dsvg,mL-8,yz+4.1,'0',null,'end');
    // shared phase axis
    dTicks=[];
    for(let r=0;r<S;r++) dTicks[r]=txt(dsvg,xc(r),xl,String(r),null,'middle');
    txt(dsvg,mL-8,xl,'r',null,'end');
    dOv=el('g',{},dsvg);
    el('rect',{class:'hit',x:mL,y:0,width:pw,height:H},dsvg);
    drawDOv();
    // title + aria
    title.textContent=titleText(e,R);
    dsvg.setAttribute('aria-label',rowName(e,R,true)+'. Key gate by phase r = 0 to '+(S-1)+', relative to uniform: '+R.kg.map(v=>v.toFixed(2)).join(', ')+
      '. Value gate at r + 1: '+R.vg.map(v=>v.toFixed(2)).join(', ')+'. Knockout, relative accuracy change in percent: '+R.ko.map(v=>(v<0?MINUS:'')+Math.abs(v).toFixed(1)).join(', ')+'.');
  }
  function detailPhase(){
    if(st.dr>=0) return st.dr;
    if(st.hov===st.sel&&st.hr>=0) return st.hr;
    if(st.hov<0&&st.cur>=0) return st.cur;
    return -1;
  }
  function drawDOv(){
    if(!dOv||!D) return;
    dOv.textContent='';
    const r=detailPhase();
    dTicks.forEach((t,k)=>t.classList.toggle('on',k===r));
    if(r<0) return;
    const x=Math.round(D.mL+(r+0.5)*D.bw)+0.5;
    el('line',{class:'hair',x1:x,x2:x,y1:D.t1-8,y2:D.t2+D.h2},dOv);
  }
  function dTip(r){
    const e=E(), R=e.rows[st.sel], S=e.m.S;
    return '<b>'+rowName(e,R,true)+' · r = '+r+'</b><div class="fxg-tt">'+tRow('key gate',xx(R.kg[r]))+
      tRow('value gate',xx(R.vg[r])+' <span class="k">(phase '+((r+1)%S)+')</span>')+tRow('knockout',pct(R.ko[r]))+'</div>';
  }
  function onDMove(ev){
    if(!D) return;
    const b=dsvg.getBoundingClientRect(); if(!b.width) return;
    const x=(ev.clientX-b.left)*D.W/b.width;
    if(x<D.mL||x>D.mL+D.pw){ if(st.dr!==-1){ st.dr=-1; drawDOv(); drawOv(); } hideTip(); return; }
    const r=clamp(Math.floor((x-D.mL)/D.bw),0,D.S-1);
    if(r!==st.dr){ st.dr=r; drawDOv(); drawOv(); }
    showTip(ev,dTip(r));
  }
  dsvg.addEventListener('pointermove',onDMove);
  dsvg.addEventListener('pointerdown',onDMove);
  dsvg.addEventListener('pointerleave',()=>{ st.dr=-1; hideTip(); drawDOv(); drawOv(); });

  /* ---------- text ---------- */
  function koPhrase(R,S){
    const big=R.ko.filter(v=>v<=-20);
    if(big.length===S) return 'knockout '+pct(Math.max.apply(null,big))+' to '+pct(Math.min.apply(null,big))+' at every phase';
    const v=R.ko[R.km];
    if(v<=-1.5) return 'knockout '+pct(v)+' at r = '+R.km;
    const k=argmax(R.ko);
    if(R.ko[k]>=1.5) return 'knockout '+pct(R.ko[k])+' at r = '+k;
    return 'knockout under 2% at every phase';
  }
  function titleText(e,R){
    const pk=R.kg[R.kp];
    const g=pk<1.25?'key gate near uniform (max '+pk.toFixed(1)+'×)':'key gate peaks at r = '+R.kp+' ('+pk.toFixed(1)+'× uniform)';
    return rowName(e,R,true)+' · '+g+' · '+koPhrase(R,e.m.S);
  }
  function koList(R,S){
    const idx=[]; R.ko.forEach((v,r)=>{ if(v<=-20) idx.push(r); });
    let out;
    if(!idx.length){ const v=R.ko[R.km]; out=v<=-1.5?'largest knockout loss '+pct(v)+' at r = '+R.km:'no knockout loss above 2%'; }
    else if(idx.length>3){ const vs=idx.map(r=>R.ko[r]); out='knockout '+pct(Math.max.apply(null,vs))+' to '+pct(Math.min.apply(null,vs))+' at '+idx.length+' of '+S+' phases'; }
    else out='knockout '+idx.map(r=>pct(R.ko[r])+' at r = '+r).join(', ');
    const k=argmax(R.ko);
    if(R.ko[k]>=5) out+='; largest gain '+pct(R.ko[k])+' at r = '+k;
    return out;
  }
  function updStatus(){
    const e=E(), R=e.rows[st.sel], S=e.m.S;
    let s='<b>'+rowName(e,R,true)+'</b> · key gate: '+R.nk.toFixed(2)+' of '+S+' effective '+e.unit+' (value gate '+R.nv.toFixed(2)+') · key peak r = '+R.kp+
      ' ('+xx(R.kg[R.kp])+') · value peak r = '+R.vp+' ('+xx(R.vg[R.vp])+', value token at phase '+((R.vp+1)%S)+') · '+koList(R,S)+'.';
    if(st.cur>=0){ const r=st.cur; s+=' At r = '+r+': key '+xx(R.kg[r])+', value '+xx(R.vg[r])+', knockout '+pct(R.ko[r])+'.'; }
    status.innerHTML=s;
  }
  const coarse=!!(window.matchMedia&&matchMedia('(hover: none) and (pointer: coarse)').matches);
  function updNote(){
    const m=E().m, parts=[];
    if(m.W!==m.S) parts.push('W'+m.W+'/S'+m.S+': each phase pools '+(m.W/m.S)+' offsets');
    if(m.tied) parts.push('tied key and value gates: the value map is the key map shifted by one phase');
    parts.push(coarse?'tap a row to select a head':'click a row, or focus the map and use ↑ ↓ (head) and ← → (phase)');
    note.textContent=parts.join(' · ');
  }

  /* ---------- tooltip ---------- */
  function showTip(ev,html){
    tip.innerHTML=html; tip.classList.add('on');
    const fr=fig.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight;
    let x=ev.clientX-fr.left+14, y=ev.clientY-fr.top+16;
    if(x+tw>fr.width) x=ev.clientX-fr.left-14-tw;
    if(y+th>fr.height) y=ev.clientY-fr.top-12-th;
    tip.style.left=clamp(x,0,Math.max(0,fr.width-tw))+'px';
    tip.style.top=clamp(y,0,Math.max(0,fr.height-th))+'px';
  }
  function hideTip(){ tip.classList.remove('on'); }

  /* ---------- state changes ---------- */
  function select(i){ st.sel=i; drawOv(); drawD(); updPicks(); updStatus(); ariaO(); }
  selM.addEventListener('change',()=>{
    const k=models.findIndex(e=>e.m.id===selM.value); if(k<0) return;
    st.mi=k; st.cur=-1; st.hov=-1; st.hr=-1; st.dr=-1;
    PK=pickRows(E()); st.sel=PK.rows[0]||0;
    buildPicks(); updNote(); drawO(); drawD(); updStatus();
  });
  mapSeg.addEventListener('click',ev=>{
    const b=ev.target.closest('button[data-gate]'); if(!b||b.dataset.gate===st.gate) return;
    st.gate=b.dataset.gate;
    mapSeg.querySelectorAll('button[data-gate]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    drawO();
  });

  let lastW=0;
  function renderAll(){ lastW=Math.round(fig.clientWidth); drawO(); drawD(); }
  buildPicks(); updNote(); renderAll(); updStatus();
  if(window.ResizeObserver){
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW) renderAll(); }).observe(fig);
  }
})();

/* ---- cyc ---- */
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
