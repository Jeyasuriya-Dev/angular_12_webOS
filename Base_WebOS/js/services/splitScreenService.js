(function(window, Events){
  window.SplitScreenService = {
    triggerPendriveSettings: function(){ Events.emit('pendrive:trigger'); },
    onPendriveTrigger: function(cb){ Events.on('pendrive:trigger', cb); }
  };
})(window, Events);
