(function(window, Dom){
  window.UserManualComponent = function(){
    var currentPage = 1; var totalPages = 21; var base = 'assets/usermanual/pdf2png/usermanual.v1.0';
    var node = Dom.el('<div class="user-manual-overlay"><div class="user-manual-frame"><img id="umImg" draggable="false" /></div></div>');
    var img = node.querySelector('#umImg');
    function render(){ var page = String(currentPage).padStart(2,'0'); img.src = base + '/usermanual.v1.0-' + page + '.png'; }
    function close(){ node.parentNode && node.parentNode.removeChild(node); document.removeEventListener('keydown', handler, true); }
    function handler(ev){ if(ev.keyCode===38) { currentPage=Math.max(1,currentPage-1); render(); ev.preventDefault(); ev.stopPropagation(); }
      if(ev.keyCode===40) { currentPage=Math.min(totalPages,currentPage+1); render(); ev.preventDefault(); ev.stopPropagation(); }
      if(ev.keyCode===27 || ev.keyCode===10009){ close(); ev.preventDefault(); ev.stopPropagation(); }
    }
    document.addEventListener('keydown', handler, true); render(); return node; };
})(window, Dom);
