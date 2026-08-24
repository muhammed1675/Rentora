-- Rentora agency fee compatibility + complete property fee model.
-- Keeps legacy properties.agent_fee working while exposing the business-facing agency_fee name.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS agency_fee numeric NOT NULL DEFAULT 0;

UPDATE public.properties
SET agency_fee = COALESCE(NULLIF(agency_fee, 0), agent_fee, 0)
WHERE COALESCE(agency_fee, 0) = 0 AND COALESCE(agent_fee, 0) <> 0;

-- Keep both columns synchronized for older code/rows that still write agent_fee.
CREATE OR REPLACE FUNCTION public.sync_property_agency_fee()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.agency_fee := COALESCE(NEW.agency_fee, NEW.agent_fee, 0);
    NEW.agent_fee := COALESCE(NEW.agency_fee, 0);
  ELSIF NEW.agency_fee IS DISTINCT FROM OLD.agency_fee THEN
    NEW.agent_fee := COALESCE(NEW.agency_fee, 0);
  ELSIF NEW.agent_fee IS DISTINCT FROM OLD.agent_fee THEN
    NEW.agency_fee := COALESCE(NEW.agent_fee, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_property_agency_fee ON public.properties;
CREATE TRIGGER trg_sync_property_agency_fee
BEFORE INSERT OR UPDATE OF agency_fee, agent_fee ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.sync_property_agency_fee();
