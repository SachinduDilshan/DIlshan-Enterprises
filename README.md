# TyrePro

**Business management system for Dilshan Enterprises — CEAT Tyre Dealership, Anuradhapura District, Sri Lanka.**

Built to replace manual record-keeping across invoicing, inventory, cheque tracking, defective tyre returns, and lorry dispatch. Designed for daily operational use by admin, sales representatives, and drivers.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [User Roles](#user-roles)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Firebase Setup](#firebase-setup)
- [Email Notifications](#email-notifications)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Business Rules](#business-rules)

---

## Overview

TyrePro is a full-stack web application purpose-built for a CEAT tyre distribution business operating across the Anuradhapura district. It handles the complete operational workflow — from raising an invoice and tracking post-dated cheques, to managing warehouse stock levels and following up on defective tyre returns with the supplier (CEAT).

The system supports desktop and mobile use, with a responsive interface optimised for on-the-road sales reps who need to raise invoices and check stock from their phones.

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|--------------------------------------------------|
| Framework   | Next.js 14 (App Router)                         |
| Language    | TypeScript                                      |
| Styling     | Tailwind CSS                                    |
| Database    | Firebase Firestore                              |
| Auth        | Firebase Authentication                         |
| Admin SDK   | firebase-admin (server-side API routes)         |
| Email       | Nodemailer via Gmail SMTP                       |
| Reports     | SheetJS (Excel export), Browser Print (PDF)     |
| Hosting     | Vercel                                          |
| CI          | GitHub Actions                                  |

---

## Features

### Invoicing
- Create invoices with multiple line items and live stock validation
- Auto-generated invoice numbers in `INV-YYYYMMDD-NNNN` format
- Payment types: Cash, Card, Cheque (15 / 30 / 45 / 60 days), Pending / Credit
- Cheque payment automatically creates a cheque tracker record with a customisable due date
- Pending payment automatically updates the shop's outstanding balance
- Stock levels auto-deducted on invoice confirmation

### Cheque Tracker
- Due-soon alerts (within 5 days), overdue flags, and deposit tracking
- Cheque rescheduling with reason logging and full reschedule history
- One-tap "Mark deposited" with outstanding balance reconciliation
- Admin-only edit (bank, cheque number, amount)

### Inventory
- Multi-warehouse stock management (Kurunegala, Anuradhapura, and any added via Settings)
- Per-product add / remove stock with reason logging and audit trail in `stockAdjustments`
- Inter-warehouse stock transfers with full transaction safety
- Product catalogue with brand, size, tyre type, tube type, and auto-generated SKU
- Low-stock and out-of-stock alerts with configurable reorder levels
- Stock auto-deducts on invoice save

### Shop Management
- Shop directory with owner, phone, city, and address
- Per-shop outstanding balance tracking
- Invoice and cheque history per shop
- Admin-only shop detail editing

### UC Returns (Defective Tyre Returns)
- Track defective tyres received from shops through three stages:
  - Received from shop → Sent to CEAT → Replacement received
- Alerts when a tyre has been held for 3+ days without being sent to CEAT
- Alerts when CEAT has not returned a replacement after 30+ days
- Undo last status action (10-second grace window)
- Admin-only edit of quantity, unit price, reason, and notes
- Active / Closed tabs with full return value tracking

### Dispatch
- Create lorry dispatch plans with multiple delivery stops
- Drivers mark each stop as Delivered or Skipped (with reason)
- Dispatch auto-completes when all stops are resolved
- Role-filtered view — drivers only see Dispatch

### Reports
- **Sales Report** — daily / weekly / monthly / quarterly / yearly / custom range
  - Monthly breakdown for long periods, daily breakdown for short periods
  - Excel and PDF export
- **Shop-wise Sales** — revenue by shop for any period
- **Payments** — full payment breakdown by type (Cash, Card, Cheque, Pending)
  - Cheque tracker sub-tab: Pending / Overdue / Deposited filters
  - Per-type Excel download (download only cash, or only overdue cheques, etc.)
- **Stock Movement** — current stock levels and inter-warehouse transfer history
- **UC Returns** — return summary with status filters and value totals

### Notifications & Email Alerts
- In-app notification bell with real-time alert counts
- Alerts generated for:
  - Cheques due today, due within 2 days, overdue
  - Low stock and out-of-stock
  - UC tyres not sent to CEAT (3+ days)
  - CEAT replacement overdue (30+ days)
- Role-filtered email delivery — admin gets all, sales rep skips cheque alerts, driver gets none
- Per-user alert preference toggles in Settings
- Alerts triggered automatically after invoice creation and cheque deposit
- Daily 7 AM cron via Vercel (production)
- Manual "Run checks now" button in Settings for testing

### Settings
- User management — add staff, assign roles, activate/deactivate accounts
- Warehouse management — add, edit, delete warehouses (changes reflected everywhere instantly)
- Notification preferences — per-alert toggles per user

---

## User Roles

| Role        | Access                                                                 |
|-------------|------------------------------------------------------------------------|
| `admin`     | Full access — CRUD everywhere, delete records, manage users/warehouses |
| `sales_rep` | Add and edit invoices, shops, stock, UC returns. No delete, no cheque alerts |
| `driver`    | Dispatch only — mark stops delivered or skipped                        |

Role is assigned at account creation and can be changed by an admin at any time from Settings.

---

## Project Structure

```
tyrepro/
├── src/
│   ├── app/
│   │   ├── api/                        # Server-side API routes
│   │   │   ├── create-user/            # Firebase Auth + Firestore user creation
│   │   │   ├── notify-cheques/         # Cheque alert check
│   │   │   ├── notify-stock/           # Stock alert check
│   │   │   ├── notify-uc/              # UC return alert check
│   │   │   ├── run-alerts/             # Runs all three checks + sends emails
│   │   │   └── send-notification-email/# Nodemailer email delivery
│   │   ├── dashboard/
│   │   │   ├── cheques/
│   │   │   ├── dispatch/
│   │   │   ├── inventory/
│   │   │   ├── invoices/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   ├── shops/
│   │   │   └── uc-returns/
│   │   └── login/
│   ├── components/
│   │   ├── layout/                     # Sidebar, MobileHeader, MobileNav
│   │   ├── reports/                    # Report tab components
│   │   └── ui/                         # Shared UI components
│   ├── hooks/                          # Firebase data hooks
│   ├── lib/
│   │   ├── firebase.ts                 # Firebase client init
│   │   ├── firestore-collections.ts    # Collection references
│   │   ├── exportUtils.ts              # Excel and PDF export
│   │   ├── triggerAlerts.ts            # Background alert trigger
│   │   └── utils.ts                    # Shared utilities
│   └── types/                          # TypeScript type definitions
├── scripts/
│   ├── send-morning-alerts.js          # Local dev alert trigger
│   └── migrate-users.js                # One-time user migration helper
├── .github/
│   └── workflows/
│       └── ci.yml                      # GitHub Actions CI
├── vercel.json                         # Vercel cron configuration
└── .env.local                          # Local environment variables (never committed)
```

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- A Firebase project (Firestore + Authentication enabled)
- A Gmail account with an App Password for email delivery

### Installation

```bash
# Clone the repository
git clone https://github.com/SachinduDilshan/tyrepro.git
cd tyrepro

# Install dependencies
npm install

# Copy the example env file and fill in your values
cp .env.example .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create a `.env.local` file at the project root with the following variables:

```env
# Firebase client-side config
# Firebase Console → Project Settings → Your apps → Web app → SDK setup
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK
# Firebase Console → Project Settings → Service accounts → Generate new private key
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Email delivery via Gmail SMTP
# Google Account → Security → 2-Step Verification → App passwords
GMAIL_USER=
GMAIL_APP_PASSWORD=

# App URL — used in email links
# Development: http://localhost:3000
# Production: https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Never commit `.env.local` to version control.** It is included in `.gitignore`.

---

## Firebase Setup

### 1. Enable Authentication

Firebase Console → Authentication → Sign-in method → Email/Password → Enable

### 2. Create Firestore Database

Firebase Console → Firestore Database → Create database → Start in production mode

### 3. Firestore Collections

TyrePro uses the following top-level collections:

| Collection          | Purpose                                      |
|---------------------|----------------------------------------------|
| `users`             | User profiles and roles                      |
| `shops`             | Shop directory                               |
| `invoices`          | Sales invoices                               |
| `cheques`           | Post-dated cheque records                    |
| `products`          | Tyre product catalogue                       |
| `stock`             | Warehouse stock levels (keyed `whId_prodId`) |
| `stockAdjustments`  | Stock add/remove audit log                   |
| `stockTransfers`    | Inter-warehouse transfer records             |
| `warehouses`        | Warehouse locations                          |
| `ucReturns`         | Defective tyre return tracking               |
| `dispatches`        | Lorry dispatch plans                         |
| `dispatchStops`     | Individual delivery stops per dispatch       |
| `systemAlerts`      | Latest alert state (single doc: `latest`)    |
| `alertSettings`     | Per-user notification preferences            |
| `emailLogs`         | Email delivery audit log                     |
| `counters`          | Auto-increment counters (invoice numbers)    |

### 4. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isAdminOrSalesRep() {
      return isSignedIn() && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'sales_rep']
      );
    }

    match /users/{uid} {
      allow read:   if isSignedIn() && request.auth.uid == uid;
      allow write:  if isAdmin();
    }

    match /shops/{id}            { allow read, write: if isAdminOrSalesRep(); }
    match /invoices/{id}         { allow read, write: if isAdminOrSalesRep(); }
    match /cheques/{id}          { allow read, write: if isAdmin(); }
    match /products/{id}         { allow read: if isSignedIn(); allow write: if isAdminOrSalesRep(); }
    match /stock/{id}            { allow read: if isSignedIn(); allow write: if isAdminOrSalesRep(); }
    match /stockAdjustments/{id} { allow read: if isAdminOrSalesRep(); allow create: if isAdminOrSalesRep(); }
    match /stockTransfers/{id}   { allow read, write: if isAdminOrSalesRep(); }
    match /warehouses/{id}       { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /ucReturns/{id}        { allow read, write: if isAdminOrSalesRep(); }
    match /dispatches/{id}       { allow read, write: if isSignedIn(); }
    match /dispatchStops/{id}    { allow read, write: if isSignedIn(); }
    match /systemAlerts/{id}     { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /alertSettings/{uid}   { allow read, write: if isSignedIn() && request.auth.uid == uid; }
    match /emailLogs/{id}        { allow read: if isAdmin(); allow create: if isAdmin(); }
    match /counters/{id}         { allow read, write: if isAdminOrSalesRep(); }
  }
}
```

Deploy rules:

```bash
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

