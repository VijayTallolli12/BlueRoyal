import { AppError } from '../../../core/errors/app-error';
import { EmployeeOnboarding } from '../models/employee-onboarding.model';
import { Employee } from '../../masters/models/employee.model';
import { EmployeeAssignment } from '../../masters/models/employee-assignment.model';
import { EmployeeHourlyRate } from '../../masters/models/employee-hourly-rate.model';
import { EmployeeSalaryStructure } from '../../masters/models/salary-component.model';
import { DocumentType } from '../../documents/models/document-type.model';
import { EmployeeDocument } from '../../documents/models/employee-document.model';
import { AuditService } from '../../../core/audit/audit.service';
import {
  EmployeeOnboardingDto,
  OnboardingChecklist,
  OnboardingStep,
  StartOnboardingDto,
  UpdateOnboardingProgressDto,
  CompleteOnboardingDto,
} from '@blue-royal/contracts';

export class OnboardingService {
  /**
   * Evaluates onboarding checklist and computes readiness score deterministically (20% each).
   */
  public static async evaluateReadiness(employeeId: string): Promise<{
    checklist: OnboardingChecklist;
    readinessScore: number;
    mandatoryDocsMissing: string[];
  }> {
    const emp = await Employee.findByPk(employeeId);
    if (!emp) {
      throw AppError.notFound(`Employee with ID ${employeeId} not found`);
    }

    // 1. Personal Info
    const personalInfo = Boolean(
      emp.firstName &&
      emp.lastName &&
      emp.dateOfBirth &&
      emp.gender &&
      emp.nationality &&
      (emp.email || emp.phoneNumber),
    );

    // 2. Employment Details
    const employmentDetails = Boolean(emp.dateOfJoining && emp.employmentType);

    // 3. Assignment Setup
    const assignmentCount = await EmployeeAssignment.count({
      where: { employeeId },
    });
    const assignmentSetup = assignmentCount > 0;

    // 4. Compensation Setup
    const hourlyCount = await EmployeeHourlyRate.count({
      where: { employeeId },
    });
    const salaryCount = await EmployeeSalaryStructure.count({
      where: { employeeId },
    });
    const compensationSetup = hourlyCount > 0 || salaryCount > 0;

    // 5. Mandatory Documents
    const mandatoryDocTypes = await DocumentType.findAll({
      where: { isMandatory: true, isActive: true },
    });

    const uploadedDocs = await EmployeeDocument.findAll({
      where: { employeeId },
      attributes: ['documentTypeId'],
    });
    const uploadedTypeIds = new Set(uploadedDocs.map((d) => d.documentTypeId));

    const mandatoryDocsMissing: string[] = [];
    for (const dt of mandatoryDocTypes) {
      if (!uploadedTypeIds.has(dt.id)) {
        mandatoryDocsMissing.push(dt.name);
      }
    }
    const mandatoryDocuments = mandatoryDocTypes.length === 0 || mandatoryDocsMissing.length === 0;

    const checklist: OnboardingChecklist = {
      personalInfo,
      employmentDetails,
      assignmentSetup,
      compensationSetup,
      mandatoryDocuments,
    };

    let score = 0;
    if (personalInfo) score += 20;
    if (employmentDetails) score += 20;
    if (assignmentSetup) score += 20;
    if (compensationSetup) score += 20;
    if (mandatoryDocuments) score += 20;

    return {
      checklist,
      readinessScore: score,
      mandatoryDocsMissing,
    };
  }

  /**
   * Derive current step from checklist
   */
  public static deriveCurrentStep(checklist: OnboardingChecklist): OnboardingStep {
    if (!checklist.personalInfo) return 'personal_info';
    if (!checklist.employmentDetails) return 'employment';
    if (!checklist.assignmentSetup) return 'assignment';
    if (!checklist.compensationSetup) return 'compensation';
    if (!checklist.mandatoryDocuments) return 'documents';
    return 'review';
  }

