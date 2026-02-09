(function(window, Dom, Router, AuthService, DeviceInfoService, Toast, Logger){
  function LoginPage(){
    var VERSION = 'v1.1';
    var CONTACT = 'Lumocast Digital Signage Pvt Ltd | Support@Cansignage.Com | +91 91523 98498';
    var BASE_URL = 'https://ds.iqtv.in/';

    var node = Dom.el('<section class="login-screen">\
      <div class="login-row">\
        <div class="login-logo-wrap">\
          <img class="login-logo" src="assets/images/appweblogo.png" alt="App logo" />\
        </div>\
        <h1 class="login-title">new device registration</h1>\
        <div id="qrcode" class="login-qr-card"></div>\
        <div class="login-form-wrap">\
          <form id="device-form" class="login-form" novalidate>\
            <label class="login-label" for="deviceCode">Device unique code</label>\
            <input id="deviceCode" class="login-input" placeholder="Ex. IQW000001" required pattern="^IQW[0-9]+$" autocomplete="off" tabindex="1" />\
            <div id="deviceHint" class="login-hint">Enter device unique code!</div>\
            <div id="deviceError" class="login-error" style="display:none;"></div>\
            <button id="submitBtn" class="login-submit-btn" type="submit" tabindex="2">Submit</button>\
          </form>\
        </div>\
        <p id="deviceInfo" class="login-device-info"></p>\
      </div>\
      <div class="overlay login-overlay" style="display:none;" id="alertOverlay">\
        <div class="card login-alert-card">\
          <span class="icon login-alert-icon">&#9888;</span>\
          <h1 class="title login-alert-title" id="alertTitle"></h1>\
          <p class="text login-alert-text" id="alertText"></p>\
          <span class="text login-alert-contact">' + CONTACT + '</span>\
        </div>\
      </div>\
    </section>');

    var form = node.querySelector('#device-form');
    var input = node.querySelector('#deviceCode');
    var submitBtn = node.querySelector('#submitBtn');
    var qrcodeEl = node.querySelector('#qrcode');
    var infoEl = node.querySelector('#deviceInfo');
    var overlay = node.querySelector('#alertOverlay');
    var alertTitle = node.querySelector('#alertTitle');
    var alertText = node.querySelector('#alertText');
    var errorEl = node.querySelector('#deviceError');

    var deviceUID = null;
    var checking = false;
    var interval = null;
    var isLoggedIn = false;
    var isSubmitted = false;
    var isExistedCalled = false;
    var lastState = null;
    var approvedToastShown = false;
    var routeCleanupHandler = null;
    var keydownHandler = null;
    var resizeHandler = null;
    var hasOverlay = false;

    function getCurrentRoute(){
      return (window.location.hash || '#').replace(/^#\/?/, '');
    }

    function getQrSize(){
      var deviceWidth = window.innerWidth;

      if (deviceWidth <= 1366) {
        return Math.floor(deviceWidth * 0.25);
      }
      if (deviceWidth <= 1920) {
        return 430;
      }
      if (deviceWidth <= 2560) {
        return 480;
      }
      return 520;
    }

    function setQR(uid){
      var qrSize;

      if (!qrcodeEl || !uid || typeof QRCode === 'undefined') return;

      qrSize = getQrSize();
      qrcodeEl.innerHTML = '';
      new QRCode(qrcodeEl, {
        text: BASE_URL + '#/iqworld/digitalsignage/device/registrationform/' + uid,
        width: qrSize,
        height: qrSize,
        correctLevel: QRCode.CorrectLevel.H
      });
      infoEl.textContent = uid + '\n' + VERSION;
    }

    function showPending(title, text){
      hasOverlay = true;
      overlay.style.display = 'flex';
      alertTitle.textContent = title;
      alertText.textContent = text;
      updateFormInteractivity();
    }

    function hidePending(){
      hasOverlay = false;
      overlay.style.display = 'none';
      updateFormInteractivity();
    }

    function setValidationError(msg){
      if (!msg) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
        input.classList.remove('invalid');
        return;
      }

      errorEl.style.display = 'block';
      errorEl.textContent = msg;
      input.classList.add('invalid');
    }

    function validateCode(value){
      if (!value) return 'Device unique code is required';
      if (!/^IQW[0-9]+$/i.test(value)) return 'Code must start with IQW followed by digits (Ex. IQW123)';
      return '';
    }

    function updateFormInteractivity(){
      var locked = hasOverlay || isLoggedIn;

      input.disabled = locked;
      submitBtn.disabled = locked || isSubmitted;
    }

    function stopPolling(){
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    function cleanupListeners(){
      if (routeCleanupHandler) {
        window.removeEventListener('hashchange', routeCleanupHandler);
        routeCleanupHandler = null;
      }
      if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
      }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }
    }

    function bindRouteCleanup(){
      routeCleanupHandler = function(){
        if (getCurrentRoute() !== 'login') {
          stopPolling();
          cleanupListeners();
        }
      };
      window.addEventListener('hashchange', routeCleanupHandler);
    }

    function getFocusable(){
      var all = Array.prototype.slice.call(
        node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      );

      return all.filter(function(el){
        return !el.disabled && el.offsetParent !== null;
      });
    }

    function focusInputForTyping(){
      var len = 0;
      if (input.disabled) return;

      input.focus();
      len = String(input.value || '').length;
      try {
        input.setSelectionRange(len, len);
      } catch (_) {}
    }

    function bindKeyboardNavigation(){
      keydownHandler = function(event){
        var active;
        var isRightOrDown;
        var isLeftOrUp;

        if (getCurrentRoute() !== 'login') return;

        isRightOrDown = (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.keyCode === 39 || event.keyCode === 40);
        isLeftOrUp = (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.keyCode === 37 || event.keyCode === 38);

        if (isRightOrDown) {
          if (!submitBtn.disabled) {
            submitBtn.focus();
          } else if (!input.disabled) {
            input.focus();
          }
          event.preventDefault();
          return;
        }

        if (isLeftOrUp) {
          if (!input.disabled) {
            focusInputForTyping();
          } else if (!submitBtn.disabled) {
            submitBtn.focus();
          }
          event.preventDefault();
          return;
        }

        if (event.key === 'Enter' || event.keyCode === 13) {
          active = document.activeElement;
          if (!active) return;

          if (active.tagName === 'INPUT') {
            event.preventDefault(); // do not submit when focus is on input
            return;
          }

          if (active.tagName === 'BUTTON' || active.getAttribute('role') === 'button') {
            active.click();
            event.preventDefault();
          }
        }
      };

      document.addEventListener('keydown', keydownHandler);
    }

    function checkDevice(){
      if (checking || !deviceUID) return;
      checking = true;

      AuthService.isExistedDevice(deviceUID).then(function(res){
        var stateKey = (!res || res.status !== 'success') ? 'error'
          : (res.client_status && res.device_status && !res.isexpired ? 'approved' : 'pending');

        if (stateKey !== lastState) {
          lastState = stateKey;
          if (stateKey === 'approved') {
            if (!approvedToastShown) {
              Toast.success('Device verified successfully!!');
              approvedToastShown = true;
            }
          } else if (stateKey === 'pending') {
            Toast.error('Device not approved or expired. Please contact admin.');
          } else {
            Toast.error((res && res.message) || 'Device verification failed!!');
          }
        }

        if (res && res.status === 'success') {
          sessionStorage.setItem('device', JSON.stringify(res));
          sessionStorage.setItem('username', res.username);
          isLoggedIn = true;
          updateFormInteractivity();

          if (res.client_status && res.device_status && !res.isexpired) {
            sessionStorage.setItem('isLogin', 'true');
            hidePending();
            stopPolling();
            Router.navigate('player');
          } else if (!res.client_status) {
            showPending('Approval Pending...!', 'Please wait until your profile is approved by admin.');
            sessionStorage.setItem('isLogin', 'true');
          } else if (!res.device_status) {
            showPending('Approval Pending...!', 'Please wait until your device is approved by admin.');
            sessionStorage.setItem('isLogin', 'true');
          } else if (res.isexpired) {
            showPending('Subscription Expired...!', 'Subscription expired. Please contact admin.');
            sessionStorage.setItem('isLogin', 'true');
          }
        } else {
          hidePending();
          isLoggedIn = false;
          updateFormInteractivity();
          sessionStorage.setItem('isLogin', 'false');
          if (!isExistedCalled && String(input.value || '').toUpperCase() === 'IQW000') {
            isExistedCalled = true;
          }
        }
      }).catch(function(err){
        Logger.error('Login', 'Device check failed', err);
        if (lastState !== 'network-error') {
          Toast.error('Server Not Responding!');
          lastState = 'network-error';
        }
      }).finally(function(){
        checking = false;
      });
    }

    function onSubmit(e){
      var code;
      var validationMsg;

      e.preventDefault();

      if (!navigator.onLine) {
        Toast.error('No internet connection. Please connect to network and try again.');
        return;
      }

      code = String(input.value || '').trim().toUpperCase();
      input.value = code;
      validationMsg = validateCode(code);
      setValidationError(validationMsg);

      if (validationMsg || !deviceUID) {
        Toast.info('Invalid form');
        return;
      }

      isSubmitted = true;
      updateFormInteractivity();

      AuthService.signup(code, deviceUID).then(function(res){
        if (res && res.status === 'Failed') {
          Toast.error(res.message || 'Registration failed');
        } else {
          localStorage.setItem('username', code);
          isExistedCalled = false;
          lastState = null;
          checkDevice();
        }
      }).catch(function(){
        Toast.error('Network error. Please check internet connection.');
      }).finally(function(){
        isSubmitted = false;
        updateFormInteractivity();
      });
    }

    function onInput(){
      input.value = String(input.value || '').toUpperCase();
      setValidationError(validateCode(input.value));
    }

    resizeHandler = function(){
      if (deviceUID) setQR(deviceUID);
    };

    bindRouteCleanup();
    bindKeyboardNavigation();
    window.addEventListener('resize', resizeHandler);

    form.addEventListener('submit', onSubmit);
    input.addEventListener('input', onInput);

    setValidationError('');
    input.value = (localStorage.getItem('rememberDevice') === 'true' ? (localStorage.getItem('username') || 'IQW000') : 'IQW000');
    updateFormInteractivity();
    setTimeout(function(){ focusInputForTyping(); }, 80);

    DeviceInfoService.init().then(function(uid){
      deviceUID = uid;
      setQR(uid);
      checkDevice();
    });
    DeviceInfoService.wait(function(uid){
      deviceUID = uid;
      setQR(uid);
    });

    interval = setInterval(checkDevice, 4000);
    setTimeout(checkDevice, 500);

    return node;
  }

  window.LoginPage = LoginPage;
})(window, Dom, Router, AuthService, DeviceInfoService, Toast, Logger);
