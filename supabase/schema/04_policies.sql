-- =========================================================
-- Rentora — RLS policies (REFERENCE — regenerated from a live
-- pg_policy dump on 2026-08-27, not hand-maintained)
--
-- The old version of this file was a stale snapshot that no
-- longer matched what was actually live in Supabase (it still
-- showed duplicate/removed policies from before several ad-hoc
-- fixes were applied directly via the SQL editor). This version
-- reflects the actual live state as of the dump date.
--
-- Do NOT treat this as a migration to run — running these
-- CREATE POLICY statements against a DB that already has them
-- will just error "policy already exists". This is a reference
-- for understanding current state, same purpose as
-- 02_functions_reference.sql.
--
-- Known cleanup candidates found in the live dump, left as-is
-- here and flagged inline rather than silently dropped —
-- decide and run these yourself when ready:
--   1. properties_mark_taken_by_unlocker — dead policy, depends
--      on the removed unlock/token system (public.unlocks is no
--      longer populated in the current flow). Superseded by
--      properties_update_own_agent_approved. Safe to drop.
--   2. ad_slot_config has two identical SELECT policies:
--      "Anyone can read slot config" and "Public can read slot
--      config". Harmless (permissive policies OR together) but
--      redundant — drop one.
--   3. reviews has the same duplication: reviews_public_read and
--      reviews_select_public are identical. Drop one.
--   4. ads has two different "own ads" patterns living side by
--      side — one keyed on user_id, one on created_by (see
--      "Advertisers can ..." vs "Owners can view own ads" /
--      "Users can submit ads"). Confirm which column your app
--      actually writes on insert before assuming both are needed.
-- =========================================================

-- ── ad_slot_config ──────────────────────────────
CREATE POLICY "Admins manage slot config" ON public.ad_slot_config FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Anyone can read slot config" ON public.ad_slot_config FOR SELECT
  USING (true);
CREATE POLICY "Public can read slot config" ON public.ad_slot_config FOR SELECT
  USING (true);

-- ── admin_broadcasts ──────────────────────────────
CREATE POLICY "admin_broadcasts_admin_manage" ON public.admin_broadcasts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin_broadcasts_select_targeted" ON public.admin_broadcasts FOR SELECT
  USING ((target = 'all') OR (target = (SELECT role FROM users WHERE id = auth.uid())) OR is_admin());

-- ── ads ──────────────────────────────
CREATE POLICY "Admins can review ads" ON public.ads FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin' AND COALESCE(u.suspended, false) = false));
CREATE POLICY "Admins manage ads" ON public.ads FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Advertisers can create own ads" ON public.ads FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advertisers can view own ads" ON public.ads FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Owners can view own ads" ON public.ads FOR SELECT
  USING (auth.uid() = created_by);
CREATE POLICY "Public can view approved active ads" ON public.ads FOR SELECT
  USING (status IN ('approved','active') AND payment_status IN ('paid','completed')
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now()));
CREATE POLICY "Users can submit ads" ON public.ads FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- ── agent_balances ──────────────────────────────
CREATE POLICY "agent_balances_admin_read" ON public.agent_balances FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "agent_balances_select_admin" ON public.agent_balances FOR SELECT
  USING (is_admin());
CREATE POLICY "agent_balances_select_own" ON public.agent_balances FOR SELECT
  USING (agent_id = auth.uid());
CREATE POLICY "agent_balances_update_admin" ON public.agent_balances FOR UPDATE
  USING (is_admin()) WITH CHECK (is_admin());

-- ── agent_bank_change_requests ──────────────────────────────
CREATE POLICY "admins can manage all" ON public.agent_bank_change_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "agents can insert own requests" ON public.agent_bank_change_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agents can view own requests" ON public.agent_bank_change_requests FOR SELECT
  USING (auth.uid() = user_id);

-- ── agent_bank_details ──────────────────────────────
CREATE POLICY "admins can manage all bank details" ON public.agent_bank_details FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "agents can view own bank details" ON public.agent_bank_details FOR SELECT
  USING (auth.uid() = user_id);

-- ── agent_invites ──────────────────────────────
CREATE POLICY "agent_invites_admin_all" ON public.agent_invites FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ── agent_verification_requests ──────────────────────────────
CREATE POLICY "verification_insert_own" ON public.agent_verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "verification_select_admin" ON public.agent_verification_requests FOR SELECT
  USING (is_admin());
