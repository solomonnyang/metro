import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';

export interface AdminAttributes {
  id: string;
  username: string;
  passwordHash: string;
  name: string | null;
  role: 'admin' | 'super_admin' | null;
  isActive: boolean | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class Admin extends Model<
  InferAttributes<Admin, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<Admin, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare username: string;
  declare passwordHash: string;
  declare name: string | null;
  declare role: 'admin' | 'super_admin' | null;
  declare isActive: boolean | null;
  declare lastLoginAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export const initAdmin = (db: Sequelize = sequelize): typeof Admin => {
  Admin.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      passwordHash: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      name: DataTypes.STRING,
      role: {
        type: DataTypes.ENUM('admin', 'super_admin'),
        defaultValue: 'admin'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      lastLoginAt: DataTypes.DATE
    },
    {
      sequelize: db,
      // Existing table name in the live database (Sequelize default pluralisation).
      tableName: 'Admins',
      timestamps: true
    }
  );

  return Admin;
};
