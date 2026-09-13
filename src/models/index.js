import User from './User.js';
import Account from './Account.js';
import Bill from './Bill.js';
import Payment from './Payment.js';
import Transaction from './Transaction.js';
import Admin from './Admin.js';
import Conversation from './Conversation.js';
import WalletTransaction from './WalletTransaction.js';

User.hasMany(Account, { foreignKey: 'userId', as: 'accounts' });
Account.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Account.hasMany(Bill, { foreignKey: 'accountId', as: 'bills' });
Bill.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

Bill.hasOne(Payment, { foreignKey: 'billId', as: 'payment' });
Payment.belongsTo(Bill, { foreignKey: 'billId', as: 'bill' });

User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(WalletTransaction, { foreignKey: 'userId', as: 'walletTransactions' });
WalletTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  User,
  Account,
  Bill,
  Payment,
  Transaction,
  Admin,
  Conversation,
  WalletTransaction
};
