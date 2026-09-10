import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InvoiceService } from '../../core/services/invoice.service';
import { MasterService } from '../../core/services/master.service';
import { AuthService } from '../../core/services/auth.service';
import {
  InvoiceDto,
  GenerateInvoiceDto,
  InvoicePreviewDto,
  ClientDto,
  ProjectDto,
} from '@blue-royal/contracts';
import { AppShellComponent } from '../../core/layout/app-shell.component';

@Component({
  selector: 'app-client-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="invoices-container">
        <!-- Page Header -->
        <div class="page-header">
          <div class="header-main">
            <h2>Client Invoices</h2>
            <p class="subtitle">
              Generate and manage client invoices from approved billable work and verified timesheets.
            </p>
          </div>
          <div class="header-actions">
            @if (canCreateInvoice()) {
              <button class="btn btn-primary" (click)="openGenerateModal()">
                <span class="material-symbols-outlined icon-sm">add</span>
                <span>+ Generate Invoice</span>
              </button>
            }
            <button class="btn btn-secondary" (click)="loadInvoices()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Invoices</div>
            <div class="kpi-value">{{ invoices().length }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Draft Invoices</div>
            <div class="kpi-value warning">{{ draftCount() }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Issued Invoices</div>
            <div class="kpi-value success">{{ issuedCount() }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Billed (Issued)</div>
            <div class="kpi-value primary">AED {{ totalIssuedAmount() | number:'1.2-2' }}</div>
          </div>
        </div>

        <!-- Alert Notifications -->
        @if (errorMessage()) {
          <div class="alert alert-danger">
            <div class="alert-content">
              <span class="material-symbols-outlined icon-sm">error</span>
              <span>{{ errorMessage() }}</span>
            </div>
            <button class="alert-close" (click)="errorMessage.set(null)">×</button>
          </div>
        }
        @if (successMessage()) {
          <div class="alert alert-success">
            <div class="alert-content">
              <span class="material-symbols-outlined icon-sm">check_circle</span>
              <span>{{ successMessage() }}</span>
            </div>
            <button class="alert-close" (click)="successMessage.set(null)">×</button>
          </div>
        }

        <!-- Invoices List Panel -->
        <div class="panel">
          <div class="panel-bar">
            <div class="panel-title">
              <span class="material-symbols-outlined">receipt_long</span>
              <span>Commercial Client Invoices</span>
            </div>
            <div class="panel-meta">
              <span>Showing {{ invoices().length }} record(s)</span>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Billing Period</th>
                  <th>Invoice Date</th>
                  <th class="text-right">Subtotal (AED)</th>
                  <th class="text-right">Total (AED)</th>
                  <th>Status</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr>
                    <td colspan="9" class="text-center py-4">
                      <div class="spinner"></div>
                      <p class="text-muted mt-2">Loading commercial invoices...</p>
                    </td>
                  </tr>
                } @else if (invoices().length === 0) {
                  <tr>
                    <td colspan="9" class="text-center py-5 empty-state">
                      <span class="material-symbols-outlined empty-icon">request_quote</span>
                      <h4>No Client Invoices Found</h4>
                      <p class="text-muted">No commercial client invoices have been generated yet.</p>
                      @if (canCreateInvoice()) {
                        <button class="btn btn-primary btn-sm mt-3" (click)="openGenerateModal()">
                          Generate First Invoice
                        </button>
                      }
                    </td>
                  </tr>
                } @else {
                  @for (inv of invoices(); track inv.id) {
                    <tr>
                      <td class="font-mono font-semibold">{{ inv.invoiceNumber }}</td>
                      <td>{{ inv.clientName || '—' }}</td>
                      <td>{{ inv.projectName || '—' }}</td>
                      <td>
                        <span class="badge badge-period">{{ inv.billingPeriod }}</span>
                      </td>
                      <td>{{ inv.invoiceDate }}</td>
                      <td class="text-right font-mono">{{ inv.subtotal | number:'1.2-2' }}</td>
                      <td class="text-right font-mono font-bold">{{ inv.totalAmount | number:'1.2-2' }}</td>
                      <td>
                        <span class="status-badge" [ngClass]="inv.status">
                          {{ inv.status | uppercase }}
                        </span>
                      </td>
                      <td class="text-center">
                        <div class="action-buttons">
                          <button class="btn-action" title="View Details" (click)="viewInvoice(inv)">
                            <span class="material-symbols-outlined">visibility</span>
                          </button>
                          @if (inv.status === 'draft' && canIssueInvoice()) {
                            <button class="btn-action btn-issue" title="Issue Invoice" (click)="confirmIssue(inv)">
                              <span class="material-symbols-outlined">check_circle</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- GENERATE INVOICE MODAL -->
        @if (showGenerateModal()) {
          <div class="modal-backdrop">
            <div class="modal-card modal-lg">
              <div class="modal-header">
                <h3>Generate Client Invoice</h3>
                <button class="modal-close" (click)="closeGenerateModal()">×</button>
              </div>

              <div class="modal-body">
                <p class="modal-intro">
                  Select a commercial client and active project. Billable regular and overtime hours will be automatically calculated from verified attendance/timesheet records.
                </p>

                <div class="form-grid">
                  <div class="form-group">
                    <label>Client <span class="required">*</span></label>
                    <select
                      class="form-control"
                      [(ngModel)]="generateDto.clientId"
                      (change)="onClientSelected()"
                      name="clientId"
                    >
                      <option value="" disabled selected>-- Select Client --</option>
                      @for (c of clients(); track c.id) {
                        <option [value]="c.id">{{ c.name }} ({{ c.code }})</option>
                      }
                    </select>
                  </div>

                  <div class="form-group">
                    <label>Project <span class="required">*</span></label>
                    <select
                      class="form-control"
                      [(ngModel)]="generateDto.projectId"
                      (change)="fetchPreview()"
                      name="projectId"
                      [disabled]="!generateDto.clientId"
                    >
                      <option value="" disabled selected>-- Select Project --</option>
                      @for (p of availableProjects(); track p.id) {
                        <option [value]="p.id">{{ p.name }} ({{ p.code }})</option>
                      }
                    </select>
                  </div>

                  <div class="form-group">
                    <label>Billing Period <span class="required">*</span></label>
                    <input
                      type="text"
                      class="form-control"
                      [(ngModel)]="generateDto.billingPeriod"
                      (blur)="fetchPreview()"
                      placeholder="YYYY-MM (e.g. 2026-08)"
                      name="billingPeriod"
                    />
                    <span class="hint">Format: YYYY-MM (e.g. 2026-08 for August 2026)</span>
                  </div>

                  <div class="form-group">
                    <label>Source</label>
                    <input
                      type="text"
                      class="form-control"
                      value="Attendance / Timesheet (Point-in-Time Verified)"
                      disabled
                    />
                  </div>

                  <div class="form-group full-width">
                    <label>Invoice Notes (Optional)</label>
                    <textarea
                      class="form-control"
                      rows="2"
                      [(ngModel)]="generateDto.notes"
                      placeholder="Optional notes or references printed on the invoice..."
                    ></textarea>
                  </div>
                </div>

                <!-- LIVE PREVIEW SECTION -->
                @if (previewLoading()) {
                  <div class="preview-loading">
                    <div class="spinner"></div>
                    <span>Calculating billable hours and rates from timesheets...</span>
                  </div>
                } @else if (previewData()) {
                  <div class="preview-box">
                    <div class="preview-header">
                      <h4>Timesheet & Billing Preview</h4>
                      <span class="badge badge-success">Calculated by Backend Engine</span>
                    </div>

                    <div class="preview-metrics">
                      <div class="metric">
                        <span class="metric-label">Billable Employees</span>
                        <span class="metric-val">{{ previewData()?.billableEmployeesCount }}</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Regular Hours</span>
                        <span class="metric-val">{{ previewData()?.totalRegularHours }} hrs</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Overtime Hours</span>
                        <span class="metric-val">{{ previewData()?.totalOtHours }} hrs</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Regular Rate</span>
                        <span class="metric-val">{{ previewData()?.regularRate }} AED/hr</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">OT Rate</span>
                        <span class="metric-val">{{ previewData()?.otRate }} AED/hr</span>
                      </div>
                      <div class="metric highlight">
                        <span class="metric-label">Estimated Total</span>
                        <span class="metric-val primary">AED {{ previewData()?.totalAmount | number:'1.2-2' }}</span>
                      </div>
                    </div>

                    @if (previewData()?.items && previewData()!.items.length > 0) {
                      <div class="preview-breakdown">
                        <h5>Itemized Employee Breakdown</h5>
                        <table class="mini-table">
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Designation</th>
                              <th class="text-right">Reg Hours</th>
                              <th class="text-right">OT Hours</th>
                              <th class="text-right">Reg Amount</th>
                              <th class="text-right">OT Amount</th>
                              <th class="text-right">Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (item of previewData()!.items; track item.employeeId) {
                              <tr>
                                <td>{{ item.employeeName }} ({{ item.employeeCode }})</td>
                                <td>{{ item.designationTitle }}</td>
                                <td class="text-right">{{ item.regularHours }}h &#64; {{ item.regularRate }}</td>
                                <td class="text-right">{{ item.otHours }}h &#64; {{ item.otRate }}</td>
                                <td class="text-right">{{ item.regularAmount | number:'1.2-2' }}</td>
                                <td class="text-right">{{ item.otAmount | number:'1.2-2' }}</td>
                                <td class="text-right font-bold">{{ item.totalAmount | number:'1.2-2' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }

                    <div class="tax-notice">
                      <span class="material-symbols-outlined icon-xs">info</span>
                      <span>{{ previewData()?.taxNotice }} Tax amount: AED 0.00</span>
                    </div>
                  </div>
                }
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="closeGenerateModal()">
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  [disabled]="!canSubmitGeneration() || submitting()"
                  (click)="submitGenerate()"
                >
                  <span class="material-symbols-outlined icon-sm">receipt</span>
                  <span>{{ submitting() ? 'Generating...' : 'Generate Draft Invoice' }}</span>
                </button>
              </div>
            </div>
          </div>
        }

        <!-- INVOICE DETAIL MODAL -->
        @if (selectedInvoice()) {
          <div class="modal-backdrop">
            <div class="modal-card modal-lg">
              <div class="modal-header">
                <div class="invoice-header-title">
                  <h3>Invoice {{ selectedInvoice()?.invoiceNumber }}</h3>
                  <span class="status-badge" [ngClass]="selectedInvoice()?.status">
                    {{ selectedInvoice()?.status | uppercase }}
                  </span>
                </div>
                <button class="modal-close" (click)="selectedInvoice.set(null)">×</button>
              </div>

              <div class="modal-body">
                <!-- Meta Info Grid -->
                <div class="invoice-meta-grid">
                  <div>
                    <label>Client</label>
                    <p class="meta-value">{{ selectedInvoice()?.clientName }}</p>
                  </div>
                  <div>
                    <label>Project</label>
                    <p class="meta-value">{{ selectedInvoice()?.projectName }}</p>
                  </div>
                  <div>
                    <label>Billing Period</label>
                    <p class="meta-value font-mono">{{ selectedInvoice()?.billingPeriod }}</p>
                  </div>
                  <div>
                    <label>Invoice Date</label>
                    <p class="meta-value">{{ selectedInvoice()?.invoiceDate }}</p>
                  </div>
                </div>

                <!-- Line Items Table -->
                <div class="line-items-section">
                  <h4>Line Items</h4>
                  <table class="table line-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th class="text-right">Hours</th>
                        <th class="text-right">Billing Rate (AED)</th>
                        <th class="text-right">Amount (AED)</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of selectedInvoice()?.lines; track line.id) {
                        <tr>
                          <td>
                            <div class="line-desc">{{ line.description }}</div>
                            @if (line.employeeName) {
                              <div class="line-sub">{{ line.employeeName }} ({{ line.employeeCode }})</div>
                            }
                          </td>
                          <td class="text-right font-mono">
                            {{ (line.hours > 0 ? line.hours : line.overtimeHours) | number:'1.2-2' }}
                          </td>
                          <td class="text-right font-mono">
                            {{ (line.hours > 0 ? line.rate : line.otRate) | number:'1.2-2' }}
                          </td>
                          <td class="text-right font-mono font-bold">
                            {{ line.amount | number:'1.2-2' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Financial Summary Box -->
                <div class="invoice-totals-box">
                  <div class="total-row">
                    <span>Subtotal:</span>
                    <span class="font-mono">AED {{ selectedInvoice()?.subtotal | number:'1.2-2' }}</span>
                  </div>
                  <div class="total-row">
                    <span>Tax (Not Enabled):</span>
                    <span class="font-mono">AED {{ selectedInvoice()?.taxAmount | number:'1.2-2' }}</span>
                  </div>
                  <div class="total-row grand-total">
                    <span>TOTAL AMOUNT:</span>
                    <span class="font-mono primary">AED {{ selectedInvoice()?.totalAmount | number:'1.2-2' }}</span>
                  </div>
                </div>

                @if (selectedInvoice()?.notes) {
                  <div class="invoice-notes">
                    <strong>Notes:</strong> {{ selectedInvoice()?.notes }}
                  </div>
                }
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="selectedInvoice.set(null)">
                  Close
                </button>
                @if (selectedInvoice()?.status === 'draft' && canIssueInvoice()) {
                  <button type="button" class="btn btn-primary" (click)="confirmIssue(selectedInvoice()!)">
                    <span class="material-symbols-outlined icon-sm">check_circle</span>
                    <span>Issue Invoice</span>
                  </button>
                }
              </div>
            </div>
          </div>
        }

        <!-- ISSUE CONFIRMATION MODAL -->
        @if (showIssueConfirm()) {
          <div class="modal-backdrop">
            <div class="modal-card modal-confirm">
              <div class="modal-header">
                <h3>Confirm Invoice Issuance</h3>
                <button class="modal-close" (click)="showIssueConfirm.set(false)">×</button>
              </div>
              <div class="modal-body">
                <div class="confirm-icon-box">
                  <span class="material-symbols-outlined icon-lg">receipt_long</span>
                </div>
                <h4 class="text-center">Issue invoice {{ invoiceToIssue()?.invoiceNumber }}?</h4>
                <p class="confirm-warning text-center">
                  Once issued, financial values should not be changed directly. This will permanently mark the invoice as ISSUED for client billing.
                </p>
                <div class="confirm-summary">
                  <div><strong>Total Amount:</strong> AED {{ invoiceToIssue()?.totalAmount | number:'1.2-2' }}</div>
                  <div><strong>Billing Period:</strong> {{ invoiceToIssue()?.billingPeriod }}</div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="showIssueConfirm.set(false)">
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-success"
                  [disabled]="submitting()"
                  (click)="executeIssue()"
                >
                  {{ submitting() ? 'Issuing...' : 'Confirm Issue Invoice' }}
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
      .invoices-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid var(--border-default, #e2e8f0);
        padding-bottom: 1.25rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .page-header h2 {
        margin: 0 0 0.25rem 0;
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--text-primary, #0f172a);
      }
      .subtitle {
        margin: 0;
        color: var(--text-secondary, #64748b);
        font-size: 0.8125rem;
      }
      .header-actions {
        display: flex;
        gap: 0.75rem;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .kpi-card {
        background: var(--color-surface, #ffffff);
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 10px;
        padding: 16px 20px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
      .kpi-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--color-text-muted, #64748b);
        margin-bottom: 6px;
      }
      .kpi-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--color-text-primary, #0f172a);
      }
      .kpi-value.warning { color: #f59e0b; }
      .kpi-value.success { color: #10b981; }
      .kpi-value.primary { color: #2563eb; }

      .alert {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
      }
      .alert-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .alert-danger {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
      }
      .alert-success {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
      }
      .alert-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: inherit;
      }

      .panel {
        background: var(--color-surface, #ffffff);
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
      .panel-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 20px;
        background: var(--color-surface-alt, #f8fafc);
        border-bottom: 1px solid var(--color-border, #e2e8f0);
      }
      .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: var(--color-text-primary, #0f172a);
      }
      .panel-meta {
        font-size: 13px;
        color: var(--color-text-muted, #64748b);
      }

      .table-responsive {
        overflow-x: auto;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .table th {
        background: #f8fafc;
        padding: 12px 16px;
        text-align: left;
        font-weight: 600;
        color: #475569;
        border-bottom: 1px solid #e2e8f0;
      }
      .table td {
        padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
        color: #1e293b;
      }
      .table tbody tr:hover {
        background: #f8fafc;
      }

      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .font-mono { font-family: monospace; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }

      .badge-period {
        background: #e0e7ff;
        color: #3730a3;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }
      .status-badge {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .status-badge.draft {
        background: #fef3c7;
        color: #92400e;
      }
      .status-badge.issued {
        background: #d1fae5;
        color: #065f46;
      }

      .action-buttons {
        display: flex;
        justify-content: center;
        gap: 6px;
      }
      .btn-action {
        background: none;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 4px;
        cursor: pointer;
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .btn-action:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .btn-action.btn-issue {
        border-color: #86efac;
        color: #16a34a;
      }
      .btn-action.btn-issue:hover {
        background: #dcfce7;
      }

      .empty-state {
        color: #64748b;
      }
      .empty-icon {
        font-size: 48px;
        color: #cbd5e1;
        margin-bottom: 8px;
      }

      /* Modal styles */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
      }
      .modal-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .modal-card.modal-lg {
        max-width: 800px;
      }
      .modal-card.modal-confirm {
        max-width: 480px;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
      }
      .modal-header h3 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
        color: #0f172a;
      }
      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #94a3b8;
      }
      .modal-body {
        padding: 20px 24px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .modal-footer {
        padding: 14px 24px;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .form-group.full-width {
        grid-column: 1 / -1;
      }
      .form-group label {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
      }
      .form-control {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 13px;
        color: #0f172a;
      }
      .form-control:focus {
        border-color: #3b82f6;
        outline: none;
      }
      .required { color: #dc2626; }
      .hint {
        font-size: 11px;
        color: #64748b;
      }

      .preview-box {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .preview-header h4 {
        margin: 0;
        font-size: 14px;
        color: #0369a1;
        font-weight: 700;
      }
      .preview-metrics {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        background: #ffffff;
        border: 1px solid #e0f2fe;
        border-radius: 6px;
        padding: 12px;
      }
      .metric {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .metric-label {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
      }
      .metric-val {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
      }
      .metric-val.primary {
        color: #0284c7;
        font-size: 16px;
      }
      .mini-table {
        width: 100%;
        font-size: 12px;
        border-collapse: collapse;
      }
      .mini-table th, .mini-table td {
        padding: 6px 8px;
        border-bottom: 1px solid #e0f2fe;
      }
      .mini-table th {
        background: #e0f2fe;
        color: #0369a1;
        font-weight: 600;
      }
      .tax-notice {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #0284c7;
        background: #e0f2fe;
        padding: 6px 10px;
        border-radius: 4px;
      }

      .invoice-header-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .invoice-meta-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        padding: 12px 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }
      .invoice-meta-grid label {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
      }
      .meta-value {
        margin: 4px 0 0 0;
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
      }
      .line-table th { background: #f1f5f9; }
      .line-desc { font-weight: 600; color: #0f172a; }
      .line-sub { font-size: 11px; color: #64748b; }
      .invoice-totals-box {
        align-self: flex-end;
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 16px;
        margin-top: 12px;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: #475569;
      }
      .total-row.grand-total {
        border-top: 1px solid #cbd5e1;
        padding-top: 8px;
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
      }
      .invoice-notes {
        background: #f8fafc;
        border-left: 3px solid #3b82f6;
        padding: 8px 12px;
        font-size: 12px;
        color: #334155;
      }

      .confirm-icon-box {
        text-align: center;
        color: #10b981;
        margin-bottom: 8px;
      }
      .confirm-icon-box .icon-lg { font-size: 48px; }
      .confirm-warning {
        font-size: 13px;
        color: #64748b;
        margin: 8px 0 16px 0;
      }
      .confirm-summary {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: none;
      }
      .btn-primary { background: #2563eb; color: #ffffff; }
      .btn-primary:hover { background: #1d4ed8; }
      .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
      .btn-secondary { background: #e2e8f0; color: #334155; }
      .btn-secondary:hover { background: #cbd5e1; }
      .btn-success { background: #10b981; color: #ffffff; }
      .btn-success:hover { background: #059669; }

      .spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        border-top-color: #3b82f6;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
  ]
})
export class ClientInvoicesComponent implements OnInit {
  public invoices = signal<InvoiceDto[]>([]);
  public loading = signal<boolean>(false);
  public submitting = signal<boolean>(false);
  public previewLoading = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public showGenerateModal = signal<boolean>(false);
  public showIssueConfirm = signal<boolean>(false);
  public selectedInvoice = signal<InvoiceDto | null>(null);
  public invoiceToIssue = signal<InvoiceDto | null>(null);

  public clients = signal<ClientDto[]>([]);
  public projects = signal<ProjectDto[]>([]);
  public previewData = signal<InvoicePreviewDto | null>(null);

  public generateDto: GenerateInvoiceDto = {
    clientId: '',
    projectId: '',
    billingPeriod: '2026-08',
    notes: '',
  };

  public draftCount = computed(() => this.invoices().filter((i) => i.status === 'draft').length);
  public issuedCount = computed(() => this.invoices().filter((i) => i.status === 'issued').length);
  public totalIssuedAmount = computed(() =>
    this.invoices()
      .filter((i) => i.status === 'issued')
      .reduce((sum, i) => sum + Number(i.totalAmount || 0), 0)
  );

  public availableProjects = computed(() => {
    const cid = this.generateDto.clientId;
    if (!cid) return [];
    return this.projects().filter((p) => p.clientId === cid);
  });

  constructor(
    private invoiceService: InvoiceService,
    private masterService: MasterService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
    this.loadMasters();
  }

  public canCreateInvoice(): boolean {
    return this.authService.hasPermission('invoices:create') || this.authService.hasRole('super_admin');
  }

  public canIssueInvoice(): boolean {
    return this.authService.hasPermission('invoices:issue') || this.authService.hasRole('super_admin');
  }

  public loadInvoices(): void {
    this.loading.set(true);
    this.invoiceService.listInvoices().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.invoices.set(res.data || []);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load invoices.');
      },
    });
  }

  public loadMasters(): void {
    this.masterService.getClients().subscribe({
      next: (res: any) => this.clients.set(res.data || []),
      error: (err: any) => console.error('Error loading clients:', err),
    });
    this.masterService.getProjects().subscribe({
      next: (res: any) => this.projects.set(res.data || []),
      error: (err: any) => console.error('Error loading projects:', err),
    });
  }

  public openGenerateModal(): void {
    this.generateDto = {
      clientId: '',
      projectId: '',
      billingPeriod: '2026-08',
      notes: '',
    };
    this.previewData.set(null);
    this.showGenerateModal.set(true);
  }

  public closeGenerateModal(): void {
    this.showGenerateModal.set(false);
    this.previewData.set(null);
  }

  public onClientSelected(): void {
    this.generateDto.projectId = '';
    this.previewData.set(null);
  }

  public fetchPreview(): void {
    if (!this.generateDto.clientId || !this.generateDto.projectId || !this.generateDto.billingPeriod) {
      return;
    }

    this.previewLoading.set(true);
    this.invoiceService.previewInvoice(this.generateDto).subscribe({
      next: (res) => {
        this.previewLoading.set(false);
        this.previewData.set(res.data);
      },
      error: (err) => {
        this.previewLoading.set(false);
        this.previewData.set(null);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to preview invoice calculation.');
      },
    });
  }

  public canSubmitGeneration(): boolean {
    return (
      !!this.generateDto.clientId &&
      !!this.generateDto.projectId &&
      !!this.generateDto.billingPeriod &&
      !!this.previewData() &&
      Number(this.previewData()?.totalAmount || 0) > 0
    );
  }

  public submitGenerate(): void {
    if (!this.canSubmitGeneration()) return;

    this.submitting.set(true);
    this.invoiceService.generateInvoice(this.generateDto).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.closeGenerateModal();
        this.successMessage.set(`Invoice ${res.data.invoiceNumber} created in DRAFT status for AED ${Number(res.data.totalAmount).toFixed(2)}.`);
        this.loadInvoices();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to generate invoice.');
      },
    });
  }

  public viewInvoice(invoice: InvoiceDto): void {
    this.invoiceService.getInvoice(invoice.id).subscribe({
      next: (res) => {
        this.selectedInvoice.set(res.data);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load invoice details.');
      },
    });
  }

  public confirmIssue(invoice: InvoiceDto): void {
    this.invoiceToIssue.set(invoice);
    this.showIssueConfirm.set(true);
  }

  public executeIssue(): void {
    const inv = this.invoiceToIssue();
    if (!inv) return;

    this.submitting.set(true);
    this.invoiceService.issueInvoice(inv.id).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.showIssueConfirm.set(false);
        this.invoiceToIssue.set(null);
        if (this.selectedInvoice()?.id === inv.id) {
          this.selectedInvoice.set(res.data);
        }
        this.successMessage.set(`Invoice ${res.data.invoiceNumber} successfully ISSUED and finalized.`);
        this.loadInvoices();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to issue invoice.');
      },
    });
  }
}
