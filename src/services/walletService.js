import sequelize from '../config/database.js';
import { User, WalletTransaction, Bill, Account } from '../models/index.js';
import BillService from './billService.js';

const toNumber = (value) => Number(value || 0);
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

class WalletService {
  static async getBalance(userId) {
    const user = await User.findByPk(userId, { attributes: ['id', 'walletBalance'] });
    return toNumber(user?.walletBalance);
  }

  static async listTransactions(userId, limit = 10, offset = 0) {
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
  static async creditTopup(userId, amount, { reference, description, metadata } = {}) {
    const value = round2(amount);
    if (!(value > 0)) throw new Error('Invalid top-up amount');
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
        type: 'topup',
        direction: 'credit',
        amount: value,
        balanceBefore: before,
        balanceAfter: after,
        reference,
        status: 'completed',
        description: description || 'Wallet top-up',
        metadata: metadata || null
      }, { transaction: t });

      return { alreadyCredited: false, balance: after, transaction };
    });
  }

  /**
   * Debit the wallet to settle a pending bill. Locks the user row so
   * concurrent requests can't double-spend the same balance, and re-checks
   * the bill status inside the transaction.
   */
  static async debitForBill(userId, billId, { reference, description } = {}) {
    return await sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!user) return { success: false, error: 'User not found' };

      const bill = await Bill.findByPk(billId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!bill) return { success: false, error: 'Bill not found' };

      const account = await Account.findByPk(bill.accountId, {
        transaction: t,
        attributes: ['id', 'userId', 'meterNumber', 'accountType']
      });
      if (!account || account.userId !== userId) {
        return { success: false, error: 'Not authorized' };
      }
      if (bill.status !== 'pending') {
        return { success: false, error: `This bill is already ${bill.status}.` };
      }

      const amount = round2(bill.amount);
      const before = toNumber(user.walletBalance);

      if (before < amount) {
        return {
          success: false,
          error: 'Insufficient balance',
          shortfall: round2(amount - before),
          balance: before,
          amount
        };
      }

      const after = round2(before - amount);
      await user.update({ walletBalance: after }, { transaction: t });

      const transaction = await WalletTransaction.create({
        userId,
        type: 'bill_payment',
        direction: 'debit',
        amount,
        balanceBefore: before,
        balanceAfter: after,
        reference: reference || `WALLET-${bill.billReference}`,
        status: 'completed',
        description: description || `Payment for bill ${bill.billReference}`,
        metadata: { billId: bill.id, billReference: bill.billReference }
      }, { transaction: t });

      const paidBill = await BillService.markAsPaid(bill.id, transaction.reference, { transaction: t });

      return { success: true, balance: after, amount, transaction, bill: paidBill, account };
    });
  }
}

export default WalletService;
