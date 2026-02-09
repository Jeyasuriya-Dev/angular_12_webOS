(function(window, Events, Logger){
  var deviceUID = null;
  var systemInfoLogged = false;
  function resolveUID(){
    if(deviceUID) return Promise.resolve(deviceUID);
    return new Promise(function(resolve){
      var w = window;
      if(typeof w.PalmServiceBridge === 'function' || typeof w.PalmServiceBridge === 'object'){
        try{
          var bridge = new w.PalmServiceBridge();
          var url = 'luna://com.webos.service.tv.systemproperty/getSystemInfo';
          var params = JSON.stringify({
            keys:[
              'serialNumber',
              'modelName',
              'firmwareVersion',
              'osVersion',
              'osRelease',
              'version',
              'webosVersion',
              'deviceId',
              'sdkVersion'
            ]
          });
          bridge.onservicecallback = function(msg){
            try{
              var res = JSON.parse(msg);
              deviceUID = res.serialNumber || res.deviceId || crypto.randomUUID();
              if (!systemInfoLogged) {
                var osVersionVal = res.osVersion || res.osRelease || res.version || res.webosVersion || res.webOSVersion || res.sdkVersion || '';
                Logger.info('DeviceInfo', 'System info', {
                  modelName: res.modelName || '',
                  firmwareVersion: res.firmwareVersion || '',
                  osVersion: osVersionVal,
                  deviceId: res.deviceId || ''
                });
                systemInfoLogged = true;
              }
              resolve(deviceUID);
              Events.emit('deviceUID', deviceUID);
            }catch(e){
              deviceUID = crypto.randomUUID(); resolve(deviceUID);
            }
          };
          bridge.call(url, params);
          return;
        }catch(e){ Logger.error('DeviceInfo','PalmServiceBridge failed',e); }
      }
      // webOS only build: fallback to stored/random
      deviceUID = localStorage.getItem('fallback_duid') || (crypto.randomUUID ? crypto.randomUUID(): String(Date.now()));
      localStorage.setItem('fallback_duid', deviceUID);
      resolve(deviceUID); Events.emit('deviceUID', deviceUID);
    });
  }
  window.DeviceInfoService = {
    init: resolveUID,
    get: function(){ return deviceUID; },
    wait: function(cb){ if(deviceUID) return cb(deviceUID); Events.on('deviceUID', cb); }
  };
})(window, Events, Logger);
