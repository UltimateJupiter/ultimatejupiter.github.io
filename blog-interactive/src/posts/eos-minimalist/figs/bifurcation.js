/* Figure 4 · bifurcation of the two-step map (fx-bifurcation). Live computation, nothing precomputed offline.
   Map (paper Sec. 5, from the two-step approximation of Eq. 7, b'' ≈ b + 8abκ − 16b³), with a held fixed:
       b ← b (1 + 8aκ − 16b²),   κ = √η = 0.1.
   Diagram: 500 equally spaced a in [−0.5, 2.6]; from b = 0.05, 600 burn-in iterations, then the next 100 values and
   their negatives (the map is odd and gradient descent flips the sign of b every step). |b| > 10 counts as escaped.
   GD overlay: degree-4 gradient descent on ¼(1 − x²y²)² (paper Eq. 2) with η = 0.01 from (12.5, 0.05) (paper Fig. 6b),
       x' = x − η x y² (x²y² − 1),  y' = y − η x² y (x²y² − 1),
   each iterate mapped to a = √(x² − y²) − ĉ, b = xy − 1 with ĉ = (η⁻² − 4)^{1/4} (paper Def. 2 / Eq. 5).
   150000 steps; drawn every step while a > 1, then two consecutive steps out of every 20 (so both signs of b stay).
   Regime of the map at a (our derivation, s = 8aκ): 0 for −2 < s < 0, ±√s/4 for 0 < s ≤ 1, cycles/chaos for
   1 < s ≤ 2, escape beyond; the status counts distinct values among 64 iterates after 20000 burn-in steps. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-bifurcation');
  if(!fig) return;

  const NS='http://www.w3.org/2000/svg';
  const ETA=0.01, K=0.1, CH=Math.pow(1/(ETA*ETA)-4,0.25);
  const AMIN=-0.5, AMAX=2.6, ASTEP=0.005, BMIN=-0.95, BMAX=0.55, NA=500, BURN=600, KEEP=100, B0=0.05, ESC=10;
  const NORB=80, NTR=20, LBURN=20000, LKEEP=64, LTOL=1e-6, PMAX=32, GDN=150000, X0=12.5, Y0=0.05, SPEED=0.31;
  const $=id=>document.getElementById(id);
  const range=$('fx-bifurcation-a'), aval=$('fx-bifurcation-aval'), bPlay=$('fx-bifurcation-play'), bGD=$('fx-bifurcation-gd'),
        panels=$('fx-bifurcation-panels'), plot=$('fx-bifurcation-plot'), cvs=$('fx-bifurcation-cvs'), svg=$('fx-bifurcation-svg'),
        oplot=$('fx-bifurcation-oplot'), osvg=$('fx-bifurcation-osvg'), status=$('fx-bifurcation-status');
  const gdLeg=fig.querySelector('.bif-li-gd');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);
  const probe=document.createElement('span'); probe.className='bif-probe'; probe.setAttribute('aria-hidden','true'); fig.appendChild(probe);
  const coarse=!!(window.matchMedia&&matchMedia('(hover: none) and (pointer: coarse)').matches);

  /* ---------- helpers ---------- */
  function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function txt(parent,x,y,s,cls,anchor){ const t=el('text',{x:x,y:y},parent); if(cls) t.setAttribute('class',cls); if(anchor) t.setAttribute('text-anchor',anchor); t.textContent=s; return t; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f1=v=>(+v).toFixed(1);
  const minus=s=>s.replace(/-/g,'−');
  const fa=v=>minus((Math.abs(v)<5e-4?0:v).toFixed(3));
  const fb=v=>minus((Math.abs(v)<5e-5?0:v).toFixed(4));
  const int=v=>Math.round(v).toLocaleString('en-US');
  const snap=a=>clamp(Math.round((a-AMIN)/ASTEP)*ASTEP+AMIN,AMIN,AMAX);
  const tidy=a=>Math.round(a*1000)/1000;
  const sOf=a=>Math.round(8*a*K*1e9)/1e9;          // s = 8aκ, snapped so that a = 0 and a = 1.25 give exactly 0 and 1

  /* ---------- the map ---------- */
  const mapStep=(b,s)=>b*(1+s-16*b*b);

  // bifurcation diagram: values of iterates 601..700 per a (NaN once escaped)
  const DA=new Float64Array(NA), DV=new Float32Array(NA*KEEP);
  for(let i=0;i<NA;i++){
    const a=AMIN+(AMAX-AMIN)*i/(NA-1), s=8*a*K; DA[i]=a;
    let b=B0, ok=true;
    for(let t=0;t<BURN&&ok;t++){ b=mapStep(b,s); if(!(Math.abs(b)<=ESC)) ok=false; }
    for(let j=0;j<KEEP;j++){
      if(ok){ b=mapStep(b,s); if(!(Math.abs(b)<=ESC)) ok=false; }
      DV[i*KEEP+j]=ok?b:NaN;
    }
  }

  // orbit b_0..b_80 from b_0 = 0.05; escaped orbits stop at the first |b| > 10
  function orbit(s){
    const P=[B0]; let b=B0;
    for(let k=1;k<=NORB;k++){ b=mapStep(b,s); P.push(b); if(!(Math.abs(b)<=ESC)) break; }
    return P;
  }
  // long-run regime at s
  function classify(s){
    let b=B0;
    for(let t=0;t<LBURN;t++){ b=mapStep(b,s); if(!(Math.abs(b)<=ESC)) return {kind:'esc', t:t+1}; }
    if(s<0) return {kind:'conv'};
    if(s===0) return {kind:'neutral'};
    if(s<=1) return {kind:'fixed', X:Math.sqrt(s)/4};
    const v=[];
    for(let t=0;t<LKEEP;t++){ b=mapStep(b,s); if(!(Math.abs(b)<=ESC)) return {kind:'esc', t:LBURN+t+1}; v.push(b); }
    v.sort((p,q)=>p-q);
    const lv=[v[0]];
    for(let t=1;t<v.length;t++) if(v[t]-lv[lv.length-1]>LTOL) lv.push(v[t]);
    return lv.length<=PMAX?{kind:'cycle', p:lv.length, lv:lv}:{kind:'chaos', lo:v[0], hi:v[v.length-1]};
  }
  function regimeText(r){
    switch(r.kind){
      case 'conv': return 'b → 0: the orbit converges, as at a minimum.';
      case 'neutral': return 'b → 0 slowly: at 8aκ = 0 the fixed point b = 0 is neutral.';
      case 'fixed': return 'settles at b = ±'+r.X.toFixed(3)+' (the parabola b² = aκ/2): steady period-2 oscillation of GD.';
      case 'cycle': return 'cycle of '+r.p+' two-step values'+(r.p<=4?' ('+r.lv.map(v=>minus(v.toFixed(3))).join(', ')+')':'')+'.';
      case 'chaos': return 'no short cycle (chaotic), b between '+minus(r.lo.toFixed(3))+' and '+minus(r.hi.toFixed(3))+'.';
      case 'esc': return 'the orbit escapes (divergence).';
    }
    return '';
  }

  /* ---------- the gradient-descent run (paper Fig. 6b) ---------- */
  const GA=new Float64Array(GDN), GB=new Float64Array(GDN);
  (function(){
    let x=X0, y=Y0;
    for(let t=0;t<GDN;t++){
      GA[t]=Math.sqrt(x*x-y*y)-CH; GB[t]=x*y-1;
      const r=x*x*y*y-1, nx=x-ETA*x*y*y*r, ny=y-ETA*x*x*y*r;
      x=nx; y=ny;
    }
  })();
  const GI=[];                                           // indices drawn
  for(let t=0;t<GDN;t++) if(GA[t]>1||t%20<2) GI.push(t);
  let gdMinA=Infinity; for(let t=0;t<GDN;t++) if(GA[t]<gdMinA) gdMinA=GA[t];
  function gdStepAt(a){                                  // first step at which the run has a ≤ this a
    if(a>GA[0]) return -1;
    if(a<gdMinA) return -1;
    for(let t=0;t<GDN;t++) if(GA[t]<=a) return t;
    return -1;
  }

  /* ---------- state ---------- */
  const st={a:1.6, gd:true, playing:false, hovA:null, hovK:null, ptr:null, tipOn:null, kbK:false, drag:false};

  /* ---------- canvas colours ---------- */
  let PAL=null;
  function col(expr){ probe.style.color=''; probe.style.color=expr; return getComputedStyle(probe).color; }
  function resolvePal(){ PAL={map:col('var(--fx-base2)'), gd:col('var(--accent)')}; }

  /* ---------- geometry ---------- */
  let G=null, O=null;
  function geom(){
    const cw=Math.round(fig.clientWidth)||640, wide=cw>=540;
    panels.classList.toggle('wide',wide);
    const pw=Math.max(200,Math.round(plot.clientWidth)||cw), ow=Math.max(200,Math.round(oplot.clientWidth)||cw);
    const PH=wide?250:210, mT=24, mB=36;
    const g={pw:pw, H:mT+PH+mB, x0:40, xR:pw-8, yT:mT, yB:mT+PH};
    g.X=a=>g.x0+(a-AMIN)/(AMAX-AMIN)*(g.xR-g.x0);
    g.A=px=>AMIN+(px-g.x0)/(g.xR-g.x0)*(AMAX-AMIN);
    g.Y=b=>g.yT+(BMAX-b)/(BMAX-BMIN)*PH;
    const o={pw:ow, H:g.H, x0:40, xR:ow-8, yT:mT, yB:mT+PH};
    o.X=k=>o.x0+k/NORB*(o.xR-o.x0);
    o.Y=g.Y;
    return [g,o];
  }

  /* ---------- left: canvas dots ---------- */
  const cctx=cvs.getContext('2d');
  function paint(){
    if(!G) return;
    if(!PAL) resolvePal();
    const g=G, W=g.xR-g.x0, H=g.yB-g.yT, dpr=Math.min(3,window.devicePixelRatio||1);
    Object.assign(cvs.style,{left:g.x0+'px',top:g.yT+'px',width:W+'px',height:H+'px'});
    cvs.width=Math.round(W*dpr); cvs.height=Math.round(H*dpr);
    cctx.setTransform(dpr,0,0,dpr,0,0);
    cctx.clearRect(0,0,W,H);
    const sx=W/(AMAX-AMIN), sy=H/(BMAX-BMIN);
    // map attractor, de-duplicated per column at half-pixel resolution
    cctx.fillStyle=PAL.map;
    const seen=new Uint8Array(Math.ceil(H*2)+4); const r=0.7;
    for(let i=0;i<NA;i++){
      const x=(DA[i]-AMIN)*sx; seen.fill(0);
      for(let j=0;j<KEEP;j++){
        const v=DV[i*KEEP+j]; if(v!==v) break;
        for(let sg=0;sg<2;sg++){
          const y=(BMAX-(sg?-v:v))*sy, q=Math.round(y*2);
          if(q<0||q>=seen.length||seen[q]) continue; seen[q]=1;
          cctx.fillRect(x-r,y-r,2*r,2*r);
        }
      }
    }
    if(st.gd){
      cctx.fillStyle=PAL.gd; cctx.globalAlpha=0.35; const rg=0.8;
      cctx.beginPath();
      for(let n=0;n<GI.length;n++){ const t=GI[n], x=(GA[t]-AMIN)*sx, y=(BMAX-GB[t])*sy; cctx.rect(x-rg,y-rg,2*rg,2*rg); }
      cctx.fill();
      cctx.globalAlpha=1;
    }
  }

  /* ---------- left: SVG ---------- */
  function yAxis(root,g){
    [-0.8,-0.4,0,0.4].forEach(b=>{
      const y=Math.round(g.Y(b))+.5;
      el('line',{class:'bif-tick',x1:g.x0-4.5,x2:g.x0-.5,y1:y,y2:y},root);
      txt(root,g.x0-7,y+3.6,minus(b===0?'0':b.toFixed(1)),null,'end');
    });
    el('line',{class:'gr',x1:g.x0,x2:g.xR,y1:Math.round(g.Y(0))+.5,y2:Math.round(g.Y(0))+.5},root);
    el('line',{class:'ax',x1:g.x0-.5,x2:g.x0-.5,y1:g.yT,y2:g.yB},root);
    el('line',{class:'ax',x1:g.x0-.5,x2:g.xR,y1:g.yB+.5,y2:g.yB+.5},root);
    txt(root,4,g.yT-10,'b','axn');
  }
  function render(){
    const gg=geom(); G=gg[0]; O=gg[1];
    const g=G;
    svg.setAttribute('viewBox','0 0 '+g.pw+' '+g.H); svg.setAttribute('width',g.pw); svg.setAttribute('height',g.H);
    svg.textContent='';
    const Lb=el('g',{},svg);
    yAxis(Lb,g);
    [-0.5,0,0.5,1,1.5,2,2.5].forEach(a=>{
      const x=Math.round(g.X(a))+.5;
      el('line',{class:'bif-tick',x1:x,x2:x,y1:g.yB+.5,y2:g.yB+4.5},Lb);
      txt(Lb,x,g.yB+16,minus(String(a)),null,'middle');
    });
    const xt=txt(Lb,g.xR,g.yB+33,'','','end');
    el('tspan',{class:'axn'},xt).textContent='a'; el('tspan',{dx:5},xt).textContent='(along the valley)';
    // reference lines: a = 0 (EoS minimum) and a = 1/(8κ) = 1.25 (first period doubling)
    [[0,'EoS min.'],[1/(8*K),'first split']].forEach(p=>{
      const x=Math.round(g.X(p[0]))+.5;
      el('line',{class:'bif-ref',x1:x,x2:x,y1:g.yT-4,y2:g.yB},Lb);
      txt(Lb,x,g.yT-8,p[1],'bif-reflab','middle');
    });
    // fixed-point branch b = ±√(aκ/2), 0 < a < 1/(8κ)
    const aE=1/(8*K), up=[], dn=[];
    for(let q=0;q<=120;q++){ const a=aE*(q/120)*(q/120), b=Math.sqrt(a*K/2); up.push(f1(g.X(a))+' '+f1(g.Y(b))); dn.push(f1(g.X(a))+' '+f1(g.Y(-b))); }
    el('path',{class:'bif-par',d:'M'+up.join('L')+'M'+dn.join('L')},Lb);
    const la=0.62, lb=-Math.sqrt(la*K/2);
    txt(Lb,g.X(la),g.Y(lb)+17,'b² = aκ/2','bif-parlab','middle');
    G.Lh=el('g',{},svg); G.Lc=el('g',{},svg);
    paint(); drawCursor(); drawHov();
    renderOrbit();
  }
  function drawCursor(){
    if(!G||!G.Lc) return;
    const g=G; G.Lc.textContent='';
    const x=Math.round(g.X(st.a))+.5;
    el('line',{class:'hair bif-cur',x1:x,x2:x,y1:g.yT,y2:g.yB},G.Lc);
    el('path',{class:'bif-grip',d:'M'+x+' '+(g.yB-1)+'l4.5 6.5h-9z'},G.Lc);
  }
  function drawHov(){
    if(!G||!G.Lh) return;
    G.Lh.textContent='';
    if(st.hovA===null) return;
    const x=Math.round(G.X(st.hovA))+.5;
    el('line',{class:'hair bif-hov',x1:x,x2:x,y1:G.yT,y2:G.yB},G.Lh);
  }

  /* ---------- right: orbit ---------- */
  let orb=null;
  function renderOrbit(){
    if(!O) return;
    const o=O, s=sOf(st.a);
    orb=orbit(s);
    osvg.setAttribute('viewBox','0 0 '+o.pw+' '+o.H); osvg.setAttribute('width',o.pw); osvg.setAttribute('height',o.H);
    osvg.textContent='';
    const defs=el('defs',{},osvg), cp=el('clipPath',{id:'fx-bifurcation-oclip'},defs);
    el('rect',{x:o.x0,y:o.yT-4,width:o.xR-o.x0+4,height:o.yB-o.yT+8},cp);
    const Lb=el('g',{},osvg);
    yAxis(Lb,o);
    [0,20,40,60,80].forEach(k=>{
      const x=Math.round(o.X(k))+.5;
      el('line',{class:'bif-tick',x1:x,x2:x,y1:o.yB+.5,y2:o.yB+4.5},Lb);
      txt(Lb,x,o.yB+16,String(k),null,'middle');
    });
    const xt=txt(Lb,o.xR,o.yB+33,'','','end');
    el('tspan',{class:'axn'},xt).textContent='k'; el('tspan',{dx:5},xt).textContent='(two-step iterate)';
    const Lc=el('g',{'clip-path':'url(#fx-bifurcation-oclip)'},osvg);
    if(st.a>0){
      const b=Math.sqrt(st.a*K/2);
      [b,-b].forEach(v=>{ const y=f1(o.Y(v)); el('path',{class:'bif-par',d:'M'+o.x0+' '+y+'H'+o.xR},Lc); });
      if(o.Y(-b)+15<o.yB) txt(Lb,o.xR,o.Y(-b)+13,'−√(aκ/2)','bif-parlab','end');
    }
    const P=orb;
    el('path',{class:'bif-oline',d:'M'+P.map((b,k)=>f1(o.X(k))+' '+f1(o.Y(clamp(b,BMIN-1,BMAX+1)))).join('L')},Lc);
    const esc=P.length<=NORB&&!(Math.abs(P[P.length-1])<=ESC);
    P.forEach((b,k)=>{
      if(b<BMIN-0.05||b>BMAX+0.05) return;
      el('circle',{class:k<NTR?'bif-otr':'bif-ost',cx:f1(o.X(k)),cy:f1(o.Y(b)),r:2.1},Lc);
    });
    if(esc){
      const k=P.length-1, x=o.X(k);
      txt(Lb,x+6>o.xR-90?x-6:x+6,o.yB-8,'escapes at k = '+k,'bif-esclab',x+6>o.xR-90?'end':'start');
    }
    O.Lh=el('g',{},osvg);
    drawOHov();
    updText();
  }
  function drawOHov(){
    if(!O||!O.Lh) return;
    O.Lh.textContent='';
    const k=st.hovK; if(k===null||!orb||k>=orb.length) return;
    const x=Math.round(O.X(k))+.5, b=orb[k];
    el('line',{class:'hair',x1:x,x2:x,y1:O.yT,y2:O.yB},O.Lh);
    if(b>=BMIN&&b<=BMAX){
      const y=f1(O.Y(b));
      el('circle',{class:'bif-ringh',cx:f1(O.X(k)),cy:y,r:4.4},O.Lh);
      el('circle',{class:'bif-ring',cx:f1(O.X(k)),cy:y,r:4.4},O.Lh);
    }
  }

  /* ---------- text ---------- */
  function updText(){
    const a=st.a, s=sOf(a), r=classify(s), t=gdStepAt(a);
    aval.textContent='a = '+fa(a);
    range.setAttribute('aria-valuetext','a = '+fa(a)+', 8aκ = '+fa(s));
    let gd;
    if(a>GA[0]) gd='GD starts below this a, at a = '+fa(GA[0])+'.';
    else if(t>=0) gd='GD passes this a at step <b>'+int(t)+'</b>.';
    else gd='GD never reaches this a; it ends near a = −κ³/8 = −0.000125.';
    status.innerHTML='a = <b>'+fa(a)+'</b>, 8aκ = <b>'+fa(s)+'</b>: '+regimeText(r)+' '+gd;
    svg.setAttribute('aria-label','Bifurcation diagram of the two-step map b ↦ b(1 + 8aκ − 16b²) with κ = 0.1, for a from −0.5 to 2.6: '+
      'a single branch b² = aκ/2 for 0 < a < 1.25, period doubling above a = 1.25, chaotic bands up to a = 2.5, and b → 0 for a < 0. '+
      (st.gd?'The gradient-descent run from (12.5, 0.05) is overlaid and moves from a ≈ 2.50 to a ≈ 0. ':'')+'Cursor at a = '+fa(a)+'.');
    osvg.setAttribute('aria-label','Orbit b_k of the map for k = 0 to 80 at a = '+fa(a)+': '+regimeText(r)+' Arrow keys step through the iterates.');
  }

  /* ---------- tooltip ---------- */
  function tipLeft(a){
    const s=sOf(a), r=classify(s);
    return '<b>a = '+fa(a)+'</b><span class="k">, 8aκ = </span>'+fa(s)+'<span class="bif-reg">'+regimeText(r)+'</span>'+
      (coarse?'':'<span class="k bif-reg">click or drag to set a</span>');
  }
  function tipRight(k){
    const b=orb[k];
    return '<b>k = '+k+'</b><div class="bif-tt"><span class="k">b<sub>k</sub></span><span>'+(Math.abs(b)<=ESC?fb(b):'escaped')+'</span>'+
      (k<NTR?'<span class="k">transient</span><span></span>':'')+'</div>';
  }
  function placeTip(){
    if(!st.tipOn){ tip.classList.remove('on'); return; }
    tip.innerHTML=st.tipOn==='L'?tipLeft(st.hovA):tipRight(st.hovK);
    tip.classList.add('on');
    const fr=fig.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight;
    let ax, ay;
    if(st.ptr){ ax=st.ptr[0]; ay=st.ptr[1]; }
    else {
      const sr=osvg.getBoundingClientRect(), sc=sr.width/O.pw, b=orb[st.hovK];
      ax=sr.left-fr.left+O.X(st.hovK)*sc; ay=sr.top-fr.top+O.Y(Math.abs(b)<=ESC?clamp(b,BMIN,BMAX):0)*sc;
    }
    let x=ax+14, y=ay+16;
    if(x+tw>fr.width) x=ax-14-tw;
    if(y+th>fr.height) y=ay-12-th;
    tip.style.left=clamp(x,0,Math.max(0,fr.width-tw))+'px';
    tip.style.top=clamp(y,0,Math.max(0,fr.height-th))+'px';
  }
  function hideTip(){ st.tipOn=null; st.hovA=null; st.hovK=null; st.ptr=null; drawHov(); drawOHov(); placeTip(); }

  /* ---------- setting a ---------- */
  function setA(a,keepPlay){
    if(!keepPlay) stop();
    a=tidy(snap(a));
    if(a===st.a) return;
    st.a=a; range.value=String(a);
    drawCursor(); renderOrbit();
    if(st.tipOn==='R'){ if(st.hovK>=orb.length) hideTip(); else placeTip(); }
    else if(st.tipOn==='L') placeTip();
  }
  range.addEventListener('input',()=>setA(+range.value));
  fig.querySelectorAll('.bif-ticks span').forEach(sp=>sp.addEventListener('click',()=>{ setA(+sp.getAttribute('data-v')); range.focus({preventScroll:true}); }));

  /* ---------- left panel pointer: hover shows the regime, press or drag sets a ---------- */
  function locate(s,ev){ const b=s.getBoundingClientRect(); if(!b.width) return null; const k=+s.getAttribute('width')/b.width; return [(ev.clientX-b.left)*k,(ev.clientY-b.top)*k]; }
  function leftMove(ev,press){
    const q=locate(svg,ev); if(!q||!G) return;
    const fr=fig.getBoundingClientRect();
    if(q[0]<G.x0-6||q[0]>G.xR+6||q[1]<G.yT-12||q[1]>G.yB+8){ if(!st.drag){ if(st.tipOn==='L') hideTip(); } return; }
    const a=tidy(snap(G.A(clamp(q[0],G.x0,G.xR))));
    if(press||st.drag) setA(a);
    st.hovA=a; st.hovK=null; st.tipOn='L'; st.ptr=[ev.clientX-fr.left,ev.clientY-fr.top];
    drawHov(); drawOHov(); placeTip();
  }
  svg.addEventListener('pointermove',ev=>leftMove(ev,false));
  svg.addEventListener('pointerdown',ev=>{
    if(ev.button!==undefined&&ev.button>0) return;
    st.drag=true;
    try{ if(ev.pointerType==='mouse') svg.setPointerCapture(ev.pointerId); }catch(_){}
    leftMove(ev,true);
  });
  const endDrag=()=>{ st.drag=false; };
  svg.addEventListener('pointerup',endDrag);
  svg.addEventListener('pointercancel',endDrag);
  svg.addEventListener('lostpointercapture',endDrag);
  svg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse'&&!st.drag&&st.tipOn==='L') hideTip(); });

  /* ---------- right panel pointer + keyboard: read single iterates ---------- */
  function rightMove(ev){
    const q=locate(osvg,ev); if(!q||!O||!orb) return;
    if(q[0]<O.x0-8||q[0]>O.xR+8||q[1]<O.yT-8||q[1]>O.yB+8){ if(st.tipOn==='R') hideTip(); return; }
    const k=clamp(Math.round((q[0]-O.x0)/(O.xR-O.x0)*NORB),0,orb.length-1), fr=fig.getBoundingClientRect();
    st.hovK=k; st.hovA=null; st.tipOn='R'; st.kbK=false; st.ptr=[ev.clientX-fr.left,ev.clientY-fr.top];
    drawHov(); drawOHov(); placeTip();
  }
  osvg.addEventListener('pointermove',rightMove);
  osvg.addEventListener('pointerdown',rightMove);
  osvg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse'&&st.tipOn==='R'&&!st.kbK) hideTip(); });
  osvg.addEventListener('keydown',e=>{
    if(!orb) return;
    const n=orb.length-1, had=st.tipOn==='R'&&st.hovK!==null;
    let k=had?st.hovK:NTR;
    switch(e.key){
      case 'ArrowRight': case 'ArrowUp': if(had) k=Math.min(n,k+(e.shiftKey?10:1)); break;
      case 'ArrowLeft': case 'ArrowDown': if(had) k=Math.max(0,k-(e.shiftKey?10:1)); break;
      case 'Home': k=0; break;
      case 'End': k=n; break;
      case 'Escape': if(had){ hideTip(); e.preventDefault(); } return;
      default: return;
    }
    e.preventDefault();
    st.hovK=Math.min(k,n); st.hovA=null; st.tipOn='R'; st.kbK=true; st.ptr=null;
    drawHov(); drawOHov(); placeTip();
  });
  const keyFocus=s=>{ try{ return s.matches(':focus-visible'); }catch(_){ return true; } };
  osvg.addEventListener('focus',()=>{ if(orb&&st.tipOn!=='R'&&keyFocus(osvg)){ st.hovK=Math.min(NTR,orb.length-1); st.tipOn='R'; st.kbK=true; st.ptr=null; drawOHov(); placeTip(); } });
  osvg.addEventListener('blur',()=>{ if(st.kbK&&st.tipOn==='R') hideTip(); });
  document.addEventListener('pointerdown',ev=>{ if(st.tipOn&&!svg.contains(ev.target)&&!osvg.contains(ev.target)) hideTip(); },true);

  /* ---------- play: sweep a from right to left, as gradient descent does ---------- */
  let raf=0, last=0, aCont=st.a;
  function frame(ts){
    if(!st.playing) return;
    const dt=last?Math.min(0.1,(ts-last)/1000):0; last=ts;
    aCont-=SPEED*dt;
    if(aCont<=AMIN){ aCont=AMIN; setA(AMIN,true); stop(); return; }
    setA(aCont,true);
    raf=requestAnimationFrame(frame);
  }
  function play(){
    if(st.playing) return;
    if(st.a<=AMIN+1e-9) setA(AMAX,true);
    aCont=st.a; last=0; st.playing=true;
    bPlay.textContent='pause'; bPlay.setAttribute('aria-pressed','true'); bPlay.setAttribute('aria-label','Pause the sweep');
    status.setAttribute('aria-live','off');
    raf=requestAnimationFrame(frame);
  }
  function stop(){
    if(!st.playing) return;
    st.playing=false; cancelAnimationFrame(raf);
    bPlay.textContent='play'; bPlay.setAttribute('aria-pressed','false'); bPlay.setAttribute('aria-label','Sweep a from right to left');
    status.setAttribute('aria-live','polite');
    updText();
  }
  bPlay.addEventListener('click',()=>{ if(st.playing) stop(); else play(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) stop(); });

  bGD.addEventListener('click',()=>{
    st.gd=!st.gd; bGD.setAttribute('aria-pressed',String(st.gd)); gdLeg.hidden=!st.gd;
    paint(); updText();
  });

  /* ---------- theme + resize ---------- */
  function retheme(){ PAL=null; paint(); }
  new MutationObserver(retheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class','style']});
  if(window.matchMedia){ const mq=matchMedia('(prefers-color-scheme: dark)'); if(mq.addEventListener) mq.addEventListener('change',retheme); else if(mq.addListener) mq.addListener(retheme); }

  let lastW=0;
  function renderAll(){ lastW=Math.round(fig.clientWidth); render(); if(st.tipOn) placeTip(); }
  range.value=String(st.a);
  renderAll();
  if(window.ResizeObserver){
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW) renderAll(); }).observe(fig);
  }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ if(G) renderAll(); });
})();
