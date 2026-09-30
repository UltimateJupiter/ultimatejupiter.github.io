/* data figures, bundled from figs/*.js by build.py */
/* ---- eos-playground ---- */
/* Figure 1 · EoS playground (fx-eos-playground).
   Live gradient descent on the paper's minimalist model. Degree 4: the 4-layer scalar net ½(1 − xyzw)² with z = x,
   w = y, i.e. GD on ¼(1 − x²y²)² (paper Eq. 2); sharpness is λ1 of paper Eq. 3. Degree 2: GD on ½(1 − xy)² (Sec. 4;
   the ½ matches the paper's Eq. 12 and its experiments), sharpness = top eigenvalue of its 2×2 Hessian.
   Left: loss (log) and sharpness against iteration; right: the iterates in the (x, y) plane with the minima xy = 1,
   their sharpness ticks and the η-EoS minimum (paper Eq. 4). Nothing here is recorded data: every number is computed
   in the browser from the update rule. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-eos-playground');
  if(!fig) return;

  const NS='http://www.w3.org/2000/svg', MINUS='−', ID='fx-eos-playground';
  const $=s=>fig.querySelector(s);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f1=v=>(Math.round(v*10)/10).toString();
  const f2=v=>(Math.round(v*100)/100).toString();
  const neg=s=>s.replace('-',MINUS);
  const fx=(v,n)=>neg((+v).toFixed(n));

  /* ---------- the two objectives (update rules straight from the paper) ---------- */
  const OBJ={
    4:{ name:'Degree 4', T:1000, init:[2.5,0.4001], ks:[8,10,12], view:[1.85,2.6,0.28,0.62],
      step(x,y,eta){ const r=x*x*y*y-1; return [x-eta*x*y*y*r, y-eta*x*x*y*r]; },          // Eq. 2
      loss(x,y){ const r=1-x*x*y*y; return 0.25*r*r; },
      sharp(x,y){                                                                              // Eq. 3, λ1
        const g=x*y, g2=g*g, s=x*x+y*y, a=1-3*g2;
        return 0.5*(s*(3*g2-1)+Math.sqrt(s*s*a*a+4*g2*(3-10*g2+7*g2*g2)));
      },
      minX(l){ const h=l/2; return Math.sqrt((h+Math.sqrt(h*h-4))/2); },                       // 2(x²+y²) = λ on xy = 1
      eosX(eta){ return Math.SQRT1_2*Math.sqrt(Math.sqrt(1/(eta*eta)-4)+1/eta); }             // Eq. 4
    },
    2:{ name:'Degree 2', T:100, init:[3.2,0.25], ks:[10,9.5,9], view:[2.6,3.6,0,0.85],
      step(x,y,eta){ const r=x*y-1; return [x-eta*y*r, y-eta*x*r]; },
      loss(x,y){ const r=1-x*y; return 0.5*r*r; },
      sharp(x,y){ const o=2*x*y-1, d=x*x-y*y; return 0.5*(x*x+y*y+Math.sqrt(d*d+4*o*o)); },   // top eig of [[y²,2xy−1],[2xy−1,x²]]
      minX(l){ return Math.sqrt((l+Math.sqrt(l*l-4))/2); },                                    // x²+y² = λ on xy = 1
      eosX(eta){ const l=2/eta; return Math.sqrt((l+Math.sqrt(l*l-4))/2); }
    }
  };
  const TICKS=[6,8,10,12,14];
  const LIM=[0.05,5];                 // starting points are clamped to this box
  const BOX=[-1,6];                   // iterates outside this box do not stretch the plane's view

  function simulate(o,x,y,k){
    const T=o.T, eta=2/k, xs=new Float64Array(T+1), ys=new Float64Array(T+1), L=new Float64Array(T+1), S=new Float64Array(T+1);
    let n=0, div=-1;
    for(let t=0;;t++){
      xs[t]=x; ys[t]=y; L[t]=o.loss(x,y); S[t]=o.sharp(x,y); n=t+1;
      if(t===T) break;
      const p=o.step(x,y,eta); x=p[0]; y=p[1];
      if(!(Math.abs(x)<=1e4&&Math.abs(y)<=1e4)){ div=t+1; break; }   // also catches NaN
    }
    return {k:k, eta:eta, xs:xs, ys:ys, L:L, S:S, n:n, div:div};
  }

  /* ---------- elements ---------- */
  const sel=$('#'+ID+'-obj'), segBtns=[...fig.querySelectorAll('[data-mode]')];
  const kctl=$('.eosp-kctl'), rng=$('#'+ID+'-k'), kval=$('.eosp-kval'), kfill=$('.eosp-fill'), kticks=[...fig.querySelectorAll('.eosp-ticks span')];
  const legend=$('.eosp-legend'), bPlay=$('.eosp-play'), bReset=$('.eosp-reset'), prog=$('.eosp-prog');
  const boxA=$('[data-chart="loss"]'), boxB=$('[data-chart="sharp"]'), boxC=$('[data-chart="plane"]'), hint=$('.eosp-hint');
  const status=$('.fx-status');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);
  const coarse=!!(window.matchMedia&&matchMedia('(hover: none) and (pointer: coarse)').matches);

  function el(tag,attrs,parent,text){
    const e=document.createElementNS(NS,tag);
    if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]);
    if(text!=null) e.textContent=text;
    if(parent) parent.appendChild(e);
    return e;
  }
  const r2=v=>(Math.round(v*100)/100);

  /* ---------- state ---------- */
  const st={deg:4, mode:'three', k:10, init:OBJ[4].init.slice(), cur:null, reveal:OBJ[4].T, play:null, drag:false};
  let RUNS=[];
  const O=()=>OBJ[st.deg];
  const rid=i=>st.mode==='three'?String(i):'s';
  function compute(){
    const o=O(), ks=st.mode==='three'?o.ks:[st.k];
    RUNS=ks.map((k,i)=>Object.assign(simulate(o,st.init[0],st.init[1],k),{id:rid(i)}));
  }

  /* ---------- number formatting (Unicode minus, no TeX) ---------- */
  function fmtLoss(v){
    if(!isFinite(v)) return '∞';
    if(v===0) return '0';
    if(v>=1e-3&&v<1e3) return v.toPrecision(2);
    const s=v.toExponential(1).split('e'), e=+s[1];
    return s[0]+'e'+(e<0?MINUS+(-e):e);
  }
  const fmtK=k=>String(k);
  const fmtS=v=>isFinite(v)?(Math.abs(v)<1e4?fx(v,3):v.toExponential(2).replace('e+','e')):'∞';
  const fmtXY=v=>Math.abs(v)<1e4?fx(v,4):v.toExponential(2).replace('e+','e');
  const pt=(x,y)=>'('+fx(x,2)+', '+fx(y,2)+')';

  /* ---------- scales ---------- */
  function niceStep(span,n){
    const raw=span/Math.max(1,n), p=Math.pow(10,Math.floor(Math.log10(raw)));
    for(const m of [1,2,2.5,5,10]) if(m*p>=raw-1e-12) return m*p;
    return 10*p;
  }
  function ticks(lo,hi,n){
    const s=niceStep(hi-lo,n), out=[];
    for(let i=Math.ceil(lo/s-1e-9);i*s<=hi+1e-9;i++) out.push(+(i*s).toFixed(10));
    return {s:s, v:out};
  }
  function tickLab(v,s){ let d=0; while(d<6&&Math.abs(Math.round(s*Math.pow(10,d))-s*Math.pow(10,d))>1e-9) d++; return fx(v,d); }

  function lossRange(){
    let mn=Infinity, mx=-Infinity;
    RUNS.forEach(r=>{ for(let t=0;t<r.n;t++){ const v=r.L[t]; if(v>0&&isFinite(v)){ if(v<mn) mn=v; if(v>mx) mx=v; } } });
    if(!isFinite(mn)){ mn=1e-16; mx=1; }
    let lo=Math.max(-16,Math.floor(Math.log10(mn))), hi=Math.min(0,Math.ceil(Math.log10(mx)));
    if(hi<=lo){ hi=Math.min(0,lo+1); lo=hi-2; }
    if(hi-lo<2) lo=Math.max(-16,hi-2);
    return [lo,hi];
  }
  function sharpMax(){
    let mx=0; RUNS.forEach(r=>{ for(let t=0;t<r.n;t++){ const v=r.S[t]; if(isFinite(v)&&v>mx) mx=v; } });
    return Math.min(25,Math.max(20,1.05*mx));
  }
  function planeView(){
    const o=O(), v=o.view.slice();
    let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity;
    const add=(x,y)=>{ if(x<BOX[0]||x>BOX[1]||y<BOX[0]||y>BOX[1]) return; if(x<x0) x0=x; if(x>x1) x1=x; if(y<y0) y0=y; if(y>y1) y1=y; };
    add(st.init[0],st.init[1]);
    RUNS.forEach(r=>{ for(let t=0;t<r.n;t++) add(r.xs[t],r.ys[t]); });
    const px=0.05*Math.max(x1-x0,v[1]-v[0]), py=0.05*Math.max(y1-y0,v[3]-v[2]);
    if(x0-px<v[0]) v[0]=x0-px; if(x1+px>v[1]) v[1]=x1+px;
    if(y0-py<v[2]) v[2]=y0-py; if(y1+py>v[3]) v[3]=y1+py;
    return v;
  }

  /* ---------- charts ---------- */
  let A=null, B=null, C=null, clipN=0;
  function frame(box,H,m,label){
    const W=Math.max(200,Math.round(box.clientWidth)||300);
    box.textContent='';
    const svg=el('svg',{class:'fx-svg',viewBox:'0 0 '+W+' '+H,width:W,height:H,role:'img',tabindex:0},box);
    return {svg:svg, W:W, H:H, m:m, pw:W-m.l-m.r, ph:H-m.t-m.b};
  }
  function xAxis(c,T,withTitle){
    const X=t=>c.m.l+c.pw*t/T, tk=ticks(0,T,Math.max(3,Math.floor(c.pw/60)));
    const y=Math.round(c.m.t+c.ph)+.5;
    el('line',{class:'ax',x1:c.m.l,x2:c.m.l+c.pw,y1:y,y2:y},c.g);
    tk.v.forEach(v=>el('text',{x:r2(X(v)),y:c.m.t+c.ph+14,'text-anchor':'middle'},c.g,String(v)));
    if(withTitle) el('text',{x:c.m.l+c.pw,y:c.H-3,'text-anchor':'end'},c.g,'iteration');
    c.X=X;
  }
  function buildA(){
    const T=O().T, c=frame(boxA,132,{l:46,r:26,t:8,b:20});   // same x extent as the sharpness panel below
    c.g=el('g',{},c.svg);
    const lr=lossRange(), lo=lr[0], hi=lr[1];
    c.lo=lo; c.hi=hi;
    c.Y=v=>{ const l=v>0?Math.log10(v):-Infinity; return c.m.t+c.ph*(hi-clamp(isFinite(l)?l:(v>0?hi:lo),lo,hi))/(hi-lo); };
    const span=hi-lo, per=c.ph/span, ds=[1,2,4,5,8,10,16].find(d=>d*per>=19)||16;
    for(let e=hi;e>=lo;e--){
      if(e%ds) continue;
      const y=Math.round(c.m.t+c.ph*(hi-e)/span)+.5;
      el('line',{class:'gr',x1:c.m.l,x2:c.m.l+c.pw,y1:y,y2:y},c.g);
      const t=el('text',{x:c.m.l-6,y:y+3.5,'text-anchor':'end'},c.g);
      if(e===0) t.textContent='1';
      else{ el('tspan',{},t,'10'); el('tspan',{class:'sup',dy:-4.5},t,e<0?MINUS+(-e):String(e)); }
    }
    el('line',{class:'ax',x1:Math.round(c.m.l)+.5,x2:Math.round(c.m.l)+.5,y1:c.m.t,y2:c.m.t+c.ph},c.g);
    xAxis(c,T,false);
    c.data=el('g',{},c.svg); c.over=el('g',{},c.svg);
    c.hit=el('rect',{class:'hit',x:c.m.l-4,y:0,width:c.pw+8,height:c.H},c.svg);
    A=c;
  }
  function buildB(){
    const T=O().T, c=frame(boxB,200,{l:46,r:26,t:14,b:34});
    c.g=el('g',{},c.svg);
    const ym=c.ym=sharpMax();
    c.Y=v=>c.m.t+c.ph*(1-clamp(isFinite(v)?v:ym,0,ym)/ym);
    const tk=ticks(0,ym,Math.max(3,Math.floor(c.ph/34)));
    tk.v.forEach(v=>{
      const y=Math.round(c.Y(v))+.5;
      if(v>0) el('line',{class:'gr',x1:c.m.l,x2:c.m.l+c.pw,y1:y,y2:y},c.g);
      el('text',{x:c.m.l-6,y:y+3.5,'text-anchor':'end'},c.g,String(v));
    });
    el('line',{class:'ax',x1:Math.round(c.m.l)+.5,x2:Math.round(c.m.l)+.5,y1:c.m.t,y2:c.m.t+c.ph},c.g);
    xAxis(c,T,true);
    // dashed stability thresholds 2/η, labelled directly in the right gutter (values only, under a "2/η" head)
    const lab=el('g',{},c.svg), xr=c.m.l+c.pw+4, LS=[];
    RUNS.forEach(r=>{
      if(r.k>ym) return;
      const y=Math.round(c.Y(r.k))+.5, g=el('g',{'data-r':r.id},c.g);
      el('line',{class:'thr',x1:c.m.l,x2:c.m.l+c.pw,y1:y,y2:y},g);
      LS.push({y:y, p:y, r:r});
    });
    // dodge: keep labels at least 11px apart, then recentre the group on the lines
    LS.sort((a,b)=>a.y-b.y);
    for(let i=1;i<LS.length;i++) if(LS[i].p-LS[i-1].p<11) LS[i].p=LS[i-1].p+11;
    const sh=LS.reduce((a,q)=>a+q.p-q.y,0)/Math.max(1,LS.length);
    LS.forEach(q=>{ el('text',{class:'thr-lab',x:xr,y:r2(q.p-sh+3.5),'data-r':q.r.id},lab,fmtK(q.r.k)); });
    if(LS.length) el('text',{x:c.m.l+c.pw+c.m.r,y:r2(LS[0].p-sh-9),'text-anchor':'end'},lab,'2/η');
    c.data=el('g',{},c.svg); c.svg.appendChild(lab); c.over=el('g',{},c.svg);
    c.hit=el('rect',{class:'hit',x:c.m.l-4,y:0,width:c.pw+8,height:c.H},c.svg);
    B=c;
  }

  function buildC(){
    const o=O(), W0=Math.max(200,Math.round(boxC.clientWidth)||300), H=Math.round(clamp(W0*1.05,260,352));
    const c=frame(boxC,H,{l:42,r:10,t:8,b:34});
    c.svg.setAttribute('aria-describedby',ID+'-hint');
    c.svg.classList.add('eosp-plane');
    const v=c.v=planeView(), x0=v[0], x1=v[1], y0=v[2], y1=v[3];
    c.X=x=>c.m.l+c.pw*(x-x0)/(x1-x0);
    c.Y=y=>c.m.t+c.ph*(1-(y-y0)/(y1-y0));
    c.ix=px=>x0+(px-c.m.l)/c.pw*(x1-x0);
    c.iy=py=>y0+(1-(py-c.m.t)/c.ph)*(y1-y0);
    const g=c.g=el('g',{},c.svg);
    const tx=ticks(x0,x1,Math.max(3,Math.floor(c.pw/58))), ty=ticks(y0,y1,Math.max(3,Math.floor(c.ph/42)));
    tx.v.forEach(x=>{ const px=Math.round(c.X(x))+.5; el('line',{class:'gr',x1:px,x2:px,y1:c.m.t,y2:c.m.t+c.ph},g);
      const lab=tickLab(x,tx.s), hw=lab.length*3.2;   // keep the last label inside the svg
      el('text',{x:r2(Math.min(px,c.W-hw-1)),y:c.m.t+c.ph+14,'text-anchor':'middle'},g,lab); });
    ty.v.forEach(y=>{ const py=Math.round(c.Y(y))+.5; el('line',{class:'gr',x1:c.m.l,x2:c.m.l+c.pw,y1:py,y2:py},g);
      el('text',{x:c.m.l-6,y:py+3.5,'text-anchor':'end'},g,tickLab(y,ty.s)); });
    const yb=Math.round(c.m.t+c.ph)+.5, xl=Math.round(c.m.l)+.5;
    el('line',{class:'ax',x1:c.m.l,x2:c.m.l+c.pw,y1:yb,y2:yb},g);
    el('line',{class:'ax',x1:xl,x2:xl,y1:c.m.t,y2:c.m.t+c.ph},g);
    el('text',{class:'axn',x:c.m.l+c.pw,y:c.H-4,'text-anchor':'end'},g,'x');
    el('text',{class:'axn',x:4,y:c.m.t+9},g,'y');

    const cid=ID+'-clip'+(++clipN), defs=el('defs',{},c.svg), cp=el('clipPath',{id:cid},defs);
    el('rect',{x:c.m.l,y:c.m.t-3,width:c.pw+3,height:c.ph+3},cp);
    const clip=el('g',{'clip-path':'url(#'+cid+')'},c.svg);

    // global minima: xy = 1, and for degree 4 also xy = −1 (x²y² = 1). A branch (sx, sy) is the curve (sx·u, sy/u), u > 0.
    const BR=st.deg===4?[[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,1],[-1,-1]];
    const ex=0.012*(x1-x0), ey=0.012*(y1-y0), inV=(x,y)=>x>=x0&&x<=x1&&y>=y0&&y<=y1;
    const near=(x,y)=>x>=x0-ex&&x<=x1+ex&&y>=y0-ey&&y<=y1+ey;
    const vis=[];                                   // per branch: parameter values u whose point is in view
    BR.forEach(b=>{
      let d='', on=false; const us=[];
      for(let i=0;i<=2400;i++){
        const u=Math.pow(10,-2+4*i/2400), x=b[0]*u, y=b[1]/u;
        if(near(x,y)){ d+=(on?'L':'M')+r2(c.X(x))+' '+r2(c.Y(y)); on=true; if(inV(x,y)) us.push(u); } else on=false;
      }
      if(d) el('path',{class:'minc',d:d},clip);
      vis.push(us);
    });
    // pixel positions of every iterate, to keep labels off the data
    const occ=[];
    RUNS.forEach(r=>{ for(let t=0;t<r.n;t++){ const px=c.X(r.xs[t]), py=c.Y(r.ys[t]); if(px>=c.m.l-4&&px<=c.m.l+c.pw+4&&py>=c.m.t-4&&py<=c.m.t+c.ph+4) occ.push(px,py); } });
    occ.push(c.X(st.init[0]),c.Y(st.init[1]));
    const hard=[];   // boxes of labels and tick marks already placed
    const busy=(bx0,by0,bx1,by1)=>{ let n=0; for(let i=0;i<occ.length;i+=2){ const x=occ[i], y=occ[i+1]; if(x>bx0-3&&x<bx1+3&&y>by0-3&&y<by1+3) n++; }
      hard.forEach(h=>{ if(bx0<h[2]+3&&bx1>h[0]-3&&by0<h[3]+3&&by1>h[1]-3) n+=40; }); return n; };
    const inPlot=(bx0,by0,bx1,by1)=>bx0>=c.m.l+2&&bx1<=c.m.l+c.pw-2&&by0>=c.m.t&&by1<=c.m.t+c.ph-2;
    const labs=el('g',{},c.svg);
    // sharpness ticks on the minima: label on whichever side of the curve is emptier
    BR.forEach(b=>{
      TICKS.forEach(l=>{
        const u=o.minX(l), x=b[0]*u, y=b[1]/u; if(!inV(x,y)) return;
        const px=c.X(x), py=c.Y(y), e=1e-4, dx=c.X(b[0]*(u+e))-c.X(b[0]*(u-e)), dy=c.Y(b[1]/(u+e))-c.Y(b[1]/(u-e)), L=Math.hypot(dx,dy);
        const nx=dy/L, ny=-dx/L;
        el('line',{class:'mtk',x1:r2(px-nx*4),y1:r2(py-ny*4),x2:r2(px+nx*4),y2:r2(py+ny*4)},clip);
        hard.push([px-5,py-5,px+5,py+5]);
        const w=String(l).length*6.4+2;
        let best=null, bs=Infinity;
        [13,-13,20,-20].forEach(d=>{
          const cx=px+nx*d, cy=py+ny*d, bx=[cx-w/2,cy-6,cx+w/2,cy+6];
          if(!inPlot(bx[0],bx[1],bx[2],bx[3])) return;
          const sc=busy(bx[0],bx[1],bx[2],bx[3])+(Math.abs(d)>13?2:0)+(d<0?.5:0);
          if(sc<bs){ bs=sc; best=[cx,cy]; }
        });
        if(best){ el('text',{class:'mtk-lab',x:r2(best[0]),y:r2(best[1]+3.5),'text-anchor':'middle'},labs,String(l)); hard.push([best[0]-w/2,best[1]-6,best[0]+w/2,best[1]+6]); }
      });
    });
    // curve labels: the emptiest spot beside each visible branch
    BR.forEach((b,bi)=>{
      const us=vis[bi]; if(us.length<4) return;
      const txt=b[0]*b[1]>0?'xy = 1':'xy = '+MINUS+'1', w=txt.length*6.2+4, cy=u=>c.Y(b[1]/u);
      let best=null, bs=Infinity;
      for(let i=1;i<20;i++){
        const u=us[Math.floor(us.length*i/20)], px=c.X(b[0]*u), py=cy(u);
        for(const d of [[4,-8,'start'],[-4,-8,'end'],[4,16,'start'],[-4,16,'end']]){
          const ax=px+d[0], ay=py+d[1], bx=d[2]==='start'?[ax,ay-10,ax+w,ay+2]:[ax-w,ay-10,ax,ay+2];
          if(!inPlot(bx[0],bx[1],bx[2],bx[3])) continue;
          let hit=false;
          for(const qx of [bx[0],(bx[0]+bx[2])/2,bx[2]]){ const xv=c.ix(qx), uu=b[0]*xv; if(uu>0){ const yy=cy(uu); if(yy>bx[1]-2&&yy<bx[3]+2) hit=true; } }
          const sc=busy(bx[0],bx[1],bx[2],bx[3])*3+(hit?20:0)+Math.abs(i-15)*0.1;
          if(sc<bs){ bs=sc; best=[ax,ay,d[2],bx]; }
        }
      }
      if(best){ el('text',{class:'minc-lab',x:r2(best[0]),y:r2(best[1]),'text-anchor':best[2]},labs,txt); hard.push(best[3]); }
    });
    c.data=el('g',{},clip);
    // η-EoS minima (Eq. 4): open diamonds above the iterates, so the endpoints next to them stay visible
    const dia=el('g',{},c.svg);
    RUNS.forEach(r=>{
      BR.forEach(b=>{
        const u=o.eosX(r.eta), x=b[0]*u, y=b[1]/u; if(!inV(x,y)) return;
        const px=c.X(x), py=c.Y(y), s=5.5, d='M'+r2(px)+' '+r2(py-s)+'L'+r2(px+s)+' '+r2(py)+'L'+r2(px)+' '+r2(py+s)+'L'+r2(px-s)+' '+r2(py)+'Z';
        el('path',{class:'dia-bg',d:d},dia); el('path',{class:'dia','data-r':r.id,d:d},dia);
      });
    });
    c.svg.appendChild(labs);
    c.initG=el('g',{},c.svg);
    c.over=el('g',{},c.svg);
    C=c;
  }

  /* ---------- painting (also used by the replay) ---------- */
  const dot=(x,y,r)=>'M'+r2(x-r)+' '+r2(y)+'a'+r+' '+r+' 0 1 0 '+(2*r)+' 0a'+r+' '+r+' 0 1 0 '+(-2*r)+' 0';
  function paintSeries(c,key){
    c.data.textContent='';
    RUNS.forEach(r=>{
      const n=Math.min(r.n,st.reveal+1), g=el('g',{'data-r':r.id},c.data), arr=r[key];
      let ln='', ds='';
      for(let t=0;t<n;t++){ const x=c.X(t), y=c.Y(arr[t]); ln+=(t?'L':'M')+r2(x)+' '+r2(y); ds+=dot(x,y,1.05); }
      el('path',{class:'ln',d:ln},g); el('path',{class:'dots',d:ds},g);
    });
  }
  function paintPlane(){
    const c=C; c.data.textContent='';
    RUNS.forEach(r=>{
      const n=Math.min(r.n,st.reveal+1), g=el('g',{'data-r':r.id},c.data);
      let ln='', ev='', od='';
      for(let t=0;t<n;t++){
        const x=c.X(r.xs[t]), y=c.Y(r.ys[t]);
        if(Math.abs(x)>1e5||Math.abs(y)>1e5) break;
        ln+=(t?'L':'M')+r2(x)+' '+r2(y);
        if(t%2) od+=dot(x,y,2); else ev+=dot(x,y,2);
      }
      el('path',{class:'path',d:ln},g); el('path',{class:'ev',d:ev},g); el('path',{class:'od',d:od},g);
    });
    c.initG.textContent='';
    const ix=c.X(st.init[0]), iy=c.Y(st.init[1]), s=4, d='M'+r2(ix-s)+' '+r2(iy-s)+'L'+r2(ix+s)+' '+r2(iy+s)+'M'+r2(ix-s)+' '+r2(iy+s)+'L'+r2(ix+s)+' '+r2(iy-s);
    el('path',{class:'init-bg',d:d},c.initG); el('path',{class:'init',d:d},c.initG);
  }
  function paintCursor(){
    [A,B,C].forEach(c=>{ if(c) c.over.textContent=''; });
    const t=st.cur; if(t==null) return;
    [[A,'L'],[B,'S']].forEach(q=>{
      const c=q[0], x=Math.round(c.X(t))+.5;
      el('line',{class:'hair',x1:x,x2:x,y1:c.m.t,y2:c.m.t+c.ph},c.over);
      RUNS.forEach(r=>{ if(t<r.n) el('circle',{class:'cur','data-r':r.id,cx:r2(c.X(t)),cy:r2(c.Y(r[q[1]][t])),r:3},c.over); });
    });
    RUNS.forEach(r=>{
      if(t>=r.n) return;
      const x=C.X(r.xs[t]), y=C.Y(r.ys[t]);
      if(x<C.m.l-6||x>C.m.l+C.pw+6||y<C.m.t-6||y>C.m.t+C.ph+6) return;
      el('circle',{class:'ring-bg',cx:r2(x),cy:r2(y),r:5.5},C.over);
      el('circle',{class:'ring',cx:r2(x),cy:r2(y),r:5.5},C.over);
    });
  }
  function paint(){ paintSeries(A,'L'); paintSeries(B,'S'); paintPlane(); paintCursor(); syncPlay(); }

  function build(){
    buildA(); buildB(); buildC();
    [A,B].forEach(c=>wireSeries(c)); wirePlane();
    paint(); aria();
  }

  /* ---------- tooltip ---------- */
  function tipHTML(t){
    const cols='grid-template-columns:auto'+' auto'.repeat(RUNS.length);
    let h='<b>step '+t+'</b><div class="eosp-tt" style="'+cols+'"><span class="k">2/η</span>';
    RUNS.forEach(r=>{ h+='<span class="h" data-r="'+r.id+'">'+fmtK(r.k)+'</span>'; });
    [['loss','L',fmtLoss],['λ₁','S',fmtS],['x','xs',fmtXY],['y','ys',fmtXY]].forEach(q=>{
      h+='<span class="k">'+q[0]+'</span>';
      RUNS.forEach(r=>{ h+='<span>'+(t<r.n?q[2](r[q[1]][t]):(r.div>0?'diverged':'—'))+'</span>'; });
    });
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
  function showCursor(t,cx,cy){
    st.cur=t; paintCursor();
    tip.innerHTML=tipHTML(t); tip.classList.add('on'); placeTip(cx,cy);
  }
  function clearCursor(){
    if(st.play) return;
    if(st.cur!=null){ st.cur=null; paintCursor(); }
    tip.classList.remove('on');
  }
  function locate(c,ev){ const b=c.svg.getBoundingClientRect(); if(!b.width) return null; const s=c.W/b.width; return [(ev.clientX-b.left)*s,(ev.clientY-b.top)*s]; }
  const maxT=()=>Math.min(st.reveal,Math.max(...RUNS.map(r=>r.n-1)));

  function wireSeries(c){
    const T=O().T;
    const move=ev=>{
      if(st.play) return;
      const q=locate(c,ev); if(!q) return;
      if(q[0]<c.m.l-6||q[0]>c.m.l+c.pw+6){ clearCursor(); return; }
      const t=clamp(Math.round((q[0]-c.m.l)/c.pw*T),0,maxT());
      showCursor(t,ev.clientX,ev.clientY);
    };
    c.svg.addEventListener('pointermove',move);
    c.svg.addEventListener('pointerdown',move);
    c.svg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse') clearCursor(); });
    c.svg.addEventListener('keydown',ev=>{
      if(st.play) return;
      const m=maxT(), big=ev.shiftKey?10:1; let t=st.cur==null?-1:st.cur;
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

  function wirePlane(){
    const c=C, svg=c.svg;
    const nearest=q=>{
      let best=null, bd=64;
      RUNS.forEach(r=>{ const n=Math.min(r.n,st.reveal+1); for(let t=0;t<n;t++){ const dx=c.X(r.xs[t])-q[0], dy=c.Y(r.ys[t])-q[1], d=dx*dx+dy*dy; if(d<=bd){ bd=d; best=t; } } });
      return best;
    };
    const setFrom=q=>{
      const x=clamp(c.ix(q[0]),LIM[0],LIM[1]), y=clamp(c.iy(q[1]),LIM[0],LIM[1]);
      setInit(Math.round(x*1000)/1000,Math.round(y*1000)/1000);
    };
    svg.addEventListener('pointerdown',ev=>{
      if(ev.pointerType!=='mouse'||ev.button!==0) return;
      const q=locate(c,ev); if(!q) return;
      ev.preventDefault(); svg.focus({preventScroll:true});
      st.drag=true;
      try{ svg.setPointerCapture(ev.pointerId); }catch(e){ /* capture is optional */ }
      tip.classList.remove('on'); setFrom(q);
    });
    svg.addEventListener('pointermove',ev=>{
      const q=locate(C,ev); if(!q) return;
      if(st.drag){ setFrom(q); return; }
      if(ev.pointerType!=='mouse'||st.play) return;
      const t=nearest(q);
      if(t==null) clearCursor(); else showCursor(t,ev.clientX,ev.clientY);
    });
    const end=()=>{ if(!st.drag) return; st.drag=false; const had=document.activeElement===C.svg; build(); if(had) C.svg.focus({preventScroll:true}); };
    svg.addEventListener('pointerup',end);
    svg.addEventListener('pointercancel',end);
    svg.addEventListener('lostpointercapture',end);
    svg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse'&&!st.drag) clearCursor(); });
    // touch and pen: a tap (not a scroll, which cancels the click) sets the start
    let lastType='mouse';
    svg.addEventListener('pointerdown',ev=>{ lastType=ev.pointerType; },true);
    svg.addEventListener('click',ev=>{
      if(lastType==='mouse') return;
      const q=locate(C,ev); if(q) setFrom(q);
    });
    svg.addEventListener('keydown',ev=>{
      const d=ev.shiftKey?0.1:0.01; let x=st.init[0], y=st.init[1];
      if(ev.key==='ArrowRight') x+=d; else if(ev.key==='ArrowLeft') x-=d;
      else if(ev.key==='ArrowUp') y+=d; else if(ev.key==='ArrowDown') y-=d;
      else return;
      ev.preventDefault();
      setInit(Math.round(clamp(x,LIM[0],LIM[1])*10000)/10000,Math.round(clamp(y,LIM[0],LIM[1])*10000)/10000,true);
    });
  }

  /* ---------- replay ---------- */
  const DUR={4:5000, 2:3000};
  function syncPlay(){
    const T=O().T, playing=!!st.play, partial=st.reveal<T;
    bPlay.textContent=playing?'pause':(partial?'play':'replay');
    bPlay.setAttribute('aria-label',playing?'Pause the replay':(partial?'Continue the replay':'Replay the iterations'));
    prog.textContent=(playing||partial)?'step '+st.reveal+' / '+T:'';
  }
  function tick(){
    const p=st.play; if(!p) return;
    const T=O().T, r=Math.min(T,p.r0+Math.floor((performance.now()-p.t0)*T/DUR[st.deg]));
    if(r!==st.reveal){ st.reveal=r; st.cur=r; paint(); }
    if(r>=T){ stopPlay(); st.cur=null; paint(); return; }
    cancelAnimationFrame(p.raf); clearTimeout(p.to);
    p.raf=requestAnimationFrame(tick); p.to=setTimeout(tick,50);   // keep going if frames stall
  }
  function stopPlay(){ const p=st.play; if(!p) return; cancelAnimationFrame(p.raf); clearTimeout(p.to); st.play=null; syncPlay(); }
  function startPlay(){
    const T=O().T;
    tip.classList.remove('on');
    if(st.reveal>=T){ st.reveal=0; }
    st.play={t0:performance.now(), r0:st.reveal, raf:0, to:0};
    st.cur=st.reveal; paint(); tick();
  }
  bPlay.addEventListener('click',()=>{ if(st.play){ stopPlay(); } else startPlay(); });

  /* ---------- text ---------- */
  function endText(r){ return r.div>0?'diverged at step '+r.div:fx(r.S[r.n-1],3); }
  function updStatus(){
    const o=O(), r0=RUNS[0];
    let s='<b>'+o.name+'</b> from '+pt(st.init[0],st.init[1])+', initial sharpness '+fx(r0.S[0],2)+'. ';
    if(st.mode==='three'){
      s+='After '+o.T+' steps: '+RUNS.map((r,i)=>(i?'':'2/η = ')+fmtK(r.k)+' → <b>'+endText(r)+'</b>').join(', ')+'.';
    }else if(r0.div>0){
      s+='At 2/η = '+fmtK(r0.k)+' the run <b>diverged at step '+r0.div+'</b>.';
    }else{
      const lam=r0.S[r0.n-1], gap=lam-r0.k;
      s+='After '+o.T+' steps at 2/η = '+fmtK(r0.k)+': sharpness <b>'+fx(lam,3)+'</b> = 2/η '+(gap<0?MINUS:'+')+' '+Math.abs(gap).toFixed(3)+', loss '+fmtLoss(r0.L[r0.n-1])+'.';
    }
    status.innerHTML=s;
  }
  function aria(){
    const o=O(), ks=RUNS.map(r=>fmtK(r.k)).join(', '), from=' from '+pt(st.init[0],st.init[1]);
    const fin=f=>RUNS.map(r=>'2/η = '+fmtK(r.k)+': '+(r.div>0?'diverged at step '+r.div:f(r))).join('; ');
    A.svg.setAttribute('aria-label','Loss against iteration, log scale, '+o.name.toLowerCase()+' objective, 2/η = '+ks+from+'. Final loss '+fin(r=>fmtLoss(r.L[r.n-1]))+'. Arrow keys step through iterations.');
    B.svg.setAttribute('aria-label','Sharpness λ1 against iteration with dashed lines at 2/η, '+o.name.toLowerCase()+' objective'+from+'. Starts at '+fx(RUNS[0].S[0],2)+'. Final sharpness '+fin(r=>fx(r.S[r.n-1],3))+'. Arrow keys step through iterations.');
    C.svg.setAttribute('aria-label','Iterates in the (x, y) plane with the global minima xy = 1'+from+'. Final points '+
      fin(r=>'('+fx(r.xs[r.n-1],4)+', '+fx(r.ys[r.n-1],4)+'), EoS minimum x = '+fx(o.eosX(r.eta),3))+'. Arrow keys move the starting point by 0.01, with Shift by 0.1.');
  }
  function updLegend(){
    legend.textContent='';
    legend.hidden=st.mode!=='three';
    if(st.mode!=='three') return;
    RUNS.forEach(r=>{
      const s=document.createElement('span'); s.setAttribute('data-r',r.id);
      const sw=document.createElement('i'); sw.className='sw'; s.appendChild(sw);
      s.appendChild(document.createTextNode('2/η = '+fmtK(r.k)));
      legend.appendChild(s);
    });
  }
  function updHint(){
    hint.textContent='● even ○ odd · '+(coarse?'tap':'click')+' to set the start';
  }
  function syncK(){
    const k=+rng.value, p=(k-6)/8*100;
    kfill.style.width=p+'%';
    kval.textContent=f1(k)+' · η = '+(+(2/k).toFixed(4));
    rng.setAttribute('aria-valuetext','2/η = '+f1(k)+', η = '+(+(2/k).toFixed(4)));
    kticks.forEach(s=>s.classList.toggle('on',+s.dataset.v===k));
  }

  /* ---------- state changes ---------- */
  // keepPlane: while dragging the start, the plane keeps its svg (and pointer capture) and its view; only data is redrawn
  function refresh(keepPlane){
    stopPlay(); st.reveal=O().T; st.cur=null; tip.classList.remove('on');
    compute(); updLegend(); updStatus();
    if(keepPlane&&C){ buildA(); buildB(); [A,B].forEach(wireSeries); paint(); aria(); }
    else build();
  }
  function setInit(x,y,refocus){
    st.init=[x,y]; refresh(st.drag);
    if(refocus) C.svg.focus({preventScroll:true});
  }
  sel.addEventListener('change',()=>{
    const d=+sel.value; if(!OBJ[d]||d===st.deg) return;
    st.deg=d; st.init=OBJ[d].init.slice(); refresh();
  });
  segBtns.forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.mode===st.mode) return;
    st.mode=b.dataset.mode;
    segBtns.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    kctl.hidden=st.mode!=='one';
    refresh();
  }));
  rng.addEventListener('input',()=>{ st.k=+rng.value; syncK(); refresh(); });
  kticks.forEach(s=>s.addEventListener('click',()=>{ rng.value=s.dataset.v; st.k=+rng.value; syncK(); refresh(); rng.focus(); }));
  bReset.addEventListener('click',()=>{ st.init=O().init.slice(); refresh(); });
  document.addEventListener('pointerdown',ev=>{ if(st.cur!=null&&!st.play&&!fig.contains(ev.target)) clearCursor(); },true);

  let lastW=0;
  updHint(); syncK(); compute(); updLegend(); updStatus(); build(); lastW=Math.round(fig.clientWidth);
  if(window.ResizeObserver){
    let rq=0;   // rebuild on the next frame, outside the observer callback (avoids a resize-loop notification)
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW){ lastW=w; cancelAnimationFrame(rq); rq=requestAnimationFrame(()=>{ if(!st.play) st.cur=null; tip.classList.remove('on'); build(); }); } }).observe(fig);
  }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>build());
})();

