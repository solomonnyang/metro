import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Bill = sequelize.define('Bill', {
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
  description: {
    type: DataTypes.TEXT
  },
  period: {
    type: DataTypes.STRING
  },
  units: {
    type: DataTypes.DECIMAL(10, 2)
  },
  meterReading: {
    type: DataTypes.DECIMAL(10, 2)
  },
  paymentReference: {
    type: DataTypes.STRING
  },
  token: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'bills',
  timestamps: true
});

export default Bill;
