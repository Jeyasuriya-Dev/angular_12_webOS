import { Component, OnInit } from '@angular/core';
import { FilesystemService } from '../../services/filesystem.service';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from '../../services/toast.service';
import { SplitScreenComponent } from 'src/app/split-screen/split-screen.component';
import { SplitScreenService } from '../../services/split-screen.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-menu1',
  templateUrl: './menu1.component.html',
  styleUrls: ['./menu1.component.scss']
})
export class Menu1Component implements OnInit {
  isCopyContent = false;
  isClearCopyContent = false;
  imageDelay: number = 10;

  constructor(private fsService: FilesystemService,
    private matDialog: MatDialog,
    private toastService: ToastService,
    private splitService: SplitScreenService,
    private logger: LoggerService
  ) {
    this.logger.info('Menu1.constructor', 'Menu1 component created');
  }

  ngOnInit() {
    this.isCopyContent = localStorage.getItem('isCopyContent') === 'true';
    this.isClearCopyContent = localStorage.getItem('isClearCopyContent') === 'true';
    const savedDelay = localStorage.getItem('imageDelay');
    this.imageDelay = savedDelay ? parseInt(savedDelay, 10) : 10;

    this.logger.info('ngOnInit', 'Pendrive settings loaded', {
      isCopyContent: this.isCopyContent,
      isClearCopyContent: this.isClearCopyContent,
      imageDelay: this.imageDelay
    });

  }

  onChangePendriveSetting(value: boolean, type: 'CopyContent' | 'ClearCopyContent') {
    let isCopyContent = localStorage.getItem('isCopyContent') == "true";
    let isClearCopyContent = localStorage.getItem('isClearCopyContent') === "true";

    this.logger.info('ToggleChange', 'Pendrive setting changed', {
      type,
      value,
      isCopyContent,
      isClearCopyContent
    });

    if (type === 'CopyContent') {
      this.isCopyContent = value;
      if (value && isClearCopyContent) this.isClearCopyContent = false;
    } else if (type === 'ClearCopyContent') {
      this.isClearCopyContent = value;
      if (value && isCopyContent) this.isCopyContent = false;
    }

    // Save both states
    localStorage.setItem('isCopyContent', String(this.isCopyContent));
    localStorage.setItem('isClearCopyContent', String(this.isClearCopyContent));

    this.logger.info('ToggleChange', 'Updated pendrive flags', {
      isCopyContent: this.isCopyContent,
      isClearCopyContent: this.isClearCopyContent
    });


    // sessionStorage.setItem('ModeConfiguration', "false");
    if (this.isClearCopyContent || this.isCopyContent) {
      this.pendriveSettings();
    }
  }

  changeValue(step: number) {
    const oldDelay = this.imageDelay;
    this.imageDelay = Math.max(0, this.imageDelay + step);
    localStorage.setItem('imageDelay', String(this.imageDelay));

    this.logger.info('ImageDelay', 'Image delay changed', {
      from: oldDelay,
      to: this.imageDelay
    });
  }

  async clearDownloads(): Promise<void> {
    this.logger.warn('ClearDownloads', 'User requested storage clear');

    this.fsService.deleteAllFiles('downloads/IQW')
      .then(() => {
        this.logger.info('ClearDownloads', 'Storage cleared successfully');
        this.toastService.success("Storage Cleared");
        this.pendriveSettings();
      })
      .catch((err: any) => {
        const message = err?.message || 'Failed to clear storage';
        this.logger.error('ClearDownloads', 'Storage clear failed', err);
        this.toastService.error(message);
        console.error('Error clearing downloads:', err);
      });
  }

  exitPendrive() {
    this.logger.warn('ExitPendrive', 'Exiting pendrive mode');
    sessionStorage.setItem("ModeConfiguration", "false");
    this.matDialog.closeAll();
  }
  async pendriveSettings() {
    this.logger.info('PendriveSettings', 'Checking pendrive & storage');
    const fods = await this.fsService.countPendrivesWithIQFolder('IQ');
    const hasPendriveWithIQ = fods.pendrivesWithIQ.length > 0;
    const hasEnoughSpace = await this.fsService.hasEnoughStorage(300);

    this.logger.info('PendriveSettings', 'Validation result', {
    hasPendriveWithIQ,
    hasEnoughSpace,
    paths: fods.pendrivesWithIQ
  });

    if (hasPendriveWithIQ && hasEnoughSpace) {
      if (this.isClearCopyContent || this.isCopyContent) {
        this.logger.info('PendriveSettings', 'Triggering SplitScreen pendrive flow');
        this.splitService.triggerPendriveSettings();
      }
    } else {
      // ❌ Handle errors individually
      if (!hasPendriveWithIQ) {
        this.logger.warn('PendriveSettings', 'No IQ pendrive detected');
        this.toastService.error('No pendrive with “IQ” folder detected.');
      } else {
        this.logger.warn('PendriveSettings', 'Insufficient storage');
        this.toastService.error('Insufficient storage space available.');
      }
    }
  }



}
