# Helio Platform — Strategic Plan

**Owner:** Fatinur
**Vision:** A niche-agnostic operational platform for service businesses. Other verticals (HVAC, roofing, etc.) added by configuration, not code changes.
**Current state (as of 2026-09-10):** RAG MVP shipped and validated. Phase 2 (multi-tenancy formalization, with multi-staff-per-business support) has migrations and code written but not yet run against the database.
**Building status:** Full-time — Exelon internship ended on schedule (2026-09). Not currently balancing this against another job.

---

## Part 0 — The Core Insight

Most operational platforms make one of two mistakes:

1. **They pick a vertical (like "solar CRM") and hard-code industry logic into the schema.** Fast to launch, but you can never expand to other verticals without a rewrite.
2. **They stay completely generic (like GoHighLevel)** and force every customer to configure everything themselves. Powerful but overwhelming — most small businesses churn before they finish setup.

The right architecture is **generic core, industry configuration layer**. The database and code know nothing about solar or HVAC. But every tenant picks a vertical at signup, and that selection loads:

- AI system prompts tuned to their industry's vocabulary and common questions
- SMS/email templates written in their industry's tone
- Automation templates matching their sales cycle
- Custom fields relevant to their work
- A seed knowledge base of standard industry content

Same code. Different config. Feels like a bespoke tool for each vertical.

**This principle was violated once already** — the original `ragService.js` hardcoded a solar-specific system prompt directly into the core RAG service, unconditionally, with no vertical branch at all. Phase 2 caught and fixed this (prompt now loads from `businesses.settings.system_prompt`), but it's proof this isn't a one-time design decision — it's a discipline that has to hold up under real feature pressure. See `DESIGN-LOG.md` for the full account.

---

## Part 1 — The Three Layers, In Detail

### Layer 1 — Marketing Sites (Per Tenant, External to Platform)

Each business keeps its own marketing site. Helio uses Base44 at heliosolarenergy.com. Other tenants will use whatever they already have (Squarespace, WordPress, Webflow, Base44).

**The platform does not build websites.** It integrates via:
- A chat widget script tag (`widget.js` — shipped, serving from Express)
- A lead form endpoint (`POST /leads` — shipped)
- Optionally, embed codes for other UI elements (booking calendar, referral form) — later

### Layer 2 — Universal Operational Platform (What You're Building)

