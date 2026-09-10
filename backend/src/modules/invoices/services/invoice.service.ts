import { Op, Transaction } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import { Invoice } from '../models/invoice.model';
import { InvoiceLine } from '../models/invoice-line.model';
import { Client } from '../../masters/models/client.model';
import { Project } from '../../masters/models/project.model';
import { Employee } from '../../masters/models/employee.model';
import { Designation } from '../../masters/models/designation.model';
import { User } from '../../auth/models/user.model';
import { AttendanceRecord } from '../../attendance/models/attendance-record.model';
import { BillingRateResolutionService } from '../../masters/services/billing-rate-resolution.service';
import {
  GenerateInvoiceDto,
  InvoicePreviewDto,
  InvoicePreviewItemDto,
} from '@blue-royal/contracts';

export class InvoiceService {
  /**
   * Helper to round financial numbers to 2 decimal places.
   */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Compute date range for a YYYY-MM billing period.
   */
  private static getPeriodDateRange(billingPeriod: string): { startDate: string; endDate: string; midDate: string } {
    if (!/^\d{4}-\d{2}$/.test(billingPeriod)) {
      throw AppError.badRequest('billingPeriod must follow format YYYY-MM (e.g. 2026-08)');
    }
    const [yearStr, monthStr] = billingPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startDate = `${billingPeriod}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = `${billingPeriod}-${String(lastDay).padStart(2, '0')}`;
    const midDate = `${billingPeriod}-15`;

    return { startDate, endDate, midDate };
  }

  /**
   * Compute live preview calculation of an invoice before persistence.
   */
  public static async previewInvoice(
    dto: GenerateInvoiceDto,
    transaction?: Transaction,
  ): Promise<InvoicePreviewDto> {
    const client = await Client.findByPk(dto.clientId, { transaction });
    if (!client) {
      throw AppError.notFound(`Client with ID ${dto.clientId} not found`);
    }

    const project = await Project.findByPk(dto.projectId, { transaction });
    if (!project) {
      throw AppError.notFound(`Project with ID ${dto.projectId} not found`);
    }

    if (project.clientId !== client.id) {
      throw AppError.badRequest(`Project '${project.name}' does not belong to Client '${client.name}'`);
    }

    const { startDate, endDate, midDate } = this.getPeriodDateRange(dto.billingPeriod);

    // Fetch verified attendance records for this client, project, and period
    const records = await AttendanceRecord.findAll({
      where: {
        clientId: client.id,
        projectId: project.id,
        workDate: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
      },
      include: [
        { model: Employee, as: 'employee' },
        { model: Designation, as: 'designation' },
      ],
      order: [['workDate', 'ASC']],
      transaction,
    });

    // Group records by employee
    const empMap = new Map<string, { employee: Employee; records: AttendanceRecord[] }>();
    for (const rec of records) {
      if (!rec.employee) continue;
      if (!empMap.has(rec.employeeId)) {
        empMap.set(rec.employeeId, {
          employee: rec.employee,
          records: [],
        });
      }
      empMap.get(rec.employeeId)!.records.push(rec);
    }

    const items: InvoicePreviewItemDto[] = [];
    let totalRegularHours = 0;
    let totalOtHours = 0;
    let subtotal = 0;
    let dominantRegRate = 0;
    let dominantOtRate = 0;

    for (const [empId, data] of empMap.entries()) {
      let regHours = 0;
      let otHours = 0;

      for (const r of data.records) {
        regHours += Number(r.regularHours || 0);
        otHours += Number(r.otHours || 0);
      }

      regHours = this.round2(regHours);
      otHours = this.round2(otHours);

      if (regHours === 0 && otHours === 0) continue;

      // Resolve official client billing rate
      const rateRes = await BillingRateResolutionService.resolveBillingRate(empId, midDate, transaction);
      if (rateRes.status !== 'RESOLVED' || !rateRes.normalBillingRate) {
        throw AppError.badRequest(
          `Unable to resolve client billing rate for employee ${data.employee.employeeCode} (${data.employee.firstName} ${data.employee.lastName}) on project ${project.name}: ${rateRes.errorMessage || 'Missing rate'}`,
        );
      }

      const regularRate = Number(rateRes.normalBillingRate);
      const otRate = Number(rateRes.otBillingRate || 0);

      const regularAmount = this.round2(regHours * regularRate);
      const otAmount = this.round2(otHours * otRate);
      const itemTotal = this.round2(regularAmount + otAmount);

      dominantRegRate = regularRate;
      dominantOtRate = otRate;
      totalRegularHours = this.round2(totalRegularHours + regHours);
      totalOtHours = this.round2(totalOtHours + otHours);
      subtotal = this.round2(subtotal + itemTotal);

      // Latest designation title
      const desigTitle = data.records[data.records.length - 1]?.designation?.title || 'Team Member';

      items.push({
        employeeId: empId,
        employeeCode: data.employee.employeeCode,
        employeeName: `${data.employee.firstName} ${data.employee.lastName}`,
        designationTitle: desigTitle,
        regularHours: regHours,
        otHours: otHours,
        regularRate,
        otRate,
        regularAmount,
        otAmount,
        totalAmount: itemTotal,
      });
    }

    return {
      clientId: client.id,
      clientName: client.name,
      projectId: project.id,
      projectName: project.name,
      billingPeriod: dto.billingPeriod,
      billableEmployeesCount: items.length,
      totalRegularHours,
      totalOtHours,
      regularRate: dominantRegRate,
      otRate: dominantOtRate,
      subtotal,
      taxAmount: 0.0,
      totalAmount: subtotal,
      currency: 'AED',
      taxNotice: 'Tax configuration is not enabled.',
      items,
    };
  }

  /**
   * Generate and persist an invoice from actual attendance/timesheet.
   */
  public static async generateInvoice(
    dto: GenerateInvoiceDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<Invoice> {
    return sequelize.transaction(async (t) => {
      const preview = await this.previewInvoice(dto, t);

      if (preview.items.length === 0) {
        throw AppError.badRequest(
          `Cannot generate invoice. No billable attendance hours found for ${preview.clientName} - ${preview.projectName} during ${dto.billingPeriod}.`,
        );
      }

      // Check for existing invoice for this client, project, and period
      const existing = await Invoice.findOne({
        where: {
          clientId: dto.clientId,
          projectId: dto.projectId,
          billingPeriod: dto.billingPeriod,
        },
        transaction: t,
      });

      if (existing) {
        throw AppError.conflict(
          `An invoice (${existing.invoiceNumber}) already exists for this client, project, and billing period.`,
        );
      }

      // Generate next sequential invoice number for this billing period
      const count = await Invoice.count({
        where: { billingPeriod: dto.billingPeriod },
        transaction: t,
      });
      let seq = count + 1;
      let invoiceNumber = `INV-${dto.billingPeriod}-${String(seq).padStart(4, '0')}`;

      // Guarantee unique invoice number
      while (await Invoice.findOne({ where: { invoiceNumber }, transaction: t })) {
        seq++;
        invoiceNumber = `INV-${dto.billingPeriod}-${String(seq).padStart(4, '0')}`;
      }

      const invoiceDate = new Date().toISOString().slice(0, 10);

      const invoice = await Invoice.create(
        {
          invoiceNumber,
          clientId: dto.clientId,
          projectId: dto.projectId,
          billingPeriod: dto.billingPeriod,
          invoiceDate,
          status: 'draft',
          subtotal: preview.subtotal,
          taxAmount: preview.taxAmount,
          totalAmount: preview.totalAmount,
          currency: 'AED',
          notes: dto.notes ? dto.notes.trim() : `Commercial invoice generated from verified timesheet hours for ${preview.projectName}.`,
        },
        { transaction: t },
      );

      // Create itemized lines
      for (const item of preview.items) {
        // Regular hours line
        if (item.regularHours > 0) {
          await InvoiceLine.create(
            {
              invoiceId: invoice.id,
              employeeId: item.employeeId,
              projectId: dto.projectId,
              description: `${item.employeeName} — Regular Hours`,
              hours: item.regularHours,
              overtimeHours: 0.0,
              rate: item.regularRate,
              otRate: 0.0,
              amount: item.regularAmount,
              lineType: 'billable_regular',
            },
            { transaction: t },
          );
        }

        // Overtime hours line
        if (item.otHours > 0) {
          await InvoiceLine.create(
            {
              invoiceId: invoice.id,
              employeeId: item.employeeId,
              projectId: dto.projectId,
              description: `${item.employeeName} — Overtime`,
              hours: 0.0,
              overtimeHours: item.otHours,
              rate: 0.0,
              otRate: item.otRate,
              amount: item.otAmount,
              lineType: 'billable_overtime',
            },
            { transaction: t },
          );
        }
      }

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'INVOICE_GENERATED',
        resourceType: 'Invoice',
        resourceId: invoice.id,
        newValues: {
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          projectId: invoice.projectId,
          billingPeriod: invoice.billingPeriod,
          totalAmount: invoice.totalAmount,
          status: invoice.status,
        },
        transaction: t,
      });

      return invoice;
    });
  }

  /**
   * Transition an invoice from 'draft' to 'issued'.
   */
  public static async issueInvoice(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<Invoice> {
    const invoice = await Invoice.findByPk(id, {
      include: [{ model: InvoiceLine, as: 'lines' }],
    });

    if (!invoice) {
      throw AppError.notFound(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === 'issued') {
      throw AppError.badRequest(`Invoice ${invoice.invoiceNumber} is already issued. Financial values are permanently locked.`);
    }

    invoice.status = 'issued';
    invoice.issuedAt = new Date();
    invoice.issuedBy = actorId || null;
    await invoice.save();

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'INVOICE_ISSUED',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      newValues: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        issuedBy: invoice.issuedBy,
      },
    });

    return invoice;
  }

  /**
   * List all invoices with optional filtering.
   */
  public static async listInvoices(filters?: {
    clientId?: string;
    projectId?: string;
    billingPeriod?: string;
    status?: string;
  }): Promise<Invoice[]> {
    const where: any = {};
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.projectId) where.projectId = filters.projectId;
    if (filters?.billingPeriod) where.billingPeriod = filters.billingPeriod;
    if (filters?.status) where.status = filters.status;

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name', 'code'] },
        { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'issuedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return invoices.map((inv) => {
      const json = inv.toJSON() as any;
      json.clientName = inv.client?.name;
      json.clientCode = inv.client?.code;
      json.projectName = inv.project?.name;
      json.projectCode = inv.project?.code;
      return json;
    });
  }

  /**
   * Get single invoice by ID with full itemized lines.
   */
  public static async getInvoiceById(id: string): Promise<any> {
    const invoice = await Invoice.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: Project, as: 'project' },
        { model: User, as: 'issuedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        {
          model: InvoiceLine,
          as: 'lines',
          include: [{ model: Employee, as: 'employee', attributes: ['id', 'employeeCode', 'firstName', 'lastName'] }],
        },
      ],
    });

    if (!invoice) {
      throw AppError.notFound(`Invoice with ID ${id} not found`);
    }

    const json = invoice.toJSON() as any;
    json.clientName = invoice.client?.name;
    json.clientCode = invoice.client?.code;
    json.projectName = invoice.project?.name;
    json.projectCode = invoice.project?.code;
    if (json.lines) {
      json.lines = json.lines.map((l: any) => ({
        ...l,
        employeeName: l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : null,
        employeeCode: l.employee ? l.employee.employeeCode : null,
      }));
    }
    return json;
  }
}
