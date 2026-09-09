import { Request, Response, NextFunction } from 'express';
import { AirTicketPolicy } from '../models/air-ticket-policy.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { round2 } from '../../../core/utils/math.util';

export class AirTicketPolicyController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policies = await AirTicketPolicy.findAll({
        where: { isActive: true },
        order: [['countryName', 'ASC']],
      });
      sendSuccess(req, res, policies);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { countryCode, countryName, region, entitlementAmount, notes } = req.body;
      if (!countryName || !region || entitlementAmount === undefined) {
        throw AppError.badRequest('countryName, region, and entitlementAmount are required');
      }

      const policy = await AirTicketPolicy.create({
        countryCode: countryCode || null,
        countryName,
        region,
        entitlementAmount: round2(Number(entitlementAmount)),
        isActive: true,
        notes: notes || null,
      });

      sendSuccess(req, res, policy, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const policy = await AirTicketPolicy.findByPk(id);
      if (!policy) {
        throw AppError.notFound(`Air ticket policy ${id} not found`);
      }

      const { countryCode, countryName, region, entitlementAmount, isActive, notes } = req.body;
      await policy.update({
        countryCode: countryCode !== undefined ? countryCode : policy.countryCode,
        countryName: countryName !== undefined ? countryName : policy.countryName,
        region: region !== undefined ? region : policy.region,
        entitlementAmount:
          entitlementAmount !== undefined ? round2(Number(entitlementAmount)) : policy.entitlementAmount,
        isActive: isActive !== undefined ? Boolean(isActive) : policy.isActive,
        notes: notes !== undefined ? notes : policy.notes,
      });

      sendSuccess(req, res, policy);
    } catch (err) {
      next(err);
    }
  }
}
