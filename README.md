# Rentora

Rentora is a student housing rental platform built for LAUTECH (Ladoke Akintola University of Technology), connecting students with verified agents and available properties around campus.

**Live app:** [https://www.rentora.com.ng/)

## Features

- **Property listings** — Browse and search available student housing with photos, pricing, and availability status
- **Agent verification** — Agents go through an admin-approved verification flow (ID, selfie, bank details) before listing properties
- **Unlock system** — Users spend tokens to unlock full property details and contact info
- **Inspections** — Users can pay to book a property inspection; agents set their own inspection fee per listing
- **Rent escrow** — Rentora holds rent payments securely until the tenant confirms move-in, then releases funds to the agent (auto-releases after 5 days if not confirmed)
- **Agent payouts** — Agents earn a 70% share of inspection fees and rent (Rentora keeps 30%), with a withdrawal request flow for cashing out to their bank account
- **Mark as Taken** — Tenants can mark a property as taken once they've moved in, removing it from public listings
- **Admin dashboard** — Manage users, verify agents, resolve payment disputes, and oversee platform activity

## Tech Stack

- **Frontend:** React 19, React Router, Tailwind CSS, shadcn/ui (Radix primitives), CRACO
- **Backend / Database:** Supabase (PostgreSQL, Row Level Security, Edge Functions)
- **Payments:** Korapay
- **Deployment:** Vercel

## Project Structure

```
Rentora-main/
├── backend/              # Backend service (Python)
├── frontend/             # React app (CRACO build)
│   ├── src/
│   │   ├── components/   # Shared UI components
│   │   ├── pages/        # Route-level pages (Browse, Profile, AgentDashboard, etc.)
│   │   └── lib/          # API client, auth, Supabase client, utilities
│   └── api/               # Vercel serverless functions (Korapay, contact form)
├── supabase_schema.sql        # Original base schema
├── supabase_migration_v2.sql  # Rent escrow, dynamic inspection fee, trigger fixes
└── supabase_quick_fix.sql     # RLS policy patches
```

## Getting Started

1. Clone the repo and install frontend dependencies:
   ```bash
   cd frontend
   yarn install
   ```
2. Set up your Supabase project and run the SQL files in order:
   - `supabase_schema.sql`
   - `supabase_quick_fix.sql`
   - `supabase_migration_v2.sql`
3. Configure environment variables (Supabase URL/anon key, Korapay keys) — see `SETUP_GUIDE.md` for details.
4. Start the dev server:
   ```bash
   yarn start
   ```

## Database

Rentora's Supabase backend uses Row Level Security across all tables, with role-based policies for tenants, agents, and admins. Key business logic (agent payouts, rent escrow release, auto-release after 5 days) is implemented via Postgres triggers and functions — see `supabase_migration_v2.sql` for the current canonical version.

## License

Private project — not currently licensed for reuse.
