import { Op } from 'sequelize';
import { Bill, Account } from '../models/index.js';
import { generateElectricityToken } from '../utils/tokenGenerator.js';
import { v4 as uuidv4 } from 'uuid';

class BillService {
  static async generateBill(accountId, amount, dueDate, period, units = null, meterReading = null) {
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

  static async getPendingBills(accountId) {
    return await Bill.findAll({
      where: {
        accountId,
        status: 'pending'
      },
      order: [['dueDate', 'ASC']]
    });
  }

  static async getUserPendingBills(userId) {
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

  static async getBillByReference(billReference) {
    return await Bill.findOne({
      where: { billReference }
    });
  }

  static async getBillById(billId, options = {}) {
    return await Bill.findByPk(billId, {
      include: [{ model: Account, as: 'account' }],
      ...options
    });
  }

  static async markAsPaid(billId, paymentReference, options = {}) {
    const bill = await Bill.findByPk(billId, {
      include: [{ model: Account, as: 'account' }],
      ...options
    });

    let token = null;
    if (bill.account?.accountType === 'prepaid') {
      token = generateElectricityToken();
    }

    await bill.update({
      status: 'paid',
      paymentReference,
      token
    }, options);

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

  static async getBillStats(userId) {
    const bills = await Bill.findAll({
      include: [{
        model: Account,
        as: 'account',
        where: { userId }
      }]
    });

    const stats = {
      total: bills.length,
      pending: bills.filter(b => b.status === 'pending').length,
      paid: bills.filter(b => b.status === 'paid').length,
      overdue: bills.filter(b => b.status === 'overdue').length,
      totalAmount: bills.reduce((sum, b) => sum + parseFloat(b.amount), 0),
      pendingAmount: bills
        .filter(b => b.status === 'pending')
        .reduce((sum, b) => sum + parseFloat(b.amount), 0),
      paidAmount: bills
        .filter(b => b.status === 'paid')
        .reduce((sum, b) => sum + parseFloat(b.amount), 0)
    };

    return stats;
  }
}

export default BillService;
