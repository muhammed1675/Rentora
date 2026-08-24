-- =========================================================
-- Rentora — Triggers (from live DB, complete list of 18)
-- =========================================================

-- inspections
CREATE TRIGGER trg_block_inspection_on_taken_property BEFORE INSERT ON public.inspections FOR EACH ROW EXECUTE FUNCTION block_inspection_on_taken_property();
CREATE TRIGGER trg_credit_agent_balance AFTER UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION credit_agent_balance();

-- properties
CREATE TRIGGER property_edit_requires_approval BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION reset_property_status_on_update();
CREATE TRIGGER trg_flag_possible_duplicate BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION flag_possible_duplicate_property();
CREATE TRIGGER trg_flag_possible_duplicate BEFORE INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION flag_possible_duplicate_property();
CREATE TRIGGER trg_lock_taken_property_edits BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION lock_taken_property_edits();
CREATE TRIGGER trg_prevent_agent_self_approval BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION prevent_agent_self_approval();
CREATE TRIGGER trg_prevent_reopening_reserved_property BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION prevent_reopening_reserved_property();
CREATE TRIGGER trg_sync_location_text BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION sync_location_text();
CREATE TRIGGER trg_sync_location_text BEFORE INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION sync_location_text();

-- property_rent_payments
CREATE TRIGGER trg_queue_rent_held_notification AFTER UPDATE ON public.property_rent_payments FOR EACH ROW EXECUTE FUNCTION queue_rent_held_notification();
CREATE TRIGGER trg_release_rent_to_agent BEFORE UPDATE ON public.property_rent_payments FOR EACH ROW EXECUTE FUNCTION release_rent_to_agent();
CREATE TRIGGER trg_reserve_property_on_rent_hold AFTER UPDATE ON public.property_rent_payments FOR EACH ROW EXECUTE FUNCTION reserve_property_on_rent_hold();

-- users
CREATE TRIGGER on_user_suspended AFTER UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION handle_user_suspended();
CREATE TRIGGER trg_restrict_self_profile_edits BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION restrict_self_profile_edits();

-- withdrawal_requests
CREATE TRIGGER trg_enforce_min_withdrawal_amount BEFORE INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION enforce_min_withdrawal_amount();
CREATE TRIGGER trg_enforce_withdrawal_within_balance BEFORE INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION enforce_withdrawal_within_balance();
CREATE TRIGGER trg_set_withdrawal_fee BEFORE INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION set_withdrawal_fee();
CREATE TRIGGER trg_settle_withdrawal_on_paid BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION settle_withdrawal_on_paid();
