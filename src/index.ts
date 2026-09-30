import { startServer } from './app.js';
import { initBot } from './bot/index.js';

const main = async () => {
  console.log('⚡ Starting Electricity Bill Payment Bot...');
  
  // Start Express server
  await startServer();
  
  // Initialize Telegram bot
  initBot();
  
  console.log('✅ Application started successfully!');
  console.log('🤖 Telegram bot is running...');
};

main().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});
