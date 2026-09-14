import { createRequire } from "module";
import { db } from "../config/db.js";
import { chunkText } from "../utils/chunkText.js";
import { generateEmbeddings } from "./embeddingService.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export async function processDocument(documentId, businessId, userId, pdfBuffer) {
  const pdfData = await pdfParse(pdfBuffer);
  const rawText = pdfData.text;

  if (!rawText || rawText.trim().length === 0) {
    throw new Error("PDF contains no extractable text");
  }

  const chunks = chunkText(rawText);

  if (chunks.length === 0) {
    throw new Error("Text chunking produced no chunks");
  }

  const embeddings = await generateEmbeddings(chunks);

  const insertPromises = chunks.map((content, i) => {
    return db.query(
      `INSERT INTO embeddings (document_id, business_id, user_id, content, embedding)
       VALUES ($1, $2, $3, $4, $5::vector)`,
      [documentId, businessId, userId, content, `[${embeddings[i].join(",")}]`]
    );
  });

  await Promise.all(insertPromises);

  return {
    chunksProcessed: chunks.length,
    pdfPages: pdfData.numpages
  };
}