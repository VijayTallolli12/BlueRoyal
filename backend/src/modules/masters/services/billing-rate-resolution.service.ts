import { ResolvedBillingRateDto } from '@blue-royal/contracts';
import { EmployeeAssignment } from '../models/employee-assignment.model';
import { ClientBillingRate } from '../models/client-billing-rate.model';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { Transaction } from 'sequelize';

export class BillingRateResolutionService {
  /**
   * Official Point-in-Time Billing Rate Resolution Pipeline:
   * 
   * Work Date + Employee ID
   *   -> Active Employee Assignment on Work Date
   *      -> Missing? Returns MISSING_ASSIGNMENT
   *   -> Active Project-Specific Client Billing Rate on Work Date
   *      -> Found? Returns PROJECT_SPECIFIC rate
   *   -> Fallback: Active Client-Wide Client Billing Rate on Work Date (project_id IS NULL)
   *      -> Found? Returns CLIENT_WIDE_FALLBACK rate
   *   -> Missing? Returns MISSING_BILLING_RATE
   */
  public static async resolveBillingRate(
    employeeId: string,
    workDate: string,
    transaction?: Transaction,
  ): Promise<ResolvedBillingRateDto> {
    // 1. Resolve employee assignment on work date
    const assignment = await EffectiveDateService.resolveAtDate(
      EmployeeAssignment,
      { employeeId },
      workDate,
      transaction,
    );

    if (!assignment) {
      return {
        status: 'MISSING_ASSIGNMENT',
        workDate,
        employeeId,
        errorCode: 'UNASSIGNED_EMPLOYEE',
        errorMessage: `Employee ${employeeId} has no active project deployment on ${workDate}`,
      };
    }

    const { clientId, projectId, designationId } = assignment;

    // 2. Try Project-Specific Rate on work date
    const projectRate = await EffectiveDateService.resolveAtDate(
      ClientBillingRate,
      {
        clientId,
        projectId,
        designationId,
      },
      workDate,
      transaction,
    );

    if (projectRate) {
      return {
        status: 'RESOLVED',
        workDate,
        employeeId,
        clientId,
        projectId,
        designationId,
        rateSource: 'PROJECT_SPECIFIC',
        normalBillingRate: Number(projectRate.normalBillingRate),
        otBillingRate: Number(projectRate.otBillingRate),
      };
    }

    // 3. Fallback to Client-Wide Rate on work date (project_id is null)
    const clientWideRate = await EffectiveDateService.resolveAtDate(
      ClientBillingRate,
      {
        clientId,
        projectId: null,
        designationId,
      },
      workDate,
      transaction,
    );

    if (clientWideRate) {
      return {
        status: 'RESOLVED',
        workDate,
        employeeId,
        clientId,
        projectId,
        designationId,
        rateSource: 'CLIENT_WIDE_FALLBACK',
        normalBillingRate: Number(clientWideRate.normalBillingRate),
        otBillingRate: Number(clientWideRate.otBillingRate),
      };
    }

    // 4. Missing billing rate
    return {
      status: 'MISSING_BILLING_RATE',
      workDate,
      employeeId,
      clientId,
      projectId,
      designationId,
      errorCode: 'MISSING_BILLING_RATE',
      errorMessage: `No client billing rate found for Client ${clientId}, Project ${projectId}, Designation ${designationId} on ${workDate}`,
    };
  }
}
