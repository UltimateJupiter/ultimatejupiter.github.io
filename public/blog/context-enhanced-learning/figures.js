/* data figures, bundled from figs/*.js by build.py */
/* ---- mlt-task ---- */
/* Figure 1 · the multi-level translation task MLT(d, n), computed live.
   Paper example: App. I, Figure 16 of the paper (d = 5, n = 8, L = 28). Each level: circular shift left by one
   (s~_i[j] = s_i[(j+1) mod L]), then translate consecutive pairs with the phrasebook pi_i.
   Selecting an output pair of s_{k+1} highlights its backward dependency cone down to s_1. */
(function () {
  'use strict';
  const fig = document.getElementById('fx-mlt-task');
  if (!fig) return;

  const NS = 'http://www.w3.org/2000/svg';
  const D = 5, N = 8, L = 28, P = L / 2;
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const ALPHA = ['ABCDEFGH', 'IJKLMNOP', 'QRSTUVWX', 'YZabcdef', 'ghijklmn', 'opqrstuv'].map(function (s) { return s.split(''); });

  /* ---------- the paper's example (App. I, Figure 16), verbatim ---------- */
  const PAPER = {
    s1: 'C B E F E B D E C B C A H E F B C A D F G B D G H E D E',
    books: [
      'D A -> N J; A D -> J I; B C -> O I; C C -> N N; H E -> P K; F E -> M L; G H -> L N; E G -> P J; A F -> K M; E C -> K P; B E -> K I; F D -> M N; E D -> P O; B A -> P L; B D -> I P; D G -> I I; D H -> I O; E F -> L M; H B -> J K; E A -> K J; A H -> L J; G C -> I K; F B -> P I; F G -> J O',
      'L P -> V X; M K -> R W; L I -> X R; N O -> R R; M O -> U Q; I L -> W V; O K -> Q W; P M -> R U; J I -> V S; I M -> X W; O I -> Q U; N P -> R Q; I N -> Q X; N L -> R S; I J -> Q T; N J -> S T; L O -> U V; P J -> T X; J L -> Q R; P K -> W R; N M -> S U; M I -> Q S; P O -> S S; K K -> U U; P L -> X U',
      'X U -> Y d; R W -> a c; T Q -> Y Y; U R -> Z Y; T X -> e d; W W -> e Y; U X -> f f; X R -> b Y; Q Q -> b c; S S -> c c; V U -> Z d; R S -> f a; V W -> Y e; R U -> f c; U S -> c a; U W -> c f; W X -> d Y; R Q -> c Z; V Q -> Z f; W S -> b d; V R -> a a; R X -> f Z; U Q -> d c; Q V -> d Z; S W -> Y b',
      'c a -> m j; b Y -> n k; c f -> k m; c b -> l n; Z d -> g h; d c -> n g; b f -> i k; f Z -> i i; Z Y -> g l; Y a -> l l; b e -> l i; Y Y -> m g; d Z -> g g; d e -> k l; f c -> j g; f f -> k n; b Z -> n h; e a -> i m; c e -> j h; Y d -> i h; Y b -> h i; Y f -> h k; a Y -> k j; a a -> m k; c Y -> h m',
      'k g -> p s; h h -> r q; j m -> o o; i h -> q s; l m -> p o; i j -> o q; l j -> q u; k m -> v u; g h -> p p; g n -> v p; n h -> s s; m m -> s o; m k -> v t; m i -> u t; h k -> t o; n k -> r u; j n -> t u; g l -> t s; j g -> v v; h g -> u s; n l -> s u; l k -> q o; h l -> t p; i i -> p q; k i -> r o; l h -> u p'
    ],
    // s2..s6 as printed in Figure 16; used only as a self-test of the computation below.
    expect: [
      'K I M L I P K P O I L J L M O I J I J O I P L N P O K P',
      'X W X R W R S S W V Q R U Q Q T Q T Q U X U R Q Q W W R',
      'd Y a c f a Y b Z f f c b c Y Y Y Y f f Z Y b c e Y f Z',
      'l l k m k j n h k n l n h m m g h k i i h i j h h k g h',
      'q o v t t u t o s u s s s o p p r o q s o q r q p s t p'
    ]
  };

  function parseBook(txt) {
    const m = new Map();
    txt.split(';').forEach(function (r) {
      const lr = r.split('->');
      m.set(lr[0].trim().split(/\s+/).join(' '), lr[1].trim().split(/\s+/));
    });
    return m;
  }
  // One level: circular shift left by one, then translate pairs with the phrasebook.
  function level(s, book) {
    const sh = [], out = [];
    for (let j = 0; j < L; j++) sh.push(s[(j + 1) % L]);
    for (let t = 0; t < P; t++) {
      const img = book.get(sh[2 * t] + ' ' + sh[2 * t + 1]);
      if (!img) throw new Error('mlt-task: no rule for ' + sh[2 * t] + ' ' + sh[2 * t + 1]);
      out.push(img[0], img[1]);
    }
    return { sh: sh, out: out };
  }
  function run(s1, books) {
    const rows = [s1], sh = [];
    for (let i = 0; i < D; i++) {
      const r = level(rows[i], books[i]);
      sh.push(r.sh);
      rows.push(r.out);
    }
    return { rows: rows, sh: sh, books: books };
  }
  function paperInstance() {
    const inst = run(PAPER.s1.split(' '), PAPER.books.map(parseBook));
    PAPER.expect.forEach(function (e, i) {
      if (inst.rows[i + 1].join(' ') !== e) console.error('mlt-task: computed s' + (i + 2) + ' differs from the paper');
    });
    return inst;
  }
  // Random instance: each pi_i a uniform bijection A_i x A_i -> A_{i+1} x A_{i+1}; s1 uniform of length L.
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function randomInstance(seed) {
    const rnd = mulberry32(seed * 2654435761 >>> 0);
    const books = [];
    for (let i = 0; i < D; i++) {
      const A = ALPHA[i], B = ALPHA[i + 1], tgt = [];
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) tgt.push([B[a], B[b]]);
      for (let j = tgt.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); const x = tgt[j]; tgt[j] = tgt[k]; tgt[k] = x; }
      const m = new Map();
      let q = 0;
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) m.set(A[a] + ' ' + A[b], tgt[q++]);
      books.push(m);
    }
    const s1 = [];
    for (let j = 0; j < L; j++) s1.push(ALPHA[0][Math.floor(rnd() * N)]);
    return run(s1, books);
  }

  /* ---------- state ---------- */
  const st = { mode: 'paper', seed: 1, k: 5, shift: true, t: 2 };
  const paper = paperInstance();
  let inst = paper;

  const $ = function (s) { return fig.querySelector(s); };
  const svg = $('#fx-mlt-task-svg'), hit = $('#fx-mlt-task-hit'), block = $('.fx-mlt-task-block');
  const rlist = $('#fx-mlt-task-rlist'), status = $('#fx-mlt-task-status');
  const segInst = $('#fx-mlt-task-inst'), segDepth = $('#fx-mlt-task-depth');
  const btnNew = $('#fx-mlt-task-new'), btnShift = $('#fx-mlt-task-shift');

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
  function sub(i) { return String(i).split('').map(function (c) { return SUB[+c]; }).join(''); }
  function mod(a, m) { return ((a % m) + m) % m; }

  /* ---------- dependency cone ---------- */
  // For output pair t of s_{k+1}: per level i (1..k), the pairs of s~_i in the cone (cyclic order from t),
  // the positions of s~_i and of s_i in the cone.
  function cone(k, t) {
    const lv = [];
    let cur = [2 * t, 2 * t + 1];                    // positions of s_{i+1}
    for (let i = k; i >= 1; i--) {
      const set = {};
      cur.forEach(function (p) { set[p >> 1] = 1; });
      const pairs = Object.keys(set).map(Number).sort(function (a, b) { return mod(a - t, P) - mod(b - t, P); });
      const tl = [];
      pairs.forEach(function (q) { tl.push(2 * q, 2 * q + 1); });
      const si = tl.map(function (p) { return (p + 1) % L; });
      lv[i] = { pairs: pairs, tl: tl, s: si };
      cur = si;
    }
    return lv;
  }
  // 1-based description of a cyclic run of s1 positions starting at `start` (0-based), length len.
  function runText(start, len) {
    const a = start + 1, b = start + len;
    if (b <= L) return a + '–' + b;
    const w = b - L;
    const first = a === L ? String(L) : a + '–' + L;
    return first + ' and ' + (w === 1 ? '1' : '1–' + w);
  }

  /* ---------- layout ---------- */
  let G = null;     // geometry + element handles for the current layout
  function rowList() {
    const rows = [];
    for (let i = 1; i <= st.k + 1; i++) {
      rows.push({ kind: 's', i: i });
      if (i <= st.k && st.shift) rows.push({ kind: 't', i: i });
    }
    return rows;
  }
  function layout() {
    const W = Math.max(240, Math.round(block.clientWidth));
    const wide = W >= 480;
    const LB = wide ? 28 : 24, gp = wide ? 3 : 1, RH = wide ? 18 : 15;
    const gapShift = wide ? 16 : 13, gapTr = wide ? 9 : 8, gapBoth = wide ? 20 : 16;
    const cw = (W - LB - (P - 1) * gp) / L;
    const x0 = [], cx = [];
    for (let c = 0; c < L; c++) { x0.push(LB + c * cw + (c >> 1) * gp); cx.push(x0[c] + cw / 2); }
    const rows = rowList();
    let y = 1;
    rows.forEach(function (r, j) {
      r.y = y;
      const nx = rows[j + 1];
      if (nx) y += RH + (r.kind === 't' ? gapTr : nx.kind === 't' ? gapShift : gapBoth);
    });
    const H = Math.ceil(y + RH + 1);
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.classList.toggle('narrow', !wide);

    const gBand = el('g', null, svg), gBg = el('g', null, svg), gTx = el('g', null, svg), gFg = el('g', null, svg);
    const cells = {};
    rows.forEach(function (r) {
      const seq = r.kind === 's' ? inst.rows[r.i - 1] : inst.sh[r.i - 1];
      const key = r.kind + r.i;
      if (!(r.kind === 's' && r.i === 1)) {
        for (let q = 0; q < P; q += 2) el('rect', { class: 'band', x: (x0[2 * q] - gp / 2).toFixed(2), y: r.y, width: (2 * cw + gp).toFixed(2), height: RH }, gBand);
      }
      const lab = el('text', { class: 'lb', x: 0, y: (r.y + RH / 2).toFixed(2), dy: '0.35em' }, gTx);
      lab.textContent = r.kind === 's' ? 's' : 's̃';
      const ts = el('tspan', { dy: '0.3em', 'font-size': '8.5px' }, lab);
      ts.textContent = String(r.i);
      const arr = [];
      for (let c = 0; c < L; c++) {
        const t = el('text', { class: 'ch', x: cx[c].toFixed(2), y: (r.y + RH / 2).toFixed(2), dy: '0.35em' }, gTx);
        t.textContent = seq[c];
        arr.push(t);
      }
      cells[key] = arr;
    });
    G = { W: W, H: H, LB: LB, gp: gp, RH: RH, cw: cw, x0: x0, cx: cx, rows: rows, cells: cells, gBg: gBg, gFg: gFg };

    // Output-pair buttons over the bottom row (roving tabindex).
    hit.textContent = '';
    const last = rows[rows.length - 1], outRow = inst.rows[st.k];
    G.btns = [];
    for (let t = 0; t < P; t++) {
      const b = h('button');
      b.type = 'button';
      b.dataset.t = t;
      b.setAttribute('aria-label', 'output pair ' + (t + 1) + ': ' + outRow[2 * t] + ' ' + outRow[2 * t + 1]);
      b.style.left = (x0[2 * t] - gp / 2).toFixed(2) + 'px';
      b.style.width = (2 * cw + gp).toFixed(2) + 'px';
      b.style.top = (last.y - 3) + 'px';
      b.style.height = (RH + 6) + 'px';
      hit.appendChild(b);
      G.btns.push(b);
    }
    select(st.t, false);
  }

  /* ---------- selection ---------- */
  function rowByKey(kind, i) {
    for (let j = 0; j < G.rows.length; j++) if (G.rows[j].kind === kind && G.rows[j].i === i) return G.rows[j];
    return null;
  }
  function select(t, focus) {
    st.t = mod(t, P);
    t = st.t;
    const k = st.k, lv = cone(k, t), g = G;
    g.gBg.textContent = '';
    g.gFg.textContent = '';
    // Cone membership per row.
    const on = {};
    on['s' + (k + 1)] = [2 * t, 2 * t + 1];
    for (let i = 1; i <= k; i++) { on['t' + i] = lv[i].tl; on['s' + i] = lv[i].s; }
    g.rows.forEach(function (r) {
      const key = r.kind + r.i, set = {};
      (on[key] || []).forEach(function (p) { set[p] = 1; });
      g.cells[key].forEach(function (e, c) {
        const inC = !!set[c];
        e.classList.toggle('on', inC);
        e.classList.toggle('dim', !inC);
        if (inC) el('rect', { class: 'bg', x: g.x0[c].toFixed(2), y: r.y + 1, width: g.cw.toFixed(2), height: g.RH - 2 }, g.gBg);
      });
    });
    // Connectors.
    let d = '', dw = '';
    const step = g.cx[1] - g.cx[0] + g.gp / 2;
    for (let i = 1; i <= k; i++) {
      const A = rowByKey('s', i), B = st.shift ? rowByKey('t', i) : rowByKey('s', i + 1);
      const ya = A.y + g.RH + 1.5, yb = B.y - 1.5, mid = (ya + yb) / 2;
      lv[i].tl.forEach(function (p) {
        const src = (p + 1) % L;
        if (p === L - 1) {   // wrap: position 0 of s_i goes to the last position
          dw += 'M' + g.cx[0].toFixed(2) + ' ' + ya.toFixed(2) + 'L' + (g.cx[0] - step * 0.6).toFixed(2) + ' ' + mid.toFixed(2);
          dw += 'M' + (g.cx[L - 1] + step * 0.6).toFixed(2) + ' ' + mid.toFixed(2) + 'L' + g.cx[L - 1].toFixed(2) + ' ' + yb.toFixed(2);
        } else {
          d += 'M' + g.cx[src].toFixed(2) + ' ' + ya.toFixed(2) + 'L' + g.cx[p].toFixed(2) + ' ' + yb.toFixed(2);
        }
      });
      if (st.shift) {
        const C = rowByKey('s', i + 1), y1 = B.y + g.RH + 1.5, y2 = C.y - 1.5;
        lv[i].pairs.forEach(function (q) {
          const xm = ((g.x0[2 * q] + g.x0[2 * q + 1] + g.cw) / 2).toFixed(2);
          d += 'M' + xm + ' ' + y1.toFixed(2) + 'V' + y2.toFixed(2);
        });
      }
    }
    if (d) el('path', { class: 'cn', d: d }, g.gFg);
    if (dw) el('path', { class: 'cn wrap', d: dw }, g.gFg);
    const last = g.rows[g.rows.length - 1];
    el('rect', { class: 'sel', x: (g.x0[2 * t] - 1.5).toFixed(2), y: last.y - 0.5, width: (2 * g.cw + 3).toFixed(2), height: g.RH + 1 }, g.gFg);

    g.btns.forEach(function (b, j) {
      b.tabIndex = j === t ? 0 : -1;
      b.setAttribute('aria-pressed', String(j === t));
    });
    if (focus) g.btns[t].focus();
    rules(lv);
    announce(lv);
  }

  function rules(lv) {
    rlist.textContent = '';
    for (let i = 1; i <= st.k; i++) {
      const ln = h('div', 'ln');
      ln.appendChild(h('span', 'lv', 'π' + sub(i)));
      const rs = h('span', 'rs');
      const seen = new Map(), order = [];
      lv[i].pairs.forEach(function (q) {
        const a = inst.sh[i - 1][2 * q] + ' ' + inst.sh[i - 1][2 * q + 1];
        const b = inst.rows[i][2 * q] + ' ' + inst.rows[i][2 * q + 1];
        const key = a + '|' + b;
        if (seen.has(key)) seen.set(key, seen.get(key) + 1);
        else { seen.set(key, 1); order.push([a, b, key]); }
      });
      order.forEach(function (r, j) {
        if (j) rs.appendChild(h('span', 'sep', '·'));
        const s = h('span', 'r');
        s.append(r[0], h('span', 'a', ' → '), r[1]);
        const n = seen.get(r[2]);
        if (n > 1) s.appendChild(h('span', 'x', ' ×' + n));
        rs.appendChild(s);
      });
      ln.appendChild(rs);
      rlist.appendChild(ln);
    }
  }

  function announce(lv) {
    const k = st.k, t = st.t, out = inst.rows[k];
    const chars = runText(2 * t + 1, 2 * k), apps = k * (k + 1) / 2;
    let distinct = 0;
    for (let i = 1; i <= k; i++) {
      const seen = {};
      lv[i].pairs.forEach(function (q) { seen[inst.sh[i - 1][2 * q] + inst.sh[i - 1][2 * q + 1]] = 1; });
      distinct += Object.keys(seen).length;
    }
    const pairTxt = '“' + out[2 * t] + ' ' + out[2 * t + 1] + '”';
    status.textContent = '';
    status.append('Output pair ' + (t + 1) + ' of s' + sub(k + 1) + ' = ', h('b', null, pairTxt),
      ' depends on s₁ characters ', h('b', null, chars), ' (2d = ' + 2 * k + ' of ' + L + ', d = ' + k + ') through d(d+1)/2 = ',
      h('b', null, String(apps)), ' rule applications' + (distinct < apps ? ', ' + distinct + ' of them distinct.' : '.'));
    svg.setAttribute('aria-label', 'Multi-level translation, ' + (st.mode === 'paper' ? "the paper's example" : 'random instance ' + st.seed) +
      ', depth ' + k + ': rows s1 to s' + (k + 1) + (st.shift ? ' with the shifted rows' : '') + '. Selected output pair ' + (t + 1) +
      ' of s' + (k + 1) + ', ' + out[2 * t] + ' ' + out[2 * t + 1] + ', depends on characters ' + chars + ' of s1, ' +
      s1Text(2 * t + 1, 2 * k) + ', through ' + apps + ' rule applications.');
  }
  function s1Text(start, len) {
    const s = [];
    for (let j = 0; j < len; j++) s.push(inst.rows[0][(start + j) % L]);
    return s.join(' ');
  }

  /* ---------- controls ---------- */
  function syncControls() {
    segInst.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === st.mode)); });
    segDepth.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.v === st.k)); });
    btnNew.disabled = st.mode !== 'random';
    btnShift.setAttribute('aria-pressed', String(st.shift));
  }
  segInst.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b || b.dataset.v === st.mode) return;
    st.mode = b.dataset.v;
    inst = st.mode === 'paper' ? paper : randomInstance(st.seed);
    syncControls();
    layout();
  });
  btnNew.addEventListener('click', function () {
    if (st.mode !== 'random') return;
    st.seed += 1;
    inst = randomInstance(st.seed);
    layout();
  });
  segDepth.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b || +b.dataset.v === st.k) return;
    st.k = +b.dataset.v;
    syncControls();
    layout();
  });
  btnShift.addEventListener('click', function () {
    st.shift = !st.shift;
    syncControls();
    layout();
  });

  // Output pairs: hover, tap, focus or arrow keys select.
  function tOf(e) { const b = e.target.closest && e.target.closest('button'); return b && b.dataset.t != null ? +b.dataset.t : null; }
  hit.addEventListener('pointermove', function (e) { const t = tOf(e); if (t != null && t !== st.t) select(t, false); });
  hit.addEventListener('pointerdown', function (e) { const t = tOf(e); if (t != null && t !== st.t) select(t, false); });
  hit.addEventListener('focusin', function (e) { const t = tOf(e); if (t != null && t !== st.t) select(t, false); });
  hit.addEventListener('click', function (e) { const t = tOf(e); if (t != null && t !== st.t) select(t, false); });
  hit.addEventListener('keydown', function (e) {
    let t = st.t;
    switch (e.key) {
      case 'ArrowLeft': t -= 1; break;
      case 'ArrowRight': t += 1; break;
      case 'Home': t = 0; break;
      case 'End': t = P - 1; break;
      default: return;
    }
    e.preventDefault();
    select(t, true);
  });

  syncControls();
  layout();

  let lastW = block.clientWidth, raf = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      const w = block.clientWidth;
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        const f = document.activeElement && hit.contains(document.activeElement);
        layout();
        if (f) G.btns[st.t].focus();
      });
    }).observe(block);
  }
})();

/* ---- sample-efficiency ---- */
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

/* ---- surr-train ---- */
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

/* ---- grad-acc ---- */
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

/* ---- recovery ---- */
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
