//split-screen.component.ts
import { Component, OnInit, OnDestroy, ViewChild, TemplateRef, Injectable, ChangeDetectorRef, NgZone } from '@angular/core';
import { GridsterConfig, GridsterItem } from 'angular-gridster2';
import { AuthService } from '../_core/services/auth.service';
import { DeviceInfoService } from '../_core/services/device-info.service';
import { of, interval, BehaviorSubject, Subscription } from 'rxjs';
import { catchError, switchMap, tap, filter, take } from 'rxjs/operators';

import { NavigationEnd, Router } from '@angular/router';
import { ConnectionService, ConnectionState } from 'ng-connection-service';
import { FilesystemService } from '../_core/services/filesystem.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../_core/services/toast.service';
import { SplitScreenService } from '../_core/services/split-screen.service';
import { LoggerService } from '../_core/services/logger.service';

@Injectable({
	providedIn: 'root',
})
@Component({
	selector: 'app-split-screen',
	templateUrl: './split-screen.component.html',
	styleUrls: ['./split-screen.component.scss']
})
export class SplitScreenComponent implements OnInit, OnDestroy {
	status: string = 'ONLINE';
	currentState!: ConnectionState;
	subscription = new Subscription();
	updatedTime: any = '';
	options: GridsterConfig;
	splitScreen: any[] = [];
	splitScreenList: any[] = [];
	zoneinfo: GridsterItem[] | any[] = [];
	device: any;
	private intervalId: any;
	intervalSub?: Subscription;
	isPendriveModePlaying = false;
	isPendriveMode = false;
	isCheckingPendrive = false;
	splitCurrentIndex = 0;
	autoplayTimer?: any;
	noMediaAvailable = false;
	private wasNoMedia = false;
	offlineNoDownloadedMedia = false;
	redirecting = false;
	scrollers: any[] = [];
	topScrollers: any[] = [];
	bottomScrollers: any[] = [];
	rebuildScroller = true;
	dialogRef: any;
	zoneCompletionMap: { [zoneId: number]: boolean } = {};
	isClearCopyContent: any = false;
	isCopyContent: any = false;
	@ViewChild('pendriveErrorDialog') pendriveErrorDialog!: TemplateRef<any>;
	@ViewChild('exitconfirm', { static: true }) exitconfirm!: TemplateRef<any>;
	pendriveDialogRef?: MatDialogRef<any>;
	isPendriveNotDetected = true;
	activeTopScrollerIndex = 0;
	activeBottomScrollerIndex = 0;
	activeTopScroller: any = null;
	activeBottomScroller: any = null;
	topScrollerTimer: any;
	bottomScrollerTimer: any;
	apiFailedNoMediaFallback = false;
	playbackInterruptedByOffline = false;
	private pendriveCheckCount = 0;
	private hasShownCopiedContentToast = false;
	private pendriveCheckInterval?: any;
	private isNormalMode = false;
	isDownloading = false;
	downloadProgress = 0;
	mediacountforServerDefault = 0;
	private lastServerDefaultKey: string | null = null;


	constructor(
		private authService: AuthService,
		private deviceInfoService: DeviceInfoService,
		private router: Router,
		private connectionService: ConnectionService,
		private fsService: FilesystemService,
		private dialog: MatDialog,
		private toastService: ToastService,
		private splitService: SplitScreenService,
		private zone: NgZone,
		private cdr: ChangeDetectorRef,
		private logger: LoggerService
	) {

		this.logger.info('SplitScreen.constructor', 'Component created');

		this.options = {
			draggable: { enabled: false },
			resizable: { enabled: false },
			pushItems: true,
			swap: false,
			gridType: 'fit',
			margin: 0,
			outerMargin: false,
		};

		this.device = JSON.parse(sessionStorage.getItem('device') || '{}');

		this.logger.info('SplitScreen.constructor', 'Device loaded from session', this.device);

		if (this.device?.username && this.device?.password) {
			this.logger.info('SplitScreen.constructor', 'Auto signin triggered');
			this.signin();
		}

		this.isPendriveMode = sessionStorage.getItem('ModeConfiguration') === 'true';

		this.logger.info('SplitScreen.constructor', 'Pendrive mode initial state', this.isPendriveMode);
	}

