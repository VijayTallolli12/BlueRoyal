import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DocumentService } from '../../core/services/document.service';
import { AuthService } from '../../core/services/auth.service';
import { AppShellComponent } from '../../core/layout/app-shell.component';
import { EmployeeDocumentDto } from '@blue-royal/contracts';

@Component({
  selector: 'app-my-documents',
  standalone: true,
  imports: [CommonModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="my-docs-workspace">
        <div class="page-header">
          <div>
            <div class="breadcrumb">MY SELF-SERVICE / DOCUMENTS</div>
            <h1 class="page-title">My Statutory Records & Credentials</h1>
            <p class="page-desc">
              View your personal statutory filings (Passport, Visa, Emirates ID, Contracts). Review validity dates and download copies for personal records.
            </p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" (click)="loadData()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        @if (errorMessage()) {
          <div class="alert alert-danger">
            <span class="material-symbols-outlined icon-sm">error</span>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <div class="table-container">
          @if (isLoading()) {
            <div class="loading-state">
              <div class="skeleton skeleton-row"></div>
              <div class="skeleton skeleton-row"></div>
            </div>
          } @else if (documents().length === 0) {
            <div class="empty-state">
              <span class="material-symbols-outlined icon-lg text-muted">description</span>
              <p>No statutory documents registered under your profile yet.</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-sticky-left">Document Type</th>
                    <th>Document Number</th>
                    <th>Issue Date</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                    <th>Verification</th>
                    <th class="col-sticky-right text-right">Download</th>
                  </tr>
                </thead>
                <tbody>
                  @for (doc of documents(); track doc.id) {
                    <tr>
                      <td class="col-sticky-left">
                        <span class="font-medium text-primary">{{ doc.documentTypeName || doc.documentTypeCode }}</span>
                      </td>
                      <td>
                        <span class="font-mono text-sm">{{ doc.documentNumber || '—' }}</span>
                      </td>
                      <td class="text-secondary">{{ doc.issueDate || '—' }}</td>
                      <td>
                        @if (doc.expiryDate) {
                          <span class="text-sm font-mono">{{ doc.expiryDate }}</span>
                          @if (doc.daysRemaining !== null && doc.daysRemaining !== undefined) {
                            <span class="text-xs ml-1" [class.text-danger]="doc.daysRemaining < 0" [class.text-warning]="doc.daysRemaining >= 0 && doc.daysRemaining <= 30">
                              ({{ doc.daysRemaining < 0 ? (doc.daysRemaining * -1) + 'd expired' : doc.daysRemaining + 'd remaining' }})
                            </span>
                          }
                        } @else {
                          <span class="text-muted">Permanent</span>
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
                      <td>
                        <span
                          class="status-badge"
                          [class.status-approved]="doc.verificationStatus === 'verified'"
                          [class.status-pending]="doc.verificationStatus === 'pending'"
                          [class.status-rejected]="doc.verificationStatus === 'rejected'"
                        >
                          {{ doc.verificationStatus | uppercase }}
                        </span>
                      </td>
                      <td class="col-sticky-right text-right">
                        <a
                          [href]="documentService.getDownloadUrl(doc.id)"
                          target="_blank"
                          class="btn btn-secondary btn-sm"
                          title="Download Document"
                        >
                          <span class="material-symbols-outlined icon-sm">download</span>
                          <span>Download</span>
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </app-shell>
  `,
  styles: [`
    .my-docs-workspace {
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

    .status-warning {
      background-color: #fffbeb;
      border-color: #fde68a;
      color: #b45309;
    }
  `],
})
export class MyDocumentsComponent implements OnInit {
  public documents = signal<EmployeeDocumentDto[]>([]);
  public isLoading = signal(true);
  public errorMessage = signal<string | null>(null);

  constructor(
    public documentService: DocumentService,
    public authService: AuthService,
  ) {}

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.documentService.getMyDocuments().subscribe({
      next: (res) => {
        this.documents.set(res.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to load documents');
        this.isLoading.set(false);
      },
    });
  }
}
