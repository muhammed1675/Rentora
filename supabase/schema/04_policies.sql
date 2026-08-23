-- =========================================================
-- Rentora — Row Level Security policies (public schema, complete)
-- =========================================================

-- ── agent_balances ──────────────────────────────
CREATE POLICY "agent_balances_admin_read" ON public.agent_balances FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "agent_balances_select_admin" ON public.agent_balances FOR SELECT
  USING (is_admin());
CREATE POLICY "agent_balances_select_own" ON public.agent_balances FOR SELECT
  USING ((agent_id = auth.uid()));
CREATE POLICY "agent_balances_update_admin" ON public.agent_balances FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());
-- ── agent_bank_change_requests ──────────────────────────────
CREATE POLICY "admins can manage all" ON public.agent_bank_change_requests FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "agents can insert own requests" ON public.agent_bank_change_requests FOR INSERT
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "agents can view own requests" ON public.agent_bank_change_requests FOR SELECT
  USING ((auth.uid() = user_id));
-- ── agent_bank_details ──────────────────────────────
CREATE POLICY "admins can manage all bank details" ON public.agent_bank_details FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "agents can view own bank details" ON public.agent_bank_details FOR SELECT
  USING ((auth.uid() = user_id));
-- ── agent_verification_requests ──────────────────────────────
CREATE POLICY "verification_insert_own" ON public.agent_verification_requests FOR INSERT
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "verification_select_admin" ON public.agent_verification_requests FOR SELECT
  USING (is_admin());
CREATE POLICY "verification_select_own" ON public.agent_verification_requests FOR SELECT
  USING ((auth.uid() = user_id));
CREATE POLICY "verification_update_admin" ON public.agent_verification_requests FOR UPDATE
  USING (is_admin());
-- ── contact_messages ──────────────────────────────
CREATE POLICY "admin_can_delete" ON public.contact_messages FOR DELETE
  USING (is_admin());
CREATE POLICY "admin_can_read" ON public.contact_messages FOR SELECT
  USING (is_admin());
CREATE POLICY "admin_can_update" ON public.contact_messages FOR UPDATE
  USING (is_admin());
CREATE POLICY "anyone_can_submit" ON public.contact_messages FOR INSERT
  WITH CHECK (true);
-- ── inspection_transactions ──────────────────────────────
CREATE POLICY "insp_tx_insert_own" ON public.inspection_transactions FOR INSERT
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "insp_tx_select_own" ON public.inspection_transactions FOR SELECT
  USING ((auth.uid() = user_id));
-- ── inspections ──────────────────────────────
CREATE POLICY "inspections_insert_own" ON public.inspections FOR INSERT
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "inspections_select_admin" ON public.inspections FOR SELECT
  USING (is_admin());
CREATE POLICY "inspections_select_agent" ON public.inspections FOR SELECT
  USING ((auth.uid() = agent_id));
CREATE POLICY "inspections_select_own" ON public.inspections FOR SELECT
  USING ((auth.uid() = user_id));
CREATE POLICY "inspections_update_admin" ON public.inspections FOR UPDATE
  USING (is_admin());
CREATE POLICY "inspections_update_agent" ON public.inspections FOR UPDATE
  USING ((auth.uid() = agent_id));
-- ── locations ──────────────────────────────
CREATE POLICY "locations_select_public" ON public.locations FOR SELECT
  USING (true);
-- ── notification_queue ──────────────────────────────
CREATE POLICY "notification_queue_admin_all" ON public.notification_queue FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
-- ── platform_settings ──────────────────────────────
CREATE POLICY "platform_settings_select_all" ON public.platform_settings FOR SELECT
  USING (true);
-- ── properties ──────────────────────────────
CREATE POLICY "properties_delete_admin" ON public.properties FOR DELETE
  USING (is_admin());
CREATE POLICY "properties_delete_own_agent" ON public.properties FOR DELETE
  USING ((auth.uid() = uploaded_by_agent_id));
CREATE POLICY "properties_insert_agent" ON public.properties FOR INSERT
  WITH CHECK (is_agent_or_admin());
CREATE POLICY "properties_mark_taken_by_unlocker" ON public.properties FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM unlocks u
  WHERE ((u.property_id = properties.id) AND (u.user_id = auth.uid())))))
  WITH CHECK (((availability = ANY (ARRAY['available'::text, 'unavailable'::text])) AND (EXISTS ( SELECT 1
   FROM unlocks u
  WHERE ((u.property_id = properties.id) AND (u.user_id = auth.uid()))))));
CREATE POLICY "properties_select_admin" ON public.properties FOR SELECT
  USING (is_admin());
