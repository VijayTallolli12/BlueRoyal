import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { sendSuccess } from '../../../core/utils/response.util';

export class PaymentController {
  public static async recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const payment = await PaymentService.recordPayment(req.body, actorId, actorIp, actorUserAgent);
      sendSuccess(req, res, payment, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async reversePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const payment = await PaymentService.reversePayment(
        req.params.id as string,
        req.body,
        actorId,
        actorIp,
        actorUserAgent,
      );
      sendSuccess(req, res, payment);
    } catch (err) {
      next(err);
    }
  }

  public static async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        clientId: req.query.clientId as string | undefined,
        status: req.query.status as string | undefined,
      };

      const result = await PaymentService.listPayments(filters);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }

  public static async getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payment = await PaymentService.getPaymentById(req.params.id as string);
      sendSuccess(req, res, payment);
    } catch (err) {
      next(err);
    }
  }

  public static async getInvoicePaymentSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = (req.params.invoiceId || req.params.id) as string;
      const summary = await PaymentService.getInvoicePaymentSummary(invoiceId);
      sendSuccess(req, res, summary);
    } catch (err) {
      next(err);
    }
  }

  public static async listReceivables(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        clientId: req.query.clientId as string | undefined,
        projectId: req.query.projectId as string | undefined,
        paymentStatus: req.query.paymentStatus as string | undefined,
      };

      const receivables = await PaymentService.listReceivables(filters);
      sendSuccess(req, res, receivables);
    } catch (err) {
      next(err);
    }
  }

  public static async getClientFinancialSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await PaymentService.getClientFinancialSummary(req.params.clientId as string);
      sendSuccess(req, res, summary);
    } catch (err) {
      next(err);
    }
  }
}
