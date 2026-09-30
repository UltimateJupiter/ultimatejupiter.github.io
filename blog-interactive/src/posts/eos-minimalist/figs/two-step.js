/* Figure 3 · two-step dynamics in (a, b) coordinates (fx-two-step).
   Live gradient descent, drawn in the paper's reparameterization (Definition 2): c = sqrt(x² − y²), d = xy,
   a = c − ĉ, b = d − 1, κ = √η, where ĉ puts the minimum of sharpness exactly 2/η at the origin.
   Degree 4: GD on ¼(1 − x²y²)² (paper Eq. 2), ĉ = (η⁻² − 4)^¼, sharpness λ1 of paper Eq. 3.
   Degree 2: GD on ½(1 − xy)² (paper Sec. 4; the ½ matches its Eq. 12 and experiments), ĉ = ((2/η)² − 4)^¼,
   sharpness = top eigenvalue of the 2×2 Hessian. Starts come from (a0, b0) through the inverse map (paper Eq. 29).
   Dashed guides: the degree-4 parabola b² = aκ/2 + κ⁴/16 (paper Eq. 9 with C = 0) and the degree-2 ellipse
   a² + κ²b²/4 = const of the ODE db/da = −4a/(bκ²) (paper Sec. 4) through the start. Nothing here is recorded data. */
