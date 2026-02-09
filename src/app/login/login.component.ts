import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { clienturl } from '../api-base';
import { DeviceInfoService } from '../_core/services/device-info.service';
import { AuthService } from '../_core/services/auth.service';
import { ToastService } from '../_core/services/toast.service';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LoggerService } from '../_core/services/logger.service';


const BASE_API = clienturl.WEB_URL();

export class MyErrorStateMatcher implements ErrorStateMatcher {
	isErrorState(control: any, form: any): boolean {
		const isSubmitted = form && form.submitted;
		return !!(control && control.invalid && (control.dirty || control.touched || isSubmitted));
	}
}

declare var QRCode: any;

@Component({
	selector: 'app-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
	deviceForm!: FormGroup;
	deviceUID: string | null = null;
	matcher = new MyErrorStateMatcher();
	// isVideoPlayed: boolean = sessionStorage.getItem("isVideoPlayed") === "true";
	isOpenSwalAlert = false;
	type: string | null = null;
	text: string | null = null;
	isExistedCalled = false;
	isAnyPopped = false;
	isSubmitted = false;
	isLoggedin = false;
	version = clienturl.CURRENT_VERSION();
	contact = "Lumocast Digital Signage Pvt Ltd | Support@Cansignage.Com | +91 91523 98498";

	private uidSub: any;
	private checkDeviceAndNavigateInterval: any;
	private dialogCheckInterval: any;
	private isChecking = false;
	userName: String | null = null;

	private readonly QR_PERCENT = 0.35; // 30% of device width


	constructor(
		private deviceInfoService: DeviceInfoService,
		private authService: AuthService,
		private router: Router,
		private toastService: ToastService,
		private fb: FormBuilder,
		private matDialog: MatDialog,
		private logger: LoggerService
	) {
		this.logger.info('Login.constructor', 'Login component created');
	}

	ngOnInit(): void {
		this.logger.info('ngOnInit', 'Login initialized', {
			// isVideoPlayed: this.isVideoPlayed,
			version: this.version
		});

		this.deviceForm = this.fb.group({
			deviceCode: ['', [Validators.required, Validators.pattern(/^IQW[0-9]+$/i)]]
		});

		const savedUsername = localStorage.getItem('rememberDevice') === 'true' ? localStorage.getItem('username') : 'IQW000';
		this.userName = savedUsername;
		this.deviceForm.get('deviceCode')?.setValue(savedUsername);

		//  Subscribe to device UID changes
		this.uidSub = this.deviceInfoService.deviceUID$.subscribe(uid => {
			if (uid) {
				this.deviceUID = uid;
				this.logger.info('DeviceUID', 'Device UID received', uid);
				this.generateQRCode(uid);
			}
		});

		//  Start periodic UI checks for dialogs
		this.dialogCheckInterval = setInterval(() => {
			this.isAnyPopped = this.matDialog.openDialogs.length > 0;
			if (this.isAnyPopped || this.isLoggedin) {
				this.deviceForm.get('deviceCode')?.disable({ emitEvent: false });
			} else {
				this.deviceForm.get('deviceCode')?.enable({ emitEvent: false });
			}
		}, 2000);

		//  Start device verification loop after video played
		// if (this.isVideoPlayed) {
		// 	this.logger.info('ngOnInit', 'Video already played → starting device check');
		// 	this.startDeviceCheckInterval();
		// }
		this.startDeviceCheckInterval();
	}

	@HostListener('document:visibilitychange')
	onVisibilityChange() {
		if (!document.hidden) {
			const savedUsername = localStorage.getItem('username');
			if (savedUsername) {
				this.deviceForm.get('deviceCode')?.setValue(savedUsername, { emitEvent: false });
			}
		}
	}


	ngAfterViewInit(): void {
		// const video: HTMLVideoElement | null = document.getElementById("launchervideo") as HTMLVideoElement;
		// if (!video) {
		// 	this.logger.warn('Video', 'Launcher video element not found');
		// 	return;
		// }

		// video.muted = true;
		// video.addEventListener("canplay", () => {
		// 	this.logger.info('Video', 'Launcher video ready → autoplay');
		// 	video.play().then(() => {
		// 		video.muted = false;
		// 	}).catch(err => console.log("Autoplay blocked:", err));
		// });

		// video.addEventListener("ended", () => {
		// 	this.logger.info('Video', 'Launcher video ended');
		// 	// this.isVideoPlayed = true;
		// 	sessionStorage.setItem("isVideoPlayed", "true");
		// 	setTimeout(() => {
		// 		this.router.navigateByUrl('/login', { replaceUrl: true });
		// 		this.startDeviceCheckInterval();
		// 	}, 1000);
		// });
	}

	ngOnDestroy(): void {
		this.logger.warn('ngOnDestroy', 'Login destroyed');
		if (this.uidSub) this.uidSub.unsubscribe();
		if (this.dialogCheckInterval) clearInterval(this.dialogCheckInterval);
		if (this.checkDeviceAndNavigateInterval) clearInterval(this.checkDeviceAndNavigateInterval);
	}

	//  Start periodic verification
	private startDeviceCheckInterval(): void {
		if (this.checkDeviceAndNavigateInterval) return; // prevent duplicates

		this.logger.info('DeviceCheck', 'Starting device verification loop');

		this.checkDeviceAndNavigate(); // first immediate check
		this.checkDeviceAndNavigateInterval = setInterval(() => {
			this.checkDeviceAndNavigate();
		}, 5000);
	}

	//  Main Device Verification Logic
	private checkDeviceAndNavigate(): void {
		if (this.isChecking || !this.deviceUID) return;
		this.isChecking = true;
		this.logger.info('DeviceCheck', 'Verifying device', this.deviceUID);

		this.authService.isExistedDevice(this.deviceUID).subscribe({
			next: (res: any) => {
				this.logger.info('DeviceCheck', 'Verification response', {
					status: res?.status,
					client_status: res?.client_status,
					device_status: res?.device_status,
					expired: res?.isexpired
				});

				if (res?.status === "success") {
					const { client_status, device_status, isexpired } = res;
					sessionStorage.setItem("device", JSON.stringify(res));
					sessionStorage.setItem("username", res.username);
					this.isLoggedin = true;

					if (client_status && device_status && !isexpired) {
						if (!this.isExistedCalled) {
							this.toastService.success("Device verified successfully!!");
							this.logger.info('Login', 'Device verified → navigating to player');
							this.isExistedCalled = true;
						}
						clearInterval(this.checkDeviceAndNavigateInterval);
						this.checkDeviceAndNavigateInterval = null;
						this.router.navigate(['/player'], { replaceUrl: true });
					} else {
						this.isOpenSwalAlert = true;
						this.logger.warn('Login', 'Device not approved / expired', res);
						if (!client_status) {
							this.type = "Approval Pending...!";
							this.text = "Please wait until your profile is approved by admin.";
						} else if (!device_status) {
							this.type = "Approval Pending...!";
							this.text = "Please wait until your device is approved by admin.";
						} else if (isexpired) {
							this.type = "Subscription Expired...!";
							this.text = "Subscription expired. Please contact admin.";
						}
						sessionStorage.setItem("isLogin", "true");
					}
				} else {
					this.isOpenSwalAlert = false;
					if (!this.isExistedCalled && this.userName === 'IQW000') {
						this.toastService.error(res?.message || "Device verification failed!!");
						this.isExistedCalled = true;
					}
					this.isLoggedin = false;
					sessionStorage.setItem("isLogin", "false");
				}
			},
			error: err => {
				this.logger.error('DeviceCheck', 'Verification failed', err);
				this.toastService.error("Server Not Responding!");
				//  IMPORTANT: reset checking flag on failure
				this.isChecking = false;
			},
			complete: () => {
				this.isChecking = false;
			}
		});
	}

	private generateQRCode(uid: string): void {
		const qrcodeEl = document.getElementById("qrcode");
		if (!qrcodeEl) return;

		qrcodeEl.innerHTML = "";

		const deviceWidth = window.innerWidth;
		let qrSize: number;

		// 32" HD
		if (deviceWidth <= 1366) {
			qrSize = Math.floor(deviceWidth * 0.45); // ~300–340px
		}
		// 43" FHD (REFERENCE)
		else if (deviceWidth <= 1920) {
			qrSize = 430;
		}
		// 55" / 65"
		else if (deviceWidth <= 2560) {
			qrSize = 480;
		}
		// 4K and above
		else {
			qrSize = 520; // capped
		}

		console.log(qrSize);
		
		this.logger.info('QRCode', 'Generating QR code', {
			uid,
			deviceWidth,
			qrSize
		});

		new QRCode(qrcodeEl, {
			text: `${BASE_API}#/iqworld/digitalsignage/device/registrationform/${uid}`,
			width: qrSize,
			height: qrSize,
			correctLevel: QRCode.CorrectLevel.H
		});
	}


	@HostListener('window:resize')
	onResize() {
		if (this.deviceUID) {
			this.generateQRCode(this.deviceUID);
		}
	}


	toUppercase(event: any): void {
		const value = event.target.value.toUpperCase();
		this.deviceForm.get('deviceCode')?.setValue(value, { emitEvent: false });
	}

	submit(): void {
		this.isSubmitted = true;
		//  OFFLINE CHECK (single-line logical guard)
		if (!navigator.onLine) {
			this.toastService.error("No internet connection. Please connect to network and try again.");
			return;
		}

		if (!this.deviceForm.valid || !this.deviceUID) {
			this.logger.warn('Submit', 'Invalid form submit', {
				valid: this.deviceForm.valid,
				uid: this.deviceUID
			});

			this.toastService.info("Invalid form");
			return;
		}

		const code = this.deviceForm.value.deviceCode;

		this.logger.info('Submit', 'Registering device', {
			code,
			uid: this.deviceUID
		});

		this.authService.signup(code, this.deviceUID).subscribe({
			next: (res: any) => {
				if (res?.status === 'Failed') {
					this.toastService.error(res.message);
				} else {
					this.toastService.success(res.message);
					this.isExistedCalled = false;
					this.checkDeviceAndNavigate();
				}
				this.isSubmitted = false;
			},
			error: () => {
				//  NETWORK / SERVER FAILURE HANDLING
				this.toastService.error("Network error. Please check internet connection.");
				this.isSubmitted = false;
			}
		});
	}
}
