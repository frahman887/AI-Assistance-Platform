const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

export function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap || DEFAULT_OVERLAP;

  if (!text || typeof text !== "string") {
    return [];
  }

  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length === 0) {
    return [];
  }

  const words = cleaned.split(" ");

  if (words.length <= chunkSize) {
    return [cleaned];
  }

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(" ");
    chunks.push(chunk);

    if (end === words.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}