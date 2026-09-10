import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Account = sequelize.define('Account', {
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
  address: {
    type: DataTypes.TEXT
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastTokenPurchase: {
    type: DataTypes.DATE
  },
  lastBillPayment: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'accounts',
  timestamps: true
});

export default Account;
