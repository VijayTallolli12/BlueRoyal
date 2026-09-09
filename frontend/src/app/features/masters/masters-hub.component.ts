import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MasterService } from '../../core/services/master.service';
import {
  DesignationDto,
  ClientDto,
  ProjectDto,
  EmployeeDto,
  EmployeeAssignmentDto,
  ResolvedBillingRateDto,
  ShiftDto,
  PublicHolidayDto,
  SalaryComponentDto,
} from '@blue-royal/contracts';

type MasterTab =
  | 'overview'
  | 'designations'
  | 'employees'
  | 'clients'
  | 'projects'
  | 'assignments'
  | 'rates'
  | 'shifts'
  | 'calendar'
  | 'salary';

@Component({
  selector: 'app-masters-hub',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="masters-container">
      <nav class="sub-nav">
        <button [class.active]="activeTab() === 'overview'" (click)="setTab('overview')">Phase 1 Architecture</button>
        <button [class.active]="activeTab() === 'designations'" (click)="setTab('designations')">Designations ({{ designations().length }})</button>
        <button [class.active]="activeTab() === 'employees'" (click)="setTab('employees')">Employees ({{ employees().length }})</button>
        <button [class.active]="activeTab() === 'clients'" (click)="setTab('clients')">Clients ({{ clients().length }})</button>
        <button [class.active]="activeTab() === 'projects'" (click)="setTab('projects')">Projects ({{ projects().length }})</button>
        <button [class.active]="activeTab() === 'assignments'" (click)="setTab('assignments')">Assignments ({{ assignments().length }})</button>
        <button [class.active]="activeTab() === 'rates'" (click)="setTab('rates')">Dual-Stream Rates & Invoicing Resolution</button>
        <button [class.active]="activeTab() === 'shifts'" (click)="setTab('shifts')">Shifts & Roster</button>
        <button [class.active]="activeTab() === 'calendar'" (click)="setTab('calendar')">Calendar & Holidays</button>
        <button [class.active]="activeTab() === 'salary'" (click)="setTab('salary')">Salary Packages</button>
      </nav>

      <!-- TAB: OVERVIEW -->
      @if (activeTab() === 'overview') {
        <div class="panel">
          <h2>Phase 1 Master Catalogs & Work Rostering Engine</h2>
          <p class="subtitle">Production architecture managing 13 relational tables with authoritative effective-dating intervals and dual-stream rates.</p>
          
          <div class="flow-card">
            <h3>Dual-Stream Commercial & Remuneration Flow</h3>
            <div class="flow-diagram">
              <div class="flow-step">
                <strong>1. Work Date & Worker</strong>
                <span>Date: YYYY-MM-DD</span>
              </div>
              <div class="flow-arrow">➔</div>
              <div class="flow-step">
                <strong>2. Active Assignment</strong>
                <span>Client + Project + Designation</span>
              </div>
              <div class="flow-arrow">➔</div>
              <div class="flow-step">
                <strong>3. Rate Resolution</strong>
                <span>Project Rate ➔ Client Fallback ➔ Error</span>
              </div>
            </div>
            <p class="note">Employee pay rates are strictly decoupled from client billing rates. Employee pay is never derived from client invoices.</p>
          </div>
        </div>
      }

      <!-- TAB: DESIGNATIONS -->
      @if (activeTab() === 'designations') {
        <div class="panel">
          <div class="panel-header">
            <h2>Designations Master Catalog</h2>
            <button class="btn btn-primary" (click)="showNewDesignation = !showNewDesignation">
              <span class="material-symbols-outlined icon-sm">{{ showNewDesignation ? 'close' : 'add' }}</span>
              <span>{{ showNewDesignation ? 'Cancel' : 'Add Designation' }}</span>
            </button>
          </div>

          @if (showNewDesignation) {
            <form class="create-form" (ngSubmit)="createDesignation()">
              <div class="form-row">
                <input type="text" [(ngModel)]="newDesCode" name="newDesCode" placeholder="Code (e.g. DES-PLUMB)" required />
                <input type="text" [(ngModel)]="newDesTitle" name="newDesTitle" placeholder="Title (e.g. Master Plumber)" required />
                <input type="text" [(ngModel)]="newDesDesc" name="newDesDesc" placeholder="Description" />
                <button type="submit" class="btn btn-success">
                  <span class="material-symbols-outlined icon-sm">check</span>
                  <span>Save</span>
                </button>
              </div>
            </form>
          }

          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (d of designations(); track d.id) {
                <tr>
                  <td><code>{{ d.code }}</code></td>
                  <td><strong>{{ d.title }}</strong></td>
                  <td>{{ d.description || '—' }}</td>
                  <td><span class="badge" [class.badge-active]="d.isActive">Active</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB: EMPLOYEES -->
      @if (activeTab() === 'employees') {
        <div class="panel">
          <div class="panel-header">
            <h2>Employees (Core Biographical Profile)</h2>
            <button class="btn btn-primary" (click)="showNewEmployee = !showNewEmployee">
              <span class="material-symbols-outlined icon-sm">{{ showNewEmployee ? 'close' : 'add' }}</span>
              <span>{{ showNewEmployee ? 'Cancel' : 'Register Employee' }}</span>
            </button>
          </div>

          @if (showNewEmployee) {
            <form class="create-form" (ngSubmit)="createEmployee()">
              <div class="form-grid">
                <input type="text" [(ngModel)]="newEmpCode" name="newEmpCode" placeholder="Emp Code (BR-001)" required />
                <input type="text" [(ngModel)]="newEmpFirst" name="newEmpFirst" placeholder="First Name" required />
                <input type="text" [(ngModel)]="newEmpLast" name="newEmpLast" placeholder="Last Name" required />
                <select [(ngModel)]="newEmpGender" name="newEmpGender">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <input type="date" [(ngModel)]="newEmpDob" name="newEmpDob" placeholder="DOB" required />
                <input type="text" [(ngModel)]="newEmpNat" name="newEmpNat" placeholder="Nationality" required />
                <input type="date" [(ngModel)]="newEmpJoining" name="newEmpJoining" placeholder="Joining Date" required />
                <button type="submit" class="btn btn-success">
                  <span class="material-symbols-outlined icon-sm">check</span>
                  <span>Register Employee</span>
                </button>
              </div>
            </form>
          }

          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Nationality</th>
                <th>Joining Date</th>
                <th>Active Designation (via Assignment)</th>
                <th>Active Deployment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (emp of employees(); track emp.id) {
                <tr>
                  <td><code>{{ emp.employeeCode }}</code></td>
                  <td>{{ emp.firstName }} {{ emp.lastName }}</td>
                  <td>{{ emp.nationality }}</td>
                  <td>{{ emp.dateOfJoining }}</td>
                  <td>
                    @if (emp.currentDesignation) {
                      <strong>{{ emp.currentDesignation.title }}</strong>
                    } @else {
                      <em class="text-muted">Unassigned</em>
                    }
                  </td>
                  <td>
                    @if (emp.currentAssignment) {
                      <span>{{ emp.currentAssignment.clientName }} / {{ emp.currentAssignment.projectName }}</span>
                    } @else {
                      <em class="text-muted">No active project</em>
                    }
                  </td>
                  <td><span class="badge badge-active">{{ emp.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB: CLIENTS & PROJECTS -->
      @if (activeTab() === 'clients') {
        <div class="panel">
          <div class="panel-header">
            <h2>Clients Master</h2>
            <button class="btn btn-primary" (click)="showNewClient = !showNewClient">
              <span class="material-symbols-outlined icon-sm">{{ showNewClient ? 'close' : 'add' }}</span>
              <span>{{ showNewClient ? 'Cancel' : 'Add Client' }}</span>
            </button>
          </div>

          @if (showNewClient) {
            <form class="create-form" (ngSubmit)="createClient()">
              <div class="form-row">
                <input type="text" [(ngModel)]="newClientCode" name="newClientCode" placeholder="Code (e.g. CLI-EMAAR)" required />
                <input type="text" [(ngModel)]="newClientName" name="newClientName" placeholder="Client Legal Name" required />
                <input type="text" [(ngModel)]="newClientContact" name="newClientContact" placeholder="Contact Person" />
                <button type="submit" class="btn btn-success">
                  <span class="material-symbols-outlined icon-sm">check</span>
                  <span>Save Client</span>
                </button>
              </div>
            </form>
          }

          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Company Name</th>
                <th>Contact Person</th>
                <th>Projects Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (c of clients(); track c.id) {
                <tr>
                  <td><code>{{ c.code }}</code></td>
                  <td><strong>{{ c.name }}</strong></td>
                  <td>{{ c.contactPerson || '—' }}</td>
                  <td><span class="badge">Commercial Partner</span></td>
                  <td><span class="badge badge-active">Active</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB: PROJECTS -->
      @if (activeTab() === 'projects') {
        <div class="panel">
          <div class="panel-header">
            <h2>Project Worksites</h2>
            <button class="btn btn-primary" (click)="showNewProject = !showNewProject">
              <span class="material-symbols-outlined icon-sm">{{ showNewProject ? 'close' : 'add' }}</span>
              <span>{{ showNewProject ? 'Cancel' : 'Add Project' }}</span>
            </button>
          </div>

          @if (showNewProject) {
            <form class="create-form" (ngSubmit)="createProject()">
              <div class="form-grid">
                <select [(ngModel)]="newProjClientId" name="newProjClientId" required>
                  <option value="">-- Select Client --</option>
                  @for (c of clients(); track c.id) {
                    <option [value]="c.id">{{ c.name }} ({{ c.code }})</option>
                  }
                </select>
                <input type="text" [(ngModel)]="newProjCode" name="newProjCode" placeholder="Project Code" required />
                <input type="text" [(ngModel)]="newProjName" name="newProjName" placeholder="Project Name" required />
                <input type="text" [(ngModel)]="newProjLocation" name="newProjLocation" placeholder="Location" />
                <button type="submit" class="btn btn-success">
                  <span class="material-symbols-outlined icon-sm">check</span>
                  <span>Save Project</span>
                </button>
              </div>
            </form>
          }

          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Project Name</th>
                <th>Client</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (p of projects(); track p.id) {
                <tr>
                  <td><code>{{ p.code }}</code></td>
                  <td><strong>{{ p.name }}</strong></td>
                  <td>{{ p.clientName || p.clientId }}</td>
                  <td>{{ p.siteLocation || '—' }}</td>
                  <td><span class="badge badge-active">{{ p.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB: ASSIGNMENTS -->
      @if (activeTab() === 'assignments') {
        <div class="panel">
          <div class="panel-header">
            <h2>Employee Project Assignments & Authoritative Designation</h2>
            <button class="btn btn-primary" (click)="showNewAssignment = !showNewAssignment">
              <span class="material-symbols-outlined icon-sm">{{ showNewAssignment ? 'close' : 'add' }}</span>
              <span>{{ showNewAssignment ? 'Cancel' : 'Deploy Employee' }}</span>
            </button>
          </div>

          @if (showNewAssignment) {
            <form class="create-form" (ngSubmit)="createAssignment()">
              <div class="form-grid">
                <select [(ngModel)]="newAssignEmpId" name="newAssignEmpId" required>
                  <option value="">-- Select Employee --</option>
                  @for (e of employees(); track e.id) {
                    <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                  }
                </select>
                <select [(ngModel)]="newAssignClientId" (change)="onAssignClientChange()" name="newAssignClientId" required>
                  <option value="">-- Select Client --</option>
                  @for (c of clients(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
                <select [(ngModel)]="newAssignProjId" name="newAssignProjId" required>
                  <option value="">-- Select Project --</option>
                  @for (p of filteredProjects(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
                <select [(ngModel)]="newAssignDesId" name="newAssignDesId" required>
                  <option value="">-- Assign Designation --</option>
                  @for (d of designations(); track d.id) {
                    <option [value]="d.id">{{ d.title }}</option>
                  }
                </select>
                <input type="date" [(ngModel)]="newAssignFrom" name="newAssignFrom" placeholder="Effective From" required />
                <button type="submit" class="btn btn-success">
                  <span class="material-symbols-outlined icon-sm">check</span>
                  <span>Deploy</span>
                </button>
              </div>
            </form>
          }

          <table class="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Client</th>
                <th>Project</th>
                <th>Designation (Authoritative)</th>
                <th>Effective Interval</th>
                <th>Timeline Status</th>
              </tr>
            </thead>
            <tbody>
              @for (a of assignments(); track a.id) {
                <tr>
                  <td><strong>{{ a.employeeName || a.employeeId }}</strong> ({{ a.employeeCode || '—' }})</td>
                  <td>{{ a.clientName || a.clientId }}</td>
                  <td>{{ a.projectName || a.projectId }}</td>
                  <td><span class="tag">{{ a.designationTitle || a.designationId }}</span></td>
                  <td><code>{{ a.effectiveFrom }} ➔ {{ a.effectiveTo || 'Ongoing' }}</code></td>
                  <td>
                    <span class="badge" [class.badge-active]="!a.effectiveTo">
                      {{ a.effectiveTo ? 'Closed' : 'Active Deployment' }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB: RATES & INVOICING RESOLUTION -->
      @if (activeTab() === 'rates') {
        <div class="panel">
          <h2>Dual-Stream Rates & Point-in-Time Billing Resolution</h2>
          
          <div class="resolution-tester">
            <h3>Test Point-in-Time Commercial Resolution Engine</h3>
            <p class="subtitle">Executes the 4-rate pipeline: Work Date ➔ Active Assignment ➔ Project Rate ➔ Client Fallback ➔ Missing Rate</p>
            <div class="form-row">
              <select [(ngModel)]="resolutionEmpId" name="resolutionEmpId">
                <option value="">-- Select Employee --</option>
                @for (e of employees(); track e.id) {
                  <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                }
              </select>
              <input type="date" [(ngModel)]="resolutionWorkDate" name="resolutionWorkDate" />
              <button class="btn btn-primary" (click)="resolveBilling()">
                <span class="material-symbols-outlined icon-sm">science</span>
                <span>Test Resolution</span>
              </button>
            </div>

            @if (resolvedRate(); as res) {
              <div class="resolution-result" [class.resolved]="res.status === 'RESOLVED'" [class.error]="res.status !== 'RESOLVED'">
                <h4>Resolution Result: <code>{{ res.status }}</code></h4>
                @if (res.status === 'RESOLVED') {
                  <p><strong>Resolved Source:</strong> {{ res.rateSource }}</p>
                  <p><strong>Normal Billing Rate:</strong> AED {{ res.normalBillingRate }}/hr</p>
                  <p><strong>OT Billing Rate:</strong> AED {{ res.otBillingRate }}/hr</p>
                } @else {
                  <p class="error-msg">{{ res.errorMessage }} (Code: {{ res.errorCode }})</p>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- TAB: SHIFTS -->
      @if (activeTab() === 'shifts') {
        <div class="panel">
          <div class="panel-header">
            <h2>Shifts & Rostering</h2>
            <button class="btn btn-primary" (click)="showNewShift = !showNewShift">
              <span class="material-symbols-outlined icon-sm">{{ showNewShift ? 'close' : 'add' }}</span>
              <span>{{ showNewShift ? 'Cancel' : 'Add Shift' }}</span>
            </button>
          </div>

          @if (showNewShift) {
            <form class="create-form" (ngSubmit)="createShift()">
              <div class="form-grid">
                <input type="text" [(ngModel)]="newShiftCode" name="newShiftCode" placeholder="Code (e.g. SH-DAY-8H)" required />
                <input type="text" [(ngModel)]="newShiftName" name="newShiftName" placeholder="Shift Name" required />
                <input type="time" [(ngModel)]="newShiftStart" name="newShiftStart" required />
                <input type="time" [(ngModel)]="newShiftEnd" name="newShiftEnd" required />
                <input type="number" [(ngModel)]="newShiftBreak" name="newShiftBreak" placeholder="Break Mins" />
                <input type="number" step="0.5" [(ngModel)]="newShiftHours" name="newShiftHours" placeholder="Work Hours (8.0)" required />
                <button type="submit" class="btn btn-success">
                  <span class="material-symbols-outlined icon-sm">check</span>
                  <span>Save Shift</span>
                </button>
              </div>
            </form>
          }

          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Timings</th>
                <th>Break</th>
                <th>Work Hours</th>
                <th>Night Shift</th>
              </tr>
            </thead>
            <tbody>
              @for (s of shifts(); track s.id) {
                <tr>
                  <td><code>{{ s.code }}</code></td>
                  <td><strong>{{ s.name }}</strong></td>
                  <td>{{ s.startTime }} – {{ s.endTime }}</td>
                  <td>{{ s.breakMinutes }}m</td>
                  <td>{{ s.workHours }} hrs</td>
                  <td>{{ s.isNightShift ? 'Yes' : 'No' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB: CALENDAR & HOLIDAYS -->
      @if (activeTab() === 'calendar') {
        <div class="panel">
          <div class="panel-header">
            <h2>Company-Configured Public Holidays</h2>
            <button class="btn btn-primary" (click)="showNewHoliday = !showNewHoliday">
              <span class="material-symbols-outlined icon-sm">{{ showNewHoliday ? 'close' : 'add' }}</span>
              <span>{{ showNewHoliday ? 'Cancel' : 'Add Holiday' }}</span>
            </button>
          </div>

          @if (showNewHoliday) {
            <form class="create-form" (ngSubmit)="createHoliday()">
              <div class="form-row">
                <input type="number" [(ngModel)]="newHolidayYear" name="newHolidayYear" placeholder="Year (2026)" required />
                <input type="text" [(ngModel)]="newHolidayName" name="newHolidayName" placeholder="Holiday Name" required />
                <input type="date" [(ngModel)]="newHolidayDate" name="newHolidayDate" required />
                <input type="text" [(ngModel)]="newHolidayDesc" name="newHolidayDesc" placeholder="Description" />
                <button type="submit" class="btn btn-success">
                  <span class="material-symbols-outlined icon-sm">check</span>
                  <span>Add Holiday</span>
                </button>
              </div>
            </form>
          }

          <table class="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Holiday Name</th>
                <th>Date</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              @for (h of holidays(); track h.id) {
                <tr>
                  <td>{{ h.calendarYear }}</td>
                  <td><strong>{{ h.name }}</strong></td>
                  <td><code>{{ h.holidayDate }}</code></td>
                  <td>{{ h.description || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- TAB: SALARY COMPONENTS -->
      @if (activeTab() === 'salary') {
        <div class="panel">
          <h2>Salary Components Master (Monthly Salaried Structure)</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Component Name</th>
                <th>Type</th>
                <th>Calculation</th>
                <th>WPS Basic</th>
                <th>WPS Housing</th>
                <th>Recurring</th>
              </tr>
            </thead>
            <tbody>
              @for (sc of salaryComponents(); track sc.id) {
                <tr>
                  <td><code>{{ sc.code }}</code></td>
                  <td><strong>{{ sc.name }}</strong></td>
                  <td><span class="badge" [class.badge-active]="sc.type === 'earning'">{{ sc.type | uppercase }}</span></td>
                  <td>{{ sc.calculationType }}</td>
                  <td>{{ sc.isWpsBasic ? '✓' : '—' }}</td>
                  <td>{{ sc.isWpsHousing ? '✓' : '—' }}</td>
                  <td>{{ sc.isRecurring ? 'Yes' : 'No' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .masters-container {
        margin-top: 0.5rem;
      }
      .sub-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        background: #ffffff;
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        margin-bottom: 1.25rem;
      }
      .sub-nav button {
        background: transparent;
        border: 1px solid transparent;
        padding: 0.45rem 0.875rem;
        border-radius: var(--radius-md);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
      }
      .sub-nav button:hover {
        background: var(--bg-surface-subtle);
        color: var(--text-primary);
        border-color: var(--border-default);
        transform: translateY(-1px);
      }
      .sub-nav button:active {
        transform: translateY(0);
      }
      .sub-nav button.active {
        background: var(--brand-50);
        color: var(--brand-700);
        border-color: var(--brand-200);
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(29, 78, 216, 0.1);
      }
      .panel {
        background: #ffffff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        box-shadow: var(--shadow-sm);
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border-subtle);
      }
      .panel-header h2 {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .subtitle {
        color: var(--text-muted);
        margin-bottom: 1.25rem;
        font-size: 0.8125rem;
      }
      .create-form {
        background: var(--bg-surface-subtle);
        border: 1px solid var(--border-default);
        padding: 1rem 1.25rem;
        border-radius: var(--radius-md);
        margin-bottom: 1.25rem;
      }
      .form-row {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
      }
      .badge {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        background: var(--bg-surface-subtle);
        color: var(--text-secondary);
        border: 1px solid var(--border-default);
      }
      .badge-active {
        background: var(--status-approved-bg);
        color: var(--status-approved-text);
        border-color: var(--status-approved-border);
      }
      .tag {
        background: var(--brand-50);
        color: var(--brand-700);
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-sm);
        font-weight: 600;
        font-size: 0.75rem;
        border: 1px solid var(--brand-200);
      }
      .flow-card {
        background: var(--bg-surface-subtle);
        border: 1px solid var(--border-default);
        padding: 1.25rem;
        border-radius: var(--radius-md);
        margin-top: 1rem;
      }
      .flow-diagram {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin: 1rem 0;
        flex-wrap: wrap;
      }
      .flow-step {
        background: #ffffff;
        border: 1px solid var(--border-default);
        padding: 0.75rem 1rem;
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        box-shadow: var(--shadow-sm);
      }
      .flow-arrow {
        font-size: 1.25rem;
        color: var(--text-muted);
      }
      .resolution-tester {
        background: var(--bg-surface-subtle);
        border: 1px solid var(--border-default);
        padding: 1.25rem;
        border-radius: var(--radius-md);
        margin-top: 1rem;
      }
      .resolution-result {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: var(--radius-md);
      }
      .resolution-result.resolved {
        background: var(--status-approved-bg);
        border: 1px solid var(--status-approved-border);
        color: var(--status-approved-text);
      }
      .resolution-result.error {
        background: var(--status-danger-bg);
        border: 1px solid var(--status-danger-border);
        color: var(--status-danger-text);
      }
    `,
  ],
})
export class MastersHubComponent implements OnInit {
  public activeTab = signal<MasterTab>('overview');

  public designations = signal<DesignationDto[]>([]);
  public clients = signal<ClientDto[]>([]);
  public projects = signal<ProjectDto[]>([]);
  public employees = signal<EmployeeDto[]>([]);
  public assignments = signal<EmployeeAssignmentDto[]>([]);
  public shifts = signal<ShiftDto[]>([]);
  public holidays = signal<PublicHolidayDto[]>([]);
  public salaryComponents = signal<SalaryComponentDto[]>([]);

  public filteredProjects = signal<ProjectDto[]>([]);
  public resolvedRate = signal<ResolvedBillingRateDto | null>(null);

  // Form toggles
  public showNewDesignation = false;
  public showNewEmployee = false;
  public showNewClient = false;
  public showNewProject = false;
  public showNewAssignment = false;
  public showNewShift = false;
  public showNewHoliday = false;

  // New Designation Form State
  public newDesCode = '';
  public newDesTitle = '';
  public newDesDesc = '';

  // New Employee Form State
  public newEmpCode = '';
  public newEmpFirst = '';
  public newEmpLast = '';
  public newEmpGender = 'male';
  public newEmpDob = '';
  public newEmpNat = '';
  public newEmpJoining = '';

  // New Client Form State
  public newClientCode = '';
  public newClientName = '';
  public newClientContact = '';

  // New Project Form State
  public newProjClientId = '';
  public newProjCode = '';
  public newProjName = '';
  public newProjLocation = '';

  // New Assignment Form State
  public newAssignEmpId = '';
  public newAssignClientId = '';
  public newAssignProjId = '';
  public newAssignDesId = '';
  public newAssignFrom = '';

  // New Shift Form State
  public newShiftCode = '';
  public newShiftName = '';
  public newShiftStart = '07:00';
  public newShiftEnd = '16:00';
  public newShiftBreak = 60;
  public newShiftHours = 8.0;

  // New Holiday Form State
  public newHolidayYear = 2026;
  public newHolidayName = '';
  public newHolidayDate = '';
  public newHolidayDesc = '';

  // Resolution Tester State
  public resolutionEmpId = '';
  public resolutionWorkDate = new Date().toISOString().slice(0, 10);

  constructor(private masterService: MasterService) {}

  public ngOnInit(): void {
    this.refreshAll();
  }

  public setTab(tab: MasterTab): void {
    this.activeTab.set(tab);
  }

  public refreshAll(): void {
    this.masterService.getDesignations().subscribe((res) => this.designations.set(res.data));
    this.masterService.getClients().subscribe((res) => this.clients.set(res.data));
    this.masterService.getProjects().subscribe((res) => this.projects.set(res.data));
    this.masterService.getEmployees().subscribe((res) => this.employees.set(res.data));
    this.masterService.getAssignments().subscribe((res) => this.assignments.set(res.data));
    this.masterService.getShifts().subscribe((res) => this.shifts.set(res.data));
    this.masterService.getPublicHolidays().subscribe((res) => this.holidays.set(res.data));
    this.masterService.getSalaryComponents().subscribe((res) => this.salaryComponents.set(res.data));
  }

  public createDesignation(): void {
    if (!this.newDesCode || !this.newDesTitle) return;
    this.masterService
      .createDesignation({
        code: this.newDesCode,
        title: this.newDesTitle,
        description: this.newDesDesc || null,
      })
      .subscribe(() => {
        this.showNewDesignation = false;
        this.newDesCode = '';
        this.newDesTitle = '';
        this.newDesDesc = '';
        this.refreshAll();
      });
  }

  public createEmployee(): void {
    if (!this.newEmpCode || !this.newEmpFirst || !this.newEmpLast) return;
    this.masterService
      .createEmployee({
        employeeCode: this.newEmpCode,
        firstName: this.newEmpFirst,
        lastName: this.newEmpLast,
        gender: this.newEmpGender as any,
        dateOfBirth: this.newEmpDob,
        nationality: this.newEmpNat,
        dateOfJoining: this.newEmpJoining,
      })
      .subscribe(() => {
        this.showNewEmployee = false;
        this.newEmpCode = '';
        this.newEmpFirst = '';
        this.newEmpLast = '';
        this.refreshAll();
      });
  }

  public createClient(): void {
    if (!this.newClientCode || !this.newClientName) return;
    this.masterService
      .createClient({
        code: this.newClientCode,
        name: this.newClientName,
        contactPerson: this.newClientContact || null,
      })
      .subscribe(() => {
        this.showNewClient = false;
        this.newClientCode = '';
        this.newClientName = '';
        this.refreshAll();
      });
  }

  public createProject(): void {
    if (!this.newProjClientId || !this.newProjCode || !this.newProjName) return;
    this.masterService
      .createProject({
        clientId: this.newProjClientId,
        code: this.newProjCode,
        name: this.newProjName,
        siteLocation: this.newProjLocation || null,
      })
      .subscribe(() => {
        this.showNewProject = false;
        this.newProjCode = '';
        this.newProjName = '';
        this.refreshAll();
      });
  }

  public onAssignClientChange(): void {
    const list = this.projects().filter((p) => p.clientId === this.newAssignClientId);
    this.filteredProjects.set(list);
  }

  public createAssignment(): void {
    if (!this.newAssignEmpId || !this.newAssignClientId || !this.newAssignProjId || !this.newAssignDesId) return;
    this.masterService
      .createAssignment({
        employeeId: this.newAssignEmpId,
        clientId: this.newAssignClientId,
        projectId: this.newAssignProjId,
        designationId: this.newAssignDesId,
        effectiveFrom: this.newAssignFrom,
      })
      .subscribe(() => {
        this.showNewAssignment = false;
        this.refreshAll();
      });
  }

  public createShift(): void {
    if (!this.newShiftCode || !this.newShiftName) return;
    this.masterService
      .createShift({
        code: this.newShiftCode,
        name: this.newShiftName,
        startTime: this.newShiftStart,
        endTime: this.newShiftEnd,
        breakMinutes: this.newShiftBreak,
        workHours: this.newShiftHours,
      })
      .subscribe(() => {
        this.showNewShift = false;
        this.refreshAll();
      });
  }

  public createHoliday(): void {
    if (!this.newHolidayName || !this.newHolidayDate) return;
    this.masterService
      .createPublicHoliday({
        calendarYear: Number(this.newHolidayYear),
        name: this.newHolidayName,
        holidayDate: this.newHolidayDate,
        description: this.newHolidayDesc || null,
      })
      .subscribe(() => {
        this.showNewHoliday = false;
        this.refreshAll();
      });
  }

  public resolveBilling(): void {
    if (!this.resolutionEmpId || !this.resolutionWorkDate) return;
    this.masterService
      .resolveBillingRate(this.resolutionEmpId, this.resolutionWorkDate)
      .subscribe((res) => {
        this.resolvedRate.set(res.data);
      });
  }
}
