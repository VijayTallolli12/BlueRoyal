import { Op, ModelStatic, Model, Transaction, WhereOptions } from 'sequelize';
import { AppError } from '../errors/app-error';

export class EffectiveDateService {
  /**
   * Resolves the active record for a given target entity at a specific point-in-time date.
   */
  public static async resolveAtDate<T extends Model>(
    model: ModelStatic<T>,
    filterCriteria: Record<string, unknown>,
    targetDate: string | Date,
    transaction?: Transaction,
  ): Promise<T | null> {
    const formattedDate = typeof targetDate === 'string' ? targetDate : targetDate.toISOString().slice(0, 10);

    const where: WhereOptions<any> = {
      ...filterCriteria,
      effectiveFrom: {
        [Op.lte]: formattedDate,
      },
      [Op.or]: [
        { effectiveTo: null },
        {
          effectiveTo: {
            [Op.gte]: formattedDate,
          },
        },
      ],
    };

    const record = await model.findOne({
      where,
      order: [['effectiveFrom', 'DESC']],
      transaction,
    });

    return record;
  }

  /**
   * Validates non-overlapping intervals when creating a new record.
   * If autoClosePrior is true, automatically terminates an open-ended prior record
   * on (newEffectiveFrom - 1 day).
   */
  public static async validateAndPrepareInterval<T extends Model>(
    model: ModelStatic<T>,
    filterCriteria: Record<string, unknown>,
    newEffectiveFrom: string,
    newEffectiveTo: string | null = null,
    autoClosePrior = true,
    transaction?: Transaction,
  ): Promise<void> {
    if (newEffectiveTo && newEffectiveTo < newEffectiveFrom) {
      throw AppError.badRequest('effective_to date must be greater than or equal to effective_from date');
    }

    const where: WhereOptions<any> = {
      ...filterCriteria,
      [Op.and]: [
        newEffectiveTo
          ? { effectiveFrom: { [Op.lte]: newEffectiveTo } }
          : {},
        {
          [Op.or]: [
            { effectiveTo: null },
            { effectiveTo: { [Op.gte]: newEffectiveFrom } },
          ],
        },
      ],
    };

    // 1. Check for overlapping records
    const overlappingRecords = await model.findAll({
      where,
      order: [['effectiveFrom', 'DESC']],
      transaction,
    });

    if (overlappingRecords.length === 0) {
      return;
    }

    // 2. If autoClosePrior is true and there is exactly 1 overlapping record that is open-ended
    // and started strictly before newEffectiveFrom, close it automatically.
    if (autoClosePrior && overlappingRecords.length === 1) {
      const prior = overlappingRecords[0] as unknown as {
        effectiveFrom: string;
        effectiveTo: string | null;
        update: (values: Record<string, unknown>, opts: { transaction?: Transaction }) => Promise<void>;
      };

      if (prior.effectiveTo === null && prior.effectiveFrom < newEffectiveFrom) {
        // Calculate prior end date as (newEffectiveFrom - 1 day)
        const prevDate = new Date(newEffectiveFrom);
        prevDate.setDate(prevDate.getDate() - 1);
        const closedEndDate = prevDate.toISOString().slice(0, 10);

        await prior.update({ effectiveTo: closedEndDate }, { transaction });
        return;
      }
    }

    // Otherwise, an explicit overlap exists
    throw AppError.conflict(
      'An overlapping effective-dated record already exists for the specified timeframe',
    );
  }
}
