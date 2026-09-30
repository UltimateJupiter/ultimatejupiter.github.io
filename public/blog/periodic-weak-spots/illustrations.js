/* Periodic Weak Spots: compression pipeline, knockout network, and FP8 completion illustrations. */
(function(){
/* ---- chunked compression: score, normalize, gather ---- */
const pipe=document.getElementById("cmp-pipe"), strip=document.getElementById("cmp-strip");
if(pipe&&strip){
  const W=4,NT=16,CH=6,words=["the","door","code","is","7",",","the","safe","code","is","5","."];
  const bias=[-0.6,0.2,1.5,-0.3];
  const h01=(str,salt)=>{let h=2166136261^salt;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}h^=h>>>13;h=Math.imul(h,1274126177);h^=h>>>16;return (h>>>0)/4294967296;};
  const content=w=>w==="·"?-0.5:Math.round((h01(w,7)-0.5)*80)/100;
  const payload=(w,i)=>Array.from({length:CH},(_,c)=>(0.25+0.75*h01(w,31+c))*(0.8+0.2*Math.sin(1.7*c+2.1*i)));
  const fmt=v=>(v<0?"−":"")+Math.abs(v).toFixed(2);
  let shift=0,needle=4,uniform=false,hi=-1;
  const seqFor=k=>Array.from({length:NT},(_,t)=>{const n=t-k;return n>=0&&n<words.length?{w:words[n],n}:{w:"·",n:-1};});
  function calc(k){
    const seq=seqFor(k),t=k+needle,j=Math.floor(t/W);
    const rows=[0,1,2,3].map(i=>{const tok=seq[j*W+i],c=content(tok.w);return {tok,t:j*W+i,c,s:bias[i]+c,p:payload(tok.w,i)};});
    const m=Math.max(...rows.map(r=>r.s)),e=rows.map(r=>Math.exp(r.s-m)),Z=e.reduce((a,b)=>a+b,0);
    rows.forEach((r,i)=>r.a=uniform?1/W:e[i]/Z);
    return {seq,t,j,rows};
  }
  /* strip of 20 tokens in 5 windows */
  const chips=[],wins=[];
  for(let j=0;j<NT/W;j++){
    const cw=document.createElement("div");cw.className="cw";
    const tk=document.createElement("div");tk.className="cw-toks";
    for(let i=0;i<W;i++){const t=j*W+i,b=document.createElement("button");b.type="button";b.className="ct";b.style.setProperty("--oc",`var(--o${i})`);
      b.innerHTML=`<span class="w"></span><span class="n">${t}</span>`;
      b.addEventListener("click",()=>{const n=t-shift;if(n>=0&&n<words.length){needle=n;updCmp();}});tk.appendChild(b);chips.push(b);}
    const br=document.createElement("div");br.className="cw-br";const lab=document.createElement("div");lab.className="cw-lab";lab.textContent="window "+j;
    cw.append(tk,br,lab);strip.appendChild(cw);wins.push(cw);
  }
  /* shift and gate controls */
  const sh=document.getElementById("cmp-shift"),shiftBtns=[0,1,2,3].map(k=>{const b=document.createElement("button");b.type="button";b.className="shift";b.innerHTML=`<span>+${k}</span><i></i>`;b.addEventListener("click",()=>{shift=k;updCmp();});sh.appendChild(b);return b;});
  const bl=document.getElementById("cmp-learn"),bu=document.getElementById("cmp-uni");
  bl.addEventListener("click",()=>{uniform=false;updCmp();});bu.addEventListener("click",()=>{uniform=true;updCmp();});
  /* pipeline rows */
  const R=[0,1,2,3].map(i=>{
    const row=document.createElement("div");row.className="row";row.style.setProperty("--oc",`var(--o${i})`);
    const g=(c,col,extra)=>{const d=document.createElement("div");d.className=c;d.style.gridColumn=col;d.style.gridRow=3+i;if(extra)d.innerHTML=extra;row.appendChild(d);return d;};
    const tok=g("cp-tok",1,'<span class="w"></span><span class="m"></span>');
    const cz=g("cp-num lg sm-hide",2),p1=g("cp-op lg sm-hide",3,"+"),cb=g("cp-num lg sm-hide",4),p2=g("cp-op lg sm-hide",5,"="),cs=g("cp-num cp-s lg",6);
    const ca=g("cp-a",7,"<b></b><span></span>"),cp=g("cp-pay",8,Array(CH).fill("<i></i>").join(""));
    row.addEventListener("mouseenter",()=>{hi=i;paint();});row.addEventListener("mouseleave",()=>{hi=-1;paint();});
    pipe.appendChild(row);return {row,tok,cz,cb,cs,ca,cp};
  });
  const svgNS="http://www.w3.org/2000/svg",link=document.createElementNS(svgNS,"svg");link.setAttribute("class","cp-link sm-hide");link.setAttribute("viewBox","0 0 36 184");link.setAttribute("preserveAspectRatio","none");
  const paths=[0,1,2,3].map(i=>{const y=23+46*i,p=document.createElementNS(svgNS,"path");p.setAttribute("d",`M0,${y} C20,${y} 16,92 36,92`);p.setAttribute("vector-effect","non-scaling-stroke");p.setAttribute("stroke",`var(--o${i})`);link.appendChild(p);return p;});
  pipe.appendChild(link);
  const ent=document.createElement("div");ent.className="cp-entry";const bars=document.createElement("div");bars.className="cp-bars";
  const segs=Array.from({length:CH},()=>{const ch=document.createElement("div");ch.className="ch";bars.appendChild(ch);return [0,1,2,3].map(i=>{const x=document.createElement("i");x.style.setProperty("--oc",`var(--o${i})`);ch.appendChild(x);return x;});});
  const em=document.createElement("div");em.className="m";ent.append(bars,em);pipe.appendChild(ent);
  const f1=document.createElement("div");f1.className="cp-foot";f1.style.gridColumn="7";f1.style.gridRow=7;f1.textContent="sum = 1";
  const f2=document.createElement("div");f2.className="cp-foot";f2.style.gridColumn="8 / 11";f2.style.gridRow=7;f2.style.textAlign="right";f2.textContent="6 channels shown";
  pipe.append(f1,f2);
  let cur=null;
  function paint(){
    R.forEach((r,i)=>r.row.classList.toggle("dim",hi>=0&&i!==hi));
    paths.forEach((p,i)=>p.classList.toggle("dim",hi>=0&&i!==hi));
    segs.forEach(ch=>ch.forEach((x,i)=>x.classList.toggle("dim",hi>=0&&i!==hi)));
  }
  function updCmp(){
    cur=calc(shift);const {seq,t,j,rows}=cur;
    chips.forEach((b,k)=>{const tok=seq[k];b.querySelector(".w").textContent=tok.w;b.classList.toggle("pad",tok.n<0);b.classList.toggle("needle",k===t);
      b.setAttribute("aria-label",tok.n<0?"padding token":`token “${tok.w}” at position ${k}, offset ${k%W}`);b.tabIndex=tok.n<0?-1:0;});
    wins.forEach((w,k)=>w.classList.toggle("on",k===j));
    rows.forEach((r,i)=>{const e=R[i];
      e.row.classList.toggle("needle",r.t===t);
      e.tok.querySelector(".w").textContent=r.tok.w==="·"?"· pad":r.tok.w;
      e.tok.querySelector(".m").textContent=`t=${r.t} · i=${i}`;
      e.cz.textContent=fmt(r.c);e.cb.textContent=fmt(bias[i]);e.cs.textContent=fmt(r.s);
      e.ca.querySelector("b").style.width=Math.max(2,r.a*100)+"%";e.ca.querySelector("span").textContent=r.a.toFixed(2);
      e.cp.querySelectorAll("i").forEach((x,c)=>x.style.height=(r.p[c]*100)+"%");
      paths[i].setAttribute("stroke-width",(0.8+9*r.a).toFixed(2));paths[i].setAttribute("stroke-opacity",(0.2+0.8*r.a).toFixed(2));
    });
    segs.forEach((ch,c)=>ch.forEach((x,i)=>x.style.height=(rows[i].a*rows[i].p[c]*100)+"%"));
    em.textContent="window "+j;
    pipe.classList.toggle("uni",uniform);
    bl.setAttribute("aria-pressed",String(!uniform));bu.setAttribute("aria-pressed",String(uniform));
    shiftBtns.forEach((b,k)=>{const c=calc(k),a=c.rows[(k+needle)%W].a;b.setAttribute("aria-pressed",String(k===shift));b.querySelector("i").style.setProperty("--a",(a*100)+"%");b.setAttribute("aria-label",`prepend ${k} token${k===1?"":"s"}; followed token's score ${a.toFixed(2)}`);});
    const nr=rows[t%W];
    document.getElementById("cmp-readout").textContent=`“${words[needle]}” at t=${t} · window ${j} · offset ${t%W} · score α=${nr.a.toFixed(2)}`;
    paint();
  }
  updCmp();
}
/* ---- head knockout: measured relative accuracy changes of W8/S8 · 1 KV, seed 42 (prefix padding, folded to position mod 8) ---- */
const hb=document.getElementById("ko-buttons"),net=document.getElementById("ko-net"),bars=document.getElementById("ko-bars");
const FD=window.FIGDATA,ref=FD&&FD.runs&&FD.runs.models.find(m=>m.id===FD.runs.default);
if(hb&&net&&bars&&ref){
  const prof={none:[0,0,0,0,0,0,0,0]};
  ref.pp.ko.forEach((row,l)=>{prof[String(l)]=[0,1,2,3,4,5,6,7].map(c=>(row[c]+row[c+8]+row[c+16])/3);});
  const NL=ref.pp.ko.length,NP=12,picks=["0","9","10","14"],SC=150/130,Z=30*SC;let sel="9";
  const btns=[["none","none"],...picks.map(l=>[l,"L"+l])].map(([k,t])=>{const b=document.createElement("button");b.type="button";b.textContent=t;b.setAttribute("aria-label",k==="none"?"clean run, no knockout":"knock out layer "+k);b.addEventListener("click",()=>{sel=k;updKo();});hb.appendChild(b);return [k,b];});
  const top=document.createElement("div");top.className="ax r";top.style.gridColumn="12 / 14";top.textContent="↑ answer";
  const sp=document.createElement("div");sp.style.gridColumn="1 / 12";net.append(sp,top);
  const fin=[],lns=[];
  for(let l=NL-1;l>=0;l--){
    const r=document.createElement("div");r.className="row";const L=String(l);
    if(picks.includes(L))r.classList.add("pick");
    r.addEventListener("click",()=>{sel=L;updKo();});
    const ln=document.createElement("span");ln.className="ln";r.appendChild(ln);lns[l]=ln;
    for(let p=0;p<NP;p++){const c=document.createElement("span");c.className="c"+(p===NP-1?" fin":"");r.appendChild(c);if(p===NP-1)fin[l]=c;}
    r.dataset.l=L;net.appendChild(r);
  }
  net.addEventListener("keydown",e=>{
    const cur=sel==="none"?-1:+sel;
    if(e.key==="ArrowUp"||e.key==="ArrowRight"){sel=String(Math.min(NL-1,cur+1));}
    else if(e.key==="ArrowDown"||e.key==="ArrowLeft"){sel=cur<=0?"0":String(cur-1);}
    else if(e.key==="Home"){sel="0";} else if(e.key==="End"){sel=String(NL-1);}
    else return;
    e.preventDefault();updKo();
  });
  const g=document.createElement("div");g.className="gap";const al=document.createElement("div");al.className="ax l";al.textContent="prompt tokens →";
  const ar=document.createElement("div");ar.className="ax r";ar.textContent="final";net.append(g,document.createElement("span"),al,ar);
  const bb=[];for(let r=0;r<8;r++){const d=document.createElement("div");d.className="ko-bar";d.innerHTML="<b></b>";bars.appendChild(d);bb.push(d.querySelector("b"));}
  const pc=v=>(v<0?"−":"+")+Math.abs(Math.round(v))+"%";
  function summary(k){
    if(k==="none") return "clean run: no change at any phase";
    const v=prof[k],big=v.map((x,i)=>[i,x]).filter(([,x])=>x<=-50);
    if(big.length===8) return `L${k} → μ: every phase loses ${Math.round(-Math.max(...v))}–${Math.round(-Math.min(...v))}%`;
    if(big.length){
      const rest=v.filter((x,i)=>!big.some(([j])=>j===i)),m=Math.round(Math.max(...rest.map(Math.abs)));
      return `L${k} → μ: `+big.map(([i,x])=>`phase ${i} ${pc(x)}`).join(", ")+`; other phases within ±${m}%`;
    }
    const i=v.reduce((b,x,j)=>Math.abs(x)>Math.abs(v[b])?j:b,0);
    return `L${k} → μ: largest change ${pc(v[i])} at phase ${i}`;
  }
  function updKo(){
    btns.forEach(([k,b])=>b.setAttribute("aria-pressed",String(k===sel)));
    const s=sel==="none"?-1:+sel;
    net.querySelectorAll(".row").forEach(r=>r.classList.toggle("sel",r.dataset.l===sel));
    lns.forEach((ln,l)=>{const L=String(l);ln.textContent=(picks.includes(L)||l===NL-1||l===s)?"L"+l:"";});
    fin.forEach((c,l)=>{c.classList.toggle("ko",l===s);c.classList.toggle("down",s>=0&&l>s);});
    prof[sel].forEach((v,i)=>{const c=Math.max(-100,Math.min(30,v)),h=Math.abs(c)*SC,b=bb[i];
      b.classList.toggle("up",c>0);b.style.top=(c>0?Z-h:Z)+"px";b.style.height=h+"px";});
    const txt=summary(sel);
    document.getElementById("ko-readout").textContent=txt;
    net.setAttribute("aria-valuenow",String(Math.max(0,s)));net.setAttribute("aria-valuetext",s<0?"no knockout":txt);
  }
  updKo();
}
})();

