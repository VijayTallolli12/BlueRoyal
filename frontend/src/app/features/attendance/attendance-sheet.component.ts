import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AttendanceApiService } from '../../core/services/attendance-api.service';
import { MasterService } from '../../core/services/master.service';
import { AuthService } from '../../core/services/auth.service';
import {
  AttendancePeriodDto,
  AttendanceGridResponseDto,
  AttendanceGridRowDto,
  AttendanceImportResultDto,
  AttendanceAuditLogDto,
  ClientDto,
  ProjectDto,
} from '@blue-royal/contracts';

@Component({
  selector: 'app-attendance-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="attendance-container">
      <!-- Top Action Bar -->
      <div class="header-bar">
        <div class="title-section">
          <h2>Attendance & Overtime Management</h2>
          <span class="subtitle">Monthly Point-in-Time Deployment & Timesheet Engine</span>
        </div>

        <div class="period-controls">
          <label for="periodSelect">Period:</label>
          <select
            id="periodSelect"
            [ngModel]="selectedPeriodId()"
            (ngModelChange)="onPeriodChange($event)"
            class="select-input"
          >
            @for (p of periods(); track p.id) {
              <option [value]="p.id">
                {{ p.periodCode }} ({{ p.name }}) - {{ p.status | uppercase }}
              </option>
            }
          </select>

          <button (click)="showCreatePeriodModal.set(true)" class="btn btn-secondary">
            + New Period
          </button>
        </div>
      </div>

      <!-- Messages -->
      @if (errorMessage()) {
        <div class="alert alert-danger">{{ errorMessage() }}</div>
      }
      @if (successMessage()) {
        <div class="alert alert-success">{{ successMessage() }}</div>
      }

      @if (selectedPeriod(); as period) {
        <!-- Status Banner and Lifecycle Actions -->
        <div class="lifecycle-banner status-{{ period.status }}">
          <div class="status-info">
            <span class="status-badge status-{{ period.status }}">
              {{ period.status | uppercase }}
            </span>
            <span class="period-dates">
              {{ period.startDate }} to {{ period.endDate }}
            </span>
            @if (period.unlockReason) {
              <span class="unlock-note" title="{{ period.unlockReason }}">
                (Unlocked: {{ period.unlockReason | slice:0:30 }}...)
              </span>
            }
          </div>

          <div class="lifecycle-actions">
            <button (click)="onDownloadTemplate()" class="btn btn-outline">
              📥 Download Excel Template
            </button>

            @if (period.status !== 'locked') {
              <button (click)="openImportModal()" class="btn btn-outline">
                📤 Import Excel
              </button>
            }

            @if (period.status === 'draft') {
              <button
                (click)="onSubmitPeriod()"
                [disabled]="(gridData()?.summary?.totalAnomalies || 0) > 0"
                class="btn btn-primary"
                [title]="(gridData()?.summary?.totalAnomalies || 0) > 0 ? 'Resolve all anomalies before submission' : 'Submit for approval'"
              >
                Submit for Approval
              </button>
            }

            @if (period.status === 'submitted') {
              <button (click)="onApprovePeriod()" class="btn btn-success">
                Approve Timesheet
              </button>
            }

            @if (period.status === 'approved') {
              <button (click)="onLockPeriod()" class="btn btn-warning">
                🔒 Lock for Payroll
              </button>
            }

            @if (period.status === 'locked') {
              <button (click)="showUnlockModal.set(true)" class="btn btn-danger">
                🔓 Request Unlock
              </button>
            }
          </div>
        </div>

        <!-- Summary KPI Cards -->
        @if (gridData()?.summary; as sum) {
          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-label">Headcount</span>
              <span class="kpi-value">{{ sum.totalEmployees }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Total Actual Hours</span>
              <span class="kpi-value">{{ sum.totalActualHours.toFixed(1) }}h</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Regular Hours</span>
              <span class="kpi-value">{{ sum.totalRegularHours.toFixed(1) }}h</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Overtime Hours</span>
              <span class="kpi-value text-accent">{{ sum.totalOtHours.toFixed(1) }}h</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Total Absences</span>
              <span class="kpi-value text-muted">{{ sum.totalAbsences }}</span>
            </div>
            <div
              class="kpi-card anomaly-card"
              [class.has-anomaly]="sum.totalAnomalies > 0"
            >
              <span class="kpi-label">Unresolved Anomalies</span>
              <span class="kpi-value">{{ sum.totalAnomalies }}</span>
              @if (sum.totalAnomalies > 0) {
                <span class="kpi-help">Blocks submission & locking</span>
              }
            </div>
          </div>
        }

        <!-- Filter & Search Controls -->
        <div class="filter-bar">
          <div class="filter-group">
            <label>Client:</label>
            <select [(ngModel)]="filterClientId" (change)="applyFilters()" class="filter-select">
              <option value="">All Clients</option>
              @for (c of clients(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>

          <div class="filter-group">
            <label>Project:</label>
            <select [(ngModel)]="filterProjectId" (change)="applyFilters()" class="filter-select">
              <option value="">All Projects</option>
              @for (p of projects(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </div>

          <div class="filter-group checkbox-group">
            <label>
              <input
                type="checkbox"
                [(ngModel)]="filterAnomalyOnly"
                (change)="applyFilters()"
              />
              Show Anomalies Only
            </label>
          </div>

          <button (click)="loadGrid()" class="btn btn-secondary btn-sm">Refresh Grid</button>
        </div>

        <!-- Attendance Matrix Grid -->
        @if (isLoading()) {
          <div class="loading-state">Loading monthly attendance grid...</div>
        } @else {
          @if (gridData(); as grid) {
            <div class="grid-table-container">
              <table class="attendance-table">
                <thead>
                  <tr>
                    <th class="sticky-col col-code">Code</th>
                    <th class="sticky-col col-name">Employee</th>
                    <th class="col-meta">Designation</th>
                    <th class="col-meta">Project</th>
                    <th class="col-shift">Shift</th>

                    @for (date of grid.dates; track date) {
                      <th
                        class="col-day"
                        [class.day-weekly-off]="isWeeklyOff(date)"
                        [class.day-holiday]="isPublicHoliday(date)"
                        title="{{ date }}"
                      >
                        <div class="day-num">{{ getDayNumber(date) }}</div>
                        <div class="day-name">{{ getDayShortName(date) }}</div>
                      </th>
                    }

                    <th class="col-summary">Act</th>
                    <th class="col-summary">Reg</th>
                    <th class="col-summary">OT</th>
                    <th class="col-summary">Abs</th>
                    <th class="col-summary">Anom</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredRows(); track row.employeeId) {
                    <tr>
                      <td class="sticky-col col-code font-mono">{{ row.employeeCode }}</td>
                      <td class="sticky-col col-name font-bold">{{ row.employeeName }}</td>
                      <td class="col-meta">{{ row.designationTitle || '-' }}</td>
                      <td class="col-meta">{{ row.projectName || '-' }}</td>
                      <td class="col-shift">
                        <span class="shift-tag" [class.no-shift]="!row.shiftWorkHours">
                          {{ row.shiftName || 'None' }} ({{ row.shiftWorkHours || 0 }}h)
                        </span>
                      </td>

                      @for (date of grid.dates; track date) {
                        @let rec = row.records ? row.records[date] : null;
                        <td
                          class="col-day-cell"
                          [class.cell-weekend]="isWeeklyOff(date)"
                          [class.cell-holiday]="isPublicHoliday(date)"
                          [class.cell-absent]="rec?.isAbsent"
                          [class.cell-anomaly]="rec?.hasAnomaly"
                          [class.cell-leave]="rec?.isOnLeave"
                          [class.cell-clickable]="period.status !== 'locked'"
                          (click)="onCellClick(rec, row)"
                          title="{{ getCellTooltip(rec, date) }}"
                        >
                          @if (rec) {
                            @if (rec.hasAnomaly) {
                              <div class="cell-warning" title="{{ rec.anomalyReason }}">⚠️</div>
                            } @else if (rec.isOnLeave) {
                              <span class="tag-leave">L</span>
                            } @else if (rec.isAbsent) {
                              <span class="tag-absent">A</span>
                            } @else if (rec.actualHours > 0) {
                              <span class="hours-val">{{ rec.actualHours }}</span>
                              @if (rec.otHours > 0) {
                                <span class="ot-badge">+{{ rec.otHours }}</span>
                              }
                            } @else if (isWeeklyOff(date) || isPublicHoliday(date)) {
                              <span class="tag-off">-</span>
                            } @else {
                              <span class="tag-zero">0</span>
                            }
                          } @else {
                            <span class="tag-na">-</span>
                          }
                        </td>
                      }

                      <td class="col-summary font-bold">{{ row.summary?.totalActualHours }}</td>
                      <td class="col-summary">{{ row.summary?.totalRegularHours }}</td>
                      <td class="col-summary text-accent font-bold">{{ row.summary?.totalOtHours }}</td>
                      <td class="col-summary">{{ row.summary?.totalAbsences }}</td>
                      <td class="col-summary">
                        @if ((row.summary?.anomalyCount || 0) > 0) {
                          <span class="badge-anomaly">{{ row.summary?.anomalyCount }}</span>
                        } @else {
                          0
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }

      <!-- Cell Edit Drawer / Modal -->
      @if (editingRecord(); as editItem) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Edit Timesheet Cell</h3>
              <button (click)="closeEditDrawer()" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
              <p><strong>Employee:</strong> {{ editItem.employeeName }} ({{ editItem.employeeCode }})</p>
              <p><strong>Work Date:</strong> {{ editItem.record.workDate }} ({{ editItem.record.dayType }})</p>

              @if (editItem.record.hasAnomaly) {
                <div class="alert alert-warning">
                  <strong>Anomaly Detected:</strong> {{ editItem.record.anomalyReason }}
                </div>
              }

              <div class="form-group">
                <label>Actual Hours Worked (0 - 24):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  [(ngModel)]="editActualHours"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" [(ngModel)]="editIsOnLeave" />
                  On Approved Leave
                </label>
              </div>

              <div class="form-group">
                <label>Change Justification Reason (Required for Audit):</label>
                <input
                  type="text"
                  [(ngModel)]="editChangeReason"
                  placeholder="e.g. Approved site overtime timesheet verified"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label>Remarks:</label>
                <input
                  type="text"
                  [(ngModel)]="editRemarks"
                  placeholder="Optional operational notes"
                  class="form-control"
                />
              </div>

              <!-- Audit Trail for this cell -->
              <div class="audit-history">
                <h4>Cell Audit Trail</h4>
                @if (cellAuditLogs().length === 0) {
                  <p class="text-muted">No historical manual modifications on this cell.</p>
                } @else {
                  <ul class="audit-list">
                    @for (log of cellAuditLogs(); track log.id) {
                      <li>
                        <strong>{{ log.fieldName }}:</strong>
                        <span>{{ log.oldValue || 'None' }} &rarr; {{ log.newValue }}</span>
                        <span class="audit-reason">({{ log.changeReason }})</span>
                        <span class="audit-time">{{ log.createdAt | date:'short' }}</span>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
            <div class="modal-footer">
              <button (click)="closeEditDrawer()" class="btn btn-secondary">Cancel</button>
              <button (click)="saveCellEdit()" class="btn btn-primary">Save Changes</button>
            </div>
          </div>
        </div>
      }

      <!-- Unlock Modal -->
      @if (showUnlockModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Unlock Timesheet Period</h3>
              <button (click)="showUnlockModal.set(false)" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
              <div class="alert alert-warning">
                <strong>Controlled Unlock Protocol:</strong>
                Unlocking returns this period to DRAFT status. Resubmission, reapproval,
                and relocking will be strictly required before payroll integration.
              </div>

              <div class="form-group">
                <label>Audit Justification Reason (Min 15 Characters):</label>
                <textarea
                  rows="4"
                  [(ngModel)]="unlockReasonText"
                  placeholder="Enter detailed audit justification for reopening timesheet..."
                  class="form-control"
                ></textarea>
                <span class="char-count">
                  Characters: {{ unlockReasonText.length }} / 15 minimum
                </span>
              </div>
            </div>
            <div class="modal-footer">
              <button (click)="showUnlockModal.set(false)" class="btn btn-secondary">Cancel</button>
              <button
                (click)="onExecuteUnlock()"
                [disabled]="unlockReasonText.trim().length < 15"
                class="btn btn-danger"
              >
                Confirm Unlock
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Excel Import Modal -->
      @if (showImportModal()) {
        <div class="modal-backdrop">
          <div class="modal-card modal-lg">
            <div class="modal-header">
              <h3>Import Attendance from Excel</h3>
              <button (click)="showImportModal.set(false)" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Select Spreadsheet (.xlsx, .xls):</label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  (change)="onFileSelected($event)"
                  class="form-control"
                />
              </div>

              @if (importResult(); as res) {
                <div class="import-report">
                  <h4>
                    Validation Report:
                    <span [class.text-success]="res.errorCount === 0" [class.text-danger]="res.errorCount > 0">
                      {{ res.errorCount === 0 ? 'Validation Passed' : 'Validation Failed' }}
                    </span>
                  </h4>
                  <p>Analyzed: {{ res.totalRows }} | Valid: {{ res.validRows }} | Errors: {{ res.errorCount }}</p>

                  @if (res.errors && res.errors.length > 0) {
                    <div class="error-table-container">
                      <table class="table error-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Employee</th>
                            <th>Date</th>
                            <th>Field</th>
                            <th>Error Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (err of res.errors; track $index) {
                            <tr>
                              <td>{{ err.rowNumber }}</td>
                              <td>{{ err.employeeCode || '-' }}</td>
                              <td>{{ err.workDate || '-' }}</td>
                              <td>{{ err.field }}</td>
                              <td class="text-danger">{{ err.message }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </div>
              }
            </div>
            <div class="modal-footer">
              <button (click)="showImportModal.set(false)" class="btn btn-secondary">Close</button>
              <button
                (click)="onDryRunImport()"
                [disabled]="!selectedFile"
                class="btn btn-outline"
              >
                Dry-Run Validation
              </button>
              <button
                (click)="onExecuteImport()"
                [disabled]="!selectedFile || (importResult() && importResult()!.errorCount > 0)"
                class="btn btn-primary"
              >
                Execute Full Import
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Create Period Modal -->
      @if (showCreatePeriodModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Create Monthly Attendance Period</h3>
              <button (click)="showCreatePeriodModal.set(false)" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Period Code (YYYY-MM):</label>
                <input
                  type="text"
                  [(ngModel)]="newPeriodCode"
                  placeholder="e.g. 2026-05"
                  class="form-control"
                />
              </div>
              <div class="form-group">
                <label>Display Name (Optional):</label>
                <input
                  type="text"
                  [(ngModel)]="newPeriodName"
                  placeholder="e.g. May 2026"
                  class="form-control"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button (click)="showCreatePeriodModal.set(false)" class="btn btn-secondary">Cancel</button>
              <button (click)="onCreatePeriod()" class="btn btn-primary">Generate Period</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .attendance-container {
        padding: 1.5rem;
        background: #f8fafc;
        min-height: 100vh;
      }
      .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .title-section h2 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }
      .subtitle {
        font-size: 0.875rem;
        color: #64748b;
      }
      .period-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .select-input {
        padding: 0.5rem 1rem;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #fff;
        font-size: 0.875rem;
      }
      .lifecycle-banner {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 1rem 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .status-badge {
        padding: 0.35rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.05em;
      }
      .status-draft { background: #f1f5f9; color: #475569; }
      .status-submitted { background: #e0f2fe; color: #0369a1; }
      .status-approved { background: #dcfce7; color: #15803d; }
      .status-locked { background: #fee2e2; color: #b91c1c; }
      .period-dates {
        margin-left: 0.75rem;
        font-size: 0.875rem;
        color: #475569;
        font-weight: 500;
      }
      .unlock-note {
        margin-left: 0.5rem;
        font-size: 0.8rem;
        color: #b91c1c;
        font-style: italic;
      }
      .lifecycle-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 1rem;
        margin-bottom: 1.25rem;
      }
      .kpi-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
      }
      .kpi-label {
        font-size: 0.75rem;
        color: #64748b;
        text-transform: uppercase;
        font-weight: 600;
      }
      .kpi-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        margin-top: 0.25rem;
      }
      .text-accent { color: #2563eb; }
      .text-muted { color: #64748b; }
      .anomaly-card.has-anomaly {
        border-color: #fca5a5;
        background: #fef2f2;
      }
      .anomaly-card.has-anomaly .kpi-value {
        color: #dc2626;
      }
      .kpi-help {
        font-size: 0.7rem;
        color: #dc2626;
        margin-top: 0.25rem;
      }
      .filter-bar {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.75rem 1.25rem;
        display: flex;
        align-items: center;
        gap: 1.5rem;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
      }
      .filter-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
      }
      .filter-select {
        padding: 0.35rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #fff;
      }
      .grid-table-container {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: auto;
        max-height: 65vh;
      }
      .attendance-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8125rem;
        white-space: nowrap;
      }
      .attendance-table th, .attendance-table td {
        border: 1px solid #e2e8f0;
        padding: 0.4rem 0.5rem;
        text-align: center;
      }
      .attendance-table th {
        background: #f8fafc;
        position: sticky;
        top: 0;
        z-index: 10;
        font-weight: 600;
        color: #334155;
      }
      .sticky-col {
        position: sticky;
        left: 0;
        background: #fff;
        z-index: 5;
        text-align: left;
      }
      .col-code { left: 0; width: 90px; }
      .col-name { left: 90px; min-width: 160px; z-index: 6; }
      .col-meta { min-width: 120px; text-align: left; }
      .col-shift { min-width: 130px; }
      .shift-tag {
        font-size: 0.75rem;
        padding: 0.2rem 0.4rem;
        background: #f1f5f9;
        border-radius: 4px;
      }
      .shift-tag.no-shift {
        background: #fee2e2;
        color: #991b1b;
      }
      .col-day {
        min-width: 36px;
        padding: 0.25rem;
      }
      .day-weekly-off { background: #eff6ff !important; color: #1d4ed8; }
      .day-holiday { background: #fef3c7 !important; color: #b45309; }
      .col-day-cell {
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .col-day-cell:hover {
        background: #f1f5f9;
      }
      .cell-weekend { background: #f8fafc; }
      .cell-holiday { background: #fffbeb; }
      .cell-absent { background: #fef2f2; color: #dc2626; font-weight: 700; }
      .cell-leave { background: #fef9c3; color: #854d0e; font-weight: 700; }
      .cell-anomaly {
        border: 2px solid #ef4444 !important;
        background: #fee2e2;
      }
      .ot-badge {
        font-size: 0.65rem;
        background: #dbeafe;
        color: #1d4ed8;
        padding: 1px 3px;
        border-radius: 3px;
        margin-left: 2px;
      }
      .tag-absent { color: #dc2626; font-weight: bold; }
      .tag-leave { color: #d97706; font-weight: bold; }
      .tag-off { color: #94a3b8; }
      .tag-zero { color: #cbd5e1; }
      .tag-na { color: #e2e8f0; }
      .badge-anomaly {
        background: #ef4444;
        color: #fff;
        padding: 2px 6px;
        border-radius: 9999px;
        font-size: 0.7rem;
      }
      .btn {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
      }
      .btn-primary { background: #2563eb; color: #fff; }
      .btn-secondary { background: #64748b; color: #fff; }
      .btn-success { background: #16a34a; color: #fff; }
      .btn-warning { background: #ca8a04; color: #fff; }
      .btn-danger { background: #dc2626; color: #fff; }
      .btn-outline {
        background: transparent;
        border: 1px solid #cbd5e1;
        color: #334155;
      }
      .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-card {
        background: #fff;
        border-radius: 8px;
        width: 100%;
        max-width: 500px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .modal-lg { max-width: 750px; }
      .modal-header {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .modal-header h3 { margin: 0; font-size: 1.2rem; }
      .btn-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
      }
      .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
      }
      .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      .form-group {
        margin-bottom: 1rem;
      }
      .form-group label {
        display: block;
        margin-bottom: 0.35rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #334155;
      }
      .form-control {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        font-size: 0.875rem;
      }
      .alert {
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        font-size: 0.875rem;
      }
      .alert-danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
      .alert-success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
      .alert-warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
      .audit-history {
        margin-top: 1.5rem;
        border-top: 1px solid #e2e8f0;
        padding-top: 1rem;
      }
      .audit-list {
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: 0.8rem;
      }
      .audit-list li {
        padding: 0.35rem 0;
        border-bottom: 1px dashed #e2e8f0;
        display: flex;
        flex-direction: column;
      }
      .audit-reason { color: #64748b; font-style: italic; }
      .audit-time { color: #94a3b8; font-size: 0.7rem; }
      .error-table { width: 100%; font-size: 0.75rem; border-collapse: collapse; }
      .error-table th, .error-table td { border: 1px solid #cbd5e1; padding: 0.35rem; }
      .loading-state { text-align: center; padding: 3rem; color: #64748b; }
      .char-count { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; display: block; }
    `,
  ],
})
export class AttendanceSheetComponent implements OnInit {
  public periods = signal<AttendancePeriodDto[]>([]);
  public selectedPeriodId = signal<string>('');
  public selectedPeriod = computed(() =>
    this.periods().find((p) => p.id === this.selectedPeriodId()),
  );

  public gridData = signal<AttendanceGridResponseDto | null>(null);
  public clients = signal<ClientDto[]>([]);
  public projects = signal<ProjectDto[]>([]);

  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  // Filters
  public filterClientId = '';
  public filterProjectId = '';
  public filterAnomalyOnly = false;

  // Filtered rows
  public filteredRows = computed(() => {
    const data = this.gridData();
    if (!data) return [];
    let rows = data.rows;
    if (this.filterAnomalyOnly) {
      rows = rows.filter((r) => (r.summary?.anomalyCount || 0) > 0);
    }
    return rows;
  });

  // Modals & Drawers
  public showCreatePeriodModal = signal<boolean>(false);
  public newPeriodCode = '';
  public newPeriodName = '';

  public showUnlockModal = signal<boolean>(false);
  public unlockReasonText = '';

  public showImportModal = signal<boolean>(false);
  public selectedFile: File | null = null;
  public importResult = signal<AttendanceImportResultDto | null>(null);

  public editingRecord = signal<{
    record: any;
    employeeName: string;
    employeeCode: string;
  } | null>(null);
  public editActualHours = 0;
  public editIsOnLeave = false;
  public editChangeReason = '';
  public editRemarks = '';
  public cellAuditLogs = signal<AttendanceAuditLogDto[]>([]);

  constructor(
    private attendanceApi: AttendanceApiService,
    private masterService: MasterService,
    public authService: AuthService,
  ) {}

  public ngOnInit(): void {
    this.loadPeriods();
    this.loadFilterMasters();
  }

  public loadPeriods(): void {
    this.attendanceApi.listPeriods().subscribe({
      next: (res) => {
        this.periods.set(res.data);
        if (res.data.length > 0 && !this.selectedPeriodId()) {
          this.selectedPeriodId.set(res.data[0].id);
          this.loadGrid();
        }
      },
      error: (err) => this.setError(err.error?.error?.message || 'Failed to load periods'),
    });
  }

  public loadFilterMasters(): void {
    this.masterService.getClients().subscribe({
      next: (res) => this.clients.set(res.data),
    });
    this.masterService.getProjects().subscribe({
      next: (res) => this.projects.set(res.data),
    });
  }

  public onPeriodChange(periodId: string): void {
    this.selectedPeriodId.set(periodId);
    this.loadGrid();
  }

  public loadGrid(): void {
    const periodId = this.selectedPeriodId();
    if (!periodId) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.attendanceApi
      .getGrid(periodId, {
        clientId: this.filterClientId || undefined,
        projectId: this.filterProjectId || undefined,
        hasAnomaly: this.filterAnomalyOnly ? true : undefined,
      })
      .subscribe({
        next: (res) => {
          this.gridData.set(res.data);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.setError(err.error?.error?.message || 'Failed to load attendance grid');
          this.isLoading.set(false);
        },
      });
  }

  public applyFilters(): void {
    this.loadGrid();
  }

  // Lifecycle transitions
  public onSubmitPeriod(): void {
    const periodId = this.selectedPeriodId();
    if (!periodId) return;

    this.attendanceApi.submitPeriod(periodId).subscribe({
      next: () => {
        this.setSuccess('Attendance period submitted successfully for approval.');
        this.loadPeriods();
        this.loadGrid();
      },
      error: (err) => this.setError(err.error?.error?.message || 'Submission failed'),
    });
  }

  public onApprovePeriod(): void {
    const periodId = this.selectedPeriodId();
    if (!periodId) return;

    this.attendanceApi.approvePeriod(periodId).subscribe({
      next: () => {
        this.setSuccess('Attendance period approved successfully.');
        this.loadPeriods();
        this.loadGrid();
      },
      error: (err) => this.setError(err.error?.error?.message || 'Approval failed'),
    });
  }

  public onLockPeriod(): void {
    const periodId = this.selectedPeriodId();
    if (!periodId) return;

    this.attendanceApi.lockPeriod(periodId).subscribe({
      next: () => {
        this.setSuccess('Attendance period locked for payroll.');
        this.loadPeriods();
        this.loadGrid();
      },
      error: (err) => this.setError(err.error?.error?.message || 'Locking failed'),
    });
  }

  public onExecuteUnlock(): void {
    const periodId = this.selectedPeriodId();
    if (!periodId || this.unlockReasonText.trim().length < 15) return;

    this.attendanceApi.unlockPeriod(periodId, this.unlockReasonText.trim()).subscribe({
      next: () => {
        this.setSuccess('Attendance period unlocked. Reverted to DRAFT.');
        this.showUnlockModal.set(false);
        this.unlockReasonText = '';
        this.loadPeriods();
        this.loadGrid();
      },
      error: (err) => this.setError(err.error?.error?.message || 'Unlock failed'),
    });
  }

  // Excel operations
  public onDownloadTemplate(): void {
    const periodId = this.selectedPeriodId();
    if (!periodId) return;

    this.attendanceApi.downloadTemplate(periodId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_template_${this.selectedPeriod()?.periodCode}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.setError('Failed to download Excel template'),
    });
  }

  public openImportModal(): void {
    this.selectedFile = null;
    this.importResult.set(null);
    this.showImportModal.set(true);
  }

  public onFileSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
    }
  }

  public onDryRunImport(): void {
    if (!this.selectedFile) return;
    const periodId = this.selectedPeriodId();

    this.attendanceApi.importExcel(periodId, this.selectedFile, true).subscribe({
      next: (res) => {
        this.importResult.set(res.data);
      },
      error: (err) => this.setError(err.error?.error?.message || 'Dry-run import failed'),
    });
  }

  public onExecuteImport(): void {
    if (!this.selectedFile) return;
    const periodId = this.selectedPeriodId();

    this.attendanceApi.importExcel(periodId, this.selectedFile, false).subscribe({
      next: (res) => {
        this.setSuccess(`Import completed successfully. ${res.data.validRows} rows processed.`);
        this.showImportModal.set(false);
        this.loadGrid();
      },
      error: (err) => this.setError(err.error?.error?.message || 'Import execution failed'),
    });
  }

  // Cell Click & Edit
  public onCellClick(record: any, row: AttendanceGridRowDto): void {
    const period = this.selectedPeriod();
    if (!period || period.status === 'locked' || !record) return;

    this.editingRecord.set({
      record,
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
    });
    this.editActualHours = Number(record.actualHours);
    this.editIsOnLeave = record.isOnLeave;
    this.editChangeReason = '';
    this.editRemarks = record.remarks || '';

    // Fetch audit history for cell
    this.attendanceApi.getRecordAuditLogs(record.id).subscribe({
      next: (res) => this.cellAuditLogs.set(res.data),
      error: () => this.cellAuditLogs.set([]),
    });
  }

  public closeEditDrawer(): void {
    this.editingRecord.set(null);
  }

  public saveCellEdit(): void {
    const editItem = this.editingRecord();
    const periodId = this.selectedPeriodId();
    if (!editItem || !periodId) return;

    if (!this.editChangeReason || this.editChangeReason.trim().length < 3) {
      this.setError('Change justification reason (minimum 3 characters) is required.');
      return;
    }

    this.attendanceApi
      .batchUpdateRecords(periodId, {
        batchReason: this.editChangeReason,
        records: [
          {
            recordId: editItem.record.id,
            actualHours: this.editActualHours,
            isOnLeave: this.editIsOnLeave,
            remarks: this.editRemarks,
            changeReason: this.editChangeReason,
          },
        ],
      })
      .subscribe({
        next: (res) => {
          this.setSuccess('Record updated successfully.');
          this.closeEditDrawer();
          this.loadGrid();
          if (res.data.newPeriodStatus === 'draft' && this.selectedPeriod()?.status !== 'draft') {
            this.loadPeriods();
          }
        },
        error: (err) => this.setError(err.error?.error?.message || 'Update failed'),
      });
  }

  public onCreatePeriod(): void {
    if (!this.newPeriodCode) {
      this.setError('Period Code (YYYY-MM) is required.');
      return;
    }

    this.attendanceApi
      .createPeriod({
        periodCode: this.newPeriodCode,
        name: this.newPeriodName || undefined,
      })
      .subscribe({
        next: (res) => {
          this.setSuccess(`Period ${res.data.periodCode} created successfully.`);
          this.showCreatePeriodModal.set(false);
          this.newPeriodCode = '';
          this.newPeriodName = '';
          this.loadPeriods();
        },
        error: (err) => this.setError(err.error?.error?.message || 'Period creation failed'),
      });
  }

  // Helpers
  public getDayNumber(dateStr: string): string {
    return dateStr.slice(8, 10);
  }

  public getDayShortName(dateStr: string): string {
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const d = new Date(`${dateStr}T00:00:00Z`);
    return days[d.getUTCDay()];
  }

  public isWeeklyOff(dateStr: string): boolean {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return d.getUTCDay() === 0; // Default Sunday
  }

  public isPublicHoliday(_dateStr: string): boolean {
    return false;
  }

  public getCellTooltip(rec: any, date: string): string {
    if (!rec) return `Date: ${date} (No Record)`;
    return `Date: ${date} | Day: ${rec.dayType} | Actual: ${rec.actualHours}h | Regular: ${rec.regularHours}h | OT: ${rec.otHours}h ${rec.hasAnomaly ? '| ⚠️ ' + rec.anomalyReason : ''}`;
  }

  private setError(msg: string): void {
    this.errorMessage.set(msg);
    setTimeout(() => this.errorMessage.set(null), 6000);
  }

  private setSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 5000);
  }
}
