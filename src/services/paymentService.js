import { Payment, Bill, User, Transaction, Account } from '../models/index.js';
import BillService from './billService.js';
import PaystackService from './paystack.js';
import { v4 as uuidv4 } from 'uuid';

class PaymentService {
  static async initiatePayment(userId, billId, userEmail) {
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

  static async verifyPayment(reference) {
    const verification = await PaystackService.verifyTransaction(reference);
    
    if (verification.data.status === 'success') {
      const payment = await Payment.findOne({
        where: { paystackReference: reference },
        include: [
          { model: User, as: 'user', attributes: ['id', 'telegramId', 'email', 'firstName', 'lastName'] },
          {
            model: Bill,
            as: 'bill',
            include: [{ model: Account, as: 'account' }]
          }
        ]
      });

      if (payment) {
        await payment.update({
          status: 'success',
          paymentMethod: verification.data.authorization?.card_type,
          paymentChannel: verification.data.channel,
          gatewayResponse: verification.data,
          paidAt: new Date(verification.data.paid_at)
        });

        const paidBill = await BillService.markAsPaid(payment.billId, reference);
        payment.bill = paidBill;

        await Transaction.create({
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
        });

        return { success: true, payment };
      }
    }

    return { success: false, error: 'Payment verification failed' };
  }

  static async getPaymentHistory(userId, limit = 10, offset = 0) {
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

  static async getPaymentByReference(reference) {
    return await Payment.findOne({
      where: { paystackReference: reference },
      include: [
        { model: User, as: 'user', attributes: ['telegramId', 'email'] },
        { model: Bill, as: 'bill' }
      ]
    });
  }

  static async handleWebhook(event, data) {
    switch (event) {
      case 'charge.success':
        return await this.verifyPayment(data.reference);
      case 'charge.failed':
        return await this.handleFailedPayment(data.reference);
      default:
        return { success: true, message: 'Event not handled' };
    }
  }

  static async handleFailedPayment(reference) {
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
