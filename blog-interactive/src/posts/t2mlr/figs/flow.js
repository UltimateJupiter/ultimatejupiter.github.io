/* Figure 1 · data flow and serial depth (fx-flow).
   An exact computation on the dataflow graph of Eqs 2.1–2.2 (L = 30, SmolLM2-135M).
   Serial depth d(t, l) = number of layer applications on the longest dependency path into h_t^(l):
     Transformer            d(t, l) = l
     T²MLR(ls, le)          d(1, l) = l;  for t ≥ 2: d(t, l) = l (l < ls),  l + (t−1)·D (l ≥ ls),  D = le − ls + 1
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
  const GROUPS=[['Transformer',['tr']],['T²MLR',['1-30','5-26','9-22','13-18','15-16','custom']],['Looped (Table 2)',['loop2','mloop3']]];
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
  const t2depth=(t,D)=>L+(t-1)*D;                                                    // T²MLR output depth
  function cellDepths(t,l){
    const k=kind();
    if(k==='tr') return [l];
    const b=blk(), D=Dsz();
    if(k==='t2') return [(t===1||l<b[0])?l:l+(t-1)*D];
    if(l<b[0]) return [l];
    if(l>b[1]) return [l+(K()-1)*D];
    const a=[]; for(let q=0;q<K();q++) a.push(l+q*D); return a;
  }
  function name(){ const k=kind(); return k==='t2'?'T²MLR('+st.ls+','+st.le+')':k==='loop'?C().name:'Transformer'; }
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
    // recurrence arrows (T²MLR) or loop returns (looped)
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
    const ctx={v:t=>t2depth(t,6),cls:'s-ctx',label:'T²MLR(13,18)',lb:'lb-tr',dot:'d-tr',key:'T²MLR(13,18)'};
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
