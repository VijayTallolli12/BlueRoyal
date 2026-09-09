import { Request, Response, NextFunction } from 'express';
import { OnboardingService } from '../services/onboarding.service';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';

export class OnboardingController {
  /**
   * List onboarding records
   */
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query;
      const list = await OnboardingService.listOnboardings({
        status: status ? String(status) : undefined,
      });
      sendSuccess(req, res, list);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get onboarding by ID
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const onboarding = await OnboardingService.getById(id);
      sendSuccess(req, res, onboarding);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get onboarding by Employee ID
   */
  public static async getByEmployeeId(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const employeeId = String(req.params.employeeId);
      const onboarding = await OnboardingService.getByEmployeeId(employeeId);
      if (!onboarding) {
        throw AppError.notFound(`No onboarding record found for employee ${employeeId}`);
      }
      sendSuccess(req, res, onboarding);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Start onboarding
   */
  public static async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, targetStartDate, notes } = req.body;
      if (!employeeId) {
        throw AppError.badRequest('employeeId is required');
      }

      const onboarding = await OnboardingService.startOnboarding(
        { employeeId, targetStartDate, notes },
        req.user?.id,
        req.ip,
        req.headers['user-agent'],
        req.headers['x-correlation-id'] as string,
      );

      sendSuccess(req, res, onboarding, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Refresh/re-evaluate readiness score
   */
  public static async refreshReadiness(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = String(req.params.id);
      const refreshed = await OnboardingService.refreshReadiness(
        id,
        req.user?.id,
        req.ip,
        req.headers['user-agent'],
        req.headers['x-correlation-id'] as string,
      );
      sendSuccess(req, res, refreshed);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update progress
   */
  public static async updateProgress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = String(req.params.id);
      const updated = await OnboardingService.updateProgress(
        id,
        req.body,
        req.user?.id,
        req.ip,
        req.headers['user-agent'],
        req.headers['x-correlation-id'] as string,
      );
      sendSuccess(req, res, updated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Complete onboarding
   */
  public static async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const completed = await OnboardingService.completeOnboarding(
        id,
        req.body,
        req.user?.id,
        req.ip,
        req.headers['user-agent'],
        req.headers['x-correlation-id'] as string,
      );
      sendSuccess(req, res, completed);
    } catch (err) {
      next(err);
    }
  }
}
