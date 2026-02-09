import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { DeviceInfoService } from '../services/device-info.service';
import { ToastService } from '../services/toast.service';

@Injectable({
  providedIn: 'root'
})
export class LoginRedirectGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private deviceInfoService: DeviceInfoService,
    private router: Router,
    private toastService: ToastService,
  ) { }

  canActivate(): Observable<boolean> {

    const splashDone = sessionStorage.getItem('isVideoPlayed') === 'true';
    if (!splashDone) {
      return of(true);
    }

    return this.deviceInfoService.waitForDeviceUID().pipe(

      // 🔹 Now UID is GUARANTEED to exist
      switchMap((uid: string) => {

        return this.authService.isExistedDevice(uid).pipe(

          map((res: any) => {

            if (res?.status === 'success' && res?.client_status && res?.device_status && !res?.isexpired) {
              sessionStorage.setItem('device', JSON.stringify(res));
              sessionStorage.setItem('username', res.username);
              this.toastService.success("Device verified successfully!!");
              // 🚫 BLOCK login route
              this.router.navigate(['/player'], { replaceUrl: true });
              return false;
            }

            // ❌ Not verified → allow login
            return true;
          }),

          catchError(() => {
            this.router.navigate(['/offline'], { replaceUrl: true });
            return of(false);
          })
        );
      })
    );
  }
}
