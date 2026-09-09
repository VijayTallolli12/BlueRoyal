import request from 'supertest';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/core/database/sequelize';
import { env } from '../../src/config/env';
import { User } from '../../src/modules/auth/models/user.model';
import { Role } from '../../src/modules/auth/models/role.model';
import { UserRole } from '../../src/modules/auth/models/user-role.model';
import { Employee } from '../../src/modules/masters/models/employee.model';
import { DocumentType } from '../../src/modules/documents/models/document-type.model';
import { EmployeeDocument } from '../../src/modules/documents/models/employee-document.model';
import { EmployeeOnboarding } from '../../src/modules/onboarding/models/employee-onboarding.model';
import { Client } from '../../src/modules/masters/models/client.model';
import { Project } from '../../src/modules/masters/models/project.model';
import { Designation } from '../../src/modules/masters/models/designation.model';
import { EmployeeAssignment } from '../../src/modules/masters/models/employee-assignment.model';
import { EmployeeHourlyRate } from '../../src/modules/masters/models/employee-hourly-rate.model';
import { AuditLog } from '../../src/modules/auth/models/audit-log.model';

describe('Phase 5 Documents & Onboarding Integration & Security Tests', () => {
  const app = createApp();
  let superAdminToken: string;
  let hrAdminToken: string;
  let employee1Token: string;
  let employee2Token: string;

  let emp1: Employee;
  let emp2: Employee;
  let user1: User;
  let user2: User;
  let docTypePassport: DocumentType;
  let docTypeContract: DocumentType;

  let testClient: Client;
  let testProject: Project;
  let testDesignation: Designation;

  const rand = Date.now().toString().slice(-6);

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Super Admin
    const adminUser = await User.findOne({ where: { email: 'admin@blueroyal.com' } });
    if (!adminUser) throw new Error('Super admin user must be seeded');
    superAdminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, roles: ['super_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 2. HR Admin
    const hrRole = await Role.findOne({ where: { name: 'hr_admin' } });
    const hrUser = await User.create({
      email: `hr.admin.${rand}@blueroyal.com`,
      passwordHash: 'dummy_hash',
      firstName: 'HR',
      lastName: 'Admin',
      isActive: true,
    });
    if (hrRole) {
      await UserRole.create({ userId: hrUser.id, roleId: hrRole.id });
    }
    hrAdminToken = jwt.sign(
      { userId: hrUser.id, email: hrUser.email, roles: ['hr_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 3. Employees (Users + Employee profiles)
    const empRole = await Role.findOne({ where: { name: 'employee' } });

    user1 = await User.create({
      email: `emp1.${rand}@blueroyal.com`,
      passwordHash: 'dummy_hash',
      firstName: 'Alice',
      lastName: 'Smith',
      isActive: true,
    });
    if (empRole) await UserRole.create({ userId: user1.id, roleId: empRole.id });

    emp1 = await Employee.create({
      employeeCode: `EP5-1-${rand}`,
      userId: user1.id,
      firstName: 'Alice',
      lastName: 'Smith',
      gender: 'female',
      dateOfBirth: '1992-05-15',
      nationality: 'United Arab Emirates',
      email: user1.email,
      dateOfJoining: '2026-01-01',
      employmentType: 'full_time',
      remunerationBasis: 'hourly',
      status: 'probation',
    });

    employee1Token = jwt.sign(
      { userId: user1.id, email: user1.email, roles: ['employee'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    user2 = await User.create({
      email: `emp2.${rand}@blueroyal.com`,
      passwordHash: 'dummy_hash',
      firstName: 'Bob',
      lastName: 'Jones',
      isActive: true,
    });
    if (empRole) await UserRole.create({ userId: user2.id, roleId: empRole.id });

    emp2 = await Employee.create({
      employeeCode: `EP5-2-${rand}`,
      userId: user2.id,
      firstName: 'Bob',
      lastName: 'Jones',
      gender: 'male',
      dateOfBirth: '1990-10-20',
      nationality: 'United Kingdom',
      email: user2.email,
      dateOfJoining: '2026-02-01',
      employmentType: 'full_time',
      remunerationBasis: 'hourly',
      status: 'probation',
    });

    employee2Token = jwt.sign(
      { userId: user2.id, email: user2.email, roles: ['employee'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 4. Document Types
    docTypePassport = (await DocumentType.findOne({ where: { code: 'PASSPORT' } }))!;
    if (!docTypePassport) {
      docTypePassport = await DocumentType.create({
        code: `PASSPORT_${rand}`,
        name: 'Passport Copy',
        isMandatory: true,
        hasExpiry: true,
        expiryAlertDays: 30,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        maxSizeBytes: 10485760,
        isActive: true,
      });
    }

    docTypeContract = (await DocumentType.findOne({ where: { code: 'OFFER_LETTER' } }))!;
    if (!docTypeContract) {
      docTypeContract = await DocumentType.create({
        code: `OFFER_LETTER_${rand}`,
        name: 'Offer Letter',
        isMandatory: false,
        hasExpiry: false,
        expiryAlertDays: 0,
        allowedMimeTypes: ['application/pdf'],
        maxSizeBytes: 10485760,
        isActive: true,
      });
    }

    // 5. Organizational masters for onboarding
    testClient = await Client.create({
      code: `CLI-P5-${rand}`,
      name: `Client P5 ${rand}`,
      contactPerson: 'Contact Person',
    });

    testProject = await Project.create({
      clientId: testClient.id,
      code: `PRJ-P5-${rand}`,
      name: `Project P5 ${rand}`,
    });

    testDesignation = await Designation.create({
      code: `DES-P5-${rand}`,
      title: `Specialist P5 ${rand}`,
    });
  });

  afterAll(async () => {
    // Cleanup generated data
    await EmployeeDocument.destroy({ where: { employeeId: [emp1?.id, emp2?.id] } });
    await EmployeeOnboarding.destroy({ where: { employeeId: [emp1?.id, emp2?.id] } });
    await EmployeeAssignment.destroy({ where: { employeeId: [emp1?.id, emp2?.id] } });
    await EmployeeHourlyRate.destroy({ where: { employeeId: [emp1?.id, emp2?.id] } });
    await emp1?.destroy();
    await emp2?.destroy();
    await user1?.destroy();
    await user2?.destroy();
  });

  describe('1. Document Security, Storage & Strict Multi-Tenant Isolation', () => {
    let emp1DocId: string;

    it('should reject unauthenticated document upload', async () => {
      const res = await request(app)
        .post('/api/v1/documents')
        .attach('file', Buffer.from('test pdf content'), 'test.pdf')
        .field('employeeId', emp1.id)
        .field('documentTypeId', docTypePassport.id);

      expect(res.status).toBe(401);
    });

    it('should allow employee to upload document for self, creating audit log', async () => {
      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${employee1Token}`)
        .attach('file', Buffer.from('%PDF-1.4 test document'), 'passport.pdf')
        .field('employeeId', emp1.id)
        .field('documentTypeId', docTypePassport.id)
        .field('documentNumber', 'P12345678')
        .field('expiryDate', '2028-12-31');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employeeId).toBe(emp1.id);
      expect(res.body.data.expiryStatus).toBe('valid');
      expect(res.body.data.verificationStatus).toBe('pending');

      emp1DocId = res.body.data.id;

      // Verify Audit record
      const audit = await AuditLog.findOne({
        where: { resourceType: 'EmployeeDocument', resourceId: emp1DocId, action: 'DOCUMENT_UPLOADED' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorId).toBe(user1.id);
    });

    it('SECURITY GATE: Employee 2 MUST be forbidden from downloading Employee 1 document', async () => {
      const res = await request(app)
        .get(`/api/v1/documents/${emp1DocId}/download`)
        .set('Authorization', `Bearer ${employee2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('only download your own documents');
    });

    it('SECURITY GATE: Employee 2 MUST be forbidden from viewing Employee 1 document metadata', async () => {
      const res = await request(app)
        .get(`/api/v1/documents/${emp1DocId}`)
        .set('Authorization', `Bearer ${employee2Token}`);

      expect(res.status).toBe(403);
    });

    it('SECURITY GATE: Employee 2 query on /documents must automatically scope to own employeeId only', async () => {
      const res = await request(app)
        .get(`/api/v1/documents?employeeId=${emp1.id}`)
        .set('Authorization', `Bearer ${employee2Token}`);

      expect(res.status).toBe(200);
      // Even though Employee 2 asked for emp1.id, the server forced employeeId = emp2.id
      expect(res.body.data.length).toBe(0);
    });

    it('should allow HR Admin and Super Admin to download any employee document', async () => {
      const res = await request(app)
        .get(`/api/v1/documents/${emp1DocId}/download`)
        .set('Authorization', `Bearer ${hrAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/pdf');
    });

    it('SECURITY: Server-side validation must reject invalid mime types', async () => {
      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .attach('file', Buffer.from('malicious script'), { filename: 'malicious.sh', contentType: 'application/x-sh' })
        .field('employeeId', emp1.id)
        .field('documentTypeId', docTypePassport.id);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('is not allowed');
    });

    it('SECURITY: Path traversal attacks in filename must be prevented and neutralized', async () => {
      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .attach('file', Buffer.from('%PDF-1.4 test'), { filename: '../../etc/passwd.pdf', contentType: 'application/pdf' })
        .field('employeeId', emp1.id)
        .field('documentTypeId', docTypePassport.id);

      expect(res.status).toBe(201);
      // Confirm stored file path stays strictly confined within storage/documents/<empId>
      const doc = await EmployeeDocument.findByPk(res.body.data.id);
      expect(doc!.filePath).toMatch(new RegExp(`storage/documents/${emp1.id}/`));
      expect(doc!.filePath).not.toContain('..');
    });

    it('Verification workflow: HR Admin verifies document and creates audit event', async () => {
      const res = await request(app)
        .post(`/api/v1/documents/${emp1DocId}/verify`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          status: 'verified',
          remarks: 'Verified against physical passport original copy',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe('verified');

      const audit = await AuditLog.findOne({
        where: { resourceType: 'EmployeeDocument', resourceId: emp1DocId, action: 'DOCUMENT_VERIFIED' },
      });
      expect(audit).not.toBeNull();
    });

    it('Verification workflow: Employee cannot verify documents (RBAC protected)', async () => {
      const res = await request(app)
        .post(`/api/v1/documents/${emp1DocId}/verify`)
        .set('Authorization', `Bearer ${employee1Token}`)
        .send({ status: 'verified' });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Onboarding Lifecycle & 5-Pillar 100% Activation Gate', () => {
    let onboardingId: string;

    it('should start onboarding in in_progress status and compute initial score', async () => {
      const res = await request(app)
        .post('/api/v1/onboarding')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          employeeId: emp1.id,
          targetStartDate: '2026-10-01',
          notes: 'New hire statutory pipeline',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');

      onboardingId = res.body.data.id;

      // Personal Info (20%) + Employment Details (20%) are satisfied = 40%
      expect(res.body.data.completionPercentage).toBeGreaterThanOrEqual(40);
    });

    it('ACTIVATION GATE: Cannot complete onboarding while readiness score < 100%', async () => {
      const res = await request(app)
        .post(`/api/v1/onboarding/${onboardingId}/complete`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({ activationStatus: 'probation' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot complete onboarding. Readiness score is');
      expect(res.body.error.message).toContain('Unmet prerequisites');
    });

    it('Completing prerequisites sequentially and verifying 100% readiness', async () => {
      // Satisfy Pillar 3: Deployment Assignment
      await EmployeeAssignment.create({
        employeeId: emp1.id,
        clientId: testClient.id,
        projectId: testProject.id,
        designationId: testDesignation.id,
        effectiveFrom: '2026-01-01',
      });

      // Satisfy Pillar 4: Hourly Rate
      await EmployeeHourlyRate.create({
        employeeId: emp1.id,
        normalHourlyRate: 25.0,
        otHourlyRate: 37.5,
        effectiveFrom: '2026-01-01',
      });

      // Satisfy Pillar 5: Remaining Mandatory Documents (Visa, Emirates ID)
      const allMandatoryTypes = await DocumentType.findAll({
        where: { isMandatory: true, isActive: true },
      });
      for (const mType of allMandatoryTypes) {
        const alreadyUploaded = await EmployeeDocument.findOne({
          where: { employeeId: emp1.id, documentTypeId: mType.id },
        });
        if (!alreadyUploaded) {
          await EmployeeDocument.create({
            employeeId: emp1.id,
            documentTypeId: mType.id,
            originalFileName: `${mType.code.toLowerCase()}.pdf`,
            filePath: `storage/documents/${emp1.id}/${mType.code.toLowerCase()}.pdf`,
            fileSizeBytes: 1024,
            mimeType: 'application/pdf',
            verificationStatus: 'verified',
          });
        }
      }

      // Re-evaluate
      const refreshRes = await request(app)
        .post(`/api/v1/onboarding/${onboardingId}/refresh`)
        .set('Authorization', `Bearer ${hrAdminToken}`);

      expect(refreshRes.status).toBe(200);
      // All 5 pillars (Personal, Employment, Assignment, Compensation, Mandatory Docs) are now met
      expect(refreshRes.body.data.completionPercentage).toBe(100);
      expect(refreshRes.body.data.checklistProgress.personalInfo).toBe(true);
      expect(refreshRes.body.data.checklistProgress.employmentDetails).toBe(true);
      expect(refreshRes.body.data.checklistProgress.assignmentSetup).toBe(true);
      expect(refreshRes.body.data.checklistProgress.compensationSetup).toBe(true);
      expect(refreshRes.body.data.checklistProgress.mandatoryDocuments).toBe(true);
    });

    it('ACTIVATION GATE: Successfully complete onboarding when readiness is 100%', async () => {
      const res = await request(app)
        .post(`/api/v1/onboarding/${onboardingId}/complete`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({ activationStatus: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.completionPercentage).toBe(100);

      // Verify employee status transitioned
      const reloadedEmp = await Employee.findByPk(emp1.id);
      expect(reloadedEmp!.status).toBe('active');

      // Verify Audit record
      const audit = await AuditLog.findOne({
        where: { resourceType: 'EmployeeOnboarding', resourceId: onboardingId, action: 'ONBOARDING_COMPLETED' },
      });
      expect(audit).not.toBeNull();
    });
  });
});
