import { AzureOpenAI } from "openai";
import "dotenv/config";

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION
});

const EMBEDDING_MODEL = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;

export async function generateEmbedding(text) {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(texts) {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts
  });
  return response.data.map(item => item.embedding);
}