import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  PaymentDto,
  RecordPaymentDto,
  ReversePaymentDto,
  InvoicePaymentSummaryDto,
  ReceivablesListResponseDto,
  ClientPaymentSummaryDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly paymentsBaseUrl = `${environment.apiUrl}/payments`;
  private readonly receivablesBaseUrl = `${environment.apiUrl}/receivables`;

  constructor(private http: HttpClient) {}

  public recordPayment(dto: RecordPaymentDto): Observable<ApiSuccessResponse<PaymentDto>> {
    return this.http.post<ApiSuccessResponse<PaymentDto>>(this.paymentsBaseUrl, dto);
  }

  public reversePayment(paymentId: string, reason: string): Observable<ApiSuccessResponse<PaymentDto>> {
    const body: ReversePaymentDto = { reason };
    return this.http.post<ApiSuccessResponse<PaymentDto>>(`${this.paymentsBaseUrl}/${paymentId}/reverse`, body);
  }

  public getInvoicePaymentSummary(invoiceId: string): Observable<ApiSuccessResponse<InvoicePaymentSummaryDto>> {
    return this.http.get<ApiSuccessResponse<InvoicePaymentSummaryDto>>(
      `${this.paymentsBaseUrl}/invoices/${invoiceId}/summary`,
    );
  }

  public listPayments(filters?: {
    clientId?: string;
    status?: string;
  }): Observable<ApiSuccessResponse<{ items: PaymentDto[]; total: number }>> {
    let params = new HttpParams();
    if (filters?.clientId) params = params.set('clientId', filters.clientId);
    if (filters?.status && filters.status !== 'all') params = params.set('status', filters.status);

    return this.http.get<ApiSuccessResponse<{ items: PaymentDto[]; total: number }>>(this.paymentsBaseUrl, {
      params,
    });
  }

  public getPayment(id: string): Observable<ApiSuccessResponse<PaymentDto>> {
    return this.http.get<ApiSuccessResponse<PaymentDto>>(`${this.paymentsBaseUrl}/${id}`);
  }

  public listReceivables(filters?: {
    clientId?: string;
    projectId?: string;
    paymentStatus?: string;
  }): Observable<ApiSuccessResponse<ReceivablesListResponseDto>> {
    let params = new HttpParams();
    if (filters?.clientId) params = params.set('clientId', filters.clientId);
    if (filters?.projectId) params = params.set('projectId', filters.projectId);
    if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
      params = params.set('paymentStatus', filters.paymentStatus);
    }

    return this.http.get<ApiSuccessResponse<ReceivablesListResponseDto>>(this.receivablesBaseUrl, {
      params,
    });
  }

  public getClientFinancialSummary(clientId: string): Observable<ApiSuccessResponse<ClientPaymentSummaryDto>> {
    return this.http.get<ApiSuccessResponse<ClientPaymentSummaryDto>>(
      `${this.receivablesBaseUrl}/clients/${clientId}/summary`,
    );
  }
}
