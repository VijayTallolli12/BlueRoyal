import { DocumentExpiryService } from '../../src/modules/documents/services/document-expiry.service';

describe('DocumentExpiryService', () => {
  const refDate = new Date('2026-09-09T10:00:00Z');

  it('should return not_applicable when hasExpiry is false or date is missing', () => {
    expect(DocumentExpiryService.calculateExpiryStatus(null, false, refDate)).toEqual({
      status: 'not_applicable',
      daysRemaining: null,
    });
    expect(DocumentExpiryService.calculateExpiryStatus('2026-10-10', false, refDate)).toEqual({
      status: 'not_applicable',
      daysRemaining: null,
    });
    expect(DocumentExpiryService.calculateExpiryStatus('', true, refDate)).toEqual({
      status: 'not_applicable',
      daysRemaining: null,
    });
  });

  it('should classify expired documents correctly (diff < 0)', () => {
    const res = DocumentExpiryService.calculateExpiryStatus('2026-09-08', true, refDate);
    expect(res.status).toBe('expired');
    expect(res.daysRemaining).toBe(-1);

    const resPastMonth = DocumentExpiryService.calculateExpiryStatus('2026-08-09', true, refDate);
    expect(resPastMonth.status).toBe('expired');
    expect(resPastMonth.daysRemaining).toBeLessThan(-20);
  });

  it('should classify critical expiry correctly (0 <= diff <= 30)', () => {
    const today = DocumentExpiryService.calculateExpiryStatus('2026-09-09', true, refDate);
    expect(today.status).toBe('critical_expiry');
    expect(today.daysRemaining).toBe(0);

    const in30Days = DocumentExpiryService.calculateExpiryStatus('2026-10-09', true, refDate);
    expect(in30Days.status).toBe('critical_expiry');
    expect(in30Days.daysRemaining).toBe(30);
  });

  it('should classify approaching expiry correctly (31 <= diff <= 60)', () => {
    const in31Days = DocumentExpiryService.calculateExpiryStatus('2026-10-10', true, refDate);
    expect(in31Days.status).toBe('approaching_expiry');
    expect(in31Days.daysRemaining).toBe(31);

    const in60Days = DocumentExpiryService.calculateExpiryStatus('2026-11-08', true, refDate);
    expect(in60Days.status).toBe('approaching_expiry');
    expect(in60Days.daysRemaining).toBe(60);
  });

  it('should classify valid documents correctly (diff > 60)', () => {
    const in61Days = DocumentExpiryService.calculateExpiryStatus('2026-11-09', true, refDate);
    expect(in61Days.status).toBe('valid');
    expect(in61Days.daysRemaining).toBe(61);

    const in1Year = DocumentExpiryService.calculateExpiryStatus('2027-09-09', true, refDate);
    expect(in1Year.status).toBe('valid');
    expect(in1Year.daysRemaining).toBeGreaterThan(360);
  });
});
