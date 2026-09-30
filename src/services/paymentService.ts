import { Payment, Bill, User, Transaction, Account } from '../models/index.js';
import BillService from './billService.js';
import PaystackService from './paystack.js';
import WalletService from './walletService.js';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { PaystackError, type PaystackVerifyData } from './paystack.js';

/** Payment with the associations `verifyPayment` eager-loads. */
export type VerifiedPayment = Payment & {
  bill?: (Bill & { account?: Account | null }) | null;
  user?: Pick<User, 'id' | 'telegramId' | 'email' | 'firstName' | 'lastName'> | null;
};

export type VerifyPaymentResult =
  | { success: false; error: string }
  | { success: true; payment: VerifiedPayment; alreadyProcessed: true; walletBalance?: number }
  | { success: true; payment: VerifiedPayment; alreadyProcessed?: false; walletBalance?: number };

/** Paystack sends `paid_at` as an ISO string or unix seconds depending on the endpoint. */
const toDate = (value: string | number | Date | null | undefined): Date =>
  value === null || value === undefined ? new Date() : new Date(value);

class PaymentService {
  static async initiatePayment(userId: string, billId: string, userEmail: string) {
    const bill = await Bill.findByPk(billId);
    if (!bill) throw new Error('Bill not found');
    if (bill.status !== 'pending') throw new Error('Bill is not pending');

    const reference = `PAY-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    const payment = await Payment.create({
      userId,
      billId,
      amount: bill.amount,
      currency: bill.currency,
      paystackReference: reference,
      status: 'pending',
      metadata: {
        billReference: bill.billReference,
        accountInfo: bill.description
      }
    });

    const paystackResponse = await PaystackService.initializeTransaction(
      userEmail,
      bill.amount,
      {
        paymentId: payment.id,
        billId: bill.id,
        userId
      }
    );

    await payment.update({ paystackReference: paystackResponse.data.reference });

    return {
      payment: { ...payment.toJSON(), paystackReference: paystackResponse.data.reference },
      authorizationUrl: paystackResponse.data.authorization_url,
      reference: paystackResponse.data.reference
    };
  }

  static async initiateTopup(userId: string, userEmail: string, amount: number | string) {
    const value = Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;
    if (!(value > 0)) throw new Error('Invalid top-up amount');

    const reference = `TOPUP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    const payment = await Payment.create({
      userId,
      billId: null,
      amount: value,
      currency: 'NGN',
      paystackReference: reference,
      status: 'pending',
      purpose: 'wallet_topup',
      metadata: { purpose: 'wallet_topup' }
    });

    const paystackResponse = await PaystackService.initializeTransaction(userEmail, value, {
      paymentId: payment.id,
      userId,
      purpose: 'wallet_topup'
    });

    await payment.update({ paystackReference: paystackResponse.data.reference });

    return {
      payment: { ...payment.toJSON(), paystackReference: paystackResponse.data.reference },
      authorizationUrl: paystackResponse.data.authorization_url,
      reference: paystackResponse.data.reference
    };
  }

  static async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    let verification: PaystackVerifyData;
    try {
      const result = await PaystackService.verifyTransaction(reference);
      verification = result.data;
    } catch (error) {
      if (error instanceof PaystackError && error.status !== null && error.status >= 400 && error.status < 500) {
        return { success: false, error: 'Transaction not verifiable' };
      }
      throw error;
    }

    if (verification.status !== 'success') {
      return { success: false, error: 'Payment verification failed' };
    }

    const payment = await Payment.findOne({
      where: { paystackReference: reference },
      include: [
        { model: User, as: 'user', attributes: ['id', 'telegramId', 'email', 'firstName', 'lastName'] },
        { model: Bill, as: 'bill', include: [{ model: Account, as: 'account' }] }
      ]
    });

    if (!payment) return { success: false, error: 'Payment not found locally' };
    if (payment.status === 'success') return { success: true, payment, alreadyProcessed: true };

    // Wallet top-up: credit the wallet (idempotent on reference).
    if (payment.purpose === 'wallet_topup' || !payment.billId) {
      const credit = await WalletService.creditTopup(payment.userId, payment.amount, {
        reference: `TOPUP-${payment.paystackReference}`,
        description: 'Wallet top-up',
        metadata: { paymentId: payment.id, paystackReference: payment.paystackReference }
      });

      await payment.update({
        status: 'success',
        paymentMethod: verification.authorization?.card_type ?? null,
        paymentChannel: verification.channel ?? null,
        gatewayResponse: verification,
        paidAt: toDate(verification.paid_at)
      });

      await payment.reload({
        include: [
          { model: User, as: 'user', attributes: ['id', 'telegramId', 'email', 'firstName', 'lastName'] },
          { model: Bill, as: 'bill', include: [{ model: Account, as: 'account' }] }
        ]
      });

      return { success: true, payment, walletBalance: credit.balance };
    }

    // Legacy direct bill payment (kept for rows created before wallets).
    await payment.update({
      status: 'success',
      paymentMethod: verification.authorization?.card_type ?? null,
      paymentChannel: verification.channel ?? null,
      gatewayResponse: verification,
      paidAt: toDate(verification.paid_at)
    });