CREATE POLICY "verification_select_own" ON public.agent_verification_requests FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "verification_update_admin" ON public.agent_verification_requests FOR UPDATE
  USING (is_admin());
  -- no WITH CHECK on live dump — worth adding WITH CHECK (is_admin()) for symmetry

-- ── broadcast_email_sends ──────────────────────────────
CREATE POLICY "broadcast_email_sends_admin_read" ON public.broadcast_email_sends FOR SELECT
  USING (is_admin());

-- ── broadcast_reads ──────────────────────────────
CREATE POLICY "broadcast_reads_own" ON public.broadcast_reads FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── contact_messages ──────────────────────────────
CREATE POLICY "admin_can_delete" ON public.contact_messages FOR DELETE
  USING (is_admin());
CREATE POLICY "admin_can_read" ON public.contact_messages FOR SELECT
  USING (is_admin());
CREATE POLICY "admin_can_update" ON public.contact_messages FOR UPDATE
  USING (is_admin());
  -- no WITH CHECK on live dump
CREATE POLICY "anyone_can_submit" ON public.contact_messages FOR INSERT
  WITH CHECK (true);

-- ── inspection_tips ──────────────────────────────
CREATE POLICY "inspection_tips_insert_own" ON public.inspection_tips FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "inspection_tips_select_admin" ON public.inspection_tips FOR SELECT
  USING (is_admin());
CREATE POLICY "inspection_tips_select_agent" ON public.inspection_tips FOR SELECT
  USING (agent_id = auth.uid());
CREATE POLICY "inspection_tips_select_own" ON public.inspection_tips FOR SELECT
  USING (user_id = auth.uid());

-- ── inspection_transactions ──────────────────────────────
CREATE POLICY "insp_tx_insert_own" ON public.inspection_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insp_tx_select_own" ON public.inspection_transactions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "inspection_transactions_select_admin" ON public.inspection_transactions FOR SELECT
  USING (is_admin());

-- ── inspections ──────────────────────────────
CREATE POLICY "insp_insert_verified_student" ON public.inspections FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_verified_student());
CREATE POLICY "inspections_select_admin" ON public.inspections FOR SELECT
  USING (is_admin());
CREATE POLICY "inspections_select_agent" ON public.inspections FOR SELECT
  USING (auth.uid() = agent_id);
CREATE POLICY "inspections_select_own" ON public.inspections FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "inspections_update_admin" ON public.inspections FOR UPDATE
  USING (is_admin());
  -- no WITH CHECK on live dump

-- ── korapay_webhook_events ──────────────────────────────
CREATE POLICY "service role manages korapay webhook events" ON public.korapay_webhook_events FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── locations ──────────────────────────────
CREATE POLICY "locations_select_public" ON public.locations FOR SELECT
  USING (true);

-- ── notification_queue ──────────────────────────────
CREATE POLICY "notification_queue_admin_all" ON public.notification_queue FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ── platform_settings ──────────────────────────────
CREATE POLICY "platform_settings_select_all" ON public.platform_settings FOR SELECT
  USING (true);

-- ── properties ──────────────────────────────
CREATE POLICY "properties_delete_admin" ON public.properties FOR DELETE
  USING (is_admin());
CREATE POLICY "properties_delete_own_agent" ON public.properties FOR DELETE
  USING (auth.uid() = uploaded_by_agent_id);
CREATE POLICY "properties_insert_agent" ON public.properties FOR INSERT
  WITH CHECK (is_agent_or_admin());
CREATE POLICY "properties_mark_taken_by_unlocker" ON public.properties FOR UPDATE
  USING (EXISTS (SELECT 1 FROM unlocks u WHERE u.property_id = properties.id AND u.user_id = auth.uid()))
  WITH CHECK (availability IN ('available','unavailable')
              AND EXISTS (SELECT 1 FROM unlocks u WHERE u.property_id = properties.id AND u.user_id = auth.uid()));
  -- DEAD: depends on the removed unlock system. Candidate for DROP.
CREATE POLICY "properties_select_admin" ON public.properties FOR SELECT
  USING (is_admin());
CREATE POLICY "properties_select_approved" ON public.properties FOR SELECT
  USING (status = 'approved');
CREATE POLICY "properties_select_own_agent" ON public.properties FOR SELECT
  USING (auth.uid() = uploaded_by_agent_id);
