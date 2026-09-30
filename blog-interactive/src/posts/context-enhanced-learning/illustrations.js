/* Context-Enhanced Learning: one training sequence under the three curricula (figure.ill #fig-seq). */
(function(){
'use strict';
const fig=document.getElementById('fig-seq');
if(!fig) return;

/* worked example of the paper's Appendix I: MLT(5, 8), input s1 and the phrasebook excerpts shown in its context */
const S1='C B E F E B D E C B C A H E F B C A D F G B D G H E D E'.split(' ');
const S6='q o v t t u t o s u s s s o p p r o q s o q r q p s t p';
const BOOKS=[
 'D A -> N J; A D -> J I; B C -> O I; C C -> N N; H E -> P K; F E -> M L; G H -> L N; E G -> P J; A F -> K M; E C -> K P; B E -> K I; F D -> M N; E D -> P O; B A -> P L; B D -> I P; D G -> I I; D H -> I O; E F -> L M; H B -> J K; E A -> K J; A H -> L J; G C -> I K; F B -> P I; F G -> J O',
 'L P -> V X; M K -> R W; L I -> X R; N O -> R R; M O -> U Q; I L -> W V; O K -> Q W; P M -> R U; J I -> V S; I M -> X W; O I -> Q U; N P -> R Q; I N -> Q X; N L -> R S; I J -> Q T; N J -> S T; L O -> U V; P J -> T X; J L -> Q R; P K -> W R; N M -> S U; M I -> Q S; P O -> S S; K K -> U U; P L -> X U',
 'X U -> Y d; R W -> a c; T Q -> Y Y; U R -> Z Y; T X -> e d; W W -> e Y; U X -> f f; X R -> b Y; Q Q -> b c; S S -> c c; V U -> Z d; R S -> f a; V W -> Y e; R U -> f c; U S -> c a; U W -> c f; W X -> d Y; R Q -> c Z; V Q -> Z f; W S -> b d; V R -> a a; R X -> f Z; U Q -> d c; Q V -> d Z; S W -> Y b',
 'c a -> m j; b Y -> n k; c f -> k m; c b -> l n; Z d -> g h; d c -> n g; b f -> i k; f Z -> i i; Z Y -> g l; Y a -> l l; b e -> l i; Y Y -> m g; d Z -> g g; d e -> k l; f c -> j g; f f -> k n; b Z -> n h; e a -> i m; c e -> j h; Y d -> i h; Y b -> h i; Y f -> h k; a Y -> k j; a a -> m k; c Y -> h m',
 'k g -> p s; h h -> r q; j m -> o o; i h -> q s; l m -> p o; i j -> o q; l j -> q u; k m -> v u; g h -> p p; g n -> v p; n h -> s s; m m -> s o; m k -> v t; m i -> u t; h k -> t o; n k -> r u; j n -> t u; g l -> t s; j g -> v v; h g -> u s; n l -> s u; l k -> q o; h l -> t p; i i -> p q; k i -> r o; l h -> u p'
].map(b=>b.split('; ').map(r=>{const [a,c]=r.split(' -> ');return {k:a.replace(' ',''),src:a,dst:c};}));

/* run the translation (shift left by one, then rewrite pairs) and mark the rules it uses */
let s=S1.slice();
BOOKS.forEach(book=>{
  const map=new Map(book.map(r=>[r.k,r])), L=s.length, sh=s.map((_,j)=>s[(j+1)%L]), nx=[];
  for(let t=0;t<L;t+=2){const r=map.get(sh[t]+sh[t+1]);r.used=true;nx.push(...r.dst.split(' '));}
  s=nx;
});
if(s.join(' ')!==S6) console.error('fig-seq: the example does not reproduce s6');

/* seeded draws so that the slider only changes the threshold, not the draw */
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let seed=7, mode='fixed', draw=null;
function redraw(){
  const r=rng(seed);
  draw=BOOKS.map(book=>{
    const unused=book.filter(x=>!x.used), nu=Math.round(0.25*(book.length-unused.length));
    const pick=new Set(unused.map(x=>[r(),x]).sort((a,b)=>a[0]-b[0]).slice(0,nu).map(p=>p[1].k));
    return book.map(x=>({r:x,u:r(),extra:pick.has(x.k)}));
  });
}

const segBtns=[...fig.querySelectorAll('.seq-seg button')];
const prog=document.getElementById('seq-prog'), slider=document.getElementById('seq-t'), tv=document.getElementById('seq-tv');
const redrawBtn=document.getElementById('seq-redraw'), readout=document.getElementById('seq-readout');
const ctx=document.getElementById('seq-ctx');
const sub='₁₂₃₄₅₆';
document.getElementById('seq-in').textContent=S1.join(' ');
document.getElementById('seq-out').innerHTML='<span class="seq-think">&lt;THINK&gt; × 160</span> <span class="seq-ans">'+S6+'</span>';

function rate(){return mode==='fixed'?0.2:mode==='anneal'?Math.min(1,(+slider.value)/60):1;}
function render(){
  segBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  prog.classList.toggle('off',mode!=='anneal');slider.disabled=mode!=='anneal';redrawBtn.disabled=mode==='none';
  const p=rate(); tv.textContent=slider.value+'%';
  ctx.textContent='';
  if(mode==='none'){
    const e=document.createElement('div');e.className='seq-empty';e.textContent='(empty)';ctx.appendChild(e);
    readout.textContent='No Context: plain fine-tuning; the model sees only the input.';
    return;
  }
  let nUsed=0,nExtra=0,nDrop=0;
  draw.forEach((book,i)=>{
    const line=document.createElement('div');line.className='seq-book';
    const lab=document.createElement('span');lab.className='seq-pi';lab.textContent='π'+sub[i];line.appendChild(lab);
    const rules=document.createElement('span');rules.className='seq-rules';
    book.forEach(x=>{
      if(!x.r.used&&!(mode==='anneal'&&x.extra)) return;
      const dropped=x.u<p, sp=document.createElement('span');
      sp.className='seq-r'+(x.r.used?'':' unused')+(dropped?' drop':'');
      sp.textContent=x.r.src+' -> '+x.r.dst+';';
      if(dropped) sp.title='dropped: not in the context';
      rules.appendChild(sp);
      if(x.r.used) nUsed++; else nExtra++;
      if(dropped) nDrop++;
    });
    line.appendChild(rules);ctx.appendChild(line);
  });
  const tot=nUsed+nExtra;
  readout.textContent=(mode==='fixed'
    ?'Fixed Dropout: '+nUsed+' rules used by this input, '+nDrop+' dropped at rate 20%; '+(tot-nDrop)+' remain in the context.'
    :'Annealing Dropout at '+slider.value+'% of training: dropout rate '+Math.round(p*100)+'%; '+nUsed+' used and '+nExtra+' unused rules, '+nDrop+' dropped, '+(tot-nDrop)+' remain.')
    ;
}
segBtns.forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;render();}));
slider.addEventListener('input',render);
redrawBtn.addEventListener('click',()=>{seed++;redraw();render();});
redraw();render();
})();
