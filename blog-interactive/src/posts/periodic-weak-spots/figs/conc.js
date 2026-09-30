/* Figure 4 · two ways a gate can concentrate (fx-conc).
   A square plane with one point per KV head's key gate at the final checkpoint: the static effective number of
   offsets exp(H(E[α])) (x) against the per-window effective number E[exp(H(α))] (y), both from 1 (one offset) to W
   (uniform); colour = layer depth. For the reference run (W8/S8 · 1 KV · seed 42) the pretraining paths of three key
   gates are drawn, with a replay that moves a marker along each path by arc length. */
(function(){
  'use strict';
  const fig=document.getElementById('fx-conc');
  if(!fig) return;
  const FD=window.FIGDATA||{}, C=FD.conc;
  if(!C||!C.models||!C.models.length){ console.error('fx-conc: FIGDATA.conc missing'); return; }

  const NS='http://www.w3.org/2000/svg', DUR=2500, RT2=Math.SQRT2;
  const $=id=>document.getElementById(id);
  const sel=$('fx-conc-model'), bPaths=$('fx-conc-paths'), bReplay=$('fx-conc-replay'), main=$('fx-conc-main'),
        plot=$('fx-conc-plot'), svg=$('fx-conc-svg'), key=$('fx-conc-key'), track=$('fx-conc-track'),
        hint=$('fx-conc-hint'), status=$('fx-conc-status');
  const tip=document.createElement('div'); tip.className='fx-tip'; tip.setAttribute('aria-hidden','true'); fig.appendChild(tip);
  const mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):null;
  const reduced=()=>!!(mq&&mq.matches);
  const coarse=!!(window.matchMedia&&matchMedia('(hover: none) and (pointer: coarse)').matches);

  /* ---------- helpers ---------- */
  function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function txt(parent,x,y,s,cls,anchor){ const t=el('text',{x:x,y:y},parent); if(cls) t.setAttribute('class',cls); if(anchor) t.setAttribute('text-anchor',anchor); t.textContent=s; return t; }
  function span(parent,s,attrs){ const t=el('tspan',attrs||{},parent); t.textContent=s; return t; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f2=v=>(Math.round(v*100+(v<0?-1e-6:1e-6))/100).toFixed(2);   // half-up on the printed decimals (3.335 → 3.34)
  const nice=v=>String(+(+v).toFixed(2));
  const fx=v=>(+v).toFixed(1);
  const ease=p=>p<.5?4*p*p*p:1-Math.pow(2-2*p,3)/2;
  function measure(t,cw){
    try{ const b=t.getBBox(); if(b&&b.width>0) return {x:b.x,y:b.y,w:b.width,h:b.height}; }catch(e){ /* not rendered yet */ }
    return {x:0,y:-10,w:(t.textContent||'').length*(cw||6.3),h:13};
  }
  /* axis-aligned obstacle boxes [x0,y0,x1,y1] for label placement */
  function Obs(){ this.b=[]; }
  Obs.prototype.add=function(x0,y0,x1,y1){ this.b.push([x0,y0,x1,y1]); };
  Obs.prototype.hits=function(x0,y0,x1,y1,pad){ let n=0; for(const o of this.b) if(x0-pad<o[2]&&x1+pad>o[0]&&y0-pad<o[3]&&y1+pad>o[1]) n++; return n; };
  function polyDist(px,x,y){
    let best=Infinity;
    for(let j=0;j<px.length-1;j++){
      const a=px[j], b=px[j+1], dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy;
      const t=L?clamp(((x-a[0])*dx+(y-a[1])*dy)/L,0,1):0, d=Math.hypot(a[0]+t*dx-x,a[1]+t*dy-y);
      if(d<best) best=d;
    }
    return best;
  }

  /* ---------- data ---------- */
  const byId={}; C.models.forEach(m=>{ byId[m.id]=m; });
  const T=(C.traj&&C.traj.heads&&C.traj.heads.length&&byId[C.traj.run])?C.traj:null;
  const FROM=(T&&T.from)||'step 1', TO=(T&&T.to)||'step 47,518';
  const DEF=byId[C.default]?C.default:C.models[0].id;
  const st={id:DEF, paths:true, hov:null, anim:null};
  const M=()=>byId[st.id];
  const hasT=()=>!!T&&st.id===T.run;
  const showT=()=>hasT()&&st.paths;
  const nearTh=W=>W*15/16;                // "near uniform on average": static above 15/16 of W (7.5 of 8)
  const lname=(m,i)=>'L'+Math.floor(i/m.kv)+(m.kv>1?'·h'+(i%m.kv):'');
  const TP=T?T.heads.map(h=>{
    const P=h.path.map(q=>[+q[0],+q[1]]), n=P.length;
    // The replay marker glides along a lightly smoothed copy: checkpoint jitter doubles back on itself. Only nearby
    // vertices (±4, within 0.2 offsets) are averaged, so the sparse fast stretches and both endpoints stay exact.
    const Sm=P.map((p,i)=>{
      if(i===0||i===n-1) return p.slice();
      const k=Math.min(4,i,n-1-i); let sx=0, sy=0, c=0;
      for(let j=i-k;j<=i+k;j++){ const q=P[j]; if(Math.hypot(q[0]-p[0],q[1]-p[1])<=0.2){ sx+=q[0]; sy+=q[1]; c++; } }
      return [sx/c,sy/c];
    });
    return {layer:h.layer, P:P, Sm:Sm, start:h.start||P[0], end:h.end||P[n-1]};
  }):[];

  /* Layer colour: sequential ramp through three tokens, as inline style so a theme switch needs no redraw. */
  function layerFill(l,n){
    const t=n>1?l/(n-1):0;
    if(t<=.5){ const p=Math.round(t*200); return p<=0?'var(--fx-conc-d0)':'color-mix(in oklab, var(--fx-conc-d1) '+p+'%, var(--fx-conc-d0))'; }
    const p=Math.round((t-.5)*200); return p>=100?'var(--fx-conc-d2)':'color-mix(in oklab, var(--fx-conc-d2) '+p+'%, var(--fx-conc-d1))';
  }

  /* ---------- controls ---------- */
  (function(){
    const used={};
    (C.groups||[]).forEach(g=>{
      const og=document.createElement('optgroup'); og.label=g.title;
      (g.ids||[]).forEach(id=>{ const m=byId[id]; if(!m||used[id]) return; used[id]=1;
        const o=document.createElement('option'); o.value=id; o.textContent=m.name; og.appendChild(o); });
      if(og.children.length) sel.appendChild(og);
    });
    C.models.forEach(m=>{ if(used[m.id]) return; const o=document.createElement('option'); o.value=m.id; o.textContent=m.name; sel.appendChild(o); });
    sel.value=st.id;
  })();
  (function(){
    const na=key.querySelector('.fxc-na'); if(!na||!T) return;
    const ends=key.querySelectorAll('.fxc-ends span'); if(ends.length===2){ ends[0].textContent=FROM; ends[1].textContent=TO; }
    na.textContent='recorded for ';
    const nw=document.createElement('span'); nw.className='nw'; nw.textContent=byId[T.run].name; na.appendChild(nw);
  })();
  function syncCtl(){
    const ok=hasT();
    bPaths.disabled=!ok; bReplay.disabled=!ok;
    bPaths.setAttribute('aria-pressed',String(ok&&st.paths));
    bReplay.classList.toggle('on',!!st.anim);
    key.classList.toggle('na',!ok);
    key.classList.toggle('off',ok&&!st.paths);
    key.classList.toggle('playing',!!st.anim);
    const what=showT()?'a point or a path':'a point';
    hint.textContent=(coarse?'tap ':'hover over ')+what+' for its values';
  }

  /* ---------- geometry ---------- */
  let G=null, PTS=[], TR=[];
  function geom(){
    const m=M(), W=m.W, cw=Math.round(fig.clientWidth)||640, wide=cw>=560;
    main.classList.toggle('wide',wide);
    const pw=Math.max(220,Math.round(plot.clientWidth)||cw);
    const pad=8, mL=30, mR=wide?16:10, mT=30, mB=44;
    const S=Math.floor(clamp(pw-mL-mR-2*pad,150,420));
    const x0=mL+pad, y0=mT+pad+S, u=S/(W-1);
    return {m:m, W:W, wide:wide, pw:pw, pad:pad, S:S, u:u, H:y0+pad+mB, r:m.kv===1?2.9:2,
            X:v=>x0+(v-1)*u, Y:v=>y0-(v-1)*u,
            xL:x0-pad, xR:x0+S+pad, yT:y0-S-pad, yB:y0+pad};
  }

  /* ---------- render ---------- */
  function render(){
    const g=G=geom(), m=g.m, W=g.W, X=g.X, Y=g.Y, kv=m.kv, rr=g.r;
    svg.setAttribute('viewBox','0 0 '+g.pw+' '+g.H); svg.setAttribute('width',g.pw); svg.setAttribute('height',g.H);
    svg.textContent='';
    const Lb=el('g',{},svg), Lp=el('g',{},svg), Lt=el('g',{},svg), La=el('g',{},svg);
    g.Lo=el('g',{},svg);
    // label placement: hard obstacles (points, markers, text) must stay clear; soft ones (lines) may be crossed by a
    // haloed label when nothing better exists
    const hard=new Obs(), soft=new Obs(), tx=new Obs();   // marks, lines, text
    const inPlot=b=>b[0]>=g.xL&&b[1]>=g.yT&&b[2]<=g.xR&&b[3]<=g.yB;

    // right-edge band: uniform on average (static above 15/16 of W, the threshold counted in the status)
    const xb=X(nearTh(W));
    el('rect',{class:'band',x:fx(xb),y:g.yT,width:fx(g.xR-xb),height:g.yB-g.yT},Lb);
    // integer grid, axes, diagonal y = x
    const gr=el('g',{'shape-rendering':'crispEdges'},Lb);
    for(let v=1;v<=W;v++){
      const x=Math.round(X(v))+.5, y=Math.round(Y(v))+.5;
      el('line',{class:'gr',x1:x,x2:x,y1:g.yT,y2:g.yB},gr);
      el('line',{class:'gr',x1:g.xL,x2:g.xR,y1:y,y2:y},gr);
    }
    el('line',{class:'ax',x1:g.xL,x2:g.xR,y1:Math.round(g.yB)+.5,y2:Math.round(g.yB)+.5},gr);
    el('line',{class:'ax',x1:Math.round(g.xL)+.5,x2:Math.round(g.xL)+.5,y1:g.yT,y2:g.yB},gr);
    el('line',{class:'diag',x1:fx(X(1)),y1:fx(Y(1)),x2:fx(X(W)),y2:fx(Y(W))},Lb);
    for(let s=0;s<=g.S;s+=4){ const x=X(1)+s, y=Y(1)-s; soft.add(x-1.5,y-1.5,x+1.5,y+1.5); }
    const step=g.u>=24?1:2;
    for(let v=1;v<=W;v++){
      if(v!==1&&v%step) continue;
      txt(Lb,fx(X(v)),fx(g.yB+15),String(v),null,'middle');
      txt(Lb,fx(g.xL-7),fx(Y(v)+3.6),String(v),null,'end');
    }
    // axis titles: name (sans) + formula (mono)
    const yt=el('text',{x:0,y:14},La); span(yt,'per window',{class:'tn'}); span(yt,'E[exp(H(α))]',{dx:7});
    const xt=el('text',{x:fx(g.xR),y:fx(g.yB+36),'text-anchor':'end'},La); span(xt,'static',{class:'tn'}); span(xt,'exp(H(E[α]))',{dx:7});
    [yt,xt].forEach(t=>{ const b=measure(t); tx.add(b.x,b.y,b.x+b.w,b.y+b.h); });

    // key gates, deeper layers drawn last
    PTS=[];
    m.pts.forEach((q,i)=>{
      const l=Math.floor(i/kv), x=X(q[0]), y=Y(q[1]);
      const c=el('circle',{class:'pt'+(kv>1?' sm':''),cx:fx(x),cy:fx(y),r:rr,'data-i':i},Lp);
      c.style.fill=layerFill(l,m.layers);
      PTS.push({i:i,l:l,h:i%kv,x:x,y:y,c:c});
      hard.add(x-rr-1,y-rr-1,x+rr+1,y+rr+1);
    });

    // training paths (reference run only)
    TR=[];
    if(showT()){
      TP.forEach((tp,k)=>{
        const px=tp.P.map(q=>[X(q[0]),Y(q[1])]), sp=tp.Sm.map(q=>[X(q[0]),Y(q[1])]);
        const cs=[0]; for(let j=1;j<sp.length;j++) cs.push(cs[j-1]+Math.hypot(sp[j][0]-sp[j-1][0],sp[j][1]-sp[j-1][1]));
        const segs=px.map((p,j)=>(j?'L':'M')+fx(p[0])+' '+fx(p[1])), d=segs.join('');
        const grp=el('g',{class:'trp','data-k':k},Lt);
        el('path',{class:'tr-ghost',d:d},grp);
        const tr=el('path',{class:'tr',d:d},grp);
        const s0=px[0], e0=[X(tp.end[0]),Y(tp.end[1])];
        el('circle',{class:'tr-start',cx:fx(s0[0]),cy:fx(s0[1]),r:3.3},grp);
        el('circle',{class:'tr-end',cx:fx(e0[0]),cy:fx(e0[1]),r:3.4},grp);
        const mk=el('circle',{class:'tr-mk',cx:fx(s0[0]),cy:fx(s0[1]),r:3.4},grp);
        [s0,e0].forEach(p=>hard.add(p[0]-4.5,p[1]-4.5,p[0]+4.5,p[1]+4.5));
        for(let j=0;j<px.length-1;j++){
          const a=px[j], b=px[j+1], n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4));
          for(let q=0;q<n;q++){ const x=a[0]+(b[0]-a[0])*q/n, y=a[1]+(b[1]-a[1])*q/n; soft.add(x-1.5,y-1.5,x+1.5,y+1.5); }
        }
        TR.push({k:k, layer:tp.layer, g:grp, tr:tr, mk:mk, px:px, sp:sp, cs:cs, len:cs[cs.length-1], segs:segs, e:e0, lab:null});
      });
      // one arrowhead per path, on a long early stretch, kept apart from the others
      const heads=[];
      TR.forEach(tr=>{
        const px=tr.px, half=Math.max(2,px.length>>1), cand=[];
        for(let j=0;j<half&&j<px.length-1;j++){ const l=Math.hypot(px[j+1][0]-px[j][0],px[j+1][1]-px[j][1]); if(l>=16) cand.push([l,j]); }
        cand.sort((a,b)=>b[0]-a[0]);
        let pos=null;
        search: for(const c of cand.slice(0,4)) for(const f of [.5,.62,.38,.72,.28]){
          const a=px[c[1]], b=px[c[1]+1], x=a[0]+(b[0]-a[0])*f, y=a[1]+(b[1]-a[1])*f;
          if(heads.some(h=>Math.hypot(h[0]-x,h[1]-y)<24)||hard.hits(x-3.5,y-3.5,x+3.5,y+3.5,0)) continue;
          pos=[x,y,(b[0]-a[0])/c[0],(b[1]-a[1])/c[0]]; break search;
        }
        if(!pos) return;
        const x=pos[0], y=pos[1], ux=pos[2], uy=pos[3], ah=6.2, aw=3.2;
        el('path',{class:'tr-arrow',d:'M'+fx(x+ux*ah/2)+' '+fx(y+uy*ah/2)+'L'+fx(x-ux*ah/2-uy*aw)+' '+fx(y-uy*ah/2+ux*aw)+
          'L'+fx(x-ux*ah/2+uy*aw)+' '+fx(y-uy*ah/2-ux*aw)+'Z'},tr.g);
        heads.push([x,y]); hard.add(x-4.5,y-4.5,x+4.5,y+4.5);
      });
      // direct labels beside the end markers; first choice is the empty side of the diagonal (upper left)
      TR.forEach(tr=>{
        const t=txt(La,0,0,'L'+tr.layer,'tr-lab'); t.setAttribute('data-k',tr.k); tr.lab=t;
        const b=measure(t), w=b.w, h=b.h, ex=tr.e[0], ey=tr.e[1], cands=[];
        for(const gp of [4,10]) cands.push([ex-gp-w,ey-gp-h+4],[ex-gp-2-w,ey-h/2],[ex-w/2,ey-gp-h+1],[ex+gp,ey-gp-h+4],
                                            [ex+gp+2,ey-h/2],[ex+gp,ey+gp-4],[ex-w/2,ey+gp-1],[ex-gp-w,ey+gp-4]);
        let best=null, bs=Infinity;
        for(const c of cands){
          const bx=[c[0],c[1],c[0]+w,c[1]+h];
          if(bx[0]<0||bx[1]<0||bx[2]>g.pw||bx[3]>g.H) continue;
          const sc=10*(hard.hits(bx[0]+1,bx[1]+2.5,bx[2]-1,bx[3]-2.5,1.5)+tx.hits(bx[0],bx[1]+1,bx[2],bx[3]-1,2))+soft.hits(bx[0]+1,bx[1]+2.5,bx[2]-1,bx[3]-2.5,0);
          if(sc<bs){ bs=sc; best=bx; if(!sc) break; }
        }
        if(!best){ t.remove(); tr.lab=null; return; }
        t.setAttribute('x',fx(best[0]-b.x)); t.setAttribute('y',fx(best[1]-b.y));
        tx.add(best[0],best[1]+2,best[2],best[3]-2);
      });
    }

    // band label above the right edge (dropped if it would touch the y title)
    const bt=txt(La,fx(g.xR),14,'uniform on average','ann','end');
    const bb=measure(bt,5.8);
    if(tx.hits(bb.x,bb.y,bb.x+bb.w,bb.y+bb.h,10)) bt.remove(); else tx.add(bb.x,bb.y,bb.x+bb.w,bb.y+bb.h);

    // diagonal label on the empty side of y = x, toward its upper end
    const dl=el('text',{class:'ann','text-anchor':'middle'},La); dl.textContent='same scores in every window';
    const dw=measure(dl,5.8).w;
    let placed=false;
    const half=dw/2/(g.S*RT2);                        // half the label's length, as a fraction of the diagonal
    for(const f of [0.74,0.66,0.58,0.5,0.42,0.82,0.34,0.26]){
      if(f+half>0.97||f-half<0.04) continue;           // keep clear of both corners
      const ax=X(1)+f*g.S-6/RT2, ay=Y(1)-f*g.S-6/RT2, bx=[];
      for(let s=-dw/2;s<=dw/2+.1;s+=5){ const qx=ax+s/RT2-4/RT2, qy=ay-s/RT2-4/RT2; bx.push([qx-4.5,qy-4.5,qx+4.5,qy+4.5]); }
      if(!bx.every(inPlot)||bx.some(b=>hard.hits(b[0],b[1],b[2],b[3],2)||tx.hits(b[0],b[1],b[2],b[3],3))) continue;
      dl.setAttribute('transform','translate('+fx(ax)+' '+fx(ay)+') rotate(-45)');
      bx.forEach(b=>tx.add(b[0],b[1],b[2],b[3])); placed=true; break;
    }
    if(!placed) dl.remove();

    // lower-left note: toward the lower left along the diagonal, the same few offsets win in every window
    const nt=el('text',{class:'ann'},La);
    span(nt,'same few offsets',{x:0,dy:0}); span(nt,'in every window',{x:0,dy:14.5});
    const nb=measure(nt,5.8), gapN=16;
    const nx=X(1)+4, nby=Y(1)-(nx+nb.w-X(1))-gapN*RT2, nty=nby-nb.h, nbox=[nx,nty,nx+nb.w,nby];
    if(nty<g.yT+4||hard.hits(nbox[0],nbox[1],nbox[2],nbox[3],8)||tx.hits(nbox[0],nbox[1],nbox[2],nbox[3],18)||soft.hits(nbox[0],nbox[1],nbox[2],nbox[3],6)) nt.remove();
    else{
      nt.setAttribute('transform','translate('+fx(nx-nb.x)+' '+fx(nty-nb.y)+')');
      tx.add(nbox[0],nbox[1],nbox[2],nbox[3]);
    }

    if(st.anim){ svg.classList.add('playing'); drawAnim(ease(animP())); } else svg.classList.remove('playing');
    drawOver(); buildTrack(); setTrack(st.anim?ease(animP()):1); updAria();
  }

  /* ---------- hover ---------- */
  function locate(ev){ const b=svg.getBoundingClientRect(); if(!b.width||!G) return null; const s=G.pw/b.width; return [(ev.clientX-b.left)*s,(ev.clientY-b.top)*s]; }
  function pick(x,y){
    let bi=-1, bd=Infinity;
    for(const p of PTS){ const d=Math.hypot(p.x-x,p.y-y); if(d<bd){ bd=d; bi=p.i; } }
    if(bi>=0&&bd<=G.r+6) return {t:'pt',i:bi};
    if(TR.length&&!st.anim){
      let bk=-1, bdk=Infinity;
      for(const tr of TR){ const d=polyDist(tr.px,x,y); if(d<bdk){ bdk=d; bk=tr.k; } }
      if(bk>=0&&bdk<=6) return {t:'path',k:bk};
    }
    if(bi>=0&&bd<=G.r+11) return {t:'pt',i:bi};
    return null;
  }
  const sameHov=(a,b)=>a===b||(!!a&&!!b&&a.t===b.t&&a.i===b.i&&a.k===b.k);
  function drawOver(){
    if(!G||!G.Lo) return;
    G.Lo.textContent='';
    const h=st.hov, hp=!!h&&h.t==='path';
    TR.forEach(tr=>{
      tr.g.classList.toggle('hot',hp&&h.k===tr.k); tr.g.classList.toggle('dim',hp&&h.k!==tr.k);
      if(tr.lab) tr.lab.classList.toggle('dim',hp&&h.k!==tr.k);
    });
    if(h&&h.t==='pt'&&PTS[h.i]){
      const p=PTS[h.i], traced=TR.some(tr=>tr.layer*G.m.kv===p.i);
      if(!traced){ const c=el('circle',{class:'pt'+(G.m.kv>1?' sm':''),cx:fx(p.x),cy:fx(p.y),r:G.r},G.Lo); c.style.fill=p.c.style.fill; }
      el('circle',{class:'ring',cx:fx(p.x),cy:fx(p.y),r:G.r+(traced?4.5:3.5)},G.Lo);
    }
  }
  function ptTip(i){
    const m=M(), q=m.pts[i];
    return '<b>layer '+Math.floor(i/m.kv)+' (head '+(i%m.kv)+')</b><div class="fxc-tt"><span class="k">static</span><span>'+f2(q[0])+
      '</span><span class="k">per window</span><span>'+f2(q[1])+'</span></div><span class="k fxc-w">of W = '+m.W+'</span>';
  }
  function pathTip(k){
    const tp=TP[k], m=M(), fin=m.pts[tp.layer*m.kv]||tp.end;
    return '<b>layer '+tp.layer+' · training path</b><div class="fxc-tt3"><span></span><span class="k">static</span><span class="k">per window</span>'+
      '<span class="k">'+FROM+'</span><span>'+f2(tp.start[0])+'</span><span>'+f2(tp.start[1])+'</span>'+
      '<span class="k">'+TO+'</span><span>'+f2(fin[0])+'</span><span>'+f2(fin[1])+'</span></div>';
  }
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
  function clearHov(){ if(st.hov){ st.hov=null; drawOver(); } hideTip(); }
  function onMove(ev){
    const q=locate(ev); if(!q) return;
    const h=pick(q[0],q[1]);
    if(!sameHov(h,st.hov)){ st.hov=h; drawOver(); }
    if(h) showTip(ev,h.t==='pt'?ptTip(h.i):pathTip(h.k)); else hideTip();
  }
  svg.addEventListener('pointermove',onMove);
  svg.addEventListener('pointerdown',onMove);
  // touch: the lifted finger "leaves" at once, so keep the tapped item until the next tap elsewhere
  svg.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse'||!st.hov) clearHov(); });
  document.addEventListener('pointerdown',ev=>{ if(st.hov&&!svg.contains(ev.target)) clearHov(); },true);

  /* ---------- replay ---------- */
  function animP(){ const a=st.anim; return a?clamp((performance.now()-a.t0)/DUR,0,1):1; }
  function drawAnim(e){
    TR.forEach(tr=>{
      const n=tr.px.length, s=e*tr.len, cs=tr.cs;
      let lo=0, hi=n-1;                                   // last smoothed vertex at or before arc length s
      while(hi-lo>1){ const mid=(lo+hi)>>1; if(cs[mid]<=s) lo=mid; else hi=mid; }
      const i=Math.min(lo,n-2), seg=cs[i+1]-cs[i], f=e>=1?1:(seg>0?clamp((s-cs[i])/seg,0,1):0);
      const a=tr.sp[i], b=tr.sp[i+1];
      tr.mk.setAttribute('cx',fx(a[0]+(b[0]-a[0])*f)); tr.mk.setAttribute('cy',fx(a[1]+(b[1]-a[1])*f));
      const p=tr.px[i], q=tr.px[i+1];                     // trace: the raw path up to the same place
      tr.tr.setAttribute('d',tr.segs.slice(0,i+1).join('')+'L'+fx(p[0]+(q[0]-p[0])*f)+' '+fx(p[1]+(q[1]-p[1])*f));
    });
    setTrack(e);
  }
  function frame(){
    const a=st.anim; if(!a) return;
    const p=animP();
    drawAnim(ease(p));
    if(p>=1){ finishAnim(); return; }
    cancelAnimationFrame(a.raf); clearTimeout(a.to);
    a.raf=requestAnimationFrame(frame);
    a.to=setTimeout(frame,60);                            // frames can stall (hidden tab, headless): keep going on a timer
  }
  function stopAnim(){
    const a=st.anim; if(!a) return;
    cancelAnimationFrame(a.raf); clearTimeout(a.to); st.anim=null;
    svg.classList.remove('playing');
    TR.forEach(tr=>tr.tr.setAttribute('d',tr.segs.join('')));
    setTrack(1); syncCtl();
  }
  function finishAnim(){ stopAnim(); drawOver(); }
  function startAnim(){
    stopAnim(); clearHov();
    if(reduced()||!TR.length){ setTrack(1); return; }  // reduced motion: straight to the end state
    st.anim={t0:performance.now(), raf:0, to:0};
    svg.classList.add('playing'); syncCtl();
    frame();
  }

  /* ---------- key track (legend + replay progress) ---------- */
  let TK=null;
  function buildTrack(){
    const w=Math.max(60,Math.round(track.getBoundingClientRect().width)||140), h=12, y=6, xa=4.5, xb=w-4.5;
    track.setAttribute('viewBox','0 0 '+w+' '+h); track.textContent='';
    el('line',{class:'tk-base',x1:xa,x2:xb,y1:y,y2:y},track);
    const pr=el('line',{class:'tk-prog',x1:xa,x2:xb,y1:y,y2:y},track);
    el('circle',{class:'tk-start',cx:xa,cy:y,r:3.3},track);
    const en=el('circle',{class:'tk-end',cx:xb,cy:y,r:3.4},track);
    const mk=el('circle',{class:'tk-mk',cx:xb,cy:y,r:3.4},track);
    TK={xa:xa,xb:xb,pr:pr,en:en,mk:mk};
  }
  function setTrack(e){
    if(!TK) buildTrack();
    const x=TK.xa+(TK.xb-TK.xa)*e;
    TK.pr.setAttribute('x2',fx(x)); TK.mk.setAttribute('cx',fx(x));
    TK.en.classList.toggle('open',e<1);
  }

  /* ---------- text ---------- */
  function summary(m){
    const W=m.W, th=nearTh(W), n=m.pts.length, near=m.pts.filter(q=>q[0]>th);
    const ord=m.pts.map((q,i)=>i).sort((a,b)=>m.pts[a][0]-m.pts[b][0]).slice(0,3);
    let lo=Infinity, hi=-Infinity; near.forEach(q=>{ lo=Math.min(lo,q[1]); hi=Math.max(hi,q[1]); });
    return {W:W, th:th, n:n, near:near.length, lo:lo, hi:hi, ord:ord};
  }
  function updStatus(){
    const m=M(), s=summary(m);
    status.innerHTML='<b>'+m.name+'</b> · '+s.n+' key gates · <b>'+s.near+'</b> near uniform on average (static &gt;&nbsp;'+nice(s.th)+
      ') · most concentrated: '+s.ord.map(i=>lname(m,i)+'&nbsp;'+f2(m.pts[i][0])).join(', ');
  }
  function updAria(){
    const m=M(), s=summary(m);
    let a=m.name+': '+s.n+' key gates, one per KV head, at '+TO+'. Horizontal: static effective number of offsets, 1 to '+s.W+
      '. Vertical: per-window effective number, 1 to '+s.W+'. Dashed diagonal: the two are equal. '+s.near+' of '+s.n+' have static above '+nice(s.th)+
      (s.near?', with per-window values from '+f2(s.lo)+' to '+f2(s.hi):'')+'. Most concentrated: '+
      s.ord.map(i=>'layer '+Math.floor(i/m.kv)+(m.kv>1?' head '+(i%m.kv):'')+' at '+f2(m.pts[i][0])+' and '+f2(m.pts[i][1])).join('; ')+'.';
    if(showT()) a+=' Lines trace the key gates of layers '+TP.map(t=>t.layer).join(', ').replace(/, (\d+)$/,' and $1')+' from '+FROM+' to '+TO+'.';
    svg.setAttribute('aria-label',a);
  }

  /* ---------- state changes ---------- */
  sel.addEventListener('change',()=>{
    if(!byId[sel.value]||sel.value===st.id) return;
    stopAnim(); st.id=sel.value; st.hov=null; hideTip();
    syncCtl(); render(); updStatus();
  });
  bPaths.addEventListener('click',()=>{
    if(!hasT()) return;
    stopAnim(); st.paths=!st.paths; st.hov=null; hideTip();
    syncCtl(); render();
  });
  bReplay.addEventListener('click',()=>{
    if(!hasT()) return;
    if(!st.paths){ stopAnim(); st.paths=true; syncCtl(); render(); }
    startAnim();
  });

  let lastW=0;
  function renderAll(){ lastW=Math.round(fig.clientWidth); render(); }
  syncCtl(); renderAll(); updStatus();
  if(window.ResizeObserver){
    new ResizeObserver(()=>{ const w=Math.round(fig.clientWidth); if(w&&w!==lastW){ TK=null; renderAll(); } }).observe(fig);
  }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ TK=null; render(); });
})();
