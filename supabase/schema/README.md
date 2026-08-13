# Rentora — Supabase live-database snapshot

This folder is a reconstruction of what's **actually deployed** in your live
Supabase project, built from `information_schema` queries run directly
against the database (not from the older `supabase_schema.sql` /
`supabase_migration_v2.sql` / `supabase_quick_fix.sql` files in the repo,
which had drifted out of sync with reality).

## Files

- **01_tables.sql** — all 19 tables + the `agent_earnings_summary` view,
  with exact column names, types, nullability, and defaults.
  ⚠️ Primary keys, foreign keys, and CHECK constraints are NOT visible
  through `information_schema.columns`, so they aren't included here.
  Cross-reference `05_indexes.sql` for primary/unique keys, and the
  original `supabase_schema.sql` in the repo for foreign key relationships
  where table/column names still match.

- **02_functions_reference.sql** — the body of every custom function
  (24 of them; built-in `pg_trgm` functions like `similarity`, `gtrgm_*`
  were excluded as noise). ⚠️ This is reference material, NOT a runnable
  backup — the dump only captured function bodies, not argument lists or
  return types, so re-running this blindly could create broken functions.
  If you ever need to actually restore one, pull its full definition from
  Supabase dashboard → Database → Functions first.

- **03_triggers.sql** — all 18 triggers, fully runnable.

- **04_policies.sql** — all 73 RLS policies across the public schema,
  fully runnable.

- **05_indexes.sql** — all 49 indexes (including primary/unique keys),
  fully runnable.

- **06_storage.sql** — the 4 storage buckets and their 8 access policies,
  fully runnable.

⚠️ **This README only describes 01–06, the original snapshot.** Files
`07` through `17` (plus `add_recurring_payment.sql`) were added later as
runnable migrations on top of this snapshot — including three
security-critical ones (`15_enable_rls.sql`, `16_storage_lockdown.sql`,
`17_restrict_user_pii.sql`). See `../../SETUP.md` §4 for the full, correct
run order and why skipping any of the three leaves the database insecure.
This file wasn't updated when those were added — treat SETUP.md as the
source of truth for run order, not this list.

## What this does NOT cover

- **Edge Functions** (`send-email`, `resolve-bank`) — their source code
  isn't in the database at all. You already downloaded these separately
  via `npx supabase functions download <name>` — keep those alongside
  this folder, e.g. under `edge-functions/`.
- **Auth settings** (OAuth providers, redirect URLs, email templates) —
  these live in Supabase's project config, not in Postgres. No SQL or
  CLI export covers them; if you want a record, copy them manually from
  Authentication → Providers / URL Configuration / Templates in the
  dashboard.

## Recommended folder layout once combined

```
rentora-supabase/
├── schema/
│   ├── 01_tables.sql
│   ├── 02_functions_reference.sql
│   ├── 03_triggers.sql
│   ├── 04_policies.sql
│   ├── 05_indexes.sql
│   └── 06_storage.sql
└── edge-functions/
    ├── send-email/
    └── resolve-bank/
```
