import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  AttendancePeriodDto,
  CreateAttendancePeriodDto,
  AttendanceGridResponseDto,
  BatchUpdateAttendanceRecordsDto,
  AttendanceImportResultDto,
  AttendanceAuditLogDto,
  AttendanceRecordDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class AttendanceApiService {
  private readonly baseUrl = `${environment.apiUrl}/attendance`;

  constructor(private http: HttpClient) {}

  public listPeriods(): Observable<ApiSuccessResponse<AttendancePeriodDto[]>> {
    return this.http.get<ApiSuccessResponse<AttendancePeriodDto[]>>(`${this.baseUrl}/periods`);
  }

  public getPeriodById(id: string): Observable<ApiSuccessResponse<AttendancePeriodDto>> {
    return this.http.get<ApiSuccessResponse<AttendancePeriodDto>>(`${this.baseUrl}/periods/${id}`);
  }

  public createPeriod(dto: CreateAttendancePeriodDto): Observable<ApiSuccessResponse<AttendancePeriodDto>> {
    return this.http.post<ApiSuccessResponse<AttendancePeriodDto>>(`${this.baseUrl}/periods`, dto);
  }

  public getGrid(
    periodId: string,
    filters?: { clientId?: string; projectId?: string; employeeId?: string; hasAnomaly?: boolean },
  ): Observable<ApiSuccessResponse<AttendanceGridResponseDto>> {
    let params = new HttpParams();
    if (filters?.clientId) params = params.set('clientId', filters.clientId);
    if (filters?.projectId) params = params.set('projectId', filters.projectId);
    if (filters?.employeeId) params = params.set('employeeId', filters.employeeId);
    if (filters?.hasAnomaly !== undefined) params = params.set('hasAnomaly', String(filters.hasAnomaly));

    return this.http.get<ApiSuccessResponse<AttendanceGridResponseDto>>(`${this.baseUrl}/periods/${periodId}/grid`, {
      params,
    });
  }

  public batchUpdateRecords(
    periodId: string,
    dto: BatchUpdateAttendanceRecordsDto,
  ): Observable<ApiSuccessResponse<{ updatedCount: number; newPeriodStatus: string }>> {
    return this.http.put<ApiSuccessResponse<{ updatedCount: number; newPeriodStatus: string }>>(
      `${this.baseUrl}/periods/${periodId}/records`,
      dto,
    );
  }

  public submitPeriod(periodId: string): Observable<ApiSuccessResponse<AttendancePeriodDto>> {
    return this.http.post<ApiSuccessResponse<AttendancePeriodDto>>(`${this.baseUrl}/periods/${periodId}/submit`, {});
  }

  public approvePeriod(periodId: string): Observable<ApiSuccessResponse<AttendancePeriodDto>> {
    return this.http.post<ApiSuccessResponse<AttendancePeriodDto>>(`${this.baseUrl}/periods/${periodId}/approve`, {});
  }

  public lockPeriod(periodId: string): Observable<ApiSuccessResponse<AttendancePeriodDto>> {
    return this.http.post<ApiSuccessResponse<AttendancePeriodDto>>(`${this.baseUrl}/periods/${periodId}/lock`, {});
  }

  public unlockPeriod(periodId: string, reason: string): Observable<ApiSuccessResponse<AttendancePeriodDto>> {
    return this.http.post<ApiSuccessResponse<AttendancePeriodDto>>(`${this.baseUrl}/periods/${periodId}/unlock`, {
      reason,
    });
  }

  public downloadTemplate(periodId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/periods/${periodId}/template`, {
      responseType: 'blob',
    });
  }

  public importExcel(
    periodId: string,
    file: File,
    dryRun: boolean,
  ): Observable<ApiSuccessResponse<AttendanceImportResultDto>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiSuccessResponse<AttendanceImportResultDto>>(
      `${this.baseUrl}/periods/${periodId}/import?dryRun=${dryRun}`,
      formData,
    );
  }

  public getRecordAuditLogs(recordId: string): Observable<ApiSuccessResponse<AttendanceAuditLogDto[]>> {
    return this.http.get<ApiSuccessResponse<AttendanceAuditLogDto[]>>(`${this.baseUrl}/records/${recordId}/audit`);
  }

  public getMyAttendance(
    periodCode?: string,
  ): Observable<ApiSuccessResponse<{ period: AttendancePeriodDto; records: AttendanceRecordDto[]; summary: any }>> {
    let params = new HttpParams();
    if (periodCode) params = params.set('periodCode', periodCode);
    return this.http.get<ApiSuccessResponse<{ period: AttendancePeriodDto; records: AttendanceRecordDto[]; summary: any }>>(
      `${this.baseUrl}/my-attendance`,
      { params },
    );
  }
}
