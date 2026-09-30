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
