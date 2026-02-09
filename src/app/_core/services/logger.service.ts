import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly appTag = '📺 IQ-TV';
  private enabled = false;
  private pollStarted = false;
  private pollHandle: any;

  constructor(private http: HttpClient) {
    this.bootstrapRemoteToggle();
  }

  log(method: string, message: string, data?: any) {
    if (this.enabled) {
      console.log(this.format('LOG', method, message), data ?? '');
    }
  }

  info(method: string, message: string, data?: any) {
    if (this.enabled) {
      console.info(this.format('INFO', method, message), data ?? '');
    }
  }

  warn(method: string, message: string, data?: any) {
    if (this.enabled) {
      console.warn(this.format('WARN', method, message), data ?? '');
    }
  }

  error(method: string, message: string, error?: any) {
    if (this.enabled) {
      console.error(this.format('ERROR', method, message), error ?? '');
    }
  }

  private format(level: string, method: string, message: string): string {
    const time = new Date().toISOString();
    return `${this.appTag} [${level}] ${time} :: ${method} → ${message}`;
  }

  /**
   * Fetch remote logger toggle. Only when API returns { logger: 'production' }
   * will the logger output anything. Any other value disables logging.
   */
  private bootstrapRemoteToggle() {
    if (this.pollStarted) return;
    this.pollStarted = true;

    const url = 'https://ds.iqtv.in:8080/iqworld/api/v1/logger';
    const fetchToggle = () => {
      this.http.get<{ logger?: string }>(url).subscribe({
        next: res => {
          this.enabled = res?.logger === 'production';
        },
        error: () => {
          this.enabled = false;
        }
      });
    };

    // initial fetch immediately
    fetchToggle();
    // refresh every 5 seconds
    this.pollHandle = setInterval(fetchToggle, 5000);
  }
}
