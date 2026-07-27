import { prisma } from "@/lib/db/client";
import { env, isConfigured } from "@/lib/config/env";

/**
 * RAG: embed + retrieve over KnowledgeItem using pgvector cosine distance.
 * Embeddings are produced via an OpenAI-compatible endpoint (text-embedding-3-
 * small, 1536 dims by default), configurable so the provider stays swappable.
 * Retrieval is always tenant-scoped.
 */

const EMBED_MODEL = process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";
const EMBED_BASE_URL =
  process.env.EMBEDDINGS_BASE_URL ?? "https://api.openai.com/v1";
export const EMBED_DIM = 1536;

export interface RetrievedChunk {
  id: string;
  title: string;
  content: string;
  score: number;
}

export async function embed(text: string): Promise<number[]> {
  if (!isConfigured.embeddings()) {
    throw new Error("EMBEDDINGS_PROVIDER_KEY not set");
  }
  const res = await fetch(`${EMBED_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.embeddingsKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
  });
  if (!res.ok) {
    throw new Error(`Embeddings HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  const vec = json.data[0]?.embedding;
  if (!vec) throw new Error("Embeddings response missing vector");
  return vec;
}

/**
 * Cosine-similarity retrieval over the tenant's knowledge items. Returns [] if
 * RAG isn't configured (so the agent simply runs without grounding context).
 */
export async function retrieve(
  merchantId: string,
  query: string,
  opts?: { limit?: number }
): Promise<RetrievedChunk[]> {
  if (!isConfigured.embeddings() || !isConfigured.database()) return [];

  const vector = await embed(query);
  const literal = `[${vector.join(",")}]`;
  const limit = opts?.limit ?? 5;

  const rows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
    `SELECT id, title, content,
            1 - (embedding <=> $1::vector) AS score
       FROM "knowledge_items"
      WHERE "merchantId" = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
    literal,
    merchantId,
    limit
  );
  return rows;
}
