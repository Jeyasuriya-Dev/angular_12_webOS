(function(window){
  var storage = {
    set: function(scope,key,val){ try{ (scope==='session'?sessionStorage:localStorage).setItem(key, JSON.stringify(val)); }catch(e){} },
    get: function(scope,key,def){ try{ var v=(scope==='session'?sessionStorage:localStorage).getItem(key); return v?JSON.parse(v):def; }catch(e){ return def; } },
    remove: function(scope,key){ try{ (scope==='session'?sessionStorage:localStorage).removeItem(key);}catch(e){} }
  };
  window.StorageUtil = storage;
})(window);
