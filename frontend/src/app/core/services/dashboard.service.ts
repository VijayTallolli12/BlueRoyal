import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse, DashboardSummaryDto } from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly baseUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  /**
   * Fetch consolidated dashboard summary metrics from the backend.
   */
  public getSummary(): Observable<ApiSuccessResponse<DashboardSummaryDto>> {
    return this.http.get<ApiSuccessResponse<DashboardSummaryDto>>(`${this.baseUrl}/summary`);
  }
}
