-- users.business_slug was the original tenant-identity mechanism, before
-- `businesses` existed as its own table (see 003). Confirmed via
-- `grep -rn business_slug src/` that nothing in the codebase reads this
-- column anymore — getBusinessBySlug() queries businesses.slug directly.
-- Safe to drop.

ALTER TABLE users DROP COLUMN IF EXISTS business_slug;