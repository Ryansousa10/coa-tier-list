import { Routes } from '@angular/router';
import { TierListComponent } from './pages/tier-list/tier-list.component';
import { SpecDetailComponent } from './pages/spec-detail/spec-detail.component';
import { AboutComponent } from './pages/about/about.component';

export const routes: Routes = [
  { path: '', component: TierListComponent },
  { path: 'spec/:classKey/:specKey', component: SpecDetailComponent },
  { path: 'sobre', component: AboutComponent },
  { path: '**', redirectTo: '' },
];
