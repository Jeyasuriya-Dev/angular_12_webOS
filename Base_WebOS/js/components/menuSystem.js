// Device settings dialog (mirrors Angular menu2)
(function (window, Dom, Toast, AuthService, FilesystemService, Router, AppShell) {
  function MenuSystem(device) {
    var storageInfo = null;
    var isLoggingOut = false;
    var keydownHandler = null;
    var destroyed = false;

    var options = [
      {
        type: 'devcieinfo',
        title: 'Device details',
        description: 'View detailed information about the connected device.',
        icon: './assets/images/info.png'
      },
      {
        type: 'userManual',
        title: 'User Manual',
        description: 'Open the user manual to troubleshoot or learn features.',
        icon: './assets/images/information.png'
      },
      {
        type: 'modeConfiguration',
        title: 'Mode Configuration',
        description: 'Single (online) mode is active for webOS.',
        icon: './assets/images/cogwheel.png'
      },
      {
        type: 'logout',
        title: 'Logout',
        description: 'Sign out and optionally remember this device ID.',
        icon: './assets/images/logout.png'
      }
    ];

    var node = Dom.el(
      '<div class="dialog device-menu" data-manages-keys="true">' +
        '<h2>Device Settings</h2>' +
        '<div class="device-menu-grid"></div>' +
        '<div class="actions device-menu-actions"><button class="btn settings-close-btn" data-act="close" data-focus-initial="true">Close</button></div>' +
      '</div>'
    );

    var grid = node.querySelector('.device-menu-grid');
    var closeBtn = node.querySelector('[data-act="close"]');
    options.forEach(function (opt) {
      var card = Dom.el(
        '<button class="device-menu-card" data-type="' + opt.type + '">' +
          '<img src="' + opt.icon + '" alt="' + (opt.title || '') + '" />' +
          '<div class="card-title">' + (opt.title || '') + '</div>' +
        '</button>'
      );
      grid.appendChild(card);
    });

    node.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-act') === 'close') {
        close();
        return;
      }
      var btn = e.target.closest('[data-type]');
      if (!btn) return;
      var type = btn.getAttribute('data-type');
      switch (type) {
        case 'devcieinfo': return openDeviceInfo();
        case 'userManual': return openUserManual();
        case 'modeConfiguration': return openModeConfiguration();
        case 'logout': return openLogoutConfirm();
        default: return;
      }
    });

    bindKeyboardNavigation();
    setTimeout(function () {
      if (closeBtn && !closeBtn.disabled) {
        closeBtn.focus();
      }
    }, 0);

    // ---- Device info ----
    function openDeviceInfo() {
      FilesystemService.getStorageInfo()
        .then(function (info) { storageInfo = info; })
        .catch(function () { storageInfo = null; })
        .finally(showDeviceInfo);
    }

    function showDeviceInfo() {
      var details = device || {};
      var registeredId = details.username || details.deviceid || details.device_id || sessionStorage.getItem('username') || localStorage.getItem('username');
      var duid = registeredId || details.androidid || details.deviceId || details.serialNumber || localStorage.getItem('fallback_duid');
      var orientation = details.orientation === '9:16' ? 'Vertical' : 'Horizontal';
      var status = details.device_status ? 'Active' : 'Inactive';
      var apkVersion = (details.apkVersion && details.apkVersion !== 'null') ? details.apkVersion : (details.version || 'v1.0.3');
      var storage = storageInfo || {};

      var infoHtml =
        renderRow('Model', details.modelname) +
        renderRow('DUID', duid) +
        renderRow('Customer name', joinLabel(details.clientname, details.client_id)) +
        renderRow('Screen', orientation) +
        renderRow('Version', details.version) +
        renderRow('State', joinLabel(details.state_name, details.state_id)) +
        renderRow('District', joinLabel(details.district_name, details.district_id)) +
        renderRow('City', joinLabel(details.city_name, details.city_id)) +
        renderRow('Location', joinLabel(details.location, details.locationid)) +
        renderRow('IPK Version', apkVersion) +
        renderRow('Device Status', status) +
        (storage.usedGB ? renderRow('Device Storage', storage.usedGB + ' / ' + storage.totalGB) : '');

      var modal = createBackdrop();
      var dialog = Dom.el(
        '<div class="dialog device-info-card">' +
          '<h2>Device Info</h2>' +
          '<div class="device-details">' + infoHtml + '</div>' +
          '<div class="actions">' +
            '<button class="btn" data-act="close" data-focus-initial="true">Close</button>' +
          '</div>' +
        '</div>'
      );

      dialog.addEventListener('click', function (ev) {
        var act = ev.target.getAttribute('data-act');
        if (!act) return;
        if (act === 'close') { modal.remove(); }
      });

      modal.appendChild(dialog);
      document.body.appendChild(modal);
    }

    function renderRow(label, value) {
      var val = (value === undefined || value === null || value === '') ? 'Not available' : value;
      return '<div class="info-row"><span class="info-label">' + label + ':</span><span class="info-value">' + val + '</span></div>';
    }

    function joinLabel(main, sub) {
      if (!main && !sub) return '';
      if (main && sub) return main + ' (' + sub + ')';
      return main || sub || '';
    }

    // ---- User manual ----
    function openUserManual() {
      var manual = window.UserManualComponent();
      document.body.appendChild(manual);
    }

    // ---- Mode configuration ----
    function openModeConfiguration() {
      var modal = createBackdrop();
      var dialog = Dom.el(
        '<div class="dialog mode-dialog">' +
          '<h2>Mode Configuration</h2>' +
          '<div style="padding:12px;">Online streaming mode is fixed for webOS. Pendrive/offline modes are disabled.</div>' +
          '<div class="actions"><button class="btn" data-act="close" data-focus-initial="true">Close</button></div>' +
        '</div>'
      );

      dialog.addEventListener('click', function (ev) {
        if (ev.target.getAttribute('data-act') === 'close') {
          modal.remove();
        }
      });

      modal.appendChild(dialog);
      document.body.appendChild(modal);
    }

    // ---- Logout ----
    function openLogoutConfirm() {
      var modal = createBackdrop();
      var dialog = Dom.el(
        '<div class="dialog logout-dialog">' +
          '<h2>Are you sure you want to logout?</h2>' +
          '<div class="actions">' +
            '<button class="btn secondary" data-act="close" data-focus-initial="true">Close</button>' +
            '<button class="btn" data-act="yes">Yes, Logout</button>' +
          '</div>' +
        '</div>'
      );

      dialog.addEventListener('click', function (ev) {
        var act = ev.target.getAttribute('data-act');
        if (!act) return;
        if (act === 'close') { modal.remove(); }
        if (act === 'yes') { modal.remove(); openLogoutRemember(); }
      });

      modal.appendChild(dialog);
      document.body.appendChild(modal);
    }

    function openLogoutRemember() {
      var modal = createBackdrop();
      var dialog = Dom.el(
        '<div class="dialog logout-dialog">' +
          '<h2>Do you want to save device ID?</h2>' +
          '<div class="actions">' +
            '<button class="btn secondary" data-act="reset" data-focus-initial="true">Reset</button>' +
            '<button class="btn" data-act="remember">Remember</button>' +
          '</div>' +
        '</div>'
      );

      dialog.addEventListener('click', function (ev) {
        var act = ev.target.getAttribute('data-act');
        if (!act) return;
        if (act === 'reset') { modal.remove(); performLogout(false); }
        if (act === 'remember') { modal.remove(); performLogout(true); }
      });

      modal.appendChild(dialog);
      document.body.appendChild(modal);
    }

    function performLogout(remember) {
      if (isLoggingOut) return;
      isLoggingOut = true;
      var loader = showLoader();

      if (remember) {
        var rememberedId = (device && device.username) || sessionStorage.getItem('username');
        if (rememberedId) {
          localStorage.setItem('rememberDevice', 'true');
          localStorage.setItem('username', rememberedId);
        } else {
          localStorage.removeItem('rememberDevice');
          localStorage.removeItem('username');
        }
      } else {
        localStorage.removeItem('rememberDevice');
        localStorage.removeItem('username');
      }

      AuthService.logout({ isConfirmed: remember, isDenied: !remember })
        .then(function (res) {
          Toast.success((res && res.message) || 'Logged out successfully');
          sessionStorage.removeItem('device');
          AuthService.clearToken && AuthService.clearToken();
          close();
          Router.navigate('login');
        })
        .catch(function (err) {
          Toast.error('Logout failed');
          console.error(err);
        })
        .finally(function () {
          hideLoader(loader);
          isLoggingOut = false;
        });
    }

    // ---- Helpers ----
    function showLoader() {
      var overlay = Dom.el('<div class="logout-loader"><div class="spinner"></div></div>');
      document.body.appendChild(overlay);
      return overlay;
    }

    function hideLoader(node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }

    function createBackdrop() {
      var modal = Dom.el('<div class="dialog-backdrop"></div>');
      modal.addEventListener('click', function (ev) { if (ev.target === modal) modal.remove(); });
      if (AppShell && typeof AppShell.enableModalKeys === 'function') {
        AppShell.enableModalKeys(modal, {
          onClose: function () {
            if (modal && modal.parentNode) {
              modal.parentNode.removeChild(modal);
            }
          }
        });
      }
      return modal;
    }

    function getNavItems() {
      return Array.prototype.slice.call(
        node.querySelectorAll('[data-type], [data-act="close"]')
      ).filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
    }

    function focusNavItem(delta) {
      var items = getNavItems();
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

    function isTopMostDialog() {
      var backdrops = document.querySelectorAll('.dialog-backdrop');
      if (!backdrops.length) return false;
      return backdrops[backdrops.length - 1] === node.parentNode;
    }

    function bindKeyboardNavigation() {
      keydownHandler = function (ev) {
        var code = ev.keyCode;
        var key = ev.key;
        var active = document.activeElement;

        if (!node.parentNode) {
          destroy();
          return;
        }
        if (!isTopMostDialog()) return;

        if (code === 10009 || key === 'Escape') {
          close();
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }

        if (key === 'ArrowRight' || key === 'ArrowDown' || code === 39 || code === 40) {
          focusNavItem(1);
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }

        if (key === 'ArrowLeft' || key === 'ArrowUp' || code === 37 || code === 38) {
          focusNavItem(-1);
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }

        if ((key === 'Enter' || code === 13) && active && node.contains(active)) {
          active.click();
          ev.preventDefault();
          ev.stopPropagation();
        }
      };

      document.addEventListener('keydown', keydownHandler, true);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;

      if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler, true);
        keydownHandler = null;
      }
    }

    function close() {
      var backdrop = node.parentNode;
      destroy();
      if (backdrop && backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    }

    node.destroy = destroy;
    return node;
  }

  window.MenuSystem = MenuSystem;
})(window, Dom, Toast, AuthService, FilesystemService, Router, AppShell);
