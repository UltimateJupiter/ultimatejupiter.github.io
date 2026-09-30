/* Contents rail: highlights the section currently in view. Expects <nav class="toc"><ol><li><a href="#id">. */
(function(){
const links=[...document.querySelectorAll('.toc a')]; if(!links.length) return;
const heads=links.map(a=>document.getElementById(a.getAttribute('href').slice(1)));
let ticking=false;
function spy(){
  ticking=false;
  let cur=heads[0];
  if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-2) cur=heads[heads.length-1];
  else for(const h of heads){if(h.getBoundingClientRect().top<window.innerHeight*0.3)cur=h;}
  links.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+cur.id));
}
window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(spy);}},{passive:true});
window.addEventListener('resize',spy);
spy();
})();
