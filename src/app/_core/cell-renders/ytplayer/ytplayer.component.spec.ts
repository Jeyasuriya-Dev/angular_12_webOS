import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YtplayerComponent } from './ytplayer.component';

describe('YtplayerComponent', () => {
  let component: YtplayerComponent;
  let fixture: ComponentFixture<YtplayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ YtplayerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(YtplayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
