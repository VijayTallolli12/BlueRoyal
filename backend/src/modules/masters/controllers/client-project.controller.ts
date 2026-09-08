import { Request, Response, NextFunction } from 'express';
import { Client } from '../models/client.model';
import { Project } from '../models/project.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';

export class ClientController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clients = await Client.findAll({
        include: [{ model: Project, as: 'projects' }],
        order: [['name', 'ASC']],
      });
      sendSuccess(req, res, clients);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Client.findByPk(id, {
        include: [{ model: Project, as: 'projects' }],
      });
      if (!item) {
        throw AppError.notFound(`Client with ID ${id} not found`);
      }
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, name, contactPerson, contactEmail, contactPhone, billingAddress, isActive } = req.body;
      const existing = await Client.findOne({ where: { code } });
      if (existing) {
        throw AppError.conflict(`Client code ${code} already exists`);
      }
      const item = await Client.create({
        code,
        name,
        contactPerson,
        contactEmail,
        contactPhone,
        billingAddress,
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
      const item = await Client.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Client with ID ${id} not found`);
      }
      const { code, name, contactPerson, contactEmail, contactPhone, billingAddress, isActive } = req.body;
      if (code && code !== item.code) {
        const existing = await Client.findOne({ where: { code } });
        if (existing) {
          throw AppError.conflict(`Client code ${code} already exists`);
        }
      }
      await item.update({ code, name, contactPerson, contactEmail, contactPhone, billingAddress, isActive });
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Client.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Client with ID ${id} not found`);
      }
      await item.destroy();
      sendSuccess(req, res, { message: 'Client deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

export class ProjectController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.clientId) {
        where.clientId = String(req.query.clientId);
      }
      const projects = await Project.findAll({
        where,
        include: [{ model: Client, as: 'client' }],
        order: [['name', 'ASC']],
      });
      sendSuccess(req, res, projects);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Project.findByPk(id, {
        include: [{ model: Client, as: 'client' }],
      });
      if (!item) {
        throw AppError.notFound(`Project with ID ${id} not found`);
      }
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clientId, code, name, siteLocation, startDate, endDate, status } = req.body;
      const client = await Client.findByPk(String(clientId));
      if (!client) {
        throw AppError.badRequest(`Referenced client ${clientId} does not exist`);
      }
      const existing = await Project.findOne({ where: { code } });
      if (existing) {
        throw AppError.conflict(`Project code ${code} already exists`);
      }
      const item = await Project.create({
        clientId,
        code,
        name,
        siteLocation,
        startDate,
        endDate,
        status: status || 'active',
      });
      sendSuccess(req, res, item, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Project.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Project with ID ${id} not found`);
      }
      const { clientId, code, name, siteLocation, startDate, endDate, status } = req.body;
      if (clientId && clientId !== item.clientId) {
        const client = await Client.findByPk(String(clientId));
        if (!client) {
          throw AppError.badRequest(`Referenced client ${clientId} does not exist`);
        }
      }
      if (code && code !== item.code) {
        const existing = await Project.findOne({ where: { code } });
        if (existing) {
          throw AppError.conflict(`Project code ${code} already exists`);
        }
      }
      await item.update({ clientId, code, name, siteLocation, startDate, endDate, status });
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Project.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Project with ID ${id} not found`);
      }
      await item.destroy();
      sendSuccess(req, res, { message: 'Project deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
