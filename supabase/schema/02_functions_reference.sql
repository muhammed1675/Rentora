-- =========================================================
-- Rentora — Custom Postgres function BODIES (reference only)
--
-- IMPORTANT: this file is NOT a ready-to-run backup. The dump
-- query only returned each function's body text, not its
-- argument list, return type, or trigger vs. regular-function
-- status. Re-running these blindly could create broken or
-- wrongly-typed functions. Use this to UNDERSTAND what each
-- function does; if you ever need to actually restore one,
-- get its full definition from Supabase dashboard first
-- (Database -> Functions -> click the function -> shows full
-- CREATE statement with correct signature).
-- =========================================================

-- ── prevent_reopening_reserved_property ──────────────────────────────
BEGIN
  -- Admins are trusted to relist a property after a tenancy legitimately ends.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.availability = 'available' AND OLD.availability IS DISTINCT FROM 'available' THEN
    IF EXISTS (
      SELECT 1 FROM public.property_rent_payments
      WHERE property_id = NEW.id AND status IN ('held', 'released')
    ) THEN
      RAISE EXCEPTION 'Cannot reopen this property — it has a paid rent record (held or released). Contact an admin to relist it.';
    END IF;
  END IF;
  RETURN NEW;
END;

-- ── release_rent_to_agent ──────────────────────────────
DECLARE
  v_total_payout NUMERIC;
BEGIN
  IF NEW.status = 'released' AND OLD.status = 'held' THEN
    v_total_payout := NEW.rent_amount + NEW.agent_fee + COALESCE(NEW.caution_fee, 0);

    INSERT INTO public.agent_balances (agent_id, total_earned, total_withdrawn)
    VALUES (NEW.agent_id, v_total_payout, 0)
    ON CONFLICT (agent_id) DO UPDATE
      SET total_earned = public.agent_balances.total_earned + EXCLUDED.total_earned;

    UPDATE public.properties
       SET availability = 'unavailable'
     WHERE id = NEW.property_id;

    NEW.released_at := COALESCE(NEW.released_at, NOW());
  END IF;

  RETURN NEW;
END;

-- ── auto_release_rent_escrow ──────────────────────────────
BEGIN
  RETURN QUERY
  UPDATE public.property_rent_payments p
     SET status      = 'released',
         released_by = 'auto',
         released_at = NOW()
   WHERE status = 'held'
     AND auto_release_at IS NOT NULL
     AND auto_release_at <= NOW()
  RETURNING p.id, p.reference, p.property_id, p.agent_id, p.user_id, p.rent_amount, p.agent_fee, p.caution_fee;
END;

-- ── enforce_min_withdrawal_amount ──────────────────────────────
BEGIN
  IF NEW.amount < 3000 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is ₦3,000 per request.';
  END IF;
  RETURN NEW;
END;

-- ── lock_taken_property_edits ──────────────────────────────
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.availability = 'unavailable' AND EXISTS (
    SELECT 1 FROM public.property_rent_payments
    WHERE property_id = OLD.id AND status IN ('held', 'released')
  ) THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.location_text IS DISTINCT FROM OLD.location_text
       OR NEW.location_id IS DISTINCT FROM OLD.location_id
       OR NEW.images IS DISTINCT FROM OLD.images
       OR NEW.property_type IS DISTINCT FROM OLD.property_type
       OR NEW.contact_name IS DISTINCT FROM OLD.contact_name
       OR NEW.contact_phone IS DISTINCT FROM OLD.contact_phone
       OR NEW.inspection_fee IS DISTINCT FROM OLD.inspection_fee
       OR NEW.caution_fee IS DISTINCT FROM OLD.caution_fee
       OR NEW.amenities IS DISTINCT FROM OLD.amenities
       OR NEW.google_maps_link IS DISTINCT FROM OLD.google_maps_link
       OR NEW.owner_full_name IS DISTINCT FROM OLD.owner_full_name
       OR NEW.owner_phone IS DISTINCT FROM OLD.owner_phone
    THEN
      RAISE EXCEPTION 'This property has been taken and can no longer be edited. Contact support@rentora.com.ng if a change is genuinely needed.';
    END IF;
  END IF;

  RETURN NEW;
