import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import type User from './User.js';
import type Account from './Account.js';
import type Bill from './Bill.js';

export interface VendAttributes {
  id: string;
  billId: string;
  accountId: string;
  userId: string;
  amount: number | string;
  currency: string | null;
  /** Wallet debit reference, replayed verbatim when refunding a failed vend. */
  walletReference: string | null;
  status: 'initiated' | 'processing' | 'pending' | 'completed' | 'failed';
  fucilReference: string | null;
  fucilLookupReference: string | null;
  token: string | null;
  units: number | string | null;
  receipt: Record<string, unknown> | null;
  failureReason: string | null;
  sandboxScenario: string | null;
  /** True when the customer's wallet was credited back after a failed vend. */
  refunded: boolean | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class Vend extends Model<
  InferAttributes<Vend, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<Vend, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare billId: string;
  declare accountId: string;
  declare userId: string;
  declare amount: number | string;
  declare currency: string | null;
  declare walletReference: string | null;
  declare status: 'initiated' | 'processing' | 'pending' | 'completed' | 'failed';
  declare fucilReference: string | null;
  declare fucilLookupReference: string | null;
  declare token: string | null;
  declare units: number | string | null;
  declare receipt: Record<string, unknown> | null;
  declare failureReason: string | null;
  declare sandboxScenario: string | null;
  declare refunded: boolean | null;
  declare resolvedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  /** Eager-loaded associations (populated via `include`). */
  declare user?: User | null;
  declare account?: Account | null;
  declare bill?: Bill | null;
}

export const initVend = (db: Sequelize = sequelize): typeof Vend => {
  Vend.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      billId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'bills', key: 'id' }
      },
      accountId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'accounts', key: 'id' }
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'NGN'
      },
      walletReference: DataTypes.STRING,
      status: {
        type: DataTypes.ENUM('initiated', 'processing', 'pending', 'completed', 'failed'),
        defaultValue: 'initiated'
      },
      fucilReference: {
        type: DataTypes.STRING,
        unique: true
      },
      fucilLookupReference: DataTypes.STRING,
      token: DataTypes.STRING,
      units: DataTypes.DECIMAL(12, 2),
      receipt: DataTypes.JSONB,
      failureReason: DataTypes.TEXT,
      sandboxScenario: DataTypes.STRING,
      refunded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      resolvedAt: DataTypes.DATE
    },
    {
      sequelize: db,
      tableName: 'vends',
      timestamps: true,
      indexes: [
        { fields: ['status'] },
        { fields: ['fucilReference'] }
      ]
    }
  );

  return Vend;
};
