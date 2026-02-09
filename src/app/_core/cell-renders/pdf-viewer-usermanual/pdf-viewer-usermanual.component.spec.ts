import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfViewerUsermanualComponent } from './pdf-viewer-usermanual.component';

describe('PdfViewerUsermanualComponent', () => {
  let component: PdfViewerUsermanualComponent;
  let fixture: ComponentFixture<PdfViewerUsermanualComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PdfViewerUsermanualComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PdfViewerUsermanualComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
