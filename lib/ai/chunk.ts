/**
 * Split a document into embedding-sized chunks.
 *
 * Retrieval quality depends on chunks being topically coherent, so we split on
 * paragraph boundaries first and only fall back to hard slicing when a single
 * paragraph is longer than the target. Consecutive short paragraphs are packed
 * together — a lone "Kargo" heading embeds into noise on its own.
 */
export interface Chunk {
  index: number;
  text: string;
}

const TARGET = 1200; // characters — ~300 tokens, comfortable for retrieval
const OVERLAP = 150; // carry-over so answers spanning a boundary still match

export function chunkText(raw: string, target = TARGET): Chunk[] {
  const clean = raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > target) {
      flush();
      // Oversized paragraph: slice with overlap so no sentence is orphaned.
      for (let i = 0; i < paragraph.length; i += target - OVERLAP) {
        chunks.push(paragraph.slice(i, i + target).trim());
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > target) flush();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();

  return chunks.map((text, index) => ({ index, text }));
}
