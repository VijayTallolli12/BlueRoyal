import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  InvoiceDto,
  GenerateInvoiceDto,
  InvoicePreviewDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  private readonly baseUrl = `${environment.apiUrl}/invoices`;

  constructor(private http: HttpClient) {}

  public listInvoices(filters?: {
    clientId?: string;
    projectId?: string;
    billingPeriod?: string;
    status?: string;
  }): Observable<ApiSuccessResponse<InvoiceDto[]>> {
    let params = new HttpParams();
    if (filters?.clientId) params = params.set('clientId', filters.clientId);
    if (filters?.projectId) params = params.set('projectId', filters.projectId);
    if (filters?.billingPeriod) params = params.set('billingPeriod', filters.billingPeriod);
    if (filters?.status) params = params.set('status', filters.status);

    return this.http.get<ApiSuccessResponse<InvoiceDto[]>>(this.baseUrl, { params });
  }

  public getInvoice(id: string): Observable<ApiSuccessResponse<InvoiceDto>> {
    return this.http.get<ApiSuccessResponse<InvoiceDto>>(`${this.baseUrl}/${id}`);
  }

  public previewInvoice(dto: GenerateInvoiceDto): Observable<ApiSuccessResponse<InvoicePreviewDto>> {
    return this.http.post<ApiSuccessResponse<InvoicePreviewDto>>(`${this.baseUrl}/preview`, dto);
  }

  public generateInvoice(dto: GenerateInvoiceDto): Observable<ApiSuccessResponse<InvoiceDto>> {
    return this.http.post<ApiSuccessResponse<InvoiceDto>>(`${this.baseUrl}/generate`, dto);
  }

  public issueInvoice(id: string): Observable<ApiSuccessResponse<InvoiceDto>> {
    return this.http.post<ApiSuccessResponse<InvoiceDto>>(`${this.baseUrl}/${id}/issue`, {});
  }
}
