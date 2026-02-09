import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-ytplayer',
  templateUrl: './ytplayer.component.html',
  styleUrls: ['./ytplayer.component.scss']
})
export class YtplayerComponent
  implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() url!: string;
  @Input() index!: number;
  @Output() videoEnded = new EventEmitter<{ success: boolean; message?: string }>();
  @Output() videoReady = new EventEmitter<{ duration: number }>();
  @Output() durationFound = new EventEmitter<number>();
  @Input() loop: boolean = false;

  player: YT.Player | null = null;
  private _alive = true;

  ngOnInit(): void {
    this.loadYouTubeAPI();
  }

  ngAfterViewInit(): void {
    // delay slightly so container is attached
    setTimeout(() => this.initPlayer(), 50);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['url'] && !changes['url'].firstChange) ||
      (changes['index'] && !changes['index'].firstChange)) {
      // destroy and recreate on input change
      this.destroyPlayer();
      setTimeout(() => this.initPlayer(), 60);
    }
  }

  ngOnDestroy(): void {
    this._alive = false;
    this.destroyPlayer();
  }

  private loadYouTubeAPI(): void {
    if (!window['YT'] || !window['YT'].Player) {
      // inject only once
      if (!document.getElementById('youtube-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      // attach a single callback that will call initPlayer for this instance if alive
      (window as any).onYouTubeIframeAPIReady = () => {
        // only init if component is still mounted
        if (this._alive) {
          setTimeout(() => this.initPlayer(), 30);
        }
      };
    } else {
      // API already present
      setTimeout(() => this.initPlayer(), 20);
    }
  }

  private initPlayer(): void {
    // guard: only init if API ready and component still alive
    if (!this._alive) return;
    if (!window['YT'] || !window['YT'].Player) {
      // API not ready yet
      return;
    }

    // clear any existing player and DOM
    this.destroyPlayer();

    const videoId = this.getYouTubeVideoID(this.url);
    if (!videoId) return;

    const containerId = `ytplayer-${this.index}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      // create new player
      this.player = new window['YT'].Player(container, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin || "https://www.youtube.com",
          showinfo: 0,
          iv_load_policy: 3,
          fs: 0,
          cc_load_policy: 0
        },
        events: {
          onReady: (event: YT.PlayerEvent) => this.handleReady(event),
          onStateChange: (event: YT.OnStateChangeEvent) => this.handleStateChange(event),
          onError: (event: YT.OnErrorEvent) => this.onPlayerError(event)
        }
      });
    } catch (err) {
      console.error("Failed to create YT.Player:", err);
    }
  }

  private handleReady(event: YT.PlayerEvent) {
    const target = event.target;
    if (!target) return;

    try {
      const duration = target.getDuration();
      this.videoReady.emit({ duration });

      // Start muted (TV autoplay policy), then try unmute after stable period
      if (target.mute) target.mute();
      if (target.playVideo) target.playVideo();

      // Give TVs extra time to fully attach iframe before unmuting
      setTimeout(() => {
        try { if (target && target.unMute) target.unMute(); } catch (e) { }
      }, 1400);
    } catch (e) {
      console.log("YT ready handler error:", e);
    }
  }

  private handleStateChange(event: YT.OnStateChangeEvent) {

    if (event.data === window['YT'].PlayerState.ENDED) {
      if (this.loop && this.player) {
        try {
          this.player.seekTo(0, true);
          this.player.playVideo();
        } catch (e) { }
      } else {
        this.videoEnded.emit({ success: true });
      }
    }
  }

  onPlayerError(event: any) {
    let message = '';
    switch (event.data) {
      case 2:
        message = "Invalid parameter (bad videoId)";
        break;
      case 5:
        message = "HTML5 player error";
        break;
      case 100:
        message = "Video not found (removed/private)";
        break;
      case 101:
      case 150:
      case 153:
        message = "Embedding not allowed by video owner";
        break;
      default:
        message = `Unknown error: ${event.data}`;
    }
    console.log(message);
    this.videoEnded.emit({ success: false, message });
  }

  private destroyPlayer(): void {
    try {
      if (this.player && this.player.destroy) {
        this.player.destroy();
      }
    } catch (err) {
      console.log("Error while destroying YT player:", err);
    } finally {
      this.player = null;

      // also remove any iframe nodes left in the container to ensure a fresh DOM next time
      const containerId = `ytplayer-${this.index}`;
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    }
  }

  getYouTubeVideoID(url: any) {
    if (!url) return null;
    const regex = [
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

    for (const reg of regex) {
      const match = (url || '').toString().match(reg);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }
}