	//  Initialize component
	ngOnInit(): void {

		this.logger.info('ngOnInit', 'SplitScreen initialized');

		this.isPendriveMode = sessionStorage.getItem('ModeConfiguration') === 'true';
		this.isClearCopyContent = localStorage.getItem("isClearCopyContent") === 'true';
		this.isCopyContent = localStorage.getItem("isCopyContent") === 'true';

		this.logger.info('ngOnInit', 'Initial flags', {
			isPendriveMode: this.isPendriveMode,
			isClearCopyContent: this.isClearCopyContent,
			isCopyContent: this.isCopyContent
		});

		this.checkPendrives();

		if (this.router.url === '/player') {
			this.logger.warn('ngOnInit', 'Back navigation blocked on /player');
			history.pushState(null, '', window.location.href);
			window.addEventListener('popstate', () => {
				history.pushState(null, '', window.location.href);
				this.exitApp();
			});
		}

		this.device.isVertical = this.device?.orientation?.includes('9:16');

		this.deviceInfoService.deviceUID$.subscribe(uid => {
			if (uid) {
				this.logger.info('deviceUID$', 'New Android ID received', uid);
				localStorage.removeItem('splitScreenList');
				this.device.androidid = uid;
				this.loadMediaFiles();
			}
		});
		setInterval(() => {
			this.isPendriveMode = sessionStorage.getItem('ModeConfiguration') === 'true';
		}, 765)
		this.intervalSub = interval(4000).subscribe(() => {
			if (this.device.androidid && !this.isPendriveMode) {
				this.isExistedDevice(this.device.androidid);
				this.checkForUpdates();
			}
		});

		this.subscription.add(
			this.connectionService.monitor().pipe(
				tap((newState: ConnectionState) => {
					this.currentState = newState;
					this.status = newState.hasNetworkConnection ? 'ONLINE' : 'OFFLINE';


					if (this.status === 'ONLINE') {
						this.offlineNoDownloadedMedia = false;
						if (this.playbackInterruptedByOffline) {
							this.logger.info(
								'Network',
								'Network restored → restarting zone playback'
							);

							this.playbackInterruptedByOffline = false;

							// RESET PLAYBACK STATE (same as after login)
							clearTimeout(this.autoplayTimer);
							this.zoneCompletionMap = {};
							this.splitCurrentIndex = 0;
							this.zoneinfo = [];

							this.router.navigate(['/login'], { replaceUrl: true });
						}
					}

					if (this.status === 'OFFLINE') {
						clearTimeout(this.topScrollerTimer);

						// SAFE EDGE-CASE HANDLING (ADD ONLY THIS BLOCK)
						if (
							!this.isPendriveModePlaying &&
							!this.hasAnyDownloadedMedia()
						) {
							this.logger.warn(
								'Network',
								'Offline with no downloaded media → showing OFFLINE EMPTY UI'
							);


							this.offlineNoDownloadedMedia = true;   //  NEW
							this.playbackInterruptedByOffline = true;
							this.noMediaAvailable = false;          //  keep original untouched

							this.zoneinfo = [];
							this.zoneCompletionMap = {};
							clearTimeout(this.autoplayTimer);
						}
						if (!this.isPendriveModePlaying && this.hasAnyDownloadedMedia()) {

							// ✅ keep only downloaded media
							this.splitScreenList = this.filterDownloadedOnly(this.splitScreenList);

							this.playbackInterruptedByOffline = true;
							// ✅ force zone rebuild immediately
							this.splitCurrentIndex = 0;
							this.zoneCompletionMap = {};
							this.zoneinfo = [];
							clearTimeout(this.autoplayTimer);

							// ✅ re-render zones with offline-safe media
							this.showCurrentSlide();
						}

					}
				})
			).subscribe()
		);

		this.intervalId = setInterval(() => this.checkPendrives(), 3000);

		this.splitService.pendriveTrigger$.subscribe(async () => {
			// console.log('📥 Pendrive trigger received in SplitScreenComponent');
			const fods = await this.fsService.countPendrivesWithIQFolder('IQ');
			const hasPendriveWithIQ = fods.pendrivesWithIQ.length > 0;
			if (hasPendriveWithIQ) {
				const pendrivePath = fods.pendrivesWithIQ[0];
				const fullpath = await this.fsService.getStorageFullPath(pendrivePath);
				await this.pendriveSettings(fullpath);
			}
		});

		this.fsService.getDownloadingState().subscribe(isDownloading => {
			this.isDownloading = isDownloading;
		});

		this.fsService.getDownloadProgress().subscribe(p => {
			this.downloadProgress = p;
		});


	}

