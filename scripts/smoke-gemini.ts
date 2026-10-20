/**
 * Live smoke test of the Gemini helpers (Interactions API): text, JSON with a
 * schema, and the wizard parser. Cheap — Flash only, nothing persisted.
 *
 *   npx tsx scripts/smoke-gemini.ts
 */
import "dotenv/config";
import { translateStemToEnglish } from "@/lib/rag/translate";
import { parseMultipleQuestions } from "@/lib/wizard";
import { rerankWithFlashJudge } from "@/lib/rag/rerank";

async function main() {
  const t0 = Date.now();
  const en = await translateStemToEnglish("מהו מנגנון הפעולה של סוגמדקס?");
  console.log(`[text] ${Date.now() - t0}ms →`, en);

  const t1 = Date.now();
  const qs = await parseMultipleQuestions(
    "1. מהי התרופה המועדפת לטיפול בהיפרתרמיה ממארת?\nא. דנטרולן\nב. פרופופול\nג. סוקצינילכולין\nד. אטרופין\n\n2. מהו ה-MAC של סבופלורן?\nא. 1.0%\nב. 2.0%\nג. 6.0%\nד. 0.5%",
  );
  console.log(`[json] ${Date.now() - t1}ms → ${qs.length} questions:`, qs.map((q) => q.optionA));

  const t2 = Date.now();
  const mk = (id: number, text: string) => ({ id, text, chapterId: 1, chapterNumber: 1, chapterTitle: "T", sectionPath: null, pageStart: null, pageEnd: null, vectorScore: 0 });
  const ranked = await rerankWithFlashJudge(
    "What is the treatment of malignant hyperthermia?\nA. Dantrolene\nB. Propofol",
    [mk(1, "Sevoflurane is a volatile anesthetic."), mk(2, "Dantrolene is the specific treatment for malignant hyperthermia."), mk(3, "The liver has three zones.")],
    2,
  );
  console.log(`[rerank] ${Date.now() - t2}ms →`, ranked.map((c) => `${c.id}:${c.rerankScore}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
