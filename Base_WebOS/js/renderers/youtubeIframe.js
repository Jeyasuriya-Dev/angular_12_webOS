(function(window){
  function getYouTubeVideoID(url){
    var regexList = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:m\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:m\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/
    ];
    var i;
    var match;

    if (!url) return null;

    for (i = 0; i < regexList.length; i++) {
      match = String(url).match(regexList[i]);
      if (match && match[1]) return match[1];
    }

    return null;
  }

  function YoutubeIframe(opts){
    opts = opts || {};

    this.url = opts.url || '';
    this.loop = !!opts.loop;
    this.onEnd = opts.onEnd || function(){};
    this.container = opts.container;

    this.iframe = null;
    this._messageHandler = this.handleMessage.bind(this);

    this.render();
  }

  YoutubeIframe.prototype.render = function(){
    var loop;
    var videoId;

    if (!this.container) return;

    loop = this.loop ? 1 : 0;
    videoId = getYouTubeVideoID(this.url);

    if (!videoId) {
      this.onEnd({ success: false, message: 'Invalid YouTube URL' });
      return;
    }

    this.iframe = document.createElement('iframe');
    this.iframe.allow = 'autoplay; encrypted-media; fullscreen';
    this.iframe.frameBorder = '0';
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.src = 'https://ds.iqtv.in/youtube/yt.html?v=' + videoId + '&loop=' + loop;

    this.container.innerHTML = '';
    this.container.appendChild(this.iframe);

    window.addEventListener('message', this._messageHandler, false);
  };

  YoutubeIframe.prototype.handleMessage = function(event){
    if (!event || !event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'YT_VIDEO_ENDED') {
      this.onEnd({ success: true, index: 0 });
    }
  };

  YoutubeIframe.prototype.destroy = function(){
    window.removeEventListener('message', this._messageHandler, false);

    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }

    this.iframe = null;
  };

  window.YoutubeIframe = YoutubeIframe;
})(window);
