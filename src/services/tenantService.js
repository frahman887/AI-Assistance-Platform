import { db as pool } from "../config/db.js";
/**
 * Resolves a public-facing business slug (e.g. "sunbright-solar") to the
 * internal user_id that owns that business's documents/embeddings.
 * This is the single choke point that keeps widgets scoped to their own data.
 */
export async function resolveBusinessId(slug) {
  if (!slug || typeof slug !== "string") return null;

  const { rows } = await pool.query(
    `SELECT id FROM users WHERE business_slug = $1`,
    [slug.trim().toLowerCase()]
  );

  return rows[0]?.id ?? null;
}