# Helio Platform — Status

**Last updated:** 2026-09-10
**Owner:** Fatinur (building full-time — Exelon internship ended on schedule 2026-09)
**Current phase:** Phase 2 (multi-tenancy formalization) — migrations and code written, not yet run against the database
**First tenant:** Helio Solar Energy (dogfooding testbed; its 3 lined-up deals are tracked independently and are NOT being onboarded onto the platform — see Part 4)

---

## ⚡ Quick Context

Building a niche-agnostic operational platform for service businesses (CRM, AI qualification, SMS/email automation, appointment booking, ticketing). Multi-tenant by design — each tenant configures their vertical at signup, and the AI layer, templates, and knowledge base tailor to their industry while the core codebase stays industry-neutral.

**Helio Solar Energy is the dogfooding testbed and first tenant**, but the platform's continuation does not depend on Helio's business outcome, and Helio's 3 lined-up deals are not going through the platform's CRM. Marketing site stays on Base44 (heliosolarenergy.com); the platform being built handles operations for tenants once it's ready.

**As of 2026-09-10, the RAG MVP is shipped and validated** (auth, document pipeline, `/ask`, widget, admin panel, prompt tuning). A code audit against the actual repo (not just this doc) found the real schema and tenancy model diverged from what was previously documented here — see Part 2a. Phase 2 work has since corrected that and added multi-staff-per-business support.

---

## Part 1 — Infrastructure (Complete)

### Azure Resources (all in `rg-hsaia-mvp`, East US 2)

- ✅ AI Services (`hsai-resource`) — `embeddings` (text-embedding-3-small, 1536d) + `chat` (gpt-4o-mini)
- ✅ PostgreSQL Flexible Server (`pg-hsaia-mvp`) — pgvector enabled, admin `postadmin`
- ✅ Blob Storage (`sthsaiamvp1251`) — `documents` container

### Local Dev Environment (Mac)

- ✅ Node 20.20.2, npm 10.8.2, psql 16.14, Azure CLI 2.87.0, VS Code
- ✅ Terminal alias `helio` → `/Users/fatinur/AI Assistance Project/helio-sol-mvp`
- ✅ `.env` populated (9+ variables including JWT_SECRET)

---

## Part 2 — What's Shipped (MVP, Phases 0–9, All Validated)

These are unaffected by the Phase 2 schema work below — the RAG pipeline, widget, and admin panel behavior are the same; only what's underneath tenant scoping changed.

- **Phase 0 — Infrastructure ✅** — all 4 Azure services passing `verify.mjs`
- **Phase 1 — Migrations ✅** — original `business_slug`/`leads` migrations run cleanly (since superseded — see Part 2a)
- **Phase 2 — Server Boot ✅** — `npm run dev` starts clean
- **Phase 3 — Upload / List / Delete ✅** — document CRUD tested via curl and admin panel
- **Phase 4 — Embedding Pipeline ✅** — chunking + 1536-dim vectors confirmed
- **Phase 5 — `/ask` Endpoint ✅** — RAG retrieval + tenant scoping + tuned prompt; happy path, bad slug (404), missing slug (400), out-of-scope hallucination resistance all tested
- **Phase 6 — Leads + Widget Serving ✅** — `POST /leads` writing to DB, `widget.js` served as static file
- **Phase 7 — Demo Site ✅** — full browser flow: bubble, grounded answers, "I don't know" behavior, lead form at 3rd message
- **Phase 8 — Admin Panel ✅** — login, upload, list, delete via UI
- **Phase 9 — Prompt Tuning ✅** — real Helio FAQ content, in-scope/edge-case/off-topic all passing cleanly at the time

---

## Part 2a — Correction: Actual Schema vs. What Was Previously Documented Here

A prior version of this doc claimed `business_slug` lived on `documents`, `embeddings`, `ai_logs`, and `leads` directly, with a formalized `businesses` table as the next step. A code audit of the actual repo (2026-09-10) found that wasn't true:

