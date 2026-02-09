(function(window, Dom){
  var container;
  var defaultDuration = 3000;

  function ensure(){
    if (!container) {
      container = Dom.el('<div class="toast-container toast-top-right"></div>');
      document.body.appendChild(container);
    }
  }

  function escapeHtml(v){
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function show(type, message, title){
    var duration = defaultDuration;
    var removed = false;
    var timer = null;
    var el;
    var closeBtn;
    var progress;

    ensure();

    el = Dom.el(
      '<div class="toast toast-' + type + '" role="alert" aria-live="assertive" aria-atomic="true">' +
        '<button type="button" class="toast-close" aria-label="Close">&times;</button>' +
        '<div class="toast-title">' + escapeHtml(title || '') + '</div>' +
        '<div class="toast-message">' + escapeHtml(message || '') + '</div>' +
        '<div class="toast-progress"></div>' +
      '</div>'
    );

    function removeToast(){
      if (removed) return;
      removed = true;
      if (timer) clearTimeout(timer);
      el.classList.add('toast-hide');
      setTimeout(function(){
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }

    closeBtn = el.querySelector('.toast-close');
    progress = el.querySelector('.toast-progress');

    if (closeBtn) {
      closeBtn.addEventListener('click', removeToast);
    }
    if (progress) {
      progress.style.animationDuration = duration + 'ms';
    }

    container.appendChild(el);
    timer = setTimeout(removeToast, duration);
  }

  window.Toast = {
    success: function(m,t){ show('success', m, t||'Success'); },
    error: function(m,t){ show('error', m, t||'Error'); },
    info: function(m,t){ show('info', m, t||'Info'); },
    warning: function(m,t){ show('warning', m, t||'Warning'); }
  };
})(window, Dom);
