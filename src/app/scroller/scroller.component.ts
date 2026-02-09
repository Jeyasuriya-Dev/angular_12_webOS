import { Component, Input, OnInit, OnDestroy, AfterViewInit, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { loadFontDynamically } from '../utils/font-loader';
import { LoggerService } from '../_core/services/logger.service';


export interface ScrollerItem {
	id: number;
	message: string;
	bgcolor: string;
	fncolor: string;
	fnsize: string;
	logo?: string | null;
	fontname: string;
	scrlspeed: number;   // provided duration hint (seconds)
	direction: string;   // left, right, up, down
	behavior: string;
	type: string;        // TOP or BOTTOM
	isfreeze: boolean;
	font_folder: string;
	loadedFont?: string;
}
const loadedFontCache: Set<string> = new Set();

@Component({
	selector: 'app-scroller',
	templateUrl: './scroller.component.html',
	styleUrls: ['./scroller.component.scss']
})
export class ScrollerComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
	@Input() scrollers: ScrollerItem[] = [];
	@ViewChild('scrollWrapper') scrollWrapper!: ElementRef;
	@ViewChild('scrollTrack') scrollTrack!: ElementRef;
	@ViewChild('logoImg', { static: false }) logoImgRef?: ElementRef<HTMLImageElement>;
	public baseDuration: number = 20; // default fallback duration
	animationReady = false;
	private previousFontNames: string[] = [];
	stickyLogo: string | null = null;
	isLogoSticky = false;
	private rafId: number | null = null;
	private stickyLogoWidth = 0;
	stickyFromIndex: number | null = null;
	private stickyLogoMeasured = false;

	constructor(private logger: LoggerService) {
		this.logger.info('Scroller.constructor', 'Scroller component created');
	}

	ngOnInit() {
		this.logger.info('ngOnInit', 'Scroller initialized', {
			count: this.scrollers?.length
		});

	}

	ngAfterViewInit() {
		this.logger.info('ngAfterViewInit', 'Scroller view ready');

		const track = this.scrollTrack.nativeElement as HTMLElement;

		track.addEventListener('animationiteration', () => {
			this.logger.log('animationiteration', 'Scroller loop completed');

			// 🔁 RESET on every loop
			if (this.scrollers.length && this.scrollers[0].logo) {
				this.stickyLogo = this.scrollers[0].logo;
				this.stickyFromIndex = 0;
			} else {
				this.stickyLogo = null;
				this.stickyFromIndex = null;
			}
			this.updateLogoOffset();
		});
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes['scrollers']) {

			this.logger.info('ngOnChanges', 'Scroller data changed', {
				count: this.scrollers.length,
				type: this.scrollers[0]?.type,
				direction: this.scrollers[0]?.direction
			});

			//  NEW LOGIC: first scroller logo should be sticky initially
			if (this.scrollers.length && this.scrollers[0].logo) {
				this.stickyLogo = this.scrollers[0].logo;
				this.stickyFromIndex = 0;

				this.logger.info('StickyLogo', 'Initial sticky logo set', {
					index: 0,
					logo: this.stickyLogo
				});
			}
			this.checkFontChanges();
		}
	}


	private startLogoTracking() {
		if (this.rafId) cancelAnimationFrame(this.rafId);

		const wrapper = this.scrollWrapper.nativeElement as HTMLElement;
		const triggers = Array.from(
			this.scrollTrack.nativeElement.querySelectorAll('.logo-trigger')
		) as HTMLElement[];

		const loop = () => {
			const logoEl = this.logoImgRef?.nativeElement as HTMLImageElement;
			if (logoEl?.complete && !this.stickyLogoMeasured) {
				const width = logoEl.offsetWidth;
				this.stickyLogoWidth = width;
				this.stickyLogoMeasured = true;
				// console.log("the sticky image width (ONCE):", width);
			}
			// const wrapperRect = wrapper.getBoundingClientRect();


			triggers.forEach((el) => {
				const index = Number(el.getAttribute('data-index'));
				const rect = el.getBoundingClientRect();
				const wrapperRect = wrapper.getBoundingClientRect();
				const triggerX = wrapperRect.left + this.stickyLogoWidth;
				// console.log("",triggerX)

				//for left touch url logo change
				// const hitLeft =
				// 	rect.left <= wrapperRect.left &&
				// 	rect.right > wrapperRect.left;

				// if (hitLeft) {
				// 	this.onScrollerHitLeft(index);
				// }

				//for Right touch url logo change
				// const hitRight =
				// 	rect.left < wrapperRect.right &&
				// 	rect.right >= wrapperRect.right;

				// if (hitRight) {
				// 	this.onScrollerHitLeft(index);
				// }

				//  Trigger when scroller touches sticky logo width
				if (
					rect.left <= triggerX &&
					rect.right > triggerX
				) {
					this.onScrollerHitLeft(index);
				}

			});

			this.rafId = requestAnimationFrame(loop);
		};

		loop();
	}



	private onScrollerHitLeft(index: number) {
		if (this.stickyFromIndex === index) return;

		const scroller = this.scrollers[index];

		this.logger.info('StickyLogo', 'Sticky logo changed', {
			from: this.stickyFromIndex,
			to: index,
			hasLogo: !!scroller.logo
		});

		if (scroller.logo) {
			this.stickyLogo = scroller.logo;
			this.stickyFromIndex = index;
			this.stickyLogoMeasured = false;
			this.updateLogoOffset();
		} else {
			this.stickyLogo = null;
			this.stickyFromIndex = null;
			this.stickyLogoWidth = 0;
			this.stickyLogoMeasured = false;
			this.updateLogoOffset();
		}
	}


	private updateLogoOffset() {
		const wrapper = this.scrollWrapper?.nativeElement as HTMLElement;
		const logoEl = wrapper?.querySelector('.sticky-logo img') as HTMLElement;

		if (logoEl) {
			const width = logoEl.offsetWidth + 20; // 20px gap
			wrapper.style.setProperty('--logo-offset', `${width}px`);
		} else {
			wrapper.style.setProperty('--logo-offset', '0px');
		}
	}


	private async checkFontChanges() {
		if (!this.scrollers || this.scrollers.length === 0) return;

		const currentFontNames = this.scrollers.map(s => s.fontname);

		// FIRST TIME → always load fonts
		if (this.previousFontNames.length === 0) {
			this.logger.info('Font', 'Initial font load', currentFontNames);

			this.previousFontNames = [...currentFontNames];
			await this.loadScrollerFonts();
			this.updateScrollSpeed();
			return;
		}

		// CHECK IF ANY FONTNAME CHANGED
		const changed = currentFontNames.some((font, i) =>
			font !== this.previousFontNames[i]
		);

		if (changed) {
			this.logger.warn('Font', 'Font change detected → reload', {
				old: this.previousFontNames,
				new: currentFontNames
			});

			this.previousFontNames = [...currentFontNames];

			await this.loadScrollerFonts();
			this.updateScrollSpeed();
			return;
		}

		this.logger.log('Font', 'Fonts unchanged → reapply only');

		// ✔ FONT NOT CHANGED → Still re-apply loadedFont to trigger UI refresh
		this.scrollers.forEach(s => {
			s.loadedFont = s.font_folder;   // ⬅ RE-APPLY FONT ALWAYS
		});

	}

	private async loadScrollerFonts() {
		if (!this.scrollers || !this.scrollers.length) return;

		for (let s of this.scrollers) {
			const fontKey = `${s.font_folder}-${s.fontname}`;

			//  Already loaded → skip
			if (loadedFontCache.has(fontKey)) {
				s.loadedFont = s.font_folder;
				this.logger.log('Font', 'Font already cached', fontKey);
				continue;
			}

			//  Invalid → skip
			if (!s.fontname || !s.font_folder) {
				s.loadedFont = 'sans-serif';
				this.logger.warn('Font', 'Invalid font data, fallback used');
				continue;
			}

			//  Load font once
			try {
				await loadFontDynamically(s.font_folder, s.fontname);
				s.loadedFont = s.font_folder;

				// Mark as loaded
				loadedFontCache.add(fontKey);

				this.logger.info('Font', 'Font loaded successfully', fontKey);

			} catch (err) {
				this.logger.error('Font', 'Font load failed', {
					font: fontKey,
					error: err
				});

				s.loadedFont = 'sans-serif';
			}
		}
	}

	private updateScrollSpeed() {
		this.animationReady = false;

		setTimeout(() => {
			const wrapper = this.scrollWrapper?.nativeElement as HTMLElement;
			const track = this.scrollTrack?.nativeElement as HTMLElement;
			if (!wrapper || !track || !this.scrollers.length) return;

			const s = this.scrollers[0];
			const direction = s.direction || 'left';

			this.logger.info('ScrollSpeed', 'Calculating scroll speed', {
				direction,
				speed: s.scrlspeed,
				logo: !!s.logo
			});

			// --- DOM measurements ---
			const wrapperWidth = wrapper.offsetWidth - (this.scrollers[0]?.logo ? 60 : 0);
			const wrapperHeight = wrapper.offsetHeight;
			const trackWidth = track.scrollWidth;
			const trackHeight = track.scrollHeight;

			// --- Smooth speed mapping (balanced for WebOS hardware) ---
			const pxPerSec = 120; // smoother, hardware-friendly scale

			// --- Compute distance + duration ---
			let totalDistance: number, duration: number;
			if (direction === 'left' || direction === 'right') {
				totalDistance = wrapperWidth + trackWidth;
				duration = totalDistance / pxPerSec;
				track.style.setProperty('--start', `${wrapperWidth}px`);
				track.style.setProperty('--trackWidth', `${trackWidth}px`);
			} else {
				totalDistance = wrapperHeight + trackHeight;
				duration = totalDistance / pxPerSec;
				track.style.setProperty('--start', `${wrapperHeight}px`);
				track.style.setProperty('--trackHeight', `${trackHeight}px`);
			}

			// --- Apply styles ---
			track.style.animationDuration = `${duration.toFixed(2)}s`;
			track.style.animationTimingFunction = 'linear';
			track.style.willChange = 'transform';
			track.style.transform = 'translate3d(0, 0, 0)';

			// --- Start animation on next frame for stability ---
			requestAnimationFrame(() => {
				this.animationReady = true;
				this.logger.info('ScrollSpeed', 'Animation started');

				setTimeout(() => {
					this.startLogoTracking();
				}, 20);
			});
		}, 200);
	}

	trackById(index: number, item: ScrollerItem) {
		return item.id;
	}


	public calcPadding(scroller: ScrollerItem): string {
		const size = Number(scroller.fnsize) || 20;

		let vertical = size * 0.5;
		let horizontal = size * 2;

		if (size > 35) {
			vertical = size * 0.6;
		}

		return `${vertical}px ${horizontal}px`;
	}

	ngOnDestroy() {
		this.logger.warn('ngOnDestroy', 'Scroller destroyed');

		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
		}
	}
}
