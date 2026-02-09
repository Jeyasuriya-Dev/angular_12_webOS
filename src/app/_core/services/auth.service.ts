import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { of, interval, BehaviorSubject, Subscription } from 'rxjs';
import { catchError, switchMap, tap, filter, take } from 'rxjs/operators';

import { clienturl } from 'src/app/api-base';
import { LoggerService } from '../services/logger.service';
const TOKEN_KEY = 'auth-token';
const SERVER_URL: any = clienturl.SERVER_URL();
const BASE_URL: any = clienturl.BASE_URL()
const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  serverInfo = this.getServerDetails();
  constructor(private http: HttpClient, private logger: LoggerService) {
    this.logger.info('AuthService.constructor', 'AuthService initialized');
  }
  getServerDetails() {
    this.logger.info('getServerDetails', 'Resolving server URL');
    return this.http.get(SERVER_URL, httpOptions).pipe(
      // if success, use server response
      switchMap((res: any) => {
        if (res?.application_url) {
          return of(res);
        }
        // fallback if response doesn't contain application_url
        return of({ application_url: BASE_URL });
      }),
      // if request fails, fallback to BASE_URL
      catchError((err: any) => {
        console.error("getServerDetails() failed, using BASE_URL", err);
        return of({ application_url: BASE_URL });
      })
    );
  }

  
  isExistedDevice(android_id: any) {
    this.logger.info('isExistedDevice', 'Checking device existence', {
      hasAndroidId: !!android_id
    });
    return this.getServerDetails().pipe(
      switchMap((res: any) => {
        return this.http.get(
          res.application_url + "api/v1/none-auth/device/isexist?android_id=" + android_id
        );
      })
    );
  }
  signin(payload: any) {
    this.logger.info('signin', 'Signin request initiated', {
      hasUsername: !!payload?.username
    });
    return this.getServerDetails().pipe(
      switchMap((res: any) => {
        return this.http.post(
          res.application_url + "api/auth/signin",
          payload,
          httpOptions
        );
      })
    );
  }
  signup(uniqueNumber: any, deviceUID: any) {
    this.logger.info('signup', 'Device signup initiated', {
      hasUniqueNumber: !!uniqueNumber,
      hasDeviceUID: !!deviceUID
    });
    return this.getServerDetails().pipe(
      switchMap((res: any) => {
        return this.http.get(
          `${res?.application_url}api/v1/none-auth/updatedeviceandroid?uniq=${uniqueNumber}&android_id=${deviceUID}`
        );
      })
    );
  }

  getMediafiles(payload: any) {
    this.logger.info('getMediafiles', 'Fetching media files', {
      client: payload?.clientusername,
      device: payload?.username,
      vertical: payload?.isVertical
    });
    return this.getServerDetails().pipe(
      switchMap((res: any) => {
        return this.http.get(
          `${res?.application_url}api/v1/playlist/mediafilebyclientforsplit?clientname=${payload.clientusername}&state_id=${payload.state_id}&city_id=${payload.city_id}&androidid=${payload.androidid}&deviceid=${payload.username}&vertical=${payload.isVertical}`
        );
      })
    );
  }
  logout(result: any) {
    let deviceUID = sessionStorage.getItem('username') || localStorage.getItem('username');
    this.logger.warn('logout', 'Logout initiated', {
      isConfirmed: result?.isConfirmed,
      isDenied: result?.isDenied,
      hasDeviceUID: !!deviceUID
    });
    if (result.isConfirmed) {
      if (deviceUID) {
        localStorage.setItem('username', deviceUID); // keep a copy in localStorage
      }
    } else if (result.isDenied) {
      localStorage.removeItem('username'); // just remove directly
    }

    // Always clear session
    sessionStorage.removeItem("device");
    sessionStorage.setItem("isVideoPlayed", "true");

    console.log('Device UID:', deviceUID);

    // If no deviceUID found, avoid sending bad request
    if (!deviceUID) {
      return of({ message: 'No device UID found, skipping logout request' });
    }

    // Call API after clearing storage
    return this.getServerDetails().pipe(
      switchMap((res: any) => {
        const url = `${res?.application_url}api/v1/device/logout?deviceid=${deviceUID}`;
        return this.http.get(url);
      })
    );
  }


  getNetworkInfo(payload: any) {
    this.logger.info('getNetworkInfo', 'Checking network status', {
      hasAndroidId: !!payload?.androidid
    });
    return this.getServerDetails().pipe(
      switchMap((res: any) => {
        return this.http.get(
          `${res?.application_url}api/v1/device/checkonline?adrid=${payload.androidid}&clientname=${payload.clientusername}`
        );
      })
    );
  }

  public saveToken(token: string): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(TOKEN_KEY, token);
    this.logger.info('Token', 'Auth token saved');
  }

  public getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }
}
