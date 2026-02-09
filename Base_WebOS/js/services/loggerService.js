(function(window){
  var envProd = false; // set true in production to silence info/log
  var TAG = 'IQ-TV';
  function fmt(level, method, msg){
    return TAG + ' ['+level+'] ' + new Date().toISOString() + ' :: ' + method + ' -> ' + msg;
  }
  var logger = {
    log: function(meth,msg,data){ if(!envProd) console.log(fmt('LOG',meth,msg), data||''); },
    info:function(meth,msg,data){ if(!envProd) console.info(fmt('INFO',meth,msg), data||''); },
    warn:function(meth,msg,data){ console.warn(fmt('WARN',meth,msg), data||''); },
    error:function(meth,msg,err){ console.error(fmt('ERROR',meth,msg), err||''); }
  };
  window.Logger = logger;
})(window);
