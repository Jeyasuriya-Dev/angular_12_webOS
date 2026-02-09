(function(window, Dom){
  var routes = [];
  function add(path, handler){ routes.push({path:path, handler:handler}); }
  function match(hash){
    var clean = hash.replace(/^#\/?/, '');
    var found = routes.find(function(r){ return r.path === clean; }) || routes.find(function(r){ return r.path === '*'; });
    return found;
  }
  function navigate(path){ window.location.hash = path.charAt(0)==='#'?path:'#'+path; }
  function start(){
    window.addEventListener('hashchange', render);
    render();
  }
  function render(){
    var h = window.location.hash || '#';
    var route = match(h);
    if(route && route.handler){ route.handler(); }
  }
  window.Router = { add:add, start:start, navigate:navigate };
})(window, Dom);
