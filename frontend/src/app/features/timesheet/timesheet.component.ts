import { Component, OnInit, computed, signal, Directive, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../core/layout/app-shell.component';
import { AttendanceApiService } from '../../core/services/attendance-api.service';
import { TimesheetApiService } from '../../core/services/timesheet-api.service';
import { MasterService } from '../../core/services/master.service';
import {
  AttendancePeriodDto, AttendanceGridResponseDto, EmployeeDto,
  ClientDto, ProjectDto,
  TimesheetSupervisorDto, TimesheetDesignationFilterDto,
} from '@blue-royal/contracts';

@Directive({
  selector: '[appAutofocusCell]',
  standalone: true,
})
export class AutofocusCellDirective implements AfterViewInit {
  constructor(private hostEl: ElementRef<HTMLInputElement>) {}

  public ngAfterViewInit(): void {
    setTimeout(() => {
      const el = this.hostEl.nativeElement;
      if (el) {
        el.focus();
        el.select();
      }
    }, 0);
  }
}

export interface TimesheetDayCell {
  recordId?: string;
  workDate?: string;
  dayType?: string;
  shiftHours?: number;
  actualHours: number;
  regularHours?: number;
  otHours?: number;
  isAbsent?: boolean;
  isOnLeave?: boolean;
}

export interface TimesheetEmployeeRow {
  id: string;
  name: string;
  code: string;
  designation?: string;
  shiftName?: string;
  shiftWorkHours?: number;
  totalHours: number;
  ot: number;
  dailyHours: Record<number, number>;
  dailyCells: Record<number, TimesheetDayCell>;
}

@Component({
  selector: 'app-timesheet',
  standalone: true,
  imports: [CommonModule, FormsModule, AppShellComponent, AutofocusCellDirective],
  template: `
    <app-shell>
      <div class="timesheet-page">
        <!-- Title and Subtitle -->
        <div class="title-bar">
          <h1 class="page-title">Timesheet</h1>
          <p class="subtitle">Monthly employee timesheet hours, overtime tracking, and export</p>
        </div>

        <!-- Header Actions: Month Navigation (Left) and Buttons (Right) on SAME HORIZONTAL ROW -->
        <header class="page-header">
          <div class="header-left">
            <button
              class="btn-nav"
              type="button"
              (click)="onPreviousMonth()"
              title="Previous Month"
              aria-label="Previous Month"
            >
              <span class="material-symbols-outlined">chevron_left</span>
            </button>

            <div class="month-pill" (click)="openMonthPicker(monthPickerInput)" title="Click to select Month and Year">
              <span class="material-symbols-outlined icon-calendar">calendar_month</span>
              <span class="month-label">{{ formattedSelectedMonth() }}</span>
              <input
                #monthPickerInput
                type="month"
                class="hidden-month-input"
                [ngModel]="selectedMonth()"
                (ngModelChange)="onMonthChange($event)"
                aria-label="Select Month and Year"
              />
            </div>

            <button
              class="btn-nav"
              type="button"
              (click)="onNextMonth()"
              title="Next Month"
              aria-label="Next Month"
            >
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div class="header-right">
            <input
              #fileInput
              type="file"
              accept=".xlsx,.xls"
              (change)="onImportAttendanceFile($event)"
              style="display: none;"
            />
            <button
              class="btn btn-outline"
              type="button"
              (click)="onFillStandard()"
              [disabled]="!selectedProjectId() || isFilling()"
              title="Fill 8 regular hours for applicable working days for currently displayed employees"
            >
              <span class="material-symbols-outlined icon-sm">auto_fix_high</span>
              <span>{{ isFilling() ? 'Filling...' : 'Fill 8h Standard' }}</span>
            </button>
            <button
              class="btn btn-outline"
              type="button"
              (click)="onAddWorker()"
              [disabled]="!selectedProjectId()"
              title="Assign an existing employee to the selected project"
            >
              <span class="material-symbols-outlined icon-sm">person_add</span>
              <span>Add Worker</span>
            </button>
            <button
              class="btn btn-secondary"
              type="button"
              (click)="fileInput.click()"
              [disabled]="isImporting()"
              title="Import Attendance Excel for the selected month"
            >
              <span class="material-symbols-outlined icon-sm">upload_file</span>
              <span>{{ isImporting() ? 'Importing...' : 'Bulk Upload' }}</span>
            </button>
            <button
              class="btn btn-primary"
              type="button"
              (click)="downloadAllEmployeesTimesheet()"
              [disabled]="employeeRows().length === 0"
              title="Download Excel Timesheet report for all employees"
            >
              <span class="material-symbols-outlined icon-sm">download_for_offline</span>
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        <!-- Filter Bar -->
        <section class="filter-bar">
          <div class="filter-group">
            <label class="filter-label">Client</label>
            <select class="filter-select" [ngModel]="selectedClientId()" (ngModelChange)="onClientChange($event)">
              <option value="">All Clients</option>
              @for (c of clients(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Project</label>
            <select class="filter-select" [ngModel]="selectedProjectId()" (ngModelChange)="onProjectChange($event)" [disabled]="!selectedClientId()">
              <option value="">All Projects</option>
              @for (p of filteredProjects(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Supervisor</label>
            <select class="filter-select" [ngModel]="selectedSupervisorId()" (ngModelChange)="onSupervisorChange($event)" [disabled]="!selectedProjectId()">
              <option value="">All</option>
              @for (s of supervisors(); track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Profession</label>
            <select class="filter-select" [ngModel]="selectedDesignationId()" (ngModelChange)="onDesignationChange($event)" [disabled]="!selectedProjectId()">
              <option value="">All Trades</option>
              @for (d of projectDesignations(); track d.id) {
                <option [value]="d.id">{{ d.title }}</option>
              }
            </select>
          </div>
        </section>

        <!-- Messages -->
        @if (errorMessage()) {
          <div class="alert alert-danger">{{ errorMessage() }}</div>
        }
        @if (successMessage()) {
          <div class="alert alert-success">{{ successMessage() }}</div>
        }

        <!-- Top KPIs -->
        <section class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Employees</span>
            <span class="kpi-value">{{ employeeRows().length }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total Hours</span>
            <span class="kpi-value">{{ totalHours() | number: '1.1-1' }}h</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">OT</span>
            <span class="kpi-value accent">{{ totalOt() | number: '1.1-1' }}h</span>
          </div>
        </section>

        <!-- Timesheet Panel -->
        <section class="panel">
          <div class="panel-header">
            <h3>Timesheet</h3>
            <div class="panel-meta">
              @if (currentPeriod()) {
                <span class="badge status-{{ currentPeriod()!.status }}">
                  Period: {{ currentPeriod()!.name }} ({{ currentPeriod()!.status | uppercase }})
                </span>
              } @else {
                <span class="badge badge-neutral">No official period locked for {{ formattedSelectedMonth() }}</span>
              }
            </div>
          </div>

          @if (isLoading()) {
            <div class="loading-state">Loading monthly timesheet grid...</div>
          } @else {
            <div #tableWrap class="table-wrap">
              <table class="data-table">
                <colgroup>
                  <col class="cg-emp" />
                  <col class="cg-total" />
                  <col class="cg-ot" />
                  @for (day of daysInMonth(); track day) {
                    <col class="cg-day" />
                  }
                  <col class="cg-download" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="col-sticky-emp">Employee</th>
                    <th class="col-sticky-total">Total Hours</th>
                    <th class="col-sticky-ot">OT</th>
                    @for (day of daysInMonth(); track day) {
                      <th class="col-day">{{ day }}</th>
                    }
                    <th class="col-download">Download</th>
                  </tr>
                </thead>
                <tbody>
                  @for (employee of employeeRows(); track employee.id) {
                    <tr [class.selected-row]="selectedEmployeeId() === employee.id" (click)="selectedEmployeeId.set(employee.id)">
                      <td class="col-sticky-emp">
                        <div class="employee-name" [title]="employee.name">{{ employee.name }}</div>
                        <div class="employee-code">{{ employee.code }}</div>
                        @if (employee.designation) {
                          <div class="employee-designation">{{ employee.designation }}</div>
                        }
                      </td>
                      <td class="col-sticky-total font-bold">{{ employee.totalHours }}h</td>
                      <td class="col-sticky-ot accent font-bold">{{ employee.ot }}h</td>
                      @for (day of daysInMonth(); track day) {
                        <td
                          class="col-day-cell"
                          [class.has-hours]="getCellActual(employee, day) > 0"
                          [class.is-editing]="isEditing(employee.id, day)"
                          [class.is-leave]="getCellLeave(employee, day)"
                          [class.is-off]="getCellOff(employee, day)"
                          (click)="startCellEdit(employee, day, $event)"
                          title="Click to edit day {{ day }} hours"
                        >
                          @if (isEditing(employee.id, day)) {
                            <input
                              appAutofocusCell
                              type="number"
                              class="cell-edit-input"
                              step="0.5"
                              min="0"
                              max="24"
                              [(ngModel)]="editValue"
                              (blur)="onCellBlur(employee, day)"
                              (keydown.enter)="onCellEnter($event, employee, day)"
                              (keydown.tab)="onCellEnter($event, employee, day)"
                              (keydown.escape)="cancelCellEdit($event)"
                              (click)="$event.stopPropagation()"
                              (mousedown)="$event.stopPropagation()"
                            />
                          } @else {
                            <div class="cell-display">
                              <span class="cell-regular" [class.cell-zero]="getCellActual(employee, day) === 0">
                                {{ getCellActual(employee, day) > 0 ? getCellActual(employee, day) + 'h' : '-' }}
                              </span>
                              @if (getCellOtHours(employee, day) > 0) {
                                <span class="cell-ot">OT {{ getCellOtHours(employee, day) }}h</span>
                              }
                            </div>
                          }
                        </td>
                      }
                      <td class="col-download">
                        <button
                          type="button"
                          class="btn-download-row"
                          (click)="downloadSingleEmployee(employee, $event)"
                          title="Download Excel timesheet for {{ employee.name }}"
                        >
                          <span class="material-symbols-outlined icon-xs">download</span>
                          <span>Download Excel</span>
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td [attr.colspan]="daysInMonth().length + 4" class="empty-cell">
                        No employees found for this timesheet period.
                      </td>
                    </tr>
                  }
                </tbody>
                <!-- Daily Totals Footer -->
                @if (employeeRows().length > 0) {
                  <tfoot>
                    <tr class="daily-totals-row">
                      <td class="col-sticky-emp totals-label">DAILY TOTALS</td>
                      <td class="col-sticky-total font-bold">{{ totalHours() | number: '1.1-1' }}h</td>
                      <td class="col-sticky-ot accent font-bold">{{ totalOt() | number: '1.1-1' }}h</td>
                      @for (day of daysInMonth(); track day) {
                        <td class="col-day-cell totals-cell">{{ dailyTotal(day) | number: '1.0-1' }}h</td>
                      }
                      <td class="col-download"></td>
                    </tr>
                  </tfoot>
                }
              </table>
            </div>
          }
        </section>

        <!-- Add Worker Modal -->
        @if (showAddWorkerModal()) {
          <div class="modal-overlay" (click)="closeAddWorkerModal()">
            <div class="modal-dialog" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h3>Add Worker to Project</h3>
                <button type="button" class="modal-close" (click)="closeAddWorkerModal()">&times;</button>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label>Employee</label>
                  <select [(ngModel)]="addWorkerEmployeeId" class="form-select">
                    <option value="">Select Employee</option>
                    @for (e of availableEmployees(); track e.id) {
                      <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label>Designation / Profession</label>
                  <select [(ngModel)]="addWorkerDesignationId" class="form-select">
                    <option value="">Select Designation</option>
                    @for (d of allDesignations(); track d.id) {
                      <option [value]="d.id">{{ d.title }}</option>
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label>Effective From</label>
                  <input type="date" [(ngModel)]="addWorkerEffectiveFrom" class="form-input" />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" type="button" (click)="closeAddWorkerModal()">Cancel</button>
                <button
                  class="btn btn-primary"
                  type="button"
                  (click)="submitAddWorker()"
                  [disabled]="!addWorkerEmployeeId || !addWorkerDesignationId || !addWorkerEffectiveFrom || isAssigning()"
                >
                  {{ isAssigning() ? 'Assigning...' : 'Assign Worker' }}
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </app-shell>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }
      .timesheet-page {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }
      .title-bar {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .page-title {
        margin: 0;
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--text-primary, #1e293b);
      }
      .subtitle {
        margin: 0;
        color: var(--text-secondary, #64748b);
        font-size: 0.8125rem;
      }
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .header-left {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
      }
      .header-right {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
        flex-wrap: wrap;
      }
      .btn-nav {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        background: #ffffff;
        color: #334155;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        padding: 0;
      }
      .btn-nav:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
        color: #0f172a;
      }
      .btn-nav:active {
        transform: scale(0.96);
      }
      .month-pill {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        height: 38px;
        padding: 0 1rem;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
      }
      .month-pill:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }
      .icon-calendar {
        color: #475569;
        font-size: 1.2rem;
      }
      .month-label {
        font-size: 0.9375rem;
        font-weight: 600;
        color: #1e293b;
        white-space: nowrap;
      }
      .hidden-month-input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }

      /* Filter Bar */
      .filter-bar {
        display: flex;
        align-items: flex-end;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.75rem 1rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }
      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 160px;
        flex: 1;
        max-width: 260px;
      }
      .filter-label {
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
        color: #64748b;
      }
      .filter-select {
        height: 36px;
        padding: 0 0.5rem;
        font-size: 0.8125rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
        background: #ffffff;
        color: #1e293b;
        cursor: pointer;
      }
      .filter-select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
      }
      .kpi-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }
      .kpi-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
        color: #64748b;
      }
      .kpi-value {
        font-size: 1.625rem;
        font-weight: 700;
        color: #1e293b;
      }
      .accent { color: #d97706; }
      .font-bold { font-weight: 600; }
      .panel {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #edf2f7;
        background: #f8fafc;
      }
      .panel-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: #1e293b;
      }
      .table-wrap {
        overflow-x: auto;
        overflow-y: auto;
        max-height: 65vh;
        width: 100%;
        max-width: 100%;
        position: relative;
        border-top: 1px solid #edf2f7;
        margin: 0;
        padding: 0;
      }
      .data-table {
        width: 100%;
        min-width: max-content;
        border-collapse: separate;
        border-spacing: 0;
        margin: 0;
        font-size: 0.8125rem;
        table-layout: fixed;
      }
      col.cg-emp { width: 220px; min-width: 220px; max-width: 220px; }
      col.cg-total { width: 100px; min-width: 100px; max-width: 100px; }
      col.cg-ot { width: 80px; min-width: 80px; max-width: 80px; }
      col.cg-day { width: 56px; min-width: 56px; max-width: 56px; }
      col.cg-download { width: 140px; min-width: 140px; max-width: 140px; }

      .data-table th,
      .data-table td {
        padding: 0.65rem 0.5rem;
        border-bottom: 1px solid #edf2f7;
        white-space: nowrap;
      }
      .data-table th {
        background: #f8fafc;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #475569;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 1px solid #e2e8f0;
      }

      /* Sticky Column 1: Employee */
      .col-sticky-emp {
        position: sticky !important;
        left: 0px !important;
        width: 220px !important;
        min-width: 220px !important;
        max-width: 220px !important;
        background-color: #ffffff;
        z-index: 22;
        box-sizing: border-box;
        text-align: left;
        padding-left: 1rem !important;
        padding-right: 0.75rem !important;
      }

      /* Sticky Column 2: Total Hours */
      .col-sticky-total {
        position: sticky !important;
        left: 220px !important;
        width: 100px !important;
        min-width: 100px !important;
        max-width: 100px !important;
        background-color: #ffffff;
        z-index: 21;
        box-sizing: border-box;
        text-align: center !important;
      }

      /* Sticky Column 3: OT */
      .col-sticky-ot {
        position: sticky !important;
        left: 320px !important;
        width: 80px !important;
        min-width: 80px !important;
        max-width: 80px !important;
        background-color: #ffffff;
        z-index: 20;
        box-sizing: border-box;
        text-align: center !important;
        border-right: 2px solid #cbd5e1 !important;
        box-shadow: 4px 0 6px -2px rgba(0, 0, 0, 0.12);
      }

      /* Top Intersection: Headers must be sticky to top and left with z-index 35 */
      th.col-sticky-emp {
        top: 0 !important;
        left: 0px !important;
        z-index: 35 !important;
        background-color: #f8fafc !important;
      }
      th.col-sticky-total {
        top: 0 !important;
        left: 220px !important;
        z-index: 34 !important;
        background-color: #f8fafc !important;
      }
      th.col-sticky-ot {
        top: 0 !important;
        left: 320px !important;
        z-index: 33 !important;
        background-color: #f8fafc !important;
        border-right: 2px solid #cbd5e1 !important;
        box-shadow: 4px 0 6px -2px rgba(0, 0, 0, 0.12);
      }

      /* Sticky row background handling */
      tr:hover td.col-sticky-emp,
      tr:hover td.col-sticky-total,
      tr:hover td.col-sticky-ot {
        background-color: #f8fafc;
      }
      .selected-row td.col-sticky-emp,
      .selected-row td.col-sticky-total,
      .selected-row td.col-sticky-ot {
        background-color: #f0fdf4 !important;
      }

      .employee-name {
        font-weight: 600;
        color: #0f172a;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 190px;
      }
      .employee-code {
        font-size: 0.72rem;
        color: #64748b;
        font-family: monospace;
      }
      .employee-designation {
        font-size: 0.67rem;
        color: #94a3b8;
        font-style: italic;
      }
      .col-day {
        text-align: center;
        width: 56px;
        min-width: 56px;
        max-width: 56px;
        box-sizing: border-box;
        padding: 0.65rem 0.25rem !important;
      }
      .col-day-cell {
        text-align: center;
        width: 56px;
        min-width: 56px;
        max-width: 56px;
        box-sizing: border-box;
        padding: 0.2rem 0.15rem !important;
        cursor: pointer;
        user-select: none;
        transition: background-color 0.15s ease;
      }
      .col-day-cell:hover {
        background-color: #e0f2fe;
      }
      .col-day-cell.is-editing {
        background-color: #dbeafe !important;
        padding: 0.15rem !important;
      }
      .col-day-cell.is-leave {
        background-color: #fef3c7;
      }
      .col-day-cell.is-off {
        background-color: #f1f5f9;
      }

      /* Cell display with regular + OT */
      .cell-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        line-height: 1.2;
      }
      .cell-regular {
        font-size: 0.8125rem;
        font-weight: 500;
        color: #0f172a;
      }
      .cell-regular.cell-zero {
        color: #94a3b8;
        font-weight: 400;
      }
      .cell-ot {
        font-size: 0.6rem;
        color: #d97706;
        font-weight: 600;
        white-space: nowrap;
      }

      .cell-edit-input {
        width: 100%;
        max-width: 48px;
        height: 28px;
        padding: 0.1rem 0.2rem;
        font-size: 0.8125rem;
        font-weight: 700;
        text-align: center;
        border: 2px solid #2563eb;
        border-radius: 4px;
        background-color: #ffffff;
        color: #0f172a;
        outline: none;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
        margin: 0 auto;
        display: block;
        box-sizing: border-box;
        user-select: text !important;
        pointer-events: auto !important;
      }
      .cell-edit-input::-webkit-outer-spin-button,
      .cell-edit-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .cell-edit-input[type='number'] {
        -moz-appearance: textfield;
      }

      .col-download {
        text-align: center;
        width: 140px;
        min-width: 140px;
        max-width: 140px;
        box-sizing: border-box;
        padding: 0.35rem 0.5rem !important;
      }
      .btn-download-row {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.55rem;
        font-size: 0.72rem;
        font-weight: 600;
        border-radius: 0.375rem;
        border: 1px solid #cbd5e1;
        background-color: #f8fafc;
        color: #334155;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .btn-download-row:hover {
        background-color: #e2e8f0;
        color: #0f172a;
        border-color: #94a3b8;
      }
      .icon-xs {
        font-size: 14px;
      }

      .selected-row {
        background-color: #f0fdf4;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border: 1px solid #cbd5e1;
        background: #fff;
        border-radius: 0.5rem;
        padding: 0.5rem 0.85rem;
        font-size: 0.78rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      .btn:hover:not(:disabled) {
        background: #f1f5f9;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-primary {
        background: #2563eb;
        color: #fff;
        border-color: #2563eb;
      }
      .btn-primary:hover:not(:disabled) {
        background: #1d4ed8;
      }
      .btn-secondary {
        background: #ffffff;
        color: #334155;
      }
      .btn-outline {
        background: #ffffff;
        color: #475569;
        border: 1px solid #94a3b8;
      }
      .btn-outline:hover:not(:disabled) {
        background: #f8fafc;
        border-color: #64748b;
      }
      .icon-sm {
        font-size: 16px;
      }
      .loading-state,
      .empty-cell {
        text-align: center;
        padding: 2.5rem 1rem;
        color: #64748b;
        font-style: italic;
      }
      .badge {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
      }
      .status-draft { background: #e0f2fe; color: #0369a1; }
      .status-submitted { background: #fef3c7; color: #b45309; }
      .status-approved { background: #dcfce7; color: #15803d; }
      .status-locked { background: #f1f5f9; color: #475569; }
      .badge-neutral { background: #f1f5f9; color: #64748b; }
      .alert {
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.8125rem;
      }
      .alert-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
      .alert-success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }

      /* Daily Totals Footer */
      .daily-totals-row {
        background-color: #f1f5f9;
        font-weight: 700;
      }
      .daily-totals-row td {
        border-top: 2px solid #cbd5e1;
        border-bottom: none;
        position: sticky;
        bottom: 0;
        background-color: #f1f5f9;
        z-index: 15;
      }
      .daily-totals-row td.col-sticky-emp {
        left: 0px !important;
        z-index: 35 !important;
        background-color: #f1f5f9 !important;
      }
      .daily-totals-row td.col-sticky-total {
        left: 220px !important;
        z-index: 35 !important;
        background-color: #f1f5f9 !important;
      }
      .daily-totals-row td.col-sticky-ot {
        left: 320px !important;
        z-index: 35 !important;
        background-color: #f1f5f9 !important;
        border-right: 2px solid #cbd5e1 !important;
        box-shadow: 4px 0 6px -2px rgba(0, 0, 0, 0.12);
      }
      .totals-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #475569;
      }
      .totals-cell {
        font-size: 0.75rem;
        color: #334155;
      }

      /* Modal */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-dialog {
        background: #fff;
        border-radius: 0.75rem;
        width: 480px;
        max-width: 90vw;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #e2e8f0;
      }
      .modal-header h3 { margin: 0; font-size: 1rem; font-weight: 700; }
      .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #64748b;
        cursor: pointer;
        padding: 0 0.25rem;
      }
      .modal-body {
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        border-top: 1px solid #e2e8f0;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .form-group label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .form-select, .form-input {
        height: 38px;
        padding: 0 0.75rem;
        font-size: 0.875rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
        background: #fff;
        color: #1e293b;
      }
    `,
  ],
})
export class TimesheetComponent implements OnInit, AfterViewInit {
  @ViewChild('tableWrap') public tableWrapRef?: ElementRef<HTMLDivElement>;

