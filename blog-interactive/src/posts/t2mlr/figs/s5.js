/* Figure 4 · S5-Retrieval, generated live (fx-s5).
   Task (paper Sec 3.1, Table 15): actions a_1..a_N are permutations of {1..5} in one-line notation;
   states s_1 = a_1, s_i = s_{i-1} ∘ a_i with (s∘a)(k) = s(a(k)); a fresh dictionary D maps each of the
   120 permutations to a 4-character code; the target is a_1, D(s_1), s_2, D(s_2), ...
   Panel B: Hillis–Steele prefix scan (ceil(log2 N) levels) vs a recurrent chain. Illustration only. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-s5');
  if(!fig) return;

  const NS='http://www.w3.org/2000/svg';
  const $=id=>document.getElementById(id);
  const range=$('fx-s5-n'), nval=fig.querySelector('.s5-nval'), btnNew=$('fx-s5-new'), seedEl=$('fx-s5-seed'),
        ctx=$('fx-s5-ctx'), rowsEl=$('fx-s5-rows'), wrap=$('fx-s5-netwrap'), svg=$('fx-s5-svg'),
        read=$('fx-s5-read'), chain=$('fx-s5-chain'), status=$('fx-s5-status');
  const railA=fig.querySelector('.s5-fa'), railL=fig.querySelector('.s5-fl');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);
  const reduce=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- S5 ---------- */
  const PERMS=[];                                   // lexicographic order
  (function gen(pre,rest){
    if(!rest.length){ PERMS.push(pre); return; }
    for(let k=0;k<rest.length;k++) gen(pre+rest[k],rest.slice(0,k)+rest.slice(k+1));
  })('','12345');
  const compose=(s,a)=>a.split('').map(c=>s[+c-1]).join('');   // (s∘a)(k) = s(a(k))
  const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const NMAX=48, DEPTH=4, CAP=1<<DEPTH, TRAIN=32;

  function makeInstance(seed){
    const r=mulberry32(seed), acts=[], dict=Object.create(null), states=[];
    for(let i=0;i<NMAX;i++) acts.push(PERMS[Math.floor(r()*PERMS.length)]);
    for(const p of PERMS){ let c=''; for(let k=0;k<4;k++) c+=ALPH[Math.floor(r()*ALPH.length)]; dict[p]=c; }
    acts.forEach((a,i)=>states.push(i?compose(states[i-1],a):a));
    return {acts:acts,dict:dict,states:states};
  }
  const levelsFor=N=>{ let L=0; while((1<<L)<N) L++; return L; };   // ceil(log2 N), 0 for N = 1
  // Hillis–Steele: level j, node i (0-based) = node(i − 2^{j−1}) ∘ node(i) of level j−1 if i ≥ 2^{j−1}, else a copy.
  function scan(acts,N){
    const Lv=levelsFor(N), V=[acts.slice(0,N)], lo=[V[0].map((_,i)=>i)];
    for(let j=1;j<=Lv;j++){
      const d=1<<(j-1), pv=V[j-1], pl=lo[j-1], v=[], l=[];
      for(let i=0;i<N;i++){ if(i>=d){ v.push(compose(pv[i-d],pv[i])); l.push(pl[i-d]); } else { v.push(pv[i]); l.push(pl[i]); } }
      V.push(v); lo.push(l);
    }
    return {Lv:Lv,V:V,lo:lo};
  }

  /* ---------- text helpers ---------- */
  const aN=i=>'a<sub>'+(i+1)+'</sub>', sN=i=>'s<sub>'+(i+1)+'</sub>';   // HTML
  function rangeTxt(lo,hi){
    if(lo===hi) return aN(hi);
    if(hi===lo+1) return aN(lo)+' ∘ '+aN(hi);
    return aN(lo)+' ∘ … ∘ '+aN(hi);
  }
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const NUMW=['zero','one','two','three','four','five','six'];

  /* ---------- state ---------- */
  const st={seed:1, N:+range.value||12, sel:0, hov:-1, hl:-1, narrow:false};
  st.sel=st.N-1;
  let I=makeInstance(st.seed), S=scan(I.acts,st.N);
  const act=()=>st.hov>=0?st.hov:st.sel;

  /* ---------- slider ---------- */
  const frac=v=>(v-1)/(NMAX-1);
  fig.querySelectorAll('.s5-ticks [data-v]').forEach(e=>{
    e.style.left='calc(var(--tw) / 2 + (100% - var(--tw)) * '+frac(+e.dataset.v)+')';
    e.addEventListener('click',()=>{ setN(+e.dataset.v); range.focus(); });
  });
  fig.querySelectorAll('.s5-rail .s5-tk').forEach(e=>{ e.style.left=(100*frac(+e.dataset.v))+'%'; });
  function updSlider(){
    const N=st.N, a=Math.min(N,CAP);
    railA.style.width=(100*frac(a))+'%';
    railL.style.left=(100*frac(CAP))+'%';
    railL.style.width=N>CAP?(100*(frac(N)-frac(CAP)))+'%':'0';
    nval.textContent='N = '+N;
    nval.classList.toggle('over',N>CAP);
    range.value=String(N);
    range.setAttribute('aria-valuetext','N = '+N+(N===1?' state':' states')+', '+levelsFor(N)+' scan layers');
    fig.querySelectorAll('.s5-ticks [data-v]').forEach(e=>e.classList.toggle('on',+e.dataset.v===N));
  }

  /* ---------- panel A: context line ---------- */
  let ctxEnt=Object.create(null), ctxOn=null;
  function buildCtx(){
    ctx.textContent=''; ctxEnt=Object.create(null); ctxOn=null;
    PERMS.forEach((p,k)=>{
      if(k) ctx.appendChild(document.createTextNode(' '));
      const e=document.createElement('span'); e.className='s5-e';
      const t=document.createElement('span'); t.className='k'; t.textContent='<A_'+p+'>';
      e.appendChild(t); e.appendChild(document.createTextNode(I.dict[p]));
      ctx.appendChild(e); ctxEnt[p]=e;
    });
  }
  function updCtx(smooth){
    const e=ctxEnt[I.states[act()]];
    if(ctxOn&&ctxOn!==e) ctxOn.classList.remove('on');
    if(!e) return;
    e.classList.add('on'); ctxOn=e;
    const left=clamp(e.offsetLeft-(ctx.clientWidth-e.offsetWidth)/2,0,Math.max(0,ctx.scrollWidth-ctx.clientWidth));
    if(Math.abs(ctx.scrollLeft-left)<1){ edges(ctx); return; }
    if(smooth&&!reduce&&ctx.scrollTo) ctx.scrollTo({left:left,behavior:'smooth'}); else ctx.scrollLeft=left;
    edges(ctx);
  }

  /* ---------- panel A: rows ---------- */
  let cI=[], cA=[], cS=[], cD=[], shown=null;
  function visibleSet(){
    const N=st.N, all=[]; for(let i=0;i<N;i++) all.push(i);
    if(!(st.narrow&&N>24)) return all;
    const set=new Set();
    for(let i=0;i<8;i++) set.add(i);
    for(let i=N-8;i<N;i++) set.add(i);
    const g=Math.floor(st.sel/4)*4;
    for(let i=g;i<Math.min(N,g+4);i++) set.add(i);
    return all.filter(i=>set.has(i));
  }
  function cell(cls,txt,i,row,col,parent){
    const d=document.createElement('div'); d.className=cls; d.textContent=txt;
    d.style.gridRow=String(row); d.style.gridColumn=String(col);
    if(i>=0) d.dataset.i=String(i);
    parent.appendChild(d); return d;
  }
  function buildRows(){
    const per=st.narrow?4:8, vis=visibleSet();
    shown=new Set(vis);
    rowsEl.textContent=''; cI=[]; cA=[]; cS=[]; cD=[];
    rowsEl.style.setProperty('--s5-per',String(per));
    // contiguous segments, each chunked into groups of `per`
    const segs=[]; let cur=null;
    vis.forEach(i=>{ if(cur&&i===cur[cur.length-1]+1) cur.push(i); else { cur=[i]; segs.push(cur); } });
    let first=true;
    segs.forEach((seg,si)=>{
      if(si){
        const gap=document.createElement('div'); gap.className='s5-gap';
        const a=segs[si-1][segs[si-1].length-1]+2, b=seg[0];
        gap.textContent='⋯ states '+a+'–'+b+' not shown ⋯';
        rowsEl.appendChild(gap);
      }
      for(let k=0;k<seg.length;k+=per){
        const g=document.createElement('div'); g.className='s5-grp';
        const labs=first?['input actions','target states','retrieved']:['a','s','D(s)'];
        cell('s5-lab'+(first?'':' sh'),labs[0],-1,2,1,g);
        cell('s5-lab'+(first?'':' sh'),labs[1],-1,3,1,g);
        cell('s5-lab'+(first?'':' sh'),labs[2],-1,4,1,g);
        seg.slice(k,k+per).forEach((i,c)=>{
          cI[i]=cell('s5-ix',String(i+1),i,1,c+2,g);
          cA[i]=cell('s5-ch a',I.acts[i],i,2,c+2,g);
          cS[i]=cell('s5-ch s',I.states[i],i,3,c+2,g);
          cD[i]=cell('s5-ch d',I.dict[I.states[i]],i,4,c+2,g);
        });
        rowsEl.appendChild(g); first=false;
      }
    });
  }
  function updRows(){
    const a=act(), pick=st.hov>=0&&st.hov!==st.sel;
    for(let i=0;i<st.N;i++){
      if(!cA[i]) continue;
      cI[i].classList.toggle('on',i===a);
      cA[i].classList.toggle('in',i<=a);
      cS[i].classList.toggle('on',i===a);
      cS[i].classList.toggle('pick',pick&&i===st.sel);
      cD[i].classList.toggle('on',i===a);
    }
  }

  /* ---------- panel B: scan network ---------- */
  const LVMAX=levelsFor(NMAX), ROWH=22, TOP=18;
  let G=null, ovG=null;
  function drawNet(){
    const W=Math.round(wrap.clientWidth); if(!W) return;
    const N=st.N, Lv=S.Lv, gL=st.narrow?34:58, pr=8;
    const pw=W-gL-pr-6, step=N>1?Math.min(40,pw/(N-1)):0, x0=gL+6;
    const y0=TOP+LVMAX*ROWH, H=y0+30;
    G={W:W,H:H,N:N,Lv:Lv,x:i=>x0+i*step,y:j=>y0-j*ROWH,step:step,x0:x0,y0:y0,gL:gL};
    svg.setAttribute('viewBox','0 0 '+W+' '+H); svg.setAttribute('width',W); svg.setAttribute('height',H);
    svg.textContent='';
    const E=el('g',{},svg);
    // gutter labels (all six rows, unused ones faint) and the 4-layer limit line
    for(let j=0;j<=LVMAX;j++){
      const used=j<=Lv, over=j>DEPTH;
      const t=txt(svg,gL-10,G.y(j)+3.6,st.narrow?(j===0?'in':'L'+j):(j===0?'input':'layer '+j),'end');
      t.setAttribute('class',!used?'fa':over?'lx':'');
    }
    const yl=Math.round(G.y(DEPTH)-ROWH/2)+0.5;
    el('line',{class:'lim',x1:gL-4,x2:W-pr,y1:yl,y2:yl},svg);
    if(Lv<=DEPTH){ const lt=txt(svg,W-pr,yl-5,'4-layer limit','end'); lt.setAttribute('class','lx'); }
    svg.classList.toggle('dense',step<9);
    // edges
    for(let j=1;j<=Lv;j++){
      // long, nearly parallel edges overlap into a solid band; thin them out in proportion to their span
      const d=1<<(j-1), over=j>DEPTH, fade=Math.min(1,4/d);
      for(let i=0;i<N;i++){
        const x=G.x(i), y=G.y(j), yb=G.y(j-1);
        el('line',{class:'e cp'+(over?' x':''),x1:x,x2:x,y1:yb,y2:y},E);
        if(i>=d){ const e=el('line',{class:'e'+(over?' x':''),x1:G.x(i-d),x2:x,y1:yb,y2:y},E); if(fade<1) e.style.strokeOpacity=String(+(fade*(over?0.7:0.75)).toFixed(3)); }
      }
    }
    // nodes
    const Nd=el('g',{},svg);
    for(let j=0;j<=Lv;j++) for(let i=0;i<N;i++){
      const end=j===0||j===Lv, over=j>DEPTH;
      el('circle',{class:'n'+(end?' end':'')+(over?' x':''),cx:G.x(i),cy:G.y(j),r:step<9?(end?2:1.5):(end?2.6:2)},Nd);
    }
    ovG=el('g',{},svg);
    drawNetOv(); updRead(); ariaNet();
  }
  function cone(i){
    // nodes feeding (Lv, i): per level, a set of node indices
    const L=S.Lv, lev=[]; lev[L]=new Set([i]);
    for(let j=L;j>=1;j--){
      const d=1<<(j-1), nx=new Set();
      lev[j].forEach(k=>{ nx.add(k); if(k>=d) nx.add(k-d); });
      lev[j-1]=nx;
    }
    return lev;
  }
  function drawNetOv(){
    if(!ovG||!G) return;
    ovG.textContent='';
    const a=act(), L=S.Lv, lev=cone(a);
    // crosshair at the hovered column
    if(st.hov>=0){ const x=Math.round(G.x(st.hov))+0.5; el('line',{class:'hair',x1:x,x2:x,y1:G.y(L)-8,y2:G.y0+6},ovG); }
    for(let j=L;j>=1;j--){
      const d=1<<(j-1);
      lev[j].forEach(k=>{
        el('line',{class:'ce',x1:G.x(k),x2:G.x(k),y1:G.y(j-1),y2:G.y(j)},ovG);
        if(k>=d) el('line',{class:'ce',x1:G.x(k-d),x2:G.x(k),y1:G.y(j-1),y2:G.y(j)},ovG);
      });
    }
    for(let j=0;j<=L;j++) lev[j].forEach(k=>el('circle',{class:'cn',cx:G.x(k),cy:G.y(j),r:(j===0||j===L)?2.9:2.4},ovG));
    if(st.hov>=0&&st.hl>=0) el('circle',{class:'ring',cx:G.x(st.hov),cy:G.y(st.hl),r:5},ovG);
    // x labels: 1, N and the active state
    const yx=G.y0+19, xa=G.x(a);
    const t=txt(ovG,xa,yx,String(a+1),'middle'); t.setAttribute('class','on');
    if(a>0&&Math.abs(xa-G.x(0))>=18) txt(ovG,G.x(0),yx,'1','middle');
    if(a<G.N-1&&Math.abs(G.x(G.N-1)-xa)>=18) txt(ovG,G.x(G.N-1),yx,String(G.N),'middle');
  }
  function updRead(){
    const N=st.N, L=S.Lv, over=L>DEPTH;
    read.classList.toggle('over',over);
    const extra=over?(L-DEPTH===1?'one layer':NUMW[L-DEPTH]+' layers')+' more than a 4-layer model':'a 4-layer scan covers N ≤ '+CAP;
    read.innerHTML='<div class="s5-rbig">⌈log₂ '+N+'⌉ = '+L+'</div><div class="s5-rl">'+(L===1?'layer':'layers')+' needed</div><div class="s5-rs">'+extra+'</div>';
  }
  function ariaNet(){
    const N=st.N, L=S.Lv, a=act(), done=levelsFor(a+1);
    svg.setAttribute('aria-label','Parallel prefix scan over N = '+N+' actions in '+L+(L===1?' layer':' layers')+
      (L>DEPTH?', '+(L-DEPTH)+(L-DEPTH===1?' layer':' layers')+' beyond a 4-layer model':'')+'. State '+(a+1)+' depends on actions 1 to '+(a+1)+
      ' and is complete after layer '+done+'.');
  }
  function netPoint(ev){
    if(!G) return null; const b=svg.getBoundingClientRect(); if(!b.width) return null;
    const s=G.W/b.width; return {x:(ev.clientX-b.left)*s, y:(ev.clientY-b.top)*s};
  }
  function netTip(i,j){
    const L=S.Lv, v=S.V[j][i], lo=S.lo[j][i], full=lo===0;
    let h='<b>'+(j===0?'input '+aN(i):'layer '+j+' · node '+(i+1))+'</b><br>';
    h+='<span class="k">'+rangeTxt(lo,i)+' =</span> '+v;
    if(j>0&&full) h+='<br><span class="k">holds '+sN(i)+(j>levelsFor(i+1)?', copied up':'')+'</span>';
    else if(j>0) h+='<br><span class="k">partial product</span>';
    if(j===L) h+='<br><span class="k">'+sN(i)+' complete after layer '+levelsFor(i+1)+' · D('+sN(i)+') =</span> '+esc(I.dict[I.states[i]]);
    return h;
  }
  function onNetMove(ev){
    const p=netPoint(ev); if(!p) return;
    const N=st.N;
    const inX=p.x>=G.x0-12&&p.x<=G.x(N-1)+12;
    if(!inX||p.y<G.y(S.Lv)-14||p.y>G.y0+24){ clearHover(); return; }
    const i=N>1?clamp(Math.round((p.x-G.x0)/G.step),0,N-1):0;
    const j=clamp(Math.round((G.y0-p.y)/ROWH),0,S.Lv);
    if(i!==st.hov||j!==st.hl){ st.hov=i; st.hl=j; refreshHover(); }
    showTip(ev,netTip(i,j));
  }
  svg.addEventListener('pointermove',onNetMove);
  svg.addEventListener('pointerdown',onNetMove);
  svg.addEventListener('pointerleave',clearHover);
  svg.addEventListener('click',ev=>{ const p=netPoint(ev); if(!p||!G) return; if(st.hov>=0) select(st.hov); });

  /* ---------- chain ---------- */
  let cK=[], cR=[];
  function buildChain(){
    chain.textContent=''; cK=[]; cR=[];
    for(let i=0;i<st.N;i++){
      if(i){
        const r=document.createElement('span'); r.className='s5-ar'; r.dataset.i=String(i);
        const s=document.createElement('small'); s.innerHTML='∘'+aN(i);
        r.appendChild(s); r.appendChild(document.createTextNode('→'));
        chain.appendChild(r); cR[i]=r;
      }
      const k=document.createElement('span'); k.className='s5-k'; k.dataset.i=String(i);
      const s=document.createElement('small'); s.innerHTML=sN(i);
      const v=document.createElement('span'); v.className='v'; v.textContent=I.states[i];
      k.appendChild(s); k.appendChild(v);
      chain.appendChild(k); cK[i]=k;
    }
  }
  function updChain(smooth){
    const a=act();
    for(let i=0;i<st.N;i++){
      cK[i].classList.toggle('on',i===a);
      cK[i].classList.toggle('in',i<a);
      if(cR[i]) cR[i].classList.toggle('in',i<=a);
    }
    edges(chain);
    const e=cK[a]; if(!e) return;
    const max=Math.max(0,chain.scrollWidth-chain.clientWidth); if(!max) return;
    const lo=chain.scrollLeft, vis=e.offsetLeft>=lo+8&&e.offsetLeft+e.offsetWidth<=lo+chain.clientWidth-8;
    if(vis) return;
    const left=clamp(e.offsetLeft-(chain.clientWidth-e.offsetWidth)/2,0,max);
    if(smooth&&!reduce&&chain.scrollTo) chain.scrollTo({left:left,behavior:'smooth'}); else chain.scrollLeft=left;
    edges(chain);
  }

  /* edge fades: mark which side of a horizontal scroller hides content (CSS masks that side only) */
  function edges(sc){
    const m=sc.scrollWidth-sc.clientWidth;
    sc.classList.toggle('s5-mL',m>1&&sc.scrollLeft>1);
    sc.classList.toggle('s5-mR',m>1&&sc.scrollLeft<m-1);
  }
  [ctx,chain].forEach(sc=>sc.addEventListener('scroll',()=>edges(sc),{passive:true}));

  /* ---------- chip hover / click (rows and chain) ---------- */
  function chipTip(i){
    const s=I.states[i], d=I.dict[s];
    let h='<b>state '+(i+1)+'</b><br>';
    if(i===0) h+='<span class="k">'+sN(0)+' = '+aN(0)+' =</span> '+s;
    else h+='<span class="k">'+sN(i)+' = '+sN(i-1)+' ∘ '+aN(i)+' =</span> '+I.states[i-1]+' ∘ '+I.acts[i]+' = '+s;
    h+='<br><span class="k">retrieves</span> &lt;A_'+s+'&gt;'+esc(d);
    return h;
  }
  function wireChips(host){
    const pick=ev=>{ const t=ev.target.closest&&ev.target.closest('[data-i]'); return t&&host.contains(t)?+t.dataset.i:-1; };
    const move=ev=>{
      const i=pick(ev);
      if(i<0){ if(st.hov>=0){ st.hov=-1; st.hl=-1; refreshHover(); } hideTip(); return; }
      if(i!==st.hov){ st.hov=i; st.hl=-1; refreshHover(); }
      showTip(ev,chipTip(i));
    };
    host.addEventListener('pointermove',move);
    host.addEventListener('pointerdown',move);
    host.addEventListener('pointerleave',clearHover);
    host.addEventListener('click',ev=>{ const i=pick(ev); if(i>=0) select(i); });
  }
  wireChips(rowsEl); wireChips(chain);

  /* ---------- keyboard ---------- */
  function onKey(ev){
    let i=st.sel;
    switch(ev.key){
      case 'ArrowLeft': i=Math.max(0,i-1); break;
      case 'ArrowRight': i=Math.min(st.N-1,i+1); break;
      case 'Home': i=0; break;
      case 'End': i=st.N-1; break;
      default: return;
    }
    ev.preventDefault();
    st.hov=-1; st.hl=-1; hideTip();
    select(i);
  }
  rowsEl.addEventListener('keydown',onKey);
  wrap.addEventListener('keydown',onKey);
  chain.addEventListener('keydown',onKey);

  /* ---------- status ---------- */
  function updStatus(){
    const N=st.N, L=S.Lv, i=st.sel, s=I.states[i], d=I.dict[s];
    let h='<b>N = '+N+'</b> '+(N===1?'state':'states')+': ';
    if(N===1) h+='a single state needs no composition. ';
    else {
      h+='a parallel scan needs <b>'+L+'</b> '+(L===1?'layer':'layers')+', ';
      if(L<DEPTH) h+='within the 4-layer models in the paper. ';
      else if(L===DEPTH) h+='exactly the depth of the 4-layer models in the paper. ';
      else h+=NUMW[L-DEPTH]+' more than the 4-layer models in the paper. ';
    }
    if(i===0) h+='State 1 = a<sub>1</sub> = <b>'+s+'</b> and retrieves “<b>'+esc(d)+'</b>”.';
    else h+='State '+(i+1)+' = <b>'+s+'</b> composes a<sub>1</sub>…a<sub>'+(i+1)+'</sub> and retrieves “<b>'+esc(d)+'</b>”.';
    if(N>TRAIN) h+=' N is above the longest training length (32).';
    status.innerHTML=h;
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

  /* ---------- svg helpers ---------- */
  function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function txt(parent,x,y,s,anchor){ const t=el('text',{x:x,y:y},parent); if(anchor) t.setAttribute('text-anchor',anchor); t.textContent=s; return t; }

  /* ---------- state changes ---------- */
  function refreshHover(){ updRows(); drawNetOv(); updChain(false); updCtx(false); }
  function clearHover(){ hideTip(); if(st.hov<0&&st.hl<0) return; st.hov=-1; st.hl=-1; refreshHover(); }
  function select(i){
    st.sel=clamp(i,0,st.N-1);
    if(shown&&!shown.has(st.sel)) buildRows();
    updRows(); drawNetOv(); updChain(true); updCtx(true); updStatus(); ariaNet();
  }
  function setN(N){
    N=clamp(Math.round(N),1,NMAX); if(N===st.N) return;
    const wasEnd=st.sel===st.N-1;
    st.N=N; st.sel=wasEnd?N-1:Math.min(st.sel,N-1); st.hov=-1; st.hl=-1; hideTip();
    S=scan(I.acts,N);
    updSlider(); buildRows(); buildChain(); drawNet(); updRows(); updChain(false); updCtx(false); updStatus();
  }
  function newInstance(){
    st.seed+=1; seedEl.textContent='seed '+st.seed; st.hov=-1; st.hl=-1; hideTip();
    I=makeInstance(st.seed); S=scan(I.acts,st.N);
    buildCtx(); buildRows(); buildChain(); drawNet(); updRows(); updChain(false); updCtx(false); updStatus();
  }
  range.addEventListener('input',()=>setN(+range.value));
  range.addEventListener('change',()=>setN(+range.value));
  btnNew.addEventListener('click',newInstance);

  let lastW=0;
  function layout(){
    const W=Math.round(fig.clientWidth); if(!W) return;
    lastW=W;
    const nar=W<480, changed=nar!==st.narrow;
    st.narrow=nar; fig.classList.toggle('s5-narrow',nar);
    if(changed||!cA.length) buildRows();
    drawNet(); updRows(); updChain(false); updCtx(false);
  }
  buildCtx(); updSlider(); buildChain(); layout(); updStatus();
  if(window.ResizeObserver){
    let raf=0;
    new ResizeObserver(()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; const w=Math.round(fig.clientWidth); if(w&&w!==lastW) layout(); }); }).observe(fig);
  }
})();