	private filterDownloadedOnly(layouts: any[]): any[] {
		return layouts.map(layout => ({
			...layout,
			zonelist: layout.zonelist.map((zone: any) => ({
				...zone,
				media_list: zone.media_list.filter(
					(m: any) =>
						typeof m.downloadedUrl === 'string' &&
						m.downloadedUrl.startsWith('file://')
				)
			}))
		})).filter(layout =>
			layout.zonelist.some((z: any) => z.media_list.length > 0)
		);
	}
	async checkPendrives(): Promise<void> {
		this.logger.log('checkPendrives', 'Checking pendrive status');

		try {
			this.isPendriveMode = sessionStorage.getItem('ModeConfiguration') === 'true';

			if (!this.isPendriveMode) {
				this.logger.info('checkPendrives', 'Pendrive mode OFF');
				// Pendrive mode is OFF
				this.stopPendriveMode();
				this.handlePendriveNotDetected("Pendrive mode off or pendrive removed");
				return;
			}

			// Check for pendrive with "IQ" folder
			const fods = await this.fsService.countPendrivesWithIQFolder('IQ');
			const hasPendriveWithIQ = fods.pendrivesWithIQ.length > 0;

			this.logger.info('checkPendrives', 'Pendrive scan result', {
				hasPendriveWithIQ,
				paths: fods.pendrivesWithIQ
			});

			const destination = '/opt/usr/home/owner/content/Downloads/IQW';
			const files: any = await this.fsService.listAllFilesOnStorage(destination);
			if (hasPendriveWithIQ) {
				//  Real pendrive found
				this.hasShownCopiedContentToast = false;
				this.isPendriveNotDetected = false;
				this.pendriveCheckCount = 0;
				const pendrivePath = fods.pendrivesWithIQ[0];
				const fullpath = await this.fsService.getStorageFullPath(pendrivePath);

				this.logger.info('checkPendrives', 'Starting pendrive mode', fullpath);
				if (!this.isPendriveModePlaying) {
					this.startPendriveMode(pendrivePath);
					await this.pendriveSettings(fullpath);
				}


				if (this.pendriveCheckInterval) {
					clearInterval(this.pendriveCheckInterval);
				}

				// start checking every 3 seconds
				this.pendriveCheckInterval = setInterval(async () => {
					const fods = await this.fsService.countPendrivesWithIQFolder('IQ');
					const hasPendriveWithIQ = fods.pendrivesWithIQ.length > 0;

					if (!hasPendriveWithIQ) {
						clearInterval(this.pendriveCheckInterval);
						this.pendriveCheckInterval = undefined;
						await this.checkPendrives();
					}
				}, 3000);
				return;
			}

			if (!hasPendriveWithIQ && files.length > 0) {
				// ✅ Show toast only once
				if (!this.hasShownCopiedContentToast) {
					this.toastService.info("Playing from copied content");
					this.isPendriveModePlaying = false;
					this.hasShownCopiedContentToast = true;
				}
				this.isPendriveNotDetected = false;
				// ✅ Initialize playback
				if (!this.isPendriveModePlaying) {
					this.isPendriveModePlaying = true;
					this.zoneinfo = [{ cols: 1, height: 0, id: 0, ismute: 'true', media_list: files, rows: 1, width: 0, x: 0, y: 0, }];
				}

				// ✅ Prevent duplicate interval
				if (this.pendriveCheckInterval) return;

				// ✅ Start single stable interval to detect reinsert
				this.pendriveCheckInterval = setInterval(async () => {
					try {
						const fods = await this.fsService.countPendrivesWithIQFolder('IQ');
						const hasPendriveWithIQ = fods.pendrivesWithIQ.length > 0;
						if (hasPendriveWithIQ) {
							this.toastService.info("Pendrive detected!!")
							clearInterval(this.pendriveCheckInterval);
							await new Promise(resolve => setTimeout(resolve, 5000));
							this.pendriveCheckInterval = undefined;
							this.hasShownCopiedContentToast = false;

							const pendrivePath = fods.pendrivesWithIQ[0];
							const fullpath = await this.fsService.getStorageFullPath(pendrivePath);
							await this.pendriveSettings(fullpath);
						}
					} catch (err) {
						console.error('Error in pendrive check interval:', err);
					}
				}, 5000);

				return;
			}

			// ❌ Neither pendrive nor copied content found
			this.handlePendriveNotDetected("Pendrive not detected & no copied content detected");
			// sessionStorage.setItem("ModeConfiguration", "false");
			this.showPendriveDialog("Pendrive not detected & no copied content detected");
			// this.dialog.closeAll();

			// this.zoneinfo = [];

		} catch (err: any) {
			this.logger.error('checkPendrives', 'Pendrive check failed', err);
		} finally {
			this.isCheckingPendrive = false;
		}
	}


