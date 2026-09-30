import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import type Account from './Account.js';
import type Payment from './Payment.js';
import type Transaction from './Transaction.js';
import type WalletTransaction from './WalletTransaction.js';

export interface UserAttributes {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  /** DECIMAL columns come back as strings from pg unless a parser is installed. */
  walletBalance: number | string | null;
  isActive: boolean | null;
  lastInteraction: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class User extends Model<
  InferAttributes<User, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<User, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare telegramId: string;
  declare firstName: string;
  declare lastName: string | null;
  declare username: string | null;
  declare email: string | null;
  declare phone: string | null;
  declare walletBalance: number | string | null;
  declare isActive: boolean | null;
  declare lastInteraction: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  /** Eager-loaded associations (populated via `include`). */
  declare accounts?: Account[];
  declare payments?: Payment[];
  declare transactions?: Transaction[];
  declare walletTransactions?: WalletTransaction[];
}

export const initUser = (db: Sequelize = sequelize): typeof User => {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      telegramId: {
        type: DataTypes.BIGINT,
        unique: true,
        allowNull: false
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      lastName: DataTypes.STRING,
      username: DataTypes.STRING,
      email: {
        type: DataTypes.STRING,
        validate: {
          isEmail: true
        }
      },
      phone: DataTypes.STRING,
      walletBalance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      lastInteraction: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize: db,
      tableName: 'users',
      timestamps: true
    }
  );

  return User;
};
