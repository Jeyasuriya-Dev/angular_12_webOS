import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { SplitScreenComponent } from './split-screen/split-screen.component';
import { UsermanualComponent } from './_core/_utils/usermanual/usermanual.component';
import { LoginRedirectGuard } from './_core/guards/login-redirect.guard';
import { SplashComponent } from './splash/splash.component';


const routes: Routes = [
  { path: '', component: SplashComponent},
  { path: 'reload', component: LoginComponent },
  { path: 'login', component: LoginComponent, canActivate: [LoginRedirectGuard], data: { isLoginPage: true } },
  { path: 'player', component: SplitScreenComponent },
  { path: "**", component: LoginComponent },
  { path: 'user-manual', component: UsermanualComponent }
];

@NgModule({
  // imports: [RouterModule.forRoot(routes)],
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
