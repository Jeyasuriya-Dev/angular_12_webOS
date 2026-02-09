import { AfterViewInit, Component, HostListener, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { LoggerService } from './_core/services/logger.service';
@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {

	private lastEnterPressTime = 0;
	netspeed: any;
	intervalId: any;
	isLoginPage = false;
	dialogRef: any;
	isPendrive: any = false;
	@ViewChild('exitconfirm', { static: true }) exitconfirm!: TemplateRef<any>;
	@ViewChild('DeviceSettings', { static: true }) deviceSettings!: TemplateRef<any>;
	exitDialogRef: MatDialogRef<any> | null = null;


	constructor(private dialog: MatDialog, private logger: LoggerService) {
		this.logger.info('constructor', 'AppComponent initialized');
	}
	ngOnInit() { this.logger.info('ngOnInit', 'AppComponent loaded'); }

	ngAfterViewInit(): void { this.logger.info('ngAfterViewInit', 'View initialized'); }

	ngOnDestroy(): void {
		this.logger.warn('ngOnDestroy', 'Component destroyed');
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.logger.info('ngOnDestroy', 'Interval cleared', this.intervalId);
		}
	}

	// ========================
	// OPEN SETTINGS DIALOG
	// ========================
	openInstallDialog(): void {
		this.logger.log('openInstallDialog', 'Attempting to open dialog', {
			isLoginPage: this.isLoginPage,
			isPendrive: this.isPendrive
		});

		if (this.dialogRef) {
			this.logger.warn('openInstallDialog', 'Dialog already open');
			return;
		}
		this.dialogRef = this.dialog.open(this.deviceSettings, {
			width: '45vw',
			data: { isLoginPage: this.isLoginPage, isPendrive: this.isPendrive }
		});

		this.dialogRef.afterClosed().subscribe((result: any) => {
			this.logger.info('openInstallDialog', 'Dialog closed', result);
			this.dialogRef = null;
		});
	}

	// ========================
	// KEY HANDLER
	// ========================
	@HostListener('window:keydown', ['$event'])
	handleKeyDown(event: KeyboardEvent) {

		this.logger.log('handleKeyDown', 'Key pressed', {
			key: event.key,
			keyCode: event.keyCode
		});

		switch (event.keyCode) {
			case 13: // Enter / OK
				const now = Date.now();
				const delta = now - this.lastEnterPressTime;
				this.lastEnterPressTime = now;

				this.logger.info('handleKeyDown', 'Enter pressed', { delta });

				if (delta < 2200) {
					this.isPendrive = sessionStorage.getItem("ModeConfiguration") === "true";

					this.logger.info('handleKeyDown', 'Double enter detected', {
						isPendrive: this.isPendrive,
						ModeConfiguration: sessionStorage.getItem('ModeConfiguration')
					});

					this.openInstallDialog();
				}
				break;
			case 10009:  // EXIT
			case 10182:
			case 461:   // webOS Back
			case 27:    // ESC / Browser
				this.logger.warn('handleKeyDown', 'Exit key pressed');
				event.preventDefault();
				event.stopPropagation();
				if (this.dialog.openDialogs.length > 0) {
					this.dialog.closeAll();
				} else {
					// Delay slightly to prevent multiple triggers
					setTimeout(() => this.exitApp(), 150);
				}
				break;
			default:
				break;

		}
	}

	// ========================
	// EXIT APPLICATION
	// ========================
	exitApp() {
		try {
			//  2. If no dialogs open, only then show Exit confirmation
			if (!this.exitDialogRef || !this.exitDialogRef.getState || this.exitDialogRef.getState() === 0) {
				// Make sure Exit popup is not already open
				const alreadyOpen = this.dialog.openDialogs.some(
					d => d.componentInstance?.templateRef === this.exitconfirm
				);
				if (alreadyOpen) return;

				this.exitDialogRef = this.dialog.open(this.exitconfirm, {
					minWidth: '450px',
					disableClose: true
				});

				this.exitDialogRef.afterOpened().subscribe(() => {
					this.registerExitPopupFocus();
				});

				this.exitDialogRef.afterClosed().subscribe((result: any) => {
					this.exitDialogRef = null; //  clear reference

					if (result) {
						try {
							if ((window as any).tizen) {
								(window as any).tizen.application.getCurrentApplication().exit();
							} else if ((window as any).webOS) {
								(window as any).webOS.platformBack();
							} else {
								window.close();
							}
						} catch (e) {
							window.close();
						}
					}
				});
			}
		} catch (err) {
			console.error("❌ exitApp error:", err);
		}
	}

	private registerExitPopupFocus() {
		const dialogContainer = document.querySelector('.mat-dialog-container');
		if (!dialogContainer) return;

		const buttons = Array.from(dialogContainer.querySelectorAll<HTMLButtonElement>('button.exit-btn'));
		if (!buttons.length) return;

		let index = 0;
		buttons[index].focus();

		const keyListener = (event: KeyboardEvent) => {
			//  Block all default key handling outside popup
			event.stopPropagation();
			event.preventDefault();

			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				index = (index + 1) % buttons.length;
				buttons[index].focus();
			} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				index = (index - 1 + buttons.length) % buttons.length;
				buttons[index].focus();
			} else if (event.key === 'Enter') {
				buttons[index].click();
			} else if (event.key === 'Escape' || event.keyCode === 461 || event.keyCode === 10009) {
				this.exitDialogRef?.close();

			}
		};

		//  Capture key events globally and lock focus inside popup
		document.addEventListener('keydown', keyListener, true);

		this.exitDialogRef?.afterClosed().subscribe(() => {
			//  Remove listener when popup is closed
			document.removeEventListener('keydown', keyListener, true);
		});
	}


	// ========================
	// FOCUS & POPUP HANDLING
	// ========================
	@HostListener('document:keydown', ['$event'])
	onKeydown(event: KeyboardEvent) {
		const focusable = Array.from(
			document.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
		).filter(el => !el.hasAttribute('disabled'));

		const index = focusable.indexOf(document.activeElement as HTMLElement);

		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {

			const next = (index + 1) % focusable.length;
			focusable[next].focus();
			event.preventDefault();
		}

		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			const prev = (index - 1 + focusable.length) % focusable.length;
			focusable[prev].focus();
			event.preventDefault();
		}

		if (event.key === 'Enter') {

			(document.activeElement as HTMLElement)?.click();
		}
		const isPopupOpen = this.dialog.openDialogs.length > 0;

		this.logger.log('onKeydown', 'Document keydown', {
			key: event.key,
			popupOpen: isPopupOpen
		});

		if (isPopupOpen) {
			if (event.key === 'Escape' || event.keyCode === 461) {
				this.logger.warn('onKeydown', 'Popup closed via key');
				this.dialog.closeAll();
			} else {
				event.preventDefault();
				event.stopPropagation();
			}
			return;
		}
	}
}
