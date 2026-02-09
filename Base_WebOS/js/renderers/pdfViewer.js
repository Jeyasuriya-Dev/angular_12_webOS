(function(window){
  // Minimal .at() polyfill for Array, String, and typed arrays (webOS browser lacks it)
  (function(){
    function defineAt(proto){
      if (proto && !proto.at) {
        Object.defineProperty(proto, 'at', {
          value: function(n){
            var len = this.length >>> 0;
            var k = Number(n);
            if (isNaN(k)) k = 0;
            if (k < 0) k = len + k;
            if (k < 0 || k >= len) return undefined;
            return this[k];
          },
          writable: true,
          configurable: true
        });
      }
    }
    defineAt(Array.prototype);
    defineAt(String.prototype);
    if (window.Int8Array) ['Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array','Int32Array','Uint32Array','Float32Array','Float64Array','BigInt64Array','BigUint64Array']
      .forEach(function(name){
        if (window[name] && window[name].prototype) defineAt(window[name].prototype);
      });
  })();
  var PDF_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var pdfLibLoading = false;
  var pdfLibReady = !!window.pdfjsLib;
  var pendingCallbacks = [];

  function normalizeUrl(url){
    var next = String(url || '').trim();
    if (!next) return '';

    try {
      return encodeURI(decodeURI(next));
    } catch (_) {
      try {
        return encodeURI(next);
      } catch (__) {
        return next;
      }
    }
  }

  function ensurePdfLib(cb){
    if (pdfLibReady && window.pdfjsLib) {
      cb(true);
      return;
    }

    pendingCallbacks.push(cb);

    if (pdfLibLoading) return;
    pdfLibLoading = true;

    var script = document.createElement('script');
    script.src = PDF_SCRIPT_URL;
    script.async = true;

    script.onload = function(){
      pdfLibLoading = false;
      pdfLibReady = !!window.pdfjsLib;

      if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
        window.pdfjsLib.GlobalWorkerOptions.disableWorker = true;
        window.pdfjsLib.disableWorker = true;
      }

      flushCallbacks(pdfLibReady);
    };

    script.onerror = function(){
      pdfLibLoading = false;
      flushCallbacks(false);
    };

    document.head.appendChild(script);
  }

  function flushCallbacks(ok){
    var list = pendingCallbacks.slice(0);
    var i;
    pendingCallbacks = [];

    for (i = 0; i < list.length; i++) {
      list[i](ok);
    }
  }

  function PdfViewer(opts){
    opts = opts || {};

    this.rawUrl = opts.url || '';
    this.url = normalizeUrl(this.rawUrl);
    this.loop = !!opts.loop;
    this.onEnd = opts.onEnd || function(){};
    this.container = opts.container;

    this.interval = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.loadingTask = null;
    this.pdfDoc = null;
    this.canvas = null;
    this.ctx = null;
    this._destroyed = false;

    this.render();
  }

  PdfViewer.prototype.render = function(){
    var self = this;

    if (!this.container) return;

    this.cleanup();
    this.container.innerHTML = '';

    ensurePdfLib(function(loaded){
      if (self._destroyed) return;

      if (!loaded || !window.pdfjsLib) {
        self.renderFallbackIframe();
        return;
      }

      self.renderWithPdfJs();
    });
  };

  PdfViewer.prototype.renderWithPdfJs = function(){
    var self = this;
    var wrapper = document.createElement('div');
    var firstPageRendered = false;
    var firstPageTimeout;

    wrapper.className = 'pdf-viewer-wrapper';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.background = '#000';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pdf-viewer-canvas';
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.maxHeight = '100%';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    wrapper.appendChild(this.canvas);
    this.container.innerHTML = '';
    this.container.appendChild(wrapper);
    this.ctx = this.canvas.getContext('2d');

    this.loadPdfDocument().then(function(pdf){
      if (self._destroyed) return;

      self.pdfDoc = pdf;
      self.totalPages = pdf.numPages || 0;
      self.currentPage = 1;

      if (self.totalPages <= 0) {
        self.onEnd({ success: false, message: 'Could not detect pages in PDF' });
        return;
      }

      self.renderPage(self.currentPage).then(function(){
        firstPageRendered = true;
        setTimeout(function(){
          if (!self._destroyed) self.startSlideShow();
        }, 400);
      }).catch(function(err){
        if (!self._destroyed) {
          self.renderFallbackIframe();
        }
      });

      // If first page not rendered quickly, fallback to iframe to avoid blank screen.
      firstPageTimeout = setTimeout(function(){
        if (self._destroyed || firstPageRendered) return;
        self.renderFallbackIframe();
      }, 2000);
    }).catch(function(){
      if (!self._destroyed) {
        self.renderFallbackIframe();
      }
    });
  };

  PdfViewer.prototype.getUrlCandidates = function(){
    var list = [];
    var raw = String(this.rawUrl || '').trim();
    var normalized = normalizeUrl(raw);

    if (raw) list.push(raw);
    if (normalized && normalized !== raw) list.push(normalized);
    if (!list.length && this.url) list.push(this.url);

    return list;
  };

  PdfViewer.prototype.loadPdfDocument = function(){
    var self = this;
    var sources = this.getUrlCandidates();
    var index = 0;

    function tryNext(){
      var source;

      if (index >= sources.length) {
        return Promise.reject(new Error('Unable to load PDF source'));
      }

      source = sources[index++];
      self.url = source;
      self.loadingTask = window.pdfjsLib.getDocument({
        url: source,
        useWorkerFetch: false,
        disableStream: true,
        disableRange: true,
        isEvalSupported: false
      });

      return self.loadingTask.promise.catch(function(){
        if (self._destroyed) {
          return Promise.reject(new Error('Destroyed'));
        }
        return tryNext();
      });
    }

    return tryNext();
  };

  PdfViewer.prototype.renderPage = function(pageNum){
    var self = this;

    if (!this.pdfDoc || !this.ctx || !this.canvas) {
      return Promise.reject(new Error('PDF not initialized'));
    }

    return this.pdfDoc.getPage(pageNum).then(function(page){
      if (self._destroyed) return;

      var viewport = page.getViewport({ scale: 1 });
      var targetW = self.container.clientWidth || window.innerWidth || viewport.width;
      var targetH = self.container.clientHeight || window.innerHeight || viewport.height;
      var scale = Math.min(targetW / viewport.width, targetH / viewport.height);

      if (!isFinite(scale) || scale <= 0) scale = 1;

      viewport = page.getViewport({ scale: scale });
      self.canvas.width = Math.floor(viewport.width);
      self.canvas.height = Math.floor(viewport.height);

      return page.render({ canvasContext: self.ctx, viewport: viewport }).promise;
    });
  };

  PdfViewer.prototype.startSlideShow = function(){
    var self = this;

    this.cleanupInterval();

    this.interval = setInterval(function(){
      if (self._destroyed) return;

      if (self.currentPage < self.totalPages) {
        self.currentPage += 1;
        self.renderPage(self.currentPage).catch(function(){});
        return;
      }

      if (self.loop) {
        self.currentPage = 1;
        self.renderPage(self.currentPage).catch(function(){});
        return;
      }

      self.cleanupInterval();
      self.onEnd({ success: true, message: 'Slideshow completed' });
    }, 10000);
  };

  PdfViewer.prototype.renderFallbackIframe = function(){
    var self = this;
    var iframe = document.createElement('iframe');

    iframe.src = this.url;
    iframe.frameBorder = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';

    this.container.innerHTML = '';
    this.container.appendChild(iframe);

    this.cleanupInterval();

    this.interval = setTimeout(function(){
      if (self._destroyed) return;

      if (self.loop) {
        self.renderFallbackIframe();
      } else {
        self.onEnd({ success: true, message: 'Slideshow completed' });
      }
    }, 10000);
  };

  PdfViewer.prototype.cleanupInterval = function(){
    if (this.interval) {
      clearInterval(this.interval);
      clearTimeout(this.interval);
      this.interval = null;
    }
  };

  PdfViewer.prototype.cleanup = function(){
    this.cleanupInterval();
    this.currentPage = 1;
    this.totalPages = 0;
    if (this.loadingTask && this.loadingTask.destroy) {
      try { this.loadingTask.destroy(); } catch (_) {}
    }
    this.loadingTask = null;
    this.pdfDoc = null;
    this.canvas = null;
    this.ctx = null;
  };

  PdfViewer.prototype.destroy = function(){
    if (this._destroyed) return;
    this._destroyed = true;

    this.cleanup();

    if (this.container) {
      this.container.innerHTML = '';
    }
  };

  window.PdfViewer = PdfViewer;
})(window);