CREATE POLICY "properties_select_approved" ON public.properties FOR SELECT
  USING ((status = 'approved'::text));
CREATE POLICY "properties_select_own_agent" ON public.properties FOR SELECT
  USING ((auth.uid() = uploaded_by_agent_id));
CREATE POLICY "properties_update_admin" ON public.properties FOR UPDATE
  USING (is_admin());
CREATE POLICY "properties_update_own_agent" ON public.properties FOR UPDATE
  USING ((auth.uid() = uploaded_by_agent_id));
-- ── property_rent_payments ──────────────────────────────
CREATE POLICY "rent_payments_insert_own" ON public.property_rent_payments FOR INSERT
  WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "rent_payments_select_admin" ON public.property_rent_payments FOR SELECT
  USING (is_admin());
CREATE POLICY "rent_payments_select_agent" ON public.property_rent_payments FOR SELECT
  USING ((agent_id = auth.uid()));
CREATE POLICY "rent_payments_select_own" ON public.property_rent_payments FOR SELECT
  USING ((user_id = auth.uid()));
CREATE POLICY "rent_payments_update_admin" ON public.property_rent_payments FOR UPDATE
  USING (is_admin());
CREATE POLICY "rent_payments_update_own" ON public.property_rent_payments FOR UPDATE
  USING (((user_id = auth.uid()) AND (status = 'held'::text)))
  WITH CHECK (((user_id = auth.uid()) AND (status = 'released'::text)));
-- ── property_reports ──────────────────────────────
CREATE POLICY "reports_insert_own" ON public.property_reports FOR INSERT
  WITH CHECK ((auth.uid() = reporter_id));
CREATE POLICY "reports_select_admin" ON public.property_reports FOR SELECT
  USING (is_admin());
CREATE POLICY "reports_update_admin" ON public.property_reports FOR UPDATE
  USING (is_admin());
-- ── property_reviews ──────────────────────────────
CREATE POLICY "Anyone can read reviews" ON public.property_reviews FOR SELECT
  USING (true);
CREATE POLICY "Users can delete own reviews" ON public.property_reviews FOR DELETE
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own reviews" ON public.property_reviews FOR INSERT
  WITH CHECK ((auth.uid() = user_id));
-- ── reviews ──────────────────────────────
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "reviews_own_write" ON public.reviews FOR ALL
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT
  USING (true);
-- ── transactions ──────────────────────────────
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "transactions_select_admin" ON public.transactions FOR SELECT
  USING (is_admin());
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT
  USING ((auth.uid() = user_id));
-- ── unlocks ──────────────────────────────
CREATE POLICY "unlocks_insert_own" ON public.unlocks FOR INSERT
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "unlocks_select_own" ON public.unlocks FOR SELECT
  USING ((auth.uid() = user_id));
-- ── users ──────────────────────────────
CREATE POLICY "admins_can_update_users" ON public.users FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM users users_1
  WHERE ((users_1.id = auth.uid()) AND (users_1.role = 'admin'::text)))));
CREATE POLICY "users_can_read_all" ON public.users FOR SELECT
  USING (true);
CREATE POLICY "users_can_update_own" ON public.users FOR UPDATE
  USING ((auth.uid() = id));
CREATE POLICY "users_insert_own" ON public.users FOR INSERT
  WITH CHECK ((auth.uid() = id));
CREATE POLICY "users_select_admin" ON public.users FOR SELECT
  USING (is_admin());
CREATE POLICY "users_select_own" ON public.users FOR SELECT
  USING ((auth.uid() = id));
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE
  USING (is_admin());
CREATE POLICY "users_update_own" ON public.users FOR UPDATE
  USING ((auth.uid() = id));
-- ── wallets ──────────────────────────────
CREATE POLICY "wallets_insert_own" ON public.wallets FOR INSERT
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "wallets_select_admin" ON public.wallets FOR SELECT
  USING (is_admin());
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT
  USING ((auth.uid() = user_id));
-- ── withdrawal_requests ──────────────────────────────
CREATE POLICY "withdrawal_requests_admin" ON public.withdrawal_requests FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "withdrawal_requests_insert_own" ON public.withdrawal_requests FOR INSERT
  WITH CHECK ((agent_id = auth.uid()));
CREATE POLICY "withdrawal_requests_select_admin" ON public.withdrawal_requests FOR SELECT
  USING (is_admin());
CREATE POLICY "withdrawal_requests_select_own" ON public.withdrawal_requests FOR SELECT
  USING ((agent_id = auth.uid()));
CREATE POLICY "withdrawal_requests_update_admin" ON public.withdrawal_requests FOR UPDATE
  USING (is_admin());
