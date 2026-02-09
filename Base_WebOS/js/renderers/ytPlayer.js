(function(window, Logger){
  function getId(url){ if(!url) return null; var regex=[/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:[&?]|$)/]; for(var i=0;i<regex.length;i++){ var m=url.match(regex[i]); if(m&&m[1]) return m[1]; } return null; }
  function YtPlayer(opts){ this.url=opts.url; this.onEnd=opts.onEnd||function(){}; this.loop=!!opts.loop; this.container=opts.container; this.player=null; this.index=opts.index||0; this.render(); }
  YtPlayer.prototype.render=function(){ var self=this; var id='yt-'+Date.now()+'-'+Math.random().toString(36).slice(2); var div=document.createElement('div'); div.id=id; div.style.pointerEvents='none'; this.container.innerHTML=''; this.container.appendChild(div);
    var vid=getId(this.url); if(!vid) return;
    function create(){ self.player = new YT.Player(id,{ videoId:vid, playerVars:{autoplay:1,controls:0,rel:0,modestbranding:1,origin:window.location.origin,loop:self.loop?1:0,playlist:self.loop?vid:undefined}, events:{ onReady:function(e){ try{ e.target.unMute(); }catch(err){} }, onStateChange:function(e){ if(e.data===YT.PlayerState.ENDED){ self.onEnd({success:true}); if(self.loop){ try{ self.player.seekTo(0); self.player.playVideo(); }catch(err){} } } }, onError:function(e){ self.onEnd({success:false,message:'YouTube error '+e.data}); }}}); }
    if(window.YT && window.YT.Player){ create(); } else { window.onYouTubeIframeAPIReady = create; }
  };
  window.YtPlayer = YtPlayer;
})(window, Logger);
