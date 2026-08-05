# Rentora

Student housing rental platform for LAUTECH — connects students with verified agents and available properties around campus.

**Live app:** https://www.rentora.com.ng

## Tech Stack
- **Frontend:** React 19, React Router, Tailwind, shadcn/ui, CRACO (deployed on Vercel)
- **Backend / DB:** Supabase (Postgres, RLS, Storage, Edge Functions)
- **Payments:** Flutterwave
- **Email:** Resend

## Structure
```
frontend/       React app + Vercel serverless functions (api/)
backend/        Optional Python service (not required for prod)
supabase/
  schema/       Canonical SQL — run 01→06 on a fresh project
  functions/    Edge functions (resolve-bank, send-email)
```

## Quick start
See **[SETUP.md](./SETUP.md)** for the full setup, deployment, and handover guide.

```bash
cd frontend
cp .env.example .env    # fill in Supabase + Flutterwave keys
yarn install
yarn start
```

## License
Private. Not licensed for reuse.