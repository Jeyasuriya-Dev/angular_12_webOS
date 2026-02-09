(function(window){
  function el(html){ var t=document.createElement('div'); t.innerHTML=html.trim(); return t.firstChild; }
  function qs(sel,root){ return (root||document).querySelector(sel); }
  function qsa(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  window.Dom = { el: el, qs: qs, qsa: qsa };
})(window);
