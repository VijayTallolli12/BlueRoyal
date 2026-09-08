import { Request, Response, NextFunction } from 'express';
import { Designation } from '../models/designation.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';

export class DesignationController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const designations = await Designation.findAll({
        order: [['title', 'ASC']],
      });
      sendSuccess(req, res, designations);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Designation.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Designation with ID ${id} not found`);
      }
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, title, description, isActive } = req.body;
      const existing = await Designation.findOne({ where: { code } });
      if (existing) {
        throw AppError.conflict(`Designation code ${code} already exists`);
      }
      const item = await Designation.create({
        code,
        title,
        description,
        isActive: isActive !== undefined ? isActive : true,
      });
      sendSuccess(req, res, item, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Designation.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Designation with ID ${id} not found`);
      }
      const { code, title, description, isActive } = req.body;
      if (code && code !== item.code) {
        const existing = await Designation.findOne({ where: { code } });
        if (existing) {
          throw AppError.conflict(`Designation code ${code} already exists`);
        }
      }
      await item.update({ code, title, description, isActive });
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Designation.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Designation with ID ${id} not found`);
      }
      await item.destroy();
      sendSuccess(req, res, { message: 'Designation deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