(function(){
const code=document.getElementById("fp8-code"); if(!code) return;
/* Measured next-token probabilities for DeepSeek-V4-Flash-Base, filler lengths L = 24..39. */
const P8=[0.101,0.178,0.787,0.951,0.361,0.447,0.906,0.956,0.378,0.168,0.869,0.943,0.258,0.218,0.939,0.968];
const P32=[0.886,0.814,0.201,0.037,0.608,0.490,0.081,0.029,0.597,0.811,0.123,0.039,0.725,0.771,0.052,0.019];
const range=document.getElementById("fp8-n"), strip=document.getElementById("fp8-strip");
const cells=[];
for(let k=0;k<16;k++){const L=24+k,b=document.createElement("button");b.type="button";b.className="fp8-cell"+(k&&L%4===0?" cyc":"");
  b.setAttribute("aria-label","L = "+L+", P(8) = "+P8[k].toFixed(2));
  b.innerHTML="<i></i><span>"+L+"</span>";
  const i=b.querySelector("i");i.style.setProperty("--h",Math.round(P8[k]*100)+"%");i.style.setProperty("--c",P8[k]>P32[k]?"var(--good)":"color-mix(in srgb,var(--fg) 30%,transparent)");
  b.addEventListener("click",()=>{range.value=9+k;updFp8();});strip.appendChild(b);cells.push(b);}
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;");}
function updFp8(){
  const n=+range.value, k=n-9, L=24+k;
  const eqs=Array(n).fill("=").join(" ");
  code.innerHTML=
    '<span class="dim">"""</span>This module contains optimized tensor kernels used by the model inference runtime.\n'+
    '<span class="eqs">'+eqs+'</span><span class="dim">"""</span>\n'+
    '<span class="dim">...</span>\nFP8 = "float8_e4m3"\nFP4 = "float4_e2m1fn"\nFP32 = "float32"\n<span class="dim">...</span>\n'+
    esc('"""Block-wise FP8 quantization."""')+'\n<span class="dim">...</span>\ncompute_dtype = FP32\n<span class="dim">...</span>\n'+
    's_local[i] = ... * fp8_max_inv\n<span class="dim">...</span>\nT.Cast(compute_dtype, T.Cast(FP<span class="cur" aria-hidden="true"></span>';
  document.getElementById("fp8-b8").style.width=(P8[k]*100)+"%";
  document.getElementById("fp8-b32").style.width=(P32[k]*100)+"%";
  document.getElementById("fp8-v8").textContent=P8[k].toFixed(3);
  document.getElementById("fp8-v32").textContent=P32[k].toFixed(3);
  const good=P8[k]>P32[k], p=good?P8[k]:P32[k];
  document.getElementById("fp8-pred").innerHTML='top prediction: <span class="'+(good?'good':'bad')+'">'+(good?'8 &#10003;':'32 &#10007;')+'</span>';
  document.getElementById("fp8-readout").textContent=n+" signs · L = "+L+" (mod 4 = "+(L%4)+") → "+(good?"8":"32")+", P = "+p.toFixed(2);
  cells.forEach((c,j)=>{if(j===k)c.setAttribute("aria-current","true");else c.removeAttribute("aria-current");});
}
range.addEventListener("input",updFp8);
document.getElementById("fp8-minus").addEventListener("click",()=>{range.value=Math.max(9,+range.value-1);updFp8();});
document.getElementById("fp8-plus").addEventListener("click",()=>{range.value=Math.min(24,+range.value+1);updFp8();});
updFp8();
})();
