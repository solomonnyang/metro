import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import type Account from './Account.js';
import type Payment from './Payment.js';

export interface BillAttributes {
  id: string;
  accountId: string;
  billReference: string;
  /** DECIMAL columns come back as strings from pg unless a parser is installed. */
  amount: number | string;
  currency: string | null;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | null;
  description: string | null;
  period: string | null;
  units: number | string | null;
  meterReading: number | string | null;
  paymentReference: string | null;
  token: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class Bill extends Model<
  InferAttributes<Bill, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<Bill, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare accountId: string;
  declare billReference: string;
  declare amount: number | string;
  declare currency: string | null;
  declare dueDate: Date;
  declare status: 'pending' | 'paid' | 'overdue' | 'cancelled' | null;
  declare description: string | null;
  declare period: string | null;
  declare units: number | string | null;
  declare meterReading: number | string | null;
  declare paymentReference: string | null;
  declare token: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  /** Eager-loaded associations (populated via `include`). */
  declare account?: Account | null;
  declare payment?: Payment | null;
}

export const initBill = (db: Sequelize = sequelize): typeof Bill => {
  Bill.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      accountId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'accounts',
          key: 'id'
        }
      },
      billReference: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'NGN'
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'paid', 'overdue', 'cancelled'),
        defaultValue: 'pending'
      },
      description: DataTypes.TEXT,
      period: DataTypes.STRING,
      units: DataTypes.DECIMAL(10, 2),
      meterReading: DataTypes.DECIMAL(10, 2),
      paymentReference: DataTypes.STRING,
      token: DataTypes.STRING
    },
    {
      sequelize: db,
      tableName: 'bills',
      timestamps: true
    }
  );

  return Bill;
};
