# KimiAxe — The Complete Business OS

> 6 Platforms. One Ecosystem. Power Every Channel.

[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://postgresql.org)

---

## 🚀 Overview

KimiAxe is a complete business operating system with 6 powerful platforms under one roof:

| Platform | Domain | Description |
|----------|--------|-------------|
| **AxeSMS** | axesms.org | Bulk SMS, Email, WhatsApp & Virtual Numbers |
| **AxeXVX** | axexvx.link | Smart Link Shortener, APK Hosting & QR Codes |
| **AxeB2B AI** | axeb2b.ai | AI Chatbots, Auto Social Poster & Marketing |
| **AxeB2B Wallet** | axeb2b.wallet | Digital Wallet, eSIM & Domain Marketplace |
| **AxeSocials** | axesocials.com | Full Social Media Management |
| **KimiAxe** | kimiaxe.com | One Account, One Wallet, One Dashboard |

---

## 📁 Project Structure

```
kimiaxe/
├── index.html              # Main landing page (KimiAxe)
├── axesms.html             # AxeSMS platform page
├── axexvx.html             # AxeXVX platform page
├── axeb2bai.html           # AxeB2B AI platform page
├── axeb2bwallet.html       # AxeB2B Wallet platform page
├── axesocials.html         # AxeSocials platform page
│
├── css/
│   └── style.css           # Shared stylesheet (all pages)
│
├── js/
│   └── main.js             # Shared JavaScript (all pages)
│
├── server/
│   ├── index.js            # Express server & API routes
│   └── db.js               # PostgreSQL connection pool
│
├── db/
│   └── schema.sql          # Full database schema
│
├── package.json
├── .env.example            # Environment variables template
├── .gitignore
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/kimiaxe.git
cd kimiaxe
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
```

### 4. Set up the database
```bash
# Create the database
createdb kimiaxe

# Run the schema
psql -U postgres -d kimiaxe -f db/schema.sql
```

### 5. Start the server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will start at `http://localhost:3000`

---

## 🌐 Pages

| File | URL | Description |
|------|-----|-------------|
| `index.html` | `/` | KimiAxe main landing page |
| `axesms.html` | `/axesms.html` | AxeSMS platform |
| `axexvx.html` | `/axexvx.html` | AxeXVX link shortener |
| `axeb2bai.html` | `/axeb2bai.html` | AxeB2B AI platform |
| `axeb2bwallet.html` | `/axeb2bwallet.html` | AxeB2B Wallet |
| `axesocials.html` | `/axesocials.html` | AxeSocials |

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login & get JWT token |

### General
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/contact` | Submit contact form |
| `POST` | `/api/waitlist` | Join waitlist |

### Wallet (Auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/wallet/balance` | Get wallet balance |
| `GET` | `/api/wallet/transactions` | Get transaction history |

### SMS (Auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sms/send` | Send SMS message |

### Links
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/links/shorten` | Shorten a URL |
| `GET` | `/api/links/:slug/stats` | Get link analytics |
| `GET` | `/:slug` | Redirect short link |

---

## 🗄️ Database Schema

The PostgreSQL schema includes tables for:

- **`users`** — User accounts with KYC status
- **`wallets`** — Multi-currency digital wallets
- **`transactions`** — All financial transactions
- **`sms_messages`** — SMS/Email/WhatsApp messages
- **`sms_campaigns`** — Bulk messaging campaigns
- **`short_links`** — Shortened URLs
- **`link_clicks`** — Click analytics
- **`uploaded_files`** — File hosting (APKs, etc.)
- **`ai_chatbots`** — AI chatbot configurations
- **`chatbot_conversations`** — Chat history
- **`social_post_schedules`** — AI auto-post schedules
- **`esim_orders`** — eSIM purchases
- **`domain_registrations`** — Domain registrations
- **`social_accounts`** — Connected social media accounts
- **`scheduled_posts`** — Social media post queue
- **`contact_submissions`** — Contact form entries
- **`waitlist`** — Waitlist signups

---

## 🎨 Design System

The website uses a consistent dark theme across all pages:

- **Colors**: Black background (`#000`), white text, muted grays
- **Fonts**: Instrument Serif (headings), DM Sans (body), Geist Mono (code/labels)
- **Components**: Shared via `css/style.css`
- **JavaScript**: Shared via `js/main.js` (modals, animations, counters)

---

## 🔒 Security

- JWT authentication with configurable expiry
- bcrypt password hashing (12 rounds)
- Rate limiting on all API endpoints
- Helmet.js security headers
- CORS configuration
- SQL injection prevention via parameterized queries

---

## 🚀 Deployment

### Using PM2 (recommended)
```bash
npm install -g pm2
pm2 start server/index.js --name kimiaxe
pm2 save
pm2 startup
```

### Using Docker
```bash
docker build -t kimiaxe .
docker run -p 3000:3000 --env-file .env kimiaxe
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use a strong `JWT_SECRET`
- Configure `DB_SSL=true` for managed databases
- Set `ALLOWED_ORIGINS` to your domain

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**© 2025 KimiAxe. All rights reserved.**
