/* Figure 4 · gate profiles vs knockouts (fx-gate).
   Overview: one row per KV head (row = layer*kv + head) in three aligned columns:
   key-gate static concentration (n_eff), gate profile map (key or value), knockout map.
   Detail: the selected head's key/value profiles and knockout bars on a shared phase axis. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-gate');
  if(!fig) return;
  const FD=window.FIGDATA||{}, G=FD.gates;
  if(!G||!G.models||!G.models.length){ console.error('fx-gate: FIGDATA.gates missing'); return; }

  const NS='http://www.w3.org/2000/svg', MINUS='−';
  const $=id=>document.getElementById(id);
  const selM=$('fx-gate-model'), mapSeg=$('fx-gate-map'), over=$('fx-gate-over'), osvg=$('fx-gate-osvg'),
        keys=$('fx-gate-keys'), note=$('fx-gate-note'), detail=$('fx-gate-detail'),
        picks=$('fx-gate-picks'), pickLab=$('fx-gate-picklab'), title=$('fx-gate-title'),
        dsvg=$('fx-gate-dsvg'), status=$('fx-gate-status');
  const smax=keys.querySelector('.fxg-smax'), gKey=keys.querySelector('.fxg-gs'), kKey=keys.querySelector('.fxg-ks');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);

  /* ---------- helpers ---------- */
  function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function txt(parent,x,y,s,cls,anchor){ const t=el('text',{x:x,y:y},parent); if(cls) t.setAttribute('class',cls); if(anchor) t.setAttribute('text-anchor',anchor); t.textContent=s; return t; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const argmax=a=>{ let k=0; for(let i=1;i<a.length;i++) if(a[i]>a[k]) k=i; return k; };
  const argmin=a=>{ let k=0; for(let i=1;i<a.length;i++) if(a[i]<a[k]) k=i; return k; };
  function neff(a){ let s=0; for(const x of a) s+=x; if(!(s>0)) return NaN; let H=0; for(const x of a) if(x>0){ const p=x/s; H-=p*Math.log(p); } return Math.exp(H); }
  const pct=(v,d)=>{ const s=Math.abs(v).toFixed(d===undefined?1:d); return (+s===0?'':v<0?MINUS:'+')+s+'%'; };
  const xx=(v,d)=>v.toFixed(d===undefined?2:d)+'×';

  /* ---------- data ---------- */
  const runName={}; ((FD.runs&&FD.runs.models)||[]).forEach(r=>{ runName[r.id]=r.name; });
  const isRef=id=>/^kvc_w8s8_1kv_baseline/.test(id);
  const models=G.models.map(m=>{
    const rows=[]; let top=0;
    for(let l=0;l<m.layers;l++) for(let h=0;h<m.kv;h++){
      const kg=m.kg[l][h], vg=m.vg[l][h], ko=m.ko[l][h];
      for(const v of kg) top=Math.max(top,v);
      for(const v of vg) top=Math.max(top,v);
      rows.push({i:rows.length,l:l,h:h,kg:kg,vg:vg,ko:ko,nk:neff(kg),nv:neff(vg),kp:argmax(kg),vp:argmax(vg),km:argmin(ko)});
    }
    return {m:m, rows:rows, name:runName[m.id]||m.name.replace(/, /g,' · '),
            gmax:Math.max(2,Math.ceil(top-1e-9)), unit:m.W===m.S?'offsets':'phases'};
  });
  const DEF='kvc_w8s8_1kv_baseline';
  const st={mi:Math.max(0,models.findIndex(e=>e.m.id===DEF)), gate:'k', sel:0, hov:-1, hr:-1, cur:-1, dr:-1};
  const E=()=>models[st.mi];
  const rowName=(e,R,long)=>e.m.kv>1?(long?'Layer '+R.l+' · head '+R.h:'L'+R.l+'·h'+R.h):(long?'Layer '+R.l:'L'+R.l);
  function pickRows(e){
    const hl=G.highlight&&G.highlight[e.m.id];
    if(hl&&hl.length) return {lab:'examples in the text', rows:hl.map(l=>l*e.m.kv)};
    const s=e.rows.filter(r=>isFinite(r.nk)).sort((a,b)=>a.nk-b.nk).slice(0,3);
    return {lab:'sharpest key gates', rows:s.map(r=>r.i)};
  }
  let PK=pickRows(E()); st.sel=PK.rows[0]||0;

  /* ---------- colour ---------- */
  // Gate cells: log scale from 1 (uniform, = --bg) to S/2 (half of all gate mass on one phase), clipped above.
  const gTop=S=>Math.max(2,S/2);
  function gateFill(g,S){
    if(!(g>1)) return 'var(--bg)';
    const p=Math.round(100*Math.min(1,Math.log2(g)/Math.log2(gTop(S))));
    return p<1?'var(--bg)':'color-mix(in oklab, var(--fx-gate) '+p+'%, var(--bg))';
  }
  function koFill(v){ const c=clamp(v,-100,100), p=Math.round(Math.abs(c)); return p<1?'var(--bg)':'color-mix(in oklab, '+(c<0?'var(--loss)':'var(--accent)')+' '+p+'%, var(--bg))'; }

  /* ---------- controls ---------- */
  (function(){
    const g1=document.createElement('optgroup'); g1.label='Seeds';
    const g2=document.createElement('optgroup'); g2.label='Other models';
    models.forEach(e=>{ const o=document.createElement('option'); o.value=e.m.id; o.textContent=e.name; (isRef(e.m.id)?g1:g2).appendChild(o); });
    if(g1.children.length) selM.appendChild(g1);
    if(g2.children.length) selM.appendChild(g2);
    selM.value=E().m.id;
  })();
  function buildPicks(){
    picks.textContent=''; pickLab.textContent=PK.lab;
    PK.rows.forEach(i=>{
      const R=E().rows[i], b=document.createElement('button');
      b.type='button'; b.textContent=rowName(E(),R,false); b.dataset.row=String(i);
      b.setAttribute('aria-label','Select '+rowName(E(),R,true));
      b.addEventListener('click',()=>{ st.cur=-1; select(i); });
      picks.appendChild(b);
    });
    updPicks();
  }
  function updPicks(){ picks.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.row===st.sel))); }

  /* ---------- overview ---------- */
  let O=null, ovG=null, underG=null, oTicks=[[],[]], baseLab=[];
  function layoutO(W){
    const m=E().m, S=m.S, kv=m.kv, narrow=W<480;
    const gL=narrow?25:30;
    const cN=narrow?Math.max(40,Math.round(W*0.14)):Math.round(clamp(W*0.19,80,124));
    const g1=narrow?10:20, g2=narrow?10:20;
    const Mw=Math.floor((W-gL-cN-g1-g2)/2);
    const rowH=kv===1?11:Math.max(2,Math.round(12/kv)), layH=kv*rowH+1;
    const top=40, rowsH=m.layers*layH-1;
    return {W:W,narrow:narrow,S:S,kv:kv,layers:m.layers,gL:gL,cN:cN,g1:g1,g2:g2,Mw:Mw,
            xN:gL,xG:gL+cN+g1,xK:gL+cN+g1+Mw+g2,rowH:rowH,layH:layH,top:top,rowsH:rowsH,cw:Mw/S,H:top+rowsH+6};
  }
  const rowY=i=>O.top+Math.floor(i/O.kv)*O.layH+(i%O.kv)*O.rowH;
  const cx0=r=>Math.round(r*O.cw);
  function rowAt(y){
    const yy=y-O.top; if(yy<-4||yy>O.rowsH+4) return -1;
    const c=clamp(yy,0,O.rowsH-1), l=clamp(Math.floor(c/O.layH),0,O.layers-1);
    const h=clamp(Math.floor((c-l*O.layH)/O.rowH),0,O.kv-1);
    return l*O.kv+h;
  }
  function phaseAt(x){
    for(const x0 of [O.xG,O.xK]) if(x>=x0-1&&x<x0+O.Mw) return clamp(Math.floor((x-x0)/O.cw),0,O.S-1);
    return -1;
  }
  function drawO(){
    const W=Math.round(over.clientWidth); if(!W) return;
    O=layoutO(W);
    const e=E(), S=O.S;
    osvg.setAttribute('viewBox','0 0 '+W+' '+O.H); osvg.setAttribute('width',W); osvg.setAttribute('height',O.H);
    osvg.textContent='';
    // column titles and ticks
    txt(osvg,O.narrow?0:O.xN,13,'eff. '+e.unit+(O.narrow?'':' (key)'),'t');
    txt(osvg,O.xG,13,st.gate==='k'?'key gate at r':'value gate at r + 1','t');
    txt(osvg,O.xK,13,'knockout at r','t');
    const ty=31, xn=v=>O.xN+(v-1)/(S-1)*O.cN;
    txt(osvg,O.xN,ty,'1',null,'start'); txt(osvg,O.xN+O.cN,ty,String(S),null,'end');
    const nStep=S<=4?1:2, gl=el('g',{'shape-rendering':'crispEdges'},osvg);
    if(!O.narrow) for(let v=2;v<S;v+=nStep){ const x=Math.round(xn(v))+0.5; el('line',{class:'gr',x1:x,x2:x,y1:O.top,y2:O.top+O.rowsH},gl); }
    if(!O.narrow&&S%2===0&&S>=8) txt(osvg,Math.round(xn(S/2))+0.5,ty,String(S/2),null,'middle');
    const need=String(S-1).length*6.4+4, step=O.cw>=need?1:(2*O.cw>=need?2:3);
    oTicks=[[],[]];
    [O.xG,O.xK].forEach((x0,j)=>{ for(let r=0;r<S;r++){ const w=cx0(r+1)-cx0(r)-1; oTicks[j][r]=r%step?null:txt(osvg,x0+cx0(r)+w/2,ty,String(r),null,'middle'); } });
    underG=el('g',{},osvg);             // row bands (hover / selection) sit under the cells
    // cells: the 1px gaps between cells show a faint tint, so the grid reads without an outer box
    const cells=el('g',{'shape-rendering':'crispEdges'},osvg);
    [O.xG,O.xK].forEach(x0=>el('rect',{class:'grid',x:x0,y:O.top,width:O.Mw-1,height:O.rowsH},cells));
    for(const R of e.rows){
      const y=rowY(R.i), h=O.rowH, gv=st.gate==='k'?R.kg:R.vg;
      for(let r=0;r<S;r++){
        const x=cx0(r), w=cx0(r+1)-x-1;
        el('rect',{x:O.xG+x,y:y,width:w,height:h},cells).style.fill=gateFill(gv[r],S);
        el('rect',{x:O.xK+x,y:y,width:w,height:h},cells).style.fill=koFill(R.ko[r]);
      }
      if(isFinite(R.nk)){
        const bw=clamp((S-R.nk)/(S-1),0,1)*O.cN;
        if(bw>=0.5) el('rect',{class:'nbar',x:O.xN+O.cN-bw,y:y,width:bw,height:h},cells);
      }
    }
    el('line',{class:'ax',x1:O.xN+O.cN+0.5,x2:O.xN+O.cN+0.5,y1:O.top-3,y2:O.top+O.rowsH+3},osvg);
    baseLab=[];
    for(let l=0;l<O.layers;l+=5){ const yc=O.top+l*O.layH+(O.layH-1)/2; baseLab.push({yc:yc,t:txt(osvg,O.gL-8,yc+3.6,'L'+l,null,'end')}); }
    ovG=el('g',{},osvg);
    drawOv(); syncKeys(); ariaO();
  }
  function activeCell(){
    if(st.hov>=0&&st.hr>=0) return [st.hov,st.hr];
    if(st.dr>=0) return [st.sel,st.dr];
    if(st.cur>=0) return [st.sel,st.cur];
    return null;
  }
  function drawOv(){
    if(!ovG||!O) return;
    ovG.textContent=''; underG.textContent='';
    const e=E();
    const mark=(i,kind)=>{
      const y=rowY(i), pad=O.kv>1?1:0;
      el('rect',{class:'band-'+kind,x:0,y:y-pad,width:O.W,height:O.rowH+2*pad},underG);
      [O.xG,O.xK].forEach(x0=>el('rect',{class:'row-'+kind,x:x0-0.5,y:y-0.5,width:O.Mw,height:O.rowH+1},ovG));
    };
    const labs=[];
    const lab=(i)=>{ const R=e.rows[i], yc=rowY(i)+O.rowH/2; labs.push(yc); txt(ovG,O.gL-8,yc+3.6,'L'+R.l,'on','end'); };
    const hv=st.hov>=0&&st.hov!==st.sel;
    if(hv) mark(st.hov,'hov');
    mark(st.sel,'sel');
    lab(st.sel);
    if(hv){ const yh=rowY(st.hov)+O.rowH/2, ys=rowY(st.sel)+O.rowH/2; if(Math.abs(yh-ys)>=12) lab(st.hov); }
    baseLab.forEach(b=>b.t.classList.toggle('off',labs.some(y=>Math.abs(y-b.yc)<14)));
    const ac=activeCell();
    oTicks.forEach(a=>a.forEach((t,r)=>{ if(t) t.classList.toggle('on',!!ac&&ac[1]===r); }));
    if(ac){
      const y=rowY(ac[0]), x=cx0(ac[1]), w=cx0(ac[1]+1)-x-1;
      [O.xG,O.xK].forEach(x0=>el('rect',{class:'cell-cur',x:x0+x-1,y:y-1,width:w+2,height:O.rowH+2},ovG));
    }
  }
  function ariaO(){
    if(!O) return;
    const e=E(); let lo=null, hi=null;
    e.rows.forEach(R=>{ if(!isFinite(R.nk)) return; if(!lo||R.nk<lo.nk) lo=R; if(!hi||R.nk>hi.nk) hi=R; });
    osvg.setAttribute('aria-label',e.name+': '+e.rows.length+' KV heads, layer 0 at the top, by '+O.S+' phases. Left, effective '+e.unit+' of each key gate, from '+
      (lo?lo.nk.toFixed(2)+' ('+rowName(e,lo,true)+')':'n/a')+' to '+(hi?hi.nk.toFixed(2):'n/a')+' of '+O.S+'. Middle, '+(st.gate==='k'?'key':'value')+
      ' gate: mean score by phase. Right, knockout effect by phase. Selected: '+rowName(e,e.rows[st.sel],true)+'.');
  }
  function syncKeys(){
    if(!O) return;
    const gt=gTop(O.S), over1=E().rows.some(R=>(st.gate==='k'?R.kg:R.vg).some(v=>v>gt+1e-9));
    smax.textContent=(over1?'≥':'')+gt+'×';
    if(O.narrow){
      keys.style.gridTemplateColumns='minmax(0,1fr)';
      gKey.style.gridColumn='1'; kKey.style.gridColumn='1';
    } else {
      keys.style.gridTemplateColumns=O.xG+'px '+O.Mw+'px '+O.g2+'px '+O.Mw+'px';
      gKey.style.gridColumn='2'; kKey.style.gridColumn='4';
    }
  }
  function oPoint(ev){ if(!O) return null; const b=osvg.getBoundingClientRect(); if(!b.width) return null; const s=O.W/b.width; return {x:(ev.clientX-b.left)*s, y:(ev.clientY-b.top)*s}; }
  const tRow=(k,v)=>'<span class="k">'+k+'</span><span>'+v+'</span>';
  function oTip(i,r){
    const e=E(), R=e.rows[i], S=O.S, gv=st.gate==='k'?R.kg:R.vg;
    let s='<b>'+rowName(e,R,true)+'</b><div class="fxg-tt">';
    s+=tRow('eff. '+e.unit,R.nk.toFixed(2)+' <span class="k">of '+S+'</span>');
    s+=tRow('key peak','r = '+R.kp+' <span class="k">·</span> '+xx(R.kg[R.kp]));
    s+=tRow('knockout at peak',pct(R.ko[R.kp]));
    if(r>=0&&r!==R.kp) s+=tRow('at r = '+r,(st.gate==='k'?'key ':'value ')+xx(gv[r])+' <span class="k">·</span> '+pct(R.ko[r]));
    return s+'</div>';
  }
  function onOMove(ev){
    const p=oPoint(ev); if(!p) return;
    const i=rowAt(p.y);
    if(i<0){ if(st.hov!==-1||st.hr!==-1){ st.hov=-1; st.hr=-1; drawOv(); drawDOv(); } hideTip(); return; }
    const r=phaseAt(p.x);
    if(i!==st.hov||r!==st.hr){ st.hov=i; st.hr=r; drawOv(); drawDOv(); }
    showTip(ev,oTip(i,r));
  }
  osvg.addEventListener('pointermove',onOMove);
  osvg.addEventListener('pointerdown',onOMove);
  osvg.addEventListener('pointerleave',()=>{ st.hov=-1; st.hr=-1; hideTip(); drawOv(); drawDOv(); });
  osvg.addEventListener('click',ev=>{ const p=oPoint(ev); if(!p) return; const i=rowAt(p.y); if(i>=0&&i!==st.sel){ st.cur=-1; select(i); } });
  over.addEventListener('keydown',ev=>{
    const e=E(), n=e.rows.length, kv=e.m.kv, S=e.m.S;
    let i=st.sel, c=st.cur;
    switch(ev.key){
      case 'ArrowUp': i=Math.max(0,i-1); break;
      case 'ArrowDown': i=Math.min(n-1,i+1); break;
      case 'PageUp': i=Math.max(0,i-(kv>1?kv:5)); break;
      case 'PageDown': i=Math.min(n-1,i+(kv>1?kv:5)); break;
      case 'Home': i=0; break;
      case 'End': i=n-1; break;
      case 'ArrowLeft': c=c<0?e.rows[i].kp:(c+S-1)%S; break;
      case 'ArrowRight': c=c<0?e.rows[i].kp:(c+1)%S; break;
      case 'Escape': if(c<0) return; c=-1; break;
      default: return;
    }
    ev.preventDefault();
    st.cur=c;
    if(i!==st.sel) select(i); else { drawOv(); drawDOv(); updStatus(); }
  });

  /* ---------- detail ---------- */
  let D=null, dOv=null, dTicks=[];
  function drawD(){
    const W=Math.round(detail.clientWidth); if(!W) return;
    const e=E(), S=e.m.S, R=e.rows[st.sel], narrow=W<480;
    const mL=narrow?36:44, mR=narrow?4:10, pw=W-mL-mR, bw=pw/S;
    const t1=24, h1=narrow?104:122, t2=t1+h1+44, h2=narrow?92:104, xl=t2+h2+18, H=xl+5;
    const gm=e.gmax, y1=v=>t1+h1*(1-clamp(v,0,gm)/gm);
    const top=clamp(Math.ceil(Math.max(20,Math.max.apply(null,R.ko))/10)*10,20,100);
    const y2=v=>t2+h2*(top-clamp(v,-100,top))/(top+100);
    const xc=r=>mL+(r+0.5)*bw;
    D={W:W,mL:mL,pw:pw,bw:bw,t1:t1,h1:h1,t2:t2,h2:h2,S:S};
    dsvg.setAttribute('viewBox','0 0 '+W+' '+H); dsvg.setAttribute('width',W); dsvg.setAttribute('height',H);
    dsvg.textContent='';
    // soft band at the key gate's peak phase, through both panels
    el('rect',{class:'peak',x:mL+R.kp*bw,y:t1-8,width:bw,height:t2+h2-t1+8},dsvg);
    // panel 1: gate profile
    txt(dsvg,0,12,'mean gate score','t');
    txt(dsvg,mL+pw,12,'relative to a uniform share',null,'end');
    const s1=gm<=5?1:2, g=el('g',{'shape-rendering':'crispEdges'},dsvg);
    for(let v=0;v<=gm;v+=s1){
      const y=Math.round(y1(v))+0.5;
      if(v===0) el('line',{class:'ax',x1:mL,x2:mL+pw,y1:y,y2:y},g); else if(v!==1) el('line',{class:'gr',x1:mL,x2:mL+pw,y1:y,y2:y},g);
      txt(dsvg,mL-8,y+3.6,String(v),null,'end');
    }
    if(s1!==1) txt(dsvg,mL-8,Math.round(y1(1))+4.1,'1',null,'end');
    const yu=Math.round(y1(1))+0.5;
    el('line',{class:'uref',x1:mL,x2:mL+pw,y1:yu,y2:yu},dsvg);
    const pts=a=>a.map((v,r)=>xc(r).toFixed(1)+','+y1(v).toFixed(1)).join(' ');
    el('polyline',{class:'vline',points:pts(R.vg)},dsvg);
    el('polyline',{class:'kline',points:pts(R.kg)},dsvg);
    R.vg.forEach((v,r)=>el('circle',{class:'vdot',cx:xc(r).toFixed(1),cy:y1(v).toFixed(1),r:4.5},dsvg));
    R.kg.forEach((v,r)=>el('circle',{class:'kdot',cx:xc(r).toFixed(1),cy:y1(v).toFixed(1),r:3.25},dsvg));
    // panel 2: knockout
    txt(dsvg,0,t2-14,'knockout','t');
    txt(dsvg,mL+pw,t2-14,'relative accuracy change',null,'end');
    const g2=el('g',{'shape-rendering':'crispEdges'},dsvg);
    [top,-50,-100].forEach(v=>{ const y=Math.round(y2(v))+0.5; el('line',{class:'gr',x1:mL,x2:mL+pw,y1:y,y2:y},g2); txt(dsvg,mL-8,y+3.6,(v>0?'+':v<0?MINUS:'')+Math.abs(v)+'%',null,'end'); });
    const bwB=Math.min(24,Math.max(5,Math.round(bw*0.46)));
    const yz=Math.round(y2(0));
    R.ko.forEach((v,r)=>{
      const y=Math.round(y2(v)), h=Math.abs(y-yz); if(h<1) return;
      el('rect',{class:v<0?'bar-l':'bar-g',x:Math.round(xc(r)-bwB/2),y:Math.min(y,yz),width:bwB,height:h},g2);
    });
    el('line',{class:'ax',x1:mL,x2:mL+pw,y1:yz+0.5,y2:yz+0.5},g2);
    txt(dsvg,mL-8,yz+4.1,'0',null,'end');
    // shared phase axis
    dTicks=[];
    for(let r=0;r<S;r++) dTicks[r]=txt(dsvg,xc(r),xl,String(r),null,'middle');
    txt(dsvg,mL-8,xl,'r',null,'end');
    dOv=el('g',{},dsvg);
    el('rect',{class:'hit',x:mL,y:0,width:pw,height:H},dsvg);
    drawDOv();
    // title + aria
    title.textContent=titleText(e,R);
    dsvg.setAttribute('aria-label',rowName(e,R,true)+'. Key gate by phase r = 0 to '+(S-1)+', relative to uniform: '+R.kg.map(v=>v.toFixed(2)).join(', ')+
      '. Value gate at r + 1: '+R.vg.map(v=>v.toFixed(2)).join(', ')+'. Knockout, relative accuracy change in percent: '+R.ko.map(v=>(v<0?MINUS:'')+Math.abs(v).toFixed(1)).join(', ')+'.');
  }
  function detailPhase(){
    if(st.dr>=0) return st.dr;
    if(st.hov===st.sel&&st.hr>=0) return st.hr;
    if(st.hov<0&&st.cur>=0) return st.cur;
    return -1;
  }
  function drawDOv(){
    if(!dOv||!D) return;
    dOv.textContent='';
    const r=detailPhase();
    dTicks.forEach((t,k)=>t.classList.toggle('on',k===r));
    if(r<0) return;
    const x=Math.round(D.mL+(r+0.5)*D.bw)+0.5;
    el('line',{class:'hair',x1:x,x2:x,y1:D.t1-8,y2:D.t2+D.h2},dOv);
  }
  function dTip(r){
    const e=E(), R=e.rows[st.sel], S=e.m.S;
    return '<b>'+rowName(e,R,true)+' · r = '+r+'</b><div class="fxg-tt">'+tRow('key gate',xx(R.kg[r]))+
      tRow('value gate',xx(R.vg[r])+' <span class="k">(phase '+((r+1)%S)+')</span>')+tRow('knockout',pct(R.ko[r]))+'</div>';
  }
  function onDMove(ev){
    if(!D) return;
    const b=dsvg.getBoundingClientRect(); if(!b.width) return;
    const x=(ev.clientX-b.left)*D.W/b.width;
    if(x<D.mL||x>D.mL+D.pw){ if(st.dr!==-1){ st.dr=-1; drawDOv(); drawOv(); } hideTip(); return; }
    const r=clamp(Math.floor((x-D.mL)/D.bw),0,D.S-1);
    if(r!==st.dr){ st.dr=r; drawDOv(); drawOv(); }
    showTip(ev,dTip(r));
  }
  dsvg.addEventListener('pointermove',onDMove);
  dsvg.addEventListener('pointerdown',onDMove);
  dsvg.addEventListener('pointerleave',()=>{ st.dr=-1; hideTip(); drawDOv(); drawOv(); });

  /* ---------- text ---------- */
  function koPhrase(R,S){
    const big=R.ko.filter(v=>v<=-20);
    if(big.length===S) return 'knockout '+pct(Math.max.apply(null,big))+' to '+pct(Math.min.apply(null,big))+' at every phase';
    const v=R.ko[R.km];
    if(v<=-1.5) return 'knockout '+pct(v)+' at r = '+R.km;
    const k=argmax(R.ko);
    if(R.ko[k]>=1.5) return 'knockout '+pct(R.ko[k])+' at r = '+k;
    return 'knockout under 2% at every phase';
  }
  function titleText(e,R){
    const pk=R.kg[R.kp];
    const g=pk<1.25?'key gate near uniform (max '+pk.toFixed(1)+'×)':'key gate peaks at r = '+R.kp+' ('+pk.toFixed(1)+'× uniform)';
    return rowName(e,R,true)+' · '+g+' · '+koPhrase(R,e.m.S);
  }
  function koList(R,S){
    const idx=[]; R.ko.forEach((v,r)=>{ if(v<=-20) idx.push(r); });
    let out;
    if(!idx.length){ const v=R.ko[R.km]; out=v<=-1.5?'largest knockout loss '+pct(v)+' at r = '+R.km:'no knockout loss above 2%'; }
    else if(idx.length>3){ const vs=idx.map(r=>R.ko[r]); out='knockout '+pct(Math.max.apply(null,vs))+' to '+pct(Math.min.apply(null,vs))+' at '+idx.length+' of '+S+' phases'; }
    else out='knockout '+idx.map(r=>pct(R.ko[r])+' at r = '+r).join(', ');
    const k=argmax(R.ko);
    if(R.ko[k]>=5) out+='; largest gain '+pct(R.ko[k])+' at r = '+k;
    return out;
  }
  function updStatus(){
    const e=E(), R=e.rows[st.sel], S=e.m.S;
    let s='<b>'+rowName(e,R,true)+'</b> · key gate: '+R.nk.toFixed(2)+' of '+S+' effective '+e.unit+' (value gate '+R.nv.toFixed(2)+') · key peak r = '+R.kp+
      ' ('+xx(R.kg[R.kp])+') · value peak r = '+R.vp+' ('+xx(R.vg[R.vp])+', value token at phase '+((R.vp+1)%S)+') · '+koList(R,S)+'.';
    if(st.cur>=0){ const r=st.cur; s+=' At r = '+r+': key '+xx(R.kg[r])+', value '+xx(R.vg[r])+', knockout '+pct(R.ko[r])+'.'; }
    status.innerHTML=s;
  }
  const coarse=!!(window.matchMedia&&matchMedia('(hover: none) and (pointer: coarse)').matches);
  function updNote(){
    const m=E().m, parts=[];
    if(m.W!==m.S) parts.push('W'+m.W+'/S'+m.S+': each phase pools '+(m.W/m.S)+' offsets');
    if(m.tied) parts.push('tied key and value gates: the value map is the key map shifted by one phase');
    parts.push(coarse?'tap a row to select a head':'click a row, or focus the map and use ↑ ↓ (head) and ← → (phase)');
    note.textContent=parts.join(' · ');
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

  /* ---------- state changes ---------- */
  function select(i){ st.sel=i; drawOv(); drawD(); updPicks(); updStatus(); ariaO(); }
  selM.addEventListener('change',()=>{
    const k=models.findIndex(e=>e.m.id===selM.value); if(k<0) return;
    st.mi=k; st.cur=-1; st.hov=-1; st.hr=-1; st.dr=-1;
    PK=pickRows(E()); st.sel=PK.rows[0]||0;
    buildPicks(); updNote(); drawO(); drawD(); updStatus();
  });
  mapSeg.addEventListener('click',ev=>{
    const b=ev.target.closest('button[data-gate]'); if(!b||b.dataset.gate===st.gate) return;
    st.gate=b.dataset.gate;
    mapSeg.querySelectorAll('button[data-gate]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    drawO();
  });

  let lastW=0;
  function renderAll(){ lastW=Math.round(fig.clientWidth); drawO(); drawD(); }
  buildPicks(); updNote(); renderAll(); updStatus();
  if(window.ResizeObserver){
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW) renderAll(); }).observe(fig);
  }
})();
