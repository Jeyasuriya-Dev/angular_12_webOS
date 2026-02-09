(function(window){
  window.loadFontDynamically = function(fontFamily, fontUrl){
    return new Promise(function(resolve,reject){
      try{
        var font = new FontFace(fontFamily, 'url(' + fontUrl + ')');
        font.load().then(function(f){ document.fonts.add(f); resolve(true); }).catch(reject);
      }catch(e){ reject(e); }
    });
  };
})(window);
