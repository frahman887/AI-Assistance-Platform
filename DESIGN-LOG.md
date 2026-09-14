# Design Log

Running record of what the platform was originally designed to be, and every adjustment or
addition made since — dated, with the reasoning behind it. This is not a replacement for
STATUS.md (current state) or PLATFORM-PLAN.md (forward roadmap). This is the history: what
changed, when, and why, so a decision never has to be re-litigated or re-discovered from a diff.

Append to this file every time a design decision changes something documented elsewhere.
Newest entries at the bottom.

---

## Original Design (as of project kickoff, documented pre-2026-09-10)

**Three-layer architecture:**
- Layer 1 — Marketing sites, external to the platform, per tenant (Helio's is Base44)
- Layer 2 — Universal operational platform (CRM, comms, automation, AI) — the only thing the
  codebase does, multi-tenant by design
- Layer 3 — Vertical configuration per tenant, selected at signup, driving AI prompts,
  templates, custom fields, and a seed knowledge base

**Original multi-tenancy plan (as documented in STATUS.md/PLATFORM-PLAN.md):**
```
users        (id, email, password_hash, created_at)
documents    (id, user_id, business_slug, file_name, blob_url, uploaded_at)
embeddings   (id, document_id, user_id, business_slug, content, embedding VECTOR(1536), created_at)
ai_logs      (id, user_id, business_slug, question, retrieved_chunk_ids, response, created_at)
leads        (id, business_slug, name, email, phone, source, message, created_at)
```
`business_slug` was documented as living on every tenant-scoped table directly, as the wedge
that unblocked shipping the MVP, with a formalized `businesses` table + `business_id` planned
as the immediate next step (Phase 2).

**Documented assumption:** one user account = one business. Not stated explicitly as a design
choice — implicit in the schema, since nothing modeled multiple staff per business.

**Original Helio plan:** 3 lined-up deals to be onboarded onto the platform's CRM once built
(Phase 3). Kill switches tied platform continuation to Helio's business outcomes (e.g., "if
Helio's deals get worse service through the platform than Google Sheets, fall back to a
simpler ambition"). Fatinur was a current Exelon intern building this as a side project.

---

## 2026-09-10 — Correction: actual codebase did not match documented schema

Code review of the real repo (zip export, not the GitHub page — github.com blocks automated
fetching) found the implementation diverged from STATUS.md's documented schema:

- **No `businesses` table existed at all.** `business_slug` lived only on `users` (one column,
  unique per user) — not on `documents`, `embeddings`, `ai_logs`, or `leads` as documented.
- **Actual tenant scoping key was `user_id`**, not `business_slug`, on every table. The real
  model was "one user account = one business," with `business_slug` acting only as a public
  lookup alias that resolved to a `user_id` via a single choke point (`tenantService.
  resolveBusinessId`).
- `leads` schema was thinner than documented: `(id, user_id, name, email, message, created_at)`
  — no `phone`, no `source`.
- No migration file in the repo created `ai_logs`, even though the app writes to it — meaning
  the migration history couldn't rebuild the schema from scratch.
- **`ragService.js` hardcoded a solar-specific system prompt directly in the core RAG service**
  — not a `vertical === 'solar'` conditional, but an unconditional solar prompt shipped to
  every tenant regardless of vertical. This directly contradicted the "core codebase never
  mentions solar" principle. No vertical config layer (`vertical` column, `settings JSONB`, or
  any prompt-loading logic) existed in code — Layer 3 was documentation only at this point.

This entry exists so future sessions don't assume STATUS.md's schema block was ever accurate —
it described the intended end state of Phase 2, not the MVP's actual shipped state.

## 2026-09-10 — Decision: platform decoupled from Helio's outcome

- The platform's continuation no longer depends on Helio Solar Energy's success or failure.
  The "Kill Switches" sections tying continuation to Helio-specific outcomes were removed from
  the plan.
- Helio's 3 lined-up deals will **not** be onboarded onto the platform. They stay on Google
  Sheets / personal tracking indefinitely, independent of platform build progress. The CRM
  being built is for future deals and future tenants, not these 3.
- Fatinur's Exelon internship ended on schedule (2026-09) — he is now building the platform
  full-time, not as an intern side project. This changes the runway/timeline assumptions in
  PLATFORM-PLAN.md's Exelon-quitting math, which was written assuming continued Exelon income
  during the build.

## 2026-09-10 — Addition: multi-staff-per-business support (Phase 2 design)

Originally, Phase 2 was scoped as "add a `businesses` table, add `business_id` columns,
backfill from `business_slug`" — a mechanical formalization of the same 1:1 user-is-a-business
model. Decision made to instead support multiple staff logins per business from the start:

- `businesses` and `users` are now genuinely separate entities, connected by a
  `business_users` join table (`business_id`, `user_id`, `role` — `owner` | `staff`).
- Registration now creates a business + owner together (`businessName` required in the
  register request — **breaking change** to the existing `/auth/register` API shape).
- Login resolves the caller's business via `business_users` and embeds `businessId` + `role`
  in the JWT. Current code assumes one business per user and throws loudly if that's ever
  violated (`getPrimaryBusinessForUser`) — deliberate, so a future multi-business-per-user
  case fails visibly instead of silently picking the wrong tenant.
- `addStaffToBusiness()` exists in `businessService.js` as the primitive for adding teammates,
  but there's no invite-flow UI yet. Not needed for Helio today (single operator) — the
  schema supports it now so it's a config/UI addition later, not another migration.
- Documents are now visible to any staff member on a business, not just the uploader
  (`listDocuments`/`deleteDocument` filter by `business_id`, not `user_id`) — this is the
  actual point of multi-staff support.

**Migrations added:** `003_create_businesses_and_business_users.sql`,
`004_add_business_id_to_tenant_tables.sql` (also backfills the missing `ai_logs` table
definition), `005_enforce_business_id.sql` (NOT NULL + indexes, run only after verifying 004's
backfill left no NULLs), `006_seed_helio_vertical_config.sql` (moves Helio's previously
hardcoded prompt into `businesses.settings` so removing it from code doesn't regress live
widget behavior — requires manually filling in Helio's actual slug before running).

**Code changed:** new `businessService.js` (business creation, staff membership, slug
resolution). `tenantService.js` deleted — dead code once `businessService.js` took over slug
resolution directly in `ragController`/`leadController`. `authController`,
`documentController`, `documentProcessingService`, `blobService`, `retrievalService`,
`ragService`, `leadController`, `leadService` all updated to scope by `business_id` instead of
`user_id`.

**Still open:** cross-tenant leak test not yet written. Matters most once a second real tenant
exists — Helio alone can't meaningfully test tenant isolation.

---

*(Add new entries below this line as decisions are made. Keep the original-design section at
the top untouched — it's the baseline everything else is measured against.)*
