/* Theme toggle: a <button id="theme-btn"> with <span class="t"> flips light/dark and remembers the choice
   under the same key as the main site, so the choice carries across pages. */
(function(){
const b=document.getElementById("theme-btn"), r=document.documentElement; if(!b) return;
const isDark=()=>{ const a=r.getAttribute("data-theme"); return a ? a==="dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
function sync(){ const d=isDark(); b.querySelector(".t").textContent=d?" Light":" Dark"; b.setAttribute("aria-label",d?"Switch to light theme":"Switch to dark theme"); }
b.addEventListener("click",()=>{ const d=!isDark(); r.setAttribute("data-theme",d?"dark":"light"); try{localStorage.setItem("theme",d?"dark":"light");}catch(e){} sync(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",sync);
sync();
})();
