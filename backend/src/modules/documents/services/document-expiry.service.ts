import { ExpiryStatus } from '@blue-royal/contracts';

export class DocumentExpiryService {
  /**
   * Evaluates the expiry status and days remaining for a given expiry date string (YYYY-MM-DD).
   *
   * Formula:
   * diffDays = ceil((expiryDate.setHours(0,0,0,0) - today.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
   *
   * Thresholds:
   * - hasExpiry === false || !expiryDateString => { status: 'not_applicable', daysRemaining: null }
   * - diffDays < 0 => { status: 'expired', daysRemaining: diffDays }
   * - 0 <= diffDays <= 30 => { status: 'critical_expiry', daysRemaining: diffDays }
   * - 31 <= diffDays <= 60 => { status: 'approaching_expiry', daysRemaining: diffDays }
   * - diffDays > 60 => { status: 'valid', daysRemaining: diffDays }
   */
  public static calculateExpiryStatus(
    expiryDateString: string | null | undefined,
    hasExpiry: boolean = true,
    referenceDate: Date = new Date(),
  ): { status: ExpiryStatus; daysRemaining: number | null } {
    if (!hasExpiry || !expiryDateString) {
      return { status: 'not_applicable', daysRemaining: null };
    }

    // Reference midnight in local timezone / UTC
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    // Parse target date (YYYY-MM-DD)
    const parts = expiryDateString.split('-');
    if (parts.length !== 3) {
      return { status: 'not_applicable', daysRemaining: null };
    }

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const target = new Date(year, month, day, 0, 0, 0, 0);
    if (isNaN(target.getTime())) {
      return { status: 'not_applicable', daysRemaining: null };
    }

    const diffMs = target.getTime() - ref.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'expired', daysRemaining: diffDays };
    }
    if (diffDays <= 30) {
      return { status: 'critical_expiry', daysRemaining: diffDays };
    }
    if (diffDays <= 60) {
      return { status: 'approaching_expiry', daysRemaining: diffDays };
    }
    return { status: 'valid', daysRemaining: diffDays };
  }
}