- `business_slug` lived **only on `users`** (unique per user) — there was no `businesses` table
- Every tenant-scoped table was actually keyed by **`user_id`**, meaning the real MVP model was **one user account = one business**, with `business_slug` acting only as a public-facing alias resolved via a single lookup function
- `leads` was thinner than documented: `(id, user_id, name, email, message, created_at)` — no `phone`, no `source`
- No migration file created `ai_logs` even though the app wrote to it — the migration history couldn't rebuild the schema from scratch
- **`ragService.js` hardcoded a solar-specific system prompt directly in the core RAG service**, unconditionally — not a vertical branch, but the only prompt that existed. This contradicted the "core codebase never mentions solar" principle. No vertical config (`vertical` column, `settings JSONB`, prompt-loading) existed in code — Layer 3 was documentation only.

Full detail and reasoning: see `DESIGN-LOG.md`. That file is now the source of truth for *why* things changed; this file just reflects current state.

---

## Part 3 — Current Schema (Phase 2, in progress)

```sql
users          (id, email, password_hash, business_slug [legacy, unused], created_at)
businesses     (id, slug, name, vertical, settings JSONB, created_at, updated_at)
business_users (id, business_id, user_id, role ['owner'|'staff'], created_at)
documents      (id, user_id, business_id, file_name, blob_url, uploaded_at)
embeddings     (id, document_id, business_id, user_id, content, embedding VECTOR(1536), created_at)
ai_logs        (id, business_id, user_id [nullable — widget is anonymous], question, retrieved_chunk_ids, response, created_at)
leads          (id, business_id, user_id [nullable, legacy], name, email, message, created_at)
```

**Status: written, not yet run against the database.** Migrations `003`–`006` exist in `/migrations` but haven't been applied or tested. Order and what each does:

- `003_create_businesses_and_business_users.sql` — creates both tables, backfills a business per existing `business_slug` on `users`, makes that user the `owner`
- `004_add_business_id_to_tenant_tables.sql` — adds `business_id` to `documents`/`embeddings`/`ai_logs`/`leads`, backfills from `business_users`, backfills the missing `ai_logs` table definition, drops the `NOT NULL` constraint on `leads.user_id`
- `005_enforce_business_id.sql` — sets `business_id` `NOT NULL` + indexes. **Run only after confirming 004's backfill left zero NULLs** on all four tables
- `006_seed_helio_vertical_config.sql` — moves Helio's previously-hardcoded prompt into `businesses.settings.system_prompt` so removing it from code doesn't regress live behavior. **Requires manually filling in Helio's actual slug before running**

**Code already updated to match this schema** (in the codebase, ahead of the DB): `businessService.js` (new), `authController.js`, `documentController.js`, `documentProcessingService.js`, `blobService.js`, `retrievalService.js`, `ragController.js`, `ragService.js`, `leadController.js`, `leadService.js`. `tenantService.js` was deleted (dead code once slug resolution moved into `businessService.js`).

**Breaking change:** `POST /auth/register` now requires a `businessName` field. Anything that calls it with just email/password will get a 400.

**Not yet done:**
- [ ] Run migrations 003→004 against a **dev copy** of the DB, verify zero NULL `business_id` rows, then run 005
- [ ] Fill in Helio's real slug in 006 and run it
- [ ] Cross-tenant leak test (automated) — matters most once a second real tenant exists; Helio alone can't test isolation meaningfully
- [ ] Decide whether to drop `users.business_slug` now-legacy column, or leave inert until confirmed nothing reads it

---

## Part 4 — Helio Operations (Dogfooding Testbed, Not a CRM Customer)

### Active Deals

The 3 lined-up Helio deals are tracked outside the platform **indefinitely** — not "until the CRM ships." This is a deliberate decoupling decision, not a temporary bridge: the CRM being built is for future tenants, not these 3 deals.

### Current Tools (Independent of Platform Progress)

