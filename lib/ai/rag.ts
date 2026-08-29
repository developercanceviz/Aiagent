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

/** Item types RAG can be narrowed to (mirrors Prisma's KbType). */
export type RetrieveType = "FAQ" | "DOCUMENT" | "PRODUCT" | "POLICY" | "CORRECTION";

export async function embed(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  if (!vec) throw new Error("Embeddings response missing vector");
  return vec;
}

/**
 * Embed many texts in ONE API call (the endpoint accepts an array input).
 * Per-item calls at ~1.7s each blew the 60s function budget on a 112-product
 * sync; batching collapses a page of 50 into a single request.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!isConfigured.embeddings()) {
    throw new Error("EMBEDDINGS_PROVIDER_KEY not set");
  }
  if (texts.length === 0) return [];
  const res = await fetch(`${EMBED_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.embeddingsKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts.map((t) => t.slice(0, 8000)),
    }),
  });
  if (!res.ok) {
    throw new Error(`Embeddings HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  // The API documents order-matching, but sort by index to be safe.
  const out: number[][] = new Array(texts.length);
  for (const d of json.data) out[d.index] = d.embedding;
  return out;
}

/**
 * Cosine-similarity retrieval over the tenant's knowledge items. Returns [] if
 * RAG isn't configured (so the agent simply runs without grounding context).
 */
export async function retrieve(
  merchantId: string,
  query: string,
  opts?: {
    limit?: number;
    /** Restrict to these item types (e.g. only reviewed CORRECTIONs). */
    types?: RetrieveType[];
    /** Drop anything below this cosine similarity. */
    minScore?: number;
    /** Skip these types (e.g. keep corrections out of the general context). */
    excludeTypes?: RetrieveType[];
  }
): Promise<RetrievedChunk[]> {
  if (!isConfigured.embeddings() || !isConfigured.database()) return [];

  const vector = await embed(query);
  const literal = `[${vector.join(",")}]`;
  const limit = opts?.limit ?? 5;

  const params: unknown[] = [literal, merchantId, limit];
  let filter = "";
  if (opts?.types?.length) {
    params.push(opts.types);
    filter += ` AND type::text = ANY($${params.length}::text[])`;
  }
  if (opts?.excludeTypes?.length) {
    params.push(opts.excludeTypes);
    filter += ` AND NOT (type::text = ANY($${params.length}::text[]))`;
  }

  const rows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
    `SELECT id, title, content,
            1 - (embedding <=> $1::vector) AS score
       FROM "knowledge_items"
      WHERE "merchantId" = $2 AND embedding IS NOT NULL${filter}
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
    ...params
  );
  return opts?.minScore ? rows.filter((r) => r.score >= opts.minScore!) : rows;
}
