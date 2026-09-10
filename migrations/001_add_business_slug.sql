-- Adds a public-safe slug to users so widgets can be scoped to one business's
-- documents/embeddings without exposing raw internal user IDs.

ALTER TABLE users ADD COLUMN business_slug VARCHAR(100) UNIQUE;

-- After running this, set a slug for your test/demo user, e.g.:
-- UPDATE users SET business_slug = 'sunbright-solar' WHERE email = 'your-email@example.com';