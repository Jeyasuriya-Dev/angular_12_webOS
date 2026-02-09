(function(window, Router, AppShell, SplashPage, LoginPage, PlayerPage){
  function mount(comp){ AppShell.setView(comp()); }
  Router.add('', function(){ if(sessionStorage.getItem('isVideoPlayed')==='true') Router.navigate('login'); else mount(SplashPage); });
  Router.add('login', function(){ mount(LoginPage); });
  Router.add('player', function(){ mount(PlayerPage); });
  Router.add('*', function(){ Router.navigate('login'); });
  Router.start();
})(window, Router, AppShell, SplashPage, LoginPage, PlayerPage);
