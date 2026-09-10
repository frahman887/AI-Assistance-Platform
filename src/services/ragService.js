import OpenAI from "openai";
import { db as pool } from "../config/db.js";
import { generateEmbedding } from "./embeddingService.js";
import { retrieveRelevantChunks } from "./retrievalService.js";

const chatClient = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_CHAT_DEPLOYMENT}`,
  defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
});

/**
 * Tuned system prompt — starting point for Block 9's live tuning pass.
 * Changes from the Block 5 draft:
 *  - Explicit refusal instruction instead of just "say you don't know"
 *    (models tend to hedge-and-answer-anyway without a direct instruction)
 *  - Bans inventing numbers/prices — the single highest-risk hallucination
 *    for a solar sales widget
 *  - Sets response length/tone so answers feel like a knowledgeable rep,
 *    not a search engine dumping text
 *  - Explicitly allows citing which doc a fact came from when useful,
 *    without requiring it (keeps answers natural)
 */
const SYSTEM_PROMPT = `You are a helpful, friendly assistant answering questions on behalf of a solar
installation company, speaking directly to a potential customer on the company's website.

Rules:
1. Only answer using the information in the provided context below. Do not use outside knowledge
   about solar panels, pricing, incentives, or installation in general.
2. If the context does not contain the answer, say so directly — for example: "I don't have that
   specific information, but I'd be happy to connect you with our team who can help." Do not guess,
   estimate, or make up numbers, prices, or timelines that aren't in the context.
3. Never invent specific figures (dollar amounts, kWh, percentages, dates) that are not explicitly
   stated in the context.
4. Keep answers conversational and concise — 2-4 sentences for most questions. This is a chat widget,
   not a document.
5. If a question is unrelated to solar, this company, or its services, politely redirect the
   conversation back to how you can help with their solar questions.
6. Do not mention "the context," "the document," or that you are an AI retrieving information —
   just answer naturally, the way a knowledgeable staff member would.`;

export async function answerQuestion(question, businessId) {
  const questionEmbedding = await generateEmbedding(question);
  const chunks = await retrieveRelevantChunks(questionEmbedding, businessId, 3);

  const context = chunks.length
    ? chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n")
    : "No relevant documents were found.";

  const userPrompt = `Context:\n${context}\n\nQuestion: ${question}`;

  const completion = await chatClient.chat.completions.create({
    model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  });

  const answer = completion.choices[0].message.content;

  const retrievedChunkIds = chunks.map((c) => c.id);
  await pool.query(
    `INSERT INTO ai_logs (user_id, question, retrieved_chunk_ids, response)
     VALUES ($1, $2, $3, $4)`,
    [businessId, question, retrievedChunkIds, answer]
  );

  return {
    answer,
    sources: chunks.map((c) => ({
      documentId: c.documentId,
      snippet: c.content.slice(0, 150),
    })),
  };
}