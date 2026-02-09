import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatMaterialModule } from './_core/mat-material/mat-material.module';
import { HttpClientModule } from '@angular/common/http';
import { ToastrModule } from 'ngx-toastr';
import { CoreModule } from './_core/core/core.module';
import { SplitScreenComponent } from './split-screen/split-screen.component';
import { ContentPlayerComponent } from './content-player/content-player.component';
import { ScrollerComponent } from './scroller/scroller.component';
import { YoutubePlayerComponent } from './_core/cell-renders/youtube-player/youtube-player.component';
import { SplashComponent } from './splash/splash.component';



@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    SplitScreenComponent,
    ContentPlayerComponent,
    ScrollerComponent,
    YoutubePlayerComponent,
    SplashComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatMaterialModule,
    HttpClientModule,
    CoreModule,
    ToastrModule.forRoot({
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true
    }),
    
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
