(function(window, VideoPlayer, YoutubeIframe, PdfViewer, Toast, Logger){
  function ContentPlayer(opts){
    opts = opts || {};
    this.media = opts.media || [];
    this.zoneId = opts.zoneId;
    this.zoneDuration = opts.zoneDuration;
    this.layoutZones = opts.layoutZones || [];
    this.onZoneComplete = opts.onZoneComplete || function(){};
    this.container = opts.container;
    this.splitScreenList = opts.splitScreenList || [];

    this.filesData = [];
    this.currentIndex = 0;
    this.autoplayTimer = null;
    this.videoZoneTimer = null;
    this.activePlayingId = null;
    this.playerRecreateKey = null;
    this.activeRenderer = null;

    this._boundOnline = this.onNetworkOnline.bind(this);
    this._boundOffline = this.onNetworkOffline.bind(this);
    this.isOnline = navigator.onLine;

    this.init();
  }

  ContentPlayer.prototype.init = function(){
    window.addEventListener('online', this._boundOnline);
    window.addEventListener('offline', this._boundOffline);
    this.loadMediaFiles();
  };

  ContentPlayer.prototype.destroy = function(){
    clearTimeout(this.autoplayTimer);
    clearTimeout(this.videoZoneTimer);
    this.autoplayTimer = null;
    this.videoZoneTimer = null;

    if (this.activeRenderer && this.activeRenderer.destroy) {
      this.activeRenderer.destroy();
    }
    this.activeRenderer = null;

    window.removeEventListener('online', this._boundOnline);
    window.removeEventListener('offline', this._boundOffline);

    this.filesData = [];
    if (this.container) this.container.innerHTML = '';
  };

  ContentPlayer.prototype.onNetworkOnline = function(){
    this.isOnline = true;
  };

  ContentPlayer.prototype.onNetworkOffline = function(){
    this.isOnline = false;
  };

  ContentPlayer.prototype.classify = function(file){
    var rawUrl = ((file && (file.downloadedUrl || file.Url || file.url || file.Filename || file.filename)) || '').toString();
    var lowerUrl = rawUrl.toLowerCase();
    var cleanUrl = lowerUrl.split('#')[0].split('?')[0];
    var typeHints = '';

    if (file) {
      typeHints = [
        file.type,
        file.media_type,
        file.file_type,
        file.mimeType,
        file.mimetype,
        file.contentType,
        file.content_type
      ].join(' ').toLowerCase();
    }

    if (lowerUrl.indexOf('youtube.com') > -1 || lowerUrl.indexOf('youtu.be') > -1) return 'youtube';
    if (typeHints.indexOf('pdf') > -1) return 'pdf';
    if (typeHints.indexOf('video') > -1) return 'video';
    if (typeHints.indexOf('image') > -1) return 'image';
    if (/\.(mp4|mov|avi|mkv|webm)$/.test(cleanUrl)) return 'video';
    if (/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/.test(cleanUrl)) return 'image';
    if (/\.pdf$/.test(cleanUrl)) return 'pdf';
    return 'other';
  };

  ContentPlayer.prototype.prepareFiles = function(files){
    return (files || [])
      .map(function(file){
        var type = file.type || this.classify(file);
        var prepared = {};
        var key;

        for (key in file) {
          if (Object.prototype.hasOwnProperty.call(file, key)) prepared[key] = file[key];
        }

        prepared.type = type;
        return prepared;
      }.bind(this))
      .filter(function(file){ return file.type !== 'other'; });
  };

  ContentPlayer.prototype.loadMediaFiles = function(){
    this.filesData = this.prepareFiles(this.media);
    this.currentIndex = 0;
    this.playerRecreateKey = this.generateKey();

    if (!this.filesData.length) {
      if (this.container) this.container.innerHTML = '';
      return;
    }

    setTimeout(function(){
      this.showCurrentSlide();
    }.bind(this), 120);
  };

  ContentPlayer.prototype.generateKey = function(){
    var file = this.filesData[this.currentIndex] || {};
    var url = file.Url || '';
    return url + '_' + this.currentIndex + '_' + Date.now();
  };

  ContentPlayer.prototype.getCurrentUrl = function(file){
    var url;
    if (!file) return '';
    url = file.downloadedUrl || file.Url || file.url || file.Filename || file.filename || '';
    return String(url).trim();
  };

  ContentPlayer.prototype.resetRenderer = function(){
    if (this.activeRenderer && this.activeRenderer.destroy) {
      this.activeRenderer.destroy();
    }
    this.activeRenderer = null;
  };

  ContentPlayer.prototype.showCurrentSlide = function(){
    var currentFile;
    var node;
    var loopFlag;
    var self = this;
    var renderGuard;

    clearTimeout(this.autoplayTimer);
    clearTimeout(this.videoZoneTimer);

    currentFile = this.filesData[this.currentIndex];
    if (!currentFile) return;

    if (!Number(currentFile.Mediafile_id)) {
      currentFile.Mediafile_id = Date.now();
    }

    this.activePlayingId = currentFile.Mediafile_id;
    loopFlag = (this.filesData.length === 1 && this.splitScreenList.length === 1);

    this.resetRenderer();
    this.container.innerHTML = '';
    node = document.createElement('div');
    node.className = 'content-player-node';
    node.style.width = '100%';
    node.style.height = '100%';
    this.container.appendChild(node);

    function startRenderGuard(){
      if (renderGuard) clearTimeout(renderGuard);
      renderGuard = setTimeout(function(){
        if (self._destroyed) return;
        var first = node.firstChild;
        var hasContent = first && first.clientWidth > 0 && first.clientHeight > 0;
        if (!hasContent) {
          // Skip to next slide if nothing rendered to avoid black screen.
          self.nextSlideAndShow();
        }
      }, 2500);
    }

    if (currentFile.type === 'video') {
      startRenderGuard();
      this.playVideo(currentFile, node, loopFlag);
      return;
    }

    if (currentFile.type === 'image') {
      startRenderGuard();
      this.playImage(currentFile, node);
      return;
    }

    if (currentFile.type === 'youtube') {
      startRenderGuard();
      this.playYoutube(currentFile, node, loopFlag);
      return;
    }

    if (currentFile.type === 'pdf') {
      startRenderGuard();
      this.playPdf(currentFile, node, loopFlag);
      return;
    }

    this.autoplayTimer = setTimeout(function(){
      this.nextSlideAndShow();
    }.bind(this), 10000);
  };

  ContentPlayer.prototype.playImage = function(file, node){
    var self = this;
    var img = document.createElement('img');
    var delayMs = this.getMediaDurationMs(file);
    var timerStarted = false;
    var mediaId = file && file.Mediafile_id;

    function startTimer(){
      if (timerStarted) return;
      timerStarted = true;
      self.autoplayTimer = setTimeout(function(){
        self.nextSlideAndShow();
      }, delayMs);
    }

    function isStillActive(){
      return self.activePlayingId === mediaId;
    }

    img.className = 'media-image';
    img.alt = 'image';
    img.style.visibility = 'hidden';
    img.decoding = 'sync';
    img.loading = 'eager';

    img.addEventListener('load', function(){
      if (!isStillActive()) return;
      img.style.visibility = 'visible';
      startTimer();
    }, { once: true });

    img.addEventListener('error', function(){
      if (!isStillActive()) return;
      img.style.visibility = 'visible';
      startTimer();
    }, { once: true });

    node.appendChild(img);
    img.src = this.getCurrentUrl(file);

    // Cached image safety: if it is already decoded, show immediately.
    setTimeout(function(){
      if (!isStillActive()) return;
      if (img.complete) {
        img.style.visibility = 'visible';
        startTimer();
      }
    }, 60);

    // Fallback: never block the zone if image load hangs.
    setTimeout(function(){
      if (!isStillActive()) return;
      img.style.visibility = 'visible';
      startTimer();
    }, 3000);
  };

  ContentPlayer.prototype.playVideo = function(file, node, loopFlag){
    var self = this;
    var syncLoopInfo = this.getVideoSyncLoopInfo(file);
    var shouldLoop = !!loopFlag || !!syncLoopInfo.enabled;
    var videoUrl = this.getCurrentUrl(file);

    if (!videoUrl) {
      this.autoplayTimer = setTimeout(function(){
        self.nextSlideAndShow();
      }, 600);
      return;
    }

    this.activeRenderer = new VideoPlayer({
      url: videoUrl,
      loop: shouldLoop,
      container: node,
      muted: false,
      onReady: function(videoEl){
        if (syncLoopInfo.enabled) {
          videoEl.loop = true;
          self.videoZoneTimer = setTimeout(function(){
            self.onZoneComplete(self.zoneId);
          }, syncLoopInfo.holdMs);
        }
      },
      onEnd: function(){
        if (syncLoopInfo.enabled) {
          return;
        }
        self.nextSlideAndShow();
      },
      onError: function(event){
        var msg = event && event.message ? event.message : 'Video playback failed';
        Toast.error(msg);

        self.autoplayTimer = setTimeout(function(){
          if (self.filesData.length <= 1) {
            self.showCurrentSlide();
            return;
          }
          self.nextSlideAndShow();
        }, 1200);
      }
    });
  };

  ContentPlayer.prototype.toPositiveNumber = function(value){
    var num = Number(value);

    if (!isFinite(num) || num <= 0) return 0;
    return num;
  };

  ContentPlayer.prototype.getImageDelaySeconds = function(){
    var raw = localStorage.getItem('imageDelay');
    var n = this.toPositiveNumber(raw);
    return n > 0 ? n : 10;
  };

  ContentPlayer.prototype.getMediaDurationSeconds = function(file){
    var durationFromApi = this.toPositiveNumber(file && (file.Duration || file.duration));
    var type;

    type = (file && file.type) || this.classify(file || {});

    // Force images to 10 seconds regardless of API duration or settings.
    if (type === 'image') return 10;

    if (durationFromApi > 0) return durationFromApi;
    if (type === 'video') return 10;
    if (type === 'pdf') return 10;
    if (type === 'youtube') return 10;

    return 10;
  };

  ContentPlayer.prototype.getMediaDurationMs = function(file){
    return Math.max(1000, Math.round(this.getMediaDurationSeconds(file) * 1000));
  };

  ContentPlayer.prototype.findCurrentZone = function(zones){
    var i;
    var zone;
    var zid;

    for (i = 0; i < zones.length; i++) {
      zone = zones[i] || {};
      zid = (zone.id !== undefined && zone.id !== null) ? zone.id : i;
      if (zid === this.zoneId) return zone;
    }

    return null;
  };

  ContentPlayer.prototype.getZoneDurationSeconds = function(zone){
    var explicitZoneDuration = this.toPositiveNumber(zone && zone.zone_duration);
    var mediaList;
    var total = 0;
    var i;

    if (explicitZoneDuration > 0) return explicitZoneDuration;

    mediaList = (zone && zone.media_list) || [];
    for (i = 0; i < mediaList.length; i++) {
      total += this.getMediaDurationSeconds(mediaList[i] || {});
    }

    if (total > 0) return total;

    // Fallback for malformed zone payloads.
    return Math.max(this.toPositiveNumber(this.zoneDuration), 10);
  };

  ContentPlayer.prototype.getVideoSyncLoopInfo = function(file){
    var zones = this.layoutZones && this.layoutZones.length ? this.layoutZones : this.findZonesByZoneId(this.zoneId);
    var currentZone = this.findCurrentZone(zones);
    var currentZoneDuration = currentZone ? this.getZoneDurationSeconds(currentZone) : this.getMediaDurationSeconds(file);
    var maxZoneDuration = currentZoneDuration;
    var i;
    var zoneDuration;

    // Apply only for real split-screen layouts and single-file video zones.
    if (!zones || zones.length <= 1 || this.filesData.length !== 1) {
      return { enabled: false, holdMs: 0 };
    }

    for (i = 0; i < zones.length; i++) {
      zoneDuration = this.getZoneDurationSeconds(zones[i] || {});
      if (zoneDuration > maxZoneDuration) maxZoneDuration = zoneDuration;
    }

    if (maxZoneDuration <= currentZoneDuration) {
      return { enabled: false, holdMs: 0 };
    }

    return {
      enabled: true,
      holdMs: Math.max(1000, Math.round(maxZoneDuration * 1000))
    };
  };

  ContentPlayer.prototype.playYoutube = function(file, node, loopFlag){
    var self = this;

    this.playerRecreateKey = this.generateKey();
    this.activeRenderer = new YoutubeIframe({
      url: this.getCurrentUrl(file),
      loop: !!loopFlag,
      container: node,
      onEnd: function(event){
        self.onVideoEnded(event || { success: true }, 'yt');
      }
    });
  };

  ContentPlayer.prototype.playPdf = function(file, node, loopFlag){
    var self = this;

    this.activeRenderer = new PdfViewer({
      url: this.getCurrentUrl(file),
      loop: !!loopFlag,
      container: node,
      onEnd: function(event){
        self.onVideoEnded(event || { success: true }, 'pdf');
      }
    });
  };

  ContentPlayer.prototype.findZonesByZoneId = function(zoneId){
    var i;
    var layout;
    var zones;
    var z;
    var zid;

    for (i = 0; i < this.splitScreenList.length; i++) {
      layout = this.splitScreenList[i];
      zones = (layout && layout.zonelist) || [];
      for (z = 0; z < zones.length; z++) {
        zid = (zones[z] && zones[z].id !== undefined && zones[z].id !== null) ? zones[z].id : z;
        if (zid === zoneId) {
          return zones;
        }
      }
    }

    return [];
  };

  ContentPlayer.prototype.nextSlideAndShow = function(){
    var isLastMedia;

    clearTimeout(this.autoplayTimer);

    if (!this.filesData.length) return;

    isLastMedia = this.currentIndex === this.filesData.length - 1;

    if (isLastMedia) {
      this.onZoneComplete(this.zoneId);
    }

    if (this.filesData.length > 1) {
      this.currentIndex = (this.currentIndex + 1) % this.filesData.length;
      this.playerRecreateKey = this.generateKey();

      setTimeout(function(){
        this.showCurrentSlide();
      }.bind(this), 80);
    }
  };

  ContentPlayer.prototype.onVideoEnded = function(event){
    if (!event || !event.success) {
      if (event && event.message) {
        Toast.error(event.message);
      }
    }

    this.nextSlideAndShow();
  };

  window.ContentPlayer = ContentPlayer;
})(window, VideoPlayer, YoutubeIframe, PdfViewer, Toast, Logger);
