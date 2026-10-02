# ✨ Wishwell — Interactive Digital Birthday Cards

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-birthday--greeting--card--project.vercel.app-brightgreen?style=for-the-badge&logo=vercel)](https://birthday-greeting-card-project.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Storage-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)

> **A modern, thoughtful digital birthday card maker designed to create unforgettable moments.**  
> Create, personalize, and share animated 9-scene birthday experiences complete with photos, music, interactive wishes, and bilingual support.

---

## 🌟 Live Application

Experience the live app here:  
👉 **[https://birthday-greeting-card-project.vercel.app/](https://birthday-greeting-card-project.vercel.app/)**

---

## ✨ Features

- 🎨 **Artfully Crafted Themes**: Choose from charming themes like *Pastel Cute*, *Rose Romantic*, *Royal Gold*, and *Midnight Galaxy*.
- 📖 **9-Scene Interactive Story Experience**:
  - 🕯️ Interactive candle-lighting & wish-making
  - 💌 Fold-open keepsake letter with personalized notes
  - 📸 Memory album with tap-to-expand photo view
  - 🎈 Floating wishes, interactive token reveals & celebration fireworks
- 🎵 **Music & Audio Controls**:
  - Default classic "Happy Birthday to You" public-domain audio
  - Custom MP3 upload option with client-side frame validation and compression
- 📸 **Smart Photo Uploads**:
  - Upload up to 6 keepsake memories
  - Browser-side instant WebP compression (max 200 KB per photo) for ultra-fast loading
- 🌐 **Bilingual Experience**:
  - Full native support for both **English** and **বাংলা (Bengali)** wishes and greetings
- ⏳ **Automated 7-Day Card Expiry**:
  - Ephemeral cards that stay active for 7 days
  - Scheduled daily cron cleanup for expired cards, photos, and audio
- 📱 **Mobile-First & Accessible**:
  - Designed for smooth touch experiences on smartphones and desktop browsers
  - Reduced-motion support and keyboard navigation

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router & Route Handlers) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | Custom CSS3 (Fluid animations, theme variables, glassmorphism) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security) |
| **Storage** | Supabase Storage (`birthday-cards` bucket for WebP photos & audio) |
| **Deployment** | [Vercel](https://vercel.com/) with Cron Jobs support |

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/syedshadnan/birthday-greeting-card-project.git
cd birthday-greeting-card-project
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Setup environment variables

Create a `.env.local` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env.local
```

Configure the following variables:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Server-only; never expose this with a NEXT_PUBLIC_ prefix.
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SMS_WEBHOOK_SECRET=your_server_only_sms_webhook_secret
ADMIN_EMAILS=your-email@example.com
ADMIN_PASSWORD=your_strong_admin_password
ADMIN_SESSION_SECRET=your_random_32_character_secret
CRON_SECRET=your_random_cron_secret
```

### 4. Database Setup (Supabase)

Run the SQL migration scripts located in `supabase/migrations/` in sequential order inside the **Supabase SQL Editor**:
1. `001_initial_schema.sql`
2. `002_fix_payments_rls.sql`
3. `003_storage_bucket.sql`
4. `004_card_experience.sql`
5. `005_card_public_slug.sql`
6. `006_all_cards_free.sql`
7. `007_seven_day_card_expiry.sql`

For the current authenticated ownership, sharing, order, and payment-account foundation, also apply
`008_password_protected_cards.sql` through `014_payment_accounts.sql` in order.
Migration 012 creates fixed-price pending orders and preserves the legacy
`payments` table; migrations 013 and 014 add order ownership RLS and receiving
account snapshots. These migrations do not enable payment verification or payment gateways.

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Build & Production

To verify types and create an optimized production build:

```bash
# Typecheck
npm run lint

# Build production bundle
npm run build

# Start production server
npm run start
```

For detailed deployment steps on Vercel and cron job setup, check out [DEPLOY.md](./DEPLOY.md).

---

## 📁 Project Structure

```text
├── src/
│   ├── app/
│   │   ├── [[...path]]/     # Catch-all client routing
│   │   ├── api/cards/       # Card creation & retrieval API endpoints
│   │   ├── api/cron/        # Daily cleanup cron handler
│   │   ├── card/[slug]/     # Public card viewing route with dynamic OpenGraph
│   │   └── layout.tsx       # Root layout & global metadata
│   ├── components/
│   │   ├── card-builder.tsx # Multi-step card creator wizard
│   │   ├── card-experience.tsx # 9-scene interactive card presentation
│   │   └── fireworks.tsx    # Canvas fireworks animation
│   ├── lib/
│   │   ├── cards/           # Themes, audio helpers & validation
│   │   ├── supabase/        # Supabase server client
│   │   └── rate-limit.ts    # Service-role rate limiter
│   ├── card-polish.css      # Card animation & interactive styles
│   └── styles.css           # Global typography & layout styles
├── supabase/migrations/     # Database schemas & functions
├── DEPLOY.md                # Deployment instructions
└── vercel.json              # Vercel configuration & Cron schedule
```

---

## 👤 Author

**Syed Shadnan**
- GitHub: [@syedshadnan](https://github.com/syedshadnan)
- LinkedIn: [@shadnancodes](https://www.linkedin.com/in/shadnancodes/)

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
