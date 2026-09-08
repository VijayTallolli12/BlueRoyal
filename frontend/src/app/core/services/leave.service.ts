import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  LeaveTypeDto,
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  EmployeeLeaveBalanceDto,
  AllocateLeaveBalanceDto,
  LeaveBalanceQueryDto,
  LeaveRequestDto,
  CreateLeaveRequestDto,
  LeaveRequestQueryDto,
  MyLeaveOverviewDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class LeaveService {
  private readonly baseUrl = `${environment.apiUrl}/leave`;

  constructor(private http: HttpClient) {}

  // ==========================================
  // Employee Self-Service
  // ==========================================

  public getMyLeaveOverview(year?: number): Observable<ApiSuccessResponse<MyLeaveOverviewDto>> {
    let params = new HttpParams();
    if (year) params = params.set('year', String(year));
    return this.http.get<ApiSuccessResponse<MyLeaveOverviewDto>>(`${this.baseUrl}/my-leave`, {
      params,
    });
  }

  public submitMyLeave(dto: CreateLeaveRequestDto): Observable<ApiSuccessResponse<LeaveRequestDto>> {
    return this.http.post<ApiSuccessResponse<LeaveRequestDto>>(`${this.baseUrl}/my-leave`, dto);
  }

  public cancelMyLeave(id: string): Observable<ApiSuccessResponse<LeaveRequestDto>> {
    return this.http.post<ApiSuccessResponse<LeaveRequestDto>>(
      `${this.baseUrl}/my-leave/${id}/cancel`,
      {},
    );
  }

  // ==========================================
  // Leave Types
  // ==========================================

  public listLeaveTypes(includeInactive = false): Observable<ApiSuccessResponse<LeaveTypeDto[]>> {
    let params = new HttpParams();
    if (includeInactive) params = params.set('includeInactive', 'true');
    return this.http.get<ApiSuccessResponse<LeaveTypeDto[]>>(`${this.baseUrl}/types`, { params });
  }

  public createLeaveType(dto: CreateLeaveTypeDto): Observable<ApiSuccessResponse<LeaveTypeDto>> {
    return this.http.post<ApiSuccessResponse<LeaveTypeDto>>(`${this.baseUrl}/types`, dto);
  }

  public updateLeaveType(
    id: string,
    dto: UpdateLeaveTypeDto,
  ): Observable<ApiSuccessResponse<LeaveTypeDto>> {
    return this.http.put<ApiSuccessResponse<LeaveTypeDto>>(`${this.baseUrl}/types/${id}`, dto);
  }

  public deleteLeaveType(id: string): Observable<ApiSuccessResponse<{ message: string }>> {
    return this.http.delete<ApiSuccessResponse<{ message: string }>>(`${this.baseUrl}/types/${id}`);
  }

  // ==========================================
  // Leave Balances
  // ==========================================

  public listBalances(
    query?: LeaveBalanceQueryDto,
  ): Observable<ApiSuccessResponse<EmployeeLeaveBalanceDto[]>> {
    let params = new HttpParams();
    if (query?.employeeId) params = params.set('employeeId', query.employeeId);
    if (query?.leaveTypeId) params = params.set('leaveTypeId', query.leaveTypeId);
    if (query?.year) params = params.set('year', String(query.year));

    return this.http.get<ApiSuccessResponse<EmployeeLeaveBalanceDto[]>>(
      `${this.baseUrl}/balances`,
      { params },
    );
  }

  public allocateBalance(
    dto: AllocateLeaveBalanceDto,
  ): Observable<ApiSuccessResponse<EmployeeLeaveBalanceDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeLeaveBalanceDto>>(
      `${this.baseUrl}/balances/allocate`,
      dto,
    );
  }

  // ==========================================
  // Leave Requests (Administrative)
  // ==========================================

  public listRequests(
    query?: LeaveRequestQueryDto,
  ): Observable<ApiSuccessResponse<LeaveRequestDto[]>> {
    let params = new HttpParams();
    if (query?.employeeId) params = params.set('employeeId', query.employeeId);
    if (query?.leaveTypeId) params = params.set('leaveTypeId', query.leaveTypeId);
    if (query?.status) params = params.set('status', query.status);
    if (query?.year) params = params.set('year', String(query.year));
    if (query?.page) params = params.set('page', String(query.page));
    if (query?.limit) params = params.set('limit', String(query.limit));

    return this.http.get<ApiSuccessResponse<LeaveRequestDto[]>>(`${this.baseUrl}/requests`, {
      params,
    });
  }

  public getRequestById(id: string): Observable<ApiSuccessResponse<LeaveRequestDto>> {
    return this.http.get<ApiSuccessResponse<LeaveRequestDto>>(`${this.baseUrl}/requests/${id}`);
  }

  public createRequest(dto: CreateLeaveRequestDto): Observable<ApiSuccessResponse<LeaveRequestDto>> {
    return this.http.post<ApiSuccessResponse<LeaveRequestDto>>(`${this.baseUrl}/requests`, dto);
  }

  public approveRequest(id: string): Observable<ApiSuccessResponse<LeaveRequestDto>> {
    return this.http.post<ApiSuccessResponse<LeaveRequestDto>>(
      `${this.baseUrl}/requests/${id}/approve`,
      {},
    );
  }

  public rejectRequest(
    id: string,
    rejectionReason: string,
  ): Observable<ApiSuccessResponse<LeaveRequestDto>> {
    return this.http.post<ApiSuccessResponse<LeaveRequestDto>>(
      `${this.baseUrl}/requests/${id}/reject`,
      { rejectionReason },
    );
  }

  public cancelRequest(
    id: string,
    cancellationReason?: string,
  ): Observable<ApiSuccessResponse<LeaveRequestDto>> {
    return this.http.post<ApiSuccessResponse<LeaveRequestDto>>(
      `${this.baseUrl}/requests/${id}/cancel`,
      { cancellationReason },
    );
  }
}
