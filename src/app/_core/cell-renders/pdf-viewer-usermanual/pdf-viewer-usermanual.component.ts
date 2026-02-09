import { Component, Input, HostListener } from '@angular/core';

@Component({
  selector: 'app-pdf-viewer-usermanual',
  templateUrl: './pdf-viewer-usermanual.component.html',
  styleUrls: ['./pdf-viewer-usermanual.component.scss']
})
export class PdfViewerUsermanualComponent {
  @Input() pdfUrl!: string;

  currentPage = 1;

  // 🔒 Remote-only navigation
  @HostListener('window:keydown', ['$event'])
  handleRemote(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      this.currentPage++;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      this.currentPage = Math.max(1, this.currentPage - 1);
    }
  }
}