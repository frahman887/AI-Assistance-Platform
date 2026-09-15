// scripts/test-cross-tenant-isolation.js
//
// The actual proof that Phase 2 multi-tenancy works — not that the schema
// exists, but that two real businesses can't see each other's data through
// the real API. Uses the two businesses already in the dev DB (sunbright,
// helio-solar) rather than creating fixtures, so this reflects real state.
//
// Requires the server running locally first: npm run dev (default
// http://localhost:3001 — override with BASE_URL if different).
//
// Usage:
//   SUNBRIGHT_EMAIL=test@example.com SUNBRIGHT_PASSWORD=... \
//   HELIO_EMAIL=testadmin@example.com HELIO_PASSWORD=... \
//   node scripts/test-cross-tenant-isolation.js

import { db } from "../src/config/db.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

const SUNBRIGHT = {
  email: process.env.SUNBRIGHT_EMAIL,
  password: process.env.SUNBRIGHT_PASSWORD,
};
const HELIO = {
  email: process.env.HELIO_EMAIL,
  password: process.env.HELIO_PASSWORD,
};

let passCount = 0;
let failCount = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`✅ ${label}`);
    passCount++;
  } else {
    console.log(`❌ ${label}${detail ? " — " + detail : ""}`);
    failCount++;
  }
}

async function login({ email, password }) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function getDocuments(token) {
  const res = await fetch(`${BASE_URL}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /documents failed: ${res.status}`);
  return (await res.json()).documents;
}

async function ask(businessSlug, question) {
  const res = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessSlug, question }),
  });
  if (!res.ok) throw new Error(`POST /ask failed for ${businessSlug}: ${res.status}`);
  return res.json();
}

async function createLead(businessSlug, name) {
  const res = await fetch(`${BASE_URL}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessSlug, name, email: `${name}@leaktest.example.com` }),
  });
  if (!res.ok) throw new Error(`POST /leads failed for ${businessSlug}: ${res.status}`);
  return res.json();
}

async function main() {
  if (!SUNBRIGHT.email || !SUNBRIGHT.password || !HELIO.email || !HELIO.password) {
    console.error(
      "Missing credentials. Set SUNBRIGHT_EMAIL, SUNBRIGHT_PASSWORD, HELIO_EMAIL, HELIO_PASSWORD as env vars before running."
    );
    process.exit(1);
  }

  console.log(`Testing against ${BASE_URL}\n`);

  // --- Login ---
  const sunbrightAuth = await login(SUNBRIGHT);
  const helioAuth = await login(HELIO);

  check(
    "Sunbright login returns its own business (slug=sunbright-solar)",
    sunbrightAuth.business.slug === "sunbright-solar",
    `got slug=${sunbrightAuth.business.slug}`
  );
  check(
    "Helio login returns its own business (slug=helio-solar)",
    helioAuth.business.slug === "helio-solar",
    `got slug=${helioAuth.business.slug}`
  );

  // --- Document listing isolation ---
  const sunbrightDocs = await getDocuments(sunbrightAuth.token);
  const helioDocs = await getDocuments(helioAuth.token);

  check(
    "Sunbright's document list contains none of Helio's filenames",
    !sunbrightDocs.some((d) => d.file_name === "ModernResume.pdf" || d.file_name === "Helio_Solar_FAQ.pdf"),
    `sunbright saw: ${JSON.stringify(sunbrightDocs.map((d) => d.file_name))}`
  );
  check(
    "Helio's document list contains only Helio's own files",
    helioDocs.every((d) => d.file_name === "ModernResume.pdf" || d.file_name === "Helio_Solar_FAQ.pdf"),
    `helio saw: ${JSON.stringify(helioDocs.map((d) => d.file_name))}`
  );

  // --- /ask retrieval isolation ---
  const sunbrightAnswer = await ask("sunbright-solar", "What services do you offer?");
  const helioAnswer = await ask("helio-solar", "What services do you offer?");

  check(
    "Asking as sunbright never retrieves a Helio document as a source",
    !sunbrightAnswer.sources.some((s) => [1, 4].includes(s.documentId)),
    `sunbright sources: ${JSON.stringify(sunbrightAnswer.sources.map((s) => s.documentId))}`
  );
  check(
    "Asking as helio-solar never retrieves a source outside its own documents",
    helioAnswer.sources.every((s) => [1, 4].includes(s.documentId)),
    `helio sources: ${JSON.stringify(helioAnswer.sources.map((s) => s.documentId))}`
  );

  // --- Lead isolation (no GET /leads endpoint exists, so verify via DB) ---
  const sunbrightLead = await createLead("sunbright-solar", "LeakTestSunbright");
  const helioLead = await createLead("helio-solar", "LeakTestHelio");

  const { rows: leadRows } = await db.query(
    `SELECT id, business_id, name FROM leads WHERE id = $1 OR id = $2`,
    [sunbrightLead.leadId, helioLead.leadId]
  );
  const sunbrightLeadRow = leadRows.find((r) => r.id === sunbrightLead.leadId);
  const helioLeadRow = leadRows.find((r) => r.id === helioLead.leadId);

  check(
    "Lead submitted via sunbright-solar lands under sunbright's business_id (1)",
    sunbrightLeadRow?.business_id === 1,
    `got business_id=${sunbrightLeadRow?.business_id}`
  );
  check(
    "Lead submitted via helio-solar lands under helio's business_id (2)",
    helioLeadRow?.business_id === 2,
    `got business_id=${helioLeadRow?.business_id}`
  );

  console.log(`\n${passCount} passed, ${failCount} failed`);
  console.log(
    failCount === 0
      ? "\n✅ No cross-tenant leakage detected."
      : "\n❌ Leakage detected — do not treat multi-tenancy as done until every check above passes."
  );

  await db.end();
  process.exitCode = failCount === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error("Test run crashed:", err);
  await db.end();
  process.exitCode = 1;
});