/* ---- init-map ---- */
/* Figure 2 · sharpness reached from each initialization (fx-init-map).
   Live simulation, nothing precomputed. For every cell centre (x0, y0) of a 160×160 grid, run gradient descent
     degree 4, L = ¼(1 − x²y²)² (paper Eq. 2):  x' = x − η x y² (x²y² − 1),  y' = y − η x² y (x²y² − 1)
     degree 2, L = ½(1 − xy)²   (paper Sec. 4):  x' = x − η y (xy − 1),        y' = y − η x (xy − 1)
   for up to 50000 steps (as in the paper's Figs. 2b, 5b, 10). Converged: |x²y² − 1| < 1e−12 (or |xy − 1|);
   the cell is coloured by the sharpness there: degree 4 uses λ1 of paper Eq. 3, degree 2 the top eigenvalue of
   [[y², 2xy − 1], [2xy − 1, x²]]. Diverged: |x| or |y| > 1e4 or NaN. Rows are computed in time-boxed chunks per
   animation frame and drawn as they finish, so the page never blocks. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-init-map');
  if(!fig) return;

  const NS='http://www.w3.org/2000/svg';
  const N=160, MAXIT=50000, TOL=1e-12, DIVB=1e4, NTRAJ=400, BAND=0.1, RAMP=85, BUDGET=12;
  const $=id=>document.getElementById(id);
  const selObj=$('fx-init-map-obj'), selEta=$('fx-init-map-eta'), seg=$('fx-init-map-view'), main=$('fx-init-map-main'),
        plot=$('fx-init-map-plot'), cvs=$('fx-init-map-cvs'), svg=$('fx-init-map-svg'), hint=$('fx-init-map-hint'),
        pathP=$('fx-init-map-path'), pathT=$('fx-init-map-pathtxt'), bClear=$('fx-init-map-clear'),
        uncLi=$('fx-init-map-unc'), status=$('fx-init-map-status');
  const vBtns=[...seg.querySelectorAll('button')], bEdge=seg.querySelector('[data-view="edge"]');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);
  const probe=document.createElement('span'); probe.className='im-probe'; probe.setAttribute('aria-hidden','true'); fig.appendChild(probe);
  const coarse=!!(window.matchMedia&&matchMedia('(hover: none) and (pointer: coarse)').matches);

  /* ---------- helpers ---------- */
  function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function txt(parent,x,y,s,cls,anchor){ const t=el('text',{x:x,y:y},parent); if(cls) t.setAttribute('class',cls); if(anchor) t.setAttribute('text-anchor',anchor); t.textContent=s; return t; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f1=v=>(+v).toFixed(1);
  const f2=v=>(+v).toFixed(2);
  const int=v=>Math.round(v).toLocaleString('en-US');
  const pct=v=>v===0?'0':v>=1?v.toFixed(1):v>=0.1?v.toFixed(1):v.toFixed(2);
  const trim=v=>String(+(+v).toFixed(2));
  // one frame of work: requestAnimationFrame, with a timer fallback for hidden tabs and headless runs
  function nextFrame(cb){ let done=false; const f=()=>{ if(!done){ done=true; cb(); } }; requestAnimationFrame(f); setTimeout(f,20); }

  /* ---------- the paper's model ---------- */
  function lam4(x,y){            // paper Eq. 3, λ1, with γ = xy
    const g=x*y, s=x*x+y*y, g2=g*g, u=1-3*g2;
    return 0.5*(s*(3*g2-1)+Math.sqrt(s*s*u*u+4*g2*(3-10*g2+7*g2*g2)));
  }
  function lam2(x,y){            // top eigenvalue of the Hessian of ½(1 − xy)²
    const a=y*y, d=x*x, o=2*x*y-1;
    return 0.5*(a+d+Math.sqrt((a-d)*(a-d)+4*o*o));
  }
  const sharp=(deg,x,y)=>deg===4?lam4(x,y):lam2(x,y);
  // EoS minima: degree 4 from paper Eq. 4 (x̆² + y̆² = 1/η, x̆y̆ = 1); degree 2 from x² + y² = 2/η, xy = 1
  function eosMin(deg,eta){
    let x;
    if(deg===4) x=Math.SQRT1_2*Math.sqrt(Math.sqrt(1/(eta*eta)-4)+1/eta);
    else x=Math.sqrt((2/eta+Math.sqrt(4/(eta*eta)-4))/2);
    return [x,1/x];
  }
  /* one run; writes its outcome to R: code 1 converged, 2 diverged, 3 not converged; t = step; lam = final sharpness */
  const R={code:0,t:0,lam:0};
  function runCell(deg,eta,x,y){
    if(deg===4){
      for(let t=1;t<=MAXIT;t++){
        const r=x*x*y*y-1, nx=x-eta*x*y*y*r, ny=y-eta*x*x*y*r;
        x=nx; y=ny;
        if(!(Math.abs(x)<=DIVB&&Math.abs(y)<=DIVB)){ R.code=2; R.t=t; R.lam=NaN; return; }
        const p=x*y;
        if(Math.abs(p*p-1)<TOL){ R.code=1; R.t=t; R.lam=lam4(x,y); return; }
      }
    } else {
      for(let t=1;t<=MAXIT;t++){
        const r=x*y-1, nx=x-eta*y*r, ny=y-eta*x*r;
        x=nx; y=ny;
        if(!(Math.abs(x)<=DIVB&&Math.abs(y)<=DIVB)){ R.code=2; R.t=t; R.lam=NaN; return; }
        if(Math.abs(x*y-1)<TOL){ R.code=1; R.t=t; R.lam=lam2(x,y); return; }
      }
    }
    R.code=3; R.t=MAXIT; R.lam=NaN;
  }
  function trajectory(deg,eta,x,y){
    const P=[[x,y]];
    for(let t=1;t<=NTRAJ;t++){
      let nx, ny;
      if(deg===4){ const r=x*x*y*y-1; nx=x-eta*x*y*y*r; ny=y-eta*x*x*y*r; }
      else { const r=x*y-1; nx=x-eta*y*r; ny=y-eta*x*r; }
      x=nx; y=ny;
      if(!(Math.abs(x)<=DIVB&&Math.abs(y)<=DIVB)) break;
      P.push([x,y]);
    }
    return P;
  }

  /* ---------- views ---------- */
  const VIEWS={
    full4:{x:[0,4],y:[0,4],xt:[0,1,2,3,4],yt:[0,1,2,3,4],box:'[0, 4]²',range:'x and y from 0 to 4',dec:3},
    full2:{x:[0,5],y:[0,5],xt:[0,1,2,3,4,5],yt:[0,1,2,3,4,5],box:'[0, 5]²',range:'x and y from 0 to 5',dec:3},
    edge:{x:[3.0,3.4],y:[0.10,0.50],xt:[3.0,3.1,3.2,3.3,3.4],yt:[0.1,0.2,0.3,0.4,0.5],box:'[3.0, 3.4] × [0.10, 0.50]',
          range:'x from 3.0 to 3.4 and y from 0.10 to 0.50',dec:4,tf:v=>v.toFixed(1)}
  };
  const st={deg:4, eta:0.2, view:'full', hov:null, kb:false, ptr:null, traj:null, gen:0};
  const edgeOK=()=>st.deg===4&&st.eta===0.2;
  const V=()=>st.view==='edge'?VIEWS.edge:(st.deg===4?VIEWS.full4:VIEWS.full2);
  const thr=()=>2/st.eta;
  const key=()=>st.deg+'|'+st.eta+'|'+st.view;
  const cx=(v,i)=>v.x[0]+(i+0.5)*(v.x[1]-v.x[0])/N;
  const cy=(v,j)=>v.y[0]+(j+0.5)*(v.y[1]-v.y[0])/N;

  /* ---------- results ---------- */
  let res=null;                                  // {key, out:Int8Array, lam:Float64Array, t:Int32Array, rows}
  const cache=new Map();
  function newRes(k){ return {key:k, out:new Int8Array(N*N), lam:new Float64Array(N*N), t:new Int32Array(N*N), rows:0}; }
  function counts(r){
    let conv=0, div=0, unc=0, band=0; const T=thr();
    for(let k=0;k<N*N;k++){
      const o=r.out[k];
      if(o===1){ conv++; const l=r.lam[k]; if(l>T-BAND&&l<=T+1e-9) band++; }
      else if(o===2) div++; else if(o===3) unc++;
    }
    return {conv:conv, div:div, unc:unc, band:band, done:r.rows>=N, cells:r.rows*N};
  }

  /* ---------- canvas colours (tokens resolved at draw time) ---------- */
  const cctx=cvs.getContext('2d');
  const one=document.createElement('canvas'); one.width=one.height=1;
  const octx=one.getContext('2d',{willReadFrequently:true});
  let PAL=null;                                  // {ramp:[[r,g,b]...], band, div, unc, bg}
  function rgb(expr){
    probe.style.backgroundColor=''; probe.style.backgroundColor=expr;
    const s=getComputedStyle(probe).backgroundColor;
    octx.clearRect(0,0,1,1); octx.fillStyle='#000'; octx.fillStyle=s; octx.fillRect(0,0,1,1);
    const d=octx.getImageData(0,0,1,1).data; return [d[0],d[1],d[2]];
  }
  function resolvePal(){
    const ramp=[];
    for(let p=0;p<=RAMP;p++) ramp.push(rgb(p===0?'var(--bg)':'color-mix(in oklab, var(--fx-base3) '+p+'%, var(--bg))'));
    PAL={ramp:ramp, band:rgb('var(--accent)'), div:rgb('color-mix(in oklab, var(--loss) 15%, var(--bg))'), unc:rgb('var(--fx-base1)'), bg:rgb('var(--bg)')};
  }
  const img=cctx.createImageData(N,N);
  function cellRGB(r,k){
    const o=r.out[k];
    if(o===1){
      const l=r.lam[k], T=thr();
      if(l>T-BAND&&l<=T+1e-9) return PAL.band;
      return PAL.ramp[Math.round(clamp(l/T,0,1)*RAMP)];
    }
    if(o===2) return PAL.div;
    if(o===3) return PAL.unc;
    return PAL.bg;
  }
  function paintRow(r,j){                        // grid row j (y index, 0 = bottom) → canvas row N−1−j
    const row=N-1-j, d=img.data;
    for(let i=0;i<N;i++){ const c=cellRGB(r,j*N+i), q=(row*N+i)*4; d[q]=c[0]; d[q+1]=c[1]; d[q+2]=c[2]; d[q+3]=255; }
  }
  function paintAll(){
    if(!PAL) resolvePal();
    for(let j=0;j<N;j++) paintRow(res,j);
    cctx.putImageData(img,0,0);
  }

  /* ---------- computation, in time-boxed chunks ---------- */
  function start(){
    const k=key(), g=++st.gen;
    if(cache.has(k)){ res=cache.get(k); paintAll(); updText(); return; }
    res=newRes(k); paintAll(); updText();
    const r=res, v=V(), deg=st.deg, eta=st.eta;
    const work=()=>{
      if(g!==st.gen) return;
      const t0=performance.now(), from=r.rows;
      while(r.rows<N&&performance.now()-t0<BUDGET){
        const j=N-1-r.rows, y=cy(v,j);          // top row first
        for(let i=0;i<N;i++){
          runCell(deg,eta,cx(v,i),y);
          const k2=j*N+i; r.out[k2]=R.code; r.t[k2]=R.t; r.lam[k2]=R.lam;
        }
        paintRow(r,j); r.rows++;
      }
      if(r.rows>from) cctx.putImageData(img,0,0,0,from,N,r.rows-from);
      if(r.rows>=N){ cache.set(r.key,r); updText(); refreshTip(); return; }
      updText(); refreshTip();
      nextFrame(work);
    };
    nextFrame(work);
  }

  /* ---------- geometry + overlay ---------- */
  let G=null;
  function geom(){
    const cw=Math.round(fig.clientWidth)||640, wide=cw>=540;
    main.classList.toggle('wide',wide);
    const pw=Math.max(240,Math.round(plot.clientWidth)||cw);
    const mL=38, mR=14, mT=26, mB=44;
    const S=Math.floor(clamp(pw-mL-mR,190,470));
    const v=V(), x0=mL, yT=mT;
    return {pw:pw, H:mT+S+mB, S:S, x0:x0, yT:yT, xR:x0+S, yB:yT+S, v:v, c:S/N,
            X:a=>x0+(a-v.x[0])/(v.x[1]-v.x[0])*S, Y:b=>yT+S-(b-v.y[0])/(v.y[1]-v.y[0])*S};
  }
  function render(){
    const g=G=geom(), v=g.v;
    svg.setAttribute('viewBox','0 0 '+g.pw+' '+g.H); svg.setAttribute('width',g.pw); svg.setAttribute('height',g.H);
    svg.textContent='';
    Object.assign(cvs.style,{left:g.x0+'px',top:g.yT+'px',width:g.S+'px',height:g.S+'px'});
    const defs=el('defs',{},svg), cp=el('clipPath',{id:'fx-init-map-clip'},defs);
    el('rect',{x:g.x0,y:g.yT,width:g.S,height:g.S},cp);
    const Lb=el('g',{},svg), Lc=el('g',{'clip-path':'url(#fx-init-map-clip)'},svg);
    // frame and ticks
    el('rect',{class:'im-frame',x:g.x0-0.5,y:g.yT-0.5,width:g.S+1,height:g.S+1},Lb);
    const tf=v.tf||(a=>String(a));
    v.xt.forEach(a=>{ const x=Math.round(g.X(a))+.5; el('line',{class:'im-tick',x1:x,x2:x,y1:g.yB+.5,y2:g.yB+4.5},Lb); txt(Lb,x,g.yB+16,tf(a),null,'middle'); });
    v.yt.forEach(b=>{ const y=Math.round(g.Y(b))+.5; el('line',{class:'im-tick',x1:g.x0-4.5,x2:g.x0-.5,y1:y,y2:y},Lb); txt(Lb,g.x0-7,y+3.6,tf(b),null,'end'); });
    const xt=el('text',{x:g.xR,y:g.yB+37,'text-anchor':'end'},Lb);
    el('tspan',{class:'tn'},xt).textContent='x'; el('tspan',{dx:5},xt).textContent='(initialization)';
    const yt=el('text',{x:0,y:14},Lb);
    el('tspan',{class:'tn'},yt).textContent='y'; el('tspan',{dx:5},yt).textContent='(initialization)';
    // minima xy = 1 (log-spaced samples between the box edges)
    const xa=Math.max(v.x[0],1/v.y[1]), xb=Math.min(v.x[1],v.y[0]>0?1/v.y[0]:Infinity), pts=[];
    for(let q=0;q<=240;q++){ const x=xa*Math.pow(xb/xa,q/240); pts.push(g.X(x).toFixed(1)+' '+g.Y(1/x).toFixed(1)); }
    el('path',{class:'im-min',d:'M'+pts.join('L')},Lc);
    // label the curve near its right end, above it
    const lx=v.x[0]+(v.x[1]-v.x[0])*0.93, ly=1/lx;
    if(ly>=v.y[0]&&ly<=v.y[1]){
      const t=txt(Lb,g.X(lx),g.Y(ly)-9,'xy = 1','im-lab','end');
      if(g.Y(ly)-9<g.yT+12) t.setAttribute('y',g.Y(ly)+17);
    }
    // EoS minima (sharpness exactly 2/η) and their mirrors
    const m=eosMin(st.deg,st.eta), dm=5;
    [[m[0],m[1]],[m[1],m[0]]].forEach(p=>{
      if(p[0]<v.x[0]||p[0]>v.x[1]||p[1]<v.y[0]||p[1]>v.y[1]) return;
      const x=g.X(p[0]), y=g.Y(p[1]), d='M'+f1(x)+' '+f1(y-dm)+'L'+f1(x+dm)+' '+f1(y)+'L'+f1(x)+' '+f1(y+dm)+'L'+f1(x-dm)+' '+f1(y)+'Z';
      el('path',{class:'im-dh',d:d},Lc); el('path',{class:'im-dd',d:d},Lc);
    });
    g.Lt=el('g',{'clip-path':'url(#fx-init-map-clip)'},svg);
    g.Lh=el('g',{},svg);
    drawTraj(); drawHov(); updAria();
  }

  /* ---------- trajectory ---------- */
  function setTraj(i,j){
    const v=V(), x=cx(v,i), y=cy(v,j);
    st.traj={deg:st.deg, eta:st.eta, x0:x, y0:y, dec:v.dec, P:trajectory(st.deg,st.eta,x,y)};
    drawTraj(); updPath();
  }
  function clearTraj(){ if(!st.traj) return; st.traj=null; drawTraj(); updPath(); }
  function drawTraj(){
    if(!G||!G.Lt) return;
    G.Lt.textContent='';
    const T=st.traj; plot.classList.toggle('has-path',!!T); if(!T) return;
    const P=T.P;
    for(let t=P.length-1;t>=1;t--){
      const x=G.X(P[t][0]), y=G.Y(P[t][1]);
      if(x<G.x0-4||x>G.xR+4||y<G.yT-4||y>G.yB+4) continue;
      el('circle',{class:t%2?'im-p1':'im-p0',cx:f1(x),cy:f1(y),r:t%2?1.45:1.5},G.Lt);
    }
    const x=G.X(P[0][0]), y=G.Y(P[0][1]);
    el('circle',{class:'im-psh',cx:f1(x),cy:f1(y),r:4.6},G.Lt);
    el('circle',{class:'im-ps',cx:f1(x),cy:f1(y),r:4.6},G.Lt);
  }
  function fmtXY(x,y,dec){ return '('+x.toFixed(dec)+', '+y.toFixed(dec)+')'; }
  function updPath(){
    const T=st.traj;
    pathP.hidden=!T;
    if(!T) return;
    const v=V(), P=T.P;
    let out=0; for(let t=1;t<P.length;t++){ const p=P[t]; if(p[0]<v.x[0]||p[0]>v.x[1]||p[1]<v.y[0]||p[1]>v.y[1]) out++; }
    const n=P.length-1;
    let s='path from '+fmtXY(T.x0,T.y0,T.dec)+': '+(n<NTRAJ?'diverges at step '+(n+1):'first '+NTRAJ+' steps');
    if(out) s+=', '+out+' outside this view';
    s+=(coarse?'.':'. Esc clears.');
    pathT.textContent=s;
  }

  /* ---------- hover / cursor ---------- */
  function locate(ev){ const b=svg.getBoundingClientRect(); if(!b.width||!G) return null; const s=G.pw/b.width; return [(ev.clientX-b.left)*s,(ev.clientY-b.top)*s]; }
  function cellAt(px,py){
    if(!G||px<G.x0||px>=G.xR||py<G.yT||py>=G.yB) return null;
    return {i:clamp(Math.floor((px-G.x0)/G.c),0,N-1), j:clamp(Math.floor((G.yB-py)/G.c),0,N-1)};
  }
  const cellPx=h=>[G.x0+(h.i+0.5)*G.c, G.yB-(h.j+0.5)*G.c];
  function drawHov(){
    if(!G||!G.Lh) return;
    G.Lh.textContent='';
    const h=st.hov; if(!h) return;
    const p=cellPx(h), x=Math.round(p[0])+.5, y=Math.round(p[1])+.5;
    el('line',{class:'hair',x1:G.x0,x2:G.xR,y1:y,y2:y},G.Lh);
    el('line',{class:'hair',x1:x,x2:x,y1:G.yT,y2:G.yB},G.Lh);
    const w=Math.max(G.c,6);
    el('rect',{class:'im-cellh',x:f1(p[0]-w/2),y:f1(p[1]-w/2),width:f1(w),height:f1(w)},G.Lh);
    el('rect',{class:'im-cell',x:f1(p[0]-w/2),y:f1(p[1]-w/2),width:f1(w),height:f1(w)},G.Lh);
  }
  function tipHTML(h){
    const v=V(), x=cx(v,h.i), y=cy(v,h.j), k=h.j*N+h.i, T=thr(), o=res?res.out[k]:0;
    let s='<b>start '+fmtXY(x,y,v.dec)+'</b><div class="im-tt"><span class="k">sharpness at start</span><span>'+f2(sharp(st.deg,x,y))+'</span>';
    if(o===1){
      const l=res.lam[k], gap=T-l, inb=l>T-BAND&&l<=T+1e-9;
      s+='<span class="k">converges after</span><span>'+int(res.t[k])+' steps</span>'+
         '<span class="k">final sharpness</span><span class="'+(inb?'v-band':'')+'">'+f2(l)+' (2/η '+(gap>=0?'−':'+')+' '+f2(Math.abs(gap))+')</span>';
    } else if(o===2) s+='<span class="k">outcome</span><span class="v-div">diverges at step '+int(res.t[k])+'</span>';
    else if(o===3) s+='<span class="k">outcome</span><span>not converged in '+int(MAXIT)+' steps</span>';
    else s+='<span class="k">outcome</span><span>computing…</span>';
    s+='</div>';
    if(!st.kb) s+='<span class="k im-hintl">'+(coarse?'tap':'click')+' to draw its first '+NTRAJ+' steps</span>';
    else s+='<span class="k im-hintl">Enter draws its first '+NTRAJ+' steps</span>';
    return s;
  }
  function placeTip(){
    const h=st.hov; if(!h){ tip.classList.remove('on'); return; }
    tip.innerHTML=tipHTML(h); tip.classList.add('on');
    const fr=fig.getBoundingClientRect(), sr=svg.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight;
    let ax, ay;
    if(st.ptr){ ax=st.ptr[0]; ay=st.ptr[1]; }
    else { const p=cellPx(h), s=sr.width/G.pw; ax=sr.left-fr.left+p[0]*s; ay=sr.top-fr.top+p[1]*s; }
    let x=ax+14, y=ay+16;
    if(x+tw>fr.width) x=ax-14-tw;
    if(y+th>fr.height) y=ay-12-th;
    tip.style.left=clamp(x,0,Math.max(0,fr.width-tw))+'px';
    tip.style.top=clamp(y,0,Math.max(0,fr.height-th))+'px';
  }
  function refreshTip(){ if(st.hov&&tip.classList.contains('on')) placeTip(); }
  function setHov(h,ptr,kb){
    const same=h&&st.hov&&h.i===st.hov.i&&h.j===st.hov.j;
    st.hov=h; st.ptr=ptr; st.kb=!!kb;
    if(!same) drawHov();
    placeTip();
  }
  function onMove(ev){
    const q=locate(ev); if(!q) return;
    const h=cellAt(q[0],q[1]), fr=fig.getBoundingClientRect();
    setHov(h,[ev.clientX-fr.left,ev.clientY-fr.top],false);
  }
  svg.addEventListener('pointermove',onMove);
  svg.addEventListener('pointerdown',onMove);
  svg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse') setHov(null,null,false); });
  document.addEventListener('pointerdown',ev=>{ if(st.hov&&!svg.contains(ev.target)) setHov(null,null,false); },true);
  // draw the path of the cell picked at pointerdown (click coordinates can be rounded differently)
  svg.addEventListener('click',ev=>{
    let h=st.hov&&!st.kb?st.hov:null;
    if(!h){ const q=locate(ev); if(q) h=cellAt(q[0],q[1]); }
    if(h) setTraj(h.i,h.j);
  });
  // keyboard: arrows move the cursor cell (Shift: 10 cells), Enter or Space draws its path, Esc clears
  function startCell(){
    const v=V(), m=eosMin(st.deg,st.eta);
    const i=clamp(Math.floor((m[0]-v.x[0])/(v.x[1]-v.x[0])*N),0,N-1), j=clamp(Math.floor((m[1]-v.y[0])/(v.y[1]-v.y[0])*N),0,N-1);
    return {i:i,j:j};
  }
  svg.addEventListener('keydown',e=>{
    if(!G) return;
    const had=!!st.hov, h=st.hov?{i:st.hov.i,j:st.hov.j}:startCell(), d=e.shiftKey?10:1;
    switch(e.key){
      case 'ArrowRight': if(had) h.i=clamp(h.i+d,0,N-1); break;
      case 'ArrowLeft': if(had) h.i=clamp(h.i-d,0,N-1); break;
      case 'ArrowUp': if(had) h.j=clamp(h.j+d,0,N-1); break;
      case 'ArrowDown': if(had) h.j=clamp(h.j-d,0,N-1); break;
      case 'Home': h.i=0; break;
      case 'End': h.i=N-1; break;
      case 'Enter': case ' ': setTraj(h.i,h.j); break;
      case 'Escape':
        if(st.traj){ clearTraj(); e.preventDefault(); return; }
        if(had){ setHov(null,null,true); e.preventDefault(); }
        return;
      default: return;
    }
    e.preventDefault();
    setHov(h,null,true);
  });
  const keyFocus=()=>{ try{ return svg.matches(':focus-visible'); }catch(_){ return true; } };
  svg.addEventListener('focus',()=>{ if(!st.hov&&keyFocus()) setHov(startCell(),null,true); });
  svg.addEventListener('blur',()=>{ if(st.kb) setHov(null,null,false); });
  fig.addEventListener('keydown',e=>{ if(e.key==='Escape'&&st.traj&&e.target!==svg){ clearTraj(); } });
  bClear.addEventListener('click',()=>{ clearTraj(); svg.focus({preventScroll:true}); });

  /* ---------- text ---------- */
  function head(){ return 'Degree '+st.deg+', η = '+trim(st.eta)+', '+V().box; }
  function updText(){
    const c=counts(res), T=thr();
    if(!c.done){
      status.innerHTML=head()+': computing, <b>'+int(c.cells)+'</b> of '+int(N*N)+' starts done';
      uncLi.hidden=true; hint.textContent=hintText(); return;
    }
    const p=c.conv?100*c.band/c.conv:0;
    status.innerHTML=head()+': of '+int(N*N)+' starts, <b>'+int(c.conv)+'</b> converge; <b>'+int(c.band)+'</b> of them (<b>'+pct(p)+
      '%</b>) end with sharpness within 0.1 of 2/η&nbsp;=&nbsp;'+trim(T)+'.'+(c.unc?' '+int(c.unc)+' do not converge in '+int(MAXIT)+' steps.':'');
    uncLi.hidden=!c.unc;
    hint.textContent=hintText();
    updAria();
  }
  function hintText(){
    return coarse?'Tap a cell for its outcome and to draw its first '+NTRAJ+' steps.'
      :'Hover a cell for its outcome; click to draw its first '+NTRAJ+' steps. With the map focused, arrow keys move and Enter draws.';
  }
  function updAria(){
    if(!res) return;
    const c=counts(res), m=eosMin(st.deg,st.eta), T=thr();
    let a='Map of '+N+' by '+N+' starting points for gradient descent on the degree-'+st.deg+' objective with η = '+trim(st.eta)+
      ', over '+V().range+', each colored by the sharpness of the minimum it reaches.';
    if(c.done) a+=' '+int(c.conv)+' converge, '+int(c.band)+' of them within 0.1 of 2/η = '+trim(T)+'; '+int(c.div)+' diverge.';
    a+=' Dashed curve: the minima xy = 1. Diamonds: the minima with sharpness exactly 2/η, at ('+m[0].toFixed(3)+', '+m[1].toFixed(3)+') and its mirror.';
    svg.setAttribute('aria-label',a);
  }

  /* ---------- controls ---------- */
  function syncCtl(){
    [...selEta.options].forEach(o=>{ o.disabled=st.deg===2&&o.value!=='0.2'; });
    if(selEta.value!==String(st.eta)) selEta.value=String(st.eta);
    bEdge.disabled=!edgeOK();
    bEdge.title=edgeOK()?'':'available for degree 4 at η = 0.2 (the paper’s Fig. 6a)';
    vBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-view')===st.view)));
  }
  function change(keepTraj){
    if(!edgeOK()) st.view='full';
    if(!keepTraj) st.traj=null;
    setHov(null,null,false);
    syncCtl(); render(); updPath(); start();
  }
  selObj.addEventListener('change',()=>{
    const d=+selObj.value; if(d===st.deg) return;
    st.deg=d; if(d===2) st.eta=0.2;
    change(false);
  });
  selEta.addEventListener('change',()=>{
    const e=+selEta.value; if(e===st.eta) return;
    if(st.deg===2&&e!==0.2){ selEta.value='0.2'; return; }
    st.eta=e; change(false);
  });
  vBtns.forEach(b=>b.addEventListener('click',()=>{
    const v=b.getAttribute('data-view'); if(v===st.view||(v==='edge'&&!edgeOK())) return;
    st.view=v; change(true);
  }));

  /* ---------- theme + resize ---------- */
  function retheme(){ PAL=null; if(res) paintAll(); }
  new MutationObserver(retheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class','style']});
  if(window.matchMedia){ const mq=matchMedia('(prefers-color-scheme: dark)'); if(mq.addEventListener) mq.addEventListener('change',retheme); else if(mq.addListener) mq.addListener(retheme); }

  let lastW=0;
  function renderAll(){ lastW=Math.round(fig.clientWidth); render(); if(st.hov) placeTip(); }
  syncCtl(); renderAll(); start();
  if(window.ResizeObserver){
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW) renderAll(); }).observe(fig);
  }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ if(G) render(); });
})();

/* ---- two-step ---- */
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

/* ---- bifurcation ---- */
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

/* ---- coupling ---- */
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
