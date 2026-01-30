# Vijay Malik Financial Services

**AMFI-registered Mutual Fund Distributor** (ARN-317605)  
Empowering financial independence through disciplined investing and transparent guidance.

---

## 🚀 Platform Overview

A comprehensive mutual fund platform built with Next.js, featuring:

- **14,083+ Mutual Funds** with complete data
- **20.4M NAV Records** (19+ years of historical data)
- **Real-time Search & Discovery** with advanced filters
- **Fund Comparison Tool** (up to 5 funds side-by-side)
- **Portfolio Tracking** with returns calculation
- **Performance Analysis** across all time periods

---

## 🛠️ Tech Stack

- **Framework:** Next.js 15.5.0 (React 19)
- **Language:** TypeScript
- **Database:** PostgreSQL (3.5GB with 14K+ funds)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel/AWS
- **API:** MFApi integration for real-time data

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/Ojasvi2208/VM_Services_Production.git
cd VM_Services_Production

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Add your DATABASE_URL and other credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the platform.

---

## 🗄️ Database Setup

The platform requires PostgreSQL with the following tables:
- `funds` - Fund master data with categories
- `nav_history` - Historical NAV data
- `fund_returns` - Calculated returns (1W to 10Y)

Database scripts are available in `/src/scripts/` for setup and data import.

---

## 🌟 Key Features

### 1. **Enhanced Search & Discovery**
- Advanced filters (AMC, Category, Plan Type)
- Real-time search across 14,083+ funds
- Sorting options (Name, NAV, Recent)

### 2. **Fund Comparison**
- Compare up to 5 funds side-by-side
- Returns analysis (1W, 1M, 3M, 6M, 1Y, 3Y, 5Y, 10Y)
- CAGR calculations
- Best performer highlighting

### 3. **Portfolio Tracking**
- Add and manage holdings
- Real-time NAV updates
- Returns calculation
- Portfolio summary dashboard

### 4. **Performance Analysis**
- Comprehensive returns display
- Historical NAV charts
- Fund details with complete information

---

## 📁 Project Structure

```
vijaymalik-financial/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── funds/             # Fund-related pages
│   │   ├── portfolio/         # Portfolio tracking
│   │   ├── api/               # API routes
│   │   └── ...
│   ├── components/            # React components
│   ├── lib/                   # Utilities and database
│   └── scripts/               # Database and data scripts
├── public/                    # Static assets
└── ...
```

---

## 🔐 Environment Variables

Required environment variables in `.env.local`:

```env
DATABASE_URL=postgresql://user:password@host:port/database
NEXT_PUBLIC_API_URL=your_api_url
```

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### AWS
- EC2 with Node.js
- RDS for PostgreSQL
- EventBridge for scheduled tasks (NAV updates)

---

## 📊 Data Updates

The platform includes scripts for:
- Daily NAV updates
- Returns calculation
- Category synchronization

Scheduled to run at:
- **10:00 AM IST** - Daily NAV update
- **12:00 AM IST** - Midnight NAV update

---

## 👨‍💼 About

**Vijay Malik Financial Services**  
ARN-317605 | NISM Certified | 3+ Years Experience

**Contact:**
- 📞 9417334348 — Chandigarh
- 📧 info@vmfinancialservices.com

---

## 📄 License

© 2026 Vijay Malik Financial Services. All rights reserved.

---

## ⚠️ Disclaimer

*Mutual Fund investments are subject to market risks, read all scheme related documents carefully.*