Multi-tenant by design. As of Phase 2, tenancy is modeled as `businesses` ↔ `business_users` ↔ `users` — a business can have multiple staff logins, not just one owner account. The codebase never branches by industry (see Part 0's caveat).

**Current shipped capabilities:**
- Auth (register creates a business + owner together; login resolves business via `business_users`)
- Document upload → Blob storage → chunk → embed → store, scoped by `business_id`
- RAG retrieval (`/ask`, tenant-scoped, prompt loaded from business config)
- Widget serving (`widget.js` as static file)
- Lead capture (`POST /leads`, scoped by `business_id`)
- Admin panel (login, upload, list, delete) — now shows all of a business's documents to any staff member, not just the uploader

**In progress (Phase 2, code written, not yet run against DB):**
- `businesses` + `business_users` tables (migration 003)
- `business_id` added to `documents`/`embeddings`/`ai_logs`/`leads` (migration 004)
- `business_id` enforcement + indexes (migration 005, gated on verifying 004's backfill)
- Helio's tuned prompt seeded into config (migration 006, needs Helio's real slug filled in)
- Cross-tenant leak test — **not yet written**

**Core capabilities still to build (in order):**
- Contacts, deals, activities, pipeline
- Communication logging (SMS, email, calls, meetings)
- Two-way SMS via Twilio
- Email via Gmail API
- Appointment scheduling
- Automation engine (triggers + actions)
- Ticketing
- AI: lead scoring, drafted communications, ticket categorization
- Reviews, referrals, maintenance reminders

None of these know about solar, HVAC, or any specific industry. They know about "contacts" and "deals" and "leads" — universal service-business concepts.

### Layer 3 — Vertical Configuration (Per Tenant)

At signup, the customer picks their vertical. That selection loads (schema now exists — `businesses.vertical` + `businesses.settings JSONB`):

```json
{
  "vertical_key": "residential_solar",
  "display_name": "Residential Solar",
  "system_prompt": "You are the AI assistant for a residential solar installation company...",
  "custom_fields": {
    "contacts": ["roof_type", "roof_age", "current_utility", "monthly_bill_avg"],
    "deals": ["system_size_kw", "estimated_annual_production"]
  },
  "sms_templates": { "...": "not yet implemented" },
  "email_templates": { "...": "not yet implemented" },
  "automation_templates": [{ "...": "not yet implemented" }],
  "knowledge_base_seed_url": "not yet automated — Helio's was uploaded manually"
}
```

**What's actually real as of Phase 2:** `vertical` and `settings.system_prompt` — the AI personalization mechanism works end-to-end, loaded at runtime instead of hardcoded. Everything else in that JSON shape (templates, custom fields, automated seeding) is still aspirational, built as each corresponding phase is reached. Don't read this section as "done" — read `businesses.vertical`/`settings.system_prompt` as done, the rest as designed-but-not-built.

---

## Part 2 — The Full Roadmap

### Phase 1 — MVP Foundation ✅ COMPLETE

Shipped and validated. See STATUS.md Part 2 for the full Phase 0–9 breakdown.

### Phase 2 — Multi-Tenancy Formalization + Multi-Staff Support ⚠ IN PROGRESS

**Original scope** (documented pre-2026-09-10): formalize `businesses`, add `business_id`, migrate off `business_slug`. **Actual scope turned out larger** once a code audit found the real MVP schema didn't match what was documented (see STATUS.md Part 2a — `business_slug` lived only on `users`, tenancy was actually keyed by `user_id`, no `businesses` table existed). Scope also expanded to support multiple staff logins per business from the start, rather than formalizing the same 1:1 model.

- [x] Audit actual repo state vs. documented state
- [x] Create `businesses` + `business_users` tables (migration 003)
- [x] Add `business_id` to `users`... — correction, to `documents`, `embeddings`, `ai_logs`, `leads` (migration 004)
- [x] Backfill the missing `ai_logs` table definition (no prior migration created it)
- [x] Update `authController`/`businessService` for business-aware register/login with roles
- [x] Update all tenant-scoped services/controllers to filter by `business_id`
- [x] Extract hardcoded solar prompt from `ragService.js` into `businesses.settings.system_prompt`
- [ ] Run migrations 003→004 against a dev DB copy
- [ ] Verify zero NULL `business_id` rows, then run 005 (enforce NOT NULL + index)
- [ ] Fill in Helio's real slug and run 006 (seed prompt)
- [ ] Automated cross-tenant leak tests (must-pass before any real second tenant's data lands)
- [ ] Decide fate of legacy `users.business_slug` column (drop vs. leave inert)

**Success criteria:** two test businesses exist, each with different documents and different staff users, no leakage across any endpoint.

### Phase 3 — Core CRM

Goal: build `contacts`, `deals`, `activities` for whichever tenants actually sign up. **No longer scoped around onboarding Helio's 3 lined-up deals** — those are permanently decoupled from platform progress (see STATUS.md Part 4). Helio remains the dogfooding tenant for testing these tables, but success here is not gated on Helio's 3 deals moving onto the platform.

- [ ] `contacts` table (business_id, name, email, phone, source, timestamps)
- [ ] `addresses` table (contact_id, street, city, state, zip, notes)
- [ ] `deals` table (business_id, contact_id, stage, temperature, estimated_value, expected_close)
- [ ] `activities` table (business_id, contact_id, deal_id, type, subject, body, direction, timestamps)
- [ ] CRUD APIs for each
- [ ] Admin UI: contact list, contact detail, deal pipeline (Kanban by stage)

**Success criteria:** the CRM works end-to-end for at least one real or realistic tenant workflow — validated through Helio's dogfooding use, not through migrating Helio's actual 3 deals onto it.

### Phase 4 — Communication Layer

Goal: two-way SMS and email inside the CRM.

- [ ] Twilio integration (per-business phone numbers, two-way SMS)
- [ ] Gmail API integration (send + auto-log received)
- [ ] Activity timeline per contact
- [ ] Manual activity entry (log a call, log a text sent from your phone)

**Success criteria:** communication logging works reliably across at least two tenants' worth of test data.

### Phase 5 — Automation Engine

Goal: the "if this then that" for customer lifecycle.

- [ ] Rule-based automation engine (triggers + actions)
- [ ] First automation templates seeded for Helio's vertical config
- [ ] Standard sequences: new lead nurture, appointment reminders, post-consult follow-up, review request

**Success criteria:** at least one tenant has 3+ active automations that measurably save time.

### Phase 6 — AI Layer Beyond Basic RAG

Goal: the "smart" that differentiates from GoHighLevel.

- [ ] AI lead scoring (rule-based first, ML later): temperature from signals
- [ ] AI-drafted SMS/email replies (human approval)
- [ ] Ticket auto-categorization
- [ ] Per-vertical AI system prompts (pattern already proven with Helio's; extend to future verticals)

**Success criteria:** AI drafts are being used in real conversations with an edit rate under 30%.

### Phase 7 — Widget Deployment on Helio's Real Site

Goal: `widget.js` replaces Base44's default chat on heliosolarenergy.com — a Helio-specific decision, independent of CRM/Phase 3 progress.

- [ ] Deploy the widget on Helio's Base44 site
- [ ] Test grounded answers against real customer questions
- [ ] Lead capture flows into wherever Helio is actually tracking leads at the time

**Success criteria:** at least one real Helio prospect converses with the widget and at least one lead is captured through it.

### Phase 8 — Talk to Non-Helio Prospects

Goal: validate that other businesses actually want this before building vertical templating.

- Identify small businesses in solar or an adjacent vertical (HVAC)
- Show a live demo of the platform running
- Ask: "Would this work for you?" "What's missing?" "Would you pay $XX/mo?"

**Success criteria:** meaningful signal (defined when you get here) that a non-Helio business would actually use and pay for this.

### Phase 9 — Vertical Templating

Only start once Phase 8 produces real signal.

- [ ] Template loader for signup — pick vertical from dropdown, config loads
- [ ] Second vertical's config (HVAC most likely)
- [ ] Second seed knowledge base
- [ ] Second set of SMS/email/automation templates
- [ ] Second-vertical AI system prompt

**Success criteria:** a new business can spin up with a different vertical and the platform feels genuinely tailored to it — without writing any new code, only config.

### Phase 10 — Commercialization

- [ ] Stripe billing, self-serve signup, onboarding flow
- [ ] Pricing tiers (TBD based on Phase 8 feedback)
- [ ] Support ticketing (for your SaaS customers)
- [ ] Compliance basics (TOS, privacy policy, GDPR/CCPA)
- [ ] First paying customers

### Phase 11+ — Growth

Content marketing, cold outreach, referral programs, more verticals. Enter only after Phase 10 proves the model.

---

## Part 3 — Explicitly Out of Scope (For Now)

Do not build these until real customers ask for them:

- Voice AI
- Mobile app
- White-label branding
- Full-featured page builder (Base44 exists; don't reinvent)
- Payments processing for tenants' customer transactions
- Multi-language support

If Helio requests any of these, that's still not a green light — Helio's needs (as a dogfooding tenant, not a paying CRM customer) don't equal market demand.

---

## Part 4 — Costs and Unit Economics

### Fixed Infrastructure Costs

- Azure services (Postgres, OpenAI, Blob): ~$50–200/month depending on usage
- Domain: $12/year
- Stripe: 2.9% + $0.30 per transaction

### Variable Cost Per Paying Customer

- OpenAI tokens (embeddings + chat + drafted comms): $10–30/month per active tenant
- Twilio SMS: pass through to customer or built into subscription (~$0.008/SMS)
- Twilio phone numbers: $1/mo per tenant
- Storage: negligible

### Rough Margin Math

- Starter $99/mo: ~$60–75 gross margin
- Growth $299/mo: ~$220–260 gross margin
- 20 paying customers at $200 avg = $4,000 MRR ≈ $3,000 gross margin/mo

This is being built full-time now, not as a side project weighed against Exelon income — so the "how many customers to justify quitting" framing that was here previously no longer applies. What matters now is straightforwardly: time to meaningful, sustainable revenue.

---

## Part 5 — Strategic Anchors

### The Discipline: Helio Is the Testbed, Not the Customer

Helio's dogfooding use still drives what gets built and validated, but its 3 lined-up deals are permanently decoupled from platform progress — they're never the thing a phase's success criteria depends on. Every feature still has to answer: "would another service business also need this?" If the answer is "no, this is solar-specific," it belongs in vertical config, not core code.

### The Discipline: Niche-Agnostic Core

If you find yourself writing `if (business.vertical === 'solar')` in a controller, stop — that logic belongs in configuration. Worth naming plainly: this already went wrong once, more subtly than a conditional — a hardcoded, unconditional solar prompt sat in the core RAG service until Phase 2's audit caught it. The lesson isn't "don't write vertical conditionals," it's "actively check for vertical assumptions creeping into shared code," because the violation won't always look like the thing you were watching for.

### The Discipline: Validate Before You Scale

Phase 8 (talk to non-Helio prospects) is not optional. Skipping it means Phase 9 (vertical templating) is speculative work.

### Kill Switches

Removed as of 2026-09-10. Platform continuation is not tied to Helio's business outcome. If the SaaS ambition ultimately doesn't work out, that's evaluated on its own evidence when it comes up — not pre-wired to specific Helio milestones.

---

## Part 6 — What Success Looks Like at Each Horizon

**Month 1:** Multi-tenancy + multi-staff formalized and verified with real cross-tenant tests. (No longer: "Helio's 3 deals onboarded" — that's off the table permanently.)

**Month 3:** Core CRM built and validated through Helio's dogfooding use. Communication layer (SMS + email) in progress.

**Month 6:** Automation engine live. Started talking to non-Helio prospects.

**Month 9:** Widget deployed on Helio's real site (a Helio-specific milestone, not a platform-readiness one). First pilot signed or close.

**Month 12:** Paying customers across at least one non-Helio vertical. Real MRR. Clear signal on whether the SaaS thesis holds.

---

## Part 7 — The Meta-Point

Most solo founders who try to build "GoHighLevel but better" fail because they:
1. Never actually use their own product (no dogfooding, no real signal)
2. Try to serve every vertical from day one (overwhelmed, generic)
3. Never talk to real customers before building (build in a vacuum)

This plan avoids all three by design — with one added lesson from Phase 2: **documentation drifting from the actual codebase is its own failure mode.** STATUS.md described a schema and tenancy model the code never actually had. That gap went unnoticed until an explicit code audit. Treat "does the doc match the repo" as a real, recurring check — not a one-time cleanup.