END;

-- ── sync_location_text ──────────────────────────────
begin
  new.location_text := trim(both ', ' from
    coalesce((select name from public.locations where id = new.location_id), '')
    || case when new.address is not null and new.address <> ''
            then ', ' || new.address
            else '' end
  );

  -- last-resort fallback so the NOT NULL constraint can never
  -- be violated even if location_id/address are both empty
  if new.location_text is null or new.location_text = '' then
    new.location_text := coalesce(new.title, 'Unspecified');
  end if;

  return new;
end;

-- ── is_admin ──────────────────────────────
SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')

-- ── is_agent_or_admin ──────────────────────────────
SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'admin'))

-- ── queue_rent_held_notification ──────────────────────────────
DECLARE
  v_agent_email TEXT;
  v_agent_name TEXT;
  v_property_title TEXT;
BEGIN
  IF NEW.status = 'held' AND (OLD.status IS DISTINCT FROM 'held') THEN
    SELECT email, full_name INTO v_agent_email, v_agent_name FROM public.users WHERE id = NEW.agent_id;
    SELECT title INTO v_property_title FROM public.properties WHERE id = NEW.property_id;

    INSERT INTO public.notification_queue (
      type, recipient_email, recipient_name, subject, body_text,
      related_property_id, related_payment_id
    ) VALUES (
      'rent_payment_held',
      v_agent_email,
      v_agent_name,
      'A student has paid rent for ' || COALESCE(v_property_title, 'your property'),
      'Hi ' || COALESCE(v_agent_name, 'there') || ', a student has paid rent for "' || COALESCE(v_property_title, 'your property') ||
      '". The full amount (₦' || NEW.total_amount || ') is currently held safely by Rentora — it has NOT been released to you yet. ' ||
      'It will be released once the student confirms they have moved in, or automatically after 5 days if they do not respond. ' ||
      'You do not need to do anything right now. We will notify you again once it is released.',
      NEW.property_id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;

-- ── handle_user_suspended ──────────────────────────────
BEGIN
  IF NEW.suspended = true AND (OLD.suspended = false OR OLD.suspended IS NULL) THEN
    DELETE FROM auth.sessions 
    WHERE user_id::text = NEW.id::text;
    
    DELETE FROM auth.refresh_tokens 
    WHERE user_id::text = NEW.id::text;
  END IF;
  RETURN NEW;
END;

-- ── handle_new_user ──────────────────────────────
BEGIN
    INSERT INTO public.users (id, email, full_name, role, suspended)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'user',
        false
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.wallets (user_id, token_balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never let trigger errors block signup
    RETURN NEW;
END;

-- ── set_withdrawal_fee ──────────────────────────────
BEGIN
  IF NEW.fee_amount IS NULL OR NEW.fee_amount = 0 THEN
    NEW.fee_amount := ROUND(NEW.amount * 0.013);  -- was 0.035
  END IF;
  IF NEW.net_amount IS NULL OR NEW.net_amount = 0 THEN
    NEW.net_amount := NEW.amount - NEW.fee_amount;
  END IF;
  RETURN NEW;
END;

-- ── enforce_withdrawal_within_balance ──────────────────────────────
DECLARE
  v_available INTEGER;
BEGIN
  SELECT COALESCE(total_earned, 0) - COALESCE(total_withdrawn, 0)
    INTO v_available
  FROM public.agent_balances
  WHERE agent_id = NEW.agent_id;

  IF v_available IS NULL THEN v_available := 0; END IF;

  IF NEW.amount > v_available THEN
    RAISE EXCEPTION 'Withdrawal amount (₦%) exceeds your available balance (₦%).', NEW.amount, v_available;
  END IF;

  RETURN NEW;
END;

-- ── settle_withdrawal_on_paid ──────────────────────────────
DECLARE
  v_available INTEGER;
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    SELECT COALESCE(total_earned, 0) - COALESCE(total_withdrawn, 0)
      INTO v_available
    FROM public.agent_balances
    WHERE agent_id = NEW.agent_id
    FOR UPDATE; -- lock the row so concurrent payouts can't both pass this check

    IF v_available IS NULL THEN v_available := 0; END IF;

    IF NEW.amount > v_available THEN
      RAISE EXCEPTION 'Cannot mark paid — amount (₦%) exceeds current available balance (₦%). The agent''s balance may have changed since this request was made.', NEW.amount, v_available;
    END IF;

    UPDATE public.agent_balances
       SET total_withdrawn = total_withdrawn + NEW.amount
     WHERE agent_id = NEW.agent_id;

    NEW.resolved_at := COALESCE(NEW.resolved_at, NOW());
  END IF;

  RETURN NEW;
END;

-- ── reserve_property_on_rent_hold ──────────────────────────────
BEGIN
  IF NEW.status = 'held' AND (OLD.status IS DISTINCT FROM 'held') THEN
    UPDATE public.properties SET availability = 'unavailable' WHERE id = NEW.property_id;
  ELSIF NEW.status = 'refunded' AND OLD.status = 'held' THEN
    -- Payment was reversed before move-in was confirmed — free the property back up.
    UPDATE public.properties SET availability = 'available' WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;

-- ── reset_property_status_on_update ──────────────────────────────
BEGIN
  -- Only reset if agent is editing content fields (not admin approving)
  IF (OLD.status = 'approved' OR OLD.status = 'rejected') AND
     (NEW.title != OLD.title OR NEW.description != OLD.description OR
      NEW.price != OLD.price OR NEW.location_text != OLD.location_text OR
      NEW.location_id IS DISTINCT FROM OLD.location_id OR
      NEW.images != OLD.images OR NEW.contact_phone != OLD.contact_phone OR
      NEW.contact_name != OLD.contact_name OR NEW.property_type != OLD.property_type) THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;

-- ── prevent_agent_self_approval ──────────────────────────────
BEGIN
  -- Admins are exempt — this only restricts non-admin actors (agents, etc.)
  IF NOT public.is_admin() THEN

    -- Block setting status to approved/rejected directly (only the
    -- admin approve() flow should ever do this)
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Only an admin can approve or reject a property listing';
    END IF;

    -- Block setting approved_by_admin_id themselves
    IF NEW.approved_by_admin_id IS DISTINCT FROM OLD.approved_by_admin_id THEN
      RAISE EXCEPTION 'approved_by_admin_id can only be set through admin approval';
    END IF;

  END IF;

  RETURN NEW;
END;

-- ── credit_agent_balance ──────────────────────────────
DECLARE
  v_amount INTEGER;
BEGIN
  IF NEW.payment_status = 'completed'
     AND (OLD.payment_status IS DISTINCT FROM 'completed')
     AND NEW.agent_id IS NOT NULL THEN

    SELECT amount INTO v_amount
      FROM public.inspection_transactions
     WHERE inspection_id = NEW.id
       AND status = 'completed'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_amount IS NULL THEN
      SELECT inspection_fee INTO v_amount
        FROM public.properties WHERE id = NEW.property_id;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.agent_balances (agent_id, total_earned, total_withdrawn)
    VALUES (NEW.agent_id, v_amount, 0)
    ON CONFLICT (agent_id) DO UPDATE
      SET total_earned = public.agent_balances.total_earned + EXCLUDED.total_earned;
  END IF;

  RETURN NEW;
END;

-- ── flag_possible_duplicate_property ──────────────────────────────
DECLARE
  v_match_id UUID;
BEGIN
  SELECT id INTO v_match_id
  FROM public.find_possible_duplicate_properties(
    NEW.title, NEW.location_text, NEW.price, NEW.property_type,
    NEW.uploaded_by_agent_id, NEW.id
  )
  LIMIT 1;

  NEW.possible_duplicate_of := v_match_id;
  RETURN NEW;
END;

-- ── lock_owner_details_after_set ──────────────────────────────
BEGIN
  -- Admins can still correct owner details (e.g. the agent made a typo
  -- and the owner reported it, or ownership genuinely changed hands).
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(OLD.owner_full_name, '') <> '' AND NEW.owner_full_name IS DISTINCT FROM OLD.owner_full_name)
     OR (COALESCE(OLD.owner_phone, '') <> '' AND NEW.owner_phone IS DISTINCT FROM OLD.owner_phone)
     OR (COALESCE(OLD.owner_bank_name, '') <> '' AND NEW.owner_bank_name IS DISTINCT FROM OLD.owner_bank_name)
     OR (COALESCE(OLD.owner_account_number, '') <> '' AND NEW.owner_account_number IS DISTINCT FROM OLD.owner_account_number)
     OR (COALESCE(OLD.owner_account_name, '') <> '' AND NEW.owner_account_name IS DISTINCT FROM OLD.owner_account_name)
  THEN
    RAISE EXCEPTION 'Owner payout details are locked once set and can only be changed by an admin. Contact support@rentora.com.ng to update them.';
  END IF;

  RETURN NEW;
END;

-- ── restrict_self_profile_edits ──────────────────────────────
BEGIN
  -- Trusted server-side calls (e.g. the delete-account edge function,
  -- using the service_role key) are allowed to anonymize/suspend on
  -- the user's own behalf during account deletion.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    RAISE EXCEPTION 'Full name can''t be changed here. Contact support@rentora.com.ng if it needs correcting.';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Email can''t be changed here. Contact support@rentora.com.ng.';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Role can''t be self-modified.';
  END IF;
  IF NEW.suspended IS DISTINCT FROM OLD.suspended THEN
    RAISE EXCEPTION 'Account status can''t be self-modified.';
  END IF;

  RETURN NEW;
END;

-- ── expire_stale_pending_payments ──────────────────────────────
DECLARE
  v_minutes INTEGER;
BEGIN
  SELECT COALESCE(value::INTEGER, 30) INTO v_minutes
    FROM public.platform_settings WHERE key = 'pending_payment_expiry_minutes';
  IF v_minutes IS NULL THEN v_minutes := 30; END IF;

  UPDATE public.property_rent_payments
     SET status = 'failed'
   WHERE status = 'pending'
     AND created_at < NOW() - (v_minutes || ' minutes')::INTERVAL;

  UPDATE public.inspection_transactions
     SET status = 'failed'
   WHERE status = 'pending'
     AND created_at < NOW() - (v_minutes || ' minutes')::INTERVAL;

  UPDATE public.transactions
     SET status = 'failed'
   WHERE status = 'pending'
     AND created_at < NOW() - (v_minutes || ' minutes')::INTERVAL;
END;

-- ── block_inspection_on_taken_property ──────────────────────────────
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = NEW.property_id AND availability = 'unavailable'
  ) THEN
    RAISE EXCEPTION 'This property has already been taken and can no longer accept inspection bookings.';
  END IF;
  RETURN NEW;
END;

-- ── find_possible_duplicate_properties ──────────────────────────────
SELECT
    p.id, p.title, p.location_text AS location, p.price, p.uploaded_by_agent_name, p.status,
    GREATEST(similarity(p.title, p_title), similarity(p.location_text, p_location)) AS similarity_score
  FROM public.properties p
  WHERE p.status IN ('pending', 'approved')
    AND p.property_type = p_property_type
    AND (p_exclude_agent_id IS NULL OR p.uploaded_by_agent_id IS DISTINCT FROM p_exclude_agent_id)
    AND (p_exclude_property_id IS NULL OR p.id IS DISTINCT FROM p_exclude_property_id)
    AND p.price BETWEEN (p_price * 0.85) AND (p_price * 1.15)
    AND (
      similarity(p.title, p_title) > 0.35
      OR similarity(p.location_text, p_location) > 0.55
    )
  ORDER BY similarity_score DESC
  LIMIT 5;

