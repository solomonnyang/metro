import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';

export interface TransactionAttributes {
  id: string;
  userId: string;
  type: 'bill_payment' | 'token_purchase' | 'refund' | 'adjustment';
  amount: number | string;
  currency: string | null;
  reference: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class Transaction extends Model<
  InferAttributes<Transaction, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<Transaction, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare userId: string;
  declare type: 'bill_payment' | 'token_purchase' | 'refund' | 'adjustment';
  declare amount: number | string;
  declare currency: string | null;
  declare reference: string;
  declare status: 'pending' | 'completed' | 'failed' | 'cancelled' | null;
  declare description: string | null;
  declare metadata: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export const initTransaction = (db: Sequelize = sequelize): typeof Transaction => {
  Transaction.init(
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
      type: {
        type: DataTypes.ENUM('bill_payment', 'token_purchase', 'refund', 'adjustment'),
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
      reference: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
        defaultValue: 'pending'
      },
      description: DataTypes.TEXT,
      metadata: DataTypes.JSONB
    },
    {
      sequelize: db,
      tableName: 'transactions',
      timestamps: true
    }
  );

  return Transaction;
};
