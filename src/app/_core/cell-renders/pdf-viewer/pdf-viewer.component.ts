import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { PdfLoadedEvent } from 'ngx-extended-pdf-viewer';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})
export class PdfViewerComponent implements OnChanges, OnDestroy {
  @Input() url: any;
  pdfUrl!: string | any;
  @Output() pdfEnded = new EventEmitter<{ success: boolean; message?: string }>();
  @Input() loop: boolean = false
  currentPage = 1;
  totalPages = 0;
  interval: any;

  constructor(private logger: LoggerService) {
    this.logger.info('PdfViewer.constructor', 'PDF Viewer created');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['url']) {
      this.logger.info('ngOnChanges', 'PDF URL changed', {
        url: this.url,
        loop: this.loop
      });

      // cleanup before loading a new PDF
      this.cleanup();
      this.currentPage = 1;
      this.totalPages = 0;

      // reload PDF properly
      this.pdfUrl = null;
      setTimeout(() => (this.pdfUrl = this.url), 5);
    }
  }

  afterLoadComplete(pdf: PdfLoadedEvent) {
    // reset slideshow for new PDF
    this.cleanup();
    this.currentPage = 1;
    this.totalPages = pdf.pagesCount;

    this.logger.info('PDFLoaded', 'PDF loaded', {
      pages: this.totalPages
    });

    if (this.totalPages > 0) {
      setTimeout(() => this.startSlideShow(), 1000);
    } else {
      this.logger.error('PDFLoaded', 'Page count detection failed');
      this.pdfEnded.emit({ success: false, message: "Could not detect pages in PDF" });
    }
  }

  startSlideShow() {
    
    this.logger.info('SlideShow', 'PDF slideshow started', {
    totalPages: this.totalPages,
    loop: this.loop
  });

    this.interval = setInterval(() => {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        // console.log(`➡️ Page ${this.currentPage}/${this.totalPages}`);
      } else if (this.loop) {
        this.logger.info('SlideShow', 'Looping PDF slideshow');
        this.currentPage = 1;
      } else {
        this.logger.info('SlideShow', 'PDF slideshow completed');
        this.cleanup();
        this.pdfEnded.emit({ success: true, message: "Slideshow completed" });
      }
    }, 10000); // 3 sec per page (change as needed)
  }

  ngOnDestroy(): void {
    this.logger.warn('ngOnDestroy', 'PDF Viewer destroyed');
    this.cleanup();
  }

  private cleanup() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.logger.log('Cleanup', 'PDF slideshow interval cleared');
    }
  }
}
