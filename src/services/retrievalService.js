import { db as pool } from "../config/db.js";
/**
 * Retrieve the top N most similar chunks to a question embedding,
 * scoped to a single business's documents.
 */
export async function retrieveRelevantChunks(questionEmbedding, businessId, topN = 3) {
  const embeddingLiteral = `[${questionEmbedding.join(",")}]`;

  const { rows } = await pool.query(
    `SELECT id, document_id, content, embedding <=> $1 AS distance
     FROM embeddings
     WHERE user_id = $2
     ORDER BY embedding <=> $1
     LIMIT $3`,
    [embeddingLiteral, businessId, topN]
  );

  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    distance: row.distance,
  }));
}