(function(){
  'use strict';
  const ID='fx-two-step', fig=document.getElementById(ID);
  if(!fig) return;

  const NS='http://www.w3.org/2000/svg', MINUS='−', B0=0.01, TMAX=20000, BTOL=1e-10, DUR=4500;
  const $=s=>fig.querySelector(s);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const r2=v=>Math.round(v*100)/100;
  const neg=s=>String(s).replace(/-/g,MINUS);
  const sig=(v,n)=>{
    if(!isFinite(v)) return '∞';
    if(v===0) return '0';
    const av=Math.abs(v);
    if(av>=1e-4&&av<1e5) return neg(v.toPrecision(n));
    const s=v.toExponential(n-1).split('e'); return neg(s[0])+'e'+neg(String(+s[1]));
  };
  const fxd=(v,n)=>neg((+v).toFixed(n));
  const etaStr=e=>String(+e);

  /* ---------- the two objectives (update rules from the paper) ---------- */
  const MOD={
    4:{ name:'Degree 4',
      chat:eta=>Math.pow(1/(eta*eta)-4,0.25),
      step(x,y,eta){ const r=x*x*y*y-1; return [x-eta*x*y*y*r, y-eta*x*x*y*r]; },                 // Eq. 2
      sharp(x,y){                                                                                 // Eq. 3, λ1
        const g=x*y, g2=g*g, s=x*x+y*y, q=1-3*g2;
        return 0.5*(s*(3*g2-1)+Math.sqrt(s*s*q*q+4*g2*(3-10*g2+7*g2*g2)));
      },
      slab:'λ₁'
    },
    2:{ name:'Degree 2',
      chat:eta=>Math.pow(4/(eta*eta)-4,0.25),
      step(x,y,eta){ const r=x*y-1; return [x-eta*y*r, y-eta*x*r]; },
      sharp(x,y){ const o=2*x*y-1, d=x*x-y*y; return 0.5*(x*x+y*y+Math.sqrt(d*d+4*o*o)); },       // top eig of [[y², 2xy−1], [2xy−1, x²]]
      slab:'λ'
    }
  };

  function simulate(deg,eta,a0){
    const M=MOD[deg], ch=M.chat(eta), k=Math.sqrt(eta);
    // inverse map (paper Eq. 29)
    const c=ch+a0, d=1+B0, q=Math.sqrt(c*c*c*c+4*d*d);
    let x=Math.sqrt((c*c+q)/2), y=Math.SQRT2*d/Math.sqrt(c*c+q);
    const A=new Float64Array(TMAX+1), B=new Float64Array(TMAX+1), X=new Float64Array(TMAX+1), Y=new Float64Array(TMAX+1);
    let n=0, div=-1;
    for(let t=0;;t++){
      const u=x*x-y*y;
      A[t]=Math.sign(u)*Math.sqrt(Math.abs(u))-ch; B[t]=x*y-1; X[t]=x; Y[t]=y; n=t+1;
      if(Math.abs(B[t])<BTOL||t===TMAX) break;
      const p=M.step(x,y,eta); x=p[0]; y=p[1];
      if(!(Math.abs(x)<=1e4&&Math.abs(y)<=1e4)){ div=t+1; break; }   // also catches NaN
    }
    const last=n-1;
    return {deg:deg, eta:eta, k:k, ch:ch, a0:a0, n:n, A:A, B:B, X:X, Y:Y, div:div, conv:Math.abs(B[last])<BTOL,
            aEnd:A[last], bEnd:B[last], lamEnd:M.sharp(X[last],Y[last]), C:a0*a0+B0*B0*eta/4};
  }

  /* ---------- elements ---------- */
  const sel=$('#'+ID+'-eta'), rng=$('#'+ID+'-a0'), aval=$('.tws-aval'), afill=$('.tws-fill');
  const aticks=[...fig.querySelectorAll('.tws-ticks span')], viewBtns=[...fig.querySelectorAll('[data-view]')];
  const bPlay=$('.tws-play'), status=$('.fx-status');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);
  const RMIN=+rng.min, RMAX=+rng.max;

  function el(tag,attrs,parent,text){
    const e=document.createElementNS(NS,tag);
    if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]);
    if(text!=null) e.textContent=text;
    if(parent) parent.appendChild(e);
    return e;
  }

  /* ---------- state ---------- */
  const st={eta:0.1, a0:0.10, view:'whole', p:1, play:null};
  const RUN={}, P={};     // simulation per degree, rendered panel per degree
  let clipN=0;
  function compute(){ RUN[4]=simulate(4,st.eta,st.a0); RUN[2]=simulate(2,st.eta,st.a0); }
  /* The replay reveals iterates at a steady on-screen speed: progress p maps to the step whose cumulative two-step
     displacement (in pixels, plus a small constant per step so the slow final approach still takes some time)
     reaches p of the total. */
  function shown(c){
    const n=RUN[c.deg].n;
    if(st.p>=1) return n;
    const cum=c.cum, goal=st.p*cum[n-1];
    let lo=0, hi=n-1;
    while(lo<hi){ const mid=(lo+hi+1)>>1; if(cum[mid]<=goal) lo=mid; else hi=mid-1; }
    return Math.max(1,lo+1);
  }
  function arc(c){
    const r=RUN[c.deg], n=r.n, cum=new Float64Array(n), X=c.X, Y=c.Y, m=c.m;
    const px=t=>clamp(X(r.A[t]),m.l-10,m.l+c.pw+10), py=t=>clamp(Y(r.B[t]),m.t-10,m.t+c.ph+10);
    for(let t=1;t<n;t++){
      const d=t>=2?Math.hypot(px(t)-px(t-2),py(t)-py(t-2))/2:Math.hypot(px(t)-px(t-1),py(t)-py(t-1));
      cum[t]=cum[t-1]+(isFinite(d)?d:0)+0.04;
    }
    c.cum=cum;
  }

  /* ---------- scales ---------- */
  function niceStep(span,n){
    const raw=span/Math.max(1,n), p=Math.pow(10,Math.floor(Math.log10(raw)));
    for(const m of [1,2,2.5,5,10]) if(m*p>=raw-1e-12) return m*p;
    return 10*p;
  }
  function ticks(lo,hi,n){
    const s=niceStep(hi-lo,n), out=[];
    for(let v=Math.ceil(lo/s-1e-9)*s;v<=hi+1e-9;v+=s) out.push(Math.abs(v)<s*1e-6?0:+v.toFixed(12));
    return {s:s, v:out};
  }
  function tickLab(v,s){
    if(v===0) return '0';
    const e=Math.floor(Math.log10(s)+1e-9), frac=(s/Math.pow(10,e))%1>1e-9;
    return fxd(v,Math.max(0,-e+(frac?1:0)));
  }

  function range(r,pw){
    const k=r.k, k3=k*k*k, lim=v=>isFinite(v)&&Math.abs(v)<50;
    if(st.view==='near'){
      const bR=1.2*Math.sqrt(k3*k/2+k*k*k*k/16);         // parabola half-width at a = κ³, with room
      let lo=-k3/2, hi=k3;
      if(r.deg===2){ lo=Math.min(r.aEnd,-Math.sqrt(r.C)); const sp=hi-lo; lo-=0.06*sp; }
      return {a0:lo, a1:hi, b0:-bR, b1:bR};
    }
    let lo=Math.min(r.deg===4?-k3/8:-Math.sqrt(r.C), 0), hi=r.a0, mb=0;
    for(let t=0;t<r.n;t++){
      const a=r.A[t], b=r.B[t];
      if(!lim(a)||!lim(b)) continue;
      if(a<lo) lo=a; if(a>hi) hi=a;
      if(Math.abs(b)>mb) mb=Math.abs(b);
    }
    const sp=hi-lo, padR=0.05*sp;
    let padL=0.05*sp;
    if(r.deg===4){
      // leave room for the '−κ³/8' label left of the vertex
      const f=Math.min(0.4,46/pw), D=-k3/8-lo;
      padL=Math.max(padL,(f*(sp+padR)-D)/(1-f));
    }
    return {a0:lo-padL, a1:hi+padR, b0:-1.1*mb, b1:1.1*mb};
  }

  /* ---------- one panel ---------- */
  const dot=(x,y,r)=>'M'+r2(x-r)+' '+r2(y)+'a'+r+' '+r+' 0 1 0 '+(2*r)+' 0a'+r+' '+r+' 0 1 0 '+(-2*r)+' 0';

  function build(deg){
    const box=$('[data-chart="'+deg+'"]'), r=RUN[deg];
    const W=Math.max(220,Math.round(box.clientWidth)||300), H=Math.round(clamp(W*0.8,230,270));
    const m={l:46,r:12,t:24,b:34}, pw=W-m.l-m.r, ph=H-m.t-m.b;
    box.textContent='';
    const svg=el('svg',{class:'fx-svg',viewBox:'0 0 '+W+' '+H,width:W,height:H,role:'img',tabindex:0},box);
    const v=range(r,pw);
    const X=a=>m.l+pw*(a-v.a0)/(v.a1-v.a0), Y=b=>m.t+ph*(1-(b-v.b0)/(v.b1-v.b0));
    const c={deg:deg, svg:svg, W:W, H:H, m:m, pw:pw, ph:ph, v:v, X:X, Y:Y, cur:null};
    arc(c);
    const g=el('g',{},svg);
    const tx=ticks(v.a0,v.a1,Math.max(3,Math.floor(pw/62))), ty=ticks(v.b0,v.b1,Math.max(3,Math.floor(ph/38)));
    tx.v.forEach(a=>{ const px=Math.round(X(a))+.5;
      el('line',{class:'gr',x1:px,x2:px,y1:m.t,y2:m.t+ph},g);
      el('text',{x:px,y:m.t+ph+14,'text-anchor':'middle'},g,tickLab(a,tx.s)); });
    ty.v.forEach(b=>{ const py=Math.round(Y(b))+.5;
      if(b!==0) el('line',{class:'gr',x1:m.l,x2:m.l+pw,y1:py,y2:py},g);
      el('text',{x:m.l-6,y:py+3.5,'text-anchor':'end'},g,tickLab(b,ty.s)); });
    const yb=Math.round(m.t+ph)+.5, xl=Math.round(m.l)+.5, y0=Math.round(Y(0))+.5;
    el('line',{class:'zero',x1:m.l,x2:m.l+pw,y1:y0,y2:y0},g);
    el('line',{class:'ax',x1:m.l,x2:m.l+pw,y1:yb,y2:yb},g);
    el('line',{class:'ax',x1:xl,x2:xl,y1:m.t,y2:m.t+ph},g);
    el('text',{class:'axn',x:m.l+pw,y:H-3,'text-anchor':'end'},g,'a, along the minima');
    el('text',{class:'axn',x:2,y:12},g,'b = xy − 1, across');

    const cid=ID+'-clip'+(++clipN), cp=el('clipPath',{id:cid},el('defs',{},svg));
    el('rect',{x:m.l+.5,y:m.t-4,width:pw+4,height:ph+4},cp);
    const clip=el('g',{'clip-path':'url(#'+cid+')'},svg);
    const labs=el('g',{},svg);

    // the minimum of sharpness exactly 2/η: a = 0
    const x0=Math.round(X(0))+.5;
    el('line',{class:'eos',x1:x0,x2:x0,y1:m.t,y2:m.t+ph},clip);
    const eosR=x0+4+52<=m.l+pw;
    el('text',{class:'lab m',x:eosR?x0+4:x0-4,y:m.t+11,'text-anchor':eosR?'start':'end'},labs,'EoS min.');

    // dashed guide through the paper's approximation
    // (points are clamped just outside the clip box, so the path never reaches beyond the chart)
    const k=r.k, k4=k*k*k*k, pts=[];
    const put=(a,b)=>{ pts.push((pts.length?'L':'M')+r2(clamp(X(a),m.l-2,m.l+pw+7))+' '+r2(clamp(Y(b),m.t-7,m.t+ph+2))); };
    if(deg===4){
      // parabola b² = aκ/2 + κ⁴/16, parametrized by b so the vertex is smooth
      const bm=Math.min(Math.max(Math.abs(v.b0),Math.abs(v.b1))*1.05,Math.sqrt(Math.max(0,v.a1*k/2+k4/16))*1.02);
      for(let i=0;i<=240;i++){ const b=-bm+2*bm*i/240; put((b*b-k4/16)*2/k,b); }
    }else{
      const sC=Math.sqrt(r.C);
      for(let i=0;i<=360;i++){ const th=2*Math.PI*i/360; put(sC*Math.cos(th),2*sC/k*Math.sin(th)); }
    }
    el('path',{class:'curve',d:pts.join('')},clip);

    // tick and label at the vertex (−κ³/8) or at −a0
    const mkA=deg===4?-k*k*k/8:-r.a0, mkT=deg===4?'−κ³/8':'−a₀', mx=X(mkA);
    if(mx>=m.l&&mx<=m.l+pw){
      el('line',{class:'mk',x1:r2(mx),x2:r2(mx),y1:y0-5,y2:y0+5},clip);
      // degree 4: left of the vertex (the iterates arrive from the right); degree 2: right of −a0 (they end left of it)
      const w=mkT.length*6.6, left=deg===4?mx-4-w>=m.l+2:mx+4+w>m.l+pw;
      const lt=el('text',{class:'lab',x:r2(left?mx-4:mx+4),y:y0+17,'text-anchor':left?'end':'start'},labs,deg===4?mkT:'−a');
      if(deg===2) el('tspan',{class:'sub',dy:3},lt,'0');   // subscript drawn, not a Unicode ₀ (missing in some text fonts)
    }
    // curve label: inside the curve, on the b = 0 line
    if(deg===4||st.view==='whole'){
      const la=deg===4?v.a0+0.64*(v.a1-v.a0):v.a0+0.72*(v.a1-v.a0);
      el('text',{class:'lab m',x:r2(X(la)),y:y0-7,'text-anchor':'middle'},labs,deg===4?'b² = aκ/2 + κ⁴/16':'a² + κ²b²/4 = const');
    }

    c.data=el('g',{},clip);
    c.marks=el('g',{},clip);
    svg.appendChild(labs);
    c.over=el('g',{},svg);
    P[deg]=c;
    wire(c);
    paintFull(c);
    aria(c);
  }

  function dotsPath(c,from,to){
    const r=RUN[c.deg], X=c.X, Y=c.Y, xl=c.m.l-4, xr=c.m.l+c.pw+4, yt=c.m.t-4, yb=c.m.t+c.ph+4;
    let ev='', od='';
    for(let t=from;t<to;t++){
      const x=X(r.A[t]), y=Y(r.B[t]);
      if(!(x>=xl&&x<=xr&&y>=yt&&y<=yb)) continue;
      if(t%2) od+=dot(x,y,2); else ev+=dot(x,y,2);
    }
    if(od) el('path',{class:'od',d:od},c.data);
    if(ev) el('path',{class:'ev',d:ev},c.data);
  }
  function paintMarks(c){
    const r=RUN[c.deg], g=c.marks; g.textContent='';
    const sx=c.X(r.A[0]), sy=c.Y(r.B[0]), s=4, inside=(x,y)=>x>=c.m.l-2&&x<=c.m.l+c.pw+2&&y>=c.m.t-2&&y<=c.m.t+c.ph+2;
    if(inside(sx,sy)){
    const d='M'+r2(sx-s)+' '+r2(sy-s)+'L'+r2(sx+s)+' '+r2(sy+s)+'M'+r2(sx-s)+' '+r2(sy+s)+'L'+r2(sx+s)+' '+r2(sy-s);
    el('path',{class:'st-bg',d:d},g); el('path',{class:'st',d:d},g);
    }
    const n=shown(c), t=n-1;
    if(st.p>=1&&r.div>0) return;
    const ex=c.X(r.A[t]), ey=c.Y(r.B[t]);
    if(!inside(ex,ey)) return;
    el('circle',{class:'en-bg',cx:r2(ex),cy:r2(ey),r:5},g); el('circle',{class:'en',cx:r2(ex),cy:r2(ey),r:5},g);
  }
  function paintFull(c){
    c.data.textContent='';
    const n=shown(c);
    dotsPath(c,0,n); c.drawn=n;
    paintMarks(c); paintCursor(c); sub(c);
  }
  function paintMore(c){
    const n=shown(c);
    if(n>c.drawn){ dotsPath(c,c.drawn,n); c.drawn=n; }
    paintMarks(c); sub(c);
  }

  /* ---------- text ---------- */
  function sub(c){
    const r=RUN[c.deg], s=$('[data-sub="'+c.deg+'"]');
    if(st.p<1){ s.textContent='step '+(shown(c)-1)+' of '+(r.n-1); return; }
    if(r.div>0){ s.textContent='diverges at step '+r.div; return; }
    s.innerHTML=(r.conv?'ends at ':'after '+(r.n-1)+' steps at ')+'<b>a = '+sig(r.aEnd,3)+'</b>'+(r.conv?' after '+(r.n-1)+' steps':'');
  }
  function endText(r){
    const k=r.k, M=MOD[r.deg], thr=2/r.eta;
    if(r.div>0) return '<b>'+M.name+'</b> diverges at step '+r.div+'.';
    let s='<b>'+M.name+'</b> '+(r.conv?'ends at':'is, after '+(r.n-1)+' steps, at')+' <span class="nw">a = '+sig(r.aEnd,3)+'</span>';
    if(r.deg===4){
      const gap=thr-r.lamEnd;
      s+=' (<span class="nw">−κ³/8 = '+sig(-k*k*k/8,3)+'</span>), sharpness <span class="nw">2/η '+(gap>=0?MINUS:'+')+' '+sig(Math.abs(gap),2)+'</span>.';
    }else{
      s+=', sharpness '+fxd(r.lamEnd,2)+' (<span class="nw">2/η = '+etaStr(thr)+'</span>).';
    }
    return s;
  }
  function updStatus(){
    status.innerHTML='η = '+etaStr(st.eta)+', a<sub>0</sub> = '+st.a0.toFixed(2)+'. '+endText(RUN[4])+' '+endText(RUN[2]);
  }
  function aria(c){
    const r=RUN[c.deg], M=MOD[c.deg], k=r.k;
    let s=M.name+' objective: iterates in the (a, b) plane, η = '+etaStr(st.eta)+', start a0 = '+st.a0.toFixed(2)+', b0 = 0.01, '+
      (st.view==='near'?'zoomed near the minimum':'whole run')+'. ';
    s+=c.deg===4?'Dashed parabola b² = aκ/2 + κ⁴/16 with its tip at −κ³/8 = '+sig(-k*k*k/8,3)+'. ':'Dashed ellipse a² + κ²b²/4 = const through the start. ';
    s+=r.div>0?'Diverges at step '+r.div+'. ':'Ends at a = '+sig(r.aEnd,3)+' after '+(r.n-1)+' steps, sharpness '+fxd(r.lamEnd,3)+' against 2/η = '+etaStr(2/st.eta)+'. ';
    c.svg.setAttribute('aria-label',s+'Arrow keys step through the iterates (Shift for 10, Page keys for 100).');
  }

  /* ---------- hover and keyboard ---------- */
  function tipHTML(c,t){
    const r=RUN[c.deg], M=MOD[c.deg];
    return '<b>'+M.name.toLowerCase()+', step '+t+'</b><div class="tws-tt">'+
      '<span class="k">a</span><span>'+sig(r.A[t],4)+'</span>'+
      '<span class="k">b</span><span>'+sig(r.B[t],4)+'</span>'+
      '<span class="k">sharpness '+M.slab+'</span><span>'+sig(M.sharp(r.X[t],r.Y[t]),4)+'</span>'+
      '<span class="k">2/η</span><span>'+etaStr(2/r.eta)+'</span></div>';
  }
  function placeTip(cx,cy){
    const fr=fig.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight;
    let x=cx-fr.left+14, y=cy-fr.top+16;
    if(x+tw>fr.width) x=cx-fr.left-14-tw;
    if(y+th>fr.height) y=cy-fr.top-12-th;
    tip.style.left=clamp(x,0,Math.max(0,fr.width-tw))+'px';
    tip.style.top=clamp(y,0,Math.max(0,fr.height-th))+'px';
  }
  function paintCursor(c){
    c.over.textContent='';
    const t=c.cur; if(t==null) return;
    const r=RUN[c.deg]; if(t>=r.n) return;
    const x=c.X(r.A[t]), y=c.Y(r.B[t]);
    if(x<c.m.l-8||x>c.m.l+c.pw+8||y<c.m.t-8||y>c.m.t+c.ph+8) return;
    el('line',{class:'hair',x1:Math.round(x)+.5,x2:Math.round(x)+.5,y1:c.m.t,y2:c.m.t+c.ph},c.over);
    el('circle',{class:'ring-bg',cx:r2(x),cy:r2(y),r:5.5},c.over);
    el('circle',{class:'ring',cx:r2(x),cy:r2(y),r:5.5},c.over);
  }
  function showCursor(c,t,cx,cy){
    [4,2].forEach(d=>{ const o=P[d]; if(o&&o!==c&&o.cur!=null){ o.cur=null; paintCursor(o); } });
    c.cur=t; paintCursor(c);
    tip.innerHTML=tipHTML(c,t); tip.classList.add('on'); placeTip(cx,cy);
  }
  function clearCursor(c){
    if(c.cur!=null){ c.cur=null; paintCursor(c); }
    tip.classList.remove('on');
  }
  function locate(c,ev){ const b=c.svg.getBoundingClientRect(); if(!b.width) return null; const s=c.W/b.width; return [(ev.clientX-b.left)*s,(ev.clientY-b.top)*s]; }
  function nearest(c,q){
    const r=RUN[c.deg], n=shown(c);
    let best=null, bd=14*14;
    for(let t=0;t<n;t++){
      const dx=c.X(r.A[t])-q[0], dy=c.Y(r.B[t])-q[1], d=dx*dx+dy*dy;
      if(d<=bd){ bd=d; best=t; }
    }
    return best;
  }
  function wire(c){
    const svg=c.svg;
    const move=ev=>{
      if(st.play) return;
      const q=locate(c,ev); if(!q) return;
      const t=nearest(c,q);
      if(t==null) clearCursor(c); else showCursor(c,t,ev.clientX,ev.clientY);
    };
    svg.addEventListener('pointermove',move);
    svg.addEventListener('pointerdown',move);
    svg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse') clearCursor(c); });
    svg.addEventListener('keydown',ev=>{
      if(st.play) return;
      const r=RUN[c.deg], mx=shown(c)-1, big=ev.shiftKey?10:1;
      let t=c.cur==null?-1:c.cur;
      if(ev.key==='ArrowRight'||ev.key==='ArrowUp') t=t<0?0:t+big;
      else if(ev.key==='ArrowLeft'||ev.key==='ArrowDown') t=t<0?0:t-big;
      else if(ev.key==='PageUp') t=t<0?0:t+100;
      else if(ev.key==='PageDown') t=t<0?0:t-100;
      else if(ev.key==='Home') t=0;
      else if(ev.key==='End') t=mx;
      else if(ev.key==='Escape'){ clearCursor(c); return; }
      else return;
      ev.preventDefault();
      t=clamp(t,0,mx);
      const b=svg.getBoundingClientRect(), s=b.width/c.W;
      const px=clamp(c.X(r.A[t]),c.m.l,c.m.l+c.pw), py=clamp(c.Y(r.B[t]),c.m.t,c.m.t+c.ph);
      showCursor(c,t,b.left+px*s,b.top+py*s);
    });
    svg.addEventListener('blur',()=>clearCursor(c));
  }
  document.addEventListener('pointerdown',ev=>{
    if(fig.contains(ev.target)) return;
    [4,2].forEach(d=>{ if(P[d]) clearCursor(P[d]); });
  },true);

  /* ---------- replay ---------- */
  function syncPlay(){
    const playing=!!st.play, partial=st.p<1;
    bPlay.textContent=playing?'pause':(partial?'play':'replay');
    bPlay.setAttribute('aria-label',playing?'Pause the replay':(partial?'Continue the replay':'Replay the iterations'));
  }
  function tick(){
    const pl=st.play; if(!pl) return;
    const p=Math.min(1,pl.p0+(performance.now()-pl.t0)/DUR);
    if(p!==st.p){ st.p=p; [4,2].forEach(d=>paintMore(P[d])); }
    if(p>=1){ stopPlay(); [4,2].forEach(d=>paintFull(P[d])); return; }
    cancelAnimationFrame(pl.raf); clearTimeout(pl.to);
    pl.raf=requestAnimationFrame(tick); pl.to=setTimeout(tick,60);   // keep going if frames stall
  }
  function stopPlay(){ const pl=st.play; if(!pl) return; cancelAnimationFrame(pl.raf); clearTimeout(pl.to); st.play=null; syncPlay(); }
  function startPlay(){
    tip.classList.remove('on');
    [4,2].forEach(d=>{ P[d].cur=null; paintCursor(P[d]); });
    if(st.p>=1){ st.p=0; [4,2].forEach(d=>paintFull(P[d])); }
    st.play={t0:performance.now(), p0:st.p, raf:0, to:0};
    syncPlay(); tick();
  }
  bPlay.addEventListener('click',()=>{ if(st.play) stopPlay(); else startPlay(); });

  /* ---------- controls ---------- */
  function syncA(){
    const v=st.a0, p=(v-RMIN)/(RMAX-RMIN)*100;
    afill.style.width=p+'%';
    aval.textContent=v.toFixed(2);
    rng.setAttribute('aria-valuetext','a0 = '+v.toFixed(2));
    aticks.forEach(s=>{
      const t=+s.dataset.v; s.style.left=((t-RMIN)/(RMAX-RMIN)*100)+'%';
      s.classList.toggle('on',Math.abs(t-v)<1e-9);
    });
  }
  function buildAll(){ build(4); build(2); }
  function refresh(){
    stopPlay(); st.p=1; tip.classList.remove('on');
    compute(); updStatus(); buildAll(); syncPlay();
  }
  sel.addEventListener('change',()=>{ const e=+sel.value; if(!(e>0)||e===st.eta) return; st.eta=e; refresh(); });
  rng.addEventListener('input',()=>{ const v=Math.round(+rng.value*100)/100; if(v===st.a0) return; st.a0=v; syncA(); refresh(); });
  aticks.forEach(s=>s.addEventListener('click',()=>{ rng.value=s.dataset.v; st.a0=+s.dataset.v; syncA(); refresh(); rng.focus(); }));
  viewBtns.forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.view===st.view) return;
    st.view=b.dataset.view;
    viewBtns.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    const playing=!!st.play; tip.classList.remove('on');
    buildAll();
    if(!playing) syncPlay();
  }));

  /* ---------- init ---------- */
  st.eta=+sel.value||0.1; st.a0=Math.round((+rng.value||0.1)*100)/100;
  syncA(); compute(); updStatus(); buildAll(); syncPlay();
  let lastW=Math.round(fig.clientWidth);
  if(window.ResizeObserver){
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW){ lastW=w; buildAll(); } }).observe(fig);
  }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>buildAll());
})();
