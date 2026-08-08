import { NextRequest, NextResponse } from "next/server";

import { isConfigured } from "@/lib/config/env";
import { requireMerchantId } from "@/lib/auth/context";
import { chunkText } from "@/lib/ai/chunk";
import { embedBatch } from "@/lib/ai/rag";
import { upsertKnowledgeItem } from "@/lib/db/knowledge";

/**
 * Document → knowledge base ingestion (Bilgi Bankası "Dosya Yükle").
 *
 * Accepts .docx / .txt / .md, extracts plain text, splits it into retrieval
 * chunks and stores each as a KnowledgeItem with its embedding. Chunks are
 * keyed by `doc:<filename>#<n>` so re-uploading the same file updates in place
 * instead of duplicating the whole document in the index.
 *
 * Tenant comes from the verified session (cookie or ikas App Bridge token).
 */
export const maxDuration = 300;

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!isConfigured.database()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  if (!isConfigured.embeddings()) {
    return NextResponse.json(
      { error: "Embeddings not configured — set EMBEDDINGS_PROVIDER_KEY." },
      { status: 503 }
    );
  }

  const merchantId = await requireMerchantId(req);
  if (!merchantId) {
    return NextResponse.json({ error: "No store in session." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Dosya çok büyük (maks. 10 MB)." }, { status: 413 });
  }

  const name = file.name.replace(/[/\\]/g, "_");
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    if (ext === ".docx") {
      // Imported lazily: mammoth is only needed on this route.
      const mammoth = (await import("mammoth")).default;
      text = (await mammoth.extractRawText({ buffer })).value;
    } else if (ext === ".txt" || ext === ".md") {
      text = buffer.toString("utf8");
    } else if (ext === ".doc") {
      return NextResponse.json(
        { error: "Eski .doc biçimi desteklenmiyor — Word'de .docx olarak kaydedin." },
        { status: 415 }
      );
    } else {
      return NextResponse.json(
        { error: `Desteklenmeyen dosya türü: ${ext || "bilinmiyor"} (.docx, .txt, .md)` },
        { status: 415 }
      );
    }
  } catch (err) {
    console.error("[knowledge:upload] parse failed", err);
    return NextResponse.json({ error: "Dosya okunamadı." }, { status: 422 });
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return NextResponse.json({ error: "Dosyada metin bulunamadı." }, { status: 422 });
  }

  const baseTitle = name.replace(/\.[^.]+$/, "");

  // One embedding call per batch of chunks, then concurrent upserts — the same
  // shape that took the product sync from minutes to seconds.
  let stored = 0;
  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(
      batch.map((c) => `${baseTitle}\n${c.text}`)
    );
    await Promise.all(
      batch.map((chunk, j) =>
        upsertKnowledgeItem(
          {
            merchantId,
            type: "DOCUMENT",
            title:
              chunks.length > 1
                ? `${baseTitle} (${chunk.index + 1}/${chunks.length})`
                : baseTitle,
            content: chunk.text,
            sourceRef: `doc:${name}#${chunk.index}`,
          },
          vectors[j]
        )
      )
    );
    stored += batch.length;
  }

  return NextResponse.json({ ok: true, file: name, chunks: stored });
}