  public readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  public readonly availableYears = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 4 + i);

  public selectedYear = signal<number>(new Date().getFullYear());
  public selectedMonthIndex = signal<number>(new Date().getMonth());
  public selectedMonth = signal<string>(this.defaultMonth());
  public periods = signal<AttendancePeriodDto[]>([]);
  public currentPeriod = signal<AttendancePeriodDto | null>(null);
  public employeeRows = signal<TimesheetEmployeeRow[]>([]);
  public selectedEmployeeId = signal<string>('');

  // Filters
  public clients = signal<ClientDto[]>([]);
  public projects = signal<ProjectDto[]>([]);
  public supervisors = signal<TimesheetSupervisorDto[]>([]);
  public projectDesignations = signal<TimesheetDesignationFilterDto[]>([]);
  public selectedClientId = signal<string>('');
  public selectedProjectId = signal<string>('');
  public selectedSupervisorId = signal<string>('');
  public selectedDesignationId = signal<string>('');

  // Add Worker
  public showAddWorkerModal = signal<boolean>(false);
  public availableEmployees = signal<EmployeeDto[]>([]);
  public allDesignations = signal<{ id: string; title: string }[]>([]);
  public addWorkerEmployeeId = '';
  public addWorkerDesignationId = '';
  public addWorkerEffectiveFrom = '';
  public isAssigning = signal<boolean>(false);

  public isLoading = signal<boolean>(false);
  public isImporting = signal<boolean>(false);
  public isFilling = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  // In-place Cell Editing
  public editingCell = signal<{ employeeId: string; day: number } | null>(null);
  public editValue = '';
  private editOpenTimestamp = 0;

  public formattedSelectedMonth = computed(() => {
    return `${this.monthNames[this.selectedMonthIndex()]}, ${this.selectedYear()}`;
  });

  public filteredProjects = computed(() => {
    const cid = this.selectedClientId();
    if (!cid) return this.projects();
    return this.projects().filter(p => p.clientId === cid);
  });

  public totalHours = computed(() =>
    this.employeeRows().reduce((sum, e) => sum + Number(e.totalHours || 0), 0),
  );

  public totalOt = computed(() =>
    this.employeeRows().reduce((sum, e) => sum + Number(e.ot || 0), 0),
  );

  public daysInMonth = computed(() => {
    const value = this.selectedMonth();
    if (!value) return Array.from({ length: 30 }, (_, index) => index + 1);
    const [year, month] = value.split('-').map(Number);
    const date = new Date(year, month, 0);
    return Array.from({ length: date.getDate() }, (_, index) => index + 1);
  });

  constructor(
    private attendanceApi: AttendanceApiService,
    private timesheetApi: TimesheetApiService,
    private masterService: MasterService,
  ) {}

  public ngOnInit(): void {
    const initial = this.selectedMonth();
    const [y, m] = initial.split('-').map(Number);
    if (y && m) {
      this.selectedYear.set(y);
      this.selectedMonthIndex.set(m - 1);
    }
    this.loadClients();
    this.loadTimesheetData();
  }

  public ngAfterViewInit(): void {
    this.resetTableScroll();
  }

  // ---------- Filter Handlers ----------

  private loadClients(): void {
    this.masterService.getClients().subscribe({
      next: (res) => this.clients.set(res.data || []),
      error: () => this.clients.set([]),
    });
  }

  public onClientChange(clientId: string): void {
    this.selectedClientId.set(clientId);
    this.selectedProjectId.set('');
    this.selectedSupervisorId.set('');
    this.selectedDesignationId.set('');
    this.supervisors.set([]);
    this.projectDesignations.set([]);

    if (clientId) {
      this.masterService.getProjects(clientId).subscribe({
        next: (res) => this.projects.set(res.data || []),
        error: () => this.projects.set([]),
      });
    } else {
      this.projects.set([]);
    }
    this.loadTimesheetData();
  }

  public onProjectChange(projectId: string): void {
    this.selectedProjectId.set(projectId);
    this.selectedSupervisorId.set('');
    this.selectedDesignationId.set('');

    if (projectId) {
      this.timesheetApi.getProjectSupervisors(projectId).subscribe({
        next: (res) => this.supervisors.set(res.data || []),
        error: () => this.supervisors.set([]),
      });
      this.timesheetApi.getProjectDesignations(projectId).subscribe({
        next: (res) => this.projectDesignations.set(res.data || []),
        error: () => this.projectDesignations.set([]),
      });
    } else {
      this.supervisors.set([]);
      this.projectDesignations.set([]);
    }
    this.loadTimesheetData();
  }

  public onSupervisorChange(supervisorId: string): void {
    this.selectedSupervisorId.set(supervisorId);
    // Supervisor is project-level; changing it confirms context but does not further filter employees
    // unless backend supports per-employee supervisor (it does not currently)
  }

  public onDesignationChange(designationId: string): void {
    this.selectedDesignationId.set(designationId);
    this.loadTimesheetData();
  }

  // ---------- Month Navigation ----------

  public onPreviousMonth(): void {
    let yr = this.selectedYear();
    let mIdx = this.selectedMonthIndex() - 1;
    if (mIdx < 0) {
      mIdx = 11;
      yr -= 1;
    }
    const mStr = String(mIdx + 1).padStart(2, '0');
    this.onMonthChange(`${yr}-${mStr}`);
  }

  public onNextMonth(): void {
    let yr = this.selectedYear();
    let mIdx = this.selectedMonthIndex() + 1;
    if (mIdx > 11) {
      mIdx = 0;
      yr += 1;
    }
    const mStr = String(mIdx + 1).padStart(2, '0');
    this.onMonthChange(`${yr}-${mStr}`);
  }

  public openMonthPicker(inputEl: HTMLInputElement): void {
    try {
      if (typeof inputEl.showPicker === 'function') {
        inputEl.showPicker();
      }
    } catch {
      // Handled natively by browser input click
    }
  }

  public onMonthIndexChange(index: number | string): void {
    const idx = Number(index);
    this.selectedMonthIndex.set(idx);
    const y = this.selectedYear();
    const m = String(idx + 1).padStart(2, '0');
    this.onMonthChange(`${y}-${m}`);
  }

  public onYearChange(year: number | string): void {
    const yr = Number(year);
    this.selectedYear.set(yr);
    const m = String(this.selectedMonthIndex() + 1).padStart(2, '0');
    this.onMonthChange(`${yr}-${m}`);
  }

  public onMonthChange(month: string): void {
    if (!month) return;
    this.cancelCellEdit();
    this.selectedMonth.set(month);
    const [y, m] = month.split('-').map(Number);
    if (y && m) {
      this.selectedYear.set(y);
      this.selectedMonthIndex.set(m - 1);
    }
    this.loadTimesheetData();
  }

  // ---------- Data Loading ----------

  public loadTimesheetData(): void {
    const month = this.selectedMonth();
    this.cancelCellEdit();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.attendanceApi.listPeriods().subscribe({
      next: (res) => {
        this.periods.set(res.data);
        const matchingPeriod = res.data.find(
          (p) => p.periodCode === month || (p.startDate && p.startDate.startsWith(month)),
        );
        this.currentPeriod.set(matchingPeriod || null);

        if (matchingPeriod) {
          const filters: any = {};
          if (this.selectedClientId()) filters.clientId = this.selectedClientId();
          if (this.selectedProjectId()) filters.projectId = this.selectedProjectId();
          if (this.selectedDesignationId()) filters.designationId = this.selectedDesignationId();

          this.attendanceApi.getGrid(matchingPeriod.id, filters).subscribe({
            next: (gridRes) => {
              this.populateFromGrid(gridRes.data);
              this.isLoading.set(false);
              this.resetTableScroll();
            },
            error: () => {
              this.loadFallbackEmployees();
            },
          });
        } else {
          this.loadFallbackEmployees();
        }
      },
      error: () => {
        this.loadFallbackEmployees();
      },
    });
  }

  private resetTableScroll(): void {
    setTimeout(() => {
      if (this.tableWrapRef?.nativeElement) {
        this.tableWrapRef.nativeElement.scrollLeft = 0;
      }
    }, 0);
  }

  private populateFromGrid(grid: AttendanceGridResponseDto): void {
    const desigFilter = this.selectedDesignationId();

    const mapped: TimesheetEmployeeRow[] = (grid.rows || []).map((row) => {
      const dailyHours: Record<number, number> = {};
      const dailyCells: Record<number, TimesheetDayCell> = {};

      if (row.days) {
        Object.entries(row.days).forEach(([dayStr, cell]) => {
          const dayNum = Number(dayStr);
          if (!isNaN(dayNum)) {
            const actual = Number(cell.actualHours || 0);
            dailyHours[dayNum] = actual;
            dailyCells[dayNum] = {
              recordId: cell.id,
              workDate: cell.workDate,
              dayType: cell.dayType,
              shiftHours: cell.shiftHours ? Number(cell.shiftHours) : undefined,
              actualHours: actual,
              regularHours: Number(cell.regularHours || 0),
              otHours: Number(cell.otHours || 0),
              isAbsent: cell.isAbsent,
              isOnLeave: cell.isOnLeave,
            };
          }
        });
      } else if (row.records) {
        Object.entries(row.records).forEach(([dateStr, rec]: [string, any]) => {
          const dayNum = parseInt(dateStr.slice(8, 10), 10);
          if (!isNaN(dayNum)) {
            const actual = Number(rec?.actualHours || 0);
            dailyHours[dayNum] = actual;
            dailyCells[dayNum] = {
              recordId: rec?.id,
              workDate: rec?.workDate || dateStr,
              dayType: rec?.dayType,
              shiftHours: rec?.shift?.workHours ? Number(rec.shift.workHours) : (row.shiftWorkHours ? Number(row.shiftWorkHours) : undefined),
              actualHours: actual,
              regularHours: Number(rec?.regularHours || 0),
              otHours: Number(rec?.otHours || 0),
              isAbsent: rec?.isAbsent,
              isOnLeave: rec?.isOnLeave,
            };
          }
        });
      }

      return {
        id: row.employeeId,
        name: row.employeeName,
        code: row.employeeCode,
        designation: row.designationTitle || '',
        shiftName: row.shiftName || undefined,
        shiftWorkHours: row.shiftWorkHours ? Number(row.shiftWorkHours) : undefined,
        totalHours: Number(row.summary?.totalActualHours ?? row.totalActualHours ?? 0),
        ot: Number(row.summary?.totalOtHours ?? row.totalOtHours ?? 0),
        dailyHours,
        dailyCells,
      };
    });

    // Apply designation filter client-side (backend grid filters by client/project already)
    let filtered = mapped;
    if (desigFilter) {
      // Filter by checking if the employee's attendance records have the matching designation
      // The designation filter is based on the project assignment, not attendance records
      // We use the designation title as a match since the grid returns designationTitle
      const selectedDesig = this.projectDesignations().find(d => d.id === desigFilter);
      if (selectedDesig) {
        filtered = mapped.filter(e => e.designation === selectedDesig.title);
      }
    }

    this.employeeRows.set(filtered);
    if (filtered.length > 0 && !this.selectedEmployeeId()) {
      this.selectedEmployeeId.set(filtered[0].id);
    }
  }

  private loadFallbackEmployees(): void {
    // If a project is selected, load from timesheet API; otherwise load all employees
    const projectId = this.selectedProjectId();
    const desigId = this.selectedDesignationId();

    if (projectId) {
      this.timesheetApi.getProjectEmployees(projectId, desigId || undefined).subscribe({
        next: (res) => {
          const rows: TimesheetEmployeeRow[] = (res.data || []).map((emp) => ({
            id: emp.employeeId,
            name: emp.employeeName,
            code: emp.employeeCode,
            designation: emp.designationTitle || '',
            totalHours: 0,
            ot: 0,
            dailyHours: {},
            dailyCells: {},
          }));
          this.employeeRows.set(rows);
          if (rows.length > 0 && !this.selectedEmployeeId()) {
            this.selectedEmployeeId.set(rows[0].id);
          }
          this.isLoading.set(false);
          this.resetTableScroll();
        },
        error: () => {
          this.employeeRows.set([]);
          this.isLoading.set(false);
          this.resetTableScroll();
        },
      });
    } else {
      this.masterService.getEmployees().subscribe({
        next: (empRes) => {
          const rows: TimesheetEmployeeRow[] = (empRes.data || []).map((emp: EmployeeDto) => ({
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`.trim(),
            code: emp.employeeCode,
            designation: '',
            totalHours: 0,
            ot: 0,
            dailyHours: {},
            dailyCells: {},
          }));
          this.employeeRows.set(rows);
          if (rows.length > 0 && !this.selectedEmployeeId()) {
            this.selectedEmployeeId.set(rows[0].id);
          }
          this.isLoading.set(false);
          this.resetTableScroll();
        },
        error: () => {
          this.employeeRows.set([]);
          this.isLoading.set(false);
          this.resetTableScroll();
        },
      });
    }
  }

  // ---------- Cell Value Accessors ----------

  public getCellActual(employee: TimesheetEmployeeRow, day: number): number {
    return employee.dailyHours?.[day] ?? 0;
  }

  public getCellOtHours(employee: TimesheetEmployeeRow, day: number): number {
    return employee.dailyCells?.[day]?.otHours ?? 0;
  }

  public getCellLeave(employee: TimesheetEmployeeRow, day: number): boolean {
    return employee.dailyCells?.[day]?.isOnLeave ?? false;
  }

  public getCellOff(employee: TimesheetEmployeeRow, day: number): boolean {
    const dt = employee.dailyCells?.[day]?.dayType;
    return dt === 'weekly_off' || dt === 'public_holiday';
  }

  public dailyTotal(day: number): number {
    return this.employeeRows().reduce((sum, e) => sum + (e.dailyHours?.[day] ?? 0), 0);
  }

  // ---------- Cell Editing ----------

  public isEditing(employeeId: string, day: number): boolean {
    const c = this.editingCell();
    return c?.employeeId === employeeId && c?.day === day;
  }

  public startCellEdit(employee: TimesheetEmployeeRow, day: number, event?: MouseEvent): void {
    event?.stopPropagation();
    const current = this.editingCell();
    if (current?.employeeId === employee.id && current?.day === day) {
      return;
    }
    this.selectedEmployeeId.set(employee.id);
    const currentVal = this.getCellActual(employee, day);
    this.editValue = currentVal > 0 ? String(currentVal) : '0';
    this.editOpenTimestamp = Date.now();
    this.editingCell.set({ employeeId: employee.id, day });
  }

  public onCellEnter(event: Event, employee: TimesheetEmployeeRow, day: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.commitCellEdit(employee, day);
  }

  public cancelCellEdit(event?: Event): void {
    event?.stopPropagation();
    this.editingCell.set(null);
    this.editValue = '';
  }

  public onCellBlur(employee: TimesheetEmployeeRow, day: number): void {
    this.commitCellEdit(employee, day);
  }

  public commitCellEdit(employee: TimesheetEmployeeRow, day: number): void {
    const current = this.editingCell();
    if (!current || current.employeeId !== employee.id || current.day !== day) {
      return;
    }

    const normalized = String(this.editValue ?? '').trim();
    const parsed = normalized === '' ? 0 : parseFloat(normalized);

    if (isNaN(parsed) || parsed < 0 || parsed > 24) {
      this.errorMessage.set('Hours must be a valid number between 0 and 24.');
      setTimeout(() => this.errorMessage.set(null), 4000);
      this.cancelCellEdit();
      return;
    }

    const currentVal = this.getCellActual(employee, day);
    this.cancelCellEdit();

    if (parsed === currentVal) {
      return;
    }

    // Immediately close edit mode and optimistically update display
    employee.dailyHours[day] = parsed;
    this.recalculateEmployeeHours(employee);

    // Save to server
    this.saveCellToApi(employee, day, parsed, currentVal);
  }

  public recalculateEmployeeHours(employee: TimesheetEmployeeRow): void {
    const days = this.daysInMonth();
    let sumHours = 0;
    let sumOt = 0;
    const defaultShift = employee.shiftWorkHours && employee.shiftWorkHours > 0 ? employee.shiftWorkHours : 8;

    for (const d of days) {
      const cell = employee.dailyCells[d];
      const hrs = employee.dailyHours[d] ?? 0;
      sumHours += hrs;

      const dayType = cell?.dayType || (this.isWeeklyOff(d) ? 'weekly_off' : 'regular_workday');
      const shiftHours = cell?.shiftHours ?? defaultShift;
      const isOnLeave = cell?.isOnLeave ?? false;

      let dayOt = 0;
      if (isOnLeave) {
        // No OT on approved leave
      } else if (dayType === 'public_holiday' || dayType === 'weekly_off') {
        // Any hours worked on holiday / weekly off are 100% overtime
        dayOt = hrs;
      } else {
        // Regular workday: OT only above shift hours
        if (shiftHours > 0 && hrs > shiftHours) {
          dayOt = (hrs - shiftHours);
        }
      }
      sumOt += dayOt;

      // Update cell-level OT for display
      if (cell) {
        cell.otHours = Math.round(dayOt * 10) / 10;
        if (isOnLeave) {
          cell.regularHours = 0;
        } else if (dayType === 'public_holiday' || dayType === 'weekly_off') {
          cell.regularHours = 0;
        } else {
          cell.regularHours = Math.min(hrs, shiftHours);
        }
      }
    }

    employee.totalHours = Math.round(sumHours * 10) / 10;
    employee.ot = Math.round(sumOt * 10) / 10;
    this.employeeRows.set([...this.employeeRows()]);
  }

  private isWeeklyOff(day: number): boolean {
    const month = this.selectedMonth();
    const d = new Date(`${month}-${String(day).padStart(2, '0')}T00:00:00Z`);
    return d.getUTCDay() === 0; // Sunday
  }

  private saveCellToApi(employee: TimesheetEmployeeRow, day: number, newHours: number, oldHours: number): void {
    const period = this.currentPeriod();
    const cell = employee.dailyCells[day];
    const month = this.selectedMonth();
    const dateStr = cell?.workDate || `${month}-${String(day).padStart(2, '0')}`;

    if (!period) {
      this.successMessage.set(`Updated hours for ${employee.name} (Day ${day}: ${newHours}h)`);
      setTimeout(() => this.successMessage.set(null), 3000);
      return;
    }

    const recordId = cell?.recordId;
    if (!recordId) {
      this.errorMessage.set(`No attendance record found for ${employee.name} on ${dateStr}. Please import attendance first.`);
      employee.dailyHours[day] = oldHours;
      this.recalculateEmployeeHours(employee);
      setTimeout(() => this.errorMessage.set(null), 5000);
      return;
    }

    this.attendanceApi
      .batchUpdateRecords(period.id, {
        batchReason: 'Timesheet daily hours adjusted',
        records: [
          {
            recordId,
            employeeId: employee.id,
            workDate: dateStr,
            actualHours: newHours,
            changeReason: `Timesheet cell edit: ${oldHours}h -> ${newHours}h`,
          },
        ],
      })
      .subscribe({
        next: () => {
          this.successMessage.set(`Saved: ${employee.name} Day ${day} = ${newHours}h`);
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          // Rollback on API error
          employee.dailyHours[day] = oldHours;
          this.recalculateEmployeeHours(employee);
          this.errorMessage.set(err?.error?.error?.message || 'Failed to save timesheet change to server.');
          setTimeout(() => this.errorMessage.set(null), 5000);
        },
      });
  }

  // ---------- Fill 8h Standard ----------

  public onFillStandard(): void {
    const period = this.currentPeriod();
    const projectId = this.selectedProjectId();

    if (!period) {
      this.errorMessage.set(`No attendance period found for ${this.formattedSelectedMonth()}. Please create the period in Attendance first.`);
      setTimeout(() => this.errorMessage.set(null), 5000);
      return;
    }

    if (!projectId) {
      this.errorMessage.set('Please select a project before using Fill 8h Standard.');
      setTimeout(() => this.errorMessage.set(null), 4000);
      return;
    }

    this.isFilling.set(true);
    this.errorMessage.set(null);

    this.timesheetApi.fillStandardHours({
      periodId: period.id,
      projectId,
      designationId: this.selectedDesignationId() || undefined,
    }).subscribe({
      next: (res) => {
        this.isFilling.set(false);
        const data = res.data;
        this.successMessage.set(
          `Fill 8h Standard complete: ${data.updatedRecords} records updated, ${data.createdRecords} created. ` +
          `Skipped: ${data.skippedLeave} leave, ${data.skippedHoliday} holiday, ${data.skippedWeeklyOff} weekly off.`
        );
        setTimeout(() => this.successMessage.set(null), 6000);
        this.loadTimesheetData();
      },
      error: (err) => {
        this.isFilling.set(false);
        this.errorMessage.set(err?.error?.error?.message || err?.error?.message || 'Failed to fill standard hours.');
        setTimeout(() => this.errorMessage.set(null), 5000);
      },
    });
  }

  // ---------- Add Worker ----------

  public onAddWorker(): void {
    if (!this.selectedProjectId()) return;

    // Load available employees and designations
    this.masterService.getEmployees().subscribe({
      next: (res) => this.availableEmployees.set(res.data || []),
      error: () => this.availableEmployees.set([]),
    });
    this.masterService.getDesignations().subscribe({
      next: (res) => this.allDesignations.set((res.data || []).map((d: any) => ({ id: d.id, title: d.title }))),
      error: () => this.allDesignations.set([]),
    });

    // Default effective from to period start or today
    const period = this.currentPeriod();
    this.addWorkerEffectiveFrom = period?.startDate || new Date().toISOString().slice(0, 10);
    this.addWorkerEmployeeId = '';
    this.addWorkerDesignationId = '';
    this.showAddWorkerModal.set(true);
  }

  public closeAddWorkerModal(): void {
    this.showAddWorkerModal.set(false);
  }

  public submitAddWorker(): void {
    const projectId = this.selectedProjectId();
    if (!projectId || !this.addWorkerEmployeeId || !this.addWorkerDesignationId || !this.addWorkerEffectiveFrom) return;

    this.isAssigning.set(true);

    this.timesheetApi.assignWorker(projectId, {
      employeeId: this.addWorkerEmployeeId,
      designationId: this.addWorkerDesignationId,
      effectiveFrom: this.addWorkerEffectiveFrom,
    }).subscribe({
      next: () => {
        this.isAssigning.set(false);
        this.showAddWorkerModal.set(false);
        this.successMessage.set('Worker assigned to project successfully. Reloading timesheet...');
        setTimeout(() => this.successMessage.set(null), 4000);
        // Reload designations for the project
        this.timesheetApi.getProjectDesignations(projectId).subscribe({
          next: (res) => this.projectDesignations.set(res.data || []),
        });
        this.loadTimesheetData();
      },
      error: (err) => {
        this.isAssigning.set(false);
        this.errorMessage.set(err?.error?.error?.message || err?.error?.message || 'Failed to assign worker.');
        setTimeout(() => this.errorMessage.set(null), 5000);
      },
    });
  }

  // ---------- Import Attendance ----------

  public onImportAttendanceFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    const month = this.selectedMonth();
    let period = this.currentPeriod();
    if (!period) {
      period = this.periods().find(
        (p) => p.periodCode === month || (p.startDate && p.startDate.startsWith(month)),
      ) || null;
    }

    if (!period) {
      this.errorMessage.set(
        `No attendance period found for ${this.formattedSelectedMonth()} (${month}). Please create the period in Attendance first.`,
      );
      setTimeout(() => this.errorMessage.set(null), 5000);
      input.value = '';
      return;
    }

    this.isImporting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.attendanceApi.importExcel(period.id, file, false).subscribe({
      next: (res) => {
        this.isImporting.set(false);
        input.value = '';
        const valid = res.data?.validRows ?? 0;
        const errorCount = res.data?.errors?.length ?? 0;
        if (errorCount > 0) {
          this.successMessage.set(
            `Attendance imported: ${valid} row(s) updated with ${errorCount} warning(s). Timesheet refreshed.`,
          );
        } else {
          this.successMessage.set(
            `Attendance imported successfully: ${valid} row(s) updated. Timesheet refreshed.`,
          );
        }
        setTimeout(() => this.successMessage.set(null), 5000);
        this.loadTimesheetData();
      },
      error: (err) => {
        this.isImporting.set(false);
        input.value = '';
        this.errorMessage.set(
          err?.error?.error?.message || err?.error?.message || 'Failed to import attendance Excel file.',
        );
        setTimeout(() => this.errorMessage.set(null), 6000);
      },
    });
  }

  // ---------- Downloads ----------

  public downloadSingleEmployee(employee: TimesheetEmployeeRow, event?: MouseEvent): void {
    event?.stopPropagation();
    const month = this.selectedMonth();
    const formattedMonth = this.formattedSelectedMonth();
    const days = this.daysInMonth();

    const rowsXml: string[] = [];

    // Title rows
    rowsXml.push(`
      <Row>
        <Cell ss:MergeAcross="5" ss:StyleID="Title"><Data ss:Type="String">MONTHLY TIMESHEET - ${this.escapeXml(employee.name)} (${this.escapeXml(employee.code)})</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="5" ss:StyleID="Subtitle"><Data ss:Type="String">Period: ${formattedMonth} | Shift: ${this.escapeXml(employee.shiftName || 'Standard')} (${employee.shiftWorkHours || 8}h/day)</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="5"><Data ss:Type="String"></Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Day</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Date</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Day Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Shift Hours</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Actual Hours</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">OT Hours</Data></Cell>
      </Row>
    `);

    for (const d of days) {
      const cell = employee.dailyCells[d];
      const hrs = this.getCellActual(employee, d);
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      const dayType = cell?.dayType || (this.isWeeklyOff(d) ? 'weekly_off' : 'regular_workday');
      const shiftHrs = cell?.shiftHours ?? (employee.shiftWorkHours || 8);
      const isOnLeave = cell?.isOnLeave ?? false;
      let otHrs = 0;
      if (!isOnLeave) {
        if (dayType === 'public_holiday' || dayType === 'weekly_off') {
          otHrs = hrs;
        } else if (shiftHrs > 0 && hrs > shiftHrs) {
          otHrs = hrs - shiftHrs;
        }
      }

      rowsXml.push(`
        <Row>
          <Cell ss:StyleID="Center"><Data ss:Type="Number">${d}</Data></Cell>
          <Cell ss:StyleID="Center"><Data ss:Type="String">${dateStr}</Data></Cell>
          <Cell ss:StyleID="Text"><Data ss:Type="String">${this.formatDayType(dayType, isOnLeave)}</Data></Cell>
          <Cell ss:StyleID="Number"><Data ss:Type="Number">${shiftHrs}</Data></Cell>
          <Cell ss:StyleID="Number"><Data ss:Type="Number">${hrs}</Data></Cell>
          <Cell ss:StyleID="Number"><Data ss:Type="Number">${Math.round(otHrs * 10) / 10}</Data></Cell>
        </Row>
      `);
    }

    // Total Row
    rowsXml.push(`
      <Row>
        <Cell ss:StyleID="TotalHeader" ss:MergeAcross="3"><Data ss:Type="String">TOTAL</Data></Cell>
        <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${employee.totalHours}</Data></Cell>
        <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${employee.ot}</Data></Cell>
      </Row>
    `);

    const xml = this.buildExcelXml(`Timesheet_${employee.code}`, rowsXml.join(''));
    this.triggerDownload(xml, `timesheet_${employee.code}_${month}.xls`, 'application/vnd.ms-excel');
    this.successMessage.set(`Downloaded timesheet for ${employee.name} (${formattedMonth})`);
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  public downloadAllEmployeesTimesheet(): void {
    const month = this.selectedMonth();
    const formattedMonth = this.formattedSelectedMonth();
    const days = this.daysInMonth();
    const employees = this.employeeRows();

    if (employees.length === 0) {
      this.errorMessage.set('No employee timesheet data available to download.');
      setTimeout(() => this.errorMessage.set(null), 4000);
      return;
    }

    const rowsXml: string[] = [];

    // Title & Info
    rowsXml.push(`
      <Row>
        <Cell ss:MergeAcross="${4 + days.length}" ss:StyleID="Title"><Data ss:Type="String">MONTHLY TIMESHEET REPORT - ALL EMPLOYEES</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="${4 + days.length}" ss:StyleID="Subtitle"><Data ss:Type="String">Period: ${formattedMonth} | Total Employees: ${employees.length}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="${4 + days.length}"><Data ss:Type="String"></Data></Cell>
      </Row>
    `);

    // Column Headers
    const headerCells = [
      `<Cell ss:StyleID="Header"><Data ss:Type="String">Employee Code</Data></Cell>`,
      `<Cell ss:StyleID="Header"><Data ss:Type="String">Employee Name</Data></Cell>`,
      `<Cell ss:StyleID="Header"><Data ss:Type="String">Shift</Data></Cell>`,
      `<Cell ss:StyleID="Header"><Data ss:Type="String">Total Hours</Data></Cell>`,
      `<Cell ss:StyleID="Header"><Data ss:Type="String">OT Hours</Data></Cell>`,
      ...days.map((d) => `<Cell ss:StyleID="Header"><Data ss:Type="String">Day ${d}</Data></Cell>`),
    ];
    rowsXml.push(`<Row>${headerCells.join('')}</Row>`);

    // Employee Rows
    let totalAllHours = 0;
    let totalAllOt = 0;
    const dayTotals: Record<number, number> = {};

    for (const emp of employees) {
      totalAllHours += emp.totalHours;
      totalAllOt += emp.ot;

      const cells = [
        `<Cell ss:StyleID="Center"><Data ss:Type="String">${this.escapeXml(emp.code)}</Data></Cell>`,
        `<Cell ss:StyleID="Text"><Data ss:Type="String">${this.escapeXml(emp.name)}</Data></Cell>`,
        `<Cell ss:StyleID="Text"><Data ss:Type="String">${this.escapeXml(emp.shiftName || 'Standard')}</Data></Cell>`,
        `<Cell ss:StyleID="Number"><Data ss:Type="Number">${emp.totalHours}</Data></Cell>`,
        `<Cell ss:StyleID="Number"><Data ss:Type="Number">${emp.ot}</Data></Cell>`,
      ];

      for (const d of days) {
        const hrs = this.getCellActual(emp, d);
        dayTotals[d] = (dayTotals[d] || 0) + hrs;
        cells.push(`<Cell ss:StyleID="Number"><Data ss:Type="Number">${hrs}</Data></Cell>`);
      }

      rowsXml.push(`<Row>${cells.join('')}</Row>`);
    }

    // Summary Row across all employees
    const summaryCells = [
      `<Cell ss:StyleID="TotalHeader" ss:MergeAcross="2"><Data ss:Type="String">TOTALS</Data></Cell>`,
      `<Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${Math.round(totalAllHours * 10) / 10}</Data></Cell>`,
      `<Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${Math.round(totalAllOt * 10) / 10}</Data></Cell>`,
      ...days.map(
        (d) =>
          `<Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${Math.round((dayTotals[d] || 0) * 10) / 10}</Data></Cell>`,
      ),
    ];
    rowsXml.push(`<Row>${summaryCells.join('')}</Row>`);

    const xml = this.buildExcelXml(`All_Employees_${month}`, rowsXml.join(''));
    this.triggerDownload(xml, `timesheet_all_employees_${month}.xls`, 'application/vnd.ms-excel');
    this.successMessage.set(`Downloaded timesheet for all employees (${formattedMonth})`);
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  private buildExcelXml(sheetName: string, rowsContent: string): string {
    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#1E293B"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
   </Borders>
  </Style>
  <Style ss:ID="Text">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Center">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Number">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.0"/>
  </Style>
  <Style ss:ID="TotalHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#475569"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#475569"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalNumber">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.0"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#475569"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#475569"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sheetName.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31)}">
  <Table>
   ${rowsContent}
  </Table>
 </Worksheet>
</Workbook>`;
  }

  private escapeXml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatDayType(dayType: string, isOnLeave: boolean): string {
    if (isOnLeave) return 'On Leave';
    if (dayType === 'public_holiday') return 'Public Holiday';
    if (dayType === 'weekly_off') return 'Weekly Off';
    return 'Regular Workday';
  }

  private triggerDownload(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private defaultMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
