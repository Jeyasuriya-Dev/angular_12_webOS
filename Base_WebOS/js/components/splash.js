(function(window, Dom, Router, AppShell, Logger, AuthService, DeviceInfoService){
  var splashVerifyPromise = null;

  function runSplashVerification(){
    if (splashVerifyPromise) return splashVerifyPromise;

    splashVerifyPromise = DeviceInfoService.init().then(function(uid){
      if (!uid) {
        return { verified: false };
      }

      return AuthService.isExistedDevice(uid).then(function(res){
        var isSuccess = !!(res && res.status === 'success');

        if (isSuccess) {
          sessionStorage.setItem('device', JSON.stringify(res));
          if (res.username) {
            sessionStorage.setItem('username', res.username);
          }
        }

        return { verified: isSuccess };
      });
    }).catch(function(err){
      Logger.warn('Splash', 'Silent verification failed', err);
      return { verified: false };
    });

    return splashVerifyPromise;
  }

  function Splash(){
    var node = Dom.el('<section class="splash"><video id="launchervideo" autoplay muted></video></section>');
    var video = node.querySelector('video');
    var splashEnded = false;
    var finished = false;
    var verifyResult = null;
    var fallbackTimer = null;

    function pickOrientation(){
      try{
        var device = JSON.parse(sessionStorage.getItem('device') || '{}');
        var ori = device && device.orientation;
        if (ori && ori.indexOf('9:16') > -1) return 'portrait';
      }catch(_){}
      return (window.innerHeight > window.innerWidth) ? 'portrait' : 'landscape';
    }

    function pickVideoSrc(){
      var mode = pickOrientation();
      return mode === 'portrait'
        ? 'assets/launcher/launch-portrait.mp4'
        : 'assets/launcher/launch-landscape.mp4';
    }

    video.src = pickVideoSrc();

    function finishRoute(){
      var target;
      if (finished) return;
      finished = true;

      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      sessionStorage.setItem('isVideoPlayed', 'true');
      target = (verifyResult && verifyResult.verified) ? 'player' : 'login';
      Router.navigate(target);
    }

    // Silent pre-check in background while splash video plays.
    runSplashVerification().then(function(result){
      verifyResult = result || { verified: false };
      if (splashEnded) {
        finishRoute();
      }
    });

    video.addEventListener('canplay', function(){
      video.muted = false;
      video.play().catch(function(){});
    });

    video.addEventListener('ended', function(){
      splashEnded = true;

      // Keep old timing behavior: if verification is delayed, fail fast to login.
      fallbackTimer = setTimeout(function(){
        finishRoute();
      }, 1500);

      if (verifyResult) {
        finishRoute();
      }
    });

    return node;
  }

  window.SplashPage = Splash;
})(window, Dom, Router, AppShell, Logger, AuthService, DeviceInfoService);
