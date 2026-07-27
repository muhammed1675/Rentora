-- =========================================================
-- Rentora — Indexes (public schema, complete)
-- =========================================================

-- ── agent_balances ──────────────────────────────
CREATE UNIQUE INDEX agent_balances_pkey ON public.agent_balances USING btree (id);
CREATE UNIQUE INDEX agent_balances_agent_id_key ON public.agent_balances USING btree (agent_id);
-- ── agent_bank_change_requests ──────────────────────────────
CREATE UNIQUE INDEX agent_bank_change_requests_pkey ON public.agent_bank_change_requests USING btree (id);
-- ── agent_bank_details ──────────────────────────────
CREATE UNIQUE INDEX agent_bank_details_pkey ON public.agent_bank_details USING btree (id);
CREATE UNIQUE INDEX agent_bank_details_user_id_key ON public.agent_bank_details USING btree (user_id);
-- ── agent_verification_requests ──────────────────────────────
CREATE INDEX idx_verification_user_id ON public.agent_verification_requests USING btree (user_id);
CREATE UNIQUE INDEX agent_verification_requests_pkey ON public.agent_verification_requests USING btree (id);
CREATE INDEX idx_verification_status ON public.agent_verification_requests USING btree (status);
-- ── contact_messages ──────────────────────────────
CREATE UNIQUE INDEX contact_messages_pkey ON public.contact_messages USING btree (id);
-- ── inspection_transactions ──────────────────────────────
CREATE UNIQUE INDEX inspection_transactions_pkey ON public.inspection_transactions USING btree (id);
CREATE UNIQUE INDEX inspection_transactions_reference_key ON public.inspection_transactions USING btree (reference);
-- ── inspections ──────────────────────────────
CREATE INDEX idx_inspections_user ON public.inspections USING btree (user_id);
CREATE UNIQUE INDEX inspections_pkey ON public.inspections USING btree (id);
CREATE INDEX idx_inspections_agent ON public.inspections USING btree (agent_id);
CREATE INDEX idx_inspections_status ON public.inspections USING btree (status);
-- ── locations ──────────────────────────────
CREATE INDEX idx_locations_name ON public.locations USING btree (name);
CREATE UNIQUE INDEX locations_pkey ON public.locations USING btree (id);
CREATE UNIQUE INDEX locations_name_key ON public.locations USING btree (name);
-- ── notification_queue ──────────────────────────────
CREATE UNIQUE INDEX notification_queue_pkey ON public.notification_queue USING btree (id);
-- ── platform_settings ──────────────────────────────
CREATE UNIQUE INDEX platform_settings_pkey ON public.platform_settings USING btree (key);
-- ── properties ──────────────────────────────
CREATE INDEX idx_properties_agent ON public.properties USING btree (uploaded_by_agent_id);
CREATE INDEX idx_properties_title_trgm ON public.properties USING gin (title gin_trgm_ops);
CREATE INDEX idx_properties_location_trgm ON public.properties USING gin (location_text gin_trgm_ops);
CREATE UNIQUE INDEX properties_pkey ON public.properties USING btree (id);
CREATE INDEX idx_properties_status ON public.properties USING btree (status);
CREATE INDEX idx_properties_type ON public.properties USING btree (property_type);
CREATE INDEX idx_properties_location_id ON public.properties USING btree (location_id);
-- ── property_rent_payments ──────────────────────────────
CREATE UNIQUE INDEX property_rent_payments_pkey ON public.property_rent_payments USING btree (id);
CREATE UNIQUE INDEX property_rent_payments_reference_key ON public.property_rent_payments USING btree (reference);
CREATE INDEX idx_rent_payments_user ON public.property_rent_payments USING btree (user_id);
CREATE INDEX idx_rent_payments_property ON public.property_rent_payments USING btree (property_id);
CREATE INDEX idx_rent_payments_status ON public.property_rent_payments USING btree (status);
CREATE INDEX idx_rent_payments_agent ON public.property_rent_payments USING btree (agent_id);
-- ── property_reviews ──────────────────────────────
CREATE UNIQUE INDEX property_reviews_pkey ON public.property_reviews USING btree (id);
-- ── reviews ──────────────────────────────
CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id);
-- ── transactions ──────────────────────────────
CREATE UNIQUE INDEX transactions_reference_key ON public.transactions USING btree (reference);
CREATE INDEX idx_transactions_user ON public.transactions USING btree (user_id);
CREATE INDEX idx_transactions_reference ON public.transactions USING btree (reference);
CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id);
-- ── unlocks ──────────────────────────────
CREATE INDEX idx_unlocks_user ON public.unlocks USING btree (user_id);
CREATE UNIQUE INDEX unlocks_pkey ON public.unlocks USING btree (id);
CREATE UNIQUE INDEX unlocks_user_id_property_id_key ON public.unlocks USING btree (user_id, property_id);
-- ── users ──────────────────────────────
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX idx_users_role ON public.users USING btree (role);
-- ── wallets ──────────────────────────────
CREATE UNIQUE INDEX wallets_user_id_key ON public.wallets USING btree (user_id);
CREATE UNIQUE INDEX wallets_pkey ON public.wallets USING btree (id);
CREATE INDEX idx_wallets_user_id ON public.wallets USING btree (user_id);
-- ── withdrawal_requests ──────────────────────────────
CREATE UNIQUE INDEX withdrawal_requests_pkey ON public.withdrawal_requests USING btree (id);