import { extractStructuredChunks } from "./lib/pdf-extract";
import { readFile } from "node:fs/promises";

async function main() {
  const file = process.argv[2] ?? "textbook/Ch 1 - The Scope of Modern Anesthetic Practice.pdf";
  const buf = await readFile(file);
  const data = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const t = Date.now();
  const chunks = await extractStructuredChunks(data);
  console.log(`file: ${file}`);
  console.log(`elapsed: ${((Date.now() - t) / 1000).toFixed(2)}s`);
  console.log(`total chunks: ${chunks.length}`);
  console.log(`distinct sections: ${new Set(chunks.map((c) => c.sectionPath).filter(Boolean)).size}`);
  console.log(`total tokens: ${chunks.reduce((s, c) => s + c.tokenCount, 0)}`);
  console.log(`page span: ${Math.min(...chunks.map((c) => c.pageStart))} - ${Math.max(...chunks.map((c) => c.pageEnd))}`);
  console.log(`heading-level distribution:`,
    chunks.reduce<Record<string, number>>((acc, c) => {
      const k = String(c.headingLevel ?? "null");
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}));
  console.log(`\nfirst 5 chunks:`);
  for (const c of chunks.slice(0, 5)) {
    console.log({
      ord: c.ord,
      pages: `${c.pageStart}-${c.pageEnd}`,
      level: c.headingLevel,
      section: c.sectionPath,
      tokens: c.tokenCount,
      preview: c.text.slice(0, 100),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
