import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { MasterComponent } from './components/master/master.component';
import { PlayerComponent } from './components/player/player.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'master', component: MasterComponent },
  { path: 'player', component: PlayerComponent },
  { path: '**', redirectTo: '' }
];
