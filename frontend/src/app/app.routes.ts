import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { PublicLayoutComponent } from './core/components/public-layout.component';
import { AuthenticatedLayoutComponent } from './core/components/authenticated-layout.component';
import { LoginTestComponent } from './features/auth/login-test.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    component: PublicLayoutComponent,
    children: [
      {
        path: 'login',
        component: LoginTestComponent,
      },
    ],
  },
  {
    component: AuthenticatedLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'masters',
        canActivate: [permissionGuard],
        data: { permission: 'designations:read' },
        loadComponent: () =>
          import('./features/masters/masters-hub.component').then((m) => m.MastersHubComponent),
      },
      {
        path: 'attendance',
        canActivate: [permissionGuard],
        data: { permission: 'attendance:read' },
        loadComponent: () =>
          import('./features/attendance/attendance-sheet.component').then(
            (m) => m.AttendanceSheetComponent,
          ),
      },
      {
        path: 'attendance/my-attendance',
        canActivate: [permissionGuard],
        data: { permission: 'attendance:self_read' },
        loadComponent: () =>
          import('./features/attendance/my-attendance.component').then((m) => m.MyAttendanceComponent),
      },
      {
        path: 'leave',
        canActivate: [permissionGuard],
        data: { permission: 'leave:read' },
        loadComponent: () =>
          import('./features/leave/leave-hub.component').then((m) => m.LeaveHubComponent),
      },
      {
        path: 'leave/my-leave',
        canActivate: [permissionGuard],
        data: { permission: 'leave:self_read' },
        loadComponent: () =>
          import('./features/leave/my-leave.component').then((m) => m.MyLeaveComponent),
      },
      {
        path: 'payroll',
        canActivate: [permissionGuard],
        data: { permission: 'payroll:read' },
        loadComponent: () =>
          import('./features/payroll/payroll-hub.component').then((m) => m.PayrollHubComponent),
      },
      {
        path: 'payroll/periods/:id',
        canActivate: [permissionGuard],
        data: { permission: 'payroll:read' },
        loadComponent: () =>
          import('./features/payroll/payroll-period-detail.component').then(
            (m) => m.PayrollPeriodDetailComponent,
          ),
      },
      {
        path: 'payroll/my-payroll',
        canActivate: [permissionGuard],
        data: { permission: 'payroll:self_read' },
        loadComponent: () =>
          import('./features/payroll/my-payroll.component').then((m) => m.MyPayrollComponent),
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
