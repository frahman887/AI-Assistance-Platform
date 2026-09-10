import "dotenv/config";
import pg from "pg";
import { BlobServiceClient } from "@azure/storage-blob";
import { AzureOpenAI } from "openai";

const results = [];

// 1. Postgres + pgvector
try {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const ext = await client.query(
    "SELECT extname FROM pg_extension WHERE extname = 'vector'"
  );
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  await client.end();

  if (ext.rows.length === 0) {
    results.push("FAIL Postgres: connected but pgvector extension is NOT installed");
  } else {
    const tableNames = tables.rows.map(r => r.tablename).join(", ");
    results.push(`PASS Postgres + pgvector OK (tables: ${tableNames})`);
  }
} catch (e) {
  results.push(`FAIL Postgres: ${e.message}`);
}

// 2. Azure OpenAI
try {
  const client = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION
  });

  const emb = await client.embeddings.create({
    model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    input: "hello world"
  });
  results.push(`PASS Azure OpenAI embeddings OK (dim: ${emb.data[0].embedding.length})`);

  const chat = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
    messages: [{ role: "user", content: "Reply with exactly: pong" }],
    max_tokens: 10
  });
  results.push(`PASS Azure OpenAI chat OK (reply: "${chat.choices[0].message.content.trim()}")`);
} catch (e) {
  results.push(`FAIL Azure OpenAI: ${e.message}`);
}

// 3. Azure Blob Storage
try {
  const blob = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  const container = blob.getContainerClient(process.env.AZURE_STORAGE_CONTAINER);
  await container.getProperties();
  results.push(`PASS Blob Storage container "${process.env.AZURE_STORAGE_CONTAINER}" reachable`);
} catch (e) {
  results.push(`FAIL Blob Storage: ${e.message}`);
}

console.log("\n=== Service Verification ===");
results.forEach(r => console.log(r));
console.log("");
process.exit(results.every(r => r.startsWith("PASS")) ? 0 : 1);