	private showPendriveDialog(message: string): void {
		// prevent multiple dialogs
		if (this.pendriveDialogRef || this.pendriveCheckInterval) return;

		// open dialog
		this.pendriveDialogRef = this.dialog.open(this.pendriveErrorDialog, {
			minWidth: '500px',
			disableClose: true,
			data: { title: 'Pendrive Error', message }
		});

		// clear any previous interval before creating a new one
		if (this.pendriveCheckInterval) {
			clearInterval(this.pendriveCheckInterval);
		}

		// start checking every 3 seconds
		this.pendriveCheckInterval = setInterval(async () => {
			const fods = await this.fsService.countPendrivesWithIQFolder('IQ');
			const hasPendriveWithIQ = fods.pendrivesWithIQ.length > 0;
			if (hasPendriveWithIQ) {
				this.toastService.info("Pendrive detected!!");
				const pendrivePath = fods.pendrivesWithIQ[0];
				const fullpath = await this.fsService.getStorageFullPath(pendrivePath);
				// close dialog and stop checking
				await this.pendriveSettings(fullpath);
				this.pendriveDialogRef?.close();
				this.pendriveDialogRef = undefined;
				clearInterval(this.pendriveCheckInterval);
				this.pendriveCheckInterval = undefined;

				await this.checkPendrives();
			}
		}, 3000);

		// when dialog is closed manually
		this.pendriveDialogRef.afterClosed().subscribe(() => {
			this.pendriveDialogRef = undefined;

			// also stop checking when closed
			if (this.pendriveCheckInterval) {
				clearInterval(this.pendriveCheckInterval);
				this.pendriveCheckInterval = undefined;
			}
		});
	}
	// 🔹 Helper: consistent handling when pendrive missing
	private handlePendriveNotDetected(message: string): void {
		this.pendriveCheckCount++;
		if (this.pendriveCheckCount > 1 && !this.isPendriveNotDetected) {
			this.toastService.info(message);
			// console.log(message);
			this.isPendriveNotDetected = true;
		}
	}
	exitPendrive() {
		sessionStorage.setItem("ModeConfiguration", "false");
		this.dialog.closeAll();
	}

	// ✅ Start Pendrive Mode
	private async startPendriveMode(pendrivePath: string): Promise<void> {
		this.isPendriveModePlaying = true;
		// console.log('✅ Pendrive detected — loading IQ folder...');
		try {
			let list = await this.fsService.listAllFilesOnStorage(pendrivePath, 'IQ');
			const files = list.sort((a, b) =>
				a.name.localeCompare(b.name, undefined, {
					numeric: true,
					sensitivity: 'base'
				})
			);
			// console.log('Files in IQ folder:', files);
			this.zoneinfo = [{ cols: 1, height: 0, id: 0, ismute: 'true', media_list: files, rows: 1, width: 0, x: 0, y: 0, }];
			this.dialog.closeAll();
			this.zoneCompletionMap = {};
		} catch (error) {
			console.error('Failed to get files:', error);
		}
	}