  /**
   * Enrich onboarding model to DTO
   */
  public static enrichOnboarding(
    ob: EmployeeOnboarding,
    missingReqs: string[] = [],
  ): EmployeeOnboardingDto {
    const json = ob.toJSON() as any;
    const employee = ob.employee || json.employee;
    const checklist = (json.checklistProgress || json.checklist) as OnboardingChecklist;

    return {
      id: json.id,
      employeeId: json.employeeId,
      employeeCode: employee?.employeeCode,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : undefined,
      employeeStatus: employee?.status,
      status: json.status,
      currentStep: json.currentStep || this.deriveCurrentStep(checklist),
      completionPercentage: json.completionPercentage !== undefined ? json.completionPercentage : (json.readinessScore || 0),
      checklistProgress: checklist,
      targetStartDate: json.targetStartDate || json.targetCompletionDate || null,
      completedAt: json.completedAt ? new Date(json.completedAt).toISOString() : null,
      completedByUserId: json.completedByUserId || json.completedBy || null,
      notes: json.notes,
      missingRequirements: missingReqs,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * Start onboarding for an employee
   */
  public static async startOnboarding(
    dto: StartOnboardingDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<EmployeeOnboardingDto> {
    const employee = await Employee.findByPk(dto.employeeId);
    if (!employee) {
      throw AppError.notFound(`Employee with ID ${dto.employeeId} not found`);
    }

    const existing = await EmployeeOnboarding.findOne({
      where: { employeeId: dto.employeeId },
    });
    if (existing) {
      throw AppError.conflict('An onboarding record already exists for this employee');
    }

    const { checklist, readinessScore, mandatoryDocsMissing } = await this.evaluateReadiness(
      dto.employeeId,
    );

    const onboarding = await EmployeeOnboarding.create({
      employeeId: dto.employeeId,
      status: 'in_progress',
      currentStep: this.deriveCurrentStep(checklist),
      checklistProgress: checklist,
      completionPercentage: readinessScore,
      targetStartDate: dto.targetStartDate || null,
      notes: dto.notes || null,
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'ONBOARDING_STARTED',
      resourceType: 'EmployeeOnboarding',
      resourceId: onboarding.id,
      newValues: onboarding.toJSON(),
      correlationId,
    });

    const reloaded = await EmployeeOnboarding.findByPk(onboarding.id, {
      include: [{ model: Employee, as: 'employee' }],
    });
    return this.enrichOnboarding(reloaded!, mandatoryDocsMissing);
  }

  /**
   * Sync/Refresh readiness score and checklist from actual database state
   */
  public static async refreshReadiness(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<EmployeeOnboardingDto> {
    const onboarding = await EmployeeOnboarding.findByPk(id, {
      include: [{ model: Employee, as: 'employee' }],
    });
    if (!onboarding) {
      throw AppError.notFound(`Onboarding record ${id} not found`);
    }

    const { checklist, readinessScore, mandatoryDocsMissing } = await this.evaluateReadiness(
      onboarding.employeeId,
    );

    const oldValues = {
      checklistProgress: onboarding.checklistProgress,
      completionPercentage: onboarding.completionPercentage,
    };

    await onboarding.update({
      checklistProgress: checklist,
      completionPercentage: readinessScore,
      currentStep: this.deriveCurrentStep(checklist),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'ONBOARDING_EVALUATED',
      resourceType: 'EmployeeOnboarding',
      resourceId: onboarding.id,
      oldValues,
      newValues: { checklistProgress: checklist, completionPercentage: readinessScore },
      correlationId,
    });

    return this.enrichOnboarding(onboarding, mandatoryDocsMissing);
  }

  /**
   * Update progress or notes
   */
  public static async updateProgress(
    id: string,
    dto: UpdateOnboardingProgressDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<EmployeeOnboardingDto> {
    const onboarding = await EmployeeOnboarding.findByPk(id, {
      include: [{ model: Employee, as: 'employee' }],
    });
    if (!onboarding) {
      throw AppError.notFound(`Onboarding record ${id} not found`);
    }

    const oldValues = onboarding.toJSON();

    if (dto.checklistProgress) {
      const mergedChecklist = { ...onboarding.checklistProgress, ...dto.checklistProgress };
      let score = 0;
      if (mergedChecklist.personalInfo) score += 20;
      if (mergedChecklist.employmentDetails) score += 20;
      if (mergedChecklist.assignmentSetup) score += 20;
      if (mergedChecklist.compensationSetup) score += 20;
      if (mergedChecklist.mandatoryDocuments) score += 20;

      await onboarding.update({
        checklistProgress: mergedChecklist,
        completionPercentage: score,
        currentStep: dto.currentStep || this.deriveCurrentStep(mergedChecklist),
        notes: dto.notes !== undefined ? dto.notes : onboarding.notes,
      });
    } else {
      await onboarding.update({
        currentStep: dto.currentStep || onboarding.currentStep,
        notes: dto.notes !== undefined ? dto.notes : onboarding.notes,
      });
    }

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'ONBOARDING_UPDATED',
      resourceType: 'EmployeeOnboarding',
      resourceId: onboarding.id,
      oldValues,
      newValues: onboarding.toJSON(),
      correlationId,
    });

    return this.enrichOnboarding(onboarding);
  }

  /**
   * Complete onboarding: enforces 100% readiness score and updates Employee status to probation or active.
   */
  public static async completeOnboarding(
    id: string,
    dto: CompleteOnboardingDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<EmployeeOnboardingDto> {
    const onboarding = await EmployeeOnboarding.findByPk(id, {
      include: [{ model: Employee, as: 'employee' }],
    });
    if (!onboarding) {
      throw AppError.notFound(`Onboarding record ${id} not found`);
    }

    // Force re-evaluation of readiness
    const { checklist, readinessScore, mandatoryDocsMissing } = await this.evaluateReadiness(
      onboarding.employeeId,
    );

    if (readinessScore < 100) {
      const missingParts: string[] = [];
      if (!checklist.personalInfo) missingParts.push('Personal Info');
      if (!checklist.employmentDetails) missingParts.push('Employment Details');
      if (!checklist.assignmentSetup) missingParts.push('Client/Project Assignment');
      if (!checklist.compensationSetup) missingParts.push('Compensation / Hourly Rate');
      if (!checklist.mandatoryDocuments) {
        missingParts.push(`Mandatory Documents (${mandatoryDocsMissing.join(', ')})`);
      }

      throw AppError.badRequest(
        `Cannot complete onboarding. Readiness score is ${readinessScore}%. Unmet prerequisites: ${missingParts.join('; ')}`,
      );
    }

    const employee = await Employee.findByPk(onboarding.employeeId);
    if (!employee) {
      throw AppError.notFound('Employee not found');
    }

    // Update onboarding status
    await onboarding.update({
      status: 'completed',
      completionPercentage: 100,
      checklistProgress: checklist,
      currentStep: 'review',
      completedAt: new Date(),
      completedByUserId: actorId || null,
      notes: dto.notes || onboarding.notes,
    });

    // Update employee status if draft or pending
    const newStatus = dto.activationStatus || 'probation';
    if (employee.status === 'draft' || employee.status === 'onboarding' || employee.status === 'probation') {
      await employee.update({ status: newStatus });
    }

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'ONBOARDING_COMPLETED',
      resourceType: 'EmployeeOnboarding',
      resourceId: onboarding.id,
      newValues: onboarding.toJSON(),
      correlationId,
    });

    return this.enrichOnboarding(onboarding);
  }

  /**
   * List onboarding records
   */
  public static async listOnboardings(filter: {
    status?: string;
  }): Promise<EmployeeOnboardingDto[]> {
    const where: any = {};
    if (filter.status) where.status = filter.status;

    const list = await EmployeeOnboarding.findAll({
      where,
      include: [{ model: Employee, as: 'employee' }],
      order: [['createdAt', 'DESC']],
    });

    return list.map((item) => this.enrichOnboarding(item));
  }

  /**
   * Get onboarding by ID
   */
  public static async getById(id: string): Promise<EmployeeOnboardingDto> {
    const onboarding = await EmployeeOnboarding.findByPk(id, {
      include: [{ model: Employee, as: 'employee' }],
    });
    if (!onboarding) {
      throw AppError.notFound(`Onboarding record ${id} not found`);
    }
    const { mandatoryDocsMissing } = await this.evaluateReadiness(onboarding.employeeId);
    return this.enrichOnboarding(onboarding, mandatoryDocsMissing);
  }

  /**
   * Get onboarding by Employee ID
   */
  public static async getByEmployeeId(employeeId: string): Promise<EmployeeOnboardingDto | null> {
    const onboarding = await EmployeeOnboarding.findOne({
      where: { employeeId },
      include: [{ model: Employee, as: 'employee' }],
    });
    if (!onboarding) return null;
    const { mandatoryDocsMissing } = await this.evaluateReadiness(onboarding.employeeId);
    return this.enrichOnboarding(onboarding, mandatoryDocsMissing);
  }
}
