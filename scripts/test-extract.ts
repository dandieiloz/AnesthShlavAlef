import { extractStructuredChunks } from "./lib/pdf-extract";
import { readFile } from "node:fs/promises";

async function main() {
  const file = process.argv[2] ?? "textbook/Ch 22 - Opioids.pdf";
  const needle = (process.argv[3] ?? "bactericidal").toLowerCase();
  const buf = await readFile(file);
  const data = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const t = Date.now();
  const chunks = await extractStructuredChunks(data);
  console.log(`file: ${file}`);
  console.log(`elapsed: ${((Date.now() - t) / 1000).toFixed(2)}s`);
  console.log(`chunks: ${chunks.length}`);
  console.log(`sections: ${new Set(chunks.map((c) => c.sectionPath).filter(Boolean)).size}`);
  console.log(`tokens total: ${chunks.reduce((s, c) => s + c.tokenCount, 0)}`);
  const lengths = chunks.map((c) => c.text.length).sort((a, b) => a - b);
  if (lengths.length) {
    const median = lengths[Math.floor(lengths.length / 2)];
    console.log(`chunk length p50/p95/max: ${median}/${lengths[Math.floor(lengths.length * 0.95)]}/${lengths[lengths.length - 1]}`);
  }

  const kp = chunks.filter((c) => c.sectionPath?.toLowerCase().includes("key points"));
  console.log(`KEY POINTS chunks: ${kp.length}`);
  if (kp[0]) console.log("  first KP preview:", kp[0].text.slice(0, 200));

  const refs = chunks.filter((c) => c.sectionPath?.toLowerCase().includes("references"));
  console.log(`References chunks (should be 0): ${refs.length}`);

  const caps = chunks.filter((c) => /^(FIGURE|TABLE|FIG\.)\s+\d/i.test(c.text.slice(0, 30)));
  console.log(`Caption-leading chunks: ${caps.length}`);

  const mojibake = chunks.filter((c) => /[\uE000-\uF8FF\u144F]/.test(c.text));
  console.log(`PUA/mojibake chunks: ${mojibake.length}`);

  const matches = chunks.filter((c) => c.text.toLowerCase().includes(needle));
  console.log(`\n--- "${needle}" matches: ${matches.length} ---`);
  for (const c of matches) {
    console.log(`\n[ord=${c.ord} pages ${c.pageStart}-${c.pageEnd}] section: ${c.sectionPath}`);
    console.log(c.text);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
