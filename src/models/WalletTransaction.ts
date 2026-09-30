import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';

export interface WalletTransactionAttributes {
  id: string;
  userId: string;
  type: string;
  direction: string;
  amount: number | string;
  currency: string | null;
  balanceBefore: number | string;
  balanceAfter: number | string;
  reference: string;
  status: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class WalletTransaction extends Model<
  InferAttributes<WalletTransaction, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<WalletTransaction, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare userId: string;
  declare type: string;
  declare direction: string;
  declare amount: number | string;
  declare currency: string | null;
  declare balanceBefore: number | string;
  declare balanceAfter: number | string;
  declare reference: string;
  declare status: string | null;
  declare description: string | null;
  declare metadata: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export const initWalletTransaction = (db: Sequelize = sequelize): typeof WalletTransaction => {
  WalletTransaction.init(
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
        type: DataTypes.STRING,
        allowNull: false
      },
      direction: {
        type: DataTypes.STRING,
        allowNull: false
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'NGN'
      },
      balanceBefore: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
      balanceAfter: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
      reference: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'completed'
      },
      description: DataTypes.TEXT,
      metadata: DataTypes.JSONB
    },
    {
      sequelize: db,
      tableName: 'wallet_transactions',
      timestamps: true
    }
  );

  return WalletTransaction;
};
