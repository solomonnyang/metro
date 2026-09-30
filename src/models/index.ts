import type { Sequelize } from 'sequelize';
import sequelize from '../config/database.js';

import User, { initUser, type UserAttributes } from './User.js';
import Account, { initAccount, type AccountAttributes } from './Account.js';
import Bill, { initBill, type BillAttributes } from './Bill.js';
import Payment, { initPayment, type PaymentAttributes } from './Payment.js';
import Transaction, { initTransaction, type TransactionAttributes } from './Transaction.js';
import Admin, { initAdmin, type AdminAttributes } from './Admin.js';
import Conversation, { initConversation, type ConversationAttributes } from './Conversation.js';
import WalletTransaction, { initWalletTransaction, type WalletTransactionAttributes } from './WalletTransaction.js';
import Vend, { initVend, type VendAttributes } from './Vend.js';

/**
 * Registers every model against the given connection and wires up associations.
 * Called once at startup before any query runs.
 */
export const initModels = (db: Sequelize = sequelize): void => {
  initUser(db);
  initAccount(db);
  initBill(db);
  initPayment(db);
  initTransaction(db);
  initAdmin(db);
  initConversation(db);
  initWalletTransaction(db);
  initVend(db);

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

  Bill.hasOne(Vend, { foreignKey: 'billId', as: 'vend' });
  Vend.belongsTo(Bill, { foreignKey: 'billId', as: 'bill' });

  Account.hasMany(Vend, { foreignKey: 'accountId', as: 'vends' });
  Vend.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

  User.hasMany(Vend, { foreignKey: 'userId', as: 'vends' });
  Vend.belongsTo(User, { foreignKey: 'userId', as: 'user' });
};

export {
  User,
  Account,
  Bill,
  Payment,
  Transaction,
  Admin,
  Conversation,
  WalletTransaction,
  Vend
};

export type {
  UserAttributes,
  AccountAttributes,
  BillAttributes,
  PaymentAttributes,
  TransactionAttributes,
  AdminAttributes,
  ConversationAttributes,
  WalletTransactionAttributes,
  VendAttributes
};
