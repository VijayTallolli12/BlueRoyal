import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DocumentService } from '../../core/services/document.service';
import { MasterService } from '../../core/services/master.service';
import { AuthService } from '../../core/services/auth.service';
import { AppShellComponent } from '../../core/layout/app-shell.component';
import {
  EmployeeDocumentDto,
  DocumentTypeDto,
  DocumentStatsDto,
  EmployeeDto,
  VerifyDocumentDto,
} from '@blue-royal/contracts';

@Component({
  selector: 'app-document-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="doc-workspace">
        <!-- Header -->
        <div class="page-header">
          <div>
            <div class="breadcrumb">PEOPLE / DOCUMENT CENTER</div>
            <h1 class="page-title">Workforce Document & Expiry Management</h1>
            <h1 class="page-title">Documents</h1>
            <p class="page-desc">
              Centralized repository for statutory employee records (Passport, Visa, Emirates ID, Labor Card, Driving License). Enforce cryptographic verification and deterministic expiry alerting.
              Manage employee compliance documents, statutory records, and expiration tracking.
            </p>
          </div>
          <div class="header-actions">
            @if (authService.hasPermission('documents:write')) {
              <button class="btn btn-primary" (click)="openUploadDrawer()">
                <span class="material-symbols-outlined icon-sm">upload_file</span>
                <span>Upload Document</span>
              </button>
            }
            <button class="btn btn-secondary" (click)="loadData()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- Metric Pulse Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Total Repository</span>
            <span class="kpi-value">{{ stats()?.totalDocuments || 0 }}</span>
            <span class="kpi-sub">Active documents stored</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Critical Expiry (≤30 Days)</span>
            <span class="kpi-value text-accent">{{ stats()?.criticalExpiryCount || 0 }}</span>
            <span class="kpi-sub">Immediate renewal required</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Expired Documents</span>
            <span class="kpi-value text-danger">{{ stats()?.expiredCount || 0 }}</span>
            <span class="kpi-sub">Out-of-compliance records</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Pending Verification</span>
            <span class="kpi-value text-warning">{{ stats()?.pendingCount || 0 }}</span>
            <span class="kpi-sub">Awaiting HR review</span>
          </div>
        </div>

        <!-- Alert Banners -->
        @if (errorMessage()) {
          <div class="alert alert-danger" role="alert">
            <span class="material-symbols-outlined icon-sm">error</span>
            <span>{{ errorMessage() }}</span>
            <button type="button" class="alert-close" (click)="errorMessage.set(null)">×</button>
          </div>
        }
        @if (successMessage()) {
          <div class="alert alert-success" role="alert">
            <span class="material-symbols-outlined icon-sm">check_circle</span>
            <span>{{ successMessage() }}</span>
            <button type="button" class="alert-close" (click)="successMessage.set(null)">×</button>
          </div>
        }

        <!-- Filter Bar -->
        <div class="filter-bar">
          <div class="section-title-wrap">
            <h3 class="section-title">Documents</h3>
          </div>
          <div class="tabs">
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'all'"
              (click)="setTab('all')"
            >
              All Documents ({{ documents().length }})
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'critical'"
              (click)="setTab('critical')"
            >
              Expiring Soon ({{ stats()?.criticalExpiryCount || 0 }})
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'expired'"
              (click)="setTab('expired')"
            >
              Expired ({{ stats()?.expiredCount || 0 }})
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'pending'"
              (click)="setTab('pending')"
            >
              Pending Verification ({{ stats()?.pendingCount || 0 }})
            </button>
          </div>

          <div class="search-box">
            <span class="material-symbols-outlined icon-sm search-icon">search</span>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Search by employee, doc number, filename..."
              class="form-control"
            />
          </div>
        </div>

        <!-- Table Container -->
        <div class="table-container">
          @if (isLoading()) {
            <div class="loading-state">
              <div class="skeleton skeleton-row"></div>
              <div class="skeleton skeleton-row"></div>
              <div class="skeleton skeleton-row"></div>
            </div>
          } @else if (filteredDocuments().length === 0) {
            <div class="empty-state">
              <span class="material-symbols-outlined icon-lg text-muted">folder_open</span>
              <p>No documents found matching the criteria.</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-sticky-left">Employee</th>
                    <th>Document Type</th>
                    <th>Document Number</th>
                    <th>Expiry Date</th>
                    <th>Expiry Status</th>
                    <th class="col-hide-mobile">Verification</th>
                    <th class="col-hide-tablet">File Name</th>
                    <th class="col-sticky-right text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (doc of filteredDocuments(); track doc.id) {
                    <tr>
                      <td class="col-sticky-left">
                        <div class="emp-profile-cell">
                          <div class="emp-avatar">
                            {{ doc.employeeName ? doc.employeeName.charAt(0) : 'E' }}
                          </div>
                          <div class="emp-info">
                            <span class="font-medium text-primary">{{ doc.employeeName || '—' }}</span>
                            <span class="text-xs text-muted">{{ doc.employeeCode || '—' }}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="badge-type">{{ doc.documentTypeName || doc.documentTypeCode || 'General' }}</span>
                      </td>
                      <td>
                        <span class="font-mono text-sm">{{ doc.documentNumber || '—' }}</span>
                      </td>
                      <td>
                        @if (doc.expiryDate) {
                          <div class="expiry-cell">
                            <span class="text-sm">{{ doc.expiryDate }}</span>
                            @if (doc.daysRemaining !== null && doc.daysRemaining !== undefined) {
                              <span class="days-pill" [class.days-danger]="doc.daysRemaining < 0" [class.days-warning]="doc.daysRemaining >= 0 && doc.daysRemaining <= 30">
                                {{ doc.daysRemaining < 0 ? (doc.daysRemaining * -1) + 'd ago' : doc.daysRemaining + 'd left' }}
                              </span>
                            }
                          </div>
                        } @else {
                          <span class="text-muted">No Expiry</span>
                        }
                      </td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-approved]="doc.expiryStatus === 'valid'"
                          [class.status-pending]="doc.expiryStatus === 'approaching_expiry'"
                          [class.status-warning]="doc.expiryStatus === 'critical_expiry'"
                          [class.status-rejected]="doc.expiryStatus === 'expired'"
                        >
                          {{ doc.expiryStatus | uppercase }}
                        </span>
                      </td>
                      <td class="col-hide-mobile">
                        <span
                          class="verify-badge"
                          [class.verified]="doc.verificationStatus === 'verified'"
                          [class.rejected]="doc.verificationStatus === 'rejected'"
                          [class.pending]="doc.verificationStatus === 'pending'"
                        >
                          <span class="material-symbols-outlined icon-xs">
                            {{ doc.verificationStatus === 'verified' ? 'verified' : doc.verificationStatus === 'rejected' ? 'cancel' : 'pending' }}
                          </span>
                          <span>{{ doc.verificationStatus | uppercase }}</span>
                        </span>
                      </td>
                      <td class="col-hide-tablet">
                        <span class="file-name text-truncate" [title]="doc.fileName">
                          {{ doc.fileName }}
                        </span>
                      </td>
                      <td class="col-sticky-right text-right">
                        <div class="action-btn-group">
                          <a
                            [href]="documentService.getDownloadUrl(doc.id)"
                            target="_blank"
                            class="btn btn-secondary btn-sm"
                            title="Download Physical Document"
                          >
                            <span class="material-symbols-outlined icon-sm">download</span>
                          </a>

                          @if (authService.hasPermission('documents:verify') && doc.verificationStatus === 'pending') {
                            <button
                              type="button"
                              class="btn btn-success btn-sm"
                              (click)="openVerifyModal(doc, 'verified')"
                              title="Verify Document"
                            >
                              <span class="material-symbols-outlined icon-sm">check</span>
                            </button>
                            <button
                              type="button"
                              class="btn btn-danger btn-sm"
                              (click)="openVerifyModal(doc, 'rejected')"
                              title="Reject Document"
                            >
                              <span class="material-symbols-outlined icon-sm">close</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      <!-- DRAWER: UPLOAD DOCUMENT -->
      @if (isUploadDrawerOpen()) {
        <div class="drawer-backdrop" (click)="isUploadDrawerOpen.set(false)">
          <div class="drawer-panel" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <div class="drawer-header-content">
                <h2 class="drawer-title">Upload Statutory Document</h2>
                <p class="drawer-subtitle">
                  Upload PDF, JPEG, or PNG document and register metadata.
                </p>
              </div>
              <button type="button" class="drawer-close" (click)="isUploadDrawerOpen.set(false)">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <div class="drawer-body">
              <form (ngSubmit)="onUploadSubmit()" class="drawer-form" id="uploadForm">
                <div class="form-group">
                  <label for="docEmp">Select Employee *</label>
                  <select
                    id="docEmp"
                    [(ngModel)]="uploadPayload.employeeId"
                    name="employeeId"
                    required
                    class="form-control"
                  >
                    <option value="">-- Choose Employee --</option>
                    @for (emp of employees(); track emp.id) {
                      <option [value]="emp.id">
                        {{ emp.employeeCode }} — {{ emp.firstName }} {{ emp.lastName }}
                      </option>
                    }
                  </select>
                </div>

                <div class="form-group">
                  <label for="docType">Document Type *</label>
                  <select
                    id="docType"
                    [(ngModel)]="uploadPayload.documentTypeId"
                    name="documentTypeId"
                    required
                    class="form-control"
                  >
                    <option value="">-- Choose Document Type --</option>
                    @for (dt of documentTypes(); track dt.id) {
                      <option [value]="dt.id">
                        {{ dt.name }} ({{ dt.code }}) {{ dt.isMandatoryForOnboarding ? '• MANDATORY' : '' }}
                      </option>
                    }
                  </select>
                </div>

                <div class="form-group">
                  <label for="docNum">Document / Registration Number</label>
                  <input
                    id="docNum"
                    type="text"
                    [(ngModel)]="uploadPayload.documentNumber"
                    name="documentNumber"
                    placeholder="e.g. 784-1990-1234567-1"
                    class="form-control"
                  />
                </div>

                <div class="form-grid-2">
                  <div class="form-group">
                    <label for="issueDate">Issue Date</label>
                    <input
                      id="issueDate"
                      type="date"
                      [(ngModel)]="uploadPayload.issueDate"
                      name="issueDate"
                      class="form-control"
                    />
                  </div>
                  <div class="form-group">
                    <label for="expiryDate">Expiry Date</label>
                    <input
                      id="expiryDate"
                      type="date"
                      [(ngModel)]="uploadPayload.expiryDate"
                      name="expiryDate"
                      class="form-control"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label for="fileInput">Document File (PDF, PNG, JPEG, max 10MB) *</label>
                  <input
                    id="fileInput"
                    type="file"
                    (change)="onFileSelected($event)"
                    required
                    class="form-control"
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  @if (selectedFileName()) {
                    <span class="text-xs text-primary mt-1">Selected: {{ selectedFileName() }}</span>
                  }
                </div>

                <div class="form-group">
                  <label for="docNotes">Notes & Annotations</label>
                  <textarea
                    id="docNotes"
                    [(ngModel)]="uploadPayload.notes"
                    name="notes"
                    rows="2"
                    class="form-control"
                    placeholder="Optional remarks..."
                  ></textarea>
                </div>
              </form>
            </div>

            <div class="drawer-footer">
              <button type="button" class="btn btn-secondary" (click)="isUploadDrawerOpen.set(false)">
                Cancel
              </button>
              <button
                type="submit"
                form="uploadForm"
                class="btn btn-primary"
                [disabled]="isSubmitting() || !uploadPayload.employeeId || !uploadPayload.documentTypeId || !selectedFile"
              >
                @if (isSubmitting()) {
                  <span>Uploading...</span>
                } @else {
                  <span class="material-symbols-outlined icon-sm">cloud_upload</span>
                  <span>Upload & Store</span>
                }
              </button>
            </div>
          </div>
        </div>
      }
    </app-shell>
  `,
  styles: [`
    .doc-workspace {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-default);
    }

    .breadcrumb {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.25rem 0;
    }

    .page-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin: 0;
      max-width: 800px;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .section-title-wrap {
      display: flex;
      align-items: center;
    }

    .section-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .tabs {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.5rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn.active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }

    .search-box {
      position: relative;
      min-width: 280px;
    }

    .search-icon {
      position: absolute;
      left: 0.625rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }

    .search-box input {
      padding-left: 2rem;
    }

    .emp-profile-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .emp-avatar {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: var(--brand-100);
      color: var(--brand-700);
      font-weight: 600;
      font-size: 0.8125rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .emp-info {
      display: flex;
      flex-direction: column;
    }

    .badge-type {
      font-size: 0.75rem;
      font-weight: 600;
      background: #f1f5f9;
      color: #334155;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .expiry-cell {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .days-pill {
      font-size: 0.6875rem;
      font-weight: 700;
      color: #64748b;
    }

    .days-danger {
      color: #dc2626;
    }

    .days-warning {
      color: #d97706;
    }

    .status-warning {
      background-color: #fffbeb;
      border-color: #fde68a;
      color: #b45309;
    }

    .verify-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
    }

    .verify-badge.verified {
      background: #dcfce7;
      color: #166534;
    }

    .verify-badge.rejected {
      background: #fee2e2;
      color: #991b1b;
    }

    .verify-badge.pending {
      background: #f1f5f9;
      color: #475569;
    }

    .file-name {
      max-width: 160px;
      display: inline-block;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
  `],
})
export class DocumentCenterComponent implements OnInit {
  public documents = signal<EmployeeDocumentDto[]>([]);
  public documentTypes = signal<DocumentTypeDto[]>([]);
  public employees = signal<EmployeeDto[]>([]);
  public stats = signal<DocumentStatsDto | null>(null);
  public isLoading = signal(true);
  public isSubmitting = signal(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public activeTab = signal<'all' | 'critical' | 'expired' | 'pending'>('all');
  public searchQuery = '';

  public isUploadDrawerOpen = signal(false);
  public selectedFile: File | null = null;
  public selectedFileName = signal<string | null>(null);

  public uploadPayload = {
    employeeId: '',
    documentTypeId: '',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
  };

  constructor(
    public documentService: DocumentService,
    private masterService: MasterService,
    public authService: AuthService,
  ) {}

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.documentService.getDocuments().subscribe({
      next: (res) => {
        this.documents.set(res.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to load documents');
        this.isLoading.set(false);
      },
    });

    this.documentService.getDocumentStats().subscribe({
      next: (res) => {
        this.stats.set(res.data || null);
      },
    });

    this.documentService.getDocumentTypes().subscribe({
      next: (res) => {
        this.documentTypes.set(res.data || []);
      },
    });

    this.masterService.getEmployees().subscribe({
      next: (res) => {
        this.employees.set(res.data || []);
      },
    });
  }

  public setTab(tab: 'all' | 'critical' | 'expired' | 'pending'): void {
    this.activeTab.set(tab);
  }

  public filteredDocuments = computed(() => {
    let list = this.documents();

    if (this.activeTab() === 'critical') {
      list = list.filter((d) => d.expiryStatus === 'critical_expiry');
    } else if (this.activeTab() === 'expired') {
      list = list.filter((d) => d.expiryStatus === 'expired');
    } else if (this.activeTab() === 'pending') {
      list = list.filter((d) => d.verificationStatus === 'pending');
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          (d.employeeName && d.employeeName.toLowerCase().includes(q)) ||
          (d.documentNumber && d.documentNumber.toLowerCase().includes(q)) ||
          (d.fileName && d.fileName.toLowerCase().includes(q)) ||
          (d.documentTypeName && d.documentTypeName.toLowerCase().includes(q)),
      );
    }

    return list;
  });

  public openUploadDrawer(): void {
    this.uploadPayload = {
      employeeId: '',
      documentTypeId: '',
      documentNumber: '',
      issueDate: '',
      expiryDate: '',
      notes: '',
    };
    this.selectedFile = null;
    this.selectedFileName.set(null);
    this.isUploadDrawerOpen.set(true);
  }

  public onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.selectedFileName.set(file.name);
    }
  }

  public onUploadSubmit(): void {
    if (!this.selectedFile || !this.uploadPayload.employeeId || !this.uploadPayload.documentTypeId) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formData = new FormData();
    formData.append('employeeId', this.uploadPayload.employeeId);
    formData.append('documentTypeId', this.uploadPayload.documentTypeId);
    if (this.uploadPayload.documentNumber) {
      formData.append('documentNumber', this.uploadPayload.documentNumber);
    }
    if (this.uploadPayload.issueDate) {
      formData.append('issueDate', this.uploadPayload.issueDate);
    }
    if (this.uploadPayload.expiryDate) {
      formData.append('expiryDate', this.uploadPayload.expiryDate);
    }
    if (this.uploadPayload.notes) {
      formData.append('notes', this.uploadPayload.notes);
    }
    formData.append('file', this.selectedFile);

    this.documentService.uploadDocument(formData).subscribe({
      next: () => {
        this.successMessage.set('Document uploaded and indexed successfully');
        this.isUploadDrawerOpen.set(false);
        this.isSubmitting.set(false);
        this.loadData();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to upload document');
        this.isSubmitting.set(false);
      },
    });
  }

  public openVerifyModal(doc: EmployeeDocumentDto, status: 'verified' | 'rejected'): void {
    const remarks = status === 'rejected' ? prompt('Enter rejection reason:') : 'Verified by HR';
    if (status === 'rejected' && !remarks) return;

    this.documentService
      .verifyDocument(doc.id, {
        verificationStatus: status,
        verificationRemarks: remarks || undefined,
      })
      .subscribe({
        next: () => {
          this.successMessage.set(`Document ${doc.fileName} marked as ${status}`);
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error?.message || 'Verification update failed');
        },
      });
  }
}
