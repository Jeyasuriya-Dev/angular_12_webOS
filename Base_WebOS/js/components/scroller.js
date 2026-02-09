(function(window, Dom, loadFontDynamically, Logger){
  var loadedFontCache = {};

  function Scroller(opts){
    opts = opts || {};

    this.scrollers = opts.items || [];
    this.position = opts.position || 'TOP';
    this.direction = (this.scrollers[0] && this.scrollers[0].direction) || 'left';
    this.hasAnyLogo = this.scrollers.some(function(s){ return !!(s && s.logo); });

    this.node = null;
    this.wrap = null;
    this.track = null;
    this.logoWrap = null;
    this.logoImg = null;

    this.animationReady = false;
    this.previousFontNames = [];
    this.stickyLogo = null;
    this.stickyFromIndex = null;
    this.stickyLogoWidth = 0;
    this.stickyLogoMeasured = false;
    this.logoGap = 20;
    this.reservedLogoWidth = this.hasAnyLogo ? 60 : 0;
    this.rafId = null;
    this.iterationHandler = null;

    this.build();
  }

  Scroller.prototype.build = function(){
    var i;
    var item;
    var trigger;

    this.node = Dom.el('<div class="scroller-host"></div>');

    this.logoWrap = Dom.el('<div class="sticky-logo d-flex align-items-center" style="display:none;"><img alt="logo" /></div>');
    this.logoImg = this.logoWrap.querySelector('img');
    this.logoImg.onload = function(){
      this.stickyLogoMeasured = false;
      this.updateLogoOffset();
    }.bind(this);

    this.wrap = Dom.el('<div class="scroll-wrapper hidden-init"></div>');
    this.track = Dom.el('<div class="scroll-track"></div>');
    this.track.classList.add(this.direction === 'right' ? 'right' : 'left');

    this.wrap.appendChild(this.track);
    this.node.appendChild(this.logoWrap);
    this.node.appendChild(this.wrap);

    for (i = 0; i < this.scrollers.length; i++) {
      item = Dom.el('<div class="scroll-item"><div class="logo-trigger" data-index="' + i + '"></div><div class="scroll-text"></div></div>');
      this.track.appendChild(item);
    }

    this.applyScrollerStyles();
    this.updateLogoOffset();

    if (this.scrollers.length && this.scrollers[0].logo) {
      this.setStickyLogo(this.scrollers[0].logo, 0);
    }

    this.iterationHandler = this.onAnimationIteration.bind(this);
    this.track.addEventListener('animationiteration', this.iterationHandler);

    this.checkFontChanges();
  };

  Scroller.prototype.applyScrollerStyles = function(){
    var items = this.track.querySelectorAll('.scroll-item');
    var textNodes = this.track.querySelectorAll('.scroll-text');
    var i;
    var s;
    var fontSizePx;

    for (i = 0; i < items.length; i++) {
      s = this.scrollers[i] || {};
      fontSizePx = this.resolveFontSize(s.fnsize);

      items[i].style.color = s.fncolor || '#fff';
      items[i].style.setProperty('font-size', fontSizePx + 'px', 'important');
      items[i].style.fontFamily = s.loadedFont || 'sans-serif';
      items[i].style.background = s.bgcolor || 'transparent';
      items[i].style.padding = this.calcPadding(s);

      if (textNodes[i]) {
        textNodes[i].style.setProperty('font-size', fontSizePx + 'px', 'important');
        textNodes[i].style.fontFamily = s.loadedFont || 'sans-serif';
        textNodes[i].textContent = s.message || '';
      }
    }
  };

  Scroller.prototype.resolveFontSize = function(value){
    var size;
    var raw = value;

    if (raw === null || raw === undefined || raw === '') {
      return 24;
    }

    if (typeof raw === 'number') {
      size = raw;
    } else {
      size = parseFloat(String(raw).replace(',', '.'));
    }

    if (!isFinite(size) || size <= 0) {
      return 24;
    }

    return size;
  };

  Scroller.prototype.getReservedLogoWidth = function(){
    if (!this.hasAnyLogo) return 0;
    return this.reservedLogoWidth > 0 ? this.reservedLogoWidth : 60;
  };

  Scroller.prototype.resolveStableLogoOffset = function(done){
    var self = this;
    var doneCalled = false;
    var fallbackWidth = this.getReservedLogoWidth();
    var timer = null;
    var onLoadOrError;

    function finalize(width){
      if (doneCalled) return;
      doneCalled = true;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      if (onLoadOrError && self.logoImg) {
        self.logoImg.removeEventListener('load', onLoadOrError);
        self.logoImg.removeEventListener('error', onLoadOrError);
      }

      self.reservedLogoWidth = self.hasAnyLogo ? (width > 0 ? width : fallbackWidth) : 0;
      self.updateLogoOffset();

      if (typeof done === 'function') done();
    }

    if (!this.hasAnyLogo) {
      finalize(0);
      return;
    }

    if (!this.logoImg) {
      finalize(fallbackWidth);
      return;
    }

    if (this.logoImg.complete && this.logoImg.naturalWidth > 0) {
      finalize(this.logoImg.offsetWidth || this.logoImg.naturalWidth || fallbackWidth);
      return;
    }

    onLoadOrError = function(){
      finalize(self.logoImg.offsetWidth || self.logoImg.naturalWidth || fallbackWidth);
    };

    this.logoImg.addEventListener('load', onLoadOrError);
    this.logoImg.addEventListener('error', onLoadOrError);

    timer = setTimeout(function(){
      finalize(fallbackWidth);
    }, 260);
  };

  Scroller.prototype.onAnimationIteration = function(){
    if (this.scrollers.length && this.scrollers[0].logo) {
      this.syncStickyLogo(this.scrollers[0].logo, 0);
    } else {
      this.clearStickyLogo();
    }
    this.updateLogoOffset();
  };

  Scroller.prototype.syncStickyLogo = function(url, index){
    if (!url) {
      this.clearStickyLogo();
      return;
    }

    if (this.stickyLogo === url && this.stickyFromIndex === index && this.logoWrap.style.display !== 'none') {
      return;
    }

    this.setStickyLogo(url, index);
  };

  Scroller.prototype.checkFontChanges = function(){
    var currentFontNames;
    var changed;

    if (!this.scrollers || !this.scrollers.length) return;

    currentFontNames = this.scrollers.map(function(s){ return s.fontname; });

    if (this.previousFontNames.length === 0) {
      this.previousFontNames = currentFontNames.slice(0);

      this.loadScrollerFonts().then(function(){
        this.applyScrollerStyles();
        this.updateScrollSpeed();
      }.bind(this));
      return;
    }

    changed = currentFontNames.some(function(font, idx){
      return font !== this.previousFontNames[idx];
    }.bind(this));

    if (changed) {
      this.previousFontNames = currentFontNames.slice(0);

      this.loadScrollerFonts().then(function(){
        this.applyScrollerStyles();
        this.updateScrollSpeed();
      }.bind(this));
      return;
    }

    this.scrollers.forEach(function(s){
      s.loadedFont = s.font_folder || 'sans-serif';
    });

    this.applyScrollerStyles();
  };

  Scroller.prototype.loadScrollerFonts = function(){
    var self = this;
    var chain = Promise.resolve();

    if (!this.scrollers || !this.scrollers.length) return chain;

    this.scrollers.forEach(function(s){
      var fontKey = String(s.font_folder || '') + '-' + String(s.fontname || '');

      chain = chain.then(function(){
        if (loadedFontCache[fontKey]) {
          s.loadedFont = s.font_folder || 'sans-serif';
          return;
        }

        if (!s.fontname || !s.font_folder) {
          s.loadedFont = 'sans-serif';
          return;
        }

        return loadFontDynamically(s.font_folder, s.fontname).then(function(ok){
          if (ok === false) {
            s.loadedFont = 'sans-serif';
            return;
          }

          loadedFontCache[fontKey] = true;
          s.loadedFont = s.font_folder;
        }).catch(function(err){
          Logger.error('Scroller', 'Font load failed', {
            font: fontKey,
            error: err
          });
          s.loadedFont = 'sans-serif';
        });
      });
    });

    return chain.then(function(){
      self.applyScrollerStyles();
    });
  };

  Scroller.prototype.updateScrollSpeed = function(){
    var self = this;

    this.animationReady = false;
    this.wrap.classList.add('hidden-init');

    setTimeout(function(){
      var first;
      var direction;
      var wrapperWidth;
      var wrapperHeight;
      var trackWidth;
      var trackHeight;
      var pxPerSec;
      var totalDistance;
      var duration;

      if (!self.wrap || !self.track || !self.scrollers.length) return;

      first = self.scrollers[0] || {};
      direction = first.direction || 'left';

      self.track.classList.remove('left');
      self.track.classList.remove('right');
      self.track.classList.add(direction === 'right' ? 'right' : 'left');
      self.resolveStableLogoOffset(function(){
        wrapperWidth = self.wrap.offsetWidth - self.getReservedLogoWidth();
        wrapperHeight = self.wrap.offsetHeight;
        trackWidth = self.track.scrollWidth;
        trackHeight = self.track.scrollHeight;

        pxPerSec = 120;

        if (direction === 'left' || direction === 'right') {
          totalDistance = wrapperWidth + trackWidth;
          duration = totalDistance / pxPerSec;
          self.track.style.setProperty('--start', wrapperWidth + 'px');
          self.track.style.setProperty('--trackWidth', trackWidth + 'px');
        } else {
          totalDistance = wrapperHeight + trackHeight;
          duration = totalDistance / pxPerSec;
          self.track.style.setProperty('--start', wrapperHeight + 'px');
          self.track.style.setProperty('--trackHeight', trackHeight + 'px');
        }

        self.track.style.animationDuration = duration.toFixed(2) + 's';
        self.track.style.animationTimingFunction = 'linear';
        self.track.style.willChange = 'transform';
        self.track.style.transform = 'translate3d(0, 0, 0)';

        requestAnimationFrame(function(){
          self.animationReady = true;
          self.wrap.classList.remove('hidden-init');

          setTimeout(function(){
            self.startLogoTracking();
          }, 20);
        });
      });
    }, 200);
  };

  Scroller.prototype.startLogoTracking = function(){
    var self = this;
    var triggers;
    var wrapper;

    if (this.rafId) cancelAnimationFrame(this.rafId);

    if (!this.wrap || !this.track) return;
    wrapper = this.wrap;
    triggers = Array.prototype.slice.call(this.track.querySelectorAll('.logo-trigger'));

    function loop(){
      var wrapperRect;
      var triggerX;
      var i;
      var trigger;
      var index;
      var rect;

      wrapperRect = wrapper.getBoundingClientRect();
      triggerX = wrapperRect.left + self.getReservedLogoWidth();

      for (i = 0; i < triggers.length; i++) {
        trigger = triggers[i];
        index = Number(trigger.getAttribute('data-index'));
        rect = trigger.getBoundingClientRect();

        if (rect.left <= triggerX && rect.right > triggerX) {
          self.onScrollerHitLeft(index);
        }
      }

      self.rafId = requestAnimationFrame(loop);
    }

    loop();
  };

  Scroller.prototype.onScrollerHitLeft = function(index){
    var scroller;

    if (this.stickyFromIndex === index) return;

    scroller = this.scrollers[index];
    if (!scroller) return;

    if (scroller.logo) {
      this.syncStickyLogo(scroller.logo, index);
    } else {
      this.clearStickyLogo();
    }

    this.updateLogoOffset();
  };

  Scroller.prototype.updateLogoOffset = function(){
    var width = this.getReservedLogoWidth();
    var offset = width > 0 ? (width + this.logoGap) : 0;

    if (!this.wrap) return;
    this.wrap.style.setProperty('--logo-offset', offset + 'px');
  };

  Scroller.prototype.setStickyLogo = function(url, index){
    this.stickyLogo = url;
    this.stickyFromIndex = index;
    this.stickyLogoMeasured = false;

    this.logoImg.src = url;
    this.logoWrap.style.display = 'flex';
    this.updateLogoOffset();
  };

  Scroller.prototype.clearStickyLogo = function(){
    this.stickyLogo = null;
    this.stickyFromIndex = null;
    this.stickyLogoWidth = 0;
    this.stickyLogoMeasured = false;

    this.logoImg.removeAttribute('src');
    this.logoWrap.style.display = 'none';
    this.updateLogoOffset();
  };

  Scroller.prototype.calcPadding = function(scroller){
    var size = this.resolveFontSize(scroller && scroller.fnsize);
    var vertical = size * 0.5;
    var horizontal = size * 2;

    if (size > 35) {
      vertical = size * 0.6;
    }

    return vertical + 'px ' + horizontal + 'px';
  };

  Scroller.prototype.destroy = function(){
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.track && this.iterationHandler) {
      this.track.removeEventListener('animationiteration', this.iterationHandler);
    }

    this.iterationHandler = null;
  };

  window.ScrollerBar = Scroller;
})(window, Dom, loadFontDynamically, Logger);
