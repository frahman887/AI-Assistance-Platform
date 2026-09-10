import { createLead } from "../services/leadService.js";
import { resolveBusinessId } from "../services/tenantService.js";

export async function captureLead(req, res) {
  try {
    const { businessSlug, name, email, message } = req.body;

    if (!businessSlug || typeof businessSlug !== "string") {
      return res.status(400).json({ error: "businessSlug is required." });
    }

    // Require at least one contact field — a totally empty lead isn't useful
    if (!name && !email) {
      return res.status(400).json({ error: "Provide at least a name or an email." });
    }

    const businessId = await resolveBusinessId(businessSlug);

    if (!businessId) {
      return res.status(404).json({ error: "Unknown business." });
    }

    const lead = await createLead(businessId, { name, email, message });
    return res.status(201).json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error("Error in /leads:", err);
    return res.status(500).json({ error: "Something went wrong saving your info." });
  }
}