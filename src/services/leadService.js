import { db as pool } from "../config/db.js";
/**
 * Save a captured lead, scoped to the business (user_id) that owns the
 * widget conversation it came from.
 */
export async function createLead(businessId, { name, email, message }) {
  const { rows } = await pool.query(
    `INSERT INTO leads (user_id, name, email, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [businessId, name || null, email || null, message || null]
  );

  return rows[0];
}