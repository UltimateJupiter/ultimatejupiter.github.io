/* data figures, bundled from figs/*.js by build.py */
/* ---- flow ---- */
/* Figure 1 · data flow and serial depth (fx-flow).
   An exact computation on the dataflow graph of Eqs 2.1–2.2 (L = 30, SmolLM2-135M).
   Serial depth d(t, l) = number of layer applications on the longest dependency path into h_t^(l):
     Transformer            d(t, l) = l
     T2MLR(ls, le)          d(1, l) = l;  for t ≥ 2: d(t, l) = l (l < ls),  l + (t−1)·D (l ≥ ls),  D = le − ls + 1
     Looped ×K over [bs,be] per-token layer applications and output depth L + (K−1)·D, constant in t
                            (full looping: bs = 1, be = L, so K·L; paper Table 5)
   The closed form was checked against a dynamic program over every attention and recurrence edge. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-flow');
  if(!fig) return;

  const NS='http://www.w3.org/2000/svg', L=30;
  const $=id=>document.getElementById(id);
  const selA=$('fx-flow-arch'), rng=$('fx-flow-rng'), inLs=$('fx-flow-ls'), inLe=$('fx-flow-le'),
        outLs=$('fx-flow-lsv'), outLe=$('fx-flow-lev'), seg=$('fx-flow-tok'),
        mainP=$('fx-flow-mainp'), sideP=$('fx-flow-sidep'), svg=$('fx-flow-svg'), csvg=$('fx-flow-csvg'),
        leg=$('fx-flow-leg'), status=$('fx-flow-status');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);

  /* ---------- helpers ---------- */
  function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function txt(parent,x,y,s,cls,anchor){ const t=el('text',{x:x,y:y},parent); if(cls) t.setAttribute('class',cls); if(anchor) t.setAttribute('text-anchor',anchor); t.textContent=s; return t; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f1=v=>(Math.round(v*10)/10).toString();
  /* orthogonal polyline with rounded corners */
  function rpath(pts,r){
    let d='M'+f1(pts[0][0])+' '+f1(pts[0][1]);
    for(let i=1;i<pts.length-1;i++){
      const p0=pts[i-1], p=pts[i], p1=pts[i+1];
      const l0=Math.hypot(p[0]-p0[0],p[1]-p0[1]), l1=Math.hypot(p1[0]-p[0],p1[1]-p[1]);
      const rr=Math.min(r,l0/2,l1/2);
      if(rr<0.5||l0===0||l1===0){ d+=' L'+f1(p[0])+' '+f1(p[1]); continue; }
      const a=[p[0]-(p[0]-p0[0])/l0*rr, p[1]-(p[1]-p0[1])/l0*rr], b=[p[0]+(p1[0]-p[0])/l1*rr, p[1]+(p1[1]-p[1])/l1*rr];
      d+=' L'+f1(a[0])+' '+f1(a[1])+' Q'+f1(p[0])+' '+f1(p[1])+' '+f1(b[0])+' '+f1(b[1]);
    }
    const q=pts[pts.length-1]; d+=' L'+f1(q[0])+' '+f1(q[1]);
    return d;
  }
  /* small filled arrowhead with its tip at (x,y), pointing along dir: 'r' | 'l' | 'u' */
  function head(parent,x,y,dir,cls){
    const s=3.6, w=2.6; let p;
    if(dir==='r') p=[[x,y],[x-s,y-w],[x-s,y+w]];
    else if(dir==='l') p=[[x,y],[x+s,y-w],[x+s,y+w]];
    else p=[[x,y],[x-w,y+s],[x+w,y+s]];
    return el('polygon',{class:cls,points:p.map(q=>f1(q[0])+','+f1(q[1])).join(' ')},parent);
  }

  /* ---------- configurations ---------- */
  const CFG={
    'tr':    {kind:'tr', opt:'Transformer (baseline)'},
    '1-30':  {kind:'t2', ls:1,  le:30},
    '5-26':  {kind:'t2', ls:5,  le:26},
    '9-22':  {kind:'t2', ls:9,  le:22},
    '13-18': {kind:'t2', ls:13, le:18},
    '15-16': {kind:'t2', ls:15, le:16},
    'custom':{kind:'t2', custom:true},
    'loop2': {kind:'loop', K:2, bs:1, be:30, opt:'Full-looped ×2', name:'Full-looped ×2'},
    'mloop3':{kind:'loop', K:3, bs:9, be:22, opt:'Middle-looped ×3 (9–22)', name:'Middle-looped ×3 (layers 9–22)'}
  };
  const GROUPS=[['Transformer',['tr']],['T2MLR',['1-30','5-26','9-22','13-18','15-16','custom']],['Looped (Table 2)',['loop2','mloop3']]];
  const IN=['A','Quick','Fox','Jumps','Over','The'], OUT=['Quick','Fox','Jumps','Over','The','Lazy'];
  const TMAX=32;

  const st={id:'13-18', ls:13, le:18, T:6, sel:6, hc:-1, hl:-1, ht:-1};
  const C=()=>CFG[st.id];
  const kind=()=>C().kind;
  function blk(){ const c=C(); if(c.kind==='t2') return [st.ls,st.le]; if(c.kind==='loop') return [c.bs,c.be]; return null; }
  function Dsz(){ const b=blk(); return b?b[1]-b[0]+1:0; }
  const K=()=>C().K||1;
  function perTok(){ return kind()==='loop'?L+(K()-1)*Dsz():L; }                     // layer applications per token
  function depthOut(t){ const k=kind(); return k==='t2'?L+(t-1)*Dsz():k==='loop'?L+(K()-1)*Dsz():L; }
  const t2depth=(t,D)=>L+(t-1)*D;                                                    // T2MLR output depth
  function cellDepths(t,l){
    const k=kind();
    if(k==='tr') return [l];
    const b=blk(), D=Dsz();
    if(k==='t2') return [(t===1||l<b[0])?l:l+(t-1)*D];
    if(l<b[0]) return [l];
    if(l>b[1]) return [l+(K()-1)*D];
    const a=[]; for(let q=0;q<K();q++) a.push(l+q*D); return a;
  }
  function name(){ const k=kind(); return k==='t2'?'T2MLR('+st.ls+','+st.le+')':k==='loop'?C().name:'Transformer'; }
  function shortName(){ const k=kind(); return k==='loop'?C().opt.replace(/ \(.*\)$/,''):name(); }
  function band(l){
    const b=blk(); if(!b) return 'n';
    if(l<b[0]) return 'e'; if(l<=b[1]) return 'b'; return 'z';
  }
  function onPath(c,l){           // column c (1-based), layer l, for the selected token st.sel
    const s=st.sel; if(c>s) return false;
    if(kind()!=='t2') return c===s;
    if(s===1) return true;
    if(c===1) return l<=st.le;
    if(c<s) return l>=st.ls&&l<=st.le;
    return l>=st.ls;
  }
  const FILL={
    n:'color-mix(in oklab, var(--fx-base2) 20%, var(--bg))',
    e:'color-mix(in oklab, var(--fx-base3) 14%, var(--bg))',
    z:'color-mix(in oklab, var(--fx-base2) 44%, var(--bg))',
    b:'color-mix(in oklab, var(--accent) 30%, var(--bg))'
  };
  const PFILL={ b:'color-mix(in oklab, var(--accent) 72%, var(--bg))', o:'color-mix(in oklab, var(--accent) 48%, var(--bg))' };

  /* ---------- controls ---------- */
  GROUPS.forEach(g=>{
    const og=document.createElement('optgroup'); og.label=g[0];
    g[1].forEach(id=>{ const c=CFG[id], o=document.createElement('option'); o.value=id;
      o.textContent=c.opt||(c.custom?'custom':'('+c.ls+','+c.le+') D='+(c.le-c.ls+1)); og.appendChild(o); });
    selA.appendChild(og);
  });
  selA.value=st.id;
  const custOpt=selA.querySelector('option[value="custom"]');
  function presetFor(a,b){ for(const id in CFG){ const c=CFG[id]; if(c.kind==='t2'&&!c.custom&&c.ls===a&&c.le===b) return id; } return 'custom'; }
  function syncSliders(){
    inLs.value=String(st.ls); inLe.value=String(st.le);
    outLs.textContent=String(st.ls); outLe.textContent=String(st.le);
    inLs.setAttribute('aria-valuetext','ℓ start = '+st.ls); inLe.setAttribute('aria-valuetext','ℓ end = '+st.le);
    [inLs,inLe].forEach(inp=>{ const f=(+inp.value-1)/(L-1); inp.parentNode.querySelector('.flw-fill').style.width=(f*100).toFixed(2)+'%'; });
    rng.hidden=kind()!=='t2';
    const txt_='custom'+(st.id==='custom'?' ('+st.ls+','+st.le+') D='+(st.le-st.ls+1):'');
    if(custOpt.textContent!==txt_) custOpt.textContent=txt_;
  }
  selA.addEventListener('change',()=>{
    const id=selA.value; if(!CFG[id]) return;
    st.id=id; const c=CFG[id];
    if(c.kind==='t2'&&!c.custom){ st.ls=c.ls; st.le=c.le; }
    syncSliders(); renderAll();
  });
  function onSlide(which){
    let a=+inLs.value, b=+inLe.value;
    if(which==='s'&&a>b) b=a;            // keep ℓ_end ≥ ℓ_start by pushing the other end
    if(which==='e'&&b<a) a=b;
    st.ls=clamp(a,1,L); st.le=clamp(b,st.ls,L);
    st.id=presetFor(st.ls,st.le);
    selA.value=st.id;
    syncSliders(); renderAll();
  }
  inLs.addEventListener('input',()=>onSlide('s'));
  inLe.addEventListener('input',()=>onSlide('e'));

  function buildSeg(){
    seg.textContent='';
    for(let t=1;t<=st.T;t++){
      const b=document.createElement('button'); b.type='button'; b.textContent='t='+t; b.dataset.t=String(t);
      b.setAttribute('aria-label','token '+t+' ('+IN[t-1]+')');
      b.addEventListener('click',()=>selectTok(t));
      seg.appendChild(b);
    }
    updSeg();
  }
  function updSeg(){ seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.t===st.sel))); }
  function selectTok(t){ t=clamp(t,1,st.T); if(t===st.sel) return; st.sel=t; updSeg(); drawMain(); drawChart(); updStatus(); }

  /* ---------- main panel: data flow ---------- */
  let M=null;
  function layoutM(W){
    const T=st.T, gL=30, p=(W-gL)/T, g=clamp(Math.round(p*0.3),16,24), cw=p-g;
    const Y0=52, ph=7, Yb=Y0+L*ph-1;
    return {W:W,T:T,gL:gL,p:p,g:g,cw:cw,Y0:Y0,ph:ph,Yb:Yb,H:Yb+22,yOut:45};
  }
  const x0=c=>M.gL+(c-1)*M.p;                  // column c (1-based) left edge
  const cxm=c=>x0(c)+M.cw/2;
  const gxm=c=>x0(c)+M.cw+M.g/2;               // centre of the gap right of column c
  const yT=l=>M.Y0+(L-l)*M.ph;                 // top of layer l's cell
  function drawMain(){
    const W=Math.round(mainP.clientWidth); if(!W) return;
    M=layoutM(W);
    const T=M.T, k=kind(), b=blk(), s=st.sel;
    svg.setAttribute('viewBox','0 0 '+W+' '+M.H); svg.setAttribute('width',W); svg.setAttribute('height',M.H);
    svg.textContent='';
    // header: serial depth numbers and output tokens
    txt(svg,x0(1),10,'serial depth','cap');
    for(let c=1;c<=T;c++){
      txt(svg,cxm(c),26,String(depthOut(c)),'num'+(c===s?' on':''),'middle');
      txt(svg,cxm(c),41,OUT[c-1],'tok'+(c===s?' on':''),'middle');
      txt(svg,cxm(c),M.Yb+16,IN[c-1],'tok'+(c===s?' on':''),'middle');
    }
    // cells
    for(let c=1;c<=T;c++){
      const g=el('g',{class:'col'+(c>s?' fut':''),'shape-rendering':'crispEdges'},svg);
      for(let l=1;l<=L;l++){
        const bd=band(l), on=onPath(c,l);
        const r=el('rect',{x:f1(x0(c)),y:yT(l),width:f1(M.cw),height:M.ph-1},g);
        r.style.fill=on?(bd==='b'?PFILL.b:PFILL.o):FILL[bd];
      }
      // stub to the output token
      el('line',{class:'rec'+(c>s?' fut':''),x1:f1(cxm(c)),x2:f1(cxm(c)),y1:M.Y0-2,y2:M.yOut+1},svg);
    }
    // left axis ticks
    drawTicks();
    // recurrence arrows (T2MLR) or loop returns (looped)
    const deco=el('g',{},svg), pathG=el('g',{},svg), chips=el('g',{},svg);
    if(k==='t2'){
      const yA=yT(st.le)-0.5, yB=yT(st.ls)+M.ph-0.5;
      for(let c=1;c<T;c++){
        const fut=c+1>s, on=c+1<=s&&s>=2;
        const gx=gxm(c), xe=x0(c+1);
        el('path',{class:'rec'+(fut?' fut':''),d:rpath([[x0(c)+M.cw,yA],[gx,yA],[gx,yB],[xe-3,yB]],4)},deco);
        head(deco,xe+0.5,yB,'r','ah'+(on?' on':fut?' fut':''));
        txt(deco,gx,Math.min(yB+11.5,M.H-2),'Φ','phi'+(on?' on':''),'middle');
        const cy=(yA+yB)/2, ch=el('g',{class:'chip'+(on?' on':fut?' fut':'')},chips);
        el('rect',{x:f1(gx-6.5),y:f1(cy-6.5),width:13,height:13,rx:3},ch);
        txt(ch,gx,cy+3.6,'R',null,'middle');
      }
      // longest path into the selected token's output
      const pts=[[cxm(1),M.Yb+3]];
      for(let c=1;c<s;c++){ pts.push([cxm(c),yA],[gxm(c),yA],[gxm(c),yB],[cxm(c+1),yB]); }
      pts.push([cxm(s),M.yOut+5]);
      el('path',{class:'path',d:rpath(pts,4)},pathG);
      head(pathG,cxm(s),M.yOut+1,'u','ah on');
    } else if(k==='loop'){
      const Kk=K(), yA=yT(b[1])-0.5, yB=yT(b[0])+M.ph-0.5, cy=(yA+yB)/2;
      for(let c=1;c<=T;c++){
        const fut=c>s, xr=x0(c)+M.cw;
        if(c!==s){
          el('path',{class:'rec'+(fut?' fut':''),d:rpath([[xr-2,yA],[xr+5,yA],[xr+5,yB],[xr+3,yB]],3)},deco);
          head(deco,xr+0.5,yB,'l','ah'+(fut?' fut':''));
        }
      }
      // K passes through the block in the selected column
      const off=q=>(q-(Kk-1)/2)*6, xr=x0(s)+M.cw, pts=[[cxm(s)+off(0),M.Yb+3]];
      for(let q=0;q<Kk-1;q++){ const rx=xr+4+3*q; pts.push([cxm(s)+off(q),yA],[rx,yA],[rx,yB],[cxm(s)+off(q+1),yB]); }
      pts.push([cxm(s)+off(Kk-1),M.yOut+5]);
      el('path',{class:'path',d:rpath(pts,3)},pathG);
      head(pathG,cxm(s)+off(Kk-1),M.yOut+1,'u','ah on');
      for(let c=1;c<=T;c++){
        const lab='×'+Kk, w=lab.length*6.4+8, ch=el('g',{class:'chip'+(c===s?' on':c>s?' fut':'')},chips);
        el('rect',{x:f1(cxm(c)-w/2),y:f1(cy-6.5),width:f1(w),height:13,rx:3},ch);
        txt(ch,cxm(c),cy+3.6,lab,null,'middle');
      }
    } else {
      el('path',{class:'path',d:rpath([[cxm(s),M.Yb+3],[cxm(s),M.yOut+5]],0)},pathG);
      head(pathG,cxm(s),M.yOut+1,'u','ah on');
    }
    // hover outline
    if(st.hc>=1&&st.hl>=1) el('rect',{class:'cellh',x:f1(x0(st.hc)-0.5),y:yT(st.hl)-0.5,width:f1(M.cw+1),height:M.ph},svg);
    ariaMain(); drawLegend();
  }
  function drawTicks(){
    const b=blk(), cand=[];
    const yc=l=>yT(l)+(M.ph-1)/2+3.6;
    if(b){
      if(b[0]===b[1]) cand.push({l:b[0],y:yc(b[0]),hi:true});
      else {
        let ys=yc(b[0]), ye=yc(b[1]);
        if(ys-ye<11){ const m=(ys+ye)/2; ys=m+5.5; ye=m-5.5; }
        cand.push({l:b[0],y:ys,hi:true},{l:b[1],y:ye,hi:true});
      }
      el('line',{class:'brk',x1:M.gL-3,x2:M.gL-3,y1:yT(b[1]),y2:yT(b[0])+M.ph-1},svg);
    }
    cand.push({l:1,y:yc(1)},{l:L,y:yc(L)});
    const placed=[];
    cand.forEach(t=>{
      if(placed.some(p=>p.l===t.l||Math.abs(p.y-t.y)<11)) return;
      placed.push(t); txt(svg,M.gL-8,t.y,String(t.l),'tk'+(t.hi?' on':''),'end');
    });
  }
  function drawLegend(){
    const k=kind(), b=blk(), parts=[];
    const box=(f,s)=>'<span><i class="box" style="background:'+f+'"></i>'+s+'</span>';
    if(k==='t2'){
      if(b[0]>1) parts.push(box(FILL.e,'layers 1–'+(b[0]-1)));
      parts.push(box(FILL.b,(b[0]===b[1]?'layer '+b[0]:'layers '+b[0]+'–'+b[1])+' (block, D = '+Dsz()+')'));
      if(b[1]<L) parts.push(box(FILL.z,'layers '+(b[1]+1)+'–'+L));
    } else if(k==='loop'){
      parts.push(box(FILL.b,(b[0]===1&&b[1]===L?'all layers':'layers '+b[0]+'–'+b[1])+', run ×'+K()));
      if(b[0]>1) parts.push(box(FILL.e,'layers 1–'+(b[0]-1)));
      if(b[1]<L) parts.push(box(FILL.z,'layers '+(b[1]+1)+'–'+L));
    } else parts.push(box(FILL.n,'layer'));
    parts.push('<span><i class="ln"></i>longest chain to token '+st.sel+'</span>');
    leg.innerHTML=parts.join('');
  }
  function ariaMain(){
    const s=st.sel;
    svg.setAttribute('aria-label',name()+', '+st.T+' tokens by '+L+' layers. '+(kind()==='t2'?'Arrows carry the state after layer '+st.le+' of each token into layer '+st.ls+' of the next. ':'')+
      'Selected token '+s+' ('+IN[s-1]+'): its output depends on a chain of '+depthOut(s)+' layer applications. Left and right arrow keys change the token.');
  }
  function mPoint(ev,sv,w){ const r=sv.getBoundingClientRect(); if(!r.width) return null; const k=w/r.width; return {x:(ev.clientX-r.left)*k,y:(ev.clientY-r.top)*k}; }
  function colAt(x){ if(!M) return -1; const c=Math.floor((x-M.gL+M.g/2)/M.p)+1; return (x<M.gL-4||c<1||c>M.T)?-1:c; }
  function layerAt(y){ if(!M||y<M.Y0-1||y>M.Yb+1) return -1; return clamp(L-Math.floor((y-M.Y0)/M.ph),1,L); }
  const trow=(k,v)=>'<span class="k">'+k+'</span><span>'+v+'</span>';
  function cellTip(c,l){
    const ds=cellDepths(c,l), k=kind(), bd=band(l);
    let h='<b>token '+c+' · '+IN[c-1]+' · layer '+l+'</b><div class="flw-tt">';
    if(ds.length>1) h+=trow('runs','×'+ds.length)+trow('chain after each pass',ds.join(', '));
    else h+=trow('longest chain into this cell',String(ds[0]));
    h+='</div>';
    let n='';
    if(k==='t2'){
      if(c===1) n='first token: no earlier state, so the chain is just the layers below';
      else if(bd==='e') n='below ℓ_start: the same as a Transformer';
      else n=l+' layers here plus '+(c-1)+' × '+Dsz()+' carried through R';
    } else if(k==='tr') n='a Transformer reads earlier tokens only at the same depth';
    if(n) h+='<div class="flw-tn">'+n+'</div>';
    return h;
  }
  function onMainMove(ev){
    const p=mPoint(ev,svg,M?M.W:1); if(!p) return;
    const c=colAt(p.x), l=layerAt(p.y);
    const inCell=c>=1&&l>=1&&p.x>=x0(c)-1&&p.x<=x0(c)+M.cw+1;
    const hc=inCell?c:-1, hl=inCell?l:-1;
    if(hc!==st.hc||hl!==st.hl){ st.hc=hc; st.hl=hl; drawMain(); }
    if(inCell) showTip(ev,cellTip(c,l)); else if(c>=1) showTip(ev,'<b>token '+c+' · '+IN[c-1]+' → '+OUT[c-1]+'</b><div class="flw-tt">'+trow('serial depth of the output',String(depthOut(c)))+trow('layers run for this token',String(perTok()))+'</div>'); else hideTip();
  }
  svg.addEventListener('pointermove',onMainMove);
  svg.addEventListener('pointerdown',onMainMove);
  svg.addEventListener('pointerleave',()=>{ hideTip(); if(st.hc!==-1){ st.hc=-1; st.hl=-1; drawMain(); } });
  svg.addEventListener('click',ev=>{ const p=mPoint(ev,svg,M?M.W:1); if(!p) return; const c=colAt(p.x); if(c>=1) selectTok(c); });
  svg.addEventListener('keydown',ev=>{
    let t=st.sel;
    switch(ev.key){
      case 'ArrowLeft': t--; break;
      case 'ArrowRight': t++; break;
      case 'Home': t=1; break;
      case 'End': t=st.T; break;
      default: return;
    }
    ev.preventDefault(); selectTok(t);
  });

  /* ---------- side panel: depth vs token position ---------- */
  let Q=null;
  function niceMax(v){
    const steps=[10,20,25,50,100,200,250,500];
    for(const s of steps){ const top=Math.ceil(v*1.05/s)*s; if(top/s<=5) return {top:top,step:s}; }
    return {top:Math.ceil(v/1000)*1000,step:1000};
  }
  function series(){
    // [{v:(t)=>value, cls, label, lbCls, main}]
    const k=kind(), out=[];
    const trS={v:()=>L,cls:'s-tr',label:'Transformer',lb:'lb-tr',dot:'d-tr',key:'Transformer'};
    const ctx={v:t=>t2depth(t,6),cls:'s-ctx',label:'T2MLR(13,18)',lb:'lb-tr',dot:'d-tr',key:'T2MLR(13,18)'};
    if(k==='t2'){ const D=Dsz(); out.push(trS,{v:t=>t2depth(t,D),cls:'s-sel',label:name(),lb:'lb-sel',dot:'d-sel',main:true,key:name()}); }
    else if(k==='loop'){ const v=perTok(); out.push(trS,ctx,{v:()=>v,cls:'s-loop',label:shortName(),lb:'lb-sel',dot:'d-sel',main:true,key:shortName()}); }
    else out.push(ctx,{v:()=>L,cls:'s-sel',label:'Transformer',lb:'lb-sel',dot:'d-sel',main:true,key:'Transformer'});
    return out;
  }
  function drawChart(){
    const W=Math.round(sideP.clientWidth); if(!W) return;
    const stacked=sideP.offsetTop>mainP.offsetTop+10;
    const H=stacked?230:(M?M.H:281);
    const mL=34, mR=8, mT=20, mB=30, pw=W-mL-mR, ph=H-mT-mB;
    const S=series(), mx=Math.max.apply(null,S.map(s=>Math.max(s.v(1),s.v(TMAX)))), ny=niceMax(mx);
    const x=t=>mL+(t-1)/(TMAX-1)*pw, y=v=>mT+ph*(1-v/ny.top);
    Q={W:W,H:H,mL:mL,pw:pw,mT:mT,ph:ph,x:x,y:y,S:S};
    csvg.setAttribute('viewBox','0 0 '+W+' '+H); csvg.setAttribute('width',W); csvg.setAttribute('height',H);
    csvg.textContent='';
    txt(csvg,0,10,'layer applications',null,'start');
    const g=el('g',{'shape-rendering':'crispEdges'},csvg);
    for(let v=0;v<=ny.top+1e-9;v+=ny.step){
      const yy=Math.round(y(v))+0.5;
      el('line',{class:v===0?'ax':'gr',x1:mL,x2:mL+pw,y1:yy,y2:yy},g);
      txt(csvg,mL-7,yy+3.6,String(v),null,'end');
    }
    [1,8,16,24,32].forEach(t=>{ const xx=Math.round(x(t))+0.5; el('line',{class:'ax',x1:xx,x2:xx,y1:mT+ph,y2:mT+ph+4},g); txt(csvg,xx,mT+ph+16,String(t),null,'middle'); });
    txt(csvg,mL+pw,H-1,'token position t',null,'end');
    // lines, context first
    S.slice().sort((a,b)=>(a.main?1:0)-(b.main?1:0)).forEach(s=>{
      el('line',{class:s.cls,x1:f1(x(1)),y1:f1(y(s.v(1))),x2:f1(x(TMAX)),y2:f1(y(s.v(TMAX)))},csvg);
    });
    // direct labels at the right end, above each line, kept 12px apart
    const labs=S.map(s=>({s:s,y:y(s.v(TMAX))-6})).sort((a,b)=>a.y-b.y);
    for(let i=1;i<labs.length;i++) if(labs[i].y-labs[i-1].y<12) labs[i].y=labs[i-1].y+12;
    for(let i=labs.length-1;i>=0;i--){ const lim=i===labs.length-1?mT+ph-4:labs[i+1].y-12; if(labs[i].y>lim) labs[i].y=lim; }
    labs.forEach(a=>txt(csvg,mL+pw,Math.max(mT-6,a.y),a.s.label,a.s.lb,'end'));
    // the selected token
    const sm=S.find(s=>s.main);
    S.forEach(s=>{ if(!s.main) el('circle',{class:s.dot,cx:f1(x(st.sel)),cy:f1(y(s.v(st.sel))),r:3},csvg); });
    el('circle',{class:sm.dot,cx:f1(x(st.sel)),cy:f1(y(sm.v(st.sel))),r:3.5},csvg);
    Q.ov=el('g',{},csvg);
    el('rect',{class:'hit',x:mL-6,y:0,width:pw+12,height:H},csvg);
    csvg.setAttribute('aria-label','Serial depth of the output against token position 1 to '+TMAX+'. '+
      S.map(s=>s.key+(s.v(1)===s.v(TMAX)?' stays at '+s.v(1):' rises from '+s.v(1)+' at t = 1 to '+s.v(TMAX)+' at t = '+TMAX)).join('; ')+'.');
  }
  function chartTip(t){
    const S=Q.S, k=kind();
    let h='<b>t = '+t+'</b><div class="flw-tt">';
    S.slice().sort((a,b)=>(b.main?1:0)-(a.main?1:0)).forEach(s=>{ h+=trow(s.key,s.v(t)+' layers'); });
    h+='</div>';
    const n=k==='loop'?'per token, '+shortName()+' runs '+perTok()+' layers; the others run '+L
                      :'both run '+L+' layers for this token';
    return h+'<div class="flw-tn">'+n+'</div>';
  }
  function onChartMove(ev){
    if(!Q) return;
    const p=mPoint(ev,csvg,Q.W); if(!p) return;
    const t=clamp(Math.round((p.x-Q.mL)/Q.pw*(TMAX-1))+1,1,TMAX);
    Q.ov.textContent='';
    const xx=Math.round(Q.x(t))+0.5;
    el('line',{class:'hair',x1:xx,x2:xx,y1:Q.mT,y2:Q.mT+Q.ph},Q.ov);
    Q.S.forEach(s=>el('circle',{class:s.dot,cx:f1(Q.x(t)),cy:f1(Q.y(s.v(t))),r:s.main?3.5:3},Q.ov));
    showTip(ev,chartTip(t));
  }
  csvg.addEventListener('pointermove',onChartMove);
  csvg.addEventListener('pointerdown',onChartMove);
  csvg.addEventListener('pointerleave',()=>{ if(Q&&Q.ov) Q.ov.textContent=''; hideTip(); });
  csvg.addEventListener('click',ev=>{
    if(!Q) return; const p=mPoint(ev,csvg,Q.W); if(!p) return;
    const t=clamp(Math.round((p.x-Q.mL)/Q.pw*(TMAX-1))+1,1,TMAX);
    if(t<=st.T) selectTok(t);
  });

  /* ---------- status ---------- */
  function updStatus(){
    const k=kind(), s=st.sel, D=Dsz();
    let h;
    if(k==='t2'){
      h='<b>'+name()+'</b>, D = '+D+'. Each token runs '+L+' layers plus one fusion. ';
      h+=s===1?'The output at token 1 depends on a chain of <b>'+L+'</b> layer applications; each later token adds '+D+'. '
              :'The output at token '+s+' depends on a chain of '+L+' + '+(s-1)+' × '+D+' = <b>'+depthOut(s)+'</b> layer applications. ';
      h+='A Transformer’s chain stays at '+L+'.';
    } else if(k==='loop'){
      const v=perTok(), e=C().bs===1&&C().be===L?K()+' × '+L:L+' + '+(K()-1)+' × '+D;
      h='<b>'+C().name+'</b>: '+e+' = <b>'+v+'</b> layer applications per token, chain '+v+' at every position.';
    } else {
      h='<b>Transformer</b>: '+L+' layer applications per token, and the output at every token, including token '+s+', depends on a chain of <b>'+L+'</b>.';
    }
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

  /* ---------- render ---------- */
  function renderAll(){ drawMain(); drawChart(); updStatus(); }
  let lastW=0;
  function layout(){
    const w=Math.round(fig.clientWidth); if(!w) return;
    lastW=w;
    const T=w>=560?6:4;
    if(T!==st.T){ const wasLast=st.sel===st.T; st.T=T; st.sel=wasLast?T:clamp(st.sel,1,T); buildSeg(); }
    renderAll();
  }
  st.T=fig.clientWidth>=560?6:4; st.sel=st.T;
  buildSeg(); syncSliders(); layout();
  if(window.ResizeObserver){
    let raf=0;
    new ResizeObserver(()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; const w=Math.round(fig.clientWidth); if(w&&w!==lastW) layout(); }); }).observe(fig);
  }
})();

