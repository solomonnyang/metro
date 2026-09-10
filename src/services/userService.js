import { User, Account } from '../models/index.js';

class UserService {
  static async findOrCreateUser(telegramUser) {
    const [user, created] = await User.findOrCreate({
      where: { telegramId: telegramUser.id },
      defaults: {
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

  static async getUserByTelegramId(telegramId) {
    return await User.findOne({
      where: { telegramId }
    });
  }

  static async updateUserEmail(telegramId, email) {
    return await User.update(
      { email },
      { where: { telegramId } }
    );
  }

  static async updateUserPhone(telegramId, phone) {
    return await User.update(
      { phone },
      { where: { telegramId } }
    );
  }

  static async getUserAccounts(userId) {
    return await Account.findAll({
      where: { userId, isActive: true }
    });
  }

  static async addAccount(userId, accountData) {
    return await Account.create({
      userId,
      ...accountData
    });
  }

  static async getAccountById(accountId) {
    return await Account.findByPk(accountId);
  }

  static async getAccountByMeter(meterNumber) {
    return await Account.findOne({
      where: { meterNumber }
    });
  }

  static async deactivateAccount(accountId, userId) {
    return await Account.update(
      { isActive: false },
      { where: { id: accountId, userId } }
    );
  }

  static async getUserStats(userId) {
    const accounts = await Account.count({
      where: { userId, isActive: true }
    });

    return {
      accountCount: accounts
    };
  }
}

export default UserService;
