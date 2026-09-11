import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  DesignationDto,
  CreateDesignationDto,
  ClientDto,
  CreateClientDto,
  UpdateClientDto,
  ProjectDto,
  CreateProjectDto,
  UpdateProjectDto,
  EmployeeDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeAssignmentDto,
  CreateEmployeeAssignmentDto,
  EmployeeHourlyRateDto,
  CreateEmployeeHourlyRateDto,
  ClientBillingRateDto,
  CreateClientBillingRateDto,
  ResolvedBillingRateDto,
  ShiftDto,
  CreateShiftDto,
  UpdateShiftDto,
  WeeklyOffConfigDto,
  CreateWeeklyOffConfigDto,
  PublicHolidayDto,
  CreatePublicHolidayDto,
  UpdatePublicHolidayDto,
  SalaryComponentDto,
  CreateSalaryComponentDto,
  EmployeeSalaryStructureDto,
  CreateEmployeeSalaryStructureDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class MasterService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // 1. Designations
  public getDesignations(): Observable<ApiSuccessResponse<DesignationDto[]>> {
    return this.http.get<ApiSuccessResponse<DesignationDto[]>>(`${this.apiUrl}/designations`);
  }

  public createDesignation(dto: CreateDesignationDto): Observable<ApiSuccessResponse<DesignationDto>> {
    return this.http.post<ApiSuccessResponse<DesignationDto>>(`${this.apiUrl}/designations`, dto);
  }

  // 2. Clients
  public getClients(): Observable<ApiSuccessResponse<ClientDto[]>> {
    return this.http.get<ApiSuccessResponse<ClientDto[]>>(`${this.apiUrl}/clients`);
  }

  public createClient(dto: CreateClientDto): Observable<ApiSuccessResponse<ClientDto>> {
    return this.http.post<ApiSuccessResponse<ClientDto>>(`${this.apiUrl}/clients`, dto);
  }

  public updateClient(id: string, dto: UpdateClientDto): Observable<ApiSuccessResponse<ClientDto>> {
    return this.http.put<ApiSuccessResponse<ClientDto>>(`${this.apiUrl}/clients/${id}`, dto);
  }

  // 3. Projects
  public getProjects(clientId?: string): Observable<ApiSuccessResponse<ProjectDto[]>> {
    const url = clientId ? `${this.apiUrl}/projects?clientId=${clientId}` : `${this.apiUrl}/projects`;
    return this.http.get<ApiSuccessResponse<ProjectDto[]>>(url);
  }

  public createProject(dto: CreateProjectDto): Observable<ApiSuccessResponse<ProjectDto>> {
    return this.http.post<ApiSuccessResponse<ProjectDto>>(`${this.apiUrl}/projects`, dto);
  }

  public updateProject(id: string, dto: UpdateProjectDto): Observable<ApiSuccessResponse<ProjectDto>> {
    return this.http.put<ApiSuccessResponse<ProjectDto>>(`${this.apiUrl}/projects/${id}`, dto);
  }

  // 4. Employees
  public getEmployees(): Observable<ApiSuccessResponse<EmployeeDto[]>> {
    return this.http.get<ApiSuccessResponse<EmployeeDto[]>>(`${this.apiUrl}/employees`);
  }

  public getEmployeeById(id: string): Observable<ApiSuccessResponse<EmployeeDto>> {
    return this.http.get<ApiSuccessResponse<EmployeeDto>>(`${this.apiUrl}/employees/${id}`);
  }

  public createEmployee(dto: CreateEmployeeDto): Observable<ApiSuccessResponse<EmployeeDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeDto>>(`${this.apiUrl}/employees`, dto);
  }

  public createEmployeeFormData(formData: FormData): Observable<ApiSuccessResponse<EmployeeDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeDto>>(`${this.apiUrl}/employees`, formData);
  }

  public updateEmployee(
    id: string,
    dto: UpdateEmployeeDto | FormData,
  ): Observable<ApiSuccessResponse<EmployeeDto>> {
    return this.http.put<ApiSuccessResponse<EmployeeDto>>(`${this.apiUrl}/employees/${id}`, dto);
  }

  public deleteEmployeePhoto(id: string): Observable<ApiSuccessResponse<void>> {
    return this.http.delete<ApiSuccessResponse<void>>(`${this.apiUrl}/employees/${id}/photo`);
  }

  public getEmployeePhotoUrl(id: string, token?: string): string {
    return token
      ? `${this.apiUrl}/employees/${id}/photo?token=${token}`
      : `${this.apiUrl}/employees/${id}/photo`;
  }

  // 5. Assignments (Effective-Dated)
  public getAssignments(employeeId?: string): Observable<ApiSuccessResponse<EmployeeAssignmentDto[]>> {
    const url = employeeId
      ? `${this.apiUrl}/assignments?employeeId=${employeeId}`
      : `${this.apiUrl}/assignments`;
    return this.http.get<ApiSuccessResponse<EmployeeAssignmentDto[]>>(url);
  }

  public createAssignment(dto: CreateEmployeeAssignmentDto): Observable<ApiSuccessResponse<EmployeeAssignmentDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeAssignmentDto>>(`${this.apiUrl}/assignments`, dto);
  }

  public updateAssignment(
    id: string,
    dto: { effectiveTo?: string | null; remarks?: string }
  ): Observable<ApiSuccessResponse<EmployeeAssignmentDto>> {
    return this.http.put<ApiSuccessResponse<EmployeeAssignmentDto>>(`${this.apiUrl}/assignments/${id}`, dto);
  }

  // 6. Rates (Dual-Stream)
  public getEmployeeRates(employeeId?: string): Observable<ApiSuccessResponse<EmployeeHourlyRateDto[]>> {
    const url = employeeId
      ? `${this.apiUrl}/rates/employee-rates?employeeId=${employeeId}`
      : `${this.apiUrl}/rates/employee-rates`;
    return this.http.get<ApiSuccessResponse<EmployeeHourlyRateDto[]>>(url);
  }

  public createEmployeeRate(dto: CreateEmployeeHourlyRateDto): Observable<ApiSuccessResponse<EmployeeHourlyRateDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeHourlyRateDto>>(`${this.apiUrl}/rates/employee-rates`, dto);
  }

  public getClientRates(clientId?: string): Observable<ApiSuccessResponse<ClientBillingRateDto[]>> {
    const url = clientId
      ? `${this.apiUrl}/rates/client-rates?clientId=${clientId}`
      : `${this.apiUrl}/rates/client-rates`;
    return this.http.get<ApiSuccessResponse<ClientBillingRateDto[]>>(url);
  }

  public createClientRate(dto: CreateClientBillingRateDto): Observable<ApiSuccessResponse<ClientBillingRateDto>> {
    return this.http.post<ApiSuccessResponse<ClientBillingRateDto>>(`${this.apiUrl}/rates/client-rates`, dto);
  }

  public resolveBillingRate(employeeId: string, workDate: string): Observable<ApiSuccessResponse<ResolvedBillingRateDto>> {
    return this.http.get<ApiSuccessResponse<ResolvedBillingRateDto>>(
      `${this.apiUrl}/rates/resolve-billing?employeeId=${employeeId}&workDate=${workDate}`,
    );
  }

  // 7. Shifts & Rostering
  public getShifts(): Observable<ApiSuccessResponse<ShiftDto[]>> {
    return this.http.get<ApiSuccessResponse<ShiftDto[]>>(`${this.apiUrl}/shifts`);
  }

  public createShift(dto: CreateShiftDto): Observable<ApiSuccessResponse<ShiftDto>> {
    return this.http.post<ApiSuccessResponse<ShiftDto>>(`${this.apiUrl}/shifts`, dto);
  }

  public updateShift(id: string, dto: UpdateShiftDto): Observable<ApiSuccessResponse<ShiftDto>> {
    return this.http.put<ApiSuccessResponse<ShiftDto>>(`${this.apiUrl}/shifts/${id}`, dto);
  }

  // 8. Calendar & Holidays
  public getWeeklyOffs(): Observable<ApiSuccessResponse<WeeklyOffConfigDto[]>> {
    return this.http.get<ApiSuccessResponse<WeeklyOffConfigDto[]>>(`${this.apiUrl}/calendar/weekly-offs`);
  }

  public createWeeklyOff(dto: CreateWeeklyOffConfigDto): Observable<ApiSuccessResponse<WeeklyOffConfigDto>> {
    return this.http.post<ApiSuccessResponse<WeeklyOffConfigDto>>(`${this.apiUrl}/calendar/weekly-offs`, dto);
  }

  public getPublicHolidays(year?: number): Observable<ApiSuccessResponse<PublicHolidayDto[]>> {
    const url = year ? `${this.apiUrl}/calendar/holidays?year=${year}` : `${this.apiUrl}/calendar/holidays`;
    return this.http.get<ApiSuccessResponse<PublicHolidayDto[]>>(url);
  }

  public createPublicHoliday(dto: CreatePublicHolidayDto): Observable<ApiSuccessResponse<PublicHolidayDto>> {
    return this.http.post<ApiSuccessResponse<PublicHolidayDto>>(`${this.apiUrl}/calendar/holidays`, dto);
  }

  public updatePublicHoliday(id: string, dto: UpdatePublicHolidayDto): Observable<ApiSuccessResponse<PublicHolidayDto>> {
    return this.http.put<ApiSuccessResponse<PublicHolidayDto>>(`${this.apiUrl}/calendar/holidays/${id}`, dto);
  }

  // 9. Salary Components & Structures
  public getSalaryComponents(): Observable<ApiSuccessResponse<SalaryComponentDto[]>> {
    return this.http.get<ApiSuccessResponse<SalaryComponentDto[]>>(`${this.apiUrl}/salary/components`);
  }

  public createSalaryComponent(dto: CreateSalaryComponentDto): Observable<ApiSuccessResponse<SalaryComponentDto>> {
    return this.http.post<ApiSuccessResponse<SalaryComponentDto>>(`${this.apiUrl}/salary/components`, dto);
  }

  public getSalaryStructures(employeeId?: string): Observable<ApiSuccessResponse<EmployeeSalaryStructureDto[]>> {
    const url = employeeId
      ? `${this.apiUrl}/salary/structures?employeeId=${employeeId}`
      : `${this.apiUrl}/salary/structures`;
    return this.http.get<ApiSuccessResponse<EmployeeSalaryStructureDto[]>>(url);
  }

  public createSalaryStructure(
    dto: CreateEmployeeSalaryStructureDto,
  ): Observable<ApiSuccessResponse<EmployeeSalaryStructureDto>> {
    return this.http.post<ApiSuccessResponse<EmployeeSalaryStructureDto>>(`${this.apiUrl}/salary/structures`, dto);
  }
}
