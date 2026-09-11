import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { Employee } from '../models/employee.model';
import { EmployeeAssignment } from '../models/employee-assignment.model';
import { Client } from '../models/client.model';
import { Project } from '../models/project.model';
import { Designation } from '../models/designation.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { EmployeeHourlyRate } from '../models/employee-hourly-rate.model';
import { EmployeeSalaryStructure } from '../models/salary-component.model';
import { SalaryComponent } from '../models/salary-component.model';
import { AuditService } from '../../../core/audit/audit.service';
import { EmployeeDocument } from '../../documents/models/employee-document.model';
import { DocumentType } from '../../documents/models/document-type.model';
import { DocumentService } from '../../documents/services/document.service';

export class EmployeeController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const employees = await Employee.findAll({
        order: [['createdAt', 'DESC']],
      });

      // Enrich with current active designation and assignment
      const enriched = await Promise.all(
        employees.map(async (emp) => {
          const currentAssignment = await EffectiveDateService.resolveAtDate(
            EmployeeAssignment,
            { employeeId: emp.id },
            today,
          );

          let currentDesignation = null;
          let assignmentSummary = null;

          if (currentAssignment) {
            const des = await Designation.findByPk(currentAssignment.designationId);
            const client = await Client.findByPk(currentAssignment.clientId);
            const project = await Project.findByPk(currentAssignment.projectId);

            if (des) {
              currentDesignation = {
                id: des.id,
                code: des.code,
                title: des.title,
              };
            }

            assignmentSummary = {
              id: currentAssignment.id,
              clientId: currentAssignment.clientId,
              projectId: currentAssignment.projectId,
              clientName: client?.name,
              projectName: project?.name,
              designationId: currentAssignment.designationId,
              designationTitle: des?.title,
              effectiveFrom: currentAssignment.effectiveFrom,
              effectiveTo: currentAssignment.effectiveTo,
            };
          }

          return {
            ...emp.toJSON(),
            currentDesignation,
            currentAssignment: assignmentSummary,
          };
        }),
      );

      sendSuccess(req, res, enriched);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const today = new Date().toISOString().slice(0, 10);
      const emp = await Employee.findByPk(id);
      if (!emp) {
        throw AppError.notFound(`Employee with ID ${id} not found`);
      }

      const currentAssignment = await EffectiveDateService.resolveAtDate(
        EmployeeAssignment,
        { employeeId: emp.id },
        today,
      );

      let currentDesignation = null;
      let assignmentSummary = null;

      if (currentAssignment) {
        const des = await Designation.findByPk(currentAssignment.designationId);
        const client = await Client.findByPk(currentAssignment.clientId);
        const project = await Project.findByPk(currentAssignment.projectId);

        if (des) {
          currentDesignation = {
            id: des.id,
            code: des.code,
            title: des.title,
          };
        }

        assignmentSummary = {
          id: currentAssignment.id,
          clientId: currentAssignment.clientId,
          projectId: currentAssignment.projectId,
          clientName: client?.name,
          projectName: project?.name,
          designationId: currentAssignment.designationId,
          designationTitle: des?.title,
          effectiveFrom: currentAssignment.effectiveFrom,
          effectiveTo: currentAssignment.effectiveTo,
        };
      }

      // Fetch active hourly rate and salary structure
      const currentHourlyRate = await EffectiveDateService.resolveAtDate(
        EmployeeHourlyRate,
        { employeeId: emp.id },
        today,
      );

      const salaryStructures = await EmployeeSalaryStructure.findAll({
        where: { employeeId: emp.id },
        include: [{ model: SalaryComponent, as: 'component' }],
        order: [['effectiveFrom', 'DESC']],
      });

      // Fetch employee documents
      const rawDocs = await EmployeeDocument.findAll({
        where: { employeeId: emp.id },
        include: [{ model: DocumentType, as: 'documentType' }],
        order: [['createdAt', 'DESC']],
      });
      const documents = rawDocs.map((d) => DocumentService.enrichDocument(d));

      sendSuccess(req, res, {
        ...emp.toJSON(),
        currentDesignation,
        currentAssignment: assignmentSummary,
        currentHourlyRate,
        salaryStructures,
        documents,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        employeeCode,
        userId,
        firstName,
        middleName,
        lastName,
        gender,
        dateOfBirth,
        nationality,
        email,
        phoneNumber,
        address,
        country,
        dateOfJoining,
        probationEndDate,
        employmentType,
        contractEndDate,
        remunerationBasis,
        status,
        passportNumber,
        visaNumber,
      } = req.body;

      if (!employeeCode || !firstName || !lastName) {
        throw AppError.badRequest('Employee Code, First Name, and Last Name are required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        throw AppError.badRequest('A valid Email address is required');
      }

      const existing = await Employee.findOne({ where: { employeeCode } });
      if (existing) {
        throw AppError.conflict(`Employee code ${employeeCode} already exists`);
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const passportFile = files?.['passport']?.[0];
      const visaFile = files?.['visa']?.[0];
      const photoFile = files?.['photo']?.[0];

      if (!passportFile) {
        throw AppError.badRequest('Passport document is mandatory for new employee registration');
      }
      if (!visaFile) {
        throw AppError.badRequest('Visa document is mandatory for new employee registration');
      }

      const finalEmploymentType = employmentType || 'full_time';
      if (finalEmploymentType === 'contract' && !contractEndDate) {
        throw AppError.badRequest('Contract end date is mandatory for contract employees');
      }

      const emp = await Employee.create({
        employeeCode,
        userId: userId || null,
        firstName,
        middleName: middleName || null,
        lastName,
        gender: gender || 'prefer_not_to_say',
        dateOfBirth: dateOfBirth || '1990-01-01',
        nationality: nationality || country || 'Unspecified',
        email: email || null,
        phoneNumber: phoneNumber || null,
        address: address || null,
        country: country || null,
        dateOfJoining: dateOfJoining || new Date().toISOString().slice(0, 10),
        probationEndDate: probationEndDate || null,
        employmentType: finalEmploymentType,
        remunerationBasis: remunerationBasis || 'hourly',
        contractEndDate: contractEndDate || null,
        status: status || 'probation',
      });

      // Handle photo upload
      if (photoFile) {
        const photoDir = path.join(process.cwd(), 'storage', 'documents', emp.id, 'photo');
        if (!fs.existsSync(photoDir)) {
          fs.mkdirSync(photoDir, { recursive: true });
        }
        const ext = path.extname(photoFile.originalname) || '.jpg';
        const photoFileName = `${uuidv4()}${ext}`;
        const photoPath = path.join(photoDir, photoFileName);
        fs.writeFileSync(photoPath, photoFile.buffer);
        emp.profilePhoto = path.relative(process.cwd(), photoPath).replace(/\\/g, '/');
        await emp.save();
      }

      // Handle mandatory passport document
      const passportType = await DocumentType.findOne({ where: { code: 'PASSPORT' } });
      if (passportType) {
        await DocumentService.uploadDocument({
          employeeId: emp.id,
          documentTypeId: passportType.id,
          file: passportFile,
          documentNumber: passportNumber || null,
          actorId: req.user?.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: req.headers['x-correlation-id'] as string,
        });
      }

      // Handle mandatory visa document
      const visaType = await DocumentType.findOne({ where: { code: 'VISA' } });
      if (visaType) {
        await DocumentService.uploadDocument({
          employeeId: emp.id,
          documentTypeId: visaType.id,
          file: visaFile,
          documentNumber: visaNumber || null,
          actorId: req.user?.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: req.headers['x-correlation-id'] as string,
        });
      }

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'EMPLOYEE_CREATED',
        resourceType: 'Employee',
        resourceId: emp.id,
        newValues: emp.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, emp, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const emp = await Employee.findByPk(id);
      if (!emp) {
        throw AppError.notFound(`Employee with ID ${id} not found`);
      }

      const {
        employeeCode,
        userId,
        firstName,
        middleName,
        lastName,
        gender,
        dateOfBirth,
        nationality,
        email,
        phoneNumber,
        address,
        country,
        dateOfJoining,
        probationEndDate,
        employmentType,
        contractEndDate,
        remunerationBasis,
        status,
        removePhoto,
        passportNumber,
        visaNumber,
      } = req.body;

      if (employeeCode && employeeCode !== emp.employeeCode) {
        const existingCode = await Employee.findOne({ where: { employeeCode } });
        if (existingCode) {
          throw AppError.conflict(`Employee code ${employeeCode} already exists`);
        }
      }

      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          throw AppError.badRequest('A valid Email address is required');
        }
      }

      const finalEmploymentType = employmentType !== undefined ? employmentType : emp.employmentType;
      const finalContractEndDate = contractEndDate !== undefined ? contractEndDate : emp.contractEndDate;

      if (finalEmploymentType === 'contract' && !finalContractEndDate) {
        throw AppError.badRequest('Contract end date is mandatory for contract employees');
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const passportFile = files?.['passport']?.[0];
      const visaFile = files?.['visa']?.[0];
      const photoFile = files?.['photo']?.[0];

      // Handle photo update or removal
      if (photoFile) {
        const photoDir = path.join(process.cwd(), 'storage', 'documents', emp.id, 'photo');
        if (!fs.existsSync(photoDir)) {
          fs.mkdirSync(photoDir, { recursive: true });
        }
        const ext = path.extname(photoFile.originalname) || '.jpg';
        const photoFileName = `${uuidv4()}${ext}`;
        const photoPath = path.join(photoDir, photoFileName);
        fs.writeFileSync(photoPath, photoFile.buffer);

        // Remove old photo if existed
        if (emp.profilePhoto) {
          const oldPath = path.resolve(process.cwd(), emp.profilePhoto);
          if (fs.existsSync(oldPath)) {
            try {
              fs.unlinkSync(oldPath);
            } catch {}
          }
        }
        emp.profilePhoto = path.relative(process.cwd(), photoPath).replace(/\\/g, '/');
      } else if (removePhoto === 'true' || removePhoto === true) {
        if (emp.profilePhoto) {
          const oldPath = path.resolve(process.cwd(), emp.profilePhoto);
          if (fs.existsSync(oldPath)) {
            try {
              fs.unlinkSync(oldPath);
            } catch {}
          }
        }
        emp.profilePhoto = null;
      }

      // Handle optional passport upload on edit
      if (passportFile) {
        const passportType = await DocumentType.findOne({ where: { code: 'PASSPORT' } });
        if (passportType) {
          await DocumentService.uploadDocument({
            employeeId: emp.id,
            documentTypeId: passportType.id,
            file: passportFile,
            documentNumber: passportNumber || null,
            actorId: req.user?.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'] as string,
          });
        }
      }

      // Handle optional visa upload on edit
      if (visaFile) {
        const visaType = await DocumentType.findOne({ where: { code: 'VISA' } });
        if (visaType) {
          await DocumentService.uploadDocument({
            employeeId: emp.id,
            documentTypeId: visaType.id,
            file: visaFile,
            documentNumber: visaNumber || null,
            actorId: req.user?.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'] as string,
          });
        }
      }

      const oldValues = emp.toJSON();
      await emp.update({
        employeeCode: employeeCode !== undefined ? employeeCode : emp.employeeCode,
        userId: userId !== undefined ? userId : emp.userId,
        firstName: firstName !== undefined ? firstName : emp.firstName,
        middleName: middleName !== undefined ? middleName : emp.middleName,
        lastName: lastName !== undefined ? lastName : emp.lastName,
        gender: gender !== undefined ? gender : emp.gender,
        dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : emp.dateOfBirth,
        nationality: nationality !== undefined ? nationality : emp.nationality,
        email: email !== undefined ? email : emp.email,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : emp.phoneNumber,
        address: address !== undefined ? address : emp.address,
        country: country !== undefined ? country : emp.country,
        profilePhoto: emp.profilePhoto,
        dateOfJoining: dateOfJoining !== undefined ? dateOfJoining : emp.dateOfJoining,
        probationEndDate: probationEndDate !== undefined ? probationEndDate : emp.probationEndDate,
        employmentType: finalEmploymentType,
        contractEndDate: finalContractEndDate,
        remunerationBasis: remunerationBasis !== undefined ? remunerationBasis : emp.remunerationBasis,
        status: status !== undefined ? status : emp.status,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'EMPLOYEE_UPDATED',
        resourceType: 'Employee',
        resourceId: emp.id,
        oldValues,
        newValues: emp.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, emp);
    } catch (err) {
      next(err);
    }
  }

  public static async getPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const emp = await Employee.findByPk(id);
      if (!emp || !emp.profilePhoto) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Profile photo not found' },
        });
        return;
      }

      // Authorization check
      const isSuperOrHr = req.user?.roles?.some((r) => ['super_admin', 'hr_admin'].includes(r));
      const hasReadPerm = req.user?.permissions?.includes('employees:read');
      if (!isSuperOrHr && !hasReadPerm) {
        const currentEmp = await Employee.findOne({ where: { userId: req.user?.id } });
        if (!currentEmp || currentEmp.id !== emp.id) {
          throw AppError.forbidden('You do not have permission to view this profile photo');
        }
      }

      const absolutePath = path.resolve(process.cwd(), emp.profilePhoto);
      if (!fs.existsSync(absolutePath)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Photo file not found on server' },
        });
        return;
      }

      const ext = path.extname(absolutePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      };
      res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
      res.sendFile(absolutePath);
    } catch (err) {
      next(err);
    }
  }

  public static async deletePhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const emp = await Employee.findByPk(id);
      if (!emp) {
        throw AppError.notFound(`Employee with ID ${id} not found`);
      }

      if (emp.profilePhoto) {
        const absolutePath = path.resolve(process.cwd(), emp.profilePhoto);
        if (fs.existsSync(absolutePath)) {
          try {
            fs.unlinkSync(absolutePath);
          } catch {}
        }
        emp.profilePhoto = null;
        await emp.save();
      }

      sendSuccess(req, res, { message: 'Profile photo removed successfully' });
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const emp = await Employee.findByPk(id);
      if (!emp) {
        throw AppError.notFound(`Employee with ID ${id} not found`);
      }
      const oldValues = emp.toJSON();
      await emp.destroy();

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'EMPLOYEE_DEACTIVATED',
        resourceType: 'Employee',
        resourceId: id,
        oldValues,
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, { message: 'Employee deactivated successfully' });
    } catch (err) {
      next(err);
    }
  }
}

