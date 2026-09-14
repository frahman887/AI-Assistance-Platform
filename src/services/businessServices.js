import { db as pool } from "../config/db.js";

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Creates a new business and makes the given user its owner. Used at
 * registration: signing up now means "create a business," not just "create
 * a login," since a login alone no longer implies a business.
 */
export async function createBusinessWithOwner(userId, businessName) {
  const baseSlug = slugify(businessName);
  if (!baseSlug) {
    throw new Error("Business name must contain at least one letter or number.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const businessResult = await client.query(
      `INSERT INTO businesses (slug, name) VALUES ($1, $2)
       RETURNING id, slug, name, vertical, settings, created_at`,
      [baseSlug, businessName]
    );
    const business = businessResult.rows[0];

    await client.query(
      `INSERT INTO business_users (business_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [business.id, userId]
    );

    await client.query("COMMIT");
    return business;
  } catch (err) {
    await client.query("ROLLBACK");
    // Unique violation on slug -> surface a clearer error than raw Postgres text
    if (err.code === "23505") {
      throw new Error(`A business with slug "${baseSlug}" already exists.`);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns the business a user belongs to, plus their role on it.
 * NOTE: assumes one business per user for now (true today). If/when a user
 * can belong to multiple businesses, login needs a business-selection step
 * instead of calling this directly — this function will throw or return
 * an arbitrary row if that invariant breaks, on purpose, so it fails loudly
 * rather than silently picking the wrong tenant.
 */
export async function getPrimaryBusinessForUser(userId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.slug, b.name, b.vertical, b.settings, bu.role
     FROM business_users bu
     JOIN businesses b ON b.id = bu.business_id
     WHERE bu.user_id = $1`,
    [userId]
  );

  if (rows.length > 1) {
    throw new Error(
      `User ${userId} belongs to ${rows.length} businesses — login needs a business-selection step, not implemented yet.`
    );
  }

  return rows[0] || null;
}

/**
 * Resolves a public-facing slug (e.g. "helio-solar") straight to the
 * business row. This replaces the old resolveBusinessId, which used to
 * look this up via users.business_slug.
 */
export async function getBusinessBySlug(slug) {
  if (!slug || typeof slug !== "string") return null;

  const { rows } = await pool.query(
    `SELECT id, slug, name, vertical, settings FROM businesses WHERE slug = $1`,
    [slug.trim().toLowerCase()]
  );

  return rows[0] || null;
}

/**
 * Adds an existing user to a business as staff. No invite-email flow yet —
 * this is the primitive the admin panel will eventually call once a "invite
 * a teammate" UI exists. Not needed for Helio today (single operator), but
 * the schema and this function exist so it's a config change away, not a
 * migration away, when it is needed.
 */
export async function addStaffToBusiness(businessId, userId, role = "staff") {
  const { rows } = await pool.query(
    `INSERT INTO business_users (business_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (business_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING business_id, user_id, role`,
    [businessId, userId, role]
  );
  return rows[0];
}