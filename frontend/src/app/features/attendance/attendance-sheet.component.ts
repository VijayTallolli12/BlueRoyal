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
  ClientDto,
  ProjectDto,
} from '@blue-royal/contracts';

import { AppShellComponent } from '../../core/layout/app-shell.component';

@Component({
  selector: 'app-attendance-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="attendance-container">
        <!-- Top Action Bar -->
        <div class="header-bar">
          <div class="title-section">
            <h2>Attendance</h2>
            <span class="subtitle">Employee attendance records, absence tracking, and status verification</span>
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
              <span class="material-symbols-outlined icon-sm">add</span>
              <span>New Period</span>
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
                <span class="material-symbols-outlined icon-sm">download</span>
                <span>Download Excel Template</span>
              </button>

              @if (period.status !== 'locked') {
                <button (click)="openImportModal()" class="btn btn-outline">
                  <span class="material-symbols-outlined icon-sm">upload_file</span>
                  <span>Import Excel</span>
                </button>
              }

              @if (period.status === 'draft') {
                <button
                  (click)="onSubmitPeriod()"
                  [disabled]="(gridData()?.summary?.totalAnomalies || 0) > 0"
                  class="btn btn-primary"
                  [title]="(gridData()?.summary?.totalAnomalies || 0) > 0 ? 'Resolve all anomalies before submission' : 'Submit for approval'"
                >
                  <span class="material-symbols-outlined icon-sm">send</span>
                  <span>Submit for Approval</span>
                </button>
              }

              @if (period.status === 'submitted') {
                <button (click)="onApprovePeriod()" class="btn btn-success">
                  <span class="material-symbols-outlined icon-sm">check_circle</span>
                  <span>Approve Attendance</span>
                </button>
              }

              @if (period.status === 'approved') {
                <button (click)="onLockPeriod()" class="btn btn-warning">
                  <span class="material-symbols-outlined icon-sm">lock</span>
                  <span>Lock for Payroll</span>
                </button>
              }

              @if (period.status === 'locked') {
                <button (click)="showUnlockModal.set(true)" class="btn btn-danger">
                  <span class="material-symbols-outlined icon-sm">lock_open</span>
                  <span>Request Unlock</span>
                </button>
              }
            </div>
          </div>

          <!-- Top KPIs -->
          @if (gridData()?.summary; as sum) {
            <div class="kpi-grid">
              <div class="kpi-card">
                <span class="kpi-label">Headcount</span>
                <span class="kpi-value">{{ sum.totalEmployees }}</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">Present</span>
                <span class="kpi-value text-success">{{ totalPresentDays() }}</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">Absent</span>
                <span class="kpi-value text-danger">{{ sum.totalAbsences }}</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">Leave</span>
                <span class="kpi-value text-warning">{{ totalLeaveDays() }}</span>
              </div>
              @if (sum.totalAnomalies > 0) {
                <div class="kpi-card anomaly-card has-anomaly">
                  <span class="kpi-label">Unresolved Anomalies</span>
                  <span class="kpi-value">{{ sum.totalAnomalies }}</span>
                  <span class="kpi-help">Requires verification</span>
                </div>
              }
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

            <button (click)="loadGrid()" class="btn btn-secondary btn-sm">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>

          <!-- Employee Attendance List Table -->
          <div class="panel">
            <div class="panel-header">
              <h3>Attendance</h3>
              <span class="text-muted">Showing {{ filteredRows().length }} employee attendance record(s)</span>
            </div>

            @if (isLoading()) {
              <div class="loading-state">Loading attendance records...</div>
            } @else {
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Employee Code</th>
                      <th>Date / Period</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Leave</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of filteredRows(); track row.employeeId) {
                      <tr>
                        <td>
                          <strong>{{ row.employeeName }}</strong>
                          <div class="sub-text">{{ row.designationTitle || '—' }}</div>
                        </td>
                        <td>
                          <code>{{ row.employeeCode }}</code>
                        </td>
                        <td>
                          {{ period.periodCode }} ({{ period.name }})
                        </td>
                        <td>
                          <span class="badge badge-present">{{ getRowPresentDays(row) }} days</span>
                        </td>
                        <td>
                          <span class="badge" [class.badge-absent]="getRowAbsentDays(row) > 0" [class.badge-neutral]="getRowAbsentDays(row) === 0">
                            {{ getRowAbsentDays(row) }} days
                          </span>
                        </td>
                        <td>
                          <span class="badge" [class.badge-leave]="getRowLeaveDays(row) > 0" [class.badge-neutral]="getRowLeaveDays(row) === 0">
                            {{ getRowLeaveDays(row) }} days
                          </span>
                        </td>
                        <td>
                          <span class="status-badge status-{{ period.status }}">
                            {{ period.status | uppercase }}
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7" class="empty-state">No employee attendance records found for this period.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

        <!-- Unlock Confirmation Dialog (Consequential Super Admin Override) -->
        @if (showUnlockModal()) {
          <div class="dialog-backdrop" (click)="showUnlockModal.set(false)">
            <div class="dialog-box dialog-danger" (click)="$event.stopPropagation()">
              <div class="dialog-header">
                <div class="dialog-header-content">
                  <div class="dialog-icon danger">
                    <span class="material-symbols-outlined">lock_open</span>
                  </div>
                  <div>
                    <h3 class="dialog-title">Unlock Attendance Period</h3>
                    <p class="dialog-subtitle">Return period to DRAFT status for corrections</p>
                  </div>
                </div>
                <button type="button" class="dialog-close" (click)="showUnlockModal.set(false)">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
              <div class="dialog-body">
                <div class="alert alert-warning">
                  <strong>Controlled Unlock Protocol:</strong>
                  Unlocking returns this period to DRAFT status. Resubmission, reapproval,
                  and relocking will be strictly required before payroll integration.
                </div>

                <div class="form-group" style="margin-top: 1rem;">
                  <label for="unlockReason">Audit Justification Reason (Min 15 Characters) *</label>
                  <textarea
                    id="unlockReason"
                    rows="4"
                    [(ngModel)]="unlockReasonText"
                    placeholder="Enter detailed audit justification for reopening attendance..."
                    class="form-control"
                  ></textarea>
                  <span class="char-count" style="display: block; font-size: 0.75rem; margin-top: 0.25rem; color: var(--color-text-muted);">
                    Characters: {{ unlockReasonText.length }} / 15 minimum
                  </span>
                </div>
              </div>
              <div class="dialog-footer">
                <button type="button" (click)="showUnlockModal.set(false)" class="btn btn-secondary">Cancel</button>
                <button
                  type="button"
                  (click)="onExecuteUnlock()"
                  [disabled]="unlockReasonText.trim().length < 15"
                  class="btn btn-danger"
                >
                  <span class="material-symbols-outlined icon-sm">lock_open</span>
                  <span>Confirm Unlock</span>
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Excel Import Contextual Drawer -->
        @if (showImportModal()) {
          <div class="drawer-backdrop" (click)="showImportModal.set(false)">
            <div class="drawer-panel drawer-panel-lg" (click)="$event.stopPropagation()">
              <div class="drawer-header">
                <div class="drawer-header-content">
                  <h2 class="drawer-title">Import Attendance from Excel</h2>
                  <p class="drawer-subtitle">Batch ingest time tracking entries with dry-run validation</p>
                </div>
                <button type="button" class="drawer-close" (click)="showImportModal.set(false)">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
              <div class="drawer-body">
                <div class="form-group">
                  <label>Select Spreadsheet (.xlsx, .xls) *</label>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    (change)="onFileSelected($event)"
                    class="form-control"
                  />
                </div>

                @if (importResult(); as res) {
                  <div class="import-report" style="margin-top: 1.5rem;">
                    <div class="report-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                      <h4 style="margin: 0; font-size: 1rem;">Validation Report</h4>
                      <span class="badge" [class.badge-success]="res.errorCount === 0" [class.badge-danger]="res.errorCount > 0">
                        {{ res.errorCount === 0 ? 'Validation Passed' : 'Validation Failed (' + res.errorCount + ' Errors)' }}
                      </span>
                    </div>
                    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 1rem;">
                      <div class="kpi-card"><span class="kpi-label">Analyzed</span><span class="kpi-value">{{ res.totalRows }}</span></div>
                      <div class="kpi-card"><span class="kpi-label">Valid Rows</span><span class="kpi-value text-success">{{ res.validRows }}</span></div>
                      <div class="kpi-card"><span class="kpi-label">Error Rows</span><span class="kpi-value" [class.text-danger]="res.errorCount > 0">{{ res.errorCount }}</span></div>
                    </div>

                    @if (res.errors && res.errors.length > 0) {
                      <div class="table-container" style="max-height: 250px; overflow-y: auto;">
                        <table class="data-table">
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
              <div class="drawer-footer">
                <button type="button" (click)="showImportModal.set(false)" class="btn btn-secondary">Close</button>
                <button
                  type="button"
                  (click)="onDryRunImport()"
                  [disabled]="!selectedFile"
                  class="btn btn-secondary"
                >
                  <span class="material-symbols-outlined icon-sm">fact_check</span>
                  <span>Dry-Run Validation</span>
                </button>
                <button
                  type="button"
                  (click)="onExecuteImport()"
                  [disabled]="!selectedFile || (importResult() && importResult()!.errorCount > 0)"
                  class="btn btn-primary"
                >
                  <span class="material-symbols-outlined icon-sm">upload</span>
                  <span>Execute Full Import</span>
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Create Period Focused Dialog -->
        @if (showCreatePeriodModal()) {
          <div class="dialog-backdrop" (click)="showCreatePeriodModal.set(false)">
            <div class="dialog-box" (click)="$event.stopPropagation()">
              <div class="dialog-header">
                <div class="dialog-header-content">
                  <h3 class="dialog-title">Generate Monthly Attendance Period</h3>
                  <p class="dialog-subtitle">Create a new calendar tracking window</p>
                </div>
                <button type="button" class="dialog-close" (click)="showCreatePeriodModal.set(false)">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
              <div class="dialog-body">
                <div class="form-group">
                  <label for="newPeriodCode">Period Code (YYYY-MM) *</label>
                  <input
                    id="newPeriodCode"
                    type="text"
                    [(ngModel)]="newPeriodCode"
                    placeholder="e.g. 2026-05"
                    class="form-control"
                  />
                </div>
                <div class="form-group" style="margin-top: 1rem;">
                  <label for="newPeriodName">Display Name (Optional)</label>
                  <input
                    id="newPeriodName"
                    type="text"
                    [(ngModel)]="newPeriodName"
                    placeholder="e.g. May 2026"
                    class="form-control"
                  />
                </div>
              </div>
              <div class="dialog-footer">
                <button type="button" (click)="showCreatePeriodModal.set(false)" class="btn btn-secondary">Cancel</button>
                <button type="button" (click)="onCreatePeriod()" [disabled]="!newPeriodCode" class="btn btn-primary">
                  <span class="material-symbols-outlined icon-sm">add_circle</span>
                  <span>Generate Period</span>
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
      .attendance-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 1rem;
        border-bottom: 1px solid var(--border-default);
        padding-bottom: 1.25rem;
      }
      .title-section h2 {
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
      }
      .subtitle {
        font-size: 0.8125rem;
        color: var(--text-secondary);
      }
      .period-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .select-input {
        padding: 0.45rem 0.875rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-md);
        background: #ffffff;
        font-size: 0.8125rem;
        font-weight: 500;
      }
      .lifecycle-banner {
        background: #ffffff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 1rem 1.25rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        box-shadow: var(--shadow-sm);
      }
      .status-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .period-dates {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        font-weight: 500;
      }
      .unlock-note {
        font-size: 0.8rem;
        color: var(--color-danger);
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
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
      }
      .kpi-label {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }
      .kpi-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text-primary);
        margin-top: 0.25rem;
      }
      .text-success { color: #16a34a; }
      .text-danger { color: #dc2626; }
      .text-warning { color: #d97706; }
      .anomaly-card.has-anomaly {
        border-color: #fca5a5;
        background: #fff5f5;
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
        border: 1px solid var(--color-border);
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
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: #fff;
      }
      .panel {
        background: #fff;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border);
        background: #f8fafc;
      }
      .panel-header h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .table-responsive {
        overflow-x: auto;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      .data-table th, .data-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--color-border);
        text-align: left;
      }
      .data-table th {
        background: #f8fafc;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
        color: var(--color-text-secondary);
      }
      .sub-text {
        font-size: 0.75rem;
        color: var(--color-text-muted);
      }
      .badge {
        display: inline-block;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
      }
      .badge-present {
        background: #dcfce7;
        color: #166534;
      }
      .badge-absent {
        background: #fee2e2;
        color: #991b1b;
      }
      .badge-leave {
        background: #fef3c7;
        color: #92400e;
      }
      .badge-neutral {
        color: var(--color-text-muted);
        font-weight: 500;
        background: #f1f5f9;
      }
      .badge-success {
        background: #dcfce7;
        color: #166534;
      }
      .badge-danger {
        background: #fee2e2;
        color: #991b1b;
      }
      .status-badge {
        display: inline-block;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .status-draft {
        background: #f1f5f9;
        color: #475569;
      }
      .status-submitted {
        background: #e0f2fe;
        color: #0369a1;
      }
      .status-approved {
        background: #dcfce7;
        color: #166534;
      }
      .status-locked {
        background: #fef3c7;
        color: #92400e;
      }
      .empty-state {
        text-align: center;
        padding: 2.5rem 1rem;
        color: var(--color-text-muted);
        font-style: italic;
      }
      .alert {
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        font-size: 0.875rem;
      }
      .alert-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
      .alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
      .alert-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      .form-group {
        margin-bottom: 1rem;
      }
      .form-group label {
        display: block;
        margin-bottom: 0.35rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-primary);
      }
      .form-control {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 0.875rem;
      }
      .dialog-backdrop, .drawer-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .dialog-box {
        background: #fff;
        border-radius: 8px;
        width: 100%;
        max-width: 500px;
        overflow: hidden;
      }
      .dialog-header, .drawer-header {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .dialog-title, .drawer-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
      }
      .dialog-subtitle, .drawer-subtitle {
        margin: 0.25rem 0 0 0;
        font-size: 0.8125rem;
        color: var(--color-text-muted);
      }
      .dialog-close, .drawer-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.25rem;
        color: var(--color-text-muted);
      }
      .dialog-body, .drawer-body {
        padding: 1.25rem;
      }
      .dialog-footer, .drawer-footer {
        padding: 1rem 1.25rem;
        border-top: 1px solid var(--color-border);
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      .drawer-panel {
        background: #fff;
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 8px;
      }
      .drawer-panel-lg {
        max-width: 750px;
      }
      .loading-state {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-muted);
      }
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

  public getRowPresentDays(row: AttendanceGridRowDto): number {
    if (row.records) {
      return Object.values(row.records).filter(
        (rec: any) => rec && !rec.isAbsent && !rec.isOnLeave && (Number(rec.actualHours || 0) > 0 || Number(rec.regularHours || 0) > 0),
      ).length;
    }
    if (row.days) {
      return Object.values(row.days).filter(
        (c) => c && !c.isAbsent && !c.isOnLeave && (Number(c.actualHours || 0) > 0 || Number(c.regularHours || 0) > 0),
      ).length;
    }
    return row.totalDaysPresent ?? Math.max(0, (this.gridData()?.dates?.length || 30) - (row.summary?.totalAbsences || 0));
  }

  public getRowAbsentDays(row: AttendanceGridRowDto): number {
    if (row.summary?.totalAbsences !== undefined) {
      return row.summary.totalAbsences;
    }
    if (row.records) {
      return Object.values(row.records).filter((rec: any) => rec?.isAbsent).length;
    }
    if (row.days) {
      return Object.values(row.days).filter((c) => c?.isAbsent).length;
    }
    return 0;
  }

  public getRowLeaveDays(row: AttendanceGridRowDto): number {
    if (row.records) {
      return Object.values(row.records).filter((rec: any) => rec?.isOnLeave).length;
    }
    if (row.days) {
      return Object.values(row.days).filter((c) => c?.isOnLeave).length;
    }
    return 0;
  }

  public totalPresentDays = computed(() => {
    const rows = this.gridData()?.rows || [];
    return rows.reduce((sum, r) => sum + this.getRowPresentDays(r), 0);
  });

  public totalLeaveDays = computed(() => {
    const rows = this.gridData()?.rows || [];
    return rows.reduce((sum, r) => sum + this.getRowLeaveDays(r), 0);
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

  private setError(msg: string): void {
    this.errorMessage.set(msg);
    setTimeout(() => this.errorMessage.set(null), 6000);
  }

  private setSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 5000);
  }
}
