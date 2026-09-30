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
