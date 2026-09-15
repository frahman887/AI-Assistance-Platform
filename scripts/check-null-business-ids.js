// scripts/check-null-business-ids.js
//
// Run after migration 004, before migration 005. Confirms the backfill in
// 004 actually caught every row — 005 will fail (correctly) if any of
// these come back nonzero, since it sets business_id to NOT NULL.
//
// Usage: node scripts/check-null-business-ids.js

import { db } from "../src/config/db.js";

const tables = ["documents", "embeddings", "ai_logs", "leads"];

console.log("Checking for NULL business_id rows before running migration 005...\n");

let anyProblems = false;

for (const table of tables) {
  const { rows } = await db.query(
    `SELECT count(*) FROM ${table} WHERE business_id IS NULL`
  );
  const count = parseInt(rows[0].count, 10);
  const status = count === 0 ? "✅" : "❌";
  if (count !== 0) anyProblems = true;
  console.log(`${status} ${table}: ${count} rows with NULL business_id`);
}

console.log("");
if (anyProblems) {
  console.log("Do NOT run migration 005 yet — fix the backfill for the tables above first.");
  process.exitCode = 1;
} else {
  console.log("All clear. Safe to run: node scripts/run-migration.js 005_enforce_business_id.sql");
}

await db.end();