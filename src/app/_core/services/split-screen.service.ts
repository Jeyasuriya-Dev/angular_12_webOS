import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SplitScreenService {

  private pendriveTrigger = new Subject<void>();

  pendriveTrigger$ = this.pendriveTrigger.asObservable();
  triggerPendriveSettings() {
    this.pendriveTrigger.next();
  }
}
