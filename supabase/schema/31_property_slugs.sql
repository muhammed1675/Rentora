-- 31_property_slugs.sql
--
-- WHY THIS EXISTS
-- Property links were https://www.rentora.com.ng/property/<uuid> — a 36
-- character random string that looks broken/spammy pasted into WhatsApp,
-- SMS, or a flyer. This adds a human-readable `slug` derived from the
-- property title (e.g. "chidinma-lodge-adenike") that resolves to the exact
-- same property. Old UUID URLs keep working unchanged — PropertyDetails.jsx,
-- propertyAPI.getPublic/getById, og-property.js, and og-image.mjs were all
-- updated to accept EITHER a slug or a raw id in the same route param /
-- query param, detected by whether the value looks like a UUID.
--
-- Slugs are generated automatically by the trigger below whenever a
-- property's title is set (insert) or changed (update) — agents and admins
-- don't need to do anything. Editing price/description/photos without
-- touching the title does NOT change the slug, so a link someone already
-- has keeps working.

alter table public.properties
  add column if not exists slug text;

-- Turns "Chidinma Lodge — Adenike (2 Bedroom!)" into "chidinma-lodge-adenike-2-bedroom"
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

create or replace function public.set_property_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix text;
  attempt int := 0;
begin
  -- Only (re)generate when there's no slug yet, or the title actually
  -- changed — an agent editing price/photos shouldn't move the URL out
  -- from under anyone who already shared the old one.
  if new.slug is not null and tg_op = 'UPDATE' and new.title is not distinct from old.title then
    return new;
  end if;

  base_slug := public.slugify(new.title);
  if base_slug = '' then
    base_slug := 'property';
  end if;

  candidate := base_slug;
  loop
    exit when not exists (
      select 1 from public.properties
      where slug = candidate and id is distinct from new.id
    );
    attempt := attempt + 1;
    if attempt = 1 then
      -- Short, stable suffix derived from the property's own id (not an
      -- incrementing counter), so re-running this trigger never produces
      -- a different slug for the same row on a later, unrelated edit.
      suffix := substr(new.id::text, 1, 6);
    else
      suffix := substr(new.id::text, 1, 6) || '-' || attempt;
    end if;
    candidate := base_slug || '-' || suffix;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

drop trigger if exists trg_set_property_slug on public.properties;
create trigger trg_set_property_slug
  before insert or update on public.properties
  for each row
  execute function public.set_property_slug();

-- Backfill every existing property that doesn't have a slug yet. This is
-- just a no-op UPDATE (id = id) to make the BEFORE UPDATE trigger above
-- fire per row and fill in `slug` using the same logic new rows get.
update public.properties set id = id where slug is null;

-- Case-insensitive-safe uniqueness (slugs are always generated lowercase,
-- but this protects against any manual edit later too) and fast lookups
-- from propertyAPI.getPublic/getById, og-property.js, and og-image.mjs.
create unique index if not exists properties_slug_key on public.properties (slug) where slug is not null;
