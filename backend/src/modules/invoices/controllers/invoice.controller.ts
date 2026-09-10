import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoice.service';
import { sendSuccess } from '../../../core/utils/response.util';

export class InvoiceController {
  public static async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        clientId: req.query.clientId as string | undefined,
        projectId: req.query.projectId as string | undefined,
        billingPeriod: req.query.billingPeriod as string | undefined,
        status: req.query.status as string | undefined,
      };

      const invoices = await InvoiceService.listInvoices(filters);
      sendSuccess(req, res, invoices);
    } catch (err) {
      next(err);
    }
  }

  public static async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await InvoiceService.getInvoiceById(req.params.id as string);
      sendSuccess(req, res, invoice);
    } catch (err) {
      next(err);
    }
  }

  public static async previewInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const preview = await InvoiceService.previewInvoice(req.body);
      sendSuccess(req, res, preview);
    } catch (err) {
      next(err);
    }
  }

  public static async generateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const invoice = await InvoiceService.generateInvoice(req.body, actorId, actorIp, actorUserAgent);
      sendSuccess(req, res, invoice, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async issueInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const invoice = await InvoiceService.issueInvoice(req.params.id as string, actorId, actorIp, actorUserAgent);
      sendSuccess(req, res, invoice);
    } catch (err) {
      next(err);
    }
  }
}
