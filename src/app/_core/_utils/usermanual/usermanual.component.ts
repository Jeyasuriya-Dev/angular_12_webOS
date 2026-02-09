import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-usermanual',
  templateUrl: './usermanual.component.html',
  styleUrls: ['./usermanual.component.scss']
})
export class UsermanualComponent implements OnInit, OnDestroy {

  currentPage = 1;
  totalPages = 21; // ⬅️ set correctly
  imageBasePath = 'assets/usermanual/pdf2png/usermanual.v1.0';

  constructor(
    private dialogRef: MatDialogRef<UsermanualComponent>
  ) { }

  ngOnInit(): void {
    document.addEventListener('keydown', this.handleRemoteKeys);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.handleRemoteKeys);
  }

  get currentImage(): string {
    const pageNum = this.currentPage.toString();
    const page = pageNum.length < 2 ? '0' + pageNum : pageNum;
    return `${this.imageBasePath}/usermanual.v1.0-${page}.png`;
  }

  handleRemoteKeys = (event: KeyboardEvent) => {
    switch (event.keyCode) {
      case 38: // ⬆️ UP
        this.prevPage();
        break;

      case 40: // ⬇️ DOWN
        this.nextPage();
        break;

      case 10009: // 🔙 BACK (Samsung)
      case 27:     // ESC
        this.close();
        break;
    }
  };

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  close() {
    this.dialogRef.close();
  }
}
