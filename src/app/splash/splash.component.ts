import { AfterViewInit, Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoggerService } from '../_core/services/logger.service';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss']
})
export class SplashComponent implements AfterViewInit {

  constructor(
    private router: Router,
    private logger: LoggerService
  ) { }

  ngAfterViewInit(): void {

    document.addEventListener('keydown', this.blockKeys, true);

    const video = document.getElementById('launchervideo') as HTMLVideoElement;

    if (!video) {
      this.logger.warn('Splash', 'Launcher video not found');
      this.cleanupAndNavigate();
      this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    video.muted = true;

    video.addEventListener('canplay', () => {
      video.play().then(() => {
        video.muted = false;
      }).catch(() => { });
    });

    video.addEventListener('ended', () => {
      this.logger.info('Splash', 'Launcher video ended');
      sessionStorage.setItem('isVideoPlayed', 'true');
      this.cleanupAndNavigate();
      this.router.navigateByUrl('/login', { replaceUrl: true });
    });
  }

  private blockKeys = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  private cleanupAndNavigate() {
    // 🔓 Re-enable keys
    document.removeEventListener('keydown', this.blockKeys, true);

    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  ngOnDestroy(): void {
    // Safety cleanup
    document.removeEventListener('keydown', this.blockKeys, true);
  }
}
