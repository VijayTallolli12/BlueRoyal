import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { PaymentService } from '../../core/services/payment.service';
import { MasterService } from '../../core/services/master.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ReceivableInvoiceDto,
  ReceivablesSummaryDto,
  PaymentDto,
  ClientDto,
  ProjectDto,
  PaymentMethod,
} from '@blue-royal/contracts';
import { AppShellComponent } from '../../core/layout/app-shell.component';

@Component({
  selector: 'app-receivables',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="receivables-container">
        <!-- Page Header -->
        <div class="page-header">
          <div class="header-main">
            <h2>Client Receivables & Aging</h2>
            <p class="subtitle">
              Monitor commercial receivables, payment collections, and aging balances across active clients and projects.
            </p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" (click)="loadReceivables()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="kpi-grid">
          <div class="kpi-card" (click)="filterStatus.set('all')" [class.active-card]="filterStatus() === 'all'">
            <div class="kpi-label">Total Outstanding</div>
            <div class="kpi-value primary">AED {{ summary().totalOutstanding | number:'1.2-2' }}</div>
            <div class="kpi-subtext">{{ summary().totalReceivablesCount }} total invoices</div>
          </div>
          <div class="kpi-card" (click)="filterStatus.set('OVERDUE')" [class.active-card]="filterStatus() === 'OVERDUE'">
            <div class="kpi-label">Overdue Invoices</div>
            <div class="kpi-value danger">AED {{ summary().overdueAmount | number:'1.2-2' }}</div>
            <div class="kpi-subtext">Past configured due date</div>
          </div>
          <div class="kpi-card" (click)="filterStatus.set('PARTIALLY_PAID')" [class.active-card]="filterStatus() === 'PARTIALLY_PAID'">
            <div class="kpi-label">Partially Paid</div>
            <div class="kpi-value warning">{{ summary().partiallyPaidCount }}</div>
            <div class="kpi-subtext">Partial settlements</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Due This Month</div>
            <div class="kpi-value info">AED {{ summary().dueThisMonthAmount | number:'1.2-2' }}</div>
            <div class="kpi-subtext">Current month maturity</div>
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

        <!-- Filter & Search Toolbar -->
        <div class="filter-bar">
          <div class="filter-group">
            <label>Payment Status</label>
            <select class="form-control form-control-sm" [ngModel]="filterStatus()" (ngModelChange)="onStatusChange($event)">
              <option value="all">All Receivables</option>
              <option value="OVERDUE">Overdue Only</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Client</label>
            <select class="form-control form-control-sm" [ngModel]="filterClientId()" (ngModelChange)="onClientChange($event)">
              <option value="">All Clients</option>
              @for (c of clients(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>

          <div class="filter-group">
            <label>Project</label>
            <select class="form-control form-control-sm" [ngModel]="filterProjectId()" (ngModelChange)="onProjectChange($event)">
              <option value="">All Projects</option>
              @for (p of filteredProjects(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </div>

          <div class="filter-group flex-1">
            <label>Search</label>
            <div class="search-input-wrapper">
              <span class="material-symbols-outlined search-icon">search</span>
              <input
                type="text"
                class="form-control form-control-sm search-input"
                placeholder="Search invoice number, client, project..."
                [ngModel]="searchTerm()"
                (ngModelChange)="searchTerm.set($event)"
              />
            </div>
          </div>
        </div>

        <!-- Receivables Ledger Table -->
        <div class="table-container card">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th class="text-right">Total (AED)</th>
                  <th class="text-right">Paid (AED)</th>
                  <th class="text-right">Outstanding (AED)</th>
                  <th>Aging / Status</th>
                  <th>Payment Status</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr>
                    <td colspan="11" class="text-center py-4">
                      <div class="spinner"></div>
                      <p class="text-muted mt-2">Loading commercial receivables ledger...</p>
                    </td>
                  </tr>
                } @else if (filteredReceivables().length === 0) {
                  <tr>
                    <td colspan="11" class="text-center py-5 empty-state">
                      <span class="material-symbols-outlined empty-icon">account_balance_wallet</span>
                      <h4>No Receivables Found</h4>
                      <p class="text-muted">No commercial receivables match your current filters.</p>
                    </td>
                  </tr>
                } @else {
                  @for (item of filteredReceivables(); track item.invoiceId) {
                    <tr [class.overdue-row]="item.isOverdue">
                      <td class="font-mono font-semibold">
                        <a [routerLink]="['/invoices']" class="invoice-link">
                          {{ item.invoiceNumber }}
                        </a>
                      </td>
                      <td>{{ item.clientName }}</td>
                      <td>{{ item.projectName }}</td>
                      <td>{{ item.invoiceDate }}</td>
                      <td>
                        @if (item.dueDate) {
                          <span [class.text-danger]="item.isOverdue" class="font-mono">
                            {{ item.dueDate }}
                          </span>
                        } @else {
                          <span class="text-muted font-italic">Not Set</span>
                        }
                      </td>
                      <td class="text-right font-mono font-semibold">{{ item.invoiceTotal | number:'1.2-2' }}</td>
                      <td class="text-right font-mono text-success">{{ item.paid | number:'1.2-2' }}</td>
                      <td class="text-right font-mono font-bold" [class.text-danger]="item.outstanding > 0">
                        {{ item.outstanding | number:'1.2-2' }}
                      </td>
                      <td>
                        @if (item.isOverdue) {
                          <span class="badge badge-overdue">
                            <span class="material-symbols-outlined icon-xs">warning</span>
                            {{ item.daysOverdue }}d Overdue
                          </span>
                        } @else if (item.outstanding === 0) {
                          <span class="badge badge-settled">Settled</span>
                        } @else {
                          <span class="badge badge-current">Current</span>
                        }
                      </td>
                      <td>
                        <span class="status-badge" [ngClass]="item.paymentStatus">
                          {{ item.paymentStatus.replace('_', ' ') }}
                        </span>
                      </td>
                      <td class="text-center">
                        <div class="action-buttons">
                          <button
                            class="btn-action"
                            title="View Payment History"
                            (click)="openPaymentHistoryDrawer(item)"
                          >
                            <span class="material-symbols-outlined">history</span>
                          </button>
                          @if (item.outstanding > 0 && canRecordPayment()) {
                            <button
                              class="btn-action btn-pay"
                              title="Record Payment"
                              (click)="openRecordPaymentDrawer(item)"
                            >
                              <span class="material-symbols-outlined">add_card</span>
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
        <!-- LARGE OFFCANVAS DRAWER: RECORD PAYMENT -->
        <!-- ========================================================= -->
        @if (activeDrawer() === 'record-payment' && selectedReceivable()) {
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
                    Post transaction receipt and allocate funds against invoice {{ selectedReceivable()?.invoiceNumber }}
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
                    <span class="context-val font-semibold">{{ selectedReceivable()?.clientName }}</span>
                  </div>
                  <div class="context-item">
                    <span class="context-label">Project</span>
                    <span class="context-val">{{ selectedReceivable()?.projectName }}</span>
                  </div>
                  <div class="context-item">
                    <span class="context-label">Invoice Total</span>
                    <span class="context-val font-mono">AED {{ selectedReceivable()?.invoiceTotal | number:'1.2-2' }}</span>
                  </div>
                  <div class="context-item">
                    <span class="context-label">Previously Received</span>
                    <span class="context-val font-mono text-success">AED {{ selectedReceivable()?.paid | number:'1.2-2' }}</span>
                  </div>
                  <div class="context-item highlight">
                    <span class="context-label">Current Outstanding</span>
                    <span class="context-val font-mono font-bold text-danger">AED {{ selectedReceivable()?.outstanding | number:'1.2-2' }}</span>
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
                        [max]="selectedReceivable()?.outstanding || 0"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    @if (isOverpayment()) {
                      <div class="form-error-hint">
                        Amount exceeds current outstanding balance of AED {{ selectedReceivable()?.outstanding | number:'1.2-2' }}
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
                    <span class="font-mono">AED {{ selectedReceivable()?.outstanding | number:'1.2-2' }}</span>
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
                    [disabled]="!isFormValid() || submittingPayment()"
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
        <!-- LARGE OFFCANVAS DRAWER: PAYMENT HISTORY & AUDIT -->
        <!-- ========================================================= -->
        @if (activeDrawer() === 'view-payment-history' && selectedReceivable()) {
          <div class="offcanvas-backdrop" (click)="closeDrawer()"></div>
          <aside class="offcanvas-panel" role="dialog" aria-modal="true">
            <div class="offcanvas-header">
              <div class="offcanvas-header-left">
                <div class="offcanvas-icon-pill">
                  <span class="material-symbols-outlined">history</span>
                </div>
                <div>
                  <h2 class="offcanvas-title">Payment History & Ledger</h2>
                  <p class="offcanvas-subtitle">
                    Recorded and reversed payment transactions for {{ selectedReceivable()?.invoiceNumber }}
                  </p>
                </div>
              </div>
              <button type="button" class="btn-offcanvas-close" (click)="closeDrawer()" title="Close Drawer">×</button>
            </div>

            <div class="offcanvas-body">
              <!-- Summary Topcard -->
              <div class="payment-context-card">
                <div class="context-grid">
                  <div class="context-item">
                    <span class="context-label">Client</span>
                    <span class="context-val font-semibold">{{ selectedReceivable()?.clientName }}</span>
                  </div>
                  <div class="context-item">
                    <span class="context-label">Invoice Total</span>
                    <span class="context-val font-mono font-semibold">AED {{ selectedReceivable()?.invoiceTotal | number:'1.2-2' }}</span>
                  </div>
                  <div class="context-item">
                    <span class="context-label">Total Paid (Non-Reversed)</span>
                    <span class="context-val font-mono text-success font-semibold">AED {{ selectedReceivable()?.paid | number:'1.2-2' }}</span>
                  </div>
                  <div class="context-item highlight">
                    <span class="context-label">Current Outstanding</span>
                    <span class="context-val font-mono font-bold text-danger">AED {{ selectedReceivable()?.outstanding | number:'1.2-2' }}</span>
                  </div>
                </div>
              </div>

              <!-- History Table -->
              <div class="history-table-wrap">
                <h4 class="section-title">Transaction Records</h4>
                @if (paymentHistoryLoading()) {
                  <div class="text-center py-4">
                    <div class="spinner"></div>
                    <p class="text-muted mt-2">Loading transactions...</p>
                  </div>
                } @else if (paymentHistory().length === 0) {
                  <div class="text-center py-4 text-muted">
                    <p>No payments recorded for this invoice yet.</p>
                  </div>
                } @else {
                  <table class="table history-table">
                    <thead>
                      <tr>
                        <th>Payment #</th>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th class="text-right">Amount (AED)</th>
                        <th>Status</th>
                        <th>Recorded By</th>
                        <th class="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of paymentHistory(); track p.id) {
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
                }
              </div>

              <div class="offcanvas-footer mt-4">
                @if (selectedReceivable() && selectedReceivable()!.outstanding > 0 && canRecordPayment()) {
                  <button class="btn btn-primary" (click)="activeDrawer.set('record-payment')">
                    <span class="material-symbols-outlined icon-sm">add_card</span>
                    <span>Record New Payment</span>
                  </button>
                }
                <button type="button" class="btn btn-secondary" (click)="closeDrawer()">
                  Close
                </button>
              </div>
            </div>
          </aside>
        }

        <!-- ========================================================= -->
        <!-- CONFIRMATION MODAL: REVERSE PAYMENT -->
        <!-- ========================================================= -->
        @if (reversalTargetPayment()) {
          <div class="modal-backdrop" (click)="closeReversalModal()"></div>
          <div class="modal-dialog" role="dialog" aria-modal="true">
            <div class="modal-header">
              <h3>Confirm Payment Reversal</h3>
              <button class="modal-close" (click)="closeReversalModal()">×</button>
            </div>
            <div class="modal-body">
              <p class="modal-warning">
                Are you sure you want to reverse payment
                <strong>{{ reversalTargetPayment()?.paymentNumber }}</strong>
                of <strong>AED {{ reversalTargetPayment()?.amount | number:'1.2-2' }}</strong>?
              </p>
              <p class="text-muted text-sm">
                This action is non-destructive but permanent. The invoice outstanding balance will be automatically restored.
              </p>

              <div class="form-group mt-3">
                <label class="required-label">Mandatory Reversal Reason</label>
                <textarea
                  class="form-control"
                  rows="3"
                  [(ngModel)]="reversalReasonText"
                  placeholder="State reason for reversal (e.g. cheque bounced, erroneous allocation, duplicate entry)..."
                ></textarea>
                @if (reversalReasonText().trim().length > 0 && reversalReasonText().trim().length < 5) {
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
                [disabled]="reversalReasonText().trim().length < 5 || submittingReversal()"
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
        }
      </div>
    </app-shell>
  `,
  styles: [`
    .receivables-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .page-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .subtitle {
      margin: 0.25rem 0 0 0;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .kpi-card:hover {
      border-color: var(--brand-500);
      transform: translateY(-2px);
    }

    .kpi-card.active-card {
      border-color: var(--brand-600);
      background: rgba(37, 99, 235, 0.04);
    }

    .kpi-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .kpi-value {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0.35rem 0;
      font-family: monospace;
    }

    .kpi-value.primary { color: var(--brand-600); }
    .kpi-value.danger { color: #ef4444; }
    .kpi-value.warning { color: #f59e0b; }
    .kpi-value.info { color: #06b6d4; }

    .kpi-subtext {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 1rem;
      background: var(--bg-surface);
      padding: 1rem 1.25rem;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      min-width: 170px;
    }

    .filter-group label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      color: var(--text-muted);
      font-size: 1.125rem;
      pointer-events: none;
    }

    .search-input {
      padding-left: 2.25rem !important;
    }

    .table-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .table th {
      background: #f8fafc;
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-default);
    }

    .table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-primary);
    }

    .overdue-row {
      background-color: rgba(239, 68, 68, 0.02);
    }

    .invoice-link {
      color: var(--brand-600);
      text-decoration: none;
      font-weight: 600;
    }

    .invoice-link:hover {
      text-decoration: underline;
    }

    .badge-overdue {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: #fee2e2;
      color: #b91c1c;
      font-weight: 700;
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
    }

    .badge-settled {
      background: #dcfce7;
      color: #15803d;
      font-weight: 600;
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
    }

    .badge-current {
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
    }

    .status-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .status-badge.UNPAID { background: #f1f5f9; color: #64748b; }
    .status-badge.PARTIALLY_PAID { background: #fef3c7; color: #b45309; }
    .status-badge.PAID { background: #dcfce7; color: #15803d; }
    .status-badge.RECORDED { background: #dcfce7; color: #15803d; }
    .status-badge.REVERSED { background: #fee2e2; color: #b91c1c; }

    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
    }

    .btn-action {
      background: transparent;
      border: 1px solid var(--border-default);
      border-radius: 4px;
      padding: 0.3rem 0.4rem;
      cursor: pointer;
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
    }

    .btn-action:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .btn-action.btn-pay {
      color: var(--brand-600);
      border-color: rgba(37, 99, 235, 0.2);
    }
    .btn-action.btn-pay:hover {
      background: rgba(37, 99, 235, 0.08);
    }

    .btn-action.btn-reject {
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.2);
    }
    .btn-action.btn-reject:hover {
      background: rgba(239, 68, 68, 0.08);
    }

    /* Offcanvas Drawers */
    .offcanvas-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      z-index: 50;
    }

    .offcanvas-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-width: 620px;
      background: var(--bg-surface);
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
      z-index: 55;
      display: flex;
      flex-direction: column;
    }

    .offcanvas-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-default);
    }

    .offcanvas-header-left {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .offcanvas-icon-pill {
      width: 42px;
      height: 42px;
      border-radius: 8px;
      background: rgba(37, 99, 235, 0.1);
      color: var(--brand-600);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .offcanvas-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin: 0;
    }

    .offcanvas-subtitle {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin: 0.2rem 0 0 0;
    }

    .btn-offcanvas-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      color: var(--text-muted);
      cursor: pointer;
    }

    .offcanvas-body {
      flex: 1;
      padding: 1.5rem;
      overflow-y: auto;
    }

    .payment-context-card {
      background: #f8fafc;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .context-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .context-item {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .context-item.highlight {
      grid-column: span 2;
      border-top: 1px dashed var(--border-default);
      padding-top: 0.5rem;
    }

    .context-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
    }

    .context-val {
      font-size: 0.875rem;
      color: var(--text-primary);
    }

    .form-row {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-bottom: 1rem;
    }

    .form-group label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

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
      left: 0.75rem;
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .input-with-currency input {
      padding-left: 3rem !important;
    }

    .form-error-hint {
      color: #ef4444;
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .live-preview-box {
      background: rgba(37, 99, 235, 0.03);
      border: 1px solid rgba(37, 99, 235, 0.15);
      border-radius: var(--radius-md);
      padding: 0.85rem 1rem;
      margin-bottom: 1.25rem;
    }

    .preview-line {
      display: flex;
      justify-content: space-between;
      font-size: 0.8125rem;
      margin-bottom: 0.35rem;
      color: var(--text-secondary);
    }

    .preview-line.deduction {
      color: #ef4444;
    }

    .preview-divider {
      height: 1px;
      background: rgba(37, 99, 235, 0.15);
      margin: 0.5rem 0;
    }

    .preview-line.total {
      font-size: 0.9375rem;
      color: var(--text-primary);
      margin-bottom: 0;
    }

    .offcanvas-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-default);
    }

    .history-table {
      font-size: 0.8125rem;
    }

    .reversed-row {
      background-color: #fef2f2;
      opacity: 0.8;
    }

    .strikethrough {
      text-decoration: line-through;
      color: #94a3b8;
    }

    /* Modal Dialog */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      z-index: 60;
    }

    .modal-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 480px;
      background: var(--bg-surface);
      border-radius: var(--radius-md);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      z-index: 65;
      padding: 1.5rem;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .modal-close {
      background: transparent;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
    }

    .modal-warning {
      color: var(--text-primary);
      font-size: 0.9375rem;
      line-height: 1.4;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }

    .empty-icon {
      font-size: 3rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .spinner-sm {
      width: 14px;
      height: 14px;
      border-width: 2px;
      display: inline-block;
    }
  `],
})
export class ReceivablesComponent implements OnInit {
  public loading = signal<boolean>(true);
  public receivables = signal<ReceivableInvoiceDto[]>([]);
  public summary = signal<ReceivablesSummaryDto>({
    totalOutstanding: 0,
    overdueAmount: 0,
    partiallyPaidCount: 0,
    dueThisMonthAmount: 0,
    totalReceivablesCount: 0,
  });

  public clients = signal<ClientDto[]>([]);
  public projects = signal<ProjectDto[]>([]);

  public filterClientId = signal<string>('');
  public filterProjectId = signal<string>('');
  public filterStatus = signal<string>('all');
  public searchTerm = signal<string>('');

  public activeDrawer = signal<'none' | 'record-payment' | 'view-payment-history'>('none');
  public selectedReceivable = signal<ReceivableInvoiceDto | null>(null);
  public paymentHistory = signal<PaymentDto[]>([]);
  public paymentHistoryLoading = signal<boolean>(false);

  public submittingPayment = signal<boolean>(false);
  public submittingReversal = signal<boolean>(false);

  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

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

  // Reversal Dialog State
  public reversalTargetPayment = signal<PaymentDto | null>(null);
  public reversalReasonText = signal<string>('');

  // RBAC checks
  public canRecordPayment = computed(() => {
    return this.authService.hasRole('super_admin') || this.authService.hasPermission('payments:create');
  });

  public canReversePayment = computed(() => {
    return this.authService.hasRole('super_admin') || this.authService.hasPermission('payments:reverse');
  });

  // Filtered projects based on client selection
  public filteredProjects = computed(() => {
    const selectedClientId = this.filterClientId();
    if (!selectedClientId) return this.projects();
    return this.projects().filter((p) => p.clientId === selectedClientId);
  });

  // Search filtered receivables
  public filteredReceivables = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.receivables();

    return this.receivables().filter((r) => {
      return (
        r.invoiceNumber.toLowerCase().includes(term) ||
        r.clientName.toLowerCase().includes(term) ||
        r.projectName.toLowerCase().includes(term)
      );
    });
  });

  // Live calculation of remaining balance preview
  public remainingBalancePreview = computed(() => {
    const rec = this.selectedReceivable();
    if (!rec) return 0;
    const paymentAmt = Number(this.paymentForm.amount || 0);
    return Math.max(0, Math.round((rec.outstanding - paymentAmt + Number.EPSILON) * 100) / 100);
  });

  constructor(
    private paymentService: PaymentService,
    private masterService: MasterService,
    public authService: AuthService,
    private router: Router,
  ) {}

  public ngOnInit(): void {
    this.loadMasters();
    this.loadReceivables();
  }

  public loadMasters(): void {
    this.masterService.getClients().subscribe({
      next: (res) => this.clients.set(res.data || []),
      error: (err) => console.error('Failed to load clients:', err),
    });

    this.masterService.getProjects().subscribe({
      next: (res) => this.projects.set(res.data || []),
      error: (err) => console.error('Failed to load projects:', err),
    });
  }

  public loadReceivables(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filters = {
      clientId: this.filterClientId() || undefined,
      projectId: this.filterProjectId() || undefined,
      paymentStatus: this.filterStatus() || undefined,
    };

    this.paymentService.listReceivables(filters).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.receivables.set(res.data.items || []);
        this.summary.set(
          res.data.summary || {
            totalOutstanding: 0,
            overdueAmount: 0,
            partiallyPaidCount: 0,
            dueThisMonthAmount: 0,
            totalReceivablesCount: 0,
          },
        );
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error?.message || 'Failed to load receivables ledger.');
      },
    });
  }

  public onClientChange(clientId: string): void {
    this.filterClientId.set(clientId);
    this.filterProjectId.set('');
    this.loadReceivables();
  }

  public onProjectChange(projectId: string): void {
    this.filterProjectId.set(projectId);
    this.loadReceivables();
  }

  public onStatusChange(status: string): void {
    this.filterStatus.set(status);
    this.loadReceivables();
  }

  public openRecordPaymentDrawer(item: ReceivableInvoiceDto): void {
    this.selectedReceivable.set(item);
    this.paymentForm = {
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: item.outstanding, // pre-fill full outstanding balance
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: '',
      notes: '',
    };
    this.activeDrawer.set('record-payment');
  }

  public openPaymentHistoryDrawer(item: ReceivableInvoiceDto): void {
    this.selectedReceivable.set(item);
    this.activeDrawer.set('view-payment-history');
    this.loadPaymentHistory(item.invoiceId);
  }

  public closeDrawer(): void {
    this.activeDrawer.set('none');
    this.selectedReceivable.set(null);
  }

  public loadPaymentHistory(invoiceId: string): void {
    this.paymentHistoryLoading.set(true);
    this.paymentService.getInvoicePaymentSummary(invoiceId).subscribe({
      next: (res) => {
        this.paymentHistoryLoading.set(false);
        this.paymentHistory.set(res.data.payments || []);
        // Update outstanding balance on selected item in real time
        if (this.selectedReceivable()) {
          this.selectedReceivable.set({
            ...this.selectedReceivable()!,
            paid: res.data.paid,
            outstanding: res.data.outstanding,
            paymentStatus: res.data.paymentStatus,
          });
        }
      },
      error: (err) => {
        this.paymentHistoryLoading.set(false);
        this.errorMessage.set(err.error?.error?.message || 'Failed to load payment history.');
      },
    });
  }

  public isOverpayment(): boolean {
    const rec = this.selectedReceivable();
    if (!rec) return false;
    return Number(this.paymentForm.amount || 0) > rec.outstanding;
  }

  public isFormValid(): boolean {
    const amt = Number(this.paymentForm.amount);
    return (
      !!this.paymentForm.paymentDate &&
      amt > 0 &&
      !this.isOverpayment()
    );
  }

  public submitPayment(): void {
    if (!this.isFormValid() || !this.selectedReceivable()) return;

    this.submittingPayment.set(true);
    this.errorMessage.set(null);

    const dto = {
      clientId: this.selectedReceivable()!.clientId,
      invoiceId: this.selectedReceivable()!.invoiceId,
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
        this.closeDrawer();
        this.loadReceivables();
      },
      error: (err) => {
        this.submittingPayment.set(false);
        this.errorMessage.set(err.error?.error?.message || 'Failed to record payment.');
      },
    });
  }

  public openReversalModal(p: PaymentDto): void {
    this.reversalTargetPayment.set(p);
    this.reversalReasonText.set('');
  }

  public closeReversalModal(): void {
    this.reversalTargetPayment.set(null);
    this.reversalReasonText.set('');
  }

  public confirmReversal(): void {
    const target = this.reversalTargetPayment();
    if (!target) return;

    const reason = this.reversalReasonText().trim();
    if (reason.length < 5) return;

    this.submittingReversal.set(true);
    this.errorMessage.set(null);

    this.paymentService.reversePayment(target.id, reason).subscribe({
      next: (res) => {
        this.submittingReversal.set(false);
        this.successMessage.set(`Payment ${res.data.paymentNumber} has been reversed successfully.`);
        this.closeReversalModal();
        if (this.selectedReceivable()) {
          this.loadPaymentHistory(this.selectedReceivable()!.invoiceId);
        }
        this.loadReceivables();
      },
      error: (err) => {
        this.submittingReversal.set(false);
        this.errorMessage.set(err.error?.error?.message || 'Failed to reverse payment.');
      },
    });
  }
}
