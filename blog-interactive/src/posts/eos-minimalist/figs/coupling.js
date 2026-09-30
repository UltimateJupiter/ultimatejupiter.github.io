/* Figure 5 · coupling (fx-coupling).
   Gradient descent on the n-layer scalar network L(x1…xn) = ½(1 − x1⋯xn)² (paper App. A.4, Eq. 17 with the square
   that the paper drops by typo), η = 0.2, 5000 steps, from the three initializations of the paper's Figures 16, 17
   and 20. Update: p = Π x_k, g_i = Π_{k≠i} x_k, x ← x − η(p − 1)g (all entries from the old values).
   Sharpness: top eigenvalue of the n×n Hessian H_ii = g_i², H_ij = g_i g_j − (1 − p) Π_{k≠i,j} x_k, computed with a
   cyclic Jacobi eigenvalue routine at every step. Nothing here is recorded data: every number is computed in the
   browser from the update rule. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-coupling');
  if(!fig) return;

  const NS='http://www.w3.org/2000/svg', MINUS='−', ID='fx-coupling';
  const ETA=0.2, T=5000, TC=200, FLOOR=1e-14;
  const PRESETS={
    3:{name:'3 layers', x0:[6,0.1,0.4]},
    7:{name:'7 layers', x0:[2,2.5,3,0.1,0.2,0.3,0.4]},
    4:{name:'4 layers', x0:[6,0.7,0.3,0.2]}
  };
  const $=s=>fig.querySelector(s);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const r2=v=>Math.round(v*100)/100;
  const neg=s=>s.replace(/-/g,MINUS);
  const fx=(v,n)=>neg((+v).toFixed(n));
  const WORDS={1:'one',2:'two',3:'three',4:'four',5:'five',6:'six',7:'seven'};
  const reduce=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- the model ---------- */
  // Largest eigenvalue of a symmetric n×n matrix (flat, row-major; overwritten) by cyclic Jacobi rotations.
  function topEig(A,n){
    for(let sweep=0;sweep<60;sweep++){
      let off=0, dia=0;
      for(let i=0;i<n;i++){ dia+=A[i*n+i]*A[i*n+i]; for(let j=i+1;j<n;j++) off+=A[i*n+j]*A[i*n+j]; }
      if(off<=1e-30*(dia+1e-300)) break;
      for(let p=0;p<n-1;p++) for(let q=p+1;q<n;q++){
        const apq=A[p*n+q];
        if(apq===0) continue;
        const th=(A[q*n+q]-A[p*n+p])/(2*apq);
        const t=(th>=0?1:-1)/(Math.abs(th)+Math.sqrt(th*th+1)), c=1/Math.sqrt(t*t+1), s=t*c;
        for(let k=0;k<n;k++){ const akp=A[k*n+p], akq=A[k*n+q]; A[k*n+p]=c*akp-s*akq; A[k*n+q]=s*akp+c*akq; }
        for(let k=0;k<n;k++){ const apk=A[p*n+k], aqk=A[q*n+k]; A[p*n+k]=c*apk-s*aqk; A[q*n+k]=s*apk+c*aqk; }
      }
    }
    let m=-Infinity; for(let i=0;i<n;i++) if(A[i*n+i]>m) m=A[i*n+i];
    return m;
  }
  function simulate(x0){
    const n=x0.length, X=new Float64Array((T+1)*n), L=new Float64Array(T+1), S=new Float64Array(T+1);
    const H=new Float64Array(n*n), g=new Float64Array(n);
    let x=Float64Array.from(x0);
    for(let t=0;t<=T;t++){
      X.set(x,t*n);
      let p=1; for(let k=0;k<n;k++) p*=x[k];
      for(let i=0;i<n;i++){ let q=1; for(let k=0;k<n;k++) if(k!==i) q*=x[k]; g[i]=q; }
      L[t]=0.5*(1-p)*(1-p);
      for(let i=0;i<n;i++){
        H[i*n+i]=g[i]*g[i];
        for(let j=i+1;j<n;j++){
          let q=1; for(let k=0;k<n;k++) if(k!==i&&k!==j) q*=x[k];
          H[i*n+j]=H[j*n+i]=g[i]*g[j]-(1-p)*q;
        }
      }
      S[t]=topEig(H,n);
      if(t===T) break;
      const nx=new Float64Array(n);
      for(let i=0;i<n;i++) nx[i]=x[i]-ETA*(p-1)*g[i];
      x=nx;
    }
    // distances to the last entry over the first TC steps
    const D=[];
    for(let i=0;i<n-1;i++){ const d=new Float64Array(TC+1); for(let t=0;t<=TC;t++) d[t]=Math.abs(X[t*n+i]-X[t*n+n-1]); D.push(d); }
    // summaries
    let peak=0, above=0, ups=0;
    for(let t=0;t<=T;t++){ if(S[t]>peak) peak=S[t]; if(S[t]>2/ETA) above++; if(t&&L[t]>L[t-1]) ups++; }
    const small=x0.map(v=>v<1);
    const gapAt=t=>{ let m=0; for(let i=0;i<n-1;i++) if(small[i]&&D[i][t]>m) m=D[i][t]; return m; };
    const dmax=gapAt(TC);
    let tEq=-1; for(let t=0;t<=TC;t++) if(gapAt(t)<FLOOR){ tEq=t; break; }   // first step at which they agree to 1e−14
    // colour keys: small entries by rank (opacity 100/75/55), large ones grey
    let rank=0; const key=x0.slice(0,n-1).map((v,i)=>small[i]?'s'+Math.min(2,rank++):'l');
    return {n:n, x0:x0, X:X, L:L, S:S, D:D, peak:peak, above:above, ups:ups, small:small, nsmall:small.filter(Boolean).length, dmax:dmax, tEq:tEq, key:key};
  }

  /* ---------- elements ---------- */
  const sel=$('#'+ID+'-init'), bPlay=$('.cpl-play'), bEnd=$('.cpl-end'), prog=$('.cpl-prog'), status=$('.fx-status');
  const boxA=$('[data-chart="loss"]'), boxB=$('[data-chart="sharp"]'), boxC=$('[data-chart="dist"]');
  const subA=$('[data-sub="loss"]'), subB=$('[data-sub="sharp"]'), subC=$('[data-sub="dist"]');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);

  function el(tag,attrs,parent,text){
    const e=document.createElementNS(NS,tag);
    if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]);
    if(text!=null) e.textContent=text;
    if(parent) parent.appendChild(e);
    return e;
  }
  function sub(parent,base,idx,attrs){        // "x" with a subscript index, as SVG text
    const t=el('text',attrs,parent); el('tspan',{},t,base); el('tspan',{class:'sub',dy:3},t,String(idx));
    return t;
  }

  /* ---------- number formatting (Unicode minus, no TeX) ---------- */
  function fmtE(v,d){
    if(!isFinite(v)) return '∞';
    if(v===0) return '0';
    const s=v.toExponential(d==null?1:d).split('e'), e=+s[1];
    return s[0]+'e'+(e<0?MINUS+(-e):e);
  }
  function fmtLoss(v){ return (v>=1e-3&&v<1e3)?String(+v.toPrecision(2)):fmtE(v); }
  function fmtD(v){ return v<FLOOR?'< 1e'+MINUS+'14':(v>=1e-3?String(+v.toPrecision(3)):fmtE(v)); }

  /* ---------- state ---------- */
  const st={key:'7', run:null, reveal:T, cur:null, curPanel:null, play:null, touched:false};

  /* ---------- scales ---------- */
  function niceStep(span,n){
    const raw=span/Math.max(1,n), p=Math.pow(10,Math.floor(Math.log10(raw)));
    for(const m of [1,2,2.5,5,10]) if(m*p>=raw-1e-12) return m*p;
    return 10*p;
  }
  function ticks(lo,hi,n){
    const s=niceStep(hi-lo,n), out=[];
    for(let i=Math.ceil(lo/s-1e-9);i*s<=hi+1e-9;i++) out.push(+(i*s).toFixed(10));
    return out;
  }

  /* ---------- charts ---------- */
  let A=null, B=null, C=null;
  function frame(box,m){
    const W=Math.max(180,Math.round(box.clientWidth)||260), H=W<280?196:172;
    box.textContent='';
    const svg=el('svg',{class:'fx-svg',viewBox:'0 0 '+W+' '+H,width:W,height:H,role:'img',tabindex:0},box);
    const c={svg:svg, W:W, H:H, m:m, pw:W-m.l-m.r, ph:H-m.t-m.b};
    c.g=el('g',{},svg);
    return c;
  }
  function xAxis(c,Tmax){
    c.Tm=Tmax;
    c.X=t=>c.m.l+c.pw*t/Tmax;
    const y=Math.round(c.m.t+c.ph)+.5;
    el('line',{class:'ax',x1:c.m.l,x2:c.m.l+c.pw,y1:y,y2:y},c.g);
    ticks(0,Tmax,Math.max(2,Math.floor(c.pw/52))).forEach(v=>el('text',{x:r2(c.X(v)),y:c.m.t+c.ph+14,'text-anchor':'middle'},c.g,String(v)));
    el('text',{x:c.m.l+c.pw,y:c.H-3,'text-anchor':'end'},c.g,'iteration');
  }
  function yAxisLine(c){ const x=Math.round(c.m.l)+.5; el('line',{class:'ax',x1:x,x2:x,y1:c.m.t,y2:c.m.t+c.ph},c.g); }
  function logAxis(c,lo,hi){
    c.lo=lo; c.hi=hi;
    c.Y=v=>{ const l=v>0?Math.log10(v):lo; return c.m.t+c.ph*(hi-clamp(l,lo,hi))/(hi-lo); };
    const span=hi-lo, per=c.ph/span, ds=[1,2,3,4,5,6,8,10,16].find(d=>d*per>=20)||16;
    for(let e=hi;e>=lo;e--){
      if(((e%ds)+ds)%ds) continue;               // label multiples of the stride, so 1 = 10⁰ is always a candidate
      const y=Math.round(c.m.t+c.ph*(hi-e)/span)+.5;
      if(e>lo) el('line',{class:'gr',x1:c.m.l,x2:c.m.l+c.pw,y1:y,y2:y},c.g);
      const t=el('text',{x:c.m.l-6,y:y+3.5,'text-anchor':'end'},c.g);
      if(e===0) t.textContent='1';
      else if(e===1) t.textContent='10';
      else{ el('tspan',{},t,'10'); el('tspan',{class:'sup',dy:-4.5},t,e<0?MINUS+(-e):String(e)); }
    }
    yAxisLine(c);
  }
  const M={l:40,r:14,t:8,b:32};
  function buildA(){
    const R=st.run, c=frame(boxA,M);
    let mn=Infinity, mx=0;
    for(let t=0;t<=T;t++){ const v=R.L[t]; if(v>0&&v<mn) mn=v; if(v>mx) mx=v; }
    if(!isFinite(mn)) mn=1e-16;
    let lo=Math.max(-18,Math.floor(Math.log10(mn))), hi=Math.max(lo+2,Math.ceil(Math.log10(mx)));
    logAxis(c,lo,hi); xAxis(c,T);
    c.data=el('g',{},c.svg); c.over=el('g',{},c.svg);
    A=c;
  }
  function buildB(){
    const R=st.run, c=frame(boxB,M), ym=c.ym=Math.max(20,1.05*R.peak);
    c.Y=v=>c.m.t+c.ph*(1-clamp(v,0,ym)/ym);
    ticks(0,ym,Math.max(3,Math.floor(c.ph/30))).forEach(v=>{
      const y=Math.round(c.Y(v))+.5;
      if(v>0) el('line',{class:'gr',x1:c.m.l,x2:c.m.l+c.pw,y1:y,y2:y},c.g);
      el('text',{x:c.m.l-6,y:y+3.5,'text-anchor':'end'},c.g,String(v));
    });
    yAxisLine(c); xAxis(c,T);
    c.data=el('g',{},c.svg);
    const y=Math.round(c.Y(2/ETA))+.5;
    el('line',{class:'thr',x1:c.m.l,x2:c.m.l+c.pw,y1:y,y2:y},c.svg);
    el('text',{class:'thr-lab',x:c.m.l+c.pw-2,y:y-5,'text-anchor':'end'},c.svg,'2/η');
    c.over=el('g',{},c.svg);
    B=c;
  }
  function buildC(){
    const R=st.run, c=frame(boxC,{l:M.l,r:30,t:M.t,b:M.b});
    let mn=Infinity, mx=0;
    R.D.forEach(d=>{ for(let t=0;t<=TC;t++){ const v=Math.max(FLOOR,d[t]); if(v<mn) mn=v; if(v>mx) mx=v; } });
    const lo=Math.max(-14,Math.floor(Math.log10(mn))), hi=Math.max(1,Math.ceil(Math.log10(mx)));
    logAxis(c,lo,Math.max(hi,lo+2)); xAxis(c,TC);
    c.data=el('g',{},c.svg); c.labs=el('g',{},c.svg); c.over=el('g',{},c.svg);
    C=c;
  }

  /* ---------- painting ---------- */
  // Dense series (5000 steps in ~160 px): per pixel column keep first, min, max and last, which draws the same band.
  function densePath(c,arr,n){
    let d='', col=null, f=0, lo=0, hi=0, la=0;
    const flush=()=>{ if(col==null) return; d+=(d?'L':'M')+col+' '+r2(f); if(lo!==f) d+='L'+col+' '+r2(lo); if(hi!==lo) d+='L'+col+' '+r2(hi); if(la!==hi) d+='L'+col+' '+r2(la); };
    for(let t=0;t<n;t++){
      const x=Math.round(c.X(t)*2)/2, y=c.Y(arr[t]);
      if(x!==col){ flush(); col=x; f=lo=hi=la=y; }
      else{ if(y<lo) lo=y; if(y>hi) hi=y; la=y; }
    }
    flush();
    return d;
  }
  function paintA(){ A.data.textContent=''; el('path',{class:'ln',d:densePath(A,st.run.L,st.reveal+1)},A.data); }
  function paintB(){ B.data.textContent=''; el('path',{class:'ln',d:densePath(B,st.run.S,st.reveal+1)},B.data); }
  function paintC(){
    const R=st.run, c=C, n=Math.min(TC,st.reveal)+1;
    c.data.textContent=''; c.labs.textContent='';
    // large entries underneath, the most opaque small entry on top
    const z=i=>R.key[i]==='l'?0:3-(+R.key[i][1]);
    const order=R.D.map((d,i)=>i).sort((a,b)=>z(a)-z(b));
    order.forEach(i=>{
      const d=R.D[i]; let s='';
      for(let t=0;t<n;t++) s+=(t?'L':'M')+r2(c.X(t))+' '+r2(c.Y(Math.max(FLOOR,d[t])));
      el('path',{class:'dl','data-k':R.key[i],d:s},c.data);
    });
    // direct labels at the line ends, pushed apart so they do not overlap
    const te=n-1, xe=c.X(te), gap=11;
    const L=R.D.map((d,i)=>({i:i, y0:c.Y(Math.max(FLOOR,d[te])), y:0}));
    L.sort((a,b)=>a.y0-b.y0);
    L.forEach((o,k)=>{ o.y=Math.max(o.y0,k?L[k-1].y+gap:c.m.t+4); });
    const over=L.length?L[L.length-1].y-(c.m.t+c.ph-6):0;   // keep the lowest label (with its subscript) clear of the '200' tick
    if(over>0) for(let k=L.length-1;k>=0;k--){ L[k].y-=over; if(k&&L[k-1].y>L[k].y-gap) L[k-1].y=L[k].y-gap; else break; }
    L.forEach(o=>{
      const g=el('g',{'data-k':R.key[o.i]},c.labs);
      if(Math.abs(o.y-o.y0)>3) el('line',{class:'lead',x1:r2(xe+1.5),y1:r2(o.y0),x2:r2(xe+5),y2:r2(o.y)},g);
      sub(g,'x',o.i+1,{class:'elab',x:r2(xe+6),y:r2(o.y+3.5)});
    });
  }
  function paintCursor(){
    [A,B,C].forEach(c=>{ if(c) c.over.textContent=''; });
    const t=st.cur, R=st.run; if(t==null) return;
    [[A,R.L],[B,R.S]].forEach(q=>{
      const c=q[0], x=Math.round(c.X(t))+.5;
      el('line',{class:'hair',x1:x,x2:x,y1:c.m.t,y2:c.m.t+c.ph},c.over);
      el('circle',{class:'cur',cx:r2(c.X(t)),cy:r2(c.Y(q[1][t])),r:3},c.over);
    });
    if(t<=TC){
      const x=Math.round(C.X(t))+.5;
      el('line',{class:'hair',x1:x,x2:x,y1:C.m.t,y2:C.m.t+C.ph},C.over);
      R.D.forEach((d,i)=>el('circle',{class:'cur','data-k':R.key[i],cx:r2(C.X(t)),cy:r2(C.Y(Math.max(FLOOR,d[t]))),r:2.75},C.over));
    }
  }
  function paint(){ paintA(); paintB(); paintC(); paintCursor(); syncPlay(); }
  function build(){
    buildA(); buildB(); buildC();
    wire(A); wire(B); wire(C);
    paint(); aria();
  }

  /* ---------- tooltip ---------- */
  function tipHTML(t){
    const R=st.run, n=R.n;
    let h='<b>step '+t+'</b><div class="cpl-tt"><span class="k">loss</span><span>'+fmtLoss(R.L[t])+'</span>'+
      '<span class="k">sharpness</span><span>'+fx(R.S[t],3)+'</span>';
    for(let i=0;i<n;i++) h+='<span class="k'+(R.small[i]?' s':'')+'">x<sub>'+(i+1)+'</sub></span><span>'+fx(R.X[t*n+i],4)+'</span>';
    return h+'</div>';
  }
  function placeTip(cx,cy){
    const fr=fig.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight;
    let x=cx-fr.left+14, y=cy-fr.top+16;
    if(x+tw>fr.width) x=cx-fr.left-14-tw;
    if(y+th>fr.height) y=cy-fr.top-12-th;
    tip.style.left=clamp(x,0,Math.max(0,fr.width-tw))+'px';
    tip.style.top=clamp(y,0,Math.max(0,fr.height-th))+'px';
  }
  function showCursor(t,cx,cy){ st.cur=t; paintCursor(); tip.innerHTML=tipHTML(t); tip.classList.add('on'); placeTip(cx,cy); }
  function clearCursor(){
    if(st.play) return;
    if(st.cur!=null){ st.cur=null; paintCursor(); }
    tip.classList.remove('on');
  }
  function locate(c,ev){ const b=c.svg.getBoundingClientRect(); if(!b.width) return null; const s=c.W/b.width; return [(ev.clientX-b.left)*s,(ev.clientY-b.top)*s]; }
  const maxT=c=>Math.min(st.reveal,c.Tm);

  function wire(c){
    const move=ev=>{
      if(st.play) return;
      const q=locate(c,ev); if(!q) return;
      if(q[0]<c.m.l-6||q[0]>c.m.l+c.pw+6||q[1]<0||q[1]>c.m.t+c.ph+6){ clearCursor(); return; }
      const t=clamp(Math.round((q[0]-c.m.l)/c.pw*c.Tm),0,maxT(c));
      showCursor(t,ev.clientX,ev.clientY);
    };
    c.svg.addEventListener('pointermove',move);
    c.svg.addEventListener('pointerdown',move);
    c.svg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse') clearCursor(); });
    c.svg.addEventListener('keydown',ev=>{
      if(st.play) return;
      const m=maxT(c), big=ev.shiftKey?(c.Tm>TC?250:20):(c.Tm>TC?25:1); let t=st.cur==null||st.cur>m?-1:st.cur;
      if(ev.key==='ArrowRight'||ev.key==='ArrowUp') t=t<0?0:t+big;
      else if(ev.key==='ArrowLeft'||ev.key==='ArrowDown') t=t<0?0:t-big;
      else if(ev.key==='Home') t=0; else if(ev.key==='End') t=m;
      else if(ev.key==='Escape'){ clearCursor(); return; }
      else return;
      ev.preventDefault();
      t=clamp(t,0,m);
      const b=c.svg.getBoundingClientRect(), s=b.width/c.W;
      showCursor(t,b.left+c.X(t)*s,b.top+c.m.t*s);
    });
    c.svg.addEventListener('blur',clearCursor);
  }

  /* ---------- playback: steps 0–200 take the first 40% of the time, so the merging is visible ---------- */
  const DUR=7000, P1=2800;
  const tAt=e=>e<P1?TC*e/P1:TC+(T-TC)*(e-P1)/(DUR-P1);
  const eAt=t=>t<=TC?t/TC*P1:P1+(t-TC)/(T-TC)*(DUR-P1);
  function syncPlay(){
    const playing=!!st.play, partial=st.reveal<T;
    bPlay.textContent=playing?'pause':(partial?'play':'replay');
    bPlay.setAttribute('aria-label',playing?'Pause':(partial?'Continue the run':'Replay the run from step 0'));
    bPlay.setAttribute('aria-pressed',String(playing));
    bEnd.disabled=!partial&&!playing;
    prog.textContent='step '+st.reveal+' / '+T;
  }
  function tick(){
    const p=st.play; if(!p) return;
    const r=Math.min(T,Math.floor(tAt(performance.now()-p.t0)));
    if(r!==st.reveal){ st.reveal=r; st.cur=r; paint(); }
    if(r>=T){ stopPlay(); st.cur=null; paint(); return; }
    cancelAnimationFrame(p.raf); clearTimeout(p.to);
    p.raf=requestAnimationFrame(tick); p.to=setTimeout(tick,50);   // keep going if frames stall
  }
  function stopPlay(){ const p=st.play; if(!p) return; cancelAnimationFrame(p.raf); clearTimeout(p.to); st.play=null; syncPlay(); }
  function startPlay(){
    tip.classList.remove('on');
    if(st.reveal>=T) st.reveal=0;
    st.play={t0:performance.now()-eAt(st.reveal), raf:0, to:0};
    st.cur=st.reveal; paint(); tick();
  }
  bPlay.addEventListener('click',()=>{ st.touched=true; if(st.play) stopPlay(); else startPlay(); });
  bEnd.addEventListener('click',()=>{ st.touched=true; stopPlay(); st.reveal=T; st.cur=null; paint(); });

  /* ---------- text ---------- */
  function updText(){
    const R=st.run, P=PRESETS[st.key], ns=R.nsmall, w=WORDS[ns]||String(ns);
    const merged=R.dmax<1e-3;
    let s='<b>'+P.name+'</b> from ('+P.x0.join(', ')+'), η = 0.2: the '+w+' small entries ';
    s+=R.tEq>=0?'agree to within <b>1e'+MINUS+'14</b> by step '+R.tEq+'. '
      :merged?'agree to within <b>'+fmtE(R.dmax)+'</b> by step '+TC+'. '
             :'are still up to <b>'+fmtD(R.dmax)+'</b> apart at step '+TC+'. ';
    s+='Sharpness peaks at '+fx(R.peak,1)+', and after '+T+' steps it is <b>'+fx(R.S[T],3)+'</b> (2/η = 10) with loss '+fmtLoss(R.L[T])+'.';
    status.innerHTML=s;
    subA.textContent='log scale; rose on '+R.ups+' steps';
    subB.textContent='above 2/η = 10 for '+R.above+' steps';
    subC.innerHTML='|x<sub>i</sub> '+MINUS+' x<sub>'+R.n+'</sub>|, first '+TC+' steps';
  }
  function aria(){
    const R=st.run, P=PRESETS[st.key], from=P.name+' from ('+P.x0.join(', ')+'), η = 0.2';
    A.svg.setAttribute('aria-label','Loss against iteration, log scale, '+from+'. Starts at '+fmtLoss(R.L[0])+', ends at '+fmtLoss(R.L[T])+' after '+T+' steps. Arrow keys step through iterations.');
    B.svg.setAttribute('aria-label','Sharpness against iteration with a dashed line at 2/η = 10, '+from+'. Starts at '+fx(R.S[0],2)+', peaks at '+fx(R.peak,1)+', ends at '+fx(R.S[T],3)+'. Arrow keys step through iterations.');
    C.svg.setAttribute('aria-label','Distance of each entry to the last entry x'+R.n+', log scale, first '+TC+' steps, '+from+'. At step '+TC+': '+
      R.D.map((d,i)=>'x'+(i+1)+' '+fmtD(d[TC])).join(', ')+'. Arrow keys step through iterations.');
  }

  /* ---------- state changes ---------- */
  const cache={};
  function load(k){
    stopPlay(); st.key=k; st.run=cache[k]||(cache[k]=simulate(PRESETS[k].x0));
    st.cur=null; tip.classList.remove('on');
    updText();
  }
  sel.addEventListener('change',()=>{
    const k=sel.value; if(!PRESETS[k]||k===st.key) return;
    st.touched=true; load(k);
    if(reduce){ st.reveal=T; build(); }
    else{ st.reveal=0; build(); startPlay(); }
  });
  document.addEventListener('pointerdown',ev=>{ if(st.cur!=null&&!st.play&&!fig.contains(ev.target)) clearCursor(); },true);

  // option labels: drop the spaces inside the tuple on phones so the whole start fits in the menu
  function optLabels(){
    const tight=fig.clientWidth<440;
    [...sel.options].forEach(o=>{ const P=PRESETS[o.value]; if(!P) return;
      const t=P.name+': ('+P.x0.join(tight?',':', ')+')'; if(o.textContent!==t) o.textContent=t; });
  }
  let lastW=0;
  optLabels(); load(st.key); st.reveal=T; build(); lastW=Math.round(fig.clientWidth);
  if(window.ResizeObserver){
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW){ lastW=w; optLabels(); build(); } }).observe(fig);
  }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>build());
  // play the run once when the figure first comes into view (not with reduced motion)
  if(!reduce&&window.IntersectionObserver){
    const io=new IntersectionObserver(es=>{
      if(!es.some(e=>e.isIntersecting)) return;
      io.disconnect();
      if(!st.touched&&!st.play){ st.reveal=0; startPlay(); }
    },{threshold:0.35});
    io.observe(fig);
  }
})();
