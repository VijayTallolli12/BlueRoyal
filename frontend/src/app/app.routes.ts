import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'attendance',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/attendance/attendance-sheet.component').then(
        (m) => m.AttendanceSheetComponent,
      ),
  },
  {
    path: 'attendance/my-attendance',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/attendance/my-attendance.component').then((m) => m.MyAttendanceComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
