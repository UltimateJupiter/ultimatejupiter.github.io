/* fx-dd: a custom model menu that replaces every native <select class="fx-select"> inside a data figure (figure.fx).
   The native select stays in the DOM, hidden, as the single source of truth: figure scripts keep reading sel.value,
   setting sel.value, and listening for 'change'. Picking an item here writes the value and dispatches 'change';
   programmatic writes to sel.value / sel.selectedIndex and option rebuilds are mirrored back into the menu.
   Runs after the figure scripts. ARIA: button (aria-haspopup=listbox) + listbox with groups and options. */
(function(){
'use strict';
const D=window.FIGDATA||{};
const NS='http://www.w3.org/2000/svg';
const byRun={}; ((D.runs&&D.runs.models)||[]).forEach(m=>{byRun[m.id]=m;});
const byCyc={}; ((D.cyc&&D.cyc.runs)||[]).forEach(r=>{byCyc[r.id]=r;});

/* Per-figure extras: a short geometry note and, where it helps, a tiny profile of the model. */
/* Model names already list their signature attributes, so the only extra is a tiny profile where it helps choose:
   accuracy by position (Figure 2) and the uncycled accuracy by phase (gate cycling). */
function extras(figId,v){
  if(figId==='fx-acc'){ const m=byRun[v]; return m?{spark:m.pp.acc}:{}; }
  if(figId==='fx-ko'&&v==='deepseek') return {meta:'whole layers · mod 8'};
  if(figId==='fx-cyc'){ const r=byCyc[v]; return r?{spark:r.clean.acc}:{}; }
  return {};
}
function spark(vals){
  const s=document.createElementNS(NS,'svg'); s.setAttribute('class','fx-dd-spark'); s.setAttribute('viewBox','0 0 72 18');
  s.setAttribute('aria-hidden','true'); s.setAttribute('preserveAspectRatio','none');
  const n=vals.length, pts=vals.map((v,i)=>(i*71/(n-1)+0.5).toFixed(1)+','+(17-Math.max(0,Math.min(100,v))*0.16).toFixed(1));
  const p=document.createElementNS(NS,'polyline'); p.setAttribute('points',pts.join(' '));
  p.setAttribute('fill','none'); p.setAttribute('stroke','currentColor'); p.setAttribute('stroke-width','1.1');
  p.setAttribute('stroke-linejoin','round'); p.setAttribute('vector-effect','non-scaling-stroke');
  s.appendChild(p); return s;
}
function caret(){
  const s=document.createElementNS(NS,'svg'); s.setAttribute('class','fx-dd-caret'); s.setAttribute('viewBox','0 0 10 10'); s.setAttribute('aria-hidden','true');
  const p=document.createElementNS(NS,'path'); p.setAttribute('d','M1.5 3.5 L5 7 L8.5 3.5'); p.setAttribute('fill','none');
  p.setAttribute('stroke','currentColor'); p.setAttribute('stroke-width','1.3'); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round');
  s.appendChild(p); return s;
}

const vDesc=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
const iDesc=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'selectedIndex');
let uid=0, openDD=null;
const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

function enhance(sel){
  const fig=sel.closest('figure.fx'); if(!fig||sel.dataset.fxDd) return;
  sel.dataset.fxDd='1'; const id=++uid, figId=fig.id;
  if(getComputedStyle(fig).position==='static') fig.style.position='relative';

  /* trigger */
  const btn=document.createElement('button'); btn.type='button';
  btn.className='fx-select fx-dd-btn'; btn.id=(sel.id||('fx-dd-'+id))+'-btn';
  btn.setAttribute('aria-haspopup','listbox'); btn.setAttribute('aria-expanded','false');
  const val=document.createElement('span'); val.className='fx-dd-val'; btn.append(val,caret());
  sel.insertAdjacentElement('afterend',btn); sel.classList.add('fx-dd-native'); sel.tabIndex=-1; sel.setAttribute('aria-hidden','true');
  const lab=sel.id?fig.querySelector('label[for="'+sel.id+'"]'):null;
  if(lab) lab.htmlFor=btn.id;
  const baseName=sel.getAttribute('aria-label')||(lab&&lab.textContent.trim())||'Model';

  /* popup */
  const pop=document.createElement('div'); pop.className='fx-dd-pop'; pop.id='fx-dd-'+id+'-list';
  pop.setAttribute('role','listbox'); pop.tabIndex=-1; pop.setAttribute('aria-label',baseName);
  btn.setAttribute('aria-controls',pop.id); fig.appendChild(pop);

  let items=[], active=-1, typed='', typedAt=0;
  function build(){
    pop.textContent=''; items=[];
    const addOpt=(o,parent)=>{
      const it=document.createElement('div'); it.className='fx-dd-opt'; it.setAttribute('role','option');
      it.id=pop.id+'-o'+items.length; it.dataset.value=o.value;
      const nm=document.createElement('span'); nm.className='fx-dd-name'; nm.textContent=o.textContent; it.appendChild(nm);
      const ex=extras(figId,o.value), mt=document.createElement('span'); mt.className='fx-dd-meta'; mt.textContent=ex.meta||''; it.appendChild(mt);
      if(ex.spark&&ex.spark.length>1) it.appendChild(spark(ex.spark)); else it.appendChild(document.createElement('span'));
      if(o.disabled) it.setAttribute('aria-disabled','true');
      it.addEventListener('pointermove',()=>{ const k=items.indexOf(it); if(k!==active) setActive(k,false); });
      it.addEventListener('click',()=>{ if(!o.disabled) choose(items.indexOf(it)); });
      parent.appendChild(it); items.push(it);
    };
    for(const ch of sel.children){
      if(ch.tagName==='OPTGROUP'){
        const g=document.createElement('div'); g.className='fx-dd-group'; g.setAttribute('role','group');
        const gl=document.createElement('div'); gl.className='fx-dd-gl'; gl.id=pop.id+'-g'+pop.children.length; gl.textContent=ch.label;
        g.setAttribute('aria-labelledby',gl.id); g.appendChild(gl); pop.appendChild(g);
        for(const o of ch.children) if(o.tagName==='OPTION') addOpt(o,g);
      } else if(ch.tagName==='OPTION'){
        let g=pop.lastElementChild;
        if(!g||!g.classList.contains('fx-dd-loose')){ g=document.createElement('div'); g.className='fx-dd-group fx-dd-loose'; g.setAttribute('role','presentation'); pop.appendChild(g); }
        addOpt(ch,g);
      }
    }
    sync();
  }
  function sync(){
    const i=iDesc.get.call(sel), o=sel.options[i];
    val.textContent=o?o.textContent:'';
    btn.setAttribute('aria-label',baseName+': '+(o?o.textContent:'none'));
    items.forEach((it,k)=>it.setAttribute('aria-selected',String(k===i)));
    btn.disabled=sel.disabled;
  }
  let q=false; const queue=()=>{ if(q) return; q=true; Promise.resolve().then(()=>{ q=false; sync(); }); };
  Object.defineProperty(sel,'value',{configurable:true,get(){return vDesc.get.call(this);},set(v){vDesc.set.call(this,v);queue();}});
  Object.defineProperty(sel,'selectedIndex',{configurable:true,get(){return iDesc.get.call(this);},set(v){iDesc.set.call(this,v);queue();}});
  sel.addEventListener('change',queue);
  new MutationObserver(()=>{ if(isOpen()) close(false); build(); }).observe(sel,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','label']});

  function isOpen(){ return pop.classList.contains('open'); }
  function setActive(k,scroll){
    if(active>=0&&items[active]) items[active].classList.remove('active');
    active=k;
    if(k>=0&&items[k]){ items[k].classList.add('active'); pop.setAttribute('aria-activedescendant',items[k].id);
      if(scroll){ const it=items[k], g=it.parentNode, gl=g.querySelector('.fx-dd-gl');
        /* the first item of a group also reveals the group's label */
        const top=(gl&&g.querySelector('.fx-dd-opt')===it)?gl.offsetTop-2:it.offsetTop-4, bot=it.offsetTop+it.offsetHeight+4;
        if(top<pop.scrollTop) pop.scrollTop=Math.max(0,top);
        else if(bot>pop.scrollTop+pop.clientHeight) pop.scrollTop=bot-pop.clientHeight; } }
    else pop.removeAttribute('aria-activedescendant');
  }
  function place(){
    const fr=fig.getBoundingClientRect(), br=btn.getBoundingClientRect(), vh=window.innerHeight;
    const fw=fr.width, w=Math.min(fw,Math.max(br.width,420));
    let left=br.left-fr.left; if(left+w>fw) left=Math.max(0,fw-w);
    pop.style.width=w+'px'; pop.style.left=left+'px';
    pop.classList.toggle('compact',w<380);
    pop.style.maxHeight=''; const natural=pop.scrollHeight+2;
    const below=vh-br.bottom-12, above=br.top-12, want=Math.min(natural,420);
    const up=below<Math.min(want,260)&&above>below;
    const h=Math.max(120,Math.min(want,up?above:below));
    pop.style.maxHeight=h+'px';
    pop.classList.toggle('up',up);
    pop.style.top=(up?(br.top-fr.top-4-Math.min(h,natural)):(br.bottom-fr.top+4))+'px';
  }
  function open(){
    if(btn.disabled) return;
    if(openDD&&openDD!==api) openDD.close(false);
    openDD=api; place(); pop.classList.add('open'); btn.setAttribute('aria-expanded','true');
    setActive(iDesc.get.call(sel),true); pop.focus({preventScroll:true});
    document.addEventListener('pointerdown',outside,true); window.addEventListener('resize',onResize);
  }
  function close(refocus){
    if(!isOpen()) return;
    pop.classList.remove('open'); btn.setAttribute('aria-expanded','false'); setActive(-1,false);
    document.removeEventListener('pointerdown',outside,true); window.removeEventListener('resize',onResize);
    if(openDD===api) openDD=null;
    if(refocus) btn.focus({preventScroll:true});
  }
  function onResize(){ if(isOpen()) place(); }
  function outside(e){ if(!pop.contains(e.target)&&!btn.contains(e.target)) close(false); }
  function choose(k){
    const it=items[k]; if(!it||it.getAttribute('aria-disabled')==='true') return;
    close(true);
    if(vDesc.get.call(sel)!==it.dataset.value){
      vDesc.set.call(sel,it.dataset.value); sync();
      sel.dispatchEvent(new Event('input',{bubbles:true})); sel.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  function step(from,dir){ let k=from; for(let n=0;n<items.length;n++){ k+=dir; if(k<0||k>=items.length) return from; if(items[k].getAttribute('aria-disabled')!=='true') return k; } return from; }
  function typeahead(ch){
    const now=Date.now(); typed=(now-typedAt>700?'':typed)+ch.toLowerCase(); typedAt=now;
    const start=typed.length===1?active+1:Math.max(active,0);
    for(let n=0;n<items.length;n++){ const k=(start+n)%items.length;
      if(items[k].textContent.toLowerCase().startsWith(typed)&&items[k].getAttribute('aria-disabled')!=='true') return k; }
    return -1;
  }
  btn.addEventListener('click',()=>{ isOpen()?close(true):open(); });
  btn.addEventListener('keydown',e=>{
    if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)||(e.altKey&&e.key==='ArrowDown')){ e.preventDefault(); open(); }
    else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){ const k=typeahead(e.key); if(k>=0){ e.preventDefault(); open(); setActive(k,true); } }
  });
  pop.addEventListener('keydown',e=>{
    const k=e.key;
    if(k==='ArrowDown'){ e.preventDefault(); setActive(step(active,1),true); }
    else if(k==='ArrowUp'){ e.preventDefault(); setActive(step(active,-1),true); }
    else if(k==='Home'){ e.preventDefault(); setActive(step(-1,1),true); }
    else if(k==='End'){ e.preventDefault(); setActive(step(items.length,-1),true); }
    else if(k==='PageDown'){ e.preventDefault(); let a=active; for(let n=0;n<7;n++) a=step(a,1); setActive(a,true); }
    else if(k==='PageUp'){ e.preventDefault(); let a=active; for(let n=0;n<7;n++) a=step(a,-1); setActive(a,true); }
    else if(k==='Enter'||k===' '){ e.preventDefault(); if(active>=0) choose(active); }
    else if(k==='Escape'){ e.preventDefault(); close(true); }
    else if(k==='Tab'){ e.preventDefault(); close(true); }
    else if(k.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){ const t=typeahead(k); if(t>=0){ e.preventDefault(); setActive(t,true); } }
  });
  pop.addEventListener('focusout',e=>{ if(isOpen()&&!pop.contains(e.relatedTarget)&&e.relatedTarget!==btn) close(false); });
  if(reduce()) pop.style.transition='none';
  const api={close:close}; build();
}
document.querySelectorAll('figure.fx select.fx-select').forEach(enhance);
})();
