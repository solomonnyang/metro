# ⚡ Electricity Bill Payment Telegram Bot

A Telegram bot for managing and paying electricity bills, built with Express.js, PostgreSQL, and Paystack payment integration.

## 🚀 Features

- **User Registration** - Automatic registration via Telegram
- **Meter Account Management** - Add, view, and remove meter accounts
- **Bill Management** - View pending bills and payment status
- **Secure Payments** - Pay bills via Paystack payment gateway
- **Payment History** - Track all payment transactions
- **Usage Statistics** - Monitor electricity usage and spending
- **Webhook Notifications** - Real-time payment confirmations

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Paystack account (for payment processing)
- Telegram Bot token (from @BotFather)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd electricity-bill-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   - `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
   - `PAYSTACK_SECRET_KEY` - Your Paystack secret key
   - `PAYSTACK_WEBHOOK_SECRET` - Your Paystack webhook secret
   - Database credentials

4. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb electricity_bot
   
   # Run migrations
   npm run migrate
   
   # (Optional) Seed test data
   npm run seed
   ```

5. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🤖 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and see welcome message |
| `/help` | Show available commands |
| `/bills` | View your pending bills |
| `/pay` | Initiate payment for a bill |
| `/history` | View payment history |
| `/accounts` | Manage meter accounts |
| `/addaccount` | Add a new meter account |
| `/stats` | View usage statistics |
| `/profile` | View or update profile |

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhook` | Paystack webhook receiver |
| `GET` | `/api/payment/status/:reference` | Check payment status |
| `POST` | `/api/payment/initialize` | Initialize a payment |

## 🏗️ Project Structure

```
electricity-bill-bot/
├── src/
│   ├── config/
│   │   ├── database.js      # Database configuration
│   │   ├── migrate.js       # Migration script
│   │   └── seed.js          # Seed script
│   ├── models/
│   │   ├── index.js         # Model associations
│   │   ├── User.js          # User model
│   │   ├── Account.js       # Meter account model
│   │   ├── Bill.js          # Bill model
│   │   ├── Payment.js       # Payment model
│   │   └── Transaction.js   # Transaction model
│   ├── services/
│   │   ├── paystack.js      # Paystack integration
│   │   ├── billService.js   # Bill operations
│   │   ├── paymentService.js # Payment operations
│   │   └── userService.js   # User operations
│   ├── bot/
│   │   ├── index.js         # Bot initialization
│   │   └── commands/
│   │       ├── start.js     # Start/help commands
│   │       ├── bills.js     # Bills command
│   │       ├── accounts.js  # Account management
│   │       ├── payment.js   # Payment commands
│   │       ├── history.js   # History & stats
│   │       └── profile.js   # Profile management
│   ├── routes/
│   │   └── payment.js       # API routes
│   ├── utils/
│   │   └── helpers.js       # Utility functions
│   ├── app.js               # Express app setup
│   └── index.js             # Entry point
├── .env.example             # Environment template
├── package.json             # Dependencies
└── README.md                # Documentation
```

## 💳 Payment Flow

1. User selects a bill to pay via `/pay` or `/bills`
2. Bot creates a payment record and generates Paystack link
3. User clicks the payment link and completes payment
4. Paystack sends webhook notification
5. Bot verifies payment and updates bill status
6. User receives confirmation message

## 🔒 Security Features

- Helmet.js for HTTP headers security
- CORS protection
- Environment variables for sensitive data
- Webhook signature verification
- Input validation

## 🧪 Testing

```bash
# Run with test data
npm run seed
npm run dev

# Test with your Telegram bot
# Send /start to your bot
```

## 📝 Development

```bash
# Start in development mode with auto-reload
npm run dev
```

## 🚢 Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Configure production database
3. Set up SSL certificates
4. Configure webhook URL in Paystack dashboard
5. Use PM2 or similar process manager:
   ```bash
   pm2 start src/index.js --name electricity-bot
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 💡 Support

For support, contact @your_support_username or create an issue.