### 5. Seed Initial Data

After setup, seed your warehouses via Firebase Console → Firestore → `warehouses` collection:

```
Document (auto-ID):
  name: "Anuradhapura"
  city: "Anuradhapura"

Document (auto-ID):
  name: "Kurunegala"
  city: "Kurunegala"
```

---

## Email Notifications

### How It Works

1. Alert checks run via `/api/notify-cheques`, `/api/notify-stock`, `/api/notify-uc`
2. Results are written to `systemAlerts/latest` in Firestore
3. `/api/send-notification-email` reads the alerts and emails each eligible user
4. `/api/run-alerts` orchestrates all three steps in one call

### Triggers

Alerts fire automatically after:
- Invoice creation (stock change, new cheque created)
- Cheque marked as deposited

In production, a daily cron at 7:00 AM Sri Lanka time runs all checks and sends the morning summary.

### Gmail App Password Setup

1. Enable 2-Step Verification on your Google account
2. Go to **Google Account → Security → 2-Step Verification → App passwords**
3. Create an app password for "Mail"
4. Use the 16-character password as `GMAIL_APP_PASSWORD`

### Local Testing

With the dev server running:

```bash
node scripts/send-morning-alerts.js
```

Or open in browser: `http://localhost:3000/api/run-alerts`

---

