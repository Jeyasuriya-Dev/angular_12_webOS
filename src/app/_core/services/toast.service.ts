// src/app/services/toast.service.ts
import { Injectable } from '@angular/core';
import { ToastrService, IndividualConfig } from 'ngx-toastr';
import { LoggerService } from '../services/logger.service';


@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private options: Partial<IndividualConfig> = {
    timeOut: 3000,
    positionClass: 'toast-top-right',
    closeButton: true,
    progressBar: true
  };

  constructor(private toastr: ToastrService, private logger: LoggerService) {
    this.logger.info('ToastService.constructor', 'ToastService initialized');
  }

  private short(msg: string): string {
    return msg?.length > 60 ? msg.slice(0, 60) + '…' : msg;
  }


  success(message: string, title: string = 'Success') {
    this.logger.info('Toast', 'Success toast shown', {
      title,
      message: this.short(message)
    });
    this.toastr.success(message, title, this.options);
  }

  error(message: string, title: string = 'Error') {
    this.logger.warn('Toast', 'Error toast shown', {
      title,
      message: this.short(message)
    });
    this.toastr.error(message, title, this.options);
  }

  info(message: string, title: string = 'Info') {
    this.logger.log('Toast', 'Info toast shown', {
      title,
      message: this.short(message)
    });
    this.toastr.info(message, title, this.options);
  }

  warning(message: string, title: string = 'Warning') {
    this.logger.warn('Toast', 'Warning toast shown', {
      title,
      message: this.short(message)
    });
    this.toastr.warning(message, title, this.options);
  }

  // Custom toast with overrides
  custom(message: string, title: string, config?: Partial<IndividualConfig>) {
    this.logger.info('Toast', 'Custom toast shown', {
      title,
      message: this.short(message)
    });
    this.toastr.show(message, title, { ...this.options, ...config });
  }
}
