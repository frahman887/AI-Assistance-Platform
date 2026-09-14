import { createLead } from "../services/leadService.js";
import { getBusinessBySlug } from "../services/businessService.js";

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

    const business = await getBusinessBySlug(businessSlug);

    if (!business) {
      return res.status(404).json({ error: "Unknown business." });
    }

    const lead = await createLead(business.id, { name, email, message });
    return res.status(201).json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error("Error in /leads:", err);
    return res.status(500).json({ error: "Something went wrong saving your info." });
  }
}