import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  DocumentTypeDto,
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
  EmployeeDocumentDto,
  VerifyDocumentDto,
  DocumentStatsDto,
  DocumentFilterParams,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Document Types
  public getDocumentTypes(): Observable<ApiSuccessResponse<DocumentTypeDto[]>> {
    return this.http.get<ApiSuccessResponse<DocumentTypeDto[]>>(`${this.apiUrl}/document-types`);
  }

  public getDocumentTypeById(id: string): Observable<ApiSuccessResponse<DocumentTypeDto>> {
    return this.http.get<ApiSuccessResponse<DocumentTypeDto>>(`${this.apiUrl}/document-types/${id}`);
  }

  public createDocumentType(
    dto: CreateDocumentTypeDto,
  ): Observable<ApiSuccessResponse<DocumentTypeDto>> {
    return this.http.post<ApiSuccessResponse<DocumentTypeDto>>(`${this.apiUrl}/document-types`, dto);
  }

  public updateDocumentType(
    id: string,
    dto: UpdateDocumentTypeDto,
  ): Observable<ApiSuccessResponse<DocumentTypeDto>> {
    return this.http.put<ApiSuccessResponse<DocumentTypeDto>>(`${this.apiUrl}/document-types/${id}`, dto);
  }

  // Documents
  public getDocuments(filter?: DocumentFilterParams): Observable<ApiSuccessResponse<EmployeeDocumentDto[]>> {
    let params = new HttpParams();
    if (filter) {
      if (filter.employeeId) params = params.set('employeeId', filter.employeeId);
      if (filter.documentTypeId) params = params.set('documentTypeId', filter.documentTypeId);
      if (filter.verificationStatus) params = params.set('verificationStatus', filter.verificationStatus);
      if (filter.expiryStatus) params = params.set('expiryStatus', filter.expiryStatus);
    }
    return this.http.get<ApiSuccessResponse<EmployeeDocumentDto[]>>(`${this.apiUrl}/documents`, {
      params,
    });
  }

  public getMyDocuments(): Observable<ApiSuccessResponse<EmployeeDocumentDto[]>> {
    return this.http.get<ApiSuccessResponse<EmployeeDocumentDto[]>>(`${this.apiUrl}/documents/my-documents`);
  }

  public getDocumentStats(): Observable<ApiSuccessResponse<DocumentStatsDto>> {
    return this.http.get<ApiSuccessResponse<DocumentStatsDto>>(`${this.apiUrl}/documents/stats`);
  }

  public getDocumentById(id: string): Observable<ApiSuccessResponse<EmployeeDocumentDto>> {
    return this.http.get<ApiSuccessResponse<EmployeeDocumentDto>>(`${this.apiUrl}/documents/${id}`);
  }

  public uploadDocument(formData: FormData): Observable<ApiSuccessResponse<EmployeeDocumentDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeDocumentDto>>(`${this.apiUrl}/documents`, formData);
  }

  public verifyDocument(
    id: string,
    dto: VerifyDocumentDto,
  ): Observable<ApiSuccessResponse<EmployeeDocumentDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeDocumentDto>>(
      `${this.apiUrl}/documents/${id}/verify`,
      {
        status: dto.verificationStatus,
        remarks: dto.verificationRemarks,
      },
    );
  }

  public getDownloadUrl(id: string): string {
    return `${this.apiUrl}/documents/${id}/download`;
  }
}
