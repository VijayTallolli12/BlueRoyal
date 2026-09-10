import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';
import { AuthService } from '../services/auth.service';
import { UserProfileDto } from '@blue-royal/contracts';

describe('AppShellComponent - Role-Specific Sidebar Navigation', () => {
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    authService = TestBed.inject(AuthService);
  });

  function mockUser(roles: string[], permissions: string[] = []): void {
    const user: UserProfileDto = {
      id: 'test-user-id',
      email: `${roles[0]}@blueroyal.local`,
      firstName: 'Test',
      lastName: 'User',
      status: 'active',
      roles,
      permissions,
    };
    authService.currentUser.set(user);
  }

  describe('SUPER_ADMIN Navigation Model', () => {
    it('should generate ONLY Super Admin navigation and strictly exclude MY WORKSPACE', () => {
      mockUser(['super_admin'], ['*']);
      const fixture = TestBed.createComponent(AppShellComponent);
      const component = fixture.componentInstance;

      expect(component.isSuperAdmin()).toBe(true);
      expect(component.isHrAdmin()).toBe(false);
      expect(component.isEmployee()).toBe(false);

      const sections = component.navigationSections();
      const sectionIds = sections.map(s => s.id);
      const sectionTitles = sections.map(s => s.title);

      expect(sectionIds).toEqual(['core', 'orgSetup', 'workforceOversight', 'operationsGov']);
      expect(sectionTitles).toEqual([
        'CORE',
        'ORGANIZATION SETUP',
        'WORKFORCE OVERSIGHT',
        'OPERATIONS & GOVERNANCE',
      ]);

      // Assert MY WORKSPACE is completely absent
      expect(sectionIds).not.toContain('workspace');
      expect(sectionTitles).not.toContain('MY WORKSPACE');

      // Assert all items across all sections
      const allItems = sections.flatMap(s => s.items);
      const itemLabels = allItems.map(i => i.label);

      // Super Admin specific labels
      expect(itemLabels).toContain('Dashboard');
      expect(itemLabels).toContain('Clients');
      expect(itemLabels).toContain('Projects');
      expect(itemLabels).toContain('Designations');
      expect(itemLabels).toContain('Work Shifts & Hours');
      expect(itemLabels).toContain('Holidays & Weekly Offs');
      expect(itemLabels).toContain('Salary Packages');
      expect(itemLabels).toContain('Employee Directory');
      expect(itemLabels).toContain('Workforce Deployments');
      expect(itemLabels).toContain('Client Invoicing Rates');
      expect(itemLabels).toContain('Attendance Periods');
      expect(itemLabels).toContain('Payroll Processing');
      expect(itemLabels).toContain('Compliance & Documents');

      // Assert zero ESS items exist
      expect(itemLabels).not.toContain('My Timesheet');
      expect(itemLabels).not.toContain('My Leave');
      expect(itemLabels).not.toContain('My Payslips');
      expect(itemLabels).not.toContain('My Documents');
    });
  });

  describe('HR_ADMIN Navigation Model', () => {
    it('should generate ONLY HR Admin navigation and strictly exclude MY WORKSPACE', () => {
      mockUser(['hr_admin'], [
        'employees:read', 'onboarding:read', 'documents:read',
        'attendance:read', 'leave:read', 'payroll:read',
        'attendance:self_read', 'leave:self_read'
      ]);
      const fixture = TestBed.createComponent(AppShellComponent);
      const component = fixture.componentInstance;

      expect(component.isSuperAdmin()).toBe(false);
      expect(component.isHrAdmin()).toBe(true);
      expect(component.isEmployee()).toBe(false);

      const sections = component.navigationSections();
      const sectionIds = sections.map(s => s.id);
      const sectionTitles = sections.map(s => s.title);

      expect(sectionIds).toEqual(['core', 'people', 'workforceOps', 'payroll', 'orgRef']);
      expect(sectionTitles).toEqual([
        'CORE',
        'PEOPLE & ONBOARDING',
        'WORKFORCE OPERATIONS',
        'COMPENSATION & PAYROLL',
        'ORGANIZATION REFERENCE',
      ]);

      // Assert MY WORKSPACE is completely absent
      expect(sectionIds).not.toContain('workspace');
      expect(sectionTitles).not.toContain('MY WORKSPACE');

      const allItems = sections.flatMap(s => s.items);
      const itemLabels = allItems.map(i => i.label);

      expect(itemLabels).toContain('HR Dashboard');
      expect(itemLabels).toContain('Employee Directory');
      expect(itemLabels).toContain('Onboarding Hub');
      expect(itemLabels).toContain('Document Center');
      expect(itemLabels).toContain('Workforce Deployments');
      expect(itemLabels).toContain('Worker Pay Rates');
      expect(itemLabels).toContain('Attendance & Timesheets');
      expect(itemLabels).toContain('Leave Management');
      expect(itemLabels).toContain('Payroll Processing');
      expect(itemLabels).toContain('Job Designations');
      expect(itemLabels).toContain('Work Shifts');
      expect(itemLabels).toContain('Company Holidays');
      expect(itemLabels).toContain('Commercial Clients');

      // Assert zero ESS items exist
      expect(itemLabels).not.toContain('My Timesheet');
      expect(itemLabels).not.toContain('My Leave');
      expect(itemLabels).not.toContain('My Payslips');
      expect(itemLabels).not.toContain('My Documents');
    });
  });

  describe('EMPLOYEE Navigation Model', () => {
    it('should generate Employee Portal and MY WORKSPACE only', () => {
      mockUser(['employee'], [
        'attendance:self_read', 'leave:self_read', 'payroll:self_read', 'documents:self_read'
      ]);
      const fixture = TestBed.createComponent(AppShellComponent);
      const component = fixture.componentInstance;

      expect(component.isSuperAdmin()).toBe(false);
      expect(component.isHrAdmin()).toBe(false);
      expect(component.isEmployee()).toBe(true);

      const sections = component.navigationSections();
      const sectionIds = sections.map(s => s.id);
      const sectionTitles = sections.map(s => s.title);

      expect(sectionIds).toEqual(['core', 'workspace']);
      expect(sectionTitles).toEqual(['CORE', 'MY WORKSPACE']);

      const allItems = sections.flatMap(s => s.items);
      const itemLabels = allItems.map(i => i.label);

      expect(itemLabels).toEqual([
        'Employee Portal',
        'My Timesheet',
        'My Leave',
        'My Payslips',
        'My Documents'
      ]);

      // Assert zero Admin sections or items exist
      expect(sectionIds).not.toContain('orgSetup');
      expect(sectionIds).not.toContain('workforceOversight');
      expect(sectionIds).not.toContain('operationsGov');
      expect(sectionIds).not.toContain('people');
      expect(sectionIds).not.toContain('workforceOps');
      expect(sectionIds).not.toContain('payroll');
      expect(sectionIds).not.toContain('orgRef');
      expect(itemLabels).not.toContain('Clients');
      expect(itemLabels).not.toContain('Projects');
      expect(itemLabels).not.toContain('Work Shifts & Hours');
      expect(itemLabels).not.toContain('Payroll Processing');
    });
  });
});
