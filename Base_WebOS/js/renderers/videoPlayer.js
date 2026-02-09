(function(window, Logger){
  function mapMediaError(mediaError){
    if (!mediaError) return { code: 0, message: 'Unknown video error' };

    if (mediaError.code === mediaError.MEDIA_ERR_ABORTED) {
      return { code: mediaError.code, message: 'Video playback aborted.' };
    }
    if (mediaError.code === mediaError.MEDIA_ERR_NETWORK) {
      return { code: mediaError.code, message: 'Network error while loading video.' };
    }
    if (mediaError.code === mediaError.MEDIA_ERR_DECODE) {
      return { code: mediaError.code, message: 'Video decoding error.' };
    }
    if (mediaError.code === mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return { code: mediaError.code, message: 'Video format not supported or file missing.' };
    }

    return { code: mediaError.code, message: 'Unknown video error' };
  }

  function VideoPlayer(opts){
    opts = opts || {};

    this.url = opts.url || '';
    this.loop = !!opts.loop;
    this.container = opts.container;
    this.onEnd = opts.onEnd || function(){};
    this.onError = opts.onError || function(){};
    this.onReady = opts.onReady || function(){};
    this.maxAttempts = opts.maxAttempts || 3;
    this.retryDelay = opts.retryDelay || 2000;
    this.muted = !!opts.muted;

    this.videoEl = null;
    this._canPlayHandler = null;
    this._playingHandler = null;
    this._destroyed = false;

    this.init();
  }

  VideoPlayer.prototype.init = function(){
    var self = this;
    var attempts = 0;
    var playStarted = false;
    var usedMutedFallback = false;

    function restoreAudio(){
      if (self._destroyed || !self.videoEl || self.muted) return;
      self.videoEl.muted = false;
      self.videoEl.defaultMuted = false;
      try { self.videoEl.volume = 1; } catch (_) {}
    }

    if (!this.container) return;
    if (!this.url) {
      this.onError({
        success: false,
        code: 4,
        message: 'Video source is empty.'
      });
      return;
    }

    this.videoEl = document.createElement('video');
    this.videoEl.className = 'media-video video-element';
    this.videoEl.preload = 'auto';
    this.videoEl.autoplay = true;
    this.videoEl.muted = this.muted;
    this.videoEl.defaultMuted = this.muted;
    try { this.videoEl.volume = this.muted ? 0 : 1; } catch (_) {}
    this.videoEl.playsInline = true;
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.style.minHeight = '100%';
    this.videoEl.style.minWidth = '100%';
    this.videoEl.style.objectFit = 'fill';

    if (this.loop) this.videoEl.loop = true;

    this.container.innerHTML = '';
    this.container.appendChild(this.videoEl);

    this.videoEl.onended = function(){
      if (self._destroyed) return;
      self.onEnd({ success: true });
    };

    this.videoEl.onerror = function(){
      if (self._destroyed) return;
      var mapped = mapMediaError(self.videoEl.error);

      Logger.error('VideoPlayer', 'Video playback failed', {
        src: self.videoEl.currentSrc || self.url,
        errorCode: mapped.code,
        message: mapped.message
      });

      self.onError({
        success: false,
        code: mapped.code,
        message: mapped.message
      });
    };

    this._playingHandler = function(){
      restoreAudio();
    };
    this.videoEl.addEventListener('playing', this._playingHandler);

    this._canPlayHandler = function(){
      var playPromise;
      if (playStarted) return;
      if (self._destroyed) return;

      attempts += 1;
      playPromise = self.videoEl.play();

      if (!playPromise || !playPromise.then) {
        playStarted = true;
        return;
      }

      playPromise.then(function(){
        playStarted = true;
        if (usedMutedFallback) {
          setTimeout(restoreAudio, 0);
        }
      }).catch(function(err){
        if (self._destroyed) return;

        // Browser autoplay policies may block unmuted playback.
        // Fallback to muted to avoid black screen lock.
        if (!self.videoEl.muted) {
          self.videoEl.muted = true;
          self.videoEl.defaultMuted = true;
          usedMutedFallback = true;
        }

        if (attempts < self.maxAttempts) {
          setTimeout(function(){
            if (!self._destroyed && self.videoEl) {
              self._canPlayHandler();
            }
          }, self.retryDelay);
        } else {
          Logger.error('VideoPlayer', 'Video cannot play after retries', err);
          self.onError({
            success: false,
            code: 0,
            message: 'Video autoplay failed with audio.'
          });
        }
      });
    };

    this.videoEl.addEventListener('canplay', this._canPlayHandler);
    this.videoEl.addEventListener('canplaythrough', this._canPlayHandler);
    this.videoEl.src = this.url;
    this.videoEl.currentTime = 0;
    this.videoEl.load();

    this.onReady(this.videoEl);
  };

  VideoPlayer.prototype.destroy = function(){
    if (this._destroyed) return;
    this._destroyed = true;

    if (!this.videoEl) return;

    if (this._canPlayHandler) {
      this.videoEl.removeEventListener('canplaythrough', this._canPlayHandler);
      this.videoEl.removeEventListener('canplay', this._canPlayHandler);
    }
    if (this._playingHandler) {
      this.videoEl.removeEventListener('playing', this._playingHandler);
    }

    this.videoEl.onended = null;
    this.videoEl.onerror = null;

    try { this.videoEl.pause(); } catch (_) {}
    this.videoEl.removeAttribute('src');

    try { this.videoEl.load(); } catch (_) {}

    if (this.videoEl.parentNode) {
      this.videoEl.parentNode.removeChild(this.videoEl);
    }

    this.videoEl = null;
    this._canPlayHandler = null;
    this._playingHandler = null;
  };

  window.VideoPlayer = VideoPlayer;
})(window, Logger);
