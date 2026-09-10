import sequelize from './database.js';
import { User, Account, Bill } from '../models/index.js';

const seed = async () => {
  try {
    console.log('🌱 Seeding database...');

    // Create a test user
    const user = await User.create({
      telegramId: 123456789,
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      email: 'test@example.com'
    });

    // Create test accounts
    const account1 = await Account.create({
      userId: user.id,
      meterNumber: '1234567890',
      accountName: 'Home Apartment',
      accountType: 'prepaid',
      distributionCompany: 'Ikeja Electric',
      address: '123 Test Street, Lagos'
    });

    const account2 = await Account.create({
      userId: user.id,
      meterNumber: '0987654321',
      accountName: 'Office',
      accountType: 'postpaid',
      distributionCompany: 'Eko Electricity',
      address: '456 Business Ave, Lagos'
    });

    // Create test bills
    await Bill.create({
      accountId: account1.id,
      billReference: 'BILL-TEST-001',
      amount: 15000.00,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
      period: 'January 2024',
      description: 'Electricity bill for January 2024'
    });

    await Bill.create({
      accountId: account1.id,
      billReference: 'BILL-TEST-002',
      amount: 22500.50,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'pending',
      period: 'February 2024',
      description: 'Electricity bill for February 2024'
    });

    await Bill.create({
      accountId: account2.id,
      billReference: 'BILL-TEST-003',
      amount: 45000.00,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
      period: 'January 2024',
      description: 'Office electricity bill for January 2024'
    });

    console.log('✅ Seed completed successfully!');
    console.log('Test user created with:');
    console.log('  Telegram ID: 123456789');
    console.log('  Email: test@example.com');
    console.log('  2 meter accounts');
    console.log('  3 pending bills');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

seed();
