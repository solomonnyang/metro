import sequelize from './database.js';
import { User, Account, Bill, Payment, Transaction } from '../models/index.js';

const migrate = async () => {
  try {
    console.log('🔄 Running database migrations...');

    // Sync all models
    await sequelize.sync({ force: true });
    
    console.log('✅ Migrations completed successfully!');
    console.log('Tables created:');
    console.log('  - users');
    console.log('  - accounts');
    console.log('  - bills');
    console.log('  - payments');
    console.log('  - transactions');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
