-- =========================================================
-- Rentora — public schema tables (reconstructed from live DB
-- via information_schema.columns). Column order, types,
-- nullability and defaults match what's actually deployed.
-- NOTE: primary keys / foreign keys / CHECK constraints are
-- NOT visible from this query -- see 04_indexes.sql for PK/
-- unique indexes, and cross-check supabase_schema.sql in the
-- repo for original FK relationships where table names match.
-- =========================================================

-- ── agent_balances ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_balances (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agent_id uuid,
    total_earned numeric  DEFAULT 0,
    total_withdrawn numeric  DEFAULT 0,
    balance numeric,
    updated_at timestamptz  DEFAULT now()
);

-- ── agent_bank_change_requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_bank_change_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    bank_code text NOT NULL,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    account_name text NOT NULL,
    status text  DEFAULT 'pending'::text,
    admin_note text,
    created_at timestamptz  DEFAULT now(),
    updated_at timestamptz  DEFAULT now()
);

-- ── agent_bank_details ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_bank_details (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    bank_code text,
    bank_name text,
    account_number text,
    account_name text,
    created_at timestamptz  DEFAULT now(),
    updated_at timestamptz  DEFAULT now()
);

-- NOTE: 'agent_earnings_summary' is a VIEW, not a table (not in RLS-enabled list)
-- ── agent_earnings_summary ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_earnings_summary (
    agent_id uuid,
    agent_email text,
    agent_name text,
    completed_inspections bigint,
    inspection_earnings bigint,
    agent_cut_70pct numeric,
    completed_rentals bigint,
    agent_rental_earnings bigint,
    current_balance numeric,
    total_earnings numeric,
    total_withdrawn numeric
);

-- ── agent_verification_requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_verification_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    user_email text NOT NULL,
    id_card_url text NOT NULL,
    selfie_url text NOT NULL,
    address text NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    reviewed_by_admin_id uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    agreement_url text,
    bank_code text,
    bank_name text,
    account_number text,
    account_name text,
    agent_phone text
);

-- ── contact_messages ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    status text  DEFAULT 'unread'::text,
    created_at timestamptz  DEFAULT now()
);

-- ── inspection_transactions ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspection_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    inspection_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reference text NOT NULL,
    amount integer NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    koralpay_reference text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── inspections ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspections (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    user_email text NOT NULL,
    property_id uuid NOT NULL,
    property_title text NOT NULL,
    agent_id uuid,
    agent_name text,
    inspection_date date NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    payment_status text NOT NULL DEFAULT 'pending'::text,
    payment_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    user_phone text,
    user_email_override text
);

-- ── locations ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.locations (
    id integer NOT NULL DEFAULT nextval('locations_id_seq'::regclass),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── notification_queue ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    type text NOT NULL,
    recipient_email text,
    recipient_name text,
    subject text NOT NULL,
    body_text text NOT NULL,
    related_property_id uuid,
    related_payment_id uuid,
    status text NOT NULL DEFAULT 'pending'::text,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz
);

-- ── platform_settings ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key text NOT NULL,
    value text NOT NULL
);

-- ── properties ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    price integer NOT NULL,
    location_text text NOT NULL,
    property_type text NOT NULL,
    images text[]  DEFAULT '{}'::text[],
    contact_name text NOT NULL,
    contact_phone text NOT NULL,
    uploaded_by_agent_id uuid NOT NULL,
    uploaded_by_agent_name text NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    approved_by_admin_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    views integer  DEFAULT 0,
    availability text  DEFAULT 'available'::text,
    caution_fee numeric,
    agent_fee numeric,
    inspection_fee integer NOT NULL DEFAULT 3000,
    possible_duplicate_of uuid,
    owner_full_name text,
    owner_phone text,
    google_maps_link text,
    amenities text[]  DEFAULT '{}'::text[],
    location_id integer,
    address text
);

-- ── property_rent_payments ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.property_rent_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL,
    user_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    rent_amount integer NOT NULL,
    service_fee integer NOT NULL,
    total_amount integer NOT NULL,
    reference text NOT NULL,
    koralpay_reference text,
    status text NOT NULL DEFAULT 'pending'::text,
    held_at timestamptz,
    released_at timestamptz,
    refunded_at timestamptz,
    auto_release_at timestamptz,
    released_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    agent_fee integer NOT NULL DEFAULT 0,
    owner_name text,
    owner_phone text,
    move_in_photo_url text,
    caution_fee integer NOT NULL DEFAULT 0
);

-- ── property_reviews ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.property_reviews (
    id uuid NOT NULL,
    property_id uuid,
    user_id uuid,
    user_name text,
    rating integer,
    comment text,
    created_at timestamptz  DEFAULT now()
);

-- ── reviews ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid NOT NULL,
    property_id uuid,
    user_id uuid,
    user_name text,
    rating integer,
    comment text,
    created_at timestamptz  DEFAULT now()
);

-- ── transactions ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    reference text NOT NULL,
    amount integer NOT NULL,
    tokens_added integer NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    koralpay_reference text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── unlocks ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.unlocks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    property_id uuid NOT NULL,
    unlocked_at timestamptz NOT NULL DEFAULT now()
);

-- ── users ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL DEFAULT 'user'::text,
    suspended boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    phone text,
    avatar_url text,
    deleted_at timestamptz
);

-- ── wallets ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
    id integer NOT NULL DEFAULT nextval('wallets_id_seq'::regclass),
    user_id uuid NOT NULL,
    token_balance integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── withdrawal_requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agent_id uuid,
    amount numeric NOT NULL,
    bank_name text,
    account_number text,
    account_name text,
    status text  DEFAULT 'pending'::text,
    requested_at timestamptz  DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid,
    notes text,
    agent_name text,
    agent_email text,
    fee_amount integer NOT NULL DEFAULT 0,
    net_amount integer NOT NULL DEFAULT 0
);
