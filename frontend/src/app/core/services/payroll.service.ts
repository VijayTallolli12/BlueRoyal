import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  PayrollPeriodDto,
  CreatePayrollPeriodDto,
  PayrollItemDto,
  PayrollItemLineDto,
  PayrollItemDetailDto,
  AddPayrollAdjustmentDto,
  UnlockPayrollPeriodDto,
  EmployeePayslipDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class PayrollService {
  private readonly baseUrl = `${environment.apiUrl}/payroll`;

  constructor(private http: HttpClient) {}

  // ==========================================
  // Operational Payroll Periods
  // ==========================================

  public listPeriods(): Observable<ApiSuccessResponse<PayrollPeriodDto[]>> {
    return this.http.get<ApiSuccessResponse<PayrollPeriodDto[]>>(`${this.baseUrl}/periods`);
  }

  public getPeriod(id: string): Observable<ApiSuccessResponse<PayrollPeriodDto>> {
    return this.http.get<ApiSuccessResponse<PayrollPeriodDto>>(`${this.baseUrl}/periods/${id}`);
  }

  public createPeriod(dto: CreatePayrollPeriodDto): Observable<ApiSuccessResponse<PayrollPeriodDto>> {
    return this.http.post<ApiSuccessResponse<PayrollPeriodDto>>(`${this.baseUrl}/periods`, dto);
  }

  public calculatePeriod(id: string): Observable<ApiSuccessResponse<PayrollPeriodDto>> {
    return this.http.post<ApiSuccessResponse<PayrollPeriodDto>>(`${this.baseUrl}/periods/${id}/calculate`, {});
  }

  public getPeriodItems(
    id: string,
    query?: { status?: string; remunerationBasis?: string; search?: string },
  ): Observable<ApiSuccessResponse<PayrollItemDto[]>> {
    let params = new HttpParams();
    if (query?.status) params = params.set('status', query.status);
    if (query?.remunerationBasis) params = params.set('remunerationBasis', query.remunerationBasis);
    if (query?.search) params = params.set('search', query.search);
    return this.http.get<ApiSuccessResponse<PayrollItemDto[]>>(`${this.baseUrl}/periods/${id}/items`, { params });
  }

  public getItemDetail(id: string, itemId: string): Observable<ApiSuccessResponse<PayrollItemDetailDto>> {
    return this.http.get<ApiSuccessResponse<PayrollItemDetailDto>>(`${this.baseUrl}/periods/${id}/items/${itemId}`);
  }

  // ==========================================
  // Manual Adjustments
  // ==========================================

  public addAdjustment(
    id: string,
    itemId: string,
    dto: AddPayrollAdjustmentDto,
  ): Observable<ApiSuccessResponse<PayrollItemLineDto>> {
    return this.http.post<ApiSuccessResponse<PayrollItemLineDto>>(
      `${this.baseUrl}/periods/${id}/items/${itemId}/adjustments`,
      dto,
    );
  }

  public deleteAdjustment(
    id: string,
    itemId: string,
    lineId: string,
  ): Observable<ApiSuccessResponse<{ success: boolean; message: string }>> {
    return this.http.delete<ApiSuccessResponse<{ success: boolean; message: string }>>(
      `${this.baseUrl}/periods/${id}/items/${itemId}/adjustments/${lineId}`,
    );
  }

  // ==========================================
  // Lifecycle Transitions & Controlled Unlock
  // ==========================================

  public reviewPeriod(id: string): Observable<ApiSuccessResponse<PayrollPeriodDto>> {
    return this.http.post<ApiSuccessResponse<PayrollPeriodDto>>(`${this.baseUrl}/periods/${id}/review`, {});
  }

  public finalizePeriod(id: string): Observable<ApiSuccessResponse<PayrollPeriodDto>> {
    return this.http.post<ApiSuccessResponse<PayrollPeriodDto>>(`${this.baseUrl}/periods/${id}/finalize`, {});
  }

  public unlockPeriod(id: string, dto: UnlockPayrollPeriodDto): Observable<ApiSuccessResponse<PayrollPeriodDto>> {
    return this.http.post<ApiSuccessResponse<PayrollPeriodDto>>(`${this.baseUrl}/periods/${id}/unlock`, dto);
  }

  // ==========================================
  // Employee Self-Service
  // ==========================================

  public getMyPayroll(): Observable<ApiSuccessResponse<PayrollItemDto[]>> {
    return this.http.get<ApiSuccessResponse<PayrollItemDto[]>>(`${this.baseUrl}/my-payroll`);
  }

  public getMyPayslip(periodId: string): Observable<ApiSuccessResponse<EmployeePayslipDto>> {
    return this.http.get<ApiSuccessResponse<EmployeePayslipDto>>(`${this.baseUrl}/my-payroll/${periodId}`);
  }
}
