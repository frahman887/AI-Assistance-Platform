// scripts/run-migration.js
//
// Runs a single migration file against the database using the exact same
// pg.Pool connection the app itself uses (src/config/db.js). This exists
// because relying on `psql "$DATABASE_URL"` from a bare shell kept failing
// on env vars that dotenv (loaded automatically inside db.js) has no
// trouble finding — so instead of fighting bash exports, this goes through
// the same code path the app already trusts.
//
// Usage:
//   node scripts/run-migration.js 003_create_businesses_and_business_users.sql

import { db } from "../src/config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error("Usage: node scripts/run-migration.js <filename-in-migrations-folder>");
  process.exit(1);
}

const filePath = path.join(__dirname, "..", "migrations", migrationFile);

if (!fs.existsSync(filePath)) {
  console.error(`No such file: ${filePath}`);
  console.error("Check the filename matches exactly what's in your migrations/ folder.");
  process.exit(1);
}

const sql = fs.readFileSync(filePath, "utf8");

console.log(`Running ${migrationFile}...`);

try {
  // Passed as a plain string with no parameters, so node-postgres uses the
  // simple query protocol — which, unlike the extended protocol, allows
  // multiple semicolon-separated statements in one call. That's required
  // here since these migration files have several statements each.
  await db.query(sql);
  console.log(`✅ ${migrationFile} completed successfully.`);
} catch (err) {
  console.error(`❌ ${migrationFile} failed:`);
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}