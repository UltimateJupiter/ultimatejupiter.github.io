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
