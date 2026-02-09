(function(window){
  function EventBus(){ this.map = {}; }
  EventBus.prototype.on = function(evt, cb){ (this.map[evt] = this.map[evt] || []).push(cb); return cb; };
  EventBus.prototype.off = function(evt, cb){ var arr=this.map[evt]; if(!arr) return; var i=arr.indexOf(cb); if(i>=0) arr.splice(i,1); };
  EventBus.prototype.emit = function(evt, data){ var arr=this.map[evt]||[]; arr.slice().forEach(function(cb){ try{ cb(data); }catch(e){ console.error(e);} }); };
  window.Events = new EventBus();
})(window);