	// ✅ Stop Pendrive Mode
	private stopPendriveMode(): void {
		if (this.isPendriveModePlaying) {
			// console.log('🛑 Pendrive removed or mode off — stopping IQ playback...');
			this.isPendriveModePlaying = false;
			localStorage.removeItem('splitScreenList');
			this.zoneinfo = [];
			this.splitCurrentIndex = 0;
			this.showCurrentSlide();
		}
	}

	// ✅ Auth & Device
	private signin() {
		const payload = { username: this.device.username, password: this.device.password };
		this.authService.signin(payload).subscribe({
			next: (res: any) => this.authService.saveToken(res?.accessToken),
			error: (err) => console.error('Signin failed:', err),
		});
	}

	private getScrollerSignature(list: any[]) {
		return list
			.map(s => ({
				id: s.id || "",
				msg: s.message || "",
				font: s.fontname || "",
				folder: s.font_folder || "",
				speed: s.scrlspeed || "",
				type: s.type || "",
				color: s.fncolor || "",
				bg: s.bgcolor || "",
				size: s.fnsize || "",
				logo: s.logo || ""
			}))
			.map(s => JSON.stringify(s))
			.join("|");
	}

	private startTopScroller() {
		if (!this.topScrollers.length) return;

		if (!this.canPlayScroller()) {
			this.activeTopScroller = null;
			clearTimeout(this.topScrollerTimer);
			return;
		}

		clearTimeout(this.topScrollerTimer);

		this.activeTopScroller =
			this.topScrollers[this.activeTopScrollerIndex];

		this.rebuildScroller = false;
		setTimeout(() => (this.rebuildScroller = true), 0);

		setTimeout(() => {
			const duration = this.calculateScrollerDuration(this.activeTopScroller);
			this.topScrollerTimer = setTimeout(() => {
				this.activeTopScrollerIndex =
					(this.activeTopScrollerIndex + 1) % this.topScrollers.length;
				this.startTopScroller();
			}, duration);
		}, 50);
	}

	private canPlayScroller(): boolean {
		return (
			!this.isPendriveMode &&
			this.status === 'ONLINE' &&
			!this.isPendriveModePlaying
		);
	}


	private calculateScrollerDuration(scroller: any): number {
		const speed = Number(scroller?.scrlspeed || 30);

		const textEl = document.querySelector('.scroller-text') as HTMLElement;
		const textWidth = textEl?.scrollWidth || 1000;

		const screenWidth = window.innerWidth;
		const logoWidth = scroller?.logo ? 80 : 0;

		return ((textWidth + screenWidth + logoWidth) / speed) * 1000;
	}

	private checkNoMedia(layoutList: any[]): boolean {
		// --- NO LAYOUTS ---
		if (!layoutList || layoutList.length === 0) {
			return true;
		}
		// --- COLLECT ZONES ---
		let allZones: any[] = [];
		layoutList.forEach((l: any) => {
			if (Array.isArray(l.zonelist)) {
				allZones = [...allZones, ...l.zonelist];
			}
		});

		// --- FILTER ZONES THAT HAVE MEDIA ---
		const validZones = allZones.filter(z =>
			Array.isArray(z.media_list) && z.media_list.length > 0
		);

		// RESULT
		return validZones.length === 0;
	}

	private isExistedDevice(deviceUID: string) {
		this.authService.isExistedDevice(deviceUID).subscribe({
			next: (res: any) => {
				this.apiFailedNoMediaFallback = false; // reset on success

				if (res?.status !== 'success' || !res.client_status || !res.device_status || res.isexpired) {
					if (!this.redirecting) {
						this.redirecting = true;
						sessionStorage.removeItem("device");
						this.router.navigate(['/login']);
					}
				} else if (this.device.orientation !== res.orientation) {
					const uid = this.device.androidid;
					this.device = res;
					this.device.androidid = uid;
					this.device.isVertical = this.device?.orientation?.includes('9:16');
					sessionStorage.setItem('device', JSON.stringify(res));
				}
			},
			error: () => {
				//  SEPARATE HANDLING — NO EXISTING LOGIC USED
				if (
					!this.zoneinfo.length &&           // no offline / downloaded
					!this.isPendriveModePlaying              // pendrive not playing
				) {
					this.apiFailedNoMediaFallback = true;
				}
			}
		});
	}