    // Legacy rows predate wallets and Fucil, so there is no Vend to fulfil and
    // no token to issue — the bill is simply settled.
    const paidBill = await BillService.markAsPaid(payment.billId as string, reference);
    payment.bill = paidBill;

    await Transaction.findOrCreate({
      where: { reference },
      defaults: {
        userId: payment.userId,
        type: 'bill_payment',
        amount: payment.amount,
        currency: payment.currency,
        reference,
        status: 'completed',
        description: `Payment for bill ${payment.billId}`,
        metadata: {
          paymentId: payment.id,
          billId: payment.billId
        }
      }
    });

    await payment.reload({ include: [
      { model: User, as: 'user', attributes: ['id', 'telegramId', 'email', 'firstName', 'lastName'] },
      { model: Bill, as: 'bill', include: [{ model: Account, as: 'account' }] }
    ] });

    return { success: true, payment };
  }

  static async getPaymentHistory(userId: string, limit = 10, offset = 0) {
    return await Payment.findAll({
      where: { userId },
      include: [{
        model: Bill,
        as: 'bill',
        attributes: ['billReference', 'amount', 'period', 'token']
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  static async getPaymentByReference(reference: string) {
    return await Payment.findOne({
      where: { paystackReference: reference },
      include: [
        { model: User, as: 'user', attributes: ['telegramId', 'email'] },
        { model: Bill, as: 'bill' }
      ]
    });
  }

  static async getPaymentById(paymentId: string) {
    return await Payment.findOne({
      where: { id: paymentId },
      include: [
        { model: Bill, as: 'bill', include: [{ model: Account, as: 'account' }] }
      ]
    });
  }

  static async cancelPayment(
    paymentId: string,
    userId?: string | null
  ): Promise<{ success: boolean; error?: string; payment?: Payment }> {
    const payment = await Payment.findByPk(paymentId, {
      include: [{ model: Bill, as: 'bill' }]
    });

    if (!payment) return { success: false, error: 'Payment not found' };
    if (userId && payment.userId !== userId) return { success: false, error: 'Not authorized' };
    if (payment.status === 'success') return { success: false, error: 'This payment is already completed.' };

    if (await this.reconcileIfCaptured(payment)) {
      return { success: false, error: 'This payment was already completed on Paystack and has been reconciled.' };
    }

    await payment.update({
      status: 'failed',
      metadata: {
        ...(payment.metadata || {}),
        cancelled: true,
        cancelledAt: new Date().toISOString()
      }
    });

    if (payment.bill && payment.bill.status === 'pending') {
      await payment.bill.update({ status: 'cancelled' });
    }

    return { success: true, payment };
  }

  static async cancelPendingForAccount(userId: string, accountId: string) {
    const pending = await Payment.findAll({
      where: { userId, status: 'pending' },
      include: [{
        model: Bill,
        as: 'bill',
        where: { accountId, status: 'pending' },
        required: true
      }]
    });

    let cancelled = 0;
    let reconciled = 0;

    for (const payment of pending) {
      // Never fail a payment Paystack already captured; settle it instead.
      if (await this.reconcileIfCaptured(payment)) {
        reconciled += 1;
        continue;
      }

      await payment.update({
        status: 'failed',
        metadata: {
          ...(payment.metadata || {}),
          cancelled: true,
          superseded: true,
          cancelledAt: new Date().toISOString()
        }
      });
      if (payment.bill) {
        await payment.bill.update({ status: 'cancelled' });
      }
      cancelled += 1;
    }

    return { cancelled, reconciled };
  }

  /**
   * A payment that is not yet `success` may still have been captured by
   * Paystack — its webhook may be missing, delayed, or rejected. Verify against
   * Paystack and, if it was captured, settle it through the normal path.
   *
   * Returns true when the payment turned out to be captured and was applied.
   * Throws when Paystack cannot be reached, because we must not treat an
   * unverifiable payment as safe to cancel.
   */
  private static async reconcileIfCaptured(payment: Payment): Promise<boolean> {
    const reference = payment.paystackReference;
    if (!reference) return false;

    let result: VerifyPaymentResult;
    try {
      result = await this.verifyPayment(reference);
    } catch (error) {
      throw new Error(
        `Cannot reconcile ${reference} while Paystack is unreachable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return result.success;
  }

  /** Payments still awaiting settlement: anything not already successful. */
  static async listUnreconciled(limit = 100) {
    return await Payment.findAll({
      where: { status: { [Op.in]: ['pending', 'failed'] } },
      order: [['createdAt', 'DESC']],
      limit
    });
  }

  static async handleWebhook(
    event: string,
    data: { reference: string }
  ): Promise<VerifyPaymentResult | { success: boolean; message?: string }> {
    switch (event) {
      case 'charge.success':
        return await this.verifyPayment(data.reference);
      case 'charge.failed':
        return await this.handleFailedPayment(data.reference);
      default:
        return { success: true, message: 'Event not handled' as const };
    }
  }

  static async handleFailedPayment(reference: string): Promise<{ success: boolean }> {
    const payment = await Payment.findOne({
      where: { paystackReference: reference }
    });

    if (payment) {
      await payment.update({
        status: 'failed',
        gatewayResponse: { error: 'Payment failed' }
      });
    }

    return { success: true };
  }
}

export default PaymentService;
