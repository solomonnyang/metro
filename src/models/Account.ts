import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import type User from './User.js';
import type Bill from './Bill.js';

export interface AccountAttributes {
  id: string;
  userId: string;
  meterNumber: string;
  accountName: string;
  accountType: 'prepaid' | 'postpaid';
  distributionCompany: string;
  address: string | null;
  isActive: boolean | null;
  lastTokenPurchase: Date | null;
  lastBillPayment: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class Account extends Model<
  InferAttributes<Account, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<Account, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare userId: string;
  declare meterNumber: string;
  declare accountName: string;
  declare accountType: 'prepaid' | 'postpaid';
  declare distributionCompany: string;
  declare address: string | null;
  declare isActive: boolean | null;
  declare lastTokenPurchase: Date | null;
  declare lastBillPayment: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  /** Eager-loaded associations (populated via `include`). */
  declare user?: User | null;
  declare bills?: Bill[];
}

export const initAccount = (db: Sequelize = sequelize): typeof Account => {
  Account.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      meterNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      accountName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      accountType: {
        type: DataTypes.ENUM('prepaid', 'postpaid'),
        allowNull: false
      },
      distributionCompany: {
        type: DataTypes.STRING,
        allowNull: false
      },
      address: DataTypes.TEXT,
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      lastTokenPurchase: DataTypes.DATE,
      lastBillPayment: DataTypes.DATE
    },
    {
      sequelize: db,
      tableName: 'accounts',
      timestamps: true
    }
  );

  return Account;
};
