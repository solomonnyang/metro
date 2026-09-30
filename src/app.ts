import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import fucilRoutes from './routes/fucil.js';
import sequelize from './config/database.js';
import { Admin, initModels } from './models/index.js';
import { getBot } from './bot/index.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use('/api/webhook', express.json({
  verify: (req, _res, buf) => { (req as Request).rawBody = buf; }
}));
app.use('/api/fucil/webhook', express.json({
  verify: (req, _res, buf) => { (req as Request).rawBody = buf; }
}));
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fucil', fucilRoutes);

// Telegram bot webhook (used when TELEGRAM_WEBHOOK=true in production)
app.post('/api/telegram-webhook', (req: Request, res: Response) => {
  const bot = getBot();
  if (!bot) {
    return res.sendStatus(503);
  }
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Admin dashboard (Vue build)
app.use('/admin', express.static(path.join(__dirname, '../admin/dist')));
app.get('/admin/*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../admin/dist/index.html'));
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use(((err, _req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}) as ErrorRequestHandler);

// Database connection and server start
const seedAdmin = async () => {
  const count = await Admin.count();
  if (count > 0) return { seeded: false };

  const username = process.env.ADMIN_USERNAME || 'admin';
  const hashFromEnv = process.env.ADMIN_PASSWORD_HASH;
  const plainFromEnv = process.env.ADMIN_PASSWORD;
  const passwordHash =
    hashFromEnv ||
    (plainFromEnv ? crypto.createHash('sha256').update(plainFromEnv).digest('hex') : null);

  const hash = passwordHash || crypto.createHash('sha256').update(crypto.randomBytes(12).toString('hex')).digest('hex');

  await Admin.create({ username, passwordHash: hash, name: 'Administrator', role: 'super_admin' });
  console.log(`✅ Seeded default admin in database (username: ${username})`);
  if (!passwordHash) console.log('   ⚠️  No ADMIN_PASSWORD_HASH was set — a random password was generated. Set one in .env and re-seed if needed.');
  return { seeded: true };
};

const startServer = async () => {
  try {
    initModels();
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Schema is managed by `npm run migrate` (release phase in Procfile), not per-instance.
    await seedAdmin();
    console.log('✅ Admin store ready (credentials stored in the Admin table)');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

export { app, startServer };
