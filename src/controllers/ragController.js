import { answerQuestion } from "../services/ragService.js";
import { resolveBusinessId } from "../services/tenantService.js";

export async function askQuestion(req, res) {
  try {
    const { question, businessSlug } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Question is required." });
    }

    if (!businessSlug || typeof businessSlug !== "string") {
      return res.status(400).json({ error: "businessSlug is required." });
    }

    const businessId = await resolveBusinessId(businessSlug);

    if (!businessId) {
      return res.status(404).json({ error: "Unknown business." });
    }

    const result = await answerQuestion(question.trim(), businessId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in /ask:", err);
    return res.status(500).json({ error: "Something went wrong answering your question." });
  }
}