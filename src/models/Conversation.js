import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Conversation = sequelize.define('Conversation', {
  chatId: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: false,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING
  },
  step: {
    type: DataTypes.STRING
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  expiresAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'conversations',
  timestamps: true
});

export default Conversation;
