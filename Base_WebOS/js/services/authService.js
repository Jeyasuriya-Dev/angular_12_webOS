(function(window, StorageUtil, Logger){
  var API = {
    SERVER_URL: 'https://ds.iqtv.in:8080/iqserver/api/server/getserverdetails',
    BASE_URL: 'https://ds.iqtv.in:8080/iqworld'
  };

  var tokenKey = 'auth-token';
  var serverDetailsCache = null;
  var serverDetailsFetchedAt = 0;
  var serverDetailsInFlight = null;
  var SERVER_DETAILS_TTL_MS = 5 * 60 * 1000;
  var now = (typeof performance !== 'undefined' && performance.now) ? performance.now.bind(performance) : Date.now;

  // Measure each HTTP call to mirror Angular interceptor behavior
  function timedFetch(label, url, opts){
    var start = now();
    return fetch(url, opts)
      .then(function(res){
        Logger.info('HTTP ' + label, url + ' took ' + Math.round(now() - start) + ' ms');
        return res;
      })
      .catch(function(err){
        Logger.error('HTTP ' + label, url + ' failed after ' + Math.round(now() - start) + ' ms', err);
        throw err;
      });
  }

  function serverDetails(opts){
    var force = !!(opts && opts.force);
    var age = Date.now() - serverDetailsFetchedAt;

    if (!force && serverDetailsCache && age < SERVER_DETAILS_TTL_MS) {
      return Promise.resolve(serverDetailsCache);
    }

    if (!force && serverDetailsInFlight) {
      return serverDetailsInFlight;
    }

    serverDetailsInFlight = timedFetch('serverDetails', API.SERVER_URL, { headers:{'Content-Type':'application/json'} })
      .then(function(r){ return r.json(); })
      .then(function(res){
        var normalized = (res && res.application_url) ? res : { application_url: API.BASE_URL };
        serverDetailsCache = normalized;
        serverDetailsFetchedAt = Date.now();
        serverDetailsInFlight = null;
        return normalized;
      })
      .catch(function(){
        var fallback = { application_url: API.BASE_URL };
        serverDetailsCache = fallback;
        serverDetailsFetchedAt = Date.now();
        serverDetailsInFlight = null;
        return fallback;
      });

    return serverDetailsInFlight;
  }

  function withAuth(label, url, opts){
    opts = opts || {};
    opts.headers = opts.headers || {};
    var t = getToken();
    if(t) opts.headers['Authorization'] = 'Bearer ' + t;
    return timedFetch(label, url, opts);
  }

  function getToken(){ return sessionStorage.getItem(tokenKey); }

  var svc = {
    getToken:getToken,
    saveToken:function(t){ sessionStorage.setItem(tokenKey,t); },
    clearToken:function(){ sessionStorage.removeItem(tokenKey); },

    signin:function(payload){
      return serverDetails().then(function(res){
        return timedFetch('signin', res.application_url + 'api/auth/signin', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
          .then(function(r){return r.json();});
      });
    },

    signup:function(uniqueNumber, deviceUID){
      return serverDetails().then(function(res){
        return timedFetch('signup', res.application_url + 'api/v1/none-auth/updatedeviceandroid?uniq='+encodeURIComponent(uniqueNumber)+'&android_id='+encodeURIComponent(deviceUID))
          .then(function(r){return r.json();});
      });
    },

    isExistedDevice:function(android_id){
      return serverDetails({ force: true }).then(function(res){
        return timedFetch('isExistedDevice', res.application_url + 'api/v1/none-auth/device/isexist?android_id='+encodeURIComponent(android_id))
          .then(function(r){return r.json();});
      });
    },

    getMediafiles:function(payload){
      return serverDetails().then(function(res){
        var url = res.application_url + 'api/v1/playlist/mediafilebyclientforsplit?clientname='+payload.clientusername+'&state_id='+payload.state_id+'&city_id='+payload.city_id+'&androidid='+payload.androidid+'&deviceid='+payload.username+'&vertical='+payload.isVertical;
        return withAuth('getMediafiles', url, { method:'GET', headers:{'Content-Type':'application/json'} })
          .then(function(r){return r.json();});
      });
    },

    logout:function(choice){
      var deviceUID = sessionStorage.getItem('username') || localStorage.getItem('username');
      if(choice && choice.isConfirmed && deviceUID){ localStorage.setItem('username', deviceUID); }
      if(choice && choice.isDenied){ localStorage.removeItem('username'); }
      sessionStorage.removeItem('device');
      sessionStorage.setItem('isVideoPlayed','true');
      if(!deviceUID) return Promise.resolve({message:'No device UID found, skipping logout request'});
      return serverDetails().then(function(res){
        return timedFetch('logout', res.application_url + 'api/v1/device/logout?deviceid='+encodeURIComponent(deviceUID))
          .then(function(r){return r.json();});
      });
    },

    getNetworkInfo:function(payload){
      return serverDetails().then(function(res){
        return timedFetch('getNetworkInfo', res.application_url + 'api/v1/device/checkonline?adrid='+payload.androidid+'&clientname='+payload.clientusername)
          .then(function(r){return r.json();});
      });
    }
  };

  window.AuthService = svc;
})(window, StorageUtil, Logger);
