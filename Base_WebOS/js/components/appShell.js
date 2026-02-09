(function(window, Dom){
  var root = document.getElementById('app');

  function isTopMostBackdrop(backdrop){
    var list = document.querySelectorAll('.dialog-backdrop');
    if (!list || !list.length) return false;
    return list[list.length - 1] === backdrop;
  }

  function getFocusable(container){
    return Array.prototype.slice.call(
      container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function(el){
      return !!el && !el.disabled && el.offsetParent !== null;
    });
  }

  function focusInitial(container){
    var focusTarget = container.querySelector('[data-focus-initial]') ||
      container.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    }
  }

  function focusByStep(container, delta){
    var items = getFocusable(container);
    var current;
    var index;
    var next;

    if (!items.length) return;
    current = document.activeElement;
    index = items.indexOf(current);
    if (index < 0) {
      items[0].focus();
      return;
    }
    next = (index + delta + items.length) % items.length;
    items[next].focus();
  }

  function enableModalKeys(backdrop, opts){
    var options = opts || {};
    var onClose = typeof options.onClose === 'function'
      ? options.onClose
      : function(){ if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    var disableArrows = !!options.disableArrows;
    var keydownHandler;

    function cleanup(){
      if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler, true);
        keydownHandler = null;
      }
    }

    keydownHandler = function(ev){
      var key = ev.key;
      var code = ev.keyCode;
      var active = document.activeElement;
      var isForward;
      var isBackward;

      if (!backdrop || !backdrop.parentNode) {
        cleanup();
        return;
      }
      if (!isTopMostBackdrop(backdrop)) return;

      if (code === 10009 || key === 'Escape') {
        onClose();
        cleanup();
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }

      isForward = !disableArrows && (
        key === 'ArrowRight' || key === 'ArrowDown' || code === 39 || code === 40 || (key === 'Tab' && !ev.shiftKey)
      );
      isBackward = !disableArrows && (
        key === 'ArrowLeft' || key === 'ArrowUp' || code === 37 || code === 38 || (key === 'Tab' && !!ev.shiftKey)
      );

      if (isForward) {
        focusByStep(backdrop, 1);
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }

      if (isBackward) {
        focusByStep(backdrop, -1);
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }

      if ((key === 'Enter' || code === 13) && active && backdrop.contains(active)) {
        if (
          typeof active.click === 'function' &&
          (
            active.tagName === 'BUTTON' ||
            active.tagName === 'A' ||
            active.getAttribute('data-act') !== null ||
            active.getAttribute('data-type') !== null ||
            active.type === 'button' ||
            active.type === 'submit' ||
            active.type === 'checkbox'
          )
        ) {
          active.click();
          ev.preventDefault();
        }
        ev.stopPropagation();
      }
    };

    document.addEventListener('keydown', keydownHandler, true);

    setTimeout(function(){
      if (backdrop && backdrop.parentNode) {
        focusInitial(backdrop);
      }
    }, 0);

    if (backdrop && typeof backdrop.remove === 'function' && !backdrop.__removePatchedForKeys) {
      var nativeRemove = backdrop.remove;
      backdrop.remove = function(){
        cleanup();
        return nativeRemove.call(backdrop);
      };
      backdrop.__removePatchedForKeys = true;
    }

    backdrop.__modalKeyCleanup = cleanup;
    return cleanup;
  }

  var shell = {
    setView: function(node){ root.innerHTML=''; if(node) root.appendChild(node); },
    confirm: function(title, message, onOk){
      var backdrop = Dom.el('<div class="dialog-backdrop"><div class="dialog"><h2>'+title+'</h2><div>'+message+'</div><div class="actions"><button class="btn secondary" data-act="no" data-focus-initial="true">Close</button><button class="btn" data-act="yes">Yes</button></div></div></div>');
      var cleanup = null;

      function closeConfirm(){
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
        if (backdrop && backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }

      backdrop.addEventListener('click', function(e){
        var act = e.target.getAttribute('data-act');
        if (!act) return;
        if (act === 'yes' && onOk) onOk();
        closeConfirm();
      });

      document.body.appendChild(backdrop);
      cleanup = enableModalKeys(backdrop, { onClose: closeConfirm });
    },
    modalWrap: function(content){
      var backdrop = Dom.el('<div class="dialog-backdrop"></div>');
      var cleanup = null;
      var managesKeys = !!(content && content.getAttribute && content.getAttribute('data-manages-keys') === 'true');

      function removeWrap(){
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
        if (content && typeof content.destroy === 'function') {
          content.destroy();
        }
        if (backdrop && backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }

      backdrop.appendChild(content);
      backdrop.addEventListener('click', function(e){ if(e.target===backdrop) removeWrap(); });
      document.body.appendChild(backdrop);

      if (managesKeys) {
        setTimeout(function(){
          if (backdrop && backdrop.parentNode) {
            focusInitial(backdrop);
          }
        }, 0);
      } else {
        cleanup = enableModalKeys(backdrop, { onClose: removeWrap });
      }

      return backdrop;
    },
    enableModalKeys: enableModalKeys,
    focusInitial: focusInitial
  };
  window.AppShell = shell;

  // Global back key fallback (outside player-specific handlers)
  function showExitConfirm(){
    if (window.__appShellExitDialogOpen) return;
    window.__appShellExitDialogOpen = true;

    var backdrop = Dom.el('<div class="dialog-backdrop"></div>');
    var dialog = Dom.el(
      '<div class="dialog logout-dialog">' +
        '<h2>Are you sure you want to exit?</h2>' +
        '<div class="actions">' +
          '<button class="btn secondary" data-act="no" data-focus-initial="true">No</button>' +
          '<button class="btn" data-act="yes">Exit</button>' +
        '</div>' +
      '</div>'
    );

    function cleanup(){
      window.__appShellExitDialogOpen = false;
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    dialog.addEventListener('click', function(e){
      var act = e.target.getAttribute('data-act');
      if (!act) return;
      if (act === 'yes') {
        if (window.webOS && typeof window.webOS.platformBack === 'function') {
          window.webOS.platformBack();
        } else {
          window.close();
        }
      }
      cleanup();
    });

    backdrop.appendChild(dialog);
    backdrop.addEventListener('click', function(e){ if (e.target === backdrop) cleanup(); });
    document.body.appendChild(backdrop);
    enableModalKeys(backdrop, { onClose: cleanup });
  }

  if (!window.__appShellBackHandler) {
    window.__appShellBackHandler = function(ev){
      var code = ev.keyCode;
      var key = ev.key;
      var backdrops = document.querySelectorAll('.dialog-backdrop');
      var hasBackdrop = !!backdrops.length;
      if (ev.defaultPrevented) return;
      if (code === 10009 || code === 461 || key === 'Escape') {
        if (hasBackdrop) {
          var top = backdrops[backdrops.length - 1];
          if (top && top.parentNode) {
            top.parentNode.removeChild(top);
          }
        } else {
          showExitConfirm();
        }
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    window.addEventListener('keydown', window.__appShellBackHandler, true);
  }
})(window, Dom);