## CI/CD Pipeline

### Continuous Integration (GitHub Actions)

Every push to `main` or `develop`, and every pull request to `main`, triggers:

1. Install dependencies (`npm ci`)
2. TypeScript type check (`npx tsc --noEmit`)
3. Next.js production build (`npm run build`)

Configuration: `.github/workflows/ci.yml`

### Continuous Deployment (Vercel)

Every push to `main` that passes CI automatically deploys to production via Vercel's GitHub integration.

Pull requests get automatic preview deployments with unique URLs for testing before merging.

### Branch Strategy

```
main        ← production (live site, auto-deploys)
develop     ← staging (test here before merging to main)
feature/*   ← new features (branch from develop)
```

### Recommended Workflow

```bash
# Start a new feature
git checkout develop
git checkout -b feature/my-feature

# Work and commit
git add .
git commit -m "feat: add my feature"
git push origin feature/my-feature

# Merge to develop for testing
git checkout develop
git merge feature/my-feature
git push origin develop

# When ready for production
git checkout main
git merge develop
git push origin main
```

---

## Deployment

### Vercel (Recommended)

1. Push your repository to GitHub
2. Import the project at [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local` in Vercel → Settings → Environment Variables
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel production URL
5. Deploy

### Cron Job

`vercel.json` configures a daily alert run at 7:00 AM Sri Lanka time (01:30 UTC):

```json
{
  "crons": [
    {
      "path": "/api/run-alerts",
      "schedule": "30 1 * * *"
    }
  ]
}
```

This requires a Vercel Pro plan or higher for cron jobs on custom schedules.

---

## API Reference

All routes are Next.js App Router API routes under `src/app/api/`.

| Method | Route                           | Description                              | Auth         |
|--------|---------------------------------|------------------------------------------|--------------|
| `POST` | `/api/create-user`              | Create Firebase Auth user + profile      | Admin only   |
| `GET`  | `/api/notify-cheques`           | Run cheque alert checks                  | Server/cron  |
| `GET`  | `/api/notify-stock`             | Run stock alert checks                   | Server/cron  |
| `GET/POST` | `/api/notify-uc`            | Run UC return alert checks               | Server/cron  |
| `GET/POST` | `/api/run-alerts`           | Run all checks and send emails           | Server/cron  |
| `POST` | `/api/send-notification-email`  | Send alert emails to eligible users      | Server/cron  |

---

## Business Rules

These rules are enforced throughout the application:

### Invoicing
- Invoice numbers are generated as `INV-YYYYMMDD-NNNN` using an atomic Firestore counter
- Stock is deducted from the source warehouse at invoice confirmation time
- Cheque payment creates a cheque record; pending payment increments shop outstanding balance
- Cash and card payments have no side effects beyond the invoice record

### Cheques
- Only admin can view and manage cheque records
- Sales reps do not receive cheque-related email alerts
- Rescheduling preserves the original due date and appends a timestamped history entry
- Depositing a cheque decrements the shop's outstanding balance

### Inventory
- Stock documents are keyed as `{warehouseId}_{productId}` in Firestore
- All stock mutations use Firestore transactions to prevent race conditions
- Stock adjustments are logged to `stockAdjustments` for audit purposes
- Products marked inactive are excluded from new invoices and stock alert checks

### UC Returns
- UC returns are completely independent from inventory — they never affect stock levels
- Products available for UC return are sourced from the shop's confirmed invoice history
- Status progression: `approved` → `sent_to_supplier` → `awaiting_replacement` → `closed`
- Status changes support a 10-second undo window

### Access Control
- Delete operations are restricted to admin role only
- Drivers can only access the Dispatch section
- Role changes take effect immediately without requiring a logout

---

## Author

**Sachindu Dilshan Abeyrathne**
Computer Science Graduate (First Class Honours) — University of Bedfordshire via SLIIT City University

- Email: sachindudilshan7@gmail.com
- LinkedIn: [linkedin.com/in/sachindu-dilshan-abeyrathne](https://linkedin.com/in/sachindu-dilshan-abeyrathne)
- GitHub: [github.com/SachinduDilshan](https://github.com/SachinduDilshan)

---

## License

This project is private software built for Dilshan Enterprises. All rights reserved.
