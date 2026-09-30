import sequelize from '../config/database.js';
import { User, WalletTransaction, Bill, Account, Vend } from '../models/index.js';

const toNumber = (value: number | string | null | undefined): number => Number(value || 0);
const round2 = (value: number | string | null | undefined): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export type WalletCreditOptions = {
  reference?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
};

export type WalletDebitOptions = {
  reference?: string;
  description?: string;
};

class WalletService {
  static async getBalance(userId: string): Promise<number> {
    const user = await User.findByPk(userId, { attributes: ['id', 'walletBalance'] });
    return toNumber(user?.walletBalance);
  }

  static async listTransactions(userId: string, limit = 10, offset = 0) {
    return await WalletTransaction.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Credit the wallet. Idempotent on `reference`, so a repeated webhook
   * cannot credit the same top-up twice.
   */
  static async creditTopup(
    userId: string,
    amount: number | string,
    { reference, description, metadata }: WalletCreditOptions = {}
  ) {
    return await this.credit(userId, amount, {
      reference,
      type: 'topup',
      description: description || 'Wallet top-up',
      metadata
    });
  }

  /**
   * Credit the wallet back after a vend fails. Idempotent on the derived
   * reference, so a retried failure handler cannot refund twice.
   */
  static async refund(
    userId: string,
    amount: number | string,
    { reference, description, metadata }: WalletCreditOptions = {}
  ) {
    if (!reference) throw new Error('A reference is required for wallet refunds');

    return await this.credit(userId, amount, {
      reference: `REFUND-${reference}`,
      type: 'refund',
      description: description || 'Refund',
      metadata
    });
  }

  private static async credit(
    userId: string,
    amount: number | string,
    {
      reference,
      type,
      description,
      metadata
    }: WalletCreditOptions & { type: string }
  ) {
    const value = round2(amount);
    if (!(value > 0)) throw new Error('Invalid credit amount');
    if (!reference) throw new Error('A reference is required for wallet credits');

    return await sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!user) throw new Error('User not found');

      const existing = await WalletTransaction.findOne({ where: { reference }, transaction: t });
      if (existing) {
        return { alreadyCredited: true, balance: toNumber(user.walletBalance), transaction: existing };
      }

      const before = toNumber(user.walletBalance);
      const after = round2(before + value);

      await user.update({ walletBalance: after }, { transaction: t });

      const transaction = await WalletTransaction.create({
        userId,
        type,
        direction: 'credit',
        amount: value,
        balanceBefore: before,
        balanceAfter: after,
        reference,
        status: 'completed',
        description: description || 'Wallet credit',
        metadata: metadata || null
      }, { transaction: t });

      return { alreadyCredited: false, balance: after, transaction };
    });
  }

  /**
   * Debit the wallet to settle a pending bill. Locks the user row so
   * concurrent requests can't double-spend the same balance, and re-checks
   * the bill status inside the transaction.
   *
   * Captures the customer's money and opens a `Vend` row for Fucil to fulfil.
   * The Fucil call itself happens after this transaction commits, so the bill
   * stays `pending` until the vend resolves.
   */
  static async debitForBill(
    userId: string,
    billId: string,
    {
      reference,
      description,
      lookupReference,
      sandboxScenario
    }: WalletDebitOptions & { lookupReference?: string | null; sandboxScenario?: string | null } = {}
  ) {
    return await sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!user) return { success: false as const, error: 'User not found' as const };

      const bill = await Bill.findByPk(billId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!bill) return { success: false as const, error: 'Bill not found' as const };

      const account = await Account.findByPk(bill.accountId, {
        transaction: t,
        attributes: ['id', 'userId', 'meterNumber', 'accountType']
      });
      if (!account || account.userId !== userId) {
        return { success: false as const, error: 'Not authorized' as const };
      }
      if (bill.status !== 'pending') {
        return { success: false as const, error: `This bill is already ${bill.status}.` as const };
      }

      // One bill can only ever produce one vend, so a double-tap cannot
      // debit twice or vend twice for the same purchase.
      const existingVend = await Vend.findOne({ where: { billId }, transaction: t });
      if (existingVend) {
        return {
          success: false as const,
          error: 'A purchase for this bill is already in progress.' as const,
          vend: existingVend
        };
      }

      const amount = round2(bill.amount);
      const before = toNumber(user.walletBalance);

      if (before < amount) {
        return {
          success: false as const,
          error: 'Insufficient balance' as const,
          shortfall: round2(amount - before),
          balance: before,
          amount
        };
      }

      const after = round2(before - amount);
      await user.update({ walletBalance: after }, { transaction: t });

      const walletReference = reference || `WALLET-${bill.billReference}`;

      const transaction = await WalletTransaction.create({
        userId,
        type: 'bill_payment',
        direction: 'debit',
        amount,
        balanceBefore: before,
        balanceAfter: after,
        reference: walletReference,
        status: 'completed',
        description: description || `Payment for bill ${bill.billReference}`,
        metadata: { billId: bill.id, billReference: bill.billReference }
      }, { transaction: t });

      const vend = await Vend.create({
        billId: bill.id,
        accountId: account.id,
        userId,
        amount,
        currency: bill.currency || 'NGN',
        walletReference,
        status: 'initiated',
        fucilLookupReference: lookupReference || null,
        sandboxScenario: sandboxScenario || null
      }, { transaction: t });

      return { success: true as const, balance: after, amount, transaction, bill, account, vend };
    });
  }
}

export default WalletService;