	private hasAnyDownloadedMedia(): boolean {
		return this.splitScreenList?.some(layout =>
			layout?.zonelist?.some((zone: any) =>
				zone?.media_list?.some(
					(m: any) => typeof m.downloadedUrl === 'string' && m.downloadedUrl.startsWith('file://')
				)
			)
		) ?? false;
	}



	// Media Loading & Updating
	private loadMediaFiles() {
		this.logger.info('loadMediaFiles', 'Fetching media files');

		this.authService.getMediafiles(this.device).subscribe((res: any) => {

			this.logger.info('loadMediaFiles', 'Media response received', {
				updatedTime: res?.updated_time,
				layouts: res?.layout_list?.length,
				scrollers: res?.scrollerList?.length
			});

			// ✅ STEP A: Detect server default response
			if (res?.media_type === 'default') {
				this.logger.warn('loadMediaFiles', 'Server default content detected → normalizing media');

				// ✅ STEP B: Normalize ONLY server default media
				res.layout_list?.forEach((layout: any) => {
					layout.zonelist?.forEach((zone: any) => {
						zone.media_list = zone.media_list.map((m: any, index: number) => ({
							...m,
							Mediafile_id: index + 1,   // stable unique ID
							Order_id: index         // preserve API order
						}));
					});
				});
			}

			const newLayout = this.deepCopy(res?.layout_list ?? []);
			const layoutList = res?.layout_list ?? [];
			this.updatedTime = res.updated_time;
			this.mediacountforServerDefault = res.mediafile_count;
			this.splitScreen = this.deepCopy(newLayout);
			this.splitScreenList = this.deepCopy(newLayout);
			this.scrollers = res?.scrollerList || [];
			this.topScrollers = this.scrollers.filter(s => s.type === 'TOP');
			this.bottomScrollers = this.scrollers.filter(s => s.type === 'BOTTOM');
			this.splitCurrentIndex = 0;
			this.logger.info('loadMediaFiles', 'Media initialized, starting playback');
			// console.log(this.mediacountforServerDefault, "From loadmediafiles()")
			this.showCurrentSlide();
			if (this.canPlayScroller()) {
				this.startTopScroller();
			}

			// this.startBottomScroller();

			// --- USE REUSABLE FUNCTION ---
			if (this.checkNoMedia(layoutList)) {
				this.logger.warn('loadMediaFiles', 'No media available');
				this.noMediaAvailable = true;
				this.wasNoMedia = true;
				return;
			}
			// --- MEDIA EXISTS ---
			this.noMediaAvailable = false;
			// Only start player IF it's normal load, not recovery from no-media
			if (!this.wasNoMedia) {
				this.showCurrentSlide();  // start only once
			}
		});
	}


