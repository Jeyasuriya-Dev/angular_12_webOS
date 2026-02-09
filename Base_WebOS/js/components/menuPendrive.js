// Pendrive settings dialog (Copy / Clear & copy / Image delay)
(function (window, Dom, SplitScreenService) {
  function MenuPendrive() {
    var isCopy = localStorage.getItem('isCopyContent') === 'true';
    var isClear = localStorage.getItem('isClearCopyContent') === 'true';
    var delay = parseInt(localStorage.getItem('imageDelay') || '10', 10);

    var node = Dom.el(
      '<div class="dialog">' +
        '<h2>Pendrive Settings</h2>' +
        '<label style="display:block;margin:8px 0;"><input type="checkbox" id="copyChk"> Copy Content</label>' +
        '<label style="display:block;margin:8px 0;"><input type="checkbox" id="clearChk"> Clear & Copy Content</label>' +
        '<div style="margin:10px 0;">Image Delay (sec): ' +
          '<button id="dec">-</button> <span id="delayVal"></span> <button id="inc">+</button>' +
        '</div>' +
        '<div class="actions"><button class="btn secondary" id="closeBtn">Close</button></div>' +
      '</div>'
    );

    var copyChk = node.querySelector('#copyChk');
    var clearChk = node.querySelector('#clearChk');
    var delayVal = node.querySelector('#delayVal');

    copyChk.checked = isCopy;
    clearChk.checked = isClear;
    delayVal.textContent = delay;

    function save() {
      localStorage.setItem('isCopyContent', isCopy);
      localStorage.setItem('isClearCopyContent', isClear);
      localStorage.setItem('imageDelay', delay);
      if (isCopy || isClear) SplitScreenService.triggerPendriveSettings();
    }

    copyChk.onchange = function () {
      isCopy = copyChk.checked;
      if (isCopy) { isClear = false; clearChk.checked = false; }
      save();
    };

    clearChk.onchange = function () {
      isClear = clearChk.checked;
      if (isClear) { isCopy = false; copyChk.checked = false; }
      save();
    };

    node.querySelector('#inc').onclick = function () { delay++; delayVal.textContent = delay; save(); };
    node.querySelector('#dec').onclick = function () { delay = Math.max(0, delay - 1); delayVal.textContent = delay; save(); };
    node.querySelector('#closeBtn').onclick = function () {
      var p = node.parentNode && node.parentNode.parentNode;
      if (p) p.remove();
    };

    return node;
  }
  window.MenuPendrive = MenuPendrive;
})(window, Dom, SplitScreenService);
