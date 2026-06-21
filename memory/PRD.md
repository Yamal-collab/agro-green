# AgriBiz Platform — PRD

## Problem Statement
Internal B2B business management platform for a client operating two businesses:
1. Poultry / Egg Hatchery
2. Water Distribution (lorry-based)

## Tech Stack (chosen for Emergent environment)
- Frontend: React 19 (CRA) + React Router + TanStack Query + Tailwind + shadcn
- Backend: FastAPI + Motor (MongoDB async)
- Auth: JWT (Bearer token, localStorage)
- Design: Agri-green theme (#14532D primary, water accent #0284C7)

## User Personas
- Super Admin / Owner — full access, user management
- Manager — daily operations, all modules
- Accountant — customers, sales, payments, finance
- Farm Staff — batches, expenses, inventory
- Driver — water sales, tank adjust, lorry expenses

## Core Requirements (static)
- RBAC across 6 roles, granular per endpoint
- Customer management with credit limits + outstanding tracking
- Poultry: batches, sales (auto invoice), expenses
- Water: tanks, lorries, sales, expenses
- Inventory with low-stock alerts
- Finance ledger (auto-populated from sales/expenses/payments), P&L by month
- Dashboard with KPIs, charts, recent activity

## What's been implemented (2026-06-21)
- JWT login + admin seed (`admin@agribiz.com / admin123`)
- Customers CRUD + search + outstanding badge
- Poultry: batches grid with mortality %, sales table with auto invoice + payment status, expenses
- Water: tanks (with +/-1000L quick adjust), lorries with status, sales, expenses
- Inventory: items grid with low-stock indicators, stock movement log
- Finance: P&L by month, expense pie chart, transaction ledger, payment recording (decreases outstanding)
- Dashboard: 8 KPI cards, 7-day revenue trend, low stock panel, recent sales tables
- Layout: sidebar nav, role badge, logout
- Design: agri-green theme with Space Grotesk + Manrope fonts

## Prioritized Backlog
### P0 (next)
- PDF invoice export
- WhatsApp invoice sharing
- Customer ledger detail page

### P1
- Export to Excel/CSV
- 2FA
- Refresh token rotation
- Vehicle-wise & batch-wise profit reports
- Audit log viewer UI

### P2
- Cloudinary file uploads for receipts
- Email notifications (Resend)
- Background job queue (Redis/BullMQ) replacement using FastAPI BackgroundTasks
- Mobile app (PWA polish)
