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