/* ---- jacobi ---- */
/* Figure 2 · Jacobi approximation of the recurrent cache (fx-jacobi).
   A toy T2MLR middle block with random weights: Eq. 2.3 (fusion), Eq. 2.4 (cache update) and
   Algorithm 1 (temporal-parallel Jacobi iterations), compared with the exact sequential recurrence.
   Left: relative error of R<k> at each position t (heatmap). Right: max over t against k (log scale). */
(function () {
  'use strict';
  const fig = document.getElementById('fx-jacobi');
  if (!fig) return;

  /* ---------- model: a line-for-line port of the reference check (check.mjs) ---------- */
  const D = 16, T = 48, NL = 2, K = 32, SEED0 = 7;

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeGauss(r) { return () => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }; }
  const mat = (g, m, n, sc) => Array.from({ length: m }, () => Float64Array.from({ length: n }, () => g() * sc));
  function mv(M, x) {
    const out = new Float64Array(M.length);
    for (let i = 0; i < M.length; i++) { const row = M[i]; let s = 0; for (let j = 0; j < row.length; j++) s = s + row[j] * x[j]; out[i] = s; }
    return out;
  }
  function rms(x) {           // RMSNorm, no gain, eps 1e-6
    let ss = 0; for (let i = 0; i < x.length; i++) ss = ss + x[i] * x[i];
    const n = Math.sqrt(ss / x.length + 1e-6), out = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = x[i] / n;
    return out;
  }
  function rmsCache(x) {      // Eq. 2.4 / Alg. 1 line 8: RMSNorm, but the zero vector stays zero
    let ss = 0; for (let i = 0; i < x.length; i++) ss = ss + x[i] * x[i];
    return ss === 0 ? new Float64Array(x.length) : rms(x);
  }
  const sig = z => 1 / (1 + Math.exp(-z));
  const gelu = z => 0.5 * z * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z * z * z)));
  function addv(a, b) { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] + b[i]; return o; }

  function build(seed) {
    const g = makeGauss(rng(seed)), s1 = 1 / Math.sqrt(D);
    const layers = [];
    for (let i = 0; i < NL; i++) layers.push({
      Wq: mat(g, D, D, s1), Wk: mat(g, D, D, s1), Wv: mat(g, D, D, s1), Wo: mat(g, D, D, s1),
      W1: mat(g, 4 * D, D, s1), W2: mat(g, D, 4 * D, 1 / Math.sqrt(4 * D)),
    });
    const fcur = mat(g, D, 2 * D, 1 / Math.sqrt(2 * D)), frec = mat(g, D, 2 * D, 1 / Math.sqrt(2 * D)), Wrec = mat(g, D, D, s1);
    const Hs = Array.from({ length: T }, () => Float64Array.from({ length: D }, () => g()));   // stands in for layers 1..l_start-1
    return { layers, fcur, frec, Wrec, Hs };
  }
  // One token through the middle block (pre-norm causal attention + GELU MLP per layer), appending to per-layer KV caches.
  // Row t depends only on rows 0..t, so this gives exactly the rows of a full causal pass.
  function rowPass(P, x, C) {
    let h = x;
    const sq = Math.sqrt(D);
    for (let l = 0; l < P.layers.length; l++) {
      const Ly = P.layers[l], c = C[l];
      const n = rms(h), q = mv(Ly.Wq, n);
      c.K.push(mv(Ly.Wk, n)); c.V.push(mv(Ly.Wv, n));
      const t = c.K.length - 1, sc = new Float64Array(t + 1);
      let m = -Infinity;
      for (let s = 0; s <= t; s++) { const k = c.K[s]; let a = 0; for (let j = 0; j < D; j++) a = a + q[j] * k[j]; sc[s] = a / sq; if (sc[s] > m) m = sc[s]; }
      let Z = 0; for (let s = 0; s <= t; s++) { sc[s] = Math.exp(sc[s] - m); Z = Z + sc[s]; }
      const o = new Float64Array(D);
      for (let s = 0; s <= t; s++) { const v = c.V[s], w = sc[s] / Z; for (let j = 0; j < D; j++) o[j] += w * v[j]; }
      h = addv(h, mv(Ly.Wo, o));
      const u = mv(Ly.W1, rms(h)); for (let i = 0; i < u.length; i++) u[i] = gelu(u[i]);
      h = addv(h, mv(Ly.W2, u));
    }
    return h;
  }
  const newCaches = P => P.layers.map(() => ({ K: [], V: [] }));
  function Fmid(P, X) { const C = newCaches(P); return X.map(x => rowPass(P, x, C)); }
  // Eq. 2.3: Φ(h,R) = h + tanh(γ_cur)·σ(f_cur([h,R]))⊙h + tanh(γ_rec)·σ(f_rec([h,R]))⊙(W_rec R)
  function Phi(P, h, R, gc, gr) {
    const c = new Float64Array(2 * D); c.set(h, 0); c.set(R, D);
    const a = mv(P.fcur, c), b = mv(P.frec, c), wr = mv(P.Wrec, R), tc = Math.tanh(gc), tr = Math.tanh(gr), out = new Float64Array(D);
    for (let i = 0; i < D; i++) out[i] = h[i] + tc * sig(a[i]) * h[i] + tr * sig(b[i]) * wr[i];
    return out;
  }
  // Exact sequential recurrence. Rin[t] is the cache token t reads (R_{t-1} in the paper); Rin[0] = 0.
  function exact(P, gc, gr) {
    const C = newCaches(P), Rin = [new Float64Array(D)];
    for (let t = 0; t < T; t++) {
      const hend = rowPass(P, Phi(P, P.Hs[t], Rin[t], gc, gr), C);
      Rin.push(rmsCache(addv(hend, Rin[t])));
    }
    return Rin.slice(0, T);
  }
  // Algorithm 1: returns iters[k-1] = R<k>, k = 1..K.
  function jacobi(P, gc, gr) {
    const shift = A => [new Float64Array(D)].concat(A.slice(0, T - 1));
    const iters = [];
    let R = shift(Fmid(P, P.Hs));                                               // lines 2-3: one pass without fusion
    iters.push(R);
    for (let k = 2; k <= K; k++) {
      const Hk = Fmid(P, P.Hs.map((h, t) => Phi(P, h, R[t], gc, gr)));        // line 5
      R = shift(Hk.map((h, t) => addv(h, R[t]))).map(rmsCache);               // line 8
      iters.push(R);
    }
    return iters;
  }
  const norm = x => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s); };
  function run(P, gc, gr) {
    const Rs = exact(P, gc, gr), it = jacobi(P, gc, gr);
    const E = new Float64Array(K * T), worst = new Float64Array(K), worstT = new Int16Array(K);
    for (let k = 0; k < K; k++) {
      let mx = -1, at = 0;
      for (let t = 1; t < T; t++) {
        const r = it[k][t], x = Rs[t], dlt = new Float64Array(D);
        for (let i = 0; i < D; i++) dlt[i] = r[i] - x[i];
        const e = norm(dlt) / norm(x);
        E[k * T + t] = e;
        if (e > mx) { mx = e; at = t; }
      }
      worst[k] = mx; worstT[k] = at;
    }
    return { E, worst, worstT };
  }
  /* ---------- end of model ---------- */

  const NS = 'http://www.w3.org/2000/svg', MINUS = '−';
  const $ = id => document.getElementById(id);
  const heat = $('fx-jacobi-heat'), hsvg = $('fx-jacobi-hsvg'), lbox = $('fx-jacobi-line'), lsvg = $('fx-jacobi-lsvg'),
        selDf = $('fx-jacobi-df'), bNew = $('fx-jacobi-new'), bReset = $('fx-jacobi-reset'),
        note = $('fx-jacobi-note'), status = $('fx-jacobi-status');
  const sliders = Array.from(fig.querySelectorAll('.jb-sl')).map(w => ({
    inp: w.querySelector('.jb-range'), out: w.querySelector('.jb-val'), fill: w.querySelector('.jb-fill'),
    key: w.querySelector('.jb-range').dataset.g,
  }));
  const tip = document.createElement('div'); tip.className = 'fx-tip'; tip.setAttribute('aria-hidden', 'true'); fig.appendChild(tip);

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const f1 = v => (Math.round(v * 10) / 10);
  const sg = v => { const r = f1(v); return r === 0 ? '0' : (r < 0 ? MINUS : '+') + Math.abs(r).toFixed(1); };
  const plainG = v => { const r = f1(v); return (r < 0 ? MINUS : '') + Math.abs(r).toFixed(1).replace(/\.0$/, ''); };
  // numbers: 0.1 ≤ v < 10 as two significant digits, otherwise m.m×10^e
  function sci(v, html) {
    if (v === 0) return '0';
    if (v >= 0.1 && v < 10) return v.toPrecision(2);
    const s = v.toExponential(1).split('e'), ex = +s[1];
    const e = (ex < 0 ? MINUS : '') + Math.abs(ex);
    return html ? s[0] + '×10<sup>' + e + '</sup>' : s[0] + '×10^' + e;
  }
  function tick10(parent, x, y, ex, anchor) {        // "10" with a raised exponent (or "1")
    const t = el('text', { x: x, y: y, 'text-anchor': anchor || 'end' }, parent);
    if (ex === 0) { t.textContent = '1'; return t; }
    t.appendChild(document.createTextNode('10'));
    el('tspan', { dy: -4, class: 'ex' }, t, (ex < 0 ? MINUS : '') + Math.abs(ex));
    return t;
  }

  /* ---------- state + computation ---------- */
  const DEF = { grec: 0.5, gcur: -0.5, df: 16, seed: SEED0 };
  const st = { grec: DEF.grec, gcur: DEF.gcur, df: DEF.df, seed: DEF.seed, hk: -1, ht: -1, lk: -1, ck: -1, ct: -1 };
  let P = null, pSeed = -1, zero = null, res = null;
  function compute() {
    if (pSeed !== st.seed) { P = build(st.seed); pSeed = st.seed; zero = run(P, 0, 0); }
    res = (f1(st.grec) === 0 && f1(st.gcur) === 0) ? zero : run(P, st.gcur, st.grec);
  }
  let pending = 0;
  function schedule() {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; compute(); paint(); });
  }

  /* ---------- heatmap ---------- */
  let H = null, cells = [], hOv = null, yTicks = {};
  function layoutH(W) {
    const mL = 30, mR = 2, top = 18, pw = W - mL - mR, cw = pw / T;
    const ch = clamp(Math.round(cw * 0.9 * 4) / 4, 4, 6.5), rowsH = K * ch;
    return { W, mL, mR, top, pw, cw, ch, rowsH, xl: top + rowsH + 15, Hh: top + rowsH + 20 };
  }
  const hx = t => Math.round(H.mL + t * H.cw);
  const hy = k => Math.round(H.top + (k - 1) * H.ch);
  function drawH() {
    const W = Math.round(heat.clientWidth); if (!W) return;
    H = layoutH(W);
    hsvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H.Hh); hsvg.setAttribute('width', W); hsvg.setAttribute('height', H.Hh);
    hsvg.textContent = '';
    const g = el('g', { 'shape-rendering': 'crispEdges' }, hsvg);
    cells = new Array(K * T);
    for (let k = 1; k <= K; k++) for (let t = 0; t < T; t++) {
      cells[(k - 1) * T + t] = el('rect', { x: hx(t), y: hy(k), width: hx(t + 1) - hx(t), height: hy(k + 1) - hy(k) }, g);
    }
    // frontier t = k − 1: positions to its left are exact by construction (ShiftRight)
    let d = 'M' + hx(1) + ',' + hy(1);
    for (let k = 1; k <= K; k++) d += 'V' + hy(k + 1) + (k < K ? 'H' + hx(k + 1) : '');
    el('path', { class: 'front', d: d }, hsvg);
    el('text', { class: 'exl', x: H.mL + 3, y: hy(K - 1) - 3 }, hsvg, 'exact by construction');
    // axes
    el('text', { x: H.mL - 7, y: 11, 'text-anchor': 'end' }, hsvg, 'k');
    yTicks = {};
    [1, 4, 8, 16, 32].forEach(k => { yTicks[k] = el('text', { x: H.mL - 7, y: (hy(k) + hy(k + 1)) / 2 + 3.6, 'text-anchor': 'end' }, hsvg, String(k)); });
    [0, 15, 31, 47].forEach(t => el('text', { x: (hx(t) + hx(t + 1)) / 2, y: H.xl, 'text-anchor': 'middle' }, hsvg, String(t + 1)));   // positions shown 1-based, as in the text
    el('text', { x: H.mL - 7, y: H.xl, 'text-anchor': 'end' }, hsvg, 't');
    hOv = el('g', {}, hsvg);
    el('rect', { class: 'hit', x: H.mL, y: H.top, width: H.pw, height: H.rowsH }, hsvg);
    paintH();
  }
  function fillOf(e) {
    if (!(e > 0)) return 'var(--bg)';
    const p = Math.round(clamp((Math.log10(e) + 6) / 6, 0, 1) * 100);
    return p < 1 ? 'var(--bg)' : 'color-mix(in oklab, var(--loss) ' + p + '%, var(--bg))';
  }
  function paintH() {
    if (!H || !res) return;
    for (let i = 0; i < K * T; i++) cells[i].style.fill = fillOf(res.E[i]);
    drawHOv();
    const w = res.worst;
    hsvg.setAttribute('aria-label', 'Relative error of the parallel cache at positions t = 1 to 48 after k = 1 to 32 Jacobi iterations. Positions t ≤ k are exact. Worst position: ' +
      [1, 4, 8, 16, 32].map(k => 'k = ' + k + ' ' + sci(w[k - 1])).join(', ') + '. Row k = ' + st.df + ' outlined.');
  }
  function curCell() {                 // heatmap hover, then line-chart hover (row only), then keyboard cursor
    if (st.hk > 0) return [st.hk, st.ht];
    if (st.lk > 0) return [st.lk, -1];
    if (st.ck > 0) return [st.ck, st.ct];
    return null;
  }
  function drawHOv() {
    if (!hOv) return;
    hOv.textContent = '';
    const r = st.df;
    el('rect', { class: 'dfrow', x: H.mL - 0.75, y: hy(r) - 0.75, width: H.pw + 1.5, height: hy(r + 1) - hy(r) + 1.5 }, hOv);
    Object.keys(yTicks).forEach(k => yTicks[k].setAttribute('class', +k === st.df ? 'df' : ''));
    const c = curCell();
    if (c) {
      const [k, t] = c;
      el('rect', { class: 'hrow', x: H.mL - 0.5, y: hy(k) - 0.5, width: H.pw + 1, height: hy(k + 1) - hy(k) + 1 }, hOv);
      if (t >= 0) el('rect', { class: 'hcell', x: hx(t) - 1, y: hy(k) - 1, width: hx(t + 1) - hx(t) + 2, height: hy(k + 1) - hy(k) + 2 }, hOv);
    }
  }
  function hPoint(ev) {
    const b = hsvg.getBoundingClientRect(); if (!H || !b.width) return null;
    const s = H.W / b.width, x = (ev.clientX - b.left) * s, y = (ev.clientY - b.top) * s;
    if (x < H.mL || x > H.mL + H.pw || y < H.top || y > H.top + H.rowsH) return null;
    return { t: clamp(Math.floor((x - H.mL) / H.cw), 0, T - 1), k: clamp(Math.floor((y - H.top) / H.ch) + 1, 1, K) };
  }
  function cellTip(k, t) {
    const e = res.E[(k - 1) * T + t];
    let s = '<b>iteration k = ' + k + ', token t = ' + (t + 1) + '</b><br>';
    if (t <= k - 1) s += '<span class="k">relative error</span> ' + (e < 1e-12 ? '0' : sci(e, true)) + '<br><span class="k">exact by construction</span>';
    else s += '<span class="k">relative error</span> ' + sci(e, true);
    return s;
  }
  function onHMove(ev) {
    const p = hPoint(ev);
    if (!p) { if (st.hk !== -1) { st.hk = -1; st.ht = -1; drawHOv(); drawLOv(); } hideTip(); return; }
    if (p.k !== st.hk || p.t !== st.ht) { st.hk = p.k; st.ht = p.t; drawHOv(); drawLOv(); }
    showTip(ev, cellTip(p.k, p.t));
  }
  hsvg.addEventListener('pointermove', onHMove);
  hsvg.addEventListener('pointerdown', onHMove);
  hsvg.addEventListener('pointerleave', () => { st.hk = -1; st.ht = -1; hideTip(); drawHOv(); drawLOv(); });
  heat.addEventListener('keydown', ev => {
    let k = st.ck, t = st.ct;
    if (k < 0) { k = st.df; t = st.df; }
    switch (ev.key) {
      case 'ArrowUp': if (st.ck > 0) k = Math.max(1, k - 1); break;
      case 'ArrowDown': if (st.ck > 0) k = Math.min(K, k + 1); break;
      case 'ArrowLeft': if (st.ck > 0) t = Math.max(0, t - 1); break;
      case 'ArrowRight': if (st.ck > 0) t = Math.min(T - 1, t + 1); break;
      case 'Home': t = 0; break;
      case 'End': t = T - 1; break;
      case 'PageUp': k = Math.max(1, k - 4); break;
      case 'PageDown': k = Math.min(K, k + 4); break;
      case 'Escape': if (st.ck < 0) return; k = -1; t = -1; break;
      default: return;
    }
    ev.preventDefault();
    st.ck = k; st.ct = t;
    drawHOv(); drawLOv(); updStatus();
  });
  heat.addEventListener('blur', () => { if (st.ck > 0) { st.ck = -1; st.ct = -1; drawHOv(); drawLOv(); updStatus(); } });

  /* ---------- line chart ---------- */
  let L = null, lOv = null;
  const LMIN = -10, LMAX = 1;   // down to 1e-10 so the γ = 0 curve (1.4e-9 at k = 32, seed 7) stays above the floor
  function layoutL(W) {
    const mL = 38, mR = 10, top = H ? H.top : 18, rowsH = H ? H.rowsH : 180;
    return { W, mL, mR, top, pw: W - mL - mR, ph: rowsH, xl: top + rowsH + 15, Hh: top + rowsH + 20 };
  }
  const lx = k => L.mL + (k - 1) / (K - 1) * L.pw;
  const ly = v => L.top + (1 - (clamp(Math.log10(Math.max(v, 1e-300)), LMIN, LMAX) - LMIN) / (LMAX - LMIN)) * L.ph;
  const f2 = v => (Math.round(v * 100) / 100).toString();
  const pathOf = a => Array.from(a, (v, i) => (i ? 'L' : 'M') + f2(lx(i + 1)) + ',' + f2(ly(v))).join('');
  let lSel = null, lZero = null, lDf = null, lDfLab = null, lLabs = null;
  function drawL() {
    const W = Math.round(lbox.clientWidth); if (!W) return;
    L = layoutL(W);
    lsvg.setAttribute('viewBox', '0 0 ' + W + ' ' + L.Hh); lsvg.setAttribute('width', W); lsvg.setAttribute('height', L.Hh);
    lsvg.textContent = '';
    const g = el('g', { 'shape-rendering': 'crispEdges' }, lsvg);
    for (let ex = LMIN; ex <= 0; ex += 2) {
      const y = Math.round(ly(Math.pow(10, ex))) + 0.5;
      el('line', { class: 'gr', x1: L.mL, x2: L.mL + L.pw, y1: y, y2: y }, g);
      tick10(lsvg, L.mL - 7, y + 3.6, ex);
    }
    el('line', { class: 'ax', x1: L.mL + 0.5, x2: L.mL + 0.5, y1: L.top, y2: L.top + L.ph }, g);
    el('line', { class: 'ax', x1: L.mL, x2: L.mL + L.pw, y1: Math.round(L.top + L.ph) + 0.5, y2: Math.round(L.top + L.ph) + 0.5 }, g);
    [1, 4, 8, 16, 32].forEach(k => el('text', { x: lx(k), y: L.xl, 'text-anchor': 'middle' }, lsvg, String(k)));
    el('text', { x: L.mL - 14, y: L.xl, 'text-anchor': 'end' }, lsvg, 'k');
    lDf = el('line', { class: 'dfm', y1: L.top - 4, y2: L.top + L.ph }, lsvg);
    lDfLab = el('text', { class: 'dfl', y: 10 }, lsvg);
    lZero = el('path', { class: 'l0' }, lsvg);
    lSel = el('path', { class: 'l1' }, lsvg);
    lLabs = el('g', {}, lsvg);
    lOv = el('g', {}, lsvg);
    el('rect', { class: 'hit', x: L.mL - 4, y: 0, width: L.pw + 8, height: L.Hh }, lsvg);
    paintL();
  }
  function paintL() {
    if (!L || !res) return;
    lZero.setAttribute('d', pathOf(zero.worst));
    lSel.setAttribute('d', pathOf(res.worst));
    placeDf();
    // direct labels: the selected setting above its line, γ = 0 below its line, at a k where they separate
    lLabs.textContent = '';
    const same = res === zero;
    // the curves fall to the right, so the space above-right and below-left of a line stays clear;
    // pick the first k whose label does not cross the d_forward marker
    const xm = lx(st.df), cw = 6.4;
    const pick = (ks, w, right) => ks.find(k => { const x0 = right ? lx(k) + 5 : lx(k) - 4 - w, x1 = x0 + w; return xm < x0 - 4 || xm > x1 + 4; }) || ks[0];
    const t1 = same ? 'γ = 0 (as set)' : 'as set';
    const kl = pick([3, 5, 9, 12], t1.length * cw, true);
    el('text', { class: 'lab1', x: lx(kl) + 5, y: Math.max(L.top + 9, ly(res.worst[kl - 1]) - 7) }, lLabs, t1);
    if (!same) {
      const kz = pick([9, 12, 7, 20], 5 * cw, false);
      el('text', { class: 'lab0', x: lx(kz) - 4, y: Math.min(L.top + L.ph - 4, ly(zero.worst[kz - 1]) + 13), 'text-anchor': 'end' }, lLabs, 'γ = 0');
    }
    drawLOv();
    const w = res.worst, z = zero.worst;
    lsvg.setAttribute('aria-label', 'Worst-position relative error against iterations k = 1 to 32, log scale. Gates as set: ' +
      [1, 4, 8, 16, 32].map(k => 'k = ' + k + ' ' + sci(w[k - 1])).join(', ') + '. Both gates at 0: ' +
      [1, 4, 8, 16, 32].map(k => 'k = ' + k + ' ' + sci(z[k - 1])).join(', ') + '. Marker at d forward = ' + st.df + '.');
  }
  function placeDf() {
    if (!L) return;
    const x = Math.round(lx(st.df)) + 0.5;
    lDf.setAttribute('x1', x); lDf.setAttribute('x2', x);
    const right = x + 100 > L.mL + L.pw;
    lDfLab.setAttribute('x', right ? x - 4 : x + 4);
    lDfLab.setAttribute('text-anchor', right ? 'end' : 'start');
    lDfLab.textContent = '';
    lDfLab.appendChild(document.createTextNode('d'));
    el('tspan', { class: 'sb', dy: 3 }, lDfLab, 'forward');
    el('tspan', { dy: -3 }, lDfLab, ' = ' + st.df);
  }
  function lineK() { const c = curCell(); return c ? c[0] : -1; }
  function drawLOv() {
    if (!lOv) return;
    lOv.textContent = '';
    const k = lineK(); if (k < 1) return;
    const x = Math.round(lx(k)) + 0.5;
    el('line', { class: 'hair', x1: x, x2: x, y1: L.top, y2: L.top + L.ph }, lOv);
    el('circle', { class: 'd0', cx: f2(lx(k)), cy: f2(ly(zero.worst[k - 1])), r: 3 }, lOv);
    el('circle', { class: 'd1', cx: f2(lx(k)), cy: f2(ly(res.worst[k - 1])), r: 3.5 }, lOv);
  }
  function lineTip(k) {
    return '<b>iteration k = ' + k + '</b><div class="jb-tt">' +
      '<span class="k">as set</span><span>' + sci(res.worst[k - 1], true) + ' <span class="k">at t = ' + (res.worstT[k - 1] + 1) + '</span></span>' +
      '<span class="k">γ = 0</span><span>' + sci(zero.worst[k - 1], true) + ' <span class="k">at t = ' + (zero.worstT[k - 1] + 1) + '</span></span></div>';
  }
  function onLMove(ev) {
    if (!L) return;
    const b = lsvg.getBoundingClientRect(); if (!b.width) return;
    const x = (ev.clientX - b.left) * L.W / b.width;
    const k = clamp(Math.round((x - L.mL) / L.pw * (K - 1)) + 1, 1, K);
    if (k !== st.lk) { st.lk = k; drawLOv(); drawHOv(); }
    showTip(ev, lineTip(k));
  }
  lsvg.addEventListener('pointermove', onLMove);
  lsvg.addEventListener('pointerdown', onLMove);
  lsvg.addEventListener('pointerleave', () => { st.lk = -1; hideTip(); drawLOv(); drawHOv(); });

  /* ---------- tooltip ---------- */
  function showTip(ev, html) {
    tip.innerHTML = html; tip.classList.add('on');
    const fr = fig.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = ev.clientX - fr.left + 14, y = ev.clientY - fr.top + 16;
    if (x + tw > fr.width) x = ev.clientX - fr.left - 14 - tw;
    if (y + th > fr.height) y = ev.clientY - fr.top - 12 - th;
    tip.style.left = clamp(x, 0, Math.max(0, fr.width - tw)) + 'px';
    tip.style.top = clamp(y, 0, Math.max(0, fr.height - th)) + 'px';
  }
  function hideTip() { tip.classList.remove('on'); }

  /* ---------- text ---------- */
  const gTxt = () => 'γ<sub>rec</sub> = ' + plainG(st.grec) + ', γ<sub>cur</sub> = ' + plainG(st.gcur);
  function updStatus() {
    if (!res) return;
    const df = st.df, w = res.worst[df - 1];
    let s = '<b>d<sub>forward</sub> = ' + df + '</b>: positions 1–' + df + ' are exact, and the worst of positions ' + (df + 1) + '–' + T +
      ' has relative error <b>' + sci(w, true) + '</b> (' + gTxt() + ')';
    s += res === zero ? '.' : '; with both gates at 0 it is ' + sci(zero.worst[df - 1], true) + '.';
    if (st.ck > 0) {
      const k = st.ck, t = st.ct, e = res.E[(k - 1) * T + t];
      s += ' Cursor: k = ' + k + ', t = ' + (t + 1) + ', relative error ' + (t <= k - 1 ? (e < 1e-12 ? '0' : sci(e, true)) + ', exact by construction' : sci(e, true)) +
        '; worst at this k ' + sci(res.worst[k - 1], true) + '.';
    }
    status.innerHTML = s;
  }
  const coarse = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
  function updNote() {
    note.textContent = 'random weights, seed ' + st.seed + ' · d = ' + D + ', T = ' + T + ', 2 layers · ' +
      (coarse ? 'tap a cell or the chart for values' : 'focus the map and use the arrow keys to read cells');
  }

  /* ---------- controls ---------- */
  function syncSliders() {
    sliders.forEach(s => {
      const v = s.key === 'rec' ? st.grec : st.gcur, p = (v + 2) / 4;
      s.inp.value = String(v);
      s.out.textContent = sg(v);
      s.inp.setAttribute('aria-valuetext', (s.key === 'rec' ? 'gamma rec ' : 'gamma cur ') + plainG(v));
      s.fill.style.left = (Math.min(p, 0.5) * 100) + '%';
      s.fill.style.width = (Math.abs(p - 0.5) * 100) + '%';
    });
  }
  sliders.forEach(s => {
    s.inp.setAttribute('aria-label', s.key === 'rec' ? 'gamma rec, the gate on the recurrent term' : 'gamma cur, the gate on the current term');
    s.inp.addEventListener('input', () => {
      const v = f1(+s.inp.value);
      if (s.key === 'rec') st.grec = v; else st.gcur = v;
      syncSliders(); schedule();
    });
  });
  selDf.addEventListener('change', () => { st.df = +selDf.value || 16; drawHOv(); placeDf(); paintH(); paintL(); updStatus(); });
  bNew.addEventListener('click', () => { st.seed += 1; updNote(); schedule(); });
  bReset.addEventListener('click', () => {
    st.grec = DEF.grec; st.gcur = DEF.gcur; st.df = DEF.df; st.seed = DEF.seed;
    selDf.value = String(DEF.df); selDf.dispatchEvent(new Event('change', { bubbles: true }));
    syncSliders(); updNote(); schedule();
  });

  function paint() { paintH(); paintL(); updStatus(); }
  let lastW = 0;
  function renderAll() { lastW = Math.round(fig.clientWidth); drawH(); drawL(); }
  syncSliders(); updNote(); compute(); renderAll(); updStatus();
  if (window.ResizeObserver) {
    new ResizeObserver(() => { const w = Math.round(fig.clientWidth); if (w && w !== lastW) renderAll(); }).observe(fig);
  }
})();

