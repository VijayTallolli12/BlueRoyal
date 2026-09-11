import { Request, Response, NextFunction } from 'express';
import { Client } from '../models/client.model';
import { Project } from '../models/project.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';

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
      const code = req.body.code ? String(req.body.code).trim() : '';
      const name = req.body.name ? String(req.body.name).trim() : '';
      const contactPerson = req.body.contactPerson ? String(req.body.contactPerson).trim() : null;
      const rawEmail = req.body.email !== undefined ? req.body.email : req.body.contactEmail;
      const contactEmail = rawEmail ? String(rawEmail).trim() : null;
      const rawPhone = req.body.phoneNumber !== undefined ? req.body.phoneNumber : (req.body.phone !== undefined ? req.body.phone : req.body.contactPhone);
      const contactPhone = rawPhone ? String(rawPhone).trim() : null;
      const billingAddress = req.body.billingAddress ? String(req.body.billingAddress).trim() : null;
      const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : true;

      if (!code) {
        throw AppError.badRequest('Client Code is required');
      }
      if (!name) {
        throw AppError.badRequest('Client Name is required');
      }
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        throw AppError.badRequest('Valid email address is required');
      }

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
        isActive,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'CLIENT_CREATED',
        resourceType: 'Client',
        resourceId: item.id,
        newValues: item.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
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

      const code = req.body.code !== undefined ? String(req.body.code).trim() : item.code;
      const name = req.body.name !== undefined ? String(req.body.name).trim() : item.name;
      const contactPerson = req.body.contactPerson !== undefined
        ? (req.body.contactPerson ? String(req.body.contactPerson).trim() : null)
        : item.contactPerson;
      
      const rawEmail = req.body.email !== undefined ? req.body.email : req.body.contactEmail;
      const contactEmail = rawEmail !== undefined
        ? (rawEmail ? String(rawEmail).trim() : null)
        : item.contactEmail;

      const rawPhone = req.body.phoneNumber !== undefined ? req.body.phoneNumber : (req.body.phone !== undefined ? req.body.phone : req.body.contactPhone);
      const contactPhone = rawPhone !== undefined
        ? (rawPhone ? String(rawPhone).trim() : null)
        : item.contactPhone;

      const billingAddress = req.body.billingAddress !== undefined
        ? (req.body.billingAddress ? String(req.body.billingAddress).trim() : null)
        : item.billingAddress;

      // Preserve existing isActive unless explicitly supplied
      const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : item.isActive;

      if (req.body.name !== undefined && !name) {
        throw AppError.badRequest('Client Name cannot be empty');
      }
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        throw AppError.badRequest('Valid email address is required');
      }

      if (code && code !== item.code) {
        const existing = await Client.findOne({ where: { code } });
        if (existing) {
          throw AppError.conflict(`Client code ${code} already exists`);
        }
      }
      const oldValues = item.toJSON();
      await item.update({ code, name, contactPerson, contactEmail, contactPhone, billingAddress, isActive });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'CLIENT_UPDATED',
        resourceType: 'Client',
        resourceId: item.id,
        oldValues,
        newValues: item.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

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
      const oldValues = item.toJSON();
      await item.destroy();

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'CLIENT_DELETED',
        resourceType: 'Client',
        resourceId: id,
        oldValues,
        correlationId: req.headers['x-correlation-id'] as string,
      });

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
      const rawClientId = req.body.clientId;
      const rawCode = req.body.code;
      const rawName = req.body.name;
      const rawLocation = req.body.location !== undefined ? req.body.location : req.body.siteLocation;

      const clientId = rawClientId ? String(rawClientId).trim() : '';
      const code = rawCode ? String(rawCode).trim() : '';
      const name = rawName ? String(rawName).trim() : '';
      const siteLocation = rawLocation ? String(rawLocation).trim() : null;

      if (!clientId) {
        throw AppError.badRequest('Client is required');
      }
      if (!code) {
        throw AppError.badRequest('Project Code is required');
      }
      if (!name) {
        throw AppError.badRequest('Project Name is required');
      }

      const client = await Client.findByPk(clientId);
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
        startDate: req.body.startDate || null,
        endDate: req.body.endDate || null,
        status: req.body.status || 'active',
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'PROJECT_CREATED',
        resourceType: 'Project',
        resourceId: item.id,
        newValues: item.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
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

      const rawClientId = req.body.clientId;
      const clientId = rawClientId !== undefined ? String(rawClientId).trim() : item.clientId;

      const rawCode = req.body.code;
      const code = rawCode !== undefined ? String(rawCode).trim() : item.code;

      const rawName = req.body.name;
      const name = rawName !== undefined ? String(rawName).trim() : item.name;

      const rawLocation = req.body.location !== undefined ? req.body.location : req.body.siteLocation;
      const siteLocation = rawLocation !== undefined
        ? (rawLocation ? String(rawLocation).trim() : null)
        : item.siteLocation;

      const startDate = req.body.startDate !== undefined ? req.body.startDate : item.startDate;
      const endDate = req.body.endDate !== undefined ? req.body.endDate : item.endDate;
      // Preserve existing status unless explicitly specified
      const status = req.body.status !== undefined ? req.body.status : item.status;

      if (req.body.clientId !== undefined && !clientId) {
        throw AppError.badRequest('Client is required');
      }
      if (req.body.name !== undefined && !name) {
        throw AppError.badRequest('Project Name is required');
      }

      if (clientId && clientId !== item.clientId) {
        const client = await Client.findByPk(clientId);
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
      const oldValues = item.toJSON();
      await item.update({ clientId, code, name, siteLocation, startDate, endDate, status });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'PROJECT_UPDATED',
        resourceType: 'Project',
        resourceId: item.id,
        oldValues,
        newValues: item.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

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
      const oldValues = item.toJSON();
      await item.destroy();

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'PROJECT_DELETED',
        resourceType: 'Project',
        resourceId: id,
        oldValues,
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, { message: 'Project deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
