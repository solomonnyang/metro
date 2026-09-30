# ⚡ Electricity Bill Payment Telegram Bot

A Telegram bot for vending electricity, built with Express.js, PostgreSQL, and Paystack for wallet funding. Electricity is supplied by the **Fucil Agent Reseller API** — the bot is a reseller: customers pay into a bot wallet, and each purchase is fulfilled by a real Fucil `lookup` + `vend`.

## 🚀 Features

- **User Registration** - Automatic registration via Telegram
- **Meter Account Management** - Add, view, and remove meter accounts (disco list comes from Fucil)
- **Real Token Vending** - Prepaid meters receive a genuine Fucil token, never a fabricated one
- **Wallet Funding** - Customers top up via Paystack, then pay from their bot wallet
- **Automatic Refunds** - A failed vend credits the customer's wallet back
- **Pending Vend Handling** - Fucil webhooks resolve 202/pending vends, with on-demand polling as a fallback
- **Payment History** - Track all payment transactions

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Paystack account (for payment processing)
- **Fucil agent API key** (for vending)
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
   - `PAYSTACK_SECRET_KEY` - Your Paystack secret key (also verifies webhook signatures)
   - `FUCIL_API_KEY` - Your Fucil agent API key
   - `FUCIL_WEBHOOK_SECRET` - Webhook secret from your Fucil agent profile
   - `FUCIL_SANDBOX` - `true` while the Fucil profile is in Sandbox
   - Database credentials

4. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb electricity_bot
   
   # Build the TypeScript sources, then run migrations
   npm run build:bot
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
| `POST` | `/api/webhook` | Paystack webhook receiver (wallet top-ups) |
| `GET` | `/api/payment/status/:reference` | Check payment status |
| `POST` | `/api/payment/initialize` | Initialize a payment |
| `POST` | `/api/fucil/webhook` | Fucil vend events (`vend.completed` / `vend.pending` / `vend.failed`) |

## 🏗️ Project Structure

```
electricity-bill-bot/
├── src/
│   ├── config/
│   │   ├── database.ts      # Database configuration
│   │   ├── migrate.ts       # Migration script
│   │   └── seed.ts          # Seed script
│   ├── models/
│   │   ├── index.ts         # Model definitions and associations
│   │   ├── User.ts          # User model
│   │   ├── Account.ts       # Meter account model
│   │   ├── Bill.ts          # Bill model
│   │   ├── Payment.ts       # Payment model
│   │   ├── Vend.ts          # Fucil vend lifecycle (one per bill)
│   │   ├── WalletTransaction.ts # Wallet debits, credits, refunds
│   │   └── Transaction.ts   # Transaction model
│   ├── services/
│   │   ├── fucil.ts         # Fucil agent API client + webhook signatures
│   │   ├── vendService.ts   # Lookup/vend orchestration, refunds, resolution
│   │   ├── walletService.ts # Wallet debit/credit/refund (balance locking)
│   │   ├── paystack.ts      # Paystack integration (wallet top-ups only)
│   │   ├── billService.ts   # Bill operations
│   │   ├── paymentService.ts # Payment operations
│   │   └── userService.ts   # User operations
│   ├── scripts/
│   │   ├── fucil-check.ts   # Probes the Fucil client and sandbox scenarios
│   │   └── vend-e2e.ts      # End-to-end vend lifecycle test
│   ├── bot/
│   │   ├── index.ts         # Bot initialization
│   │   ├── types.ts         # Shared Telegram types
│   │   └── commands/
│   │       ├── start.ts     # Start/help commands
│   │       ├── bills.ts     # Bills command
│   │       ├── accounts.ts  # Account management
│   │       ├── payment.ts   # Payment commands
│   │       ├── history.ts   # History & stats
│   │       ├── profile.ts   # Profile management
│   │       └── wallet.ts    # Wallet top-up
│   ├── routes/
│   │   ├── payment.ts       # Payment API routes
│   │   ├── fucil.ts         # Fucil vend webhook receiver
│   │   └── admin.ts         # Admin API routes
│   ├── utils/
│   │   ├── discos.ts        # Disco name <-> Fucil code mapping
│   │   └── helpers.ts       # Utility functions
│   ├── app.ts               # Express app setup
│   └── index.ts             # Entry point
├── dist/                    # Compiled JavaScript (generated by `npm run build:bot`)
├── .env.example             # Environment template
├── tsconfig.json            # TypeScript configuration
├── package.json             # Dependencies and scripts
└── README.md                # Documentation
```

## 💳 Payment & Vending Flow

1. User tops up their bot wallet via Paystack (`/wallet` → top up)
2. User picks a meter and amount (`/pay`) or a pending bill (`/bills`)
3. Bot debits the user's wallet and opens a `Vend` record in the same transaction — a bill can only ever produce one vend, so a double-tap cannot double-charge or double-vend
4. Bot calls Fucil `POST /lookup` to validate the meter and get a reference, then `POST /vend`
5. On `200`, the token is stored on the vend and the bill, and the user receives it in Telegram
6. On `202`, the vend is marked `pending`. Fucil's `vend.completed` / `vend.failed` webhook resolves it; the *Check Status* button polls `POST /vend/poll` in the meantime
7. On failure, the customer's wallet is credited back automatically and the bill is not marked paid

Postpaid meters skip the vend (Fucil's vend is a prepaid token operation) and settle without a token.

### Webhook

Set `POST {APP_URL}/api/fucil/webhook` on your Fucil agent profile. Verify `X-Fucil-Signature` as `sha256=` + HMAC-SHA256 of `{timestamp}.{raw_json_body}` using `FUCIL_WEBHOOK_SECRET`; the handler also rejects timestamps older than five minutes to prevent replay.

## 🔒 Security Features

- Helmet.js for HTTP headers security
- CORS protection
- Environment variables for sensitive data
- Webhook signature verification
- Input validation

## 🧪 Testing

```bash
# Type-check the sources
npm run typecheck

# Run with test data
npm run seed
npm run dev

# Test with your Telegram bot
# Send /start to your bot
```

### Fucil checks

```bash
npm run build:bot

# Probe the Fucil client: health, balance, discos, and all four sandbox scenarios
node dist/scripts/fucil-check.js

# End-to-end vend lifecycle against the sandbox and the local database.
# Creates and cleans up its own user, meter, wallet balance and bills.
E2E_SCENARIO=success node dist/scripts/vend-e2e.js
E2E_SCENARIO=pending node dist/scripts/vend-e2e.js
E2E_SCENARIO=failed  node dist/scripts/vend-e2e.js
```

`vend-e2e` asserts the token lands on the bill, the wallet is debited once, a second debit is refused, a failed vend is refunded, a `0000000000000` lookup failure is refunded, and webhook signatures reject tampering, bad secrets, and stale timestamps.

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
5. Build the TypeScript sources and use PM2 or a similar process manager:
   ```bash
   npm run build:bot
   pm2 start dist/index.js --name electricity-bot
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
