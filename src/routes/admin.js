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

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass) {
    return res.status(500).json({ error: 'Admin password not configured' });
  }

  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPass)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  res.json({ success: true, token: adminToken() });
});

const isWebhookSecretConfigured = () => {
  const s = process.env.PAYSTACK_WEBHOOK_SECRET || '';
  return s !== '' && s !== 'set_from_paystack_dashboard';
};

router.get('/config', requireAdmin, (req, res) => {
  res.json({
    success: true,
    config: {
      botUsername: process.env.BOT_USERNAME || null,
      botLink: process.env.BOT_USERNAME ? `https://t.me/${process.env.BOT_USERNAME}` : null,
      adminUsername: process.env.ADMIN_USERNAME || 'admin',
      paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY
        ? `••••••••••${process.env.PAYSTACK_PUBLIC_KEY.slice(-6)}`
        : null,
      paystackSecretConfigured: !!process.env.PAYSTACK_SECRET_KEY,
      webhookSecretConfigured: isWebhookSecretConfigured(),
      webhookUrl: '/api/webhook',
      platform: process.platform,
      nodeVersion: process.version,
      serverTime: new Date().toISOString()
    }
  });
});

router.get('/payments', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '');
    const where = {};
    if (status && ['success', 'pending', 'processing', 'failed', 'refunded'].includes(status)) {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { paystackReference: { [Op.iLike]: `%${search}%` } },
        { '$user.firstName$': { [Op.iLike]: `%${search}%` } },
        { '$user.lastName$': { [Op.iLike]: `%${search}%` } },
        { '$user.username$': { [Op.iLike]: `%${search}%` } },
        { '$bill.billReference$': { [Op.iLike]: `%${search}%` } }
      ];
    }
    const { rows, count } = await Payment.findAndCountAll({
      where,
      distinct: true,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'username'] },
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'billReference', 'token', 'period'],
          include: [
            {
              model: Account,
              as: 'account',
              attributes: ['id', 'meterNumber', 'accountType', 'distributionCompany', 'accountName']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit
    });
    res.json({
      success: true,
      payments: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
    });
  } catch (e) {
    console.error('admin payments error:', e);
    res.status(500).json({ error: 'Failed to load payments' });
  }
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
      revenue,
      revenueByMonth,
      recentPayments
    ] = await Promise.all([
      User.count(),
      User.count({ where: { isActive: true } }),
      Account.count(),
      Bill.count({ where: { status: 'pending' } }),
      Bill.count({ where: { status: 'paid' } }),
      Payment.count(),
      Payment.count({ where: { status: 'success' } }),
      Payment.sum('amount', { where: { status: 'success' }, plain: true }).then((r) => Number(r) || 0),
      Payment.findAll({
        where: { status: 'success', paidAt: { [Op.ne]: null } },
        attributes: [
          [sequelize.fn('date_trunc', 'month', sequelize.col('paidAt')), 'month'],
          [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('amount')), 0), 'total']
        ],
        group: [sequelize.fn('date_trunc', 'month', sequelize.col('paidAt'))],
        order: [[sequelize.fn('date_trunc', 'month', sequelize.col('paidAt')), 'ASC']],
        raw: true
      }),
      Payment.findAll({
        where: { status: 'success' },
        order: [['createdAt', 'DESC']],
        limit: 6,
        include: [
          { model: User, as: 'user', attributes: ['firstName', 'lastName', 'username'] },
          { model: Bill, as: 'bill', attributes: ['billReference', 'token', 'period'] }
        ]
      })
    ]);

    const monthData = {};
    revenueByMonth.forEach((r) => {
      monthData[r.month instanceof Date ? r.month.toISOString().slice(0, 7) : String(r.month).slice(0, 7)] = Number(r.total);
    });

    const labels = [];
    const totals = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
      totals.push(monthData[key] || 0);
    }

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
        revenue,
        revenueByMonth: { labels, totals },
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          paystackReference: p.paystackReference,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          createdAt: p.createdAt,
          userName: [p.user?.firstName, p.user?.lastName].filter(Boolean).join(' ') || p.user?.username || 'Unknown',
          username: p.user?.username || '',
          billReference: p.bill?.billReference || '',
          token: p.bill?.token || ''
        }))
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