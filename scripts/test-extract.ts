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

  // Phase 2 visibility: how many chunks contain TABLE/BOX/EQUATION mentions anywhere?
  // Tracks whether preserved tables/boxes are actually making it into the index.
  const tableMentions = chunks.filter((c) => /\bTABLE\s+\d/i.test(c.text)).length;
  const boxMentions = chunks.filter((c) => /\bBOX\s+\d/i.test(c.text)).length;
  const eqMentions = chunks.filter((c) => /\bEQUATION\s+\d/i.test(c.text)).length;
  const figureMentions = chunks.filter((c) => /\bFIG(?:URE)?\.?\s+\d/i.test(c.text)).length;
  console.log(`TABLE-mention chunks: ${tableMentions}  BOX: ${boxMentions}  EQUATION: ${eqMentions}  FIGURE: ${figureMentions}`);

  const mojibake = chunks.filter((c) => /[\uE000-\uF8FF\u144F]/.test(c.text));
  console.log(`PUA/mojibake chunks: ${mojibake.length}`);

  // The needle arg can be a comma-separated list to assert several substrings
  // co-occur somewhere in the index (e.g., "Brain tumor,peptic ulcer" for
  // Table 46.2). When a single token, behaves as before.
  const needles = needle.split(",").map((s) => s.trim()).filter(Boolean);
  if (needles.length > 1) {
    console.log(`\n--- co-occurrence check: ${needles.map((n) => `"${n}"`).join(" + ")} ---`);
    const both = chunks.filter((c) => {
      const lc = c.text.toLowerCase();
      return needles.every((n) => lc.includes(n));
    });
    console.log(`chunks containing all ${needles.length} needles: ${both.length}`);
    for (const c of both.slice(0, 3)) {
      console.log(`\n[ord=${c.ord} pages ${c.pageStart}-${c.pageEnd}] section: ${c.sectionPath}`);
      console.log(c.text.slice(0, 1200));
    }
  } else {
    const matches = chunks.filter((c) => c.text.toLowerCase().includes(needle));
    console.log(`\n--- "${needle}" matches: ${matches.length} ---`);
    for (const c of matches) {
      console.log(`\n[ord=${c.ord} pages ${c.pageStart}-${c.pageEnd}] section: ${c.sectionPath}`);
      console.log(c.text);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