/* ---- grad ---- */
/* Figure 3 · how far gradients move from the (32, 32) anchor under fewer Jacobi iterations.
   Rows d_forward, columns d_backward; only d_backward <= d_forward exists. Values from the paper's Figure 7 (App. B.3). */
(function () {
  'use strict';
  const fig = document.getElementById('fx-grad');
  if (!fig) return;

  /* ---------- data (paper, Figure 7; each row runs from d_backward = min(d_forward, 32) down to 0) ---------- */
  const ROWS = [32, 16, 8, 4, 2, 1];
  const COLS = [32, 16, 8, 4, 2, 1, 0];
  const RAW = {
    all: {
      cos: [[1.00, 1.00, 1.00, 1.00, 0.98, 0.95, 0.88], [1.00, 1.00, 1.00, 0.99, 0.95, 0.88], [0.99, 0.99, 0.98, 0.96, 0.88],
        [0.48, 0.55, 0.61, 0.68], [0.13, 0.15, 0.17], [0.06, 0.06]],
      l2: [[0.00, 0.01, 0.01, 0.06, 0.16, 0.26, 0.45], [0.03, 0.03, 0.06, 0.17, 0.27, 0.45], [0.16, 0.15, 0.19, 0.28, 0.45],
        [1.77, 1.46, 1.16, 0.83], [5.43, 3.99, 3.10], [8.95, 6.18]]
    },
    fusion: {
      cos: [[1.00, 1.00, 1.00, 1.00, 0.70, 0.68, 0.62], [1.00, 1.00, 1.00, 0.99, 0.68, 0.62], [0.99, 0.99, 0.98, 0.96, 0.62],
        [0.26, 0.56, 0.61, 0.67], [-0.21, -0.21, -0.21], [-0.27, -0.27]],
      l2: [[0.00, 0.04, 0.03, 0.11, 0.32, 0.43, 0.81], [0.08, 0.06, 0.10, 0.28, 0.43, 0.81], [0.20, 0.22, 0.17, 0.29, 0.72],
        [2.15, 2.44, 3.28, 2.22], [30.06, 30.04, 15.91], [74.10, 74.10]]
    },
    layer15: {
      cos: [[1.00, 1.00, 1.00, 1.00, 0.99, 0.96, 0.87], [1.00, 1.00, 1.00, 0.99, 0.96, 0.87], [0.97, 0.97, 0.97, 0.95, 0.86],
        [0.40, 0.44, 0.51, 0.60], [0.15, 0.17, 0.17], [0.09, 0.09]],
      l2: [[0.00, 0.01, 0.01, 0.06, 0.16, 0.28, 0.50], [0.03, 0.03, 0.06, 0.17, 0.28, 0.50], [0.26, 0.22, 0.23, 0.31, 0.51],
        [3.01, 2.67, 1.93, 1.13], [4.54, 3.48, 3.01], [6.84, 4.41]]
    }
  };
  const GROUPS = { all: 'All parameters', fusion: 'Fusion module', layer15: 'Layer 15' };
  const METRICS = { cos: 'cosine', l2: 'relative ℓ2 distance' };
  const FIRST = ROWS.map(function (df) { return COLS.indexOf(Math.min(df, 32)); });   // first existing column per row
  function val(g, m, r, c) { return c < FIRST[r] ? null : RAW[g][m][r][c - FIRST[r]]; }
  function has(r, c) { return r >= 0 && r < ROWS.length && c >= FIRST[r] && c < COLS.length; }
  const TR = { r: ROWS.indexOf(16), c: COLS.indexOf(4) };   // training setting
  const AN = { r: 0, c: 0 };                                 // anchor (32, 32)
  const R4 = ROWS.indexOf(4);

  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';
  const GL = 46;         // left gutter: rotated axis title + row ticks
  const TOP = 36;        // x-axis title + column ticks above the grid

  const $ = function (s) { return fig.querySelector(s); };
  const body = $('.grad-body'), wrap = $('.grad-plot'), status = $('.fx-status');
  const scale = $('.fx-scale'), s0 = $('.grad-s0'), s1 = $('.grad-s1'), snote = $('.grad-snote');
  const segs = { group: $('.fx-seg[data-k="group"]'), metric: $('.fx-seg[data-k="metric"]') };
  const tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);

  const st = { group: 'all', metric: 'cos' };
  let G = null, svg = null, O = null, TK = null;
  let hov = null;        // {r, c} under the pointer
  let cur = null;        // {r, c} keyboard cursor while the chart has focus

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
  function sub(base, s) {   // HTML "d<sub>forward</sub>"
    const f = document.createDocumentFragment();
    f.append(base);
    f.appendChild(h('sub', null, s));
    return f;
  }
  function fmt(v) { const s = Math.abs(v).toFixed(2); return v < 0 ? MINUS + s : s; }
  function frac(v, m) {
    if (m === 'cos') return Math.min(1, Math.max(0, 1 - v));
    return Math.min(1, Math.max(0, Math.log10(1 + v) / Math.log10(11)));
  }
  function fillOf(v, m) {
    const p = Math.round(frac(v, m) * 100);
    return p ? 'color-mix(in oklab, var(--loss) ' + p + '%, var(--bg))' : null;
  }
  function snap(v) { const d = window.devicePixelRatio || 1; return Math.round(v * d) / d; }
  function local(e) {
    const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: (e.clientX - b.left) * (vb.width / (b.width || 1)), y: (e.clientY - b.top) * (vb.height / (b.height || 1)) };
  }
  function label(r, c) { return 'd_forward = ' + ROWS[r] + ', d_backward = ' + COLS[c]; }
  function tag(r, c) {
    if (r === TR.r && c === TR.c) return 'training setting';
    if (r === AN.r && c === AN.c) return 'anchor';
    return '';
  }

  /* ---------- geometry ---------- */
  function geom(avail) {
    const cw = Math.max(22, Math.min(56, Math.floor((avail - GL - 2) / COLS.length)));
    const ch = cw >= 48 ? 32 : Math.max(24, Math.round(cw * 0.72));
    const x = [], y = [];
    for (let c = 0; c <= COLS.length; c++) x.push(snap(GL + c * cw));
    for (let r = 0; r <= ROWS.length; r++) y.push(snap(TOP + r * ch));
    return { cw: cw, ch: ch, x: x, y: y, W: GL + COLS.length * cw + 2, H: TOP + ROWS.length * ch + 2, nums: cw >= 30 };
  }
  function cellAt(p) {
    const c = Math.floor((p.x - GL) / G.cw), r = Math.floor((p.y - TOP) / G.ch);
    return has(r, c) ? { r: r, c: c } : null;
  }

  /* ---------- draw ---------- */
  function subText(parent, attrs, base, s) {   // SVG "d" with a lowered subscript
    const t = el('text', attrs, parent);
    t.appendChild(document.createTextNode(base));
    const ts = el('tspan', { dy: '3', 'font-size': '8.5' }, t);
    ts.textContent = s;
    return t;
  }
  function draw() {
    const avail = Math.max(160, Math.floor(body.clientWidth));
    G = geom(avail);
    wrap.style.width = G.W + 'px';
    if (!svg) {
      svg = el('svg', { class: 'fx-svg', role: 'img', tabindex: '0', 'aria-keyshortcuts': 'ArrowUp ArrowDown ArrowLeft ArrowRight Home End Escape' });
      wrap.appendChild(svg);
      bind();
    }
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + G.W + ' ' + G.H);
    svg.setAttribute('width', G.W);
    svg.setAttribute('height', G.H);

    // axis titles and ticks
    const gx = (G.x[0] + G.x[COLS.length]) / 2, gy = (G.y[0] + G.y[ROWS.length]) / 2;
    // axis titles, each bracketed by hairlines spanning the grid so they read as belonging to all columns / rows
    const tx = subText(svg, { class: 'ttl', x: gx.toFixed(1), y: 10, 'text-anchor': 'middle' }, 'd', 'backward');
    const ty = subText(svg, { class: 'ttl', x: 0, y: 0, 'text-anchor': 'middle', transform: 'translate(10 ' + gy.toFixed(1) + ') rotate(-90)' }, 'd', 'forward');
    const lx = tx.getComputedTextLength ? tx.getComputedTextLength() : 60, ly = ty.getComputedTextLength ? ty.getComputedTextLength() : 56;
    const bx0 = G.x[0] + 2, bx1 = G.x[COLS.length] - 2, by0 = G.y[0] + 2, by1 = G.y[ROWS.length] - 2;
    el('path', { class: 'brk', d: 'M' + bx0 + ' 6.5H' + Math.round(gx - lx / 2 - 7) + 'M' + Math.round(gx + lx / 2 + 7) + ' 6.5H' + bx1 +
      'M' + bx0 + ' 4V9M' + bx1 + ' 4V9' }, svg);
    el('path', { class: 'brk', d: 'M6.5 ' + by0 + 'V' + Math.round(gy - ly / 2 - 7) + 'M6.5 ' + Math.round(gy + ly / 2 + 7) + 'V' + by1 +
      'M4 ' + by0 + 'H9M4 ' + by1 + 'H9' }, svg);
    TK = { r: [], c: [] };
    COLS.forEach(function (v, c) {
      const t = el('text', { class: 'tk', x: ((G.x[c] + G.x[c + 1]) / 2).toFixed(1), y: TOP - 8, 'text-anchor': 'middle' }, svg);
      t.textContent = v;
      TK.c.push(t);
    });
    ROWS.forEach(function (v, r) {
      const t = el('text', { class: 'tk', x: GL - 8, y: ((G.y[r] + G.y[r + 1]) / 2).toFixed(1), dy: '0.35em', 'text-anchor': 'end' }, svg);
      t.textContent = v;
      TK.r.push(t);
    });

    // cells
    const cells = el('g', null, svg), nums = el('g', null, svg);
    for (let r = 0; r < ROWS.length; r++) {
      for (let c = FIRST[r]; c < COLS.length; c++) {
        const v = val(st.group, st.metric, r, c);
        const rc = el('rect', { class: 'cell', x: G.x[c] + 0.5, y: G.y[r] + 0.5,
          width: +(G.x[c + 1] - G.x[c]).toFixed(3), height: +(G.y[r + 1] - G.y[r]).toFixed(3) }, cells);
        rc.style.fill = fillOf(v, st.metric) || 'var(--bg)';
        if (G.nums) {
          const t = el('text', { class: 'v' + (frac(v, st.metric) >= 0.75 ? ' hi' : ''),
            x: ((G.x[c] + G.x[c + 1]) / 2 + 0.5).toFixed(1), y: ((G.y[r] + G.y[r + 1]) / 2 + 0.5).toFixed(1),
            dy: '0.35em', 'text-anchor': 'middle' }, nums);
          if (G.cw < 42) t.style.fontSize = '10px';
          t.textContent = fmt(v);
        }
      }
    }

    // anchor (corner mark) and training setting (accent outline)
    const ax = G.x[AN.c] + 1, ay = G.y[AN.r] + 1;
    el('path', { class: 'an', d: 'M' + ax + ' ' + ay + 'h8l-8 8z' }, svg);
    el('rect', { class: 'tr', x: G.x[TR.c] + 0.5, y: G.y[TR.r] + 0.5, width: +(G.x[TR.c + 1] - G.x[TR.c]).toFixed(2),
      height: +(G.y[TR.r + 1] - G.y[TR.r]).toFixed(2) }, svg);

    const ov = el('g', { class: 'ov' }, svg);
    O = {
      row: el('rect', { class: 'ln', visibility: 'hidden' }, ov),
      col: el('rect', { class: 'ln', visibility: 'hidden' }, ov),
      cell: el('rect', { class: 'cur', visibility: 'hidden' }, ov)
    };
    svg.setAttribute('aria-label', ariaText());
    const a = hov || cur;
    if (a) mark(a);
  }

  /* ---------- hover / cursor marks ---------- */
  function box(rect, r0, r1, c0, c1) {   // outline around rows r0..r1, columns c0..c1 (inclusive)
    rect.setAttribute('x', G.x[c0] + 0.5);
    rect.setAttribute('y', G.y[r0] + 0.5);
    rect.setAttribute('width', +(G.x[c1 + 1] - G.x[c0]).toFixed(3));
    rect.setAttribute('height', +(G.y[r1 + 1] - G.y[r0]).toFixed(3));
    rect.setAttribute('visibility', 'visible');
  }
  function hide(e) { e.setAttribute('visibility', 'hidden'); }
  function lastRow(c) { let r = 0; while (r + 1 < ROWS.length && has(r + 1, c)) r++; return r; }
  function mark(a) {
    box(O.row, a.r, a.r, FIRST[a.r], COLS.length - 1);
    box(O.col, 0, lastRow(a.c), a.c, a.c);
    box(O.cell, a.r, a.r, a.c, a.c);
    TK.r.forEach(function (t, i) { t.classList.toggle('on', i === a.r); });
    TK.c.forEach(function (t, i) { t.classList.toggle('on', i === a.c); });
  }
  function unmark() {
    if (!O) return;
    hide(O.row); hide(O.col); hide(O.cell);
    TK.r.concat(TK.c).forEach(function (t) { t.classList.remove('on'); });
  }

  /* ---------- tooltip ---------- */
  function setTip(r, c) {
    const v = val(st.group, st.metric, r, c);
    tip.textContent = '';
    const l1 = h('div'), sw = h('span', 'sw');
    sw.style.background = fillOf(v, st.metric) || 'var(--bg)';
    l1.append(sw, h('b', 'v', fmt(v)), ' ');
    if (st.metric === 'cos') l1.appendChild(h('span', 'k', 'cosine similarity'));
    else { const k = h('span', 'k'); k.append(sub('relative ℓ', '2'), ' distance'); l1.appendChild(k); }
    const l2 = h('div');
    l2.append(sub('d', 'forward'), ' = ' + ROWS[r] + ', ', sub('d', 'backward'), ' = ' + COLS[c]);
    const l3 = h('div');
    l3.appendChild(h('span', 'k', GROUPS[st.group].toLowerCase() + ', vs (32, 32)'));
    const t = tag(r, c);
    if (t) l3.append(h('span', 'k', ' · '), h('span', 'tag', t));
    tip.append(l1, l2, l3);
  }
  function placeTip(cx, cy, dx, dy) {
    const fr = fig.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = cx - fr.left + dx, y = cy - fr.top + dy;
    if (x + tw > fr.width) x = cx - fr.left - dx - tw;
    x = Math.max(0, Math.min(x, fr.width - tw));
    if (y + th > fr.height) y = cy - fr.top - dy - th;
    y = Math.max(0, y);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
    tip.classList.add('on');
  }
  function tipAtCell(a) {   // keyboard: show the tooltip just below the grid, under the cursor's column
    const b = svg.getBoundingClientRect(), k = b.width / G.W;
    setTip(a.r, a.c);
    placeTip(b.left + G.x[a.c] * k, b.bottom, 0, 8);
  }

  function unhover() {
    if (!hov) return;
    hov = null;
    if (cur) { mark(cur); tipAtCell(cur); }
    else { unmark(); tip.classList.remove('on'); }
  }
  function bind() {
    function move(e) {
      if (!G) return;
      const a = cellAt(local(e));
      if (!a) { unhover(); return; }
      if (!hov || hov.r !== a.r || hov.c !== a.c) {
        hov = a;
        mark(a);
        setTip(a.r, a.c);
      }
      placeTip(e.clientX, e.clientY, 14, 16);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') move(e); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') unhover(); });
    svg.addEventListener('focus', function () {
      if (!svg.matches(':focus-visible')) return;
      if (!cur) cur = { r: TR.r, c: TR.c };
      hov = null;
      mark(cur); tipAtCell(cur); announce();
    });
    svg.addEventListener('blur', function () {
      if (!cur) return;
      cur = null;
      if (!hov) { unmark(); tip.classList.remove('on'); }
      announce();
    });
    svg.addEventListener('keydown', function (e) {
      let a = cur ? { r: cur.r, c: cur.c } : { r: TR.r, c: TR.c };
      switch (e.key) {
        case 'ArrowLeft': a.c = Math.max(FIRST[a.r], a.c - 1); break;
        case 'ArrowRight': a.c = Math.min(COLS.length - 1, a.c + 1); break;
        case 'ArrowUp': a.r = Math.max(0, a.r - 1); break;
        case 'ArrowDown': a.r = Math.min(ROWS.length - 1, a.r + 1); a.c = Math.max(a.c, FIRST[a.r]); break;
        case 'Home': a.c = FIRST[a.r]; break;
        case 'End': a.c = COLS.length - 1; break;
        case 'Escape':
          if (!cur) return;
          cur = null; hov = null; unmark(); tip.classList.remove('on'); announce(); e.preventDefault(); return;
        default: return;
      }
      e.preventDefault();
      cur = a; hov = null;
      mark(a); tipAtCell(a); announce();
    });
  }
  document.addEventListener('pointerdown', function (e) {   // touch: a tap elsewhere dismisses the tooltip
    if (!hov || e.pointerType === 'mouse' || (svg && svg.contains(e.target))) return;
    unhover();
  }, true);

  /* ---------- text ---------- */
  function metricHTML(parent) {
    if (st.metric === 'cos') parent.append('cosine');
    else parent.append(sub('relative ℓ', '2'), ' distance');
  }
  function announce() {
    const tr = val(st.group, st.metric, TR.r, TR.c);
    const row = RAW[st.group][st.metric][R4];
    const lo = Math.min.apply(null, row), hi = Math.max.apply(null, row);
    status.textContent = '';
    status.append(h('b', null, GROUPS[st.group]), ': ');
    metricHTML(status);
    const nw = h('span', 'nw');
    nw.append(sub('d', 'forward'), ' = 4.');
    status.append(' ', h('b', null, fmt(tr)), ' at the training setting (16, 4); ', h('b', null, fmt(lo)), ' to ',
      h('b', null, fmt(hi)), ' with ', nw);
    if (cur) {
      const v = val(st.group, st.metric, cur.r, cur.c);
      const a = h('span', 'nw'), b = h('span', 'nw');
      a.append(sub('d', 'forward'), ' = ' + ROWS[cur.r] + ',');
      b.append(sub('d', 'backward'), ' = ' + COLS[cur.c] + ': ', h('b', null, fmt(v)), '.');
      status.append(' Selected: ', a, ' ', b);
    }
  }
  function ariaText() {
    const m = st.metric === 'cos' ? 'cosine similarity' : 'relative l2 distance';
    const rows = ROWS.map(function (df, r) {
      const vs = [];
      for (let c = FIRST[r]; c < COLS.length; c++) vs.push(COLS[c] + ': ' + fmt(val(st.group, st.metric, r, c)));
      return 'd_forward ' + df + ' (by d_backward) ' + vs.join(', ');
    });
    return 'Triangular heatmap of the ' + m + ' between the gradient of ' + GROUPS[st.group].toLowerCase() +
      ' under (d_forward, d_backward) and under the anchor (32, 32). Training setting (16, 4) is outlined. ' + rows.join('; ') +
      '. Use the arrow keys to move between cells.';
  }
  function key() {
    if (st.metric === 'cos') {
      s0.textContent = '1.00'; s1.textContent = '≤ 0';
      snote.textContent = 'cosine similarity to (32, 32)';
      scale.setAttribute('aria-label', 'Color scale: background at cosine 1.00, full red at cosine 0 or below, linear');
    } else {
      s0.textContent = '0'; s1.textContent = '≥ 10';
      snote.textContent = '';
      snote.append(sub('relative ℓ', '2'), ', log scale');
      scale.setAttribute('aria-label', 'Color scale: background at relative l2 distance 0, full red at 10 or more, log scale');
    }
  }

  /* ---------- controls ---------- */
  Object.keys(segs).forEach(function (k) {
    segs[k].addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b || st[k] === b.dataset.v) return;
      st[k] = b.dataset.v;
      segs[k].querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      render();
    });
  });

  function render() {
    draw();
    key();
    announce();
    const a = hov || cur;
    if (a) { setTip(a.r, a.c); if (!hov) tipAtCell(a); }
  }
  render();

  let lastW = body.clientWidth, raf = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      const w = body.clientWidth;
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { hov = null; tip.classList.remove('on'); render(); });
    }).observe(body);
  }
})();

