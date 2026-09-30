/* Load in <head> before any CSS paints. Shares the main site's setting (localStorage "theme"):
   an explicit choice wins, otherwise base.css follows the system colour scheme. */
(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();
