import { Transaction } from 'sequelize';
import { sequelize } from './sequelize';

export async function runInTransaction<T>(
  callback: (transaction: Transaction) => Promise<T>,
  existingTransaction?: Transaction,
): Promise<T> {
  if (existingTransaction) {
    return callback(existingTransaction);
  }

  return sequelize.transaction(async (t: Transaction) => {
    return callback(t);
  });
}