- **Google Sheets / personal tracking** — Helio's 3 deals, indefinitely
- **Base44 marketing site** — heliosolarenergy.com stays (Learn articles, FAQ, referral form)
- **Base44 Admin CRM** — placeholder; whether/when it's replaced is now a Helio-specific question, not a platform milestone
- **Base44 chat widget** — placeholder; `widget.js` is ready to point at heliosolarenergy.com whenever that's decided, independent of CRM progress
- **Google Voice / Calendly / personal email** — communication tools for these deals, independent of the platform's future Twilio/Gmail integrations

---

## Part 5 — Pain Log

Living list. Every operational friction gets one line. Tag whether it's a platform-level gap, a Helio-specific need, or something the vertical config layer should own.

- [YYYY-MM-DD] [Description] — [platform gap / Helio-specific / vertical config]

---

## Part 6 — Vertical Config Design (Helio First)

Every tenant's vertical config includes:

- `vertical_key` (e.g., `residential_solar`, `hvac`, `roofing`) — **column exists in `businesses.vertical` as of Phase 2**
- `system_prompt` — **now actually loaded from `businesses.settings.system_prompt` at runtime**, with a generic fallback for businesses with no vertical configured. Helio's tuned prompt is seeded via migration `006`
- `sms_templates`, `email_templates` — not yet implemented; still Phase 5 work
- `custom_fields` — not yet implemented; Phase 3 (CRM tables)
- `automation_templates` — not yet implemented; Phase 5
- `knowledge_base_seed` — Helio's is `helio-solar-knowledge-base.pdf`, uploaded manually via admin panel; no automated seeding-on-signup yet

The core codebase should never mention "solar" outside of seed data / config values. This was violated once already (the hardcoded prompt) — see Part 2a. Watch for this recurring as CRM custom fields get built in Phase 3.

---

## Part 7 — Strategic Anchors

### The Discipline: Customer First

Helio's needs (as the dogfooding tenant) still drive what gets built and validated, even though its 3 deals aren't going through the CRM. Don't let "Helio isn't a CRM customer" become an excuse to stop treating its operational reality as the test of whether a feature actually works.

### The Discipline: Niche-Agnostic Core

If a solar-specific concept starts showing up in a table schema, controller name, or core service function, that's a red flag — it belongs in vertical config, not the codebase. This isn't hypothetical: the original `ragService.js` had a hardcoded, unconditional solar prompt in the core RAG service until Phase 2 caught and fixed it. Watch for this again during CRM buildout (Phase 3) — that's historically the phase where solar-specific columns are most tempting to add directly to `contacts`.

### Kill Switches

Removed. Platform continuation is no longer tied to Helio's business outcome. If the SaaS ambition stalls, that's a build/market question to revisit on its own terms — not something wired to whether 3 specific solar deals close.

---

## Part 8 — Weekly Retrospective Template

Every Friday afternoon (30 min, non-negotiable):

- What did I ship this week? [Platform features]
- Pain log additions this week:
- What's next week's build priority?
- Did any solar-specific logic sneak into the codebase? If so, where does it actually belong?
- Next week's priorities: 1) [Platform build], 2) [Strategic]

---

## Part 9 — Session Log

**2026-09-10 — MVP review + code audit + Phase 2 (multi-staff) build**
- Confirmed MVP (Phases 0–9) shipped end-to-end
- Code audit against the real repo found the documented schema didn't match reality — corrected (Part 2a)
- Decision: Helio's 3 deals decoupled from platform onboarding permanently; kill switches removed; building full-time post-Exelon
- Decision: businesses support multiple staff users from the start, not a 1:1 user-business model
- Wrote migrations 003–006 and updated all affected services/controllers to match. **Not yet run against the database.**
- `DESIGN-LOG.md` created to track original-vs-adjusted design decisions going forward
- Next session: run migrations against a dev DB copy, verify backfill, seed Helio's real slug into 006, then write the cross-tenant leak test

**[YYYY-MM-DD] — Session summary:**
- What got done
- What got blocked
- Key decisions made
- What's next
