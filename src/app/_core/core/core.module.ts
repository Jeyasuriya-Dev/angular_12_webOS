import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { PdfViewerComponent } from '../cell-renders/pdf-viewer/pdf-viewer.component';
import { GridsterModule } from 'angular-gridster2';
import { YtplayerComponent } from '../cell-renders/ytplayer/ytplayer.component';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

import { MatMaterialModule } from '../mat-material/mat-material.module';
import { ConnectionServiceModule } from 'ng-connection-service';
import { Menu2Component } from '../_utils/menu2/menu2.component';
import { UsermanualComponent } from '../_utils/usermanual/usermanual.component';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Menu1Component } from '../_utils/menu1/menu1.component';
import { MatSliderModule } from '@angular/material/slider';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { InlineProgressDialogComponent } from '../services/filesystem.service';
import { VideoPlayerComponent } from '../cell-renders/video-player/video-player.component';
import { PdfViewerUsermanualComponent } from '../cell-renders/pdf-viewer-usermanual/pdf-viewer-usermanual.component';
@NgModule({
  declarations: [
    PdfViewerComponent,
    YtplayerComponent,
    Menu2Component,
    UsermanualComponent,
    Menu1Component,
    InlineProgressDialogComponent,
    VideoPlayerComponent,
    PdfViewerUsermanualComponent
  ],
  imports: [
    CommonModule,
    YouTubePlayerModule,
    GridsterModule,
    NgxExtendedPdfViewerModule,
    MatMaterialModule,
    ConnectionServiceModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatDialogModule,
    MatProgressBarModule
  ],
  exports: [
    YouTubePlayerModule,
    PdfViewerComponent,
    GridsterModule,
    YtplayerComponent,
    NgxExtendedPdfViewerModule,
    MatMaterialModule,
    Menu2Component,
    UsermanualComponent,
    Menu1Component,
    MatSliderModule,
    MatDialogModule,
    MatProgressBarModule,
    VideoPlayerComponent
  ]
})
export class CoreModule { }
