import { DataTypes, InferAttributes, InferCreationAttributes, Model, type Sequelize } from 'sequelize';
import sequelize from '../config/database.js';

export interface ConversationAttributes {
  chatId: string;
  type: string | null;
  step: string | null;
  data: Record<string, unknown> | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class Conversation extends Model<
  InferAttributes<Conversation, { omit: 'createdAt' | 'updatedAt' }>,
  InferCreationAttributes<Conversation, { omit: 'createdAt' | 'updatedAt' }>
> {
  declare chatId: string;
  declare type: string | null;
  declare step: string | null;
  declare data: Record<string, unknown> | null;
  declare expiresAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export const initConversation = (db: Sequelize = sequelize): typeof Conversation => {
  Conversation.init(
    {
      chatId: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: false,
        allowNull: false
      },
      type: DataTypes.STRING,
      step: DataTypes.STRING,
      data: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      expiresAt: DataTypes.DATE
    },
    {
      sequelize: db,
      tableName: 'conversations',
      timestamps: true
    }
  );

  return Conversation;
};
