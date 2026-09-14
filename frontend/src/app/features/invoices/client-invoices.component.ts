import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InvoiceService } from '../../core/services/invoice.service';
import { MasterService } from '../../core/services/master.service';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService } from '../../core/services/payment.service';
import { TimesheetApiService } from '../../core/services/timesheet-api.service';
import {
  InvoiceDto,
  GenerateInvoiceDto,
  InvoicePreviewDto,
  ClientDto,
  ProjectDto,
  TimesheetDesignationFilterDto,
  PaymentDto,
  PaymentMethod,
  InvoicePaymentSummaryDto,
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
              Generate and manage commercial client invoices from approved timesheets and verified point-in-time billing rates.
            </p>
          </div>
          <div class="header-actions">
            @if (canCreateInvoice()) {
              <button class="btn btn-primary" (click)="openGenerateOffcanvas()">
                <span class="material-symbols-outlined icon-sm">add</span>
                <span>Generate Invoice</span>
              </button>
            }
            <button class="btn btn-secondary" (click)="loadInvoices()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- Sensible KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card" (click)="filterStatus.set('all')" [class.active-card]="filterStatus() === 'all'">
            <div class="kpi-label">Total Invoices</div>
            <div class="kpi-value">{{ invoices().length }}</div>
          </div>
          <div class="kpi-card" (click)="filterStatus.set('draft')" [class.active-card]="filterStatus() === 'draft'">
            <div class="kpi-label">Draft / Pending</div>
            <div class="kpi-value warning">{{ draftCount() }}</div>
          </div>
          <div class="kpi-card" (click)="filterStatus.set('approved')" [class.active-card]="filterStatus() === 'approved'">
            <div class="kpi-label">Approved Invoices</div>
            <div class="kpi-value success">{{ approvedCount() }}</div>
          </div>
          <div class="kpi-card" (click)="filterStatus.set('issued')" [class.active-card]="filterStatus() === 'issued'">
            <div class="kpi-label">Issued Invoices</div>
            <div class="kpi-value primary">{{ issuedCount() }}</div>
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

        <!-- Filter & Search Bar -->
        <div class="filter-bar">
          <div class="filter-group">
            <label>Status</label>
            <select class="form-control form-control-sm" [(ngModel)]="filterStatus">
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="issued">Issued</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Client</label>
            <select class="form-control form-control-sm" [(ngModel)]="filterClientId">
              <option value="">All Clients</option>
              @for (c of clients(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>

          <div class="filter-group">
            <label>Project</label>
            <select class="form-control form-control-sm" [(ngModel)]="filterProjectId">
              <option value="">All Projects</option>
              @for (p of filteredProjectsList(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </div>

          <div class="filter-group">
            <label>Billing Month</label>
            <input
              type="text"
              class="form-control form-control-sm"
              [(ngModel)]="filterPeriod"
              placeholder="e.g. 2026-09"
            />
          </div>

          @if (filterStatus() !== 'all' || filterClientId() || filterProjectId() || filterPeriod()) {
            <button class="btn btn-text btn-sm" (click)="clearFilters()">
              <span class="material-symbols-outlined icon-xs">close</span>
              <span>Reset</span>
            </button>
          }
        </div>

        <!-- Invoices List Panel -->
        <div class="panel">
          <div class="panel-bar">
            <div class="panel-title">
              <span class="material-symbols-outlined">receipt_long</span>
              <span>Commercial Client Invoices</span>
            </div>
            <div class="panel-meta">
              <span>Showing {{ filteredInvoices().length }} of {{ invoices().length }} invoice(s)</span>
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
                  <th class="text-center">Workforce</th>
                  <th class="text-right">Reg Hrs</th>
                  <th class="text-right">OT Hrs</th>
                  <th class="text-right">Total (AED)</th>
                  <th class="text-right">Paid (AED)</th>
                  <th class="text-right">Balance Due</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr>
                    <td colspan="14" class="text-center py-4">
                      <div class="spinner"></div>
                      <p class="text-muted mt-2">Loading commercial invoices...</p>
                    </td>
                  </tr>
                } @else if (filteredInvoices().length === 0) {
                  <tr>
                    <td colspan="14" class="text-center py-5 empty-state">
                      <span class="material-symbols-outlined empty-icon">request_quote</span>
                      <h4>No Invoices Found</h4>
                      <p class="text-muted">No commercial client invoices match the current criteria.</p>
                      @if (canCreateInvoice()) {
                        <button class="btn btn-primary btn-sm mt-3" (click)="openGenerateOffcanvas()">
                          Generate Invoice
                        </button>
                      }
                    </td>
                  </tr>
                } @else {
                  @for (inv of filteredInvoices(); track inv.id) {
                    <tr>
                      <td class="font-mono font-semibold clickable" (click)="viewInvoice(inv)">
                        {{ inv.invoiceNumber }}
                      </td>
                      <td>{{ inv.clientName || '—' }}</td>
                      <td>{{ inv.projectName || '—' }}</td>
                      <td>
                        <span class="badge badge-period">{{ inv.billingPeriod }}</span>
                      </td>
                      <td>{{ inv.invoiceDate }}</td>
                      <td class="text-center font-mono font-semibold">{{ inv.workforceCount || '—' }}</td>
                      <td class="text-right font-mono">{{ inv.totalRegularHours !== undefined ? (inv.totalRegularHours | number:'1.1-1') : '—' }}</td>
                      <td class="text-right font-mono">{{ inv.totalOtHours !== undefined ? (inv.totalOtHours | number:'1.1-1') : '—' }}</td>
                      <td class="text-right font-mono font-bold">{{ inv.totalAmount | number:'1.2-2' }}</td>
                      <td class="text-right font-mono text-success">
                        {{ inv.status === 'issued' ? ((inv.paidAmount || 0) | number:'1.2-2') : '—' }}
                      </td>
                      <td class="text-right font-mono font-bold" [class.text-danger]="inv.status === 'issued' && (inv.outstandingAmount || 0) > 0">
                        {{ inv.status === 'issued' ? ((inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.totalAmount) | number:'1.2-2') : '—' }}
                      </td>
                      <td>
                        @if (inv.status === 'issued') {
                          <span class="status-badge" [ngClass]="inv.paymentStatus || 'UNPAID'">
                            {{ (inv.paymentStatus || 'UNPAID').replace('_', ' ') }}
                          </span>
                        } @else {
                          <span class="text-muted font-italic text-xs">—</span>
                        }
                      </td>
                      <td>
                        <span class="status-badge" [ngClass]="inv.status">
                          {{ inv.status | uppercase }}
                        </span>
                      </td>
                      <td class="text-center">
                        <div class="action-buttons">
                          <button class="btn-action" title="View Full Offcanvas Details" (click)="viewInvoice(inv)">
                            <span class="material-symbols-outlined">visibility</span>
                          </button>
                          @if (inv.status === 'issued' && (inv.outstandingAmount === undefined || inv.outstandingAmount > 0) && canRecordPayment()) {
                            <button
                              class="btn-action btn-pay"
                              title="Record Payment"
                              (click)="openRecordPaymentDrawer(inv)"
                            >
                              <span class="material-symbols-outlined">add_card</span>
                            </button>
                          }
                          @if (inv.status === 'draft' && canApproveOrIssue()) {
                            <button class="btn-action btn-approve" title="Approve Invoice" (click)="quickApprove(inv)">
                              <span class="material-symbols-outlined">thumb_up</span>
                            </button>
                            <button class="btn-action btn-reject" title="Reject Invoice" (click)="openRejectModal(inv)">
                              <span class="material-symbols-outlined">cancel</span>
                            </button>
                          }
                          @if (inv.status === 'approved' && canApproveOrIssue()) {
                            <button class="btn-action btn-issue" title="Issue Final Invoice" (click)="quickIssue(inv)">
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

        <!-- ========================================================= -->
        <!-- CONTEXTUAL OFFCANVAS DRAWER: GENERATE INVOICE -->
        <!-- ========================================================= -->
        @if (activeDrawer() === 'generate') {
          <div class="offcanvas-backdrop" (click)="closeDrawer()"></div>
          <aside class="offcanvas-panel" role="dialog" aria-modal="true">
            <div class="offcanvas-header">
              <div class="offcanvas-header-left">
                <div class="offcanvas-icon-pill">
                  <span class="material-symbols-outlined">receipt_long</span>
                </div>
                <div>
                  <h2 class="offcanvas-title">Generate Client Invoice</h2>
                  <p class="offcanvas-subtitle">Calculate billable regular and overtime hours directly from verified timesheets</p>
                </div>
              </div>
              <button type="button" class="btn-offcanvas-close" (click)="closeDrawer()" title="Close Drawer">×</button>
            </div>

            <div class="offcanvas-body">
              <div class="form-grid">
                <div class="form-group">
                  <label>Client <span class="required">*</span></label>
                  <select
                    class="form-control"
                    [(ngModel)]="generateDto.clientId"
                    (change)="onClientSelected()"
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
                    (change)="onProjectSelected()"
                    [disabled]="!generateDto.clientId"
                  >
                    <option value="" disabled selected>-- Select Project --</option>
                    @for (p of availableProjects(); track p.id) {
                      <option [value]="p.id">{{ p.name }} ({{ p.code }})</option>
                    }
                  </select>
                </div>

                <div class="form-group">
                  <label>Designation Filter (Optional)</label>
                  <select
                    class="form-control"
                    [(ngModel)]="generateDto.designationId"
                    (change)="fetchPreview()"
                    [disabled]="!generateDto.projectId"
                  >
                    <option value="">All Designations (Consolidated Project Invoice)</option>
                    @for (d of projectDesignations(); track d.id) {
                      <option [value]="d.id">{{ d.title }} ({{ d.code }})</option>
                    }
                  </select>
                  <span class="hint">Filter billing strictly to a specific project designation/trade</span>
                </div>

                <div class="form-group">
                  <label>Billing Month <span class="required">*</span></label>
                  <input
                    type="month"
                    class="form-control"
                    [(ngModel)]="generateDto.billingPeriod"
                    (change)="fetchPreview()"
                  />
                  <span class="hint">Select the billing month and year</span>
                </div>

                <div class="form-group">
                  <label>Source Engine</label>
                  <input
                    type="text"
                    class="form-control"
                    value="HRMS Timesheet & Attendance (Verified)"
                    disabled
                  />
                </div>

                <div class="form-group full-width">
                  <label>Commercial Notes (Optional)</label>
                  <textarea
                    class="form-control"
                    rows="2"
                    [(ngModel)]="generateDto.notes"
                    placeholder="Optional notes or contractual references printed on the invoice..."
                  ></textarea>
                </div>
              </div>

              <!-- LIVE BILLING PREVIEW -->
              <div class="mt-3">
                @if (previewLoading()) {
                  <div class="preview-loading">
                    <div class="spinner"></div>
                    <span>Consolidating timesheet hours and resolving official billing rates...</span>
                  </div>
                } @else if (previewData()) {
                  <div class="preview-box">
                    <div class="preview-header">
                      <div class="preview-title-wrap">
                        <span class="material-symbols-outlined icon-sm">calculate</span>
                        <h4>Commercial Billing Calculation</h4>
                      </div>
                      <span class="badge badge-success">Backend Point-in-Time Verified</span>
                    </div>

                    <!-- Metric Cards -->
                    <div class="preview-metrics">
                      <div class="metric">
                        <span class="metric-label">Certified Workforce</span>
                        <span class="metric-val">{{ previewData()?.billableEmployeesCount }} Workers</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Total Regular Hrs</span>
                        <span class="metric-val">{{ previewData()?.totalRegularHours }} hrs</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Total Overtime Hrs</span>
                        <span class="metric-val">{{ previewData()?.totalOtHours }} hrs</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Subtotal</span>
                        <span class="metric-val">AED {{ previewData()?.subtotal | number:'1.2-2' }}</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Tax / VAT</span>
                        <span class="metric-val">AED {{ previewData()?.taxAmount | number:'1.2-2' }}</span>
                      </div>
                      <div class="metric highlight">
                        <span class="metric-label">Consolidated Total</span>
                        <span class="metric-val primary">AED {{ previewData()?.totalAmount | number:'1.2-2' }}</span>
                      </div>
                    </div>

                    <!-- Section 2: Timesheet & Billing Annexure -->
                    @if (previewData()?.items && previewData()!.items.length > 0) {
                      <div class="annexure-section">
                        <div class="annexure-header">
                          <span class="material-symbols-outlined icon-sm">groups</span>
                          <h5>Timesheet & Billing Annexure (Employee Breakdown)</h5>
                        </div>
                        <div class="table-responsive mini-table-container">
                          <table class="mini-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Emp ID</th>
                                <th>Employee Name</th>
                                <th>Trade / Role</th>
                                <th class="text-right">Reg Hrs</th>
                                <th class="text-right">Rate</th>
                                <th class="text-right">Reg Amount</th>
                                <th class="text-right">OT Hrs</th>
                                <th class="text-right">OT Rate</th>
                                <th class="text-right">OT Amount</th>
                                <th class="text-right">Total (AED)</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (item of previewData()!.items; track item.employeeId; let idx = $index) {
                                <tr>
                                  <td>{{ idx + 1 }}</td>
                                  <td class="font-mono">{{ item.employeeCode }}</td>
                                  <td class="font-semibold">{{ item.employeeName }}</td>
                                  <td>
                                    <span class="badge badge-subtle">{{ item.designationTitle }}</span>
                                  </td>
                                  <td class="text-right font-mono">{{ item.regularHours | number:'1.1-1' }}</td>
                                  <td class="text-right font-mono">{{ item.regularRate | number:'1.2-2' }}</td>
                                  <td class="text-right font-mono">{{ item.regularAmount | number:'1.2-2' }}</td>
                                  <td class="text-right font-mono">{{ item.otHours | number:'1.1-1' }}</td>
                                  <td class="text-right font-mono">{{ item.otRate | number:'1.2-2' }}</td>
                                  <td class="text-right font-mono">{{ item.otAmount | number:'1.2-2' }}</td>
                                  <td class="text-right font-mono font-bold primary-text">
                                    {{ item.totalAmount | number:'1.2-2' }}
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      </div>
                    }

                    <div class="tax-notice">
                      <span class="material-symbols-outlined icon-xs">info</span>
                      <span>{{ previewData()?.taxNotice }} Tax configuration is not enabled (AED 0.00).</span>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="offcanvas-footer">
              <button type="button" class="btn btn-secondary" (click)="closeDrawer()">
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="!canSubmitGeneration() || submitting()"
                (click)="submitGenerateDraft()"
              >
                <span class="material-symbols-outlined icon-sm">receipt</span>
                <span>{{ submitting() ? 'Creating Draft...' : 'Generate Draft Invoice' }}</span>
              </button>
            </div>
          </aside>
        }

        <!-- ========================================================= -->
        <!-- CONTEXTUAL OFFCANVAS DRAWER: INVOICE DETAILS & LIFECYCLE -->
        <!-- ========================================================= -->
        @if (activeDrawer() === 'detail' && selectedInvoice()) {
          <div class="offcanvas-backdrop" (click)="closeDrawer()"></div>
          <aside class="offcanvas-panel" role="dialog" aria-modal="true">
            <div class="offcanvas-header">
              <div class="offcanvas-header-left">
                <div class="offcanvas-icon-pill">
                  <span class="material-symbols-outlined">receipt</span>
                </div>
                <div>
                  <div class="d-flex align-center gap-2">
                    <h2 class="offcanvas-title">{{ selectedInvoice()?.invoiceNumber }}</h2>
                    <span class="status-badge" [ngClass]="selectedInvoice()?.status">
                      {{ selectedInvoice()?.status | uppercase }}
                    </span>
                  </div>
                  <p class="offcanvas-subtitle">{{ selectedInvoice()?.clientName }} — {{ selectedInvoice()?.projectName }}</p>
                </div>
              </div>
              <div class="d-flex gap-2 align-center">
                <button class="btn btn-secondary btn-sm" (click)="openPrintPreview(selectedInvoice()!)" title="Printable Representation">
                  <span class="material-symbols-outlined icon-xs">print</span>
                  <span>Print / PDF</span>
                </button>
                <button type="button" class="btn-offcanvas-close" (click)="closeDrawer()" title="Close Drawer">×</button>
              </div>
            </div>

            <div class="offcanvas-body">
              <!-- LIFECYCLE BANNER -->
              @if (selectedInvoice()?.status === 'draft') {
                <div class="banner banner-draft">
                  <span class="material-symbols-outlined banner-icon">edit_document</span>
                  <div>
                    <strong>Draft Invoice Pending Review</strong>
                    <p>Review the commercial summary and workforce Annexure. Once verified, click <strong>Approve Invoice</strong>. Drafts cannot be issued directly.</p>
                  </div>
                </div>
              } @else if (selectedInvoice()?.status === 'approved') {
                <div class="banner banner-approved">
                  <span class="material-symbols-outlined banner-icon">verified</span>
                  <div>
                    <strong>Invoice Approved</strong>
                    <p>Approved on {{ selectedInvoice()?.approvedAt | date:'mediumDate' }}
                      @if (selectedInvoice()?.approvedByUser) {
                        by {{ selectedInvoice()?.approvedByUser?.firstName }} {{ selectedInvoice()?.approvedByUser?.lastName }}
                      }.
                      Ready to be finalized and <strong>Issued</strong>.
                    </p>
                  </div>
                </div>
              } @else if (selectedInvoice()?.status === 'rejected') {
                <div class="banner banner-rejected">
                  <span class="material-symbols-outlined banner-icon">cancel</span>
                  <div>
                    <strong>Invoice Rejected</strong>
                    <p>
                      Rejected on {{ selectedInvoice()?.rejectedAt | date:'mediumDate' }}
                      @if (selectedInvoice()?.rejectedByUser) {
                        by {{ selectedInvoice()?.rejectedByUser?.firstName }} {{ selectedInvoice()?.rejectedByUser?.lastName }}:
                      }
                      <em>"{{ selectedInvoice()?.rejectionReason }}"</em>
                    </p>
                  </div>
                </div>
              } @else if (selectedInvoice()?.status === 'issued') {
                <div class="banner banner-issued">
                  <span class="material-symbols-outlined banner-icon">lock</span>
                  <div>
                    <strong>Final Issued Invoice</strong>
                    <p>Issued on {{ selectedInvoice()?.issuedAt | date:'mediumDate' }}
                      @if (selectedInvoice()?.issuedByUser) {
                        by {{ selectedInvoice()?.issuedByUser?.firstName }} {{ selectedInvoice()?.issuedByUser?.lastName }}
                      }.
                      Values are permanently locked for client accounting.
                    </p>
                  </div>
                </div>
              }

              <!-- SECTION 1: COMMERCIAL INVOICE SUMMARY -->
              <div class="section-card">
                <div class="section-card-header">
                  <span class="material-symbols-outlined">domain</span>
                  <h4>Section 1: Commercial Summary</h4>
                </div>
                <div class="invoice-meta-grid">
                  <div>
                    <label>Client</label>
                    <p class="meta-value">{{ selectedInvoice()?.clientName }}</p>
                    <span class="meta-sub">{{ selectedInvoice()?.clientCode }}</span>
                  </div>
                  <div>
                    <label>Project</label>
                    <p class="meta-value">{{ selectedInvoice()?.projectName }}</p>
                    <span class="meta-sub">{{ selectedInvoice()?.projectCode }}</span>
                  </div>
                  <div>
                    <label>Billing Period</label>
                    <p class="meta-value font-mono">{{ selectedInvoice()?.billingPeriod }}</p>
                  </div>
                  <div>
                    <label>Invoice Date</label>
                    <p class="meta-value">{{ selectedInvoice()?.invoiceDate }}</p>
                  </div>
                  <div>
                    <label>Due Date</label>
                    <p class="meta-value font-mono">
                      @if (selectedInvoice()?.dueDate) {
                        {{ selectedInvoice()?.dueDate }}
                      } @else {
                        <span class="text-muted font-italic">Not Set</span>
                      }
                    </p>
                  </div>
                </div>

                <!-- Financial Metrics -->
                <div class="preview-metrics mt-3">
                  <div class="metric">
                    <span class="metric-label">Workforce Count</span>
                    <span class="metric-val">{{ selectedInvoice()?.workforceCount || selectedInvoice()?.annexureItems?.length || 0 }} Workers</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Regular Hours</span>
                    <span class="metric-val">{{ selectedInvoice()?.totalRegularHours !== undefined ? (selectedInvoice()?.totalRegularHours | number:'1.1-1') : '—' }} hrs</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Overtime Hours</span>
                    <span class="metric-val">{{ selectedInvoice()?.totalOtHours !== undefined ? (selectedInvoice()?.totalOtHours | number:'1.1-1') : '—' }} hrs</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Subtotal</span>
                    <span class="metric-val">AED {{ selectedInvoice()?.subtotal | number:'1.2-2' }}</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Tax Amount</span>
                    <span class="metric-val">AED {{ selectedInvoice()?.taxAmount | number:'1.2-2' }}</span>
                  </div>
                  <div class="metric highlight">
                    <span class="metric-label">Total Amount</span>
                    <span class="metric-val primary">AED {{ selectedInvoice()?.totalAmount | number:'1.2-2' }}</span>
                  </div>
                </div>

                @if (selectedInvoice()?.notes) {
                  <div class="invoice-notes mt-2">
                    <strong>Commercial Notes:</strong> {{ selectedInvoice()?.notes }}
                  </div>
                }
              </div>

              <!-- SECTION 2: TIMESHEET & BILLING ANNEXURE -->
              <div class="section-card mt-3">
                <div class="section-card-header">
                  <span class="material-symbols-outlined">assignment</span>
                  <h4>Section 2: Timesheet & Billing Annexure</h4>
                </div>

                <div class="table-responsive mini-table-container">
                  <table class="mini-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Emp ID</th>
                        <th>Employee Name</th>
                        <th>Trade / Role</th>
                        <th class="text-right">Reg Hrs</th>
                        <th class="text-right">Rate</th>
                        <th class="text-right">Reg Amount</th>
                        <th class="text-right">OT Hrs</th>
                        <th class="text-right">OT Rate</th>
                        <th class="text-right">OT Amount</th>
                        <th class="text-right">Total (AED)</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of selectedInvoice()?.annexureItems; track item.employeeId; let idx = $index) {
                        <tr>
                          <td>{{ idx + 1 }}</td>
                          <td class="font-mono">{{ item.employeeCode }}</td>
                          <td class="font-semibold">{{ item.employeeName }}</td>
                          <td>
                            <span class="badge badge-subtle">{{ item.designationTitle }}</span>
                          </td>
                          <td class="text-right font-mono">{{ item.regularHours | number:'1.1-1' }}</td>
                          <td class="text-right font-mono">{{ item.regularRate | number:'1.2-2' }}</td>
                          <td class="text-right font-mono">{{ item.regularAmount | number:'1.2-2' }}</td>
                          <td class="text-right font-mono">{{ item.otHours | number:'1.1-1' }}</td>
                          <td class="text-right font-mono">{{ item.otRate | number:'1.2-2' }}</td>
                          <td class="text-right font-mono">{{ item.otAmount | number:'1.2-2' }}</td>
                          <td class="text-right font-mono font-bold primary-text">
                            {{ item.totalAmount | number:'1.2-2' }}
                          </td>
                        </tr>
                      } @empty {
                        @for (line of selectedInvoice()?.lines; track line.id) {
                          <tr>
                            <td>•</td>
                            <td class="font-mono">{{ line.employeeCode || '—' }}</td>
                            <td class="font-semibold">{{ line.employeeName || line.description }}</td>
                            <td>{{ line.designationTitle || '—' }}</td>
                            <td class="text-right font-mono">{{ line.hours | number:'1.1-1' }}</td>
                            <td class="text-right font-mono">{{ line.rate | number:'1.2-2' }}</td>
                            <td class="text-right font-mono">{{ (line.hours * line.rate) | number:'1.2-2' }}</td>
                            <td class="text-right font-mono">{{ line.overtimeHours | number:'1.1-1' }}</td>
                            <td class="text-right font-mono">{{ line.otRate | number:'1.2-2' }}</td>
                            <td class="text-right font-mono">{{ (line.overtimeHours * line.otRate) | number:'1.2-2' }}</td>
                            <td class="text-right font-mono font-bold">{{ line.amount | number:'1.2-2' }}</td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
              </div>
              <!-- SECTION 3: PAYMENTS & RECEIVABLES LEDGER (FOR ISSUED INVOICES) -->
              @if (selectedInvoice()?.status === 'issued') {
                <div class="section-card mt-3">
                  <div class="section-card-header d-flex justify-between align-center">
                    <div class="d-flex align-center gap-2">
                      <span class="material-symbols-outlined">payments</span>
                      <h4>Section 3: Payment Summary & Collections</h4>
                    </div>
                    @if ((selectedInvoice()?.outstandingAmount || 0) > 0 && canRecordPayment()) {
                      <button class="btn btn-primary btn-sm" (click)="openRecordPaymentDrawer(selectedInvoice()!)">
                        <span class="material-symbols-outlined icon-xs">add_card</span>
                        <span>Record Payment</span>
                      </button>
                    }
                  </div>

                  <!-- Financial Metrics Grid -->
                  <div class="preview-metrics mb-3">
                    <div class="metric">
                      <span class="metric-label">Invoice Total</span>
                      <span class="metric-val font-mono">AED {{ selectedInvoice()?.totalAmount | number:'1.2-2' }}</span>
                    </div>
                    <div class="metric">
                      <span class="metric-label">Total Paid</span>
                      <span class="metric-val text-success font-mono">AED {{ (selectedInvoice()?.paidAmount || 0) | number:'1.2-2' }}</span>
                    </div>
                    <div class="metric highlight">
                      <span class="metric-label">Current Balance Due</span>
                      <span class="metric-val font-mono font-bold" [class.text-danger]="(selectedInvoice()?.outstandingAmount || 0) > 0" [class.text-success]="(selectedInvoice()?.outstandingAmount || 0) === 0">
                        AED {{ (selectedInvoice()?.outstandingAmount !== undefined ? selectedInvoice()?.outstandingAmount : selectedInvoice()?.totalAmount) | number:'1.2-2' }}
                      </span>
                    </div>
                  </div>

                  <!-- Transactions Table -->
                  <div class="history-table-wrap">
                    <h5 class="mb-2 font-semibold text-sm">Payment Transactions</h5>
                    @if (invoicePaymentLoading()) {
                      <div class="text-center py-3">
                        <div class="spinner"></div>
                        <p class="text-muted text-xs mt-1">Loading payment history...</p>
                      </div>
                    } @else if (invoicePayments().length === 0) {
                      <div class="empty-state py-3 text-center border-dashed rounded">
                        <p class="text-muted text-xs mb-0">No payment receipts recorded yet for this issued invoice.</p>
                      </div>
                    } @else {
                      <div class="table-responsive mini-table-container">
                        <table class="mini-table">
                          <thead>
                            <tr>
                              <th>Payment #</th>
                              <th>Date</th>
                              <th>Method</th>
                              <th>Reference #</th>
                              <th class="text-right">Amount (AED)</th>
                              <th>Status</th>
                              <th>Recorded By</th>
                              <th class="text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (p of invoicePayments(); track p.id) {
                              <tr [class.reversed-row]="p.status === 'REVERSED'">
                                <td class="font-mono font-semibold">{{ p.paymentNumber }}</td>
                                <td>{{ p.paymentDate }}</td>
                                <td>{{ p.paymentMethod }}</td>
                                <td>{{ p.referenceNumber || '—' }}</td>
                                <td class="text-right font-mono font-semibold" [class.strikethrough]="p.status === 'REVERSED'">
                                  {{ p.amount | number:'1.2-2' }}
                                </td>
                                <td>
                                  <span class="status-badge" [ngClass]="p.status">
                                    {{ p.status }}
                                  </span>
                                </td>
                                <td>{{ p.recordedByName || 'System' }}</td>
                                <td class="text-center">
                                  @if (p.status === 'RECORDED' && canReversePayment()) {
                                    <button
                                      class="btn-action btn-reject"
                                      title="Reverse Payment"
                                      (click)="openReversalModal(p)"
                                    >
                                      <span class="material-symbols-outlined">undo</span>
                                    </button>
                                  } @else if (p.status === 'REVERSED') {
                                    <span class="badge badge-info" [title]="'Reason: ' + p.reversalReason">
                                      Reason logged
                                    </span>
                                  }
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- OFFCANVAS ACTIONS FOOTER -->
            <div class="offcanvas-footer">
              <button type="button" class="btn btn-secondary" (click)="closeDrawer()">
                Close
              </button>

              @if (selectedInvoice()?.status === 'issued' && (selectedInvoice()?.outstandingAmount === undefined || selectedInvoice()?.outstandingAmount! > 0) && canRecordPayment()) {
                <button
                  type="button"
                  class="btn btn-primary"
                  (click)="openRecordPaymentDrawer(selectedInvoice()!)"
                >
                  <span class="material-symbols-outlined icon-sm">add_card</span>
                  <span>Record Payment</span>
                </button>
              }

              @if (selectedInvoice()?.status === 'draft' && canApproveOrIssue()) {
                <button
                  type="button"
                  class="btn btn-danger"
                  [disabled]="submitting()"
                  (click)="openRejectModal(selectedInvoice()!)"
                >
                  <span class="material-symbols-outlined icon-sm">cancel</span>
                  <span>Reject Invoice</span>
                </button>
                <button
                  type="button"
                  class="btn btn-success"
                  [disabled]="submitting()"
                  (click)="executeApprove(selectedInvoice()!)"
                >
                  <span class="material-symbols-outlined icon-sm">thumb_up</span>
                  <span>{{ submitting() ? 'Approving...' : 'Approve Invoice' }}</span>
                </button>
              }

              @if (selectedInvoice()?.status === 'approved' && canApproveOrIssue()) {
                <button
                  type="button"
                  class="btn btn-danger"
                  [disabled]="submitting()"
                  (click)="openRejectModal(selectedInvoice()!)"
                >
                  <span class="material-symbols-outlined icon-sm">cancel</span>
                  <span>Reject Invoice</span>
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  [disabled]="submitting()"
                  (click)="executeIssue(selectedInvoice()!)"
                >
                  <span class="material-symbols-outlined icon-sm">check_circle</span>
                  <span>{{ submitting() ? 'Issuing...' : 'Issue Invoice' }}</span>
                </button>
              }
            </div>
          </aside>
        }

        <!-- ========================================================= -->
        <!-- REJECT INVOICE MODAL -->
        <!-- ========================================================= -->
        @if (showRejectModal()) {
          <div class="modal-backdrop">
            <div class="modal-card modal-confirm">
              <div class="modal-header">
                <h3>Reject Invoice</h3>
                <button class="modal-close" (click)="showRejectModal.set(false)">×</button>
              </div>
              <div class="modal-body">
                <div class="confirm-icon-box text-danger">
                  <span class="material-symbols-outlined icon-lg">error</span>
                </div>
                <h4 class="text-center">Reject invoice {{ invoiceToReject()?.invoiceNumber }}?</h4>
                <p class="confirm-warning text-center">
                  A rejected invoice cannot be issued. Please state the clear business reason for rejection.
                </p>

                <div class="form-group">
                  <label>Rejection Reason <span class="required">*</span></label>
                  <textarea
                    class="form-control"
                    rows="3"
                    [(ngModel)]="rejectionReasonInput"
                    placeholder="e.g. Mismatched overtime hours in timesheet; please adjust and regenerate."
                  ></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="showRejectModal.set(false)">
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-danger"
                  [disabled]="!rejectionReasonInput.trim() || submitting()"
                  (click)="executeReject()"
                >
                  {{ submitting() ? 'Rejecting...' : 'Confirm Rejection' }}
                </button>
              </div>
            </div>
          </div>
        }

        <!-- ========================================================= -->
        <!-- PRINT / PDF TWO-PAGE PREVIEW MODAL -->
        <!-- ========================================================= -->
        @if (showPrintPreview() && invoiceForPrint()) {
          <div class="modal-backdrop print-modal-backdrop">
            <div class="modal-card print-modal-card">
              <div class="modal-header no-print">
                <div class="d-flex align-center gap-2">
                  <span class="material-symbols-outlined">print</span>
                  <h3>Printable Commercial Invoice & Timesheet Annexure</h3>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-primary btn-sm" (click)="triggerBrowserPrint()">
                    <span class="material-symbols-outlined icon-xs">print</span>
                    <span>Print Document</span>
                  </button>
                  <button class="modal-close" (click)="showPrintPreview.set(false)">×</button>
                </div>
              </div>

              <div class="modal-body print-document-body" id="printableInvoiceDoc">
                <!-- PAGE 1: COMMERCIAL INVOICE -->
                <div class="print-page print-page-1">
                  <div class="print-header">
                    <div class="brand-section">
                      <h1 class="company-logo">BLUE ROYAL</h1>
                      <p class="company-subtitle">MANPOWER SUPPLY & HUMAN RESOURCE SOLUTIONS</p>
                      <p class="company-address">Dubai, United Arab Emirates • info&#64;blueroyal.ae</p>
                    </div>
                    <div class="invoice-title-block">
                      <h2 class="doc-title">TAX INVOICE</h2>
                      <div class="doc-meta-row">
                        <span>Invoice No:</span>
                        <strong>{{ invoiceForPrint()?.invoiceNumber }}</strong>
                      </div>
                      <div class="doc-meta-row">
                        <span>Invoice Date:</span>
                        <span>{{ invoiceForPrint()?.invoiceDate }}</span>
                      </div>
                      <div class="doc-meta-row">
                        <span>Billing Period:</span>
                        <span>{{ invoiceForPrint()?.billingPeriod }}</span>
                      </div>
                      <div class="doc-meta-row">
                        <span>Status:</span>
                        <strong>{{ invoiceForPrint()?.status | uppercase }}</strong>
                      </div>
                    </div>
                  </div>

                  <hr class="print-divider" />

                  <div class="parties-grid">
                    <div class="party-box">
                      <span class="party-label">BILLED TO (CLIENT):</span>
                      <h3 class="party-name">{{ invoiceForPrint()?.clientName }}</h3>
                      <p class="party-text">Client Code: {{ invoiceForPrint()?.clientCode || '—' }}</p>
                      <p class="party-text">{{ invoiceForPrint()?.client?.address || 'United Arab Emirates' }}</p>
                    </div>
                    <div class="party-box">
                      <span class="party-label">PROJECT DEPLOYMENT SITE:</span>
                      <h3 class="party-name">{{ invoiceForPrint()?.projectName }}</h3>
                      <p class="party-text">Project Code: {{ invoiceForPrint()?.projectCode || '—' }}</p>
                      <p class="party-text">Certified Workforce: {{ invoiceForPrint()?.workforceCount || invoiceForPrint()?.annexureItems?.length || 0 }} Deployed Employees</p>
                    </div>
                  </div>

                  <div class="commercial-table-wrap">
                    <table class="print-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th class="text-center">Workforce Count</th>
                          <th class="text-right">Total Hours</th>
                          <th class="text-right">Amount (AED)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <strong>Commercial Manpower Supply Services</strong>
                            <p class="sub-desc">Billable regular working hours verified from biometric / attendance records for {{ invoiceForPrint()?.billingPeriod }}.</p>
                          </td>
                          <td class="text-center font-mono">{{ invoiceForPrint()?.workforceCount || invoiceForPrint()?.annexureItems?.length || 0 }}</td>
                          <td class="text-right font-mono">{{ invoiceForPrint()?.totalRegularHours | number:'1.2-2' }}</td>
                          <td class="text-right font-mono font-bold">{{ invoiceForPrint()?.subtotal | number:'1.2-2' }}</td>
                        </tr>
                        @if (invoiceForPrint()?.totalOtHours && invoiceForPrint()!.totalOtHours! > 0) {
                          <tr>
                            <td>
                              <strong>Certified Overtime Services</strong>
                              <p class="sub-desc">Approved overtime hours per point-in-time rates.</p>
                            </td>
                            <td class="text-center font-mono">—</td>
                            <td class="text-right font-mono">{{ invoiceForPrint()?.totalOtHours | number:'1.2-2' }}</td>
                            <td class="text-right font-mono font-bold">Included in Total</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  <div class="print-totals-block">
                    <div class="totals-table">
                      <div class="totals-row">
                        <span>Subtotal:</span>
                        <span class="font-mono">AED {{ invoiceForPrint()?.subtotal | number:'1.2-2' }}</span>
                      </div>
                      <div class="totals-row">
                        <span>VAT (0% / Exempt):</span>
                        <span class="font-mono">AED {{ invoiceForPrint()?.taxAmount | number:'1.2-2' }}</span>
                      </div>
                      <div class="totals-row totals-grand">
                        <span>TOTAL PAYABLE (AED):</span>
                        <span class="font-mono font-bold">AED {{ invoiceForPrint()?.totalAmount | number:'1.2-2' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="payment-terms-box">
                    <strong>Payment Terms & Notes:</strong>
                    <p>{{ invoiceForPrint()?.notes || 'Payment is due within 30 days from invoice issuance.' }}</p>
                  </div>

                  <div class="signatures-row">
                    <div class="sig-block">
                      <div class="sig-line"></div>
                      <span>Prepared By / Blue Royal Commercial</span>
                    </div>
                    <div class="sig-block">
                      <div class="sig-line"></div>
                      <span>Client Authorized Representative</span>
                    </div>
                  </div>

                  <div class="page-footer-note">
                    <span>Page 1 of 2 — Commercial Tax Invoice</span>
                  </div>
                </div>

                <!-- PAGE BREAK FOR SECOND PAGE -->
                <div class="page-break"></div>

                <!-- PAGE 2: TIMESHEET & BILLING ANNEXURE -->
                <div class="print-page print-page-2">
                  <div class="print-header">
                    <div>
                      <h2 class="annexure-title">TIMESHEET & BILLING ANNEXURE</h2>
                      <p class="company-subtitle">ANNEXURE TO INVOICE {{ invoiceForPrint()?.invoiceNumber }}</p>
                    </div>
                    <div class="text-right">
                      <span class="badge badge-period font-mono">{{ invoiceForPrint()?.billingPeriod }}</span>
                    </div>
                  </div>

                  <div class="annexure-meta-summary">
                    <div><strong>Client:</strong> {{ invoiceForPrint()?.clientName }}</div>
                    <div><strong>Project:</strong> {{ invoiceForPrint()?.projectName }}</div>
                    <div><strong>Certified Workforce:</strong> {{ invoiceForPrint()?.workforceCount || invoiceForPrint()?.annexureItems?.length || 0 }} Workers</div>
                    <div><strong>Total Billed:</strong> AED {{ invoiceForPrint()?.totalAmount | number:'1.2-2' }}</div>
                  </div>

                  <div class="annexure-table-wrap">
                    <table class="print-table mini-print-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Emp Code</th>
                          <th>Worker Name</th>
                          <th>Trade / Role</th>
                          <th class="text-right">Reg Hrs</th>
                          <th class="text-right">Rate</th>
                          <th class="text-right">Reg Amt</th>
                          <th class="text-right">OT Hrs</th>
                          <th class="text-right">OT Rate</th>
                          <th class="text-right">OT Amt</th>
                          <th class="text-right">Total (AED)</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of invoiceForPrint()?.annexureItems; track item.employeeId; let idx = $index) {
                          <tr>
                            <td>{{ idx + 1 }}</td>
                            <td class="font-mono">{{ item.employeeCode }}</td>
                            <td>{{ item.employeeName }}</td>
                            <td>{{ item.designationTitle }}</td>
                            <td class="text-right font-mono">{{ item.regularHours | number:'1.1-1' }}</td>
                            <td class="text-right font-mono">{{ item.regularRate | number:'1.2-2' }}</td>
                            <td class="text-right font-mono">{{ item.regularAmount | number:'1.2-2' }}</td>
                            <td class="text-right font-mono">{{ item.otHours | number:'1.1-1' }}</td>
                            <td class="text-right font-mono">{{ item.otRate | number:'1.2-2' }}</td>
                            <td class="text-right font-mono">{{ item.otAmount | number:'1.2-2' }}</td>
                            <td class="text-right font-mono font-bold">{{ item.totalAmount | number:'1.2-2' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  <div class="annexure-footer-cert">
                    <p>I hereby certify that the hours and deployment records listed above represent actual, verified work executed at the project site in accordance with approved shift records.</p>
                  </div>

                  <div class="signatures-row mt-4">
                    <div class="sig-block">
                      <div class="sig-line"></div>
                      <span>Project Supervisor / Site In-Charge</span>
                    </div>
                    <div class="sig-block">
                      <div class="sig-line"></div>
                      <span>Client Site Engineer / Consultant</span>
                    </div>
                  </div>

                  <div class="page-footer-note">
                    <span>Page 2 of 2 — Certified Timesheet & Billing Annexure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- ========================================================= -->
        <!-- LARGE OFFCANVAS DRAWER: RECORD PAYMENT -->
        <!-- ========================================================= -->
        @if (activeDrawer() === 'record-payment' && invoiceForPayment()) {
          <div class="offcanvas-backdrop" (click)="closeDrawer()"></div>
          <aside class="offcanvas-panel" role="dialog" aria-modal="true">
            <div class="offcanvas-header">
              <div class="offcanvas-header-left">
                <div class="offcanvas-icon-pill">
                  <span class="material-symbols-outlined">add_card</span>
                </div>
                <div>
                  <h2 class="offcanvas-title">Record Client Payment</h2>
                  <p class="offcanvas-subtitle">
                    Post transaction receipt and allocate funds against invoice {{ invoiceForPayment()?.invoiceNumber }}
                  </p>
                </div>
              </div>
              <button type="button" class="btn-offcanvas-close" (click)="closeDrawer()" title="Close Drawer">×</button>
            </div>

            <div class="offcanvas-body">
              <!-- Invoice Financial Context Banner -->
              <div class="payment-context-card">
                <div class="context-grid">
                  <div class="context-item">
                    <span class="context-label">Client</span>
                    <span class="context-val font-semibold">{{ invoiceForPayment()?.clientName }}</span>
                  </div>
                  <div class="context-item">
                    <span class="context-label">Project</span>
                    <span class="context-val">{{ invoiceForPayment()?.projectName }}</span>
                  </div>
                  <div class="context-item">
                    <span class="context-label">Invoice Total</span>
                    <span class="context-val font-mono">AED {{ invoiceForPayment()?.totalAmount | number:'1.2-2' }}</span>
                  </div>
                  <div class="context-item">
                    <span class="context-label">Previously Received</span>
                    <span class="context-val font-mono text-success">AED {{ (invoiceForPayment()?.paidAmount || 0) | number:'1.2-2' }}</span>
                  </div>
                  <div class="context-item highlight">
                    <span class="context-label">Current Outstanding</span>
                    <span class="context-val font-mono font-bold text-danger">
                      AED {{ (invoiceForPayment()?.outstandingAmount !== undefined ? invoiceForPayment()?.outstandingAmount : invoiceForPayment()?.totalAmount) | number:'1.2-2' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Payment Form -->
              <form class="payment-form" (ngSubmit)="submitPayment()">
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label class="required-label">Payment Date</label>
                    <input
                      type="date"
                      class="form-control"
                      [(ngModel)]="paymentForm.paymentDate"
                      name="paymentDate"
                      required
                    />
                  </div>

                  <div class="form-group flex-1">
                    <label class="required-label">Payment Method</label>
                    <select
                      class="form-control"
                      [(ngModel)]="paymentForm.paymentMethod"
                      name="paymentMethod"
                      required
                    >
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Debit / Credit Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label class="required-label">Amount Received (AED)</label>
                    <div class="input-with-currency">
                      <span class="currency-prefix">AED</span>
                      <input
                        type="number"
                        class="form-control font-mono font-semibold"
                        [(ngModel)]="paymentForm.amount"
                        name="amount"
                        step="0.01"
                        min="0.01"
                        [max]="invoiceForPayment()?.outstandingAmount || invoiceForPayment()?.totalAmount || 0"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    @if (isOverpayment()) {
                      <div class="form-error-hint">
                        Amount exceeds current outstanding balance of AED {{ (invoiceForPayment()?.outstandingAmount !== undefined ? invoiceForPayment()?.outstandingAmount : invoiceForPayment()?.totalAmount) | number:'1.2-2' }}
                      </div>
                    }
                  </div>

                  <div class="form-group flex-1">
                    <label>Reference / Cheque #</label>
                    <input
                      type="text"
                      class="form-control font-mono"
                      [(ngModel)]="paymentForm.referenceNumber"
                      name="referenceNumber"
                      placeholder="e.g. TXN-998231 or CHQ-00129"
                    />
                  </div>
                </div>

                <!-- Live Remaining Balance Preview -->
                <div class="live-preview-box">
                  <div class="preview-line">
                    <span>Outstanding Before Payment:</span>
                    <span class="font-mono">AED {{ (invoiceForPayment()?.outstandingAmount !== undefined ? invoiceForPayment()?.outstandingAmount : invoiceForPayment()?.totalAmount) | number:'1.2-2' }}</span>
                  </div>
                  <div class="preview-line deduction">
                    <span>New Payment:</span>
                    <span class="font-mono">- AED {{ (paymentForm.amount || 0) | number:'1.2-2' }}</span>
                  </div>
                  <div class="preview-divider"></div>
                  <div class="preview-line total">
                    <span>Remaining Balance Due:</span>
                    <span class="font-mono font-bold" [class.text-success]="remainingBalancePreview() === 0">
                      AED {{ remainingBalancePreview() | number:'1.2-2' }}
                    </span>
                  </div>
                </div>

                <div class="form-group">
                  <label>Notes / Remarks</label>
                  <textarea
                    class="form-control"
                    rows="3"
                    [(ngModel)]="paymentForm.notes"
                    name="notes"
                    placeholder="Optional details regarding receipt or bank transaction"
                  ></textarea>
                </div>

                <div class="offcanvas-footer">
                  <button type="button" class="btn btn-secondary" (click)="closeDrawer()" [disabled]="submittingPayment()">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    [disabled]="!isPaymentFormValid() || submittingPayment()"
                  >
                    @if (submittingPayment()) {
                      <span class="spinner spinner-sm"></span>
                      <span>Recording...</span>
                    } @else {
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Confirm & Post Payment</span>
                    }
                  </button>
                </div>
              </form>
            </div>
          </aside>
        }

        <!-- ========================================================= -->
        <!-- CONFIRMATION MODAL: REVERSE PAYMENT -->
        <!-- ========================================================= -->
        @if (reversalTargetPayment()) {
          <div class="modal-backdrop" (click)="closeReversalModal()">
            <div class="modal-card modal-confirm" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h3>Confirm Payment Reversal</h3>
                <button class="modal-close" (click)="closeReversalModal()">×</button>
              </div>
              <div class="modal-body">
                <div class="confirm-icon-box text-danger">
                  <span class="material-symbols-outlined icon-lg">error</span>
                </div>
                <h4 class="text-center">Reverse payment {{ reversalTargetPayment()?.paymentNumber }}?</h4>
                <p class="confirm-warning text-center">
                  Payment of <strong>AED {{ reversalTargetPayment()?.amount | number:'1.2-2' }}</strong> will be marked as REVERSED. The invoice outstanding balance will be restored automatically.
                </p>

                <div class="form-group">
                  <label>Reversal Reason <span class="required">*</span></label>
                  <textarea
                    class="form-control"
                    rows="3"
                    [(ngModel)]="reversalReasonText"
                    placeholder="State reason for reversal (e.g. cheque bounced, erroneous allocation, duplicate entry)..."
                  ></textarea>
                  @if (reversalReasonText.trim().length > 0 && reversalReasonText.trim().length < 5) {
                    <div class="form-error-hint">Reason must be at least 5 characters long.</div>
                  }
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="closeReversalModal()" [disabled]="submittingReversal()">
                  Cancel
                </button>
                <button
                  class="btn btn-danger"
                  (click)="confirmReversal()"
                  [disabled]="reversalReasonText.trim().length < 5 || submittingReversal()"
                >
                  @if (submittingReversal()) {
                    <span class="spinner spinner-sm"></span>
                    <span>Reversing...</span>
                  } @else {
                    <span>Confirm Reversal</span>
                  }
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

      /* KPI Cards */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }
      .kpi-card {
        background: var(--color-surface, #ffffff);
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 10px;
        padding: 16px 20px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .kpi-card:hover {
        border-color: #3b82f6;
        transform: translateY(-1px);
      }
      .kpi-card.active-card {
        border-color: #2563eb;
        background: #f8faff;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
      .kpi-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--color-text-muted, #64748b);
        margin-bottom: 6px;
      }
      .kpi-value {
        font-size: 22px;
        font-weight: 700;
        color: var(--color-text-primary, #0f172a);
      }
      .kpi-value.warning { color: #d97706; }
      .kpi-value.success { color: #16a34a; }
      .kpi-value.primary { color: #2563eb; }

      /* Filter Bar */
      .filter-bar {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        background: #ffffff;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        flex-wrap: wrap;
      }
      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 140px;
      }
      .filter-group label {
        font-size: 11px;
        font-weight: 600;
        color: #475569;
        text-transform: uppercase;
      }

      /* Alert Notifications */
      .alert {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
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

      /* Table Panel */
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
        font-size: 12px;
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
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }
      .clickable { cursor: pointer; color: #2563eb; }
      .clickable:hover { text-decoration: underline; }

      .badge-period {
        background: #e0e7ff;
        color: #3730a3;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }
      .badge-subtle {
        background: #f1f5f9;
        color: #475569;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
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
      .status-badge.approved {
        background: #ccfbf1;
        color: #0f766e;
      }
      .status-badge.rejected {
        background: #ffe4e6;
        color: #be123c;
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
        transition: all 0.15s;
      }
      .btn-action:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .btn-action.btn-approve {
        border-color: #99f6e4;
        color: #0d9488;
      }
      .btn-action.btn-approve:hover {
        background: #ccfbf1;
      }
      .btn-action.btn-reject {
        border-color: #fecdd3;
        color: #e11d48;
      }
      .btn-action.btn-reject:hover {
        background: #ffe4e6;
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

      /* ========================================================= */
      /* OFFCANVAS DRAWER & BACKDROP STYLES                        */
      /* ========================================================= */
      .offcanvas-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(2px);
        z-index: 999;
        animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .offcanvas-panel {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 820px;
        max-width: 100vw;
        background: #ffffff;
        box-shadow: -8px 0 32px rgba(15, 23, 42, 0.2);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        animation: slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      .offcanvas-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid #e2e8f0;
        background: #ffffff;
      }
      .offcanvas-header-left {
        display: flex;
        align-items: center;
        gap: 0.875rem;
      }
      .offcanvas-icon-pill {
        width: 2.75rem;
        height: 2.75rem;
        border-radius: 0.625rem;
        background: rgba(37, 99, 235, 0.08);
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .offcanvas-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: #0f172a;
      }
      .offcanvas-subtitle {
        margin: 2px 0 0 0;
        font-size: 0.8125rem;
        color: #64748b;
      }
      .btn-offcanvas-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #94a3b8;
      }
      .offcanvas-body {
        padding: 1.25rem 1.5rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        flex: 1;
      }
      .offcanvas-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      /* Banners */
      .banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
      }
      .banner-icon { font-size: 24px; flex-shrink: 0; }
      .banner p { margin: 2px 0 0 0; }
      .banner-draft { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
      .banner-approved { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
      .banner-rejected { background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
      .banner-issued { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }

      /* Section Cards */
      .section-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px 16px;
      }
      .section-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        color: #1e293b;
      }
      .section-card-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
      }
      .invoice-meta-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 10px 14px;
      }
      .invoice-meta-grid label {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
      }
      .meta-value {
        margin: 2px 0 0 0;
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
      }
      .meta-sub {
        font-size: 11px;
        color: #64748b;
      }
      .invoice-notes {
        background: #f8fafc;
        border-left: 3px solid #3b82f6;
        padding: 8px 12px;
        font-size: 12px;
        color: #334155;
      }

      /* Preview Box */
      .preview-box {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .preview-title-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #0284c7;
      }
      .preview-title-wrap h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
      }
      .preview-metrics {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
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

      /* Annexure */
      .annexure-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 6px;
      }
      .annexure-header {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #334155;
      }
      .annexure-header h5 {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
      }
      .mini-table-container {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        max-height: 280px;
        overflow-y: auto;
      }
      .mini-table {
        width: 100%;
        font-size: 12px;
        border-collapse: collapse;
      }
      .mini-table th, .mini-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #e2e8f0;
      }
      .mini-table th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .primary-text { color: #0284c7; }

      .tax-notice {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #0284c7;
        background: #f0f9ff;
        padding: 6px 10px;
        border-radius: 4px;
        border: 1px solid #bae6fd;
      }

      /* Form controls */
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .form-group.full-width {
        grid-column: 1 / -1;
      }
      .form-group label {
        font-size: 12px;
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
      .form-control-sm {
        padding: 6px 10px;
        font-size: 12px;
      }
      .form-control:focus {
        border-color: #3b82f6;
        outline: none;
      }
      .required { color: #dc2626; }
      .hint { font-size: 11px; color: #64748b; }

      .preview-loading {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
        color: #475569;
      }

      /* Modal Confirm */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        padding: 20px;
      }
      .modal-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 500px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 20px;
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
        font-size: 22px;
        cursor: pointer;
        color: #94a3b8;
      }
      .modal-body {
        padding: 16px 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .modal-footer {
        padding: 12px 20px;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .confirm-icon-box {
        text-align: center;
        margin-bottom: 4px;
      }
      .confirm-icon-box .icon-lg { font-size: 44px; }
      .confirm-warning {
        font-size: 13px;
        color: #64748b;
        margin: 4px 0 12px 0;
      }

      /* Buttons */
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.15s;
      }
      .btn-sm { padding: 6px 10px; font-size: 12px; }
      .btn-primary { background: #2563eb; color: #ffffff; }
      .btn-primary:hover { background: #1d4ed8; }
      .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
      .btn-secondary { background: #e2e8f0; color: #334155; }
      .btn-secondary:hover { background: #cbd5e1; }
      .btn-success { background: #10b981; color: #ffffff; }
      .btn-success:hover { background: #059669; }
      .btn-danger { background: #e11d48; color: #ffffff; }
      .btn-danger:hover { background: #be123c; }
      .btn-text { background: none; border: none; color: #64748b; cursor: pointer; }
      .btn-text:hover { color: #0f172a; }

      .spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        border-top-color: #3b82f6;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .d-flex { display: flex; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .gap-2 { gap: 8px; }
      .text-danger { color: #e11d48; }
      .text-success { color: #10b981; }
      .text-xs { font-size: 11px; }
      .text-sm { font-size: 13px; }
      .font-bold { font-weight: 700; }
      .font-italic { font-style: italic; }
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 12px; }
      .border-dashed { border: 1px dashed #cbd5e1; }
      .rounded { border-radius: 6px; }

      /* Payment Context Card & Live Preview */
      .payment-context-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .context-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .context-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .context-item.highlight {
        grid-column: span 2;
        border-top: 1px dashed #e2e8f0;
        padding-top: 8px;
        margin-top: 4px;
      }
      .context-label {
        font-size: 11px;
        color: #64748b;
        text-transform: uppercase;
        font-weight: 600;
      }
      .context-val {
        font-size: 13px;
        color: #0f172a;
      }

      .form-row {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
      }
      .flex-1 { flex: 1; }
      .required-label::after {
        content: ' *';
        color: #ef4444;
      }
      .input-with-currency {
        position: relative;
        display: flex;
        align-items: center;
      }
      .currency-prefix {
        position: absolute;
        left: 10px;
        font-size: 12px;
        font-weight: 700;
        color: #64748b;
      }
      .input-with-currency input {
        padding-left: 42px !important;
      }
      .form-error-hint {
        color: #ef4444;
        font-size: 11px;
        margin-top: 4px;
      }

      .live-preview-box {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 6px;
        padding: 10px 14px;
        margin-bottom: 14px;
      }
      .preview-line {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        margin-bottom: 4px;
        color: #334155;
      }
      .preview-line.deduction {
        color: #ef4444;
      }
      .preview-divider {
        height: 1px;
        background: #bae6fd;
        margin: 6px 0;
      }
      .preview-line.total {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 0;
      }

      .reversed-row {
        background-color: #fef2f2 !important;
        opacity: 0.85;
      }
      .strikethrough {
        text-decoration: line-through;
        color: #94a3b8;
      }

      /* Payment Status Badges */
      .status-badge.UNPAID { background: #f1f5f9; color: #64748b; }
      .status-badge.PARTIALLY_PAID { background: #fef3c7; color: #b45309; }
      .status-badge.PAID { background: #dcfce7; color: #15803d; }
      .status-badge.RECORDED { background: #dcfce7; color: #15803d; }
      .status-badge.REVERSED { background: #fee2e2; color: #b91c1c; }

      /* ========================================================= */
      /* PRINT / PDF DOCUMENT STYLES                               */
      /* ========================================================= */
      .print-modal-backdrop {
        padding: 10px;
        z-index: 10005;
      }
      .print-modal-card {
        max-width: 900px;
        max-height: 95vh;
      }
      .print-document-body {
        background: #f1f5f9;
        padding: 20px;
      }
      .print-page {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        padding: 40px;
        border-radius: 4px;
        color: #0f172a;
        margin-bottom: 24px;
      }
      .print-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .company-logo {
        margin: 0;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: 2px;
        color: #1e3a8a;
      }
      .company-subtitle {
        margin: 2px 0 0 0;
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.5px;
      }
      .company-address {
        margin: 4px 0 0 0;
        font-size: 11px;
        color: #64748b;
      }
      .doc-title {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        text-align: right;
      }
      .annexure-title {
        margin: 0;
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
      }
      .doc-meta-row {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        font-size: 12px;
        margin-bottom: 2px;
      }
      .print-divider {
        border: 0;
        border-top: 2px solid #0f172a;
        margin: 20px 0;
      }
      .parties-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-bottom: 24px;
      }
      .party-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 12px 16px;
        border-radius: 6px;
      }
      .party-label {
        font-size: 10px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
      }
      .party-name {
        margin: 4px 0 6px 0;
        font-size: 15px;
        font-weight: 700;
      }
      .party-text {
        margin: 0 0 4px 0;
        font-size: 12px;
        color: #334155;
      }
      .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        margin-bottom: 20px;
      }
      .print-table th {
        background: #f1f5f9;
        border-top: 1px solid #cbd5e1;
        border-bottom: 1px solid #cbd5e1;
        padding: 10px;
        font-weight: 700;
        text-align: left;
      }
      .print-table td {
        padding: 10px;
        border-bottom: 1px solid #e2e8f0;
      }
      .sub-desc {
        margin: 2px 0 0 0;
        font-size: 11px;
        color: #64748b;
      }
      .print-totals-block {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 20px;
      }
      .totals-table {
        width: 320px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .totals-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
      }
      .totals-grand {
        border-top: 2px solid #0f172a;
        padding-top: 8px;
        font-size: 15px;
        color: #1e3a8a;
      }
      .payment-terms-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 10px 14px;
        border-radius: 4px;
        font-size: 11px;
        color: #334155;
        margin-bottom: 40px;
      }
      .signatures-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        margin-top: 40px;
      }
      .sig-block {
        text-align: center;
        font-size: 11px;
        font-weight: 600;
        color: #475569;
      }
      .sig-line {
        border-top: 1px dashed #94a3b8;
        margin-bottom: 8px;
      }
      .page-footer-note {
        text-align: center;
        font-size: 10px;
        color: #94a3b8;
        margin-top: 30px;
      }
      .annexure-meta-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 10px 14px;
        border-radius: 6px;
        font-size: 12px;
        margin: 16px 0;
      }
      .mini-print-table th, .mini-print-table td {
        padding: 6px 8px;
        font-size: 11px;
      }
      .annexure-footer-cert {
        font-size: 11px;
        color: #475569;
        font-style: italic;
        margin: 20px 0;
      }

      /* Print Media Rule */
      @media print {
        body * {
          visibility: hidden;
        }
        #printableInvoiceDoc, #printableInvoiceDoc * {
          visibility: visible;
        }
        #printableInvoiceDoc {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: #ffffff;
          padding: 0;
        }
        .print-page {
          box-shadow: none;
          border: none;
          padding: 0;
          margin: 0;
        }
        .page-break {
          page-break-before: always;
          break-before: page;
          height: 1px;
        }
        .no-print {
          display: none !important;
        }
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

  // Drawer & Modal states
  public activeDrawer = signal<'generate' | 'detail' | 'record-payment' | null>(null);
  public selectedInvoice = signal<InvoiceDto | null>(null);
  public showRejectModal = signal<boolean>(false);
  public invoiceToReject = signal<InvoiceDto | null>(null);
  public rejectionReasonInput = '';

  public showPrintPreview = signal<boolean>(false);
  public invoiceForPrint = signal<InvoiceDto | null>(null);

  // Payment drawer & history state
  public invoiceForPayment = signal<InvoiceDto | null>(null);
  public invoicePayments = signal<PaymentDto[]>([]);
  public invoicePaymentLoading = signal<boolean>(false);
  public submittingPayment = signal<boolean>(false);
  public submittingReversal = signal<boolean>(false);
  public reversalTargetPayment = signal<PaymentDto | null>(null);
  public reversalReasonText = '';

  // Payment Form Model
  public paymentForm: {
    paymentDate: string;
    amount: number | null;
    paymentMethod: PaymentMethod;
    referenceNumber: string;
    notes: string;
  } = {
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: null,
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: '',
    notes: '',
  };

  // RBAC checks for payments
  public canRecordPayment = computed(() => {
    return this.authService.hasRole('super_admin') || this.authService.hasPermission('payments:create');
  });

  public canReversePayment = computed(() => {
    return this.authService.hasRole('super_admin') || this.authService.hasPermission('payments:reverse');
  });

  // Filters
  public filterStatus = signal<string>('all');
  public filterClientId = signal<string>('');
  public filterProjectId = signal<string>('');
  public filterPeriod = signal<string>('');

  public clients = signal<ClientDto[]>([]);
  public projects = signal<ProjectDto[]>([]);
  public projectDesignations = signal<TimesheetDesignationFilterDto[]>([]);
  public previewData = signal<InvoicePreviewDto | null>(null);

  public selectedGenerateClientId = signal<string>('');

  public generateDto: GenerateInvoiceDto = {
    clientId: '',
    projectId: '',
    billingPeriod: '2026-09',
    designationId: '',
    notes: '',
  };

  // KPIs
  public draftCount = computed(() => this.invoices().filter((i) => i.status === 'draft').length);
  public approvedCount = computed(() => this.invoices().filter((i) => i.status === 'approved').length);
  public issuedCount = computed(() => this.invoices().filter((i) => i.status === 'issued').length);
  public totalIssuedAmount = computed(() =>
    this.invoices()
      .filter((i) => i.status === 'issued')
      .reduce((sum, i) => sum + Number(i.totalAmount || 0), 0)
  );

  // Live remaining balance preview for payment form
  public remainingBalancePreview = computed(() => {
    const inv = this.invoiceForPayment();
    if (!inv) return 0;
    const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.totalAmount;
    const paymentAmt = Number(this.paymentForm.amount || 0);
    return Math.max(0, Math.round((outstanding - paymentAmt + Number.EPSILON) * 100) / 100);
  });

  public availableProjects = computed(() => {
    const cid = this.selectedGenerateClientId();
    if (!cid) return [];
    return this.projects().filter((p) => p.clientId === cid || (p as any).client_id === cid);
  });

  public filteredProjectsList = computed(() => {
    const cid = this.filterClientId();
    if (!cid) return this.projects();
    return this.projects().filter((p) => p.clientId === cid);
  });

  public filteredInvoices = computed(() => {
    let list = this.invoices();
    const st = this.filterStatus();
    if (st && st !== 'all') {
      list = list.filter((i) => i.status === st);
    }
    const cid = this.filterClientId();
    if (cid) {
      list = list.filter((i) => i.clientId === cid);
    }
    const pid = this.filterProjectId();
    if (pid) {
      list = list.filter((i) => i.projectId === pid);
    }
    const bp = this.filterPeriod().trim().toLowerCase();
    if (bp) {
      list = list.filter((i) => i.billingPeriod.toLowerCase().includes(bp));
    }
    return list;
  });

  constructor(
    private invoiceService: InvoiceService,
    private paymentService: PaymentService,
    private masterService: MasterService,
    private timesheetApiService: TimesheetApiService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
    this.loadMasters();
  }

  public canCreateInvoice(): boolean {
    return this.authService.hasPermission('invoices:create') || this.authService.hasRole('super_admin');
  }

  public canApproveOrIssue(): boolean {
    return this.authService.hasPermission('invoices:issue') || this.authService.hasRole('super_admin');
  }

  public clearFilters(): void {
    this.filterStatus.set('all');
    this.filterClientId.set('');
    this.filterProjectId.set('');
    this.filterPeriod.set('');
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

  public openGenerateOffcanvas(): void {
    const defaultClientId = this.clients().length === 1 ? this.clients()[0].id : '';
    this.selectedGenerateClientId.set(defaultClientId);
    this.generateDto = {
      clientId: defaultClientId,
      projectId: '',
      billingPeriod: '2026-09',
      designationId: '',
      notes: '',
    };
    this.projectDesignations.set([]);
    if (this.generateDto.clientId) {
      const avail = this.availableProjects();
      if (avail.length === 1) {
        this.generateDto.projectId = avail[0].id;
        this.loadProjectDesignations(avail[0].id);
      }
    }
    this.previewData.set(null);
    this.activeDrawer.set('generate');

    if (this.generateDto.clientId && this.generateDto.projectId) {
      this.fetchPreview();
    }
  }

  public closeDrawer(): void {
    this.activeDrawer.set(null);
  }

  public onClientSelected(): void {
    this.selectedGenerateClientId.set(this.generateDto.clientId || '');
    this.generateDto.projectId = '';
    this.generateDto.designationId = '';
    this.projectDesignations.set([]);
    this.previewData.set(null);
  }

  public onProjectSelected(): void {
    this.generateDto.designationId = '';
    this.previewData.set(null);
    if (this.generateDto.projectId) {
      this.loadProjectDesignations(this.generateDto.projectId);
      this.fetchPreview();
    } else {
      this.projectDesignations.set([]);
    }
  }

  public loadProjectDesignations(projectId: string): void {
    this.timesheetApiService.getProjectDesignations(projectId).subscribe({
      next: (res) => {
        this.projectDesignations.set(res.data || []);
      },
      error: (err) => {
        console.error('Error loading project designations:', err);
        this.projectDesignations.set([]);
      },
    });
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
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to calculate invoice preview.');
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

  public submitGenerateDraft(): void {
    if (!this.canSubmitGeneration()) return;

    this.submitting.set(true);
    this.invoiceService.generateInvoice(this.generateDto).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.closeDrawer();
        this.successMessage.set(
          `Draft invoice ${res.data.invoiceNumber} prepared for AED ${Number(res.data.totalAmount).toFixed(2)}. Status: DRAFT. Please review and approve.`,
        );
        this.loadInvoices();
        this.viewInvoice(res.data);
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
        this.activeDrawer.set('detail');
        if (res.data.status === 'issued') {
          this.loadInvoicePayments(res.data.id);
        } else {
          this.invoicePayments.set([]);
        }
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load invoice details.');
      },
    });
  }

  public loadInvoicePayments(invoiceId: string): void {
    this.invoicePaymentLoading.set(true);
    this.paymentService.getInvoicePaymentSummary(invoiceId).subscribe({
      next: (res) => {
        this.invoicePaymentLoading.set(false);
        this.invoicePayments.set(res.data.payments || []);
        if (this.selectedInvoice()?.id === invoiceId) {
          this.selectedInvoice.set({
            ...this.selectedInvoice()!,
            paidAmount: res.data.paid,
            outstandingAmount: res.data.outstanding,
            paymentStatus: res.data.paymentStatus,
          });
        }
      },
      error: (err) => {
        this.invoicePaymentLoading.set(false);
        console.error('Failed to load invoice payment history:', err);
      },
    });
  }

  public openRecordPaymentDrawer(invoice: InvoiceDto): void {
    this.invoiceForPayment.set(invoice);
    const outstanding = invoice.outstandingAmount !== undefined ? invoice.outstandingAmount : invoice.totalAmount;
    this.paymentForm = {
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: outstanding,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: '',
      notes: '',
    };
    this.activeDrawer.set('record-payment');
  }

  public isOverpayment(): boolean {
    const inv = this.invoiceForPayment();
    if (!inv) return false;
    const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.totalAmount;
    return Number(this.paymentForm.amount || 0) > outstanding;
  }

  public isPaymentFormValid(): boolean {
    const amt = Number(this.paymentForm.amount);
    return (
      !!this.paymentForm.paymentDate &&
      amt > 0 &&
      !this.isOverpayment()
    );
  }

  public submitPayment(): void {
    if (!this.isPaymentFormValid() || !this.invoiceForPayment()) return;

    this.submittingPayment.set(true);
    this.errorMessage.set(null);

    const dto = {
      clientId: this.invoiceForPayment()!.clientId,
      invoiceId: this.invoiceForPayment()!.id,
      paymentDate: this.paymentForm.paymentDate,
      amount: Number(this.paymentForm.amount),
      paymentMethod: this.paymentForm.paymentMethod,
      referenceNumber: this.paymentForm.referenceNumber.trim() || undefined,
      notes: this.paymentForm.notes.trim() || undefined,
    };

    this.paymentService.recordPayment(dto).subscribe({
      next: (res) => {
        this.submittingPayment.set(false);
        this.successMessage.set(
          `Payment ${res.data.paymentNumber} of AED ${(res.data.amount || 0).toFixed(2)} recorded successfully.`,
        );
        const invId = this.invoiceForPayment()!.id;
        this.closeDrawer();
        this.loadInvoices();
        if (this.selectedInvoice()?.id === invId) {
          this.viewInvoice(this.selectedInvoice()!);
        }
      },
      error: (err) => {
        this.submittingPayment.set(false);
        this.errorMessage.set(err.error?.error?.message || 'Failed to record payment.');
      },
    });
  }

  public openReversalModal(payment: PaymentDto): void {
    this.reversalTargetPayment.set(payment);
    this.reversalReasonText = '';
  }

  public closeReversalModal(): void {
    this.reversalTargetPayment.set(null);
    this.reversalReasonText = '';
  }

  public confirmReversal(): void {
    const target = this.reversalTargetPayment();
    if (!target) return;

    const reason = this.reversalReasonText.trim();
    if (reason.length < 5) return;

    this.submittingReversal.set(true);
    this.errorMessage.set(null);

    this.paymentService.reversePayment(target.id, reason).subscribe({
      next: (res) => {
        this.submittingReversal.set(false);
        this.successMessage.set(`Payment ${res.data.paymentNumber} has been reversed successfully.`);
        this.closeReversalModal();
        if (this.selectedInvoice()) {
          this.loadInvoicePayments(this.selectedInvoice()!.id);
        }
        this.loadInvoices();
      },
      error: (err) => {
        this.submittingReversal.set(false);
        this.errorMessage.set(err.error?.error?.message || 'Failed to reverse payment.');
      },
    });
  }

  public quickApprove(invoice: InvoiceDto): void {
    this.executeApprove(invoice);
  }

  public executeApprove(invoice: InvoiceDto): void {
    this.submitting.set(true);
    this.invoiceService.approveInvoice(invoice.id).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.successMessage.set(`Invoice ${res.data.invoiceNumber} successfully APPROVED.`);
        this.loadInvoices();
        if (this.selectedInvoice()?.id === invoice.id) {
          this.viewInvoice(res.data);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to approve invoice.');
      },
    });
  }

  public openRejectModal(invoice: InvoiceDto): void {
    this.invoiceToReject.set(invoice);
    this.rejectionReasonInput = '';
    this.showRejectModal.set(true);
  }

  public executeReject(): void {
    const inv = this.invoiceToReject();
    if (!inv || !this.rejectionReasonInput.trim()) return;

    this.submitting.set(true);
    this.invoiceService.rejectInvoice(inv.id, this.rejectionReasonInput.trim()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.showRejectModal.set(false);
        this.invoiceToReject.set(null);
        this.successMessage.set(`Invoice ${res.data.invoiceNumber} has been marked as REJECTED.`);
        this.loadInvoices();
        if (this.selectedInvoice()?.id === inv.id) {
          this.viewInvoice(res.data);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to reject invoice.');
      },
    });
  }

  public quickIssue(invoice: InvoiceDto): void {
    this.executeIssue(invoice);
  }

  public executeIssue(invoice: InvoiceDto): void {
    this.submitting.set(true);
    this.invoiceService.issueInvoice(invoice.id).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.successMessage.set(`Invoice ${res.data.invoiceNumber} successfully finalized and ISSUED.`);
        this.loadInvoices();
        if (this.selectedInvoice()?.id === invoice.id) {
          this.viewInvoice(res.data);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to issue invoice.');
      },
    });
  }

  public openPrintPreview(invoice: InvoiceDto): void {
    // If not loaded with annexureItems, fetch full invoice first
    if (!invoice.annexureItems) {
      this.invoiceService.getInvoice(invoice.id).subscribe({
        next: (res) => {
          this.invoiceForPrint.set(res.data);
          this.showPrintPreview.set(true);
        },
        error: (err) => {
          this.errorMessage.set('Failed to load invoice for print.');
        },
      });
    } else {
      this.invoiceForPrint.set(invoice);
      this.showPrintPreview.set(true);
    }
  }

  public triggerBrowserPrint(): void {
    window.print();
  }
}
