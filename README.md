<div align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma" alt="Prisma">
  <img src="https://img.shields.io/badge/Pterodactyl-FF6C37?style=for-the-badge&logo=pterodactyl" alt="Pterodactyl">
  <br>
  <img src="https://img.shields.io/github/stars/risalnrisal6-glitch/HOSTING-DASH?style=social" alt="Stars">
  <img src="https://img.shields.io/github/forks/risalnrisal6-glitch/HOSTING-DASH?style=social" alt="Forks">
</div>

<h1 align="center">🚀 NOVA PANEL</h1>
<h3 align="center">Premium Pterodactyl Hosting Dashboard</h3>

<p align="center">
  A modern, feature-rich hosting control panel for Pterodactyl with wallet, store, tickets,<br>
  referral system, and a beautiful dark UI — all built with Next.js 14.
</p>

---

## ✨ Features

| Feature | Description |
|---------|------------|
| 🖥️ **Server Management** | Full CRUD with power actions, console, files, backups, databases, network |
| 💰 **Wallet & Billing** | Balance, coins, Stripe/PayPal/Razorpay/UPI/Crypto/Manual payments |
| 🛒 **Store** | Resource shop (RAM, CPU, Disk, DBs, backups, slots) + server plans |
| 🎟️ **Support Tickets** | Categories, priorities, internal notes, staff roles, file attachments |
| 👥 **Referral System** | Track referrals, rewards, unique referral codes |
| 🎡 **Rewards** | Daily/weekly/monthly check-ins, spin wheel, tasks, giveaways, ads |
| 🔐 **Auth** | Email/password, OAuth (Discord, Google), 2FA, email verification |
| 🛡️ **RBAC** | User / Moderator / Admin / Super Admin with granular permissions |
| 🔔 **Notifications** | Real-time via SSE stream, in-app + toast notifications |
| 🎨 **Admin Panel** | Full settings, branding, users, plans, shop, coupons, rewards, logs |
| 🌐 **Dynamic Branding** | Site name, logo, favicon, description editable from admin panel |
| 📊 **Charts & Stats** | Resource usage graphs, admin dashboard with analytics |

## 📸 Preview

```
  ┌─────────────────────────────────────────────┐
  │  ⚡ NOVA PANEL                  [🔔] [👤]   │
  │  ┌─────────────────────────────────────────┐│
  │  │ Dashboard    │  Welcome back, Admin!    ││
  │  │ Servers      │                          ││
  │  │ Store        │  Servers: 2  │  Income   ││
  │  │ Wallet       │  Tickets: 0  │  $ 250.00 ││
  │  │ Support      │                          ││
  │  │              │  [📊 Resource Usage]     ││
  │  └──────────────┴──────────────────────────┘│
  └─────────────────────────────────────────────┘
```

## 🚀 Quick Install

### One-Line Install

```bash
bash <(curl -s https://raw.githubusercontent.com/risalnrisal6-glitch/HOSTING-DASH/main/installer.sh)
```

### Manual Install

```bash
# Clone the repository
git clone https://github.com/risalnrisal6-glitch/HOSTING-DASH.git
cd HOSTING-DASH

# Run the installer
chmod +x installer.sh
./installer.sh
```

### Interactive Menu

Once installed, run the script to see the management menu:

```
   Host   : your-server
   Docker :  ON
   Kubek  :  OFF
   Port   : 8000
   ------------------------------------------
   1) Install
   2) Start
   3) Stop
   4) Restart
   5) Terminal (Console)
   6) Logs (Info/Status)
   7) Uninstall
   0) Exit
   Select Option:
```

Select **option 1** to install, then **option 2** to start the panel.

## 🔧 Requirements

| Requirement | Minimum |
|------------|---------|
| **Node.js** | 20.x or higher |
| **npm** | 9.x or higher |
| **Git** | 2.x |
| **RAM** | 1 GB (2 GB recommended) |
| **Disk** | 500 MB free |
| **OS** | Linux (Ubuntu 22.04+, Debian 12+, CentOS 9+) |

## 🌐 Access the Panel

After starting, open your browser:

| Service | URL |
|---------|-----|
| **Website** | `http://localhost:3000` |
| **API** | `http://localhost:4000` |
| **Health Check** | `http://localhost:4000/api/health` |

### Default Login

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@nova.dev` | `Admin@12345` |

> ⚠️ **Change the default password immediately** after first login!

## 🔌 Connecting Pterodactyl Panel

1. Go to **Admin → Settings → Pterodactyl API**
2. Enter your panel URL (e.g., `https://panel.yourhost.com`)
3. Generate an **Application API key** and **Client API key** in your Pterodactyl admin panel
4. Enable the panel connection and click **Save**
5. Click **Test Connection** to verify

## 🛠️ Configuration

Edit `apps/api/.env` to customize:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=your-strong-jwt-secret-here
JWT_REFRESH_SECRET=your-strong-refresh-secret-here
CORS_ORIGIN=http://your-domain.com
DATABASE_URL=file:./dash.db
```

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Framer Motion, Lucide Icons |
| **Backend** | Express.js, TypeScript, Prisma ORM |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Auth** | JWT + Refresh Tokens, bcryptjs, OAuth2 |
| **Payments** | Stripe, PayPal, Razorpay, UPI, Crypto |
| **Panel** | Pterodactyl API v1 (Application + Client) |
| **Security** | Helmet, CORS, Rate Limiting, AES-256-GCM encryption |

## 📁 Project Structure

```
HOSTING-DASH/
├── installer.sh           # CLI installer & management script
├── package.json           # Root workspace config
├── apps/
│   ├── api/               # Express.js backend
│   │   ├── prisma/        # Schema + migrations
│   │   └── src/
│   │       ├── routes/    # API route handlers
│   │       ├── services/  # Business logic
│   │       └── lib/       # Shared utilities
│   └── web/               # Next.js frontend
│       └── src/
│           ├── app/       # App Router pages
│           ├── components/# UI components
│           └── lib/       # Shared utilities
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/risalnrisal6-glitch">risalnrisal6-glitch</a></p>
  <p>
    <a href="https://github.com/risalnrisal6-glitch/HOSTING-DASH/issues">Report Bug</a>
    ·
    <a href="https://github.com/risalnrisal6-glitch/HOSTING-DASH/issues">Request Feature</a>
  </p>
</div>