	private checkForUpdates() {
		this.authService.getMediafiles(this.device).subscribe((res: any) => {
			// const newLayout = (res?.layout_list ?? []).map((l: any) => ({ ...l, zonelist: l.zonelist.map((z: any) => ({ ...z, media_list: z.media_list.map((m: any, i: any) => ({ ...m, Order_id: m.Order_id || i + 1 })) })) }));
			const newLayout = res?.layout_list ?? [];
			const newMediaType = res?.media_type ?? null;
			const newScrollers = res?.scrollerList || [];
			const noMedia = this.checkNoMedia(newLayout);

			if (res?.media_type === "default") {
				res.layout_list?.forEach((layout: any) => {
					layout.zonelist?.forEach((zone: any) => {
						zone.media_list = zone.media_list.map((m: any, index: number) => ({
							...m,
							Mediafile_id: index + 1,
							Order_id: index + 1
						}));
					});
				});
			}
			if (res?.media_type === "default") {
				const currentKey = `${this.device.orientation}_${res.mediafile_count}`;

				if (this.lastServerDefaultKey === currentKey) {
					// same server default → skip ONLY server-default-specific reset
				} else {
					this.lastServerDefaultKey = currentKey;
				}

			}


			// --- 1. Scrollers update ---
			const oldSig = this.getScrollerSignature(this.scrollers);
			const newSig = this.getScrollerSignature(newScrollers);
			if (oldSig !== newSig) {
				// console.log("SCROLLER UPDATED → Full DOM rebuild");
				this.rebuildScroller = false;
				this.scrollers = newScrollers;
				this.topScrollers = newScrollers.filter((s: any) => s.type === 'TOP');
				this.bottomScrollers = newScrollers.filter((s: any) => s.type === 'BOTTOM');
				this.activeTopScrollerIndex = 0;
				setTimeout(() => {
					this.rebuildScroller = true;
				}, 0);

			} else {
				// No actual change → DO NOTHING → Prevent restart
			}

			// --- 0. Check NO MEDIA ---
			if (noMedia) {
				this.noMediaAvailable = true;
				clearTimeout(this.autoplayTimer);
				this.autoplayTimer = null;
				this.splitScreen = [];
				this.splitScreenList = [];
				this.zoneinfo = [];
				this.zoneCompletionMap = {};
				this.wasNoMedia = true;   // mark state!
				localStorage.removeItem('splitScreenList');
				return;
			}

			this.noMediaAvailable = false;

			//  IMPORTANT PART 
			if (this.wasNoMedia) {
				// STOP ANY old loop fully
				clearTimeout(this.autoplayTimer);
				this.autoplayTimer = null;
				// console.log("MEDIA RESTORED → CLEAN RESTART");
				this.wasNoMedia = false;
				// RESET state
				this.splitCurrentIndex = 0;
				this.zoneCompletionMap = {};
				localStorage.removeItem('splitScreenList');
				this.zoneinfo = [];
				this.updatedTime = res.updated_time;
				// LOAD new layout
				this.splitScreen = this.deepCopy(newLayout);
				this.splitScreenList = this.deepCopy(newLayout);
				// START NEW LOOP
				this.showCurrentSlide();
				return;
			}

			const oldSet = this.toMediaSet(this.splitScreen);
			const newSet = this.toMediaSet(newLayout);

			if (oldSet.size !== newSet.size || [...oldSet].some(x => !newSet.has(x)) || this.updatedTime !== res.updated_time) {
				this.splitScreen = this.deepCopy(newLayout);
				this.splitScreenList = this.deepCopy(newLayout);
				this.updatedTime = res.updated_time;
				this.splitCurrentIndex = 0;
				localStorage.removeItem('splitScreenList');
				this.rebuildScroller = false;
				setTimeout(() => {
					this.rebuildScroller = true;
				}, 0);
				this.showCurrentSlide();
			}
		});
	}

	//  Slide Playback Logic
	private showCurrentSlide() {
		clearTimeout(this.autoplayTimer);
		this.zoneinfo = [];
		this.zoneCompletionMap = {};
		// const stored = localStorage.getItem('splitScreenList');
		// this.splitScreenList = stored ? JSON.parse(stored) : this.splitScreenList;
		if (!this.splitScreenList?.length) {
			this.logger.warn('showCurrentSlide', 'SplitScreen list empty');
			return;
		}

		const zones = this.splitScreenList[this.splitCurrentIndex]?.zonelist;

		if (!Array.isArray(zones) || zones.length === 0) {
			// console.log('⚠️ Empty zonelist detected → forcing next slide');
			this.logger.warn('showCurrentSlide', 'Empty zonelist, moving next');
			this.nextSlideAndShow();
			return;
		}
		this.zoneinfo = zones;
		// console.log('Showing zones:', this.zoneinfo);
		this.logger.info('showCurrentSlide', 'Zones displayed', zones.map(z => z.id));
	}

	private nextSlideAndShow() {
		clearTimeout(this.autoplayTimer);
		if (!this.splitScreenList?.length) return;
		this.splitCurrentIndex = (this.splitCurrentIndex + 1) % this.splitScreenList.length;
		// console.log("Splitscreen Current index: ", this.splitCurrentIndex)
		this.showCurrentSlide();
	}

	private toMediaSet(data: any) {
		return new Set(
			data.flatMap((layout: any) =>
				layout.zonelist.flatMap((zone: any) =>
					zone.media_list.map((m: any) => `${m.Mediafile_id}|${m.Url}`)
				)
			)
		);
	}
	private deepCopy(obj: any) {
		return JSON.parse(JSON.stringify(obj));
	}

	trackById(index: number, item: any): any {
		return item.id ?? index;
	}

