import express from 'express';
import crypto from 'crypto';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { User, Account, Bill, Payment, Transaction } from '../models/index.js';

const router = express.Router();

const ADMIN_SALT = 'metro-electric-admin-v1';

const adminToken = () =>
  crypto.createHash('sha256').update(`${process.env.ADMIN_PASSWORD}${ADMIN_SALT}`).digest('hex');

const requireAdmin = (req, res, next) => {
  const provided = req.headers['x-admin-token'] || (req.headers.authorization || '').replace('Bearer ', '');
  if (!process.env.ADMIN_PASSWORD || provided !== adminToken()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: 'Admin password not configured' });
  }

  const provided = Buffer.from(String(password || ''));
  const target = Buffer.from(expected);
  if (provided.length !== target.length || !crypto.timingSafeEqual(provided, target)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({ success: true, token: adminToken() });
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalAccounts,
      pendingBills,
      paidBills,
      totalPayments,
      successfulPayments,
      revenueResult
    ] = await Promise.all([
      User.count(),
      User.count({ where: { isActive: true } }),
      Account.count(),
      Bill.count({ where: { status: 'pending' } }),
      Bill.count({ where: { status: 'paid' } }),
      Payment.count(),
      Payment.count({ where: { status: 'success' } }),
      Payment.sum('amount', { where: { status: 'success' }, plain: true }).then((r) => Number(r) || 0)
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalAccounts,
        pendingBills,
        paidBills,
        totalPayments,
        successfulPayments,
        revenue: revenueResult
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { telegramId: { [Op.eq]: isNaN(Number(search)) ? -1 : Number(search) } }
      ];
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: ['id', 'telegramId', 'firstName', 'lastName', 'username', 'email', 'phone', 'isActive', 'createdAt', 'lastInteraction']
    });

    const userIds = rows.map((u) => u.id);
    const [accountCounts, paymentCounts, spendMap] = await Promise.all([
      userIds.length
        ? Account.findAll({ where: { userId: { [Op.in]: userIds } }, attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']], group: ['userId'], raw: true })
        : [],
      userIds.length
        ? Payment.findAll({ where: { userId: { [Op.in]: userIds } }, attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']], group: ['userId'], raw: true })
        : [],
      userIds.length
        ? Payment.findAll({
            where: { userId: { [Op.in]: userIds }, status: 'success' },
            attributes: ['userId', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
            group: ['userId'],
            raw: true
          })
        : []
    ]);

    const accountMap = Object.fromEntries(accountCounts.map((r) => [r.userId, Number(r.cnt)]));
    const paymentMap = Object.fromEntries(paymentCounts.map((r) => [r.userId, Number(r.cnt)]));
    const spendTotal = Object.fromEntries(spendMap.map((r) => [r.userId, Number(r.total)]));

    res.json({
      success: true,
      users: rows.map((u) => ({
        ...u.toJSON(),
        accountCount: accountMap[u.id] || 0,
        paymentCount: paymentMap[u.id] || 0,
        totalSpent: spendTotal[u.id] || 0
      })),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        { model: Account, as: 'accounts' },
        {
          model: Payment,
          as: 'payments',
          order: [['createdAt', 'DESC']],
          limit: 20,
          include: [{ model: Bill, as: 'bill', attributes: ['billReference', 'amount', 'period', 'token', 'status'] }]
        }
      ]
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = {};
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (typeof req.body.email === 'string') updates.email = req.body.email;
    if (typeof req.body.phone === 'string') updates.phone = req.body.phone;
    if (typeof req.body.firstName === 'string') updates.firstName = req.body.firstName;
    if (typeof req.body.lastName === 'string') updates.lastName = req.body.lastName;

    await user.update(updates);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Admin user update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const accounts = await Account.findAll({ where: { userId: user.id } });
    const accountIds = accounts.map((a) => a.id);

    await Transaction.destroy({ where: { userId: user.id } });
    await Payment.destroy({ where: { userId: user.id } });
    if (accountIds.length) {
      await Bill.destroy({ where: { accountId: { [Op.in]: accountIds } } });
      await Account.destroy({ where: { id: { [Op.in]: accountIds } } });
    }
    await user.destroy();

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Admin user delete error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;