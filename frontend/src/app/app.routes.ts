import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

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
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'attendance:read' },
    loadComponent: () =>
      import('./features/attendance/attendance-sheet.component').then(
        (m) => m.AttendanceSheetComponent,
      ),
  },
  {
    path: 'attendance/my-attendance',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'attendance:self_read' },
    loadComponent: () =>
      import('./features/attendance/my-attendance.component').then((m) => m.MyAttendanceComponent),
  },
  {
    path: 'leave',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'leave:read' },
    loadComponent: () =>
      import('./features/leave/leave-hub.component').then((m) => m.LeaveHubComponent),
  },
  {
    path: 'leave/my-leave',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'leave:self_read' },
    loadComponent: () =>
      import('./features/leave/my-leave.component').then((m) => m.MyLeaveComponent),
  },
  {
    path: 'payroll',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'payroll:read' },
    loadComponent: () =>
      import('./features/payroll/payroll-hub.component').then((m) => m.PayrollHubComponent),
  },
  {
    path: 'payroll/periods/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'payroll:read' },
    loadComponent: () =>
      import('./features/payroll/payroll-period-detail.component').then(
        (m) => m.PayrollPeriodDetailComponent,
      ),
  },
  {
    path: 'payroll/my-payroll',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'payroll:self_read' },
    loadComponent: () =>
      import('./features/payroll/my-payroll.component').then((m) => m.MyPayrollComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