/* ---- s5 ---- */
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

/* ---- placement ---- */
/* Figure 5 · where the recurrent block sits. Rows = model configurations: a 30-cell layer strip (which layers recur or
   loop) and a dot plot of the selected score against the parameter-matched Transformer baseline.
   Data verbatim from the paper: zero-shot accuracy from Tables 1, 2 and 11 (135M, 10B FineWeb-Edu tokens);
   finetuned pass@1 from the bar labels of Figure 6. */
(function () {
  'use strict';
  const fig = document.getElementById('fx-placement');
  if (!fig) return;

  const NS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';
  const NL = 30;   // layers in the 135M backbone

  /* ---------- data ---------- */
  const ZK = ['arcc', 'arce', 'hs', 'obqa', 'piqa', 'sciq', 'wg', 'avg'];
  const FK = ['va', 'prosqa', 'hotpot', 'gsms', 'gsmnl'];
  const NAME = {
    arcc: 'ARC-C', arce: 'ARC-E', hs: 'HellaSwag', obqa: 'OBQA', piqa: 'PIQA', sciq: 'SciQ', wg: 'Winogrande', avg: 'Average',
    va: 'Variable Assignment', prosqa: 'ProsQA-Hard', hotpot: 'HotpotQA (Easy)', gsms: 'GSM-Aug (Symbolic)', gsmnl: 'GSM-Aug (Natural Language)'
  };
  const SHORT = {
    arcc: 'ARC-C', arce: 'ARC-E', hs: 'HellaSwag', obqa: 'OBQA', piqa: 'PIQA', sciq: 'SciQ', wg: 'Winogrande', avg: 'Average',
    va: 'Var. Assignment', prosqa: 'ProsQA-Hard', hotpot: 'HotpotQA (Easy)', gsms: 'GSM-Aug (Sym.)', gsmnl: 'GSM-Aug (NL)'
  };
  function zs(a) { const o = {}; ZK.forEach(function (k, i) { o[k] = a[i]; }); return o; }
  function ft(a) { const o = {}; FK.forEach(function (k, i) { o[k] = a[i]; }); return o; }
  // Zero-shot order: ARC-C, ARC-E, HS, OBQA, PIQA, SciQ, WG | Avg. Finetuned order: VA, ProsQA-Hard, HotpotQA, GSM-Sym, GSM-NL.
  const R = {
    base:   { kind: 'base', name: 'Transformer baseline', zs: zs([24.74, 44.28, 29.81, 30.20, 61.53, 60.80, 48.46, 42.83]), ft: ft([0.494, 0.151, 0.214, 0.381, 0.265]) },
    r1_30:  { kind: 't2', s: 1, e: 30, zs: zs([24.49, 43.48, 29.98, 30.00, 60.72, 62.60, 52.25, 43.36]), ft: ft([0.773, 0.166, 0.246, 0.391, 0.268]), full: true },
    r5_26:  { kind: 't2', s: 5, e: 26, zs: zs([23.98, 46.13, 30.75, 29.80, 60.77, 62.80, 51.85, 43.73]), ft: ft([0.921, 0.178, 0.264, 0.436, 0.310]) },
    r9_22:  { kind: 't2', s: 9, e: 22, pos: 'middle', zs: zs([24.15, 45.24, 30.40, 29.20, 61.15, 66.40, 51.54, 44.01]), ft: ft([0.939, 0.167, 0.268, 0.409, 0.314]) },
    r13_18: { kind: 't2', s: 13, e: 18, pos: 'middle', zs: zs([24.23, 45.50, 29.95, 31.20, 61.70, 64.20, 52.17, 44.14]), ft: ft([0.945, 0.168, 0.216, 0.425, 0.281]) },
    r15_16: { kind: 't2', s: 15, e: 16, zs: zs([24.40, 45.83, 30.11, 29.20, 59.63, 60.20, 50.83, 42.89]) },
    r1_6:   { kind: 't2', s: 1, e: 6, pos: 'early', zs: zs([24.66, 45.08, 29.83, 30.00, 60.07, 61.00, 48.54, 42.74]) },
    r25_30: { kind: 't2', s: 25, e: 30, pos: 'late', zs: zs([25.09, 45.24, 29.65, 28.20, 60.12, 61.20, 50.59, 42.87]) },
    r1_14:  { kind: 't2', s: 1, e: 14, pos: 'early', zs: zs([23.38, 44.70, 28.59, 29.00, 59.25, 59.50, 51.07, 42.21]) },
    r17_30: { kind: 't2', s: 17, e: 30, pos: 'late', zs: zs([23.98, 44.02, 29.97, 31.40, 60.28, 61.90, 50.43, 43.14]) },
    pause:  { kind: 'pause', name: 'Pause tokens ×2', zs: zs([24.74, 44.57, 29.51, 31.60, 60.23, 61.90, 50.59, 43.31]) },
    loopF:  { kind: 'loop', name: 'Full-looped ×2', s: 1, e: 30, K: 2, zs: zs([24.83, 44.95, 29.84, 30.80, 60.23, 60.70, 49.57, 42.99]) },
    loopM:  { kind: 'loop', name: 'Middle-looped ×3', s: 9, e: 22, K: 3, zs: zs([23.04, 45.16, 30.12, 30.20, 60.17, 59.80, 50.28, 42.68]) }
  };
  Object.keys(R).forEach(function (k) {
    const r = R[k];
    r.id = k;
    if (r.kind === 't2') { r.D = r.e - r.s + 1; r.name = 'T2MLR (' + r.s + ',' + r.e + ')'; }
  });
  const GROUPS = {
    vary:  { name: 'vary the span', secs: [{ rows: ['r1_30', 'r5_26', 'r9_22', 'r13_18', 'r15_16'] }] },
    move:  { name: 'move a fixed span', pos: true, secs: [
      { t: 'blocks of 6 layers', st: 'D=6', rows: ['r1_6', 'r13_18', 'r25_30'] },
      { t: 'blocks of 14 layers', st: 'D=14', rows: ['r1_14', 'r9_22', 'r17_30'] }] },
    other: { name: 'other ways to add compute', secs: [
      { t: 'T2MLR', st: 'T2MLR', rows: ['r9_22', 'r13_18'] },
      { t: 'pause and looped (extra inference compute)', st: 'pause/looped', rows: ['pause', 'loopF', 'loopM'] }] },
    all:   { name: 'all', pos: true, secs: [
      { t: 'vary the span', st: 'span', rows: ['r1_30', 'r5_26', 'r9_22', 'r13_18', 'r15_16'] },
      { t: 'early and late blocks', st: 'early/late', rows: ['r1_6', 'r25_30', 'r1_14', 'r17_30'] },
      { t: 'pause and looped (extra inference compute)', st: 'pause/looped', rows: ['pause', 'loopF', 'loopM'] }] }
  };

  /* ---------- state + elements ---------- */
  const $ = function (s) { return fig.querySelector(s); };
  const sel = $('#fx-placement-metric');
  const seg = $('.fx-placement-grp .fx-seg');
  const wrap = $('.fx-placement-chart');
  const status = $('#fx-placement-status');
  const tip = document.createElement('div');
  tip.className = 'fx-tip';
  tip.setAttribute('aria-hidden', 'true');
  fig.appendChild(tip);
  const st = { m: sel.value || 'avg', g: 'vary' };
  let C = null;          // current layout: {svg, rows:[{r, y0, y1, yc, dx}], ...}
  let act = -1;          // index of the highlighted row, -1 = none
  let actBy = null;      // 'ptr' | 'key'

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
  function isFt(m) { return FK.indexOf(m) >= 0; }
  function val(r, m) { const src = isFt(m) ? r.ft : r.zs; return src && src[m] != null ? src[m] : null; }
  function dec(m) { return isFt(m) ? 3 : 2; }
  function fmt(v, m) { return v.toFixed(dec(m)); }
  function delta(v, b, m) {   // rounded difference of two printed values, as text with sign
    const p = Math.pow(10, dec(m)), d = Math.round((v - b) * p) / p;
    if (d === 0) return (0).toFixed(dec(m));
    return (d < 0 ? MINUS : '+') + Math.abs(d).toFixed(dec(m));
  }
  function cmp(v, b, m) { const p = Math.pow(10, dec(m)), d = Math.round((v - b) * p); return d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'; }
  function desc(r) {
    if (r.kind === 't2') return 'D=' + r.D + (GROUPS[st.g].pos && r.pos ? ' · ' + r.pos : '');
    if (r.kind === 'loop') return 'layers ' + r.s + '–' + r.e;
    return '';
  }
  function shortLab(r) {   // used in the status line
    if (r.kind === 't2' && GROUPS[st.g].pos && r.pos) return r.s + '–' + r.e + ' (' + r.pos + ')';
    return r.kind === 'base' ? 'baseline' : r.name;
  }
  function how(r) {
    if (r.kind === 'base') return 'standard Transformer, hidden size 584';
    if (r.kind === 't2') return 'recurrent block: layers ' + r.s + '–' + r.e + ' (D = ' + r.D + ')';
    if (r.kind === 'loop') return (r.s === 1 && r.e === NL ? 'all 30 layers' : 'layers ' + r.s + '–' + r.e) + ' run ' + (r.K === 2 ? 'twice' : r.K + ' times') + ' per token';
    return 'pause-token baseline; no recurrence';
  }
  function metricHead(m) { return SHORT[m] + (isFt(m) ? ', pass@1' : m === 'avg' ? ' of 7 tasks, %' : ', %'); }
  function metricLong(m) {
    if (m === 'avg') return 'Average zero-shot accuracy';
    return isFt(m) ? NAME[m] + ' pass@1 after finetuning' : NAME[m] + ' zero-shot accuracy';
  }
  function niceStep(span, n) {
    const c = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20];
    for (let i = 0; i < c.length; i++) if (span / c[i] <= n) return c[i];
    return c[c.length - 1];
  }
  function stepDec(s) { return s >= 1 ? 0 : s >= 0.1 ? (s === 0.25 ? 2 : 1) : (s === 0.025 ? 3 : 2); }

  /* ---------- rows for the current selection ---------- */
  function layoutRows() {
    const g = GROUPS[st.g], out = [{ r: R.base, sec: -1 }];
    g.secs.forEach(function (s, i) { s.rows.forEach(function (id) { out.push({ r: R[id], sec: i }); }); });
    return out;
  }

  /* ---------- render ---------- */
  function render(forceNarrow) {
    hideTip();
    const W = Math.max(260, Math.round(wrap.clientWidth));
    const narrow = forceNarrow === true || W < 540;
    const m = st.m, g = GROUPS[st.g], rows = layoutRows(), showHeads = g.secs.length > 1 || !!g.secs[0].t;
    const base = val(R.base, m);

    // Horizontal geometry.
    const pitch = narrow ? 4 : 5, stripW = NL * pitch - 1, sh = narrow ? 8 : 10;
    const LW = narrow ? 0 : Math.min(204, Math.round(W * 0.31));
    const sx = narrow ? 0 : LW + 8;
    const annW = 22;
    const px0 = sx + stripW + annW + (narrow ? 8 : 12);
    const padL = narrow ? 8 : 44, padR = narrow ? 10 : 44;
    const ax0 = px0 + padL, ax1 = W - padR;

    // Domain from the shown, evaluated rows.
    const vs = rows.map(function (o) { return val(o.r, m); }).filter(function (v) { return v != null; });
    const pad = isFt(m) ? 0.02 : 0.5;
    const lo = Math.min.apply(null, vs) - pad, hi = Math.max.apply(null, vs) + pad;
    const X = function (v) { return ax0 + (v - lo) / (hi - lo) * (ax1 - ax0); };

    // Vertical geometry.
    const HH = 22, RH = narrow ? 36 : 24, SH = 22, GAP = 8, AXH = 24;
    let y = HH;
    const L = [];
    let lastSec = -2;
    const heads = [];
    rows.forEach(function (o) {
      if (o.sec !== lastSec) {
        if (o.sec >= 0) {
          y += o.sec === 0 ? GAP : 4;
          if (showHeads && g.secs[o.sec].t) { heads.push({ t: g.secs[o.sec].t, y: y }); y += SH; }
        }
        lastSec = o.sec;
      }
      L.push({ r: o.r, y0: y, y1: y + RH });
      y += RH;
    });
    const rowsBottom = y;
    const H = rowsBottom + AXH;

    const svg = el('svg', { class: 'fx-svg', role: 'img', tabindex: '0', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H,
      'aria-keyshortcuts': 'ArrowUp ArrowDown Home End Escape' });
    const defs = el('defs', null, svg);
    const pat = el('pattern', { id: 'fx-placement-hatch', patternUnits: 'userSpaceOnUse', width: 3.2, height: 3.2, patternTransform: 'rotate(45)' }, defs);
    el('rect', { class: 'hb', width: 3.2, height: 3.2 }, pat);
    el('line', { class: 'hl', x1: 0.6, y1: 0, x2: 0.6, y2: 3.2 }, pat);

    const band = el('rect', { class: 'band', x: 0, width: W, visibility: 'hidden' }, svg);

    // Header: layer ticks over the strip, metric over the dot plot.
    const hy = 13;
    let t = el('text', { x: sx, y: hy }, svg); t.textContent = 'layer 1';
    t = el('text', { x: sx + stripW, y: hy, 'text-anchor': 'end' }, svg); t.textContent = '30';
    t = el('text', { class: 'hd', x: narrow ? W : ax0 - (padL - 8), y: hy, 'text-anchor': narrow ? 'end' : 'start' }, svg);
    t.textContent = metricHead(m);

    // Gridlines + ticks.
    const nt = Math.max(2, Math.floor((ax1 - ax0) / (narrow ? 40 : 42)));
    const step = niceStep(hi - lo, nt), sd = stepDec(step);
    const gy0 = HH + 2, gy1 = rowsBottom;
    const grid = el('g', null, svg);
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) {
      const x = Math.round(X(v)) + 0.5;
      el('line', { class: 'gr', x1: x, x2: x, y1: gy0, y2: gy1 }, grid);
      const tl = el('text', { x: x, y: gy1 + 14, 'text-anchor': 'middle' }, grid);
      tl.textContent = v.toFixed(sd);
    }
    el('line', { class: 'ax', x1: px0, x2: W, y1: gy1 + 0.5, y2: gy1 + 0.5 }, svg);

    // Section headers.
    heads.forEach(function (hd) {
      el('line', { class: 'sepl', x1: 0, x2: W, y1: hd.y + 0.5, y2: hd.y + 0.5 }, svg);
      const s = el('text', { class: 'sec', x: 0, y: hd.y + 15 }, svg);
      s.textContent = hd.t;
    });
    if (!heads.length) {   // a thin rule still separates the baseline from the variants
      const yb = L[0].y1 + GAP / 2;
      el('line', { class: 'sepl', x1: 0, x2: W, y1: Math.round(yb) + 0.5, y2: Math.round(yb) + 0.5 }, svg);
    }

    // Baseline line.
    const bx = Math.round(X(base)) + 0.5;
    el('line', { class: 'bl', x1: bx, x2: bx, y1: gy0, y2: gy1 }, svg);

    // Rows.
    const cellsG = el('g', null, svg), marks = el('g', null, svg);
    const labs = [];
    L.forEach(function (o) {
      const r = o.r;
      const yc = narrow ? o.y0 + 25 : (o.y0 + o.y1) / 2;
      o.yc = yc;
      // label
      const ly = narrow ? o.y0 + 12 : yc;
      const lab = el('text', { class: narrow ? 'nm halo' : 'nm', x: 0, y: ly, dy: narrow ? 0 : '0.35em' }, svg);
      lab.textContent = r.name;
      labs.push(lab);
      const d = desc(r);
      if (d) { const ts = el('tspan', { class: 'ds' }, lab); ts.textContent = '  ' + d; }
      // strip
      const top = Math.round(yc - sh / 2);
      for (let l = 1; l <= NL; l++) {
        let c = 'off';
        if ((r.kind === 't2' || r.kind === 'loop') && l >= r.s && l <= r.e) c = r.kind === 't2' ? 'rec' : 'loop';
        el('rect', { class: 'cell ' + c, x: sx + (l - 1) * pitch, y: top, width: pitch - 1, height: sh }, cellsG);
      }
      if (r.kind === 'loop') {
        const a = el('text', { class: 'ann', x: sx + stripW + 5, y: yc, dy: '0.35em' }, svg);
        a.textContent = '×' + (r.K || 2);
      }
      // dot
      const v = val(r, m);
      if (v == null) {
        const ne = el('text', { class: 'ne halo', x: bx + 7, y: yc, dy: '0.35em' }, marks);   // right of the baseline rule, never across it
        ne.textContent = 'not evaluated';
        o.dx = null;
        return;
      }
      const x = X(v), cls = r.kind === 'base' ? 'eq' : cmp(v, base, m);
      if (cls !== 'eq' && Math.abs(x - bx) > 4) el('line', { class: 'stem ' + cls, x1: bx, x2: x, y1: yc, y2: yc }, marks);
      el('circle', { class: cls, cx: x.toFixed(2), cy: yc, r: 3.5 }, marks);
      o.dx = x;
      if (narrow) {
        const vt = el('text', { class: 'val', x: W, y: ly, 'text-anchor': 'end' }, svg);
        vt.textContent = fmt(v, m);
      } else {
        const left = cls === 'dn';
        const vt = el('text', { class: 'val', x: (left ? x - 8 : x + 8).toFixed(1), y: yc, dy: '0.35em', 'text-anchor': left ? 'end' : 'start' }, marks);
        vt.textContent = fmt(v, m);
      }
    });

    svg.setAttribute('aria-label', ariaText(L, m));
    wrap.textContent = '';
    wrap.appendChild(svg);
    if (!narrow) {   // labels must end before the strip; otherwise use the stacked layout
      let mx = 0;
      labs.forEach(function (t) { try { mx = Math.max(mx, t.getComputedTextLength()); } catch (e) { /* not rendered */ } });
      if (mx > LW + 2) { render(true); return; }
    }
    C = { svg: svg, rows: L, band: band, W: W };
    bind(svg);
    if (act >= L.length) act = -1;
    announce(L, m);
  }

  /* ---------- text ---------- */
  function ariaText(L, m) {
    const b = val(R.base, m);
    return 'Dot plot of ' + metricLong(m).toLowerCase() + ' for ' + GROUPS[st.g].name + ' (' + L.length + ' models): ' +
      L.map(function (o) {
        const r = o.r, v = val(r, m), d = desc(r);
        const lab = r.name + (d ? ', ' + d.replace(/ · /g, ', ') : '') + (r.kind === 't2' ? ', recurrent layers ' + r.s + ' to ' + r.e : '');
        if (v == null) return lab + ': not evaluated';
        return lab + ': ' + fmt(v, m) + (r.kind === 'base' ? '' : ' (' + delta(v, b, m) + ' vs baseline)');
      }).join('; ') + '. Focus the chart and use the up and down arrow keys to read every score of one model.';
  }
  function announce(L, m) {
    const g = GROUPS[st.g], b = val(R.base, m);
    status.textContent = '';
    status.appendChild(h('b', null, metricLong(m)));
    const parts = [];
    let n = 0, up = 0;
    const missing = [], none = [];
    g.secs.forEach(function (s) {
      let best = null, full = null;
      const miss = [];
      s.rows.forEach(function (id) {
        const r = R[id], v = val(r, m);
        if (v == null) { miss.push(r); return; }
        n++; if (cmp(v, b, m) === 'up') up++;
        if (!best || v > val(best, m)) best = r;
        if (r.full) full = r;
      });
      if (!best) { none.push(s.st); return; }
      miss.forEach(function (r) { missing.push(r); });
      const pre = g.secs.length > 1 ? s.st + ': ' : '';
      parts.push([pre + 'best ' + shortLab(best) + ' ', fmt(val(best, m), m)]);
      if (full && full !== best) parts.push(['full recurrence ' + full.name + ' ', fmt(val(full, m), m)]);
    });
    parts.push(['baseline ', fmt(b, m)]);
    status.appendChild(document.createTextNode(': '));
    parts.forEach(function (p, i) {
      if (i) status.appendChild(document.createTextNode(g.secs.length > 1 ? '; ' : ', '));
      status.appendChild(document.createTextNode(p[0]));
      status.appendChild(h('b', null, p[1]));
    });
    let tail = '. ' + up + ' of ' + n + ' evaluated variants score above the baseline.';
    if (missing.length) tail += ' ' + missing.map(function (r) { return r.name; }).join(', ') + (missing.length === 1 ? ' was' : ' were') + ' not finetuned.';
    if (none.length) tail += ' Not evaluated: ' + none.join(', ') + ' rows.';
    status.appendChild(document.createTextNode(tail));
  }

  /* ---------- tooltip ---------- */
  function fillTip(r) {
    tip.textContent = '';
    const d = desc(r);
    tip.appendChild(h('div', 't1', r.name + (d ? ' · ' + d : '')));
    tip.appendChild(h('div', 't2', how(r)));
    const tt = h('div', 'tt');
    function line(k) {
      const v = val(r, k), b = val(R.base, k), on = k === st.m ? ' on' : '';
      tt.appendChild(h('span', 'n' + on, SHORT[k]));
      tt.appendChild(h('span', 'v' + on, v == null ? '–' : fmt(v, k)));
      if (v == null || r.kind === 'base') tt.appendChild(h('span', 'd', ''));
      else tt.appendChild(h('span', 'd ' + cmp(v, b, k), delta(v, b, k)));
    }
    tt.appendChild(h('span', 'hh', r.kind === 'base' ? 'zero-shot accuracy, %' : 'zero-shot accuracy, %  (Δ vs baseline)'));
    ZK.forEach(line);
    if (r.ft) { tt.appendChild(h('span', 'hh', 'finetuned, pass@1')); FK.forEach(line); }
    else if (isFt(st.m)) tt.appendChild(h('span', 'hh', 'finetuned tasks: not evaluated'));
    tip.appendChild(tt);
  }
  function placeTip(cx, cy) {   // cx, cy in client coordinates
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
  function hideTip() { tip.classList.remove('on'); }

  /* ---------- interaction ---------- */
  function setAct(i) {
    act = i;
    if (!C) return;
    if (i < 0) { C.band.setAttribute('visibility', 'hidden'); C.band.classList.remove('on'); hideTip(); return; }
    const o = C.rows[i];
    C.band.setAttribute('y', o.y0);
    C.band.setAttribute('height', o.y1 - o.y0);
    C.band.setAttribute('visibility', 'visible');
    C.band.classList.add('on');
    fillTip(o.r);
  }
  function rowAt(y) {
    const L = C.rows;
    for (let i = 0; i < L.length; i++) if (y >= L[i].y0 && y < L[i].y1) return i;
    return -1;
  }
  function local(svg, e) {
    const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: (e.clientX - b.left) * (vb.width / (b.width || 1)), y: (e.clientY - b.top) * (vb.height / (b.height || 1)) };
  }
  function keyTip() {   // anchor the tooltip at the active row's dot (or the row's plot start)
    const o = C.rows[act], b = C.svg.getBoundingClientRect(), vb = C.svg.viewBox.baseVal, s = b.width / (vb.width || 1);
    const x = o.dx != null ? o.dx : C.W * 0.6;
    placeTip(b.left + x * s, b.top + o.yc * s);
  }
  function bind(svg) {
    function move(e) {
      if (!C) return;
      const i = rowAt(local(svg, e).y);
      if (i < 0) { if (actBy === 'ptr') { setAct(-1); actBy = null; } return; }
      if (i !== act || actBy !== 'ptr') { actBy = 'ptr'; setAct(i); }
      placeTip(e.clientX, e.clientY);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') move(e); });
    svg.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch' || actBy !== 'ptr') return;
      setAct(-1); actBy = null;
    });
    svg.addEventListener('focus', function () {
      if (actBy === 'ptr') return;
      actBy = 'key';
      setAct(act < 0 ? 0 : act);
      keyTip();
    });
    svg.addEventListener('blur', function () { if (actBy === 'key') { setAct(-1); actBy = null; } });
    svg.addEventListener('keydown', function (e) {
      const n = C.rows.length;
      let i = act < 0 ? 0 : act;
      switch (e.key) {
        case 'ArrowUp': i = Math.max(0, i - 1); break;
        case 'ArrowDown': i = Math.min(n - 1, i + 1); break;
        case 'Home': i = 0; break;
        case 'End': i = n - 1; break;
        case 'Escape': setAct(-1); actBy = null; return;
        default: return;
      }
      e.preventDefault();
      actBy = 'key';
      setAct(i);
      keyTip();
    });
  }
  // Touch: a tap outside the chart dismisses the tooltip.
  document.addEventListener('pointerdown', function (e) {
    if (act < 0 || e.pointerType === 'mouse' || !C) return;
    if (C.svg.contains(e.target)) return;
    setAct(-1); actBy = null;
  }, true);

  /* ---------- controls ---------- */
  sel.addEventListener('change', function () {
    if (sel.value === st.m) return;
    st.m = sel.value;
    act = -1; actBy = null;
    render();
  });
  function syncSeg() {
    seg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === st.g)); });
  }
  seg.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b || st.g === b.dataset.v) return;
    st.g = b.dataset.v;
    syncSeg();
    act = -1; actBy = null;
    render();
  });

  syncSeg();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (act < 0) render(); });

  let lastW = wrap.clientWidth, raf = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      const w = wrap.clientWidth;
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { act = -1; actBy = null; render(); });
    }).observe(wrap);
  }
})();
