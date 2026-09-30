import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import type User from './User.js';
import type Bill from './Bill.js';

export interface PaymentAttributes {
  id: string;
  userId: string;
  billId: string | null;
  purpose: string | null;
  amount: number | string;
  currency: string | null;
  paystackReference: string | null;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | null;
  paymentMethod: string | null;
  paymentChannel: string | null;
  gatewayResponse: Record<string, unknown> | null;
  paidAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class Payment extends Model<
  InferAttributes<Payment, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<Payment, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare userId: string;
  declare billId: string | null;
  declare purpose: string | null;
  declare amount: number | string;
  declare currency: string | null;
  declare paystackReference: string | null;
  declare status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | null;
  declare paymentMethod: string | null;
  declare paymentChannel: string | null;
  declare gatewayResponse: Record<string, unknown> | null;
  declare paidAt: Date | null;
  declare metadata: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  /** Eager-loaded associations (populated via `include`). */
  declare user?: User | null;
  declare bill?: Bill | null;
}

export const initPayment = (db: Sequelize = sequelize): typeof Payment => {
  Payment.init(
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
      billId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'bills',
          key: 'id'
        }
      },
      purpose: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'bill_payment'
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'NGN'
      },
      paystackReference: {
        type: DataTypes.STRING,
        unique: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'success', 'failed', 'refunded'),
        defaultValue: 'pending'
      },
      paymentMethod: DataTypes.STRING,
      paymentChannel: DataTypes.STRING,
      gatewayResponse: DataTypes.JSONB,
      paidAt: DataTypes.DATE,
      metadata: DataTypes.JSONB
    },
    {
      sequelize: db,
      tableName: 'payments',
      timestamps: true
    }
  );

  return Payment;
};
