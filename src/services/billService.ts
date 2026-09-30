import { Op } from 'sequelize';
import { Bill, Account } from '../models/index.js';
import { v4 as uuidv4 } from 'uuid';

class BillService {
  static async generateBill(
    accountId: string,
    amount: number | string,
    dueDate: Date,
    period: string,
    units: number | string | null = null,
    meterReading: number | string | null = null
  ) {
    const billReference = `BILL-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    const bill = await Bill.create({
      accountId,
      billReference,
      amount,
      dueDate,
      period,
      units,
      meterReading,
      description: `Electricity bill for period ${period}`
    });

    return bill;
  }

  static async getPendingBills(accountId: string) {
    return await Bill.findAll({
      where: {
        accountId,
        status: 'pending'
      },
      order: [['dueDate', 'ASC']]
    });
  }

  static async getUserPendingBills(userId: string) {
    return await Bill.findAll({
      include: [{
        model: Account,
        as: 'account',
        where: { userId }
      }],
      where: { status: 'pending' },
      order: [['dueDate', 'ASC']]
    });
  }

  static async getBillByReference(billReference: string) {
    return await Bill.findOne({
      where: { billReference }
    });
  }

  static async getBillById(billId: string, options: Record<string, unknown> = {}) {
    return await Bill.findByPk(billId, {
      include: [{ model: Account, as: 'account' }],
      ...options
    });
  }

  /**
   * Marks a bill settled. `token` is the electricity token issued by the
   * vending provider — never generated locally.
   */
  static async markAsPaid(
    billId: string,
    paymentReference: string,
    options: Record<string, unknown> & { token?: string | null } = {}
  ) {
    const { token, ...updateOptions } = options;

    const bill = await Bill.findByPk(billId, {
      include: [{ model: Account, as: 'account' }],
      ...updateOptions
    });

    if (!bill) throw new Error('Bill not found');

    await bill.update({
      status: 'paid',
      paymentReference,
      token: token ?? null
    }, updateOptions);

    return bill;
  }

  static async updateOverdueBills() {
    return await Bill.update(
      { status: 'overdue' },
      {
        where: {
          status: 'pending',
          dueDate: { [Op.lt]: new Date() }
        }
      }
    );
  }

  static async getBillStats(userId: string) {
    const bills = await Bill.findAll({
      include: [{
        model: Account,
        as: 'account',
        where: { userId }
      }]
    });

    const stats = {
      total: bills.length,
      pending: bills.filter((b) => b.status === 'pending').length,
      paid: bills.filter((b) => b.status === 'paid').length,
      overdue: bills.filter((b) => b.status === 'overdue').length,
      totalAmount: bills.reduce((sum, b) => sum + parseFloat(String(b.amount)), 0),
      pendingAmount: bills
        .filter((b) => b.status === 'pending')
        .reduce((sum, b) => sum + parseFloat(String(b.amount)), 0),
      paidAmount: bills
        .filter((b) => b.status === 'paid')
        .reduce((sum, b) => sum + parseFloat(String(b.amount)), 0)
    };

    return stats;
  }
}

export default BillService;
