(function(window, Dom, Router, AuthService, DeviceInfoService, Toast, Logger, ContentPlayer, ScrollerBar, MenuSystem){
  function PlayerPage(){
    var device = JSON.parse(sessionStorage.getItem('device') || '{}');
    var node = Dom.el('<div class="player screen-container"></div>');
    var zoneWrap = Dom.el('<div class="grid drag-content"></div>');
    var noMediaWrap = Dom.el(
      '<div class="no-media-wrapper" style="display:none;">' +
        '<div class="no-media-card">' +
          '<div class="icon">&#128193;</div>' +
          '<div class="title">No Media Available...!</div>' +
          '<div class="subtitle">Please wait while your device receives media files.</div>' +
          '<div class="neon-loader"><div class="bar"></div></div>' +
        '</div>' +
      '</div>'
    );
    var statusBadge = Dom.el(
      '<div class="status-badge">' +
        '<img class="status-icon online" src="assets/images/ONLINE.png" alt="ONLINE" />' +
        '<img class="status-icon offline" src="assets/images/OFFLINE.png" alt="OFFLINE" style="display:none;" />' +
      '</div>'
    );

    var state = {
      status: navigator.onLine ? 'ONLINE' : 'OFFLINE',
      splitScreen: [],
      splitScreenList: [],
      zoneinfo: [],
      splitCurrentIndex: 0,
      zoneCompletionMap: {},
      scrollers: [],
      topScrollers: [],
      bottomScrollers: [],
      updatedTime: null,
      noMediaAvailable: false,
      wasNoMedia: false,
      redirecting: false
    };

    var activePlayers = [];
    var scrollerTop = null;
    var scrollerBottom = null;
    var syncInterval = null;
    var syncInFlight = false;
    var destroyed = false;

    node.appendChild(noMediaWrap);
    node.appendChild(zoneWrap);
    node.appendChild(statusBadge);

    bindNetworkListeners();
    bindKeyListener();
    bindRouteTeardown();
    init();

    function init(){
      device.isVertical = !!(device.orientation && device.orientation.indexOf('9:16') > -1);

      ensureDeviceUID().then(function(uid){
        if (destroyed) return;

        device.androidid = uid;
        runSyncCycle(true).then(function(ok){
          if (!ok || destroyed || state.redirecting) return;

          startSyncLoop();
          signinSilently();
        });
      }).catch(function(err){
        Logger.error('Player', 'Unable to resolve device ID', err);
        Toast.error('Unable to resolve device ID');
        Router.navigate('login');
      });
    }

    function bindNetworkListeners(){
      updateStatusUI();

      if (window.__playerOnlineHandler) {
        window.removeEventListener('online', window.__playerOnlineHandler);
      }
      if (window.__playerOfflineHandler) {
        window.removeEventListener('offline', window.__playerOfflineHandler);
      }

      window.__playerOnlineHandler = function(){
        state.status = 'ONLINE';
        updateStatusUI();
        renderScrollers();
      };

      window.__playerOfflineHandler = function(){
        state.status = 'OFFLINE';
        updateStatusUI();
        removeScrollers();
      };

      window.addEventListener('online', window.__playerOnlineHandler);
      window.addEventListener('offline', window.__playerOfflineHandler);
    }

    function bindRouteTeardown(){
      if (window.__playerRouteCleanupHandler) {
        window.removeEventListener('hashchange', window.__playerRouteCleanupHandler);
      }

      window.__playerRouteCleanupHandler = function(){
        var current = (window.location.hash || '#').replace(/^#\/?/, '');
        if (current !== 'player') {
          teardown();
          window.removeEventListener('hashchange', window.__playerRouteCleanupHandler);
          window.__playerRouteCleanupHandler = null;
        }
      };

      window.addEventListener('hashchange', window.__playerRouteCleanupHandler);
    }

    function updateStatusUI(){
      var onlineEl = statusBadge.querySelector('.status-icon.online');
      var offlineEl = statusBadge.querySelector('.status-icon.offline');
      var isOnline = state.status === 'ONLINE';

      onlineEl.style.display = isOnline ? 'block' : 'none';
      offlineEl.style.display = isOnline ? 'none' : 'block';
    }

    function ensureDeviceUID(){
      if (device.androidid) return Promise.resolve(device.androidid);

      return DeviceInfoService.init().then(function(uid){
        device.androidid = uid;
        return uid;
      });
    }

    function signinSilently(){
      if (!device.username || !device.password) return;
      if (AuthService.getToken && AuthService.getToken()) return;

      AuthService.signin({
        username: device.username,
        password: device.password
      }).then(function(res){
        if (res && res.accessToken) {
          AuthService.saveToken(res.accessToken);
        }
      }).catch(function(err){
        Logger.warn('Player', 'Silent signin failed', err);
      });
    }

    function verifyDevice(uid){
      if (state.redirecting || destroyed) return Promise.resolve(false);

      return AuthService.isExistedDevice(uid).then(function(res){
        if (destroyed) return false;

        if (res && res.status === 'success' && res.client_status && res.device_status && !res.isexpired) {
          var preservedUid = uid;
          device = mergeDevice(device, res);
          device.androidid = preservedUid;
          device.isVertical = !!(device.orientation && device.orientation.indexOf('9:16') > -1);
          sessionStorage.setItem('device', JSON.stringify(device));
          return true;
        }

        handleInvalidDevice();
        return false;
      }).catch(function(err){
        Logger.error('Player', 'Device check failed', err);
        handleInvalidDevice();
        return false;
      });
    }

    function mergeDevice(base, next){
      var merged = {};
      var k;

      for (k in base) {
        if (Object.prototype.hasOwnProperty.call(base, k)) merged[k] = base[k];
      }
      for (k in next) {
        if (Object.prototype.hasOwnProperty.call(next, k)) merged[k] = next[k];
      }

      return merged;
    }

    function handleInvalidDevice(){
      if (state.redirecting) return;

      state.redirecting = true;
      sessionStorage.removeItem('device');
      clearIntervals();
      teardownPlayers();
      removeScrollers();
      Toast.error('Device not approved or expired. Please contact admin.');
      Router.navigate('login');
    }

    function normalizeServerDefault(res){
      var layoutList;

      if (!res || res.media_type !== 'default' || !res.layout_list) return;

      layoutList = res.layout_list;

      layoutList.forEach(function(layout){
        (layout.zonelist || []).forEach(function(zone){
          zone.media_list = (zone.media_list || []).map(function(media, idx){
            var next = {};
            var key;
            for (key in media) {
              if (Object.prototype.hasOwnProperty.call(media, key)) next[key] = media[key];
            }
            next.Mediafile_id = idx + 1;
            next.Order_id = idx;
            return next;
          });
        });
      });
    }

    function deepCopy(obj){
      return JSON.parse(JSON.stringify(obj));
    }

    function checkNoMedia(layoutList){
      var allZones = [];

      if (!layoutList || !layoutList.length) return true;

      layoutList.forEach(function(layout){
        if (layout && layout.zonelist && layout.zonelist.length) {
          allZones = allZones.concat(layout.zonelist);
        }
      });

      return !allZones.some(function(zone){
        return Array.isArray(zone.media_list) && zone.media_list.length > 0;
      });
    }

    function setNoMedia(flag){
      state.noMediaAvailable = !!flag;
      noMediaWrap.style.display = state.noMediaAvailable ? 'flex' : 'none';

      if (state.noMediaAvailable) {
        zoneWrap.innerHTML = '';
      }
    }

    function loadMediaFiles(){
      return AuthService.getMediafiles(device).then(function(res){
        var newLayout;
        var noMedia;

        if (destroyed || state.redirecting) return;

        normalizeServerDefault(res);

        newLayout = deepCopy((res && res.layout_list) || []);
        noMedia = checkNoMedia(newLayout);

        state.updatedTime = res && res.updated_time;
        state.splitScreen = deepCopy(newLayout);
        state.splitScreenList = deepCopy(newLayout);
        state.scrollers = (res && res.scrollerList) || [];
        state.topScrollers = state.scrollers.filter(function(s){ return s.type === 'TOP'; });
        state.bottomScrollers = state.scrollers.filter(function(s){ return s.type === 'BOTTOM'; });
        state.splitCurrentIndex = 0;
        state.zoneCompletionMap = {};

        if (noMedia) {
          state.wasNoMedia = true;
          setNoMedia(true);
          renderScrollers(true);
          return;
        }

        setNoMedia(false);
        showCurrentSlide();
        renderScrollers(true);
      }).catch(function(err){
        Logger.error('Player', 'Media fetch failed', err);
      });
    }

    function getScrollerSignature(list){
      return (list || [])
        .map(function(s){
          return JSON.stringify({
            id: s.id || '',
            msg: s.message || '',
            font: s.fontname || '',
            folder: s.font_folder || '',
            speed: s.scrlspeed || '',
            type: s.type || '',
            color: s.fncolor || '',
            bg: s.bgcolor || '',
            size: s.fnsize || '',
            logo: s.logo || ''
          });
        })
        .join('|');
    }

    function checkForUpdates(){
      return AuthService.getMediafiles(device).then(function(res){
        var newLayout;
        var newScrollers;
        var noMedia;
        var oldSig;
        var newSig;
        var shouldRefresh;

        if (destroyed || state.redirecting) return;

        normalizeServerDefault(res);

        newLayout = (res && res.layout_list) || [];
        newScrollers = (res && res.scrollerList) || [];
        noMedia = checkNoMedia(newLayout);

        oldSig = getScrollerSignature(state.scrollers);
        newSig = getScrollerSignature(newScrollers);

        if (oldSig !== newSig) {
          state.scrollers = newScrollers;
          state.topScrollers = newScrollers.filter(function(s){ return s.type === 'TOP'; });
          state.bottomScrollers = newScrollers.filter(function(s){ return s.type === 'BOTTOM'; });
          renderScrollers(true);
        }

        if (noMedia) {
          state.wasNoMedia = true;
          state.splitScreen = [];
          state.splitScreenList = [];
          state.zoneinfo = [];
          state.zoneCompletionMap = {};
          setNoMedia(true);
          teardownPlayers();
          renderScrollers(true);
          return;
        }

        setNoMedia(false);

        shouldRefresh = hasLayoutChanged(state.splitScreen, newLayout) || state.updatedTime !== (res && res.updated_time);

        if (state.wasNoMedia) {
          state.wasNoMedia = false;
          shouldRefresh = true;
        }

        if (!shouldRefresh) return;

        state.splitScreen = deepCopy(newLayout);
        state.splitScreenList = deepCopy(newLayout);
        state.updatedTime = res && res.updated_time;
        state.splitCurrentIndex = 0;
        state.zoneCompletionMap = {};

        showCurrentSlide();
      }).catch(function(){
        // keep current playback on transient update failures
      });
    }

    function runSyncCycle(initialLoad){
      var shouldDoInitialLoad;

      if (destroyed || state.redirecting || !device || !device.androidid) {
        return Promise.resolve(false);
      }
      if (syncInFlight) {
        return Promise.resolve(false);
      }

      syncInFlight = true;

      return verifyDevice(device.androidid).then(function(ok){
        if (!ok || destroyed || state.redirecting) return false;

        // Server default payload often keeps updated_time as null.
        // After first successful media bootstrap, always switch to delta updates.
        shouldDoInitialLoad = !!initialLoad || (!state.updatedTime && !state.splitScreenList.length);

        if (shouldDoInitialLoad) {
          return loadMediaFiles().then(function(){ return true; });
        }

        return checkForUpdates().then(function(){ return true; });
      }).catch(function(err){
        Logger.error('Player', 'Sync cycle failed', err);
        return false;
      }).finally(function(){
        syncInFlight = false;
      });
    }

    function hasLayoutChanged(oldLayout, newLayout){
      var oldSet = toMediaSet(oldLayout || []);
      var newSet = toMediaSet(newLayout || []);
      var key;

      if (oldSet.size !== newSet.size) return true;

      for (key in oldSet.map) {
        if (!newSet.map[key]) return true;
      }

      return false;
    }

    function toMediaSet(layouts){
      var map = {};

      (layouts || []).forEach(function(layout){
        (layout.zonelist || []).forEach(function(zone){
          (zone.media_list || []).forEach(function(media){
            var k = String(media.Mediafile_id || '') + '|' + String(media.Url || '');
            map[k] = true;
          });
        });
      });

      return { map: map, size: Object.keys(map).length };
    }

    function showCurrentSlide(){
      var layout;
      var zones;

      teardownPlayers();
      zoneWrap.innerHTML = '';
      state.zoneCompletionMap = {};

      if (!state.splitScreenList || !state.splitScreenList.length) return;

      layout = state.splitScreenList[state.splitCurrentIndex] || {};
      zones = layout.zonelist || [];

      if (!zones.length) {
        nextSlideAndShow();
        return;
      }

      state.zoneinfo = zones;
      buildGrid(layout, zones);
    }

    function buildGrid(layout, zones){
      var maxCol = Number(layout.cols || 1);
      var maxRow = Number(layout.rows || 1);

      zones.forEach(function(z){
        var right = Number(z.x || 0) + Number(z.width || 1);
        var bottom = Number(z.y || 0) + Number(z.height || 1);
        if (right > maxCol) maxCol = right;
        if (bottom > maxRow) maxRow = bottom;
      });

      zoneWrap.style.gridTemplateColumns = 'repeat(' + maxCol + ', 1fr)';
      zoneWrap.style.gridTemplateRows = 'repeat(' + maxRow + ', 1fr)';

      zones.forEach(function(zone, index){
        var zoneId = (zone.id !== undefined && zone.id !== null) ? zone.id : index;
        var z = Dom.el('<div class="zone grid-item"></div>');

        z.style.gridColumn = (Number(zone.x || 0) + 1) + ' / span ' + Number(zone.width || 1);
        z.style.gridRow = (Number(zone.y || 0) + 1) + ' / span ' + Number(zone.height || 1);

        zoneWrap.appendChild(z);

        activePlayers.push(new ContentPlayer({
          media: zone.media_list || [],
          zoneId: zoneId,
          zoneDuration: zone.zone_duration,
          layoutZones: zones,
          splitScreenList: state.splitScreenList,
          container: z,
          onZoneComplete: onZoneComplete
        }));
      });
    }

    function teardownPlayers(){
      activePlayers.forEach(function(player){
        if (player && player.destroy) player.destroy();
      });
      activePlayers = [];
    }

    function nextSlideAndShow(){
      if (!state.splitScreenList || !state.splitScreenList.length) return;

      state.splitCurrentIndex = (state.splitCurrentIndex + 1) % state.splitScreenList.length;
      showCurrentSlide();
    }

    function onZoneComplete(zoneId){
      var allCompleted;

      state.zoneCompletionMap[zoneId] = true;
      allCompleted = state.zoneinfo.every(function(zone, idx){
        var zid = (zone.id !== undefined && zone.id !== null) ? zone.id : idx;
        return !!state.zoneCompletionMap[zid];
      });

      if (allCompleted && state.splitScreenList.length > 1) {
        state.zoneCompletionMap = {};
        nextSlideAndShow();
      }
    }

    function renderScrollers(force){
      if (state.status !== 'ONLINE') {
        removeScrollers();
        return;
      }

      if (!force && scrollerTop && scrollerBottom) return;

      removeScrollers();

      if (state.topScrollers.length) {
        scrollerTop = new ScrollerBar({ items: state.topScrollers, position: 'TOP' });
        scrollerTop.node.classList.add('ticker-bar', 'top-ticker');
        node.appendChild(scrollerTop.node);
      }

      if (state.bottomScrollers.length) {
        scrollerBottom = new ScrollerBar({ items: state.bottomScrollers, position: 'BOTTOM' });
        scrollerBottom.node.classList.add('ticker-bar', 'bottom-ticker');
        node.appendChild(scrollerBottom.node);
      }
    }

    function removeScrollers(){
      if (scrollerTop) {
        if (scrollerTop.destroy) scrollerTop.destroy();
        if (scrollerTop.node && scrollerTop.node.parentNode) scrollerTop.node.parentNode.removeChild(scrollerTop.node);
        scrollerTop = null;
      }

      if (scrollerBottom) {
        if (scrollerBottom.destroy) scrollerBottom.destroy();
        if (scrollerBottom.node && scrollerBottom.node.parentNode) scrollerBottom.node.parentNode.removeChild(scrollerBottom.node);
        scrollerBottom = null;
      }
    }

    function openSettings(){
      AppShell.modalWrap(new MenuSystem(device));
    }

    function bindKeyListener(){
      var lastEnter = 0;

      if (window.__playerKeydownHandler) {
        window.removeEventListener('keydown', window.__playerKeydownHandler);
      }

      window.__playerKeydownHandler = function(ev){
        var now;
        var hasPopup = !!document.querySelector('.dialog-backdrop, .user-manual-overlay');

        if (hasPopup) {
          return;
        }

        if (ev.keyCode === 13) {
          now = Date.now();
          if (now - lastEnter < 2200) {
            openSettings();
          }
          lastEnter = now;
        }

        if (ev.keyCode === 10009 || ev.key === 'Escape') {
          AppShell.confirm('Are you sure ?', 'Do you want to exit the application?', function(){
            if (window.webOS && window.webOS.platformBack) {
              window.webOS.platformBack();
            } else {
              window.close();
            }
          });
        }
      };

      window.addEventListener('keydown', window.__playerKeydownHandler);
    }

    function startSyncLoop(){
      if (syncInterval || destroyed) return;

      syncInterval = setInterval(function(){
        if (destroyed || state.redirecting) return;
        runSyncCycle(false);
      }, 5000);
    }

    function clearIntervals(){
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    }

    function teardown(){
      if (destroyed) return;
      destroyed = true;

      clearIntervals();
      teardownPlayers();
      removeScrollers();

      if (window.__playerKeydownHandler) {
        window.removeEventListener('keydown', window.__playerKeydownHandler);
        window.__playerKeydownHandler = null;
      }

      if (window.__playerOnlineHandler) {
        window.removeEventListener('online', window.__playerOnlineHandler);
        window.__playerOnlineHandler = null;
      }

      if (window.__playerOfflineHandler) {
        window.removeEventListener('offline', window.__playerOfflineHandler);
        window.__playerOfflineHandler = null;
      }
    }

    return node;
  }

  window.PlayerPage = PlayerPage;
})(window, Dom, Router, AuthService, DeviceInfoService, Toast, Logger, ContentPlayer, ScrollerBar, MenuSystem);
