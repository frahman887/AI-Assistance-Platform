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
 * Generic fallback prompt for a business that hasn't configured a vertical
 * yet (e.g. brand new signup, no vertical config applied). This is the ONE
 * place the core codebase's prompt should ever live — it must stay
 * industry-neutral. Anything industry-specific belongs in
 * businesses.settings.system_prompt, not here.
 *
 * The structural rules (context-only, no invented numbers, concise,
 * redirect off-topic) came from real tuning against Helio's content and
 * are worth keeping generic — only the industry framing sentence changes
 * per vertical.
 */
function buildFallbackPrompt(businessName) {
  return `You are a helpful, friendly assistant answering questions on behalf of ${businessName},
speaking directly to a potential customer on the company's website.

Rules:
1. Only answer using the information in the provided context below. Do not use outside knowledge.
2. If the context does not contain the answer, say so directly — for example: "I don't have that
   specific information, but I'd be happy to connect you with our team who can help." Do not guess,
   estimate, or make up numbers, prices, or timelines that aren't in the context.
3. Never invent specific figures (dollar amounts, percentages, dates) that are not explicitly
   stated in the context.
4. Keep answers conversational and concise — 2-4 sentences for most questions. This is a chat widget,
   not a document.
5. If a question is unrelated to this company or its services, politely redirect the conversation
   back to how you can help.
6. Do not mention "the context," "the document," or that you are an AI retrieving information —
   just answer naturally, the way a knowledgeable staff member would.`;
}

export async function answerQuestion(question, business) {
  const systemPrompt = business.settings?.system_prompt || buildFallbackPrompt(business.name);

  const questionEmbedding = await generateEmbedding(question);
  const chunks = await retrieveRelevantChunks(questionEmbedding, business.id, 3);

  const context = chunks.length
    ? chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n")
    : "No relevant documents were found.";

  const userPrompt = `Context:\n${context}\n\nQuestion: ${question}`;

  const completion = await chatClient.chat.completions.create({
    model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  });

  const answer = completion.choices[0].message.content;

  const retrievedChunkIds = chunks.map((c) => c.id);
  await pool.query(
    `INSERT INTO ai_logs (business_id, question, retrieved_chunk_ids, response)
     VALUES ($1, $2, $3, $4)`,
    [business.id, question, retrievedChunkIds, answer]
  );

  return {
    answer,
    sources: chunks.map((c) => ({
      documentId: c.documentId,
      snippet: c.content.slice(0, 150),
    })),
  };
}