CREATE POLICY "properties_update_admin" ON public.properties FOR UPDATE
  USING (is_admin());
  -- no WITH CHECK on live dump
CREATE POLICY "properties_update_own_agent_approved" ON public.properties FOR UPDATE
  USING (auth.uid() = uploaded_by_agent_id AND status = 'approved')
  WITH CHECK (auth.uid() = uploaded_by_agent_id AND status = 'approved');
  -- added 2026-08-27 to fix the "mark unavailable" silent no-op bug
CREATE POLICY "properties_update_own_agent_pending" ON public.properties FOR UPDATE
  USING (auth.uid() = uploaded_by_agent_id AND status = 'pending')
  WITH CHECK (auth.uid() = uploaded_by_agent_id AND status = 'pending');

-- ── property_rent_payments ──────────────────────────────
CREATE POLICY "rent_insert_verified_student" ON public.property_rent_payments FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_verified_student());
CREATE POLICY "rent_payments_select_admin" ON public.property_rent_payments FOR SELECT
  USING (is_admin());
CREATE POLICY "rent_payments_select_agent" ON public.property_rent_payments FOR SELECT
  USING (agent_id = auth.uid());
CREATE POLICY "rent_payments_select_own" ON public.property_rent_payments FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "rent_payments_update_admin" ON public.property_rent_payments FOR UPDATE
  USING (is_admin());
  -- no WITH CHECK on live dump

-- ── property_reports ──────────────────────────────
CREATE POLICY "reports_insert_verified_student" ON public.property_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid() AND is_verified_student());
CREATE POLICY "reports_select_admin" ON public.property_reports FOR SELECT
  USING (is_admin());
CREATE POLICY "reports_update_admin" ON public.property_reports FOR UPDATE
  USING (is_admin());
  -- no WITH CHECK on live dump

-- ── property_reviews ──────────────────────────────
CREATE POLICY "Anyone can read reviews" ON public.property_reviews FOR SELECT
  USING (true);
CREATE POLICY "Users can delete own reviews" ON public.property_reviews FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "reviews_insert_verified_student" ON public.property_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_verified_student());

-- ── push_subscriptions ──────────────────────────────
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── reviews ──────────────────────────────
CREATE POLICY "reviews_insert_authenticated_own" ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT
  USING (true);
CREATE POLICY "reviews_select_public" ON public.reviews FOR SELECT
  USING (true);

-- ── student_verification_requests ──────────────────────────────
CREATE POLICY "svr_insert_own" ON public.student_verification_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "svr_select_own_or_admin" ON public.student_verification_requests FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "svr_update_admin" ON public.student_verification_requests FOR UPDATE
  USING (is_admin()) WITH CHECK (is_admin());

-- ── transactions ──────────────────────────────
CREATE POLICY "transactions_select_admin" ON public.transactions FOR SELECT
  USING (is_admin());
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ── unlocks ──────────────────────────────
CREATE POLICY "unlocks_insert_verified_student" ON public.unlocks FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_verified_student());
CREATE POLICY "unlocks_select_own" ON public.unlocks FOR SELECT
  USING (auth.uid() = user_id);

-- ── user_notifications ──────────────────────────────
CREATE POLICY "Users can delete their own notifications" ON public.user_notifications FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY "user_notifications_select_own" ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- ── users ──────────────────────────────
CREATE POLICY "users_can_update_own" ON public.users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "users_select_admin" ON public.users FOR SELECT
  USING (is_admin());
CREATE POLICY "users_select_own" ON public.users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE
  USING (is_admin()) WITH CHECK (is_admin());

-- ── wallets ──────────────────────────────
CREATE POLICY "wallets_select_admin" ON public.wallets FOR SELECT
  USING (is_admin());
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- ── withdrawal_requests ──────────────────────────────
CREATE POLICY "withdrawal_requests_admin" ON public.withdrawal_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "withdrawal_requests_insert_own" ON public.withdrawal_requests FOR INSERT
  WITH CHECK (agent_id = auth.uid());
CREATE POLICY "withdrawal_requests_select_admin" ON public.withdrawal_requests FOR SELECT
  USING (is_admin());
CREATE POLICY "withdrawal_requests_select_own" ON public.withdrawal_requests FOR SELECT
  USING (agent_id = auth.uid());
CREATE POLICY "withdrawal_requests_update_admin" ON public.withdrawal_requests FOR UPDATE
  USING (is_admin());
  -- no WITH CHECK on live dump