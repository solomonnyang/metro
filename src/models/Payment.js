import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Payment = sequelize.define('Payment', {
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
  paymentMethod: {
    type: DataTypes.STRING
  },
  paymentChannel: {
    type: DataTypes.STRING
  },
  gatewayResponse: {
    type: DataTypes.JSONB
  },
  paidAt: {
    type: DataTypes.DATE
  },
  metadata: {
    type: DataTypes.JSONB
  }
}, {
  tableName: 'payments',
  timestamps: true
});

export default Payment;
