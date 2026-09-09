import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  EmployeeOnboardingDto,
  StartOnboardingDto,
  UpdateOnboardingProgressDto,
  CompleteOnboardingDto,
  OnboardingStatsDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  public getOnboardings(status?: string): Observable<ApiSuccessResponse<EmployeeOnboardingDto[]>> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ApiSuccessResponse<EmployeeOnboardingDto[]>>(`${this.apiUrl}/onboarding`, {
      params,
    });
  }

  public getOnboardingById(id: string): Observable<ApiSuccessResponse<EmployeeOnboardingDto>> {
    return this.http.get<ApiSuccessResponse<EmployeeOnboardingDto>>(`${this.apiUrl}/onboarding/${id}`);
  }

  public getOnboardingByEmployeeId(
    employeeId: string,
  ): Observable<ApiSuccessResponse<EmployeeOnboardingDto>> {
    return this.http.get<ApiSuccessResponse<EmployeeOnboardingDto>>(
      `${this.apiUrl}/onboarding/employee/${employeeId}`,
    );
  }

  public startOnboarding(
    dto: StartOnboardingDto,
  ): Observable<ApiSuccessResponse<EmployeeOnboardingDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeOnboardingDto>>(`${this.apiUrl}/onboarding`, dto);
  }

  public refreshReadiness(id: string): Observable<ApiSuccessResponse<EmployeeOnboardingDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeOnboardingDto>>(
      `${this.apiUrl}/onboarding/${id}/refresh`,
      {},
    );
  }

  public updateProgress(
    id: string,
    dto: UpdateOnboardingProgressDto,
  ): Observable<ApiSuccessResponse<EmployeeOnboardingDto>> {
    return this.http.put<ApiSuccessResponse<EmployeeOnboardingDto>>(
      `${this.apiUrl}/onboarding/${id}`,
      dto,
    );
  }

  public completeOnboarding(
    id: string,
    dto: CompleteOnboardingDto,
  ): Observable<ApiSuccessResponse<EmployeeOnboardingDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeOnboardingDto>>(
      `${this.apiUrl}/onboarding/${id}/complete`,
      dto,
    );
  }
}
