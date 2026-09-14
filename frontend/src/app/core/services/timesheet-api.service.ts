import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  FillStandardHoursDto,
  FillStandardHoursResultDto,
  TimesheetProjectEmployeeDto,
  TimesheetDesignationFilterDto,
  TimesheetSupervisorDto,
  AssignWorkerDto,
  EmployeeAssignmentDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class TimesheetApiService {
  private readonly baseUrl = `${environment.apiUrl}/timesheet`;

  constructor(private http: HttpClient) {}

  public getProjectSupervisors(
    projectId: string,
  ): Observable<ApiSuccessResponse<TimesheetSupervisorDto[]>> {
    return this.http.get<ApiSuccessResponse<TimesheetSupervisorDto[]>>(
      `${this.baseUrl}/projects/${projectId}/supervisors`,
    );
  }

  public getProjectDesignations(
    projectId: string,
  ): Observable<ApiSuccessResponse<TimesheetDesignationFilterDto[]>> {
    return this.http.get<ApiSuccessResponse<TimesheetDesignationFilterDto[]>>(
      `${this.baseUrl}/projects/${projectId}/designations`,
    );
  }

  public getProjectEmployees(
    projectId: string,
    designationId?: string,
  ): Observable<ApiSuccessResponse<TimesheetProjectEmployeeDto[]>> {
    let params = new HttpParams();
    if (designationId) params = params.set('designationId', designationId);
    return this.http.get<ApiSuccessResponse<TimesheetProjectEmployeeDto[]>>(
      `${this.baseUrl}/projects/${projectId}/employees`,
      { params },
    );
  }

  public fillStandardHours(
    dto: FillStandardHoursDto,
  ): Observable<ApiSuccessResponse<FillStandardHoursResultDto>> {
    return this.http.post<ApiSuccessResponse<FillStandardHoursResultDto>>(
      `${this.baseUrl}/fill-standard`,
      dto,
    );
  }

  public assignWorker(
    projectId: string,
    dto: AssignWorkerDto,
  ): Observable<ApiSuccessResponse<EmployeeAssignmentDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeAssignmentDto>>(
      `${this.baseUrl}/projects/${projectId}/assign-worker`,
      dto,
    );
  }
}
