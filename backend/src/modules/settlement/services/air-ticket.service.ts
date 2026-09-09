import { AirTicketPolicy } from '../models/air-ticket-policy.model';
import { round2 } from '../../../core/utils/math.util';
import { Op } from 'sequelize';

export interface AirTicketResult {
  isEligible: boolean;
  destinationCountry: string | null;
  policyId: string | null;
  policyRegion: string | null;
  entitlementAmount: number;
  isOverridden: boolean;
  notes: string;
}

export class AirTicketService {
  /**
   * Determine repatriation air ticket entitlement based on configurable policy structure.
   * Approved Rule BR-04: Configurable policy table, no hardcoded values.
   */
  public static async calculateAirTicketEntitlement(params: {
    repatriationRequired: boolean;
    hasNewUaeEmployment: boolean;
    destinationCountry?: string | null;
    manualOverrideAmount?: number | null;
  }): Promise<AirTicketResult> {
    // 1. Statutory Exclusions
    if (!params.repatriationRequired) {
      return {
        isEligible: false,
        destinationCountry: params.destinationCountry || null,
        policyId: null,
        policyRegion: null,
        entitlementAmount: 0.0,
        isOverridden: false,
        notes: 'Repatriation ticket not requested or required',
      };
    }

    if (params.hasNewUaeEmployment) {
      return {
        isEligible: false,
        destinationCountry: params.destinationCountry || null,
        policyId: null,
        policyRegion: null,
        entitlementAmount: 0.0,
        isOverridden: false,
        notes: 'Exempt from employer repatriation ticket due to local UAE employment transfer (Article 13(12))',
      };
    }

    // 2. Check if manual override was supplied
    if (params.manualOverrideAmount !== undefined && params.manualOverrideAmount !== null) {
      return {
        isEligible: true,
        destinationCountry: params.destinationCountry || null,
        policyId: null,
        policyRegion: null,
        entitlementAmount: round2(Number(params.manualOverrideAmount)),
        isOverridden: true,
        notes: 'Manual air ticket allowance specified',
      };
    }

    // 3. Resolve from configurable AirTicketPolicy table
    let policy: AirTicketPolicy | null = null;

    if (params.destinationCountry) {
      policy = await AirTicketPolicy.findOne({
        where: {
          isActive: true,
          [Op.or]: [
            { countryName: { [Op.iLike]: params.destinationCountry.trim() } },
            { countryCode: { [Op.iLike]: params.destinationCountry.trim() } },
          ],
        },
      });
    }

    // Fallback to DEFAULT policy if no country match
    if (!policy) {
      policy = await AirTicketPolicy.findOne({
        where: {
          isActive: true,
          countryCode: 'DEFAULT',
        },
      });
    }

    if (policy) {
      return {
        isEligible: true,
        destinationCountry: params.destinationCountry || policy.countryName,
        policyId: policy.id,
        policyRegion: policy.region,
        entitlementAmount: round2(policy.entitlementAmount),
        isOverridden: false,
        notes: `Entitlement resolved from policy: ${policy.countryName} (${policy.region})`,
      };
    }

    // If no policy records exist in database at all
    return {
      isEligible: true,
      destinationCountry: params.destinationCountry || null,
      policyId: null,
      policyRegion: null,
      entitlementAmount: 0.0,
      isOverridden: false,
      notes: 'No active air ticket policy found; defaults to 0.00 AED',
    };
  }
}
