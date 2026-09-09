import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../../core/errors/app-error';
import { DocumentType } from '../models/document-type.model';
import { EmployeeDocument } from '../models/employee-document.model';
import { Employee } from '../../masters/models/employee.model';
import { DocumentExpiryService } from './document-expiry.service';
import { AuditService } from '../../../core/audit/audit.service';
import { EmployeeDocumentDto, DocumentStatsDto, DocumentFilterParams } from '@blue-royal/contracts';

const getStorageRoot = (): string =>
  path.resolve(process.cwd(), process.env.STORAGE_PATH || 'storage/documents');

export interface UploadDocumentParams {
  employeeId: string;
  documentTypeId: string;
  documentNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  file: Express.Multer.File;
  notes?: string | null;
  actorId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class DocumentService {
  /**
   * Ensure employee storage directory exists
   */
  private static ensureStorageDir(employeeId: string): string {
    const dir = path.join(getStorageRoot(), employeeId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Save uploaded file to secure local storage abstraction
   */
  public static saveUploadedFile(employeeId: string, file: Express.Multer.File): {
    storedFileName: string;
    filePath: string;
    fileSizeBytes: number;
    mimeType: string;
  } {
    const dir = this.ensureStorageDir(employeeId);
    const ext = path.extname(file.originalname);
    const storedFileName = `${uuidv4()}${ext}`;
    const destinationPath = path.join(dir, storedFileName);

    fs.writeFileSync(destinationPath, file.buffer);

    return {
      storedFileName,
      filePath: path.relative(process.cwd(), destinationPath).replace(/\\/g, '/'),
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Enrich document model into EmployeeDocumentDto with computed expiry status
   */
  public static enrichDocument(doc: EmployeeDocument): EmployeeDocumentDto {
    const json = doc.toJSON() as any;
    const docType = doc.documentType || json.documentType;
    const employee = doc.employee || json.employee;
    const hasExpiry = docType ? docType.hasExpiry : true;

    const { status: expiryStatus, daysRemaining } = DocumentExpiryService.calculateExpiryStatus(
      json.expiryDate,
      hasExpiry,
    );

    return {
      id: json.id,
      employeeId: json.employeeId,
      employeeCode: employee?.employeeCode,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : undefined,
      documentTypeId: json.documentTypeId,
      documentTypeCode: docType?.code,
      documentTypeName: docType?.name,
      documentNumber: json.documentNumber,
      issueDate: json.issueDate,
      expiryDate: json.expiryDate,
      fileName: json.originalFileName,
      filePath: json.filePath,
      fileSizeBytes: Number(json.fileSizeBytes),
      mimeType: json.mimeType,
      verificationStatus: json.verificationStatus,
      verifiedByUserId: json.verifiedBy,
      verifiedAt: json.verifiedAt ? new Date(json.verifiedAt).toISOString() : null,
      verificationRemarks: json.rejectionReason,
      notes: json.notes,
      isActive: true,
      daysRemaining,
      expiryStatus,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * Upload / Create a new document for an employee
   */
  public static async uploadDocument(params: UploadDocumentParams): Promise<EmployeeDocumentDto> {
    const employee = await Employee.findByPk(params.employeeId);
    if (!employee) {
      throw AppError.notFound(`Employee ${params.employeeId} not found`);
    }

    const docType = await DocumentType.findByPk(params.documentTypeId);
    if (!docType) {
      throw AppError.notFound(`Document Type ${params.documentTypeId} not found`);
    }

    // Validate mime type
    const allowedMimes = docType.allowedMimeTypes || [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimes.includes(params.file.mimetype)) {
      throw AppError.badRequest(
        `File type ${params.file.mimetype} is not allowed for document type ${docType.name}. Allowed: ${allowedMimes.join(', ')}`,
      );
    }

    // Validate size
    const maxSizeBytes = docType.maxSizeBytes || 10 * 1024 * 1024;
    if (params.file.size > maxSizeBytes) {
      throw AppError.badRequest(
        `File size (${(params.file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (${(maxSizeBytes / 1024 / 1024).toFixed(2)} MB)`,
      );
    }

    // Save physical file
    const fileInfo = this.saveUploadedFile(params.employeeId, params.file);

    const newDoc = await EmployeeDocument.create({
      employeeId: params.employeeId,
      documentTypeId: params.documentTypeId,
      documentNumber: params.documentNumber || null,
      issueDate: params.issueDate || null,
      expiryDate: params.expiryDate || null,
      originalFileName: params.file.originalname,
      filePath: fileInfo.filePath,
      fileSizeBytes: fileInfo.fileSizeBytes,
      mimeType: fileInfo.mimeType,
      verificationStatus: 'pending',
      notes: params.notes || null,
    });

    await AuditService.recordEvent({
      actorId: params.actorId,
      actorIp: params.ipAddress,
      actorUserAgent: params.userAgent,
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'EmployeeDocument',
      resourceId: newDoc.id,
      newValues: {
        employeeId: newDoc.employeeId,
        documentTypeId: newDoc.documentTypeId,
        fileName: newDoc.originalFileName,
      },
      correlationId: params.correlationId,
    });

    const reloaded = await EmployeeDocument.findByPk(newDoc.id, {
      include: [
        { model: DocumentType, as: 'documentType' },
        { model: Employee, as: 'employee' },
      ],
    });

    return this.enrichDocument(reloaded!);
  }

  /**
   * List documents with optional filters
   */
  public static async listDocuments(filter: DocumentFilterParams): Promise<EmployeeDocumentDto[]> {
    const where: any = {};
    if (filter.employeeId) where.employeeId = filter.employeeId;
    if (filter.documentTypeId) where.documentTypeId = filter.documentTypeId;
    if (filter.verificationStatus) where.verificationStatus = filter.verificationStatus;

    const docs = await EmployeeDocument.findAll({
      where,
      include: [
        { model: DocumentType, as: 'documentType' },
        { model: Employee, as: 'employee' },
      ],
      order: [['createdAt', 'DESC']],
    });

    let enriched = docs.map((doc) => this.enrichDocument(doc));

    if (filter.expiryStatus) {
      enriched = enriched.filter((d) => d.expiryStatus === filter.expiryStatus);
    }

    return enriched;
  }

  /**
   * Get single document by ID
   */
  public static async getDocumentById(id: string): Promise<EmployeeDocumentDto> {
    const doc = await EmployeeDocument.findByPk(id, {
      include: [
        { model: DocumentType, as: 'documentType' },
        { model: Employee, as: 'employee' },
      ],
    });
    if (!doc) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }
    return this.enrichDocument(doc);
  }

  /**
   * Verify or Reject a document
   */
  public static async verifyDocument(
    id: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string,
    verifierId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<EmployeeDocumentDto> {
    const doc = await EmployeeDocument.findByPk(id, {
      include: [
        { model: DocumentType, as: 'documentType' },
        { model: Employee, as: 'employee' },
      ],
    });
    if (!doc) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }

    if (status === 'rejected' && !rejectionReason) {
      throw AppError.badRequest('Rejection reason is required when rejecting a document');
    }

    const oldStatus = doc.verificationStatus;

    await doc.update({
      verificationStatus: status,
      verifiedBy: verifierId || null,
      verifiedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null,
    });

    await AuditService.recordEvent({
      actorId: verifierId,
      actorIp,
      actorUserAgent,
      action: status === 'verified' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
      resourceType: 'EmployeeDocument',
      resourceId: doc.id,
      oldValues: { verificationStatus: oldStatus },
      newValues: { verificationStatus: status, rejectionReason },
      correlationId,
    });

    const reloaded = await EmployeeDocument.findByPk(doc.id, {
      include: [
        { model: DocumentType, as: 'documentType' },
        { model: Employee, as: 'employee' },
      ],
    });

    return this.enrichDocument(reloaded!);
  }

  /**
   * Get Document Stats (Total, Verified, Pending, Rejected, Valid, Approaching, Critical, Expired)
   */
  public static async getDocumentStats(): Promise<DocumentStatsDto> {
    const docs = await this.listDocuments({});

    const totalDocuments = docs.length;
    let verifiedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let validCount = 0;
    let approachingExpiryCount = 0;
    let criticalExpiryCount = 0;
    let expiredCount = 0;

    for (const d of docs) {
      if (d.verificationStatus === 'verified') verifiedCount++;
      else if (d.verificationStatus === 'rejected') rejectedCount++;
      else pendingCount++;

      if (d.expiryStatus === 'valid') validCount++;
      else if (d.expiryStatus === 'approaching_expiry') approachingExpiryCount++;
      else if (d.expiryStatus === 'critical_expiry') criticalExpiryCount++;
      else if (d.expiryStatus === 'expired') expiredCount++;
    }

    return {
      totalDocuments,
      verifiedCount,
      pendingCount,
      rejectedCount,
      validCount,
      approachingExpiryCount,
      criticalExpiryCount,
      expiredCount,
    };
  }

  /**
   * Get physical file path for download
   */
  public static async getDownloadInfo(id: string): Promise<{
    absolutePath: string;
    originalFileName: string;
    mimeType: string;
    employeeId: string;
  }> {
    const doc = await EmployeeDocument.findByPk(id);
    if (!doc) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }

    const absolutePath = path.resolve(process.cwd(), doc.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw AppError.notFound('Physical document file not found on disk');
    }

    return {
      absolutePath,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
      employeeId: doc.employeeId,
    };
  }
}
