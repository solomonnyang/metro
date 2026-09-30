import sequelize from './database.js';
import { initModels } from '../models/index.js';

const migrate = async () => {
  try {
    console.log('🔄 Running database migrations...');

    initModels();

    // Apply schema changes (create tables / alter columns). Never use force:true in production.
    await sequelize.sync({ alter: true });
    
    console.log('✅ Migrations completed successfully!');
    console.log('Tables ensured:');
    console.log('  - users');
    console.log('  - accounts');
    console.log('  - bills');
    console.log('  - payments');
    console.log('  - transactions');
    console.log('  - admins');
    console.log('  - conversations');
    console.log('  - wallet_transactions');
    console.log('  - vends');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
