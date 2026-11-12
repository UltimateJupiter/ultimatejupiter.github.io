/* Top bar behaviour, as on the main site (src/components/Nav.astro).
   Theme toggle: <button id="theme-btn"> flips light/dark and remembers the choice under the same key
   as the main site ("theme"), so the choice carries across pages.
   Bar: clear at the top of the page (.at-top), paper-coloured blur once scrolled. */
(function(){
const r=document.documentElement, bar=document.querySelector(".site-bar");
if(bar){ const onScroll=()=>bar.classList.toggle("at-top",window.scrollY<=12); onScroll(); window.addEventListener("scroll",onScroll,{passive:true}); }
const b=document.getElementById("theme-btn"); if(!b) return;
const isDark=()=>{ const a=r.getAttribute("data-theme"); return a ? a==="dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
function sync(){ b.setAttribute("aria-label",isDark()?"Switch to light theme":"Switch to dark theme"); }
b.addEventListener("click",()=>{ const d=!isDark(); r.setAttribute("data-theme",d?"dark":"light"); try{localStorage.setItem("theme",d?"dark":"light");}catch(e){} sync(); window.dispatchEvent(new CustomEvent("themechange")); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",sync);
sync();
})();
