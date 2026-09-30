import { User, Account } from '../models/index.js';
import type { TelegramUser } from '../bot/types.js';

export type NewAccountData = {
  meterNumber: string;
  accountName: string;
  accountType: 'prepaid' | 'postpaid';
  distributionCompany: string;
  address?: string | null;
};

class UserService {
  static async findOrCreateUser(telegramUser: TelegramUser) {
    const [user, created] = await User.findOrCreate({
      where: { telegramId: telegramUser.id },
      defaults: {
        telegramId: String(telegramUser.id),
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username
      }
    });

    if (!created) {
      await user.update({
        lastInteraction: new Date(),
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username
      });
    }

    return user;
  }

  static async getUserByTelegramId(telegramId: number | string) {
    return await User.findOne({
      where: { telegramId: String(telegramId) }
    });
  }

  static async updateUserEmail(telegramId: number | string, email: string) {
    return await User.update(
      { email },
      { where: { telegramId: String(telegramId) } }
    );
  }

  static async updateUserPhone(telegramId: number | string, phone: string) {
    return await User.update(
      { phone },
      { where: { telegramId: String(telegramId) } }
    );
  }

  static async getUserAccounts(userId: string) {
    return await Account.findAll({
      where: { userId, isActive: true }
    });
  }

  static async addAccount(userId: string, accountData: NewAccountData) {
    return await Account.create({
      userId,
      ...accountData
    });
  }

  static async getAccountById(accountId: string) {
    return await Account.findByPk(accountId);
  }

  static async getAccountByMeter(meterNumber: string) {
    return await Account.findOne({
      where: { meterNumber }
    });
  }

  static async deactivateAccount(accountId: string, userId: string) {
    return await Account.update(
      { isActive: false },
      { where: { id: accountId, userId } }
    );
  }

  static async getUserStats(userId: string) {
    const accounts = await Account.count({
      where: { userId, isActive: true }
    });

    return {
      accountCount: accounts
    };
  }
}

export default UserService;