	onZoneComplete(zoneId: any) {
		this.zoneCompletionMap[zoneId] = true;
		const allCompleted = this.zoneinfo.every(zone => this.zoneCompletionMap[zone.id]);
		// console.log(this.zoneCompletionMap)
		// console.log("Zonecompleted with ZoneID -",zoneId,allCompleted);

		this.logger.log('onZoneComplete', 'Zone completed', {
			zoneId,
			allCompleted
		});

		if (allCompleted && this.splitScreenList.length > 1 && !this.isPendriveMode) {
			this.zoneCompletionMap = {}
			this.nextSlideAndShow();
		}
	}

	// ✅ Exit Confirmation
	exitApp() {
		this.logger.warn('exitApp', 'Exit requested');
		try {
			if (typeof window !== 'undefined' && (window as any).webOS?.platformBack) {
				this.logger.info('exitApp', 'webOS platformBack used');
				(window as any).webOS.platformBack();
				return;
			}

			if (this.dialogRef) return;

			this.dialogRef = this.dialog.open(this.exitconfirm, { minWidth: '450px' });

			this.dialogRef.afterClosed().subscribe((result: any) => {
				this.logger.warn('exitApp', 'Exit dialog result', result);
				if (result) window.close();
				this.dialogRef = null;
			});
		} catch (err) {
			this.logger.error('exitApp', 'Exit failed', err);
		}
	}
	// ✅ Cleanup
	ngOnDestroy(): void {
		this.logger.warn('ngOnDestroy', 'SplitScreen destroyed');
		this.intervalSub?.unsubscribe();
		clearTimeout(this.autoplayTimer);
		this.subscription.unsubscribe();
		if (this.intervalId) clearInterval(this.intervalId);
	}
	async pendriveSettings(source: any) {
		this.isPendriveMode = sessionStorage.getItem('ModeConfiguration') === 'true';
		this.isClearCopyContent = localStorage.getItem('isClearCopyContent') === 'true';
		this.isCopyContent = localStorage.getItem('isCopyContent') === 'true';

		const fods = await this.fsService.countPendrivesWithIQFolder('IQ');
		const hasPendriveWithIQ = fods.pendrivesWithIQ.length > 0;
		const destination = '/opt/usr/home/owner/content/Downloads/IQW';
		const hasEnoughSpace = await this.fsService.hasEnoughStorage(300);

		if (hasPendriveWithIQ && hasEnoughSpace) {
			if ((this.isClearCopyContent || this.isCopyContent) && this.isPendriveMode) {

				// ✅ Step 1: Clear old content if "Clear Copy Content" is selected
				if (this.isClearCopyContent) {
					try {
						await this.fsService.deleteAllFiles('downloads/IQW');
						this.toastService.success('Old content cleared successfully.');
					} catch (err: any) {
						console.error('Error clearing old content:', err);
						this.toastService.error('Failed to clear old content.');
						return; // Stop further processing if clear failed
					}
				}

				// ✅ Step 2: List and copy files from USB → Downloads
				let usbFiles: any = await this.fsService.listAllFilesOnStorage(source + '/IQ');

				this.toastService.info('Copying files from pendrive...');
				// ⚠️ Await here so next step runs after copying completes


				await this.fsService.copyFilesFromUSBToDownloads(
					usbFiles,
					this.isClearCopyContent
				);

				// ✅ Step 3: Refresh file list and update zone info
				let files: any = await this.fsService.listAllFilesOnStorage(destination);
				// console.log('Copied files:', files);

				this.zone.run(async () => {
					this.zoneinfo = [];
					this.cdr.detectChanges();

					await new Promise(r => setTimeout(r, 50));

					this.zoneinfo = [{ cols: 1, height: 0, id: Date.now(), ismute: 'true', media_list: files, rows: 1, width: 0, x: 0, y: 0, },];
					this.cdr.detectChanges();
					this.toastService.success('Files copied and updated.');
					// console.log('Updated zoneinfo:', this.zoneinfo);
					this.zoneCompletionMap = {};
					this.dialog.closeAll();
				});

			}
		} else {
			// ❌ Show appropriate error
			if (!hasPendriveWithIQ) {
				this.toastService.error('No pendrive with “IQ” folder detected.');
			} else if (!hasEnoughSpace) {
				this.toastService.error('Insufficient storage space available.');
			}
		}
	}

}



