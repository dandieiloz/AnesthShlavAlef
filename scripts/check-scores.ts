/**
 * Verification harness for the scoring-drill generators.
 *
 * For every registered score we generate many questions with a seeded RNG and
 * assert the core invariants: exactly one correct option, unique bilingual
 * option labels, a sane option count, and that the revealed result actually
 * matches the option marked correct. Additive scores additionally re-sum their
 * breakdown and check numeric options stay in range.
 *
 * Run with: npm run check:scores
 */
import { SCORE_SYSTEMS } from "../src/lib/scores/registry";
import { generateScoreQuestion, type RNG } from "../src/lib/scores/generate";
import { findBand, totalRange } from "../src/lib/scores/engine";

const SAMPLES = 500;

function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

let failures = 0;
function fail(scoreId: string, msg: string, extra?: unknown): void {
  failures += 1;
  const detail = extra !== undefined ? ` ${JSON.stringify(extra)}` : "";
  console.error(`\u2717 [${scoreId}] ${msg}${detail}`);
}

for (const score of SCORE_SYSTEMS) {
  const rng = mulberry32(0x9e3779b9 ^ hashId(score.id));
  const range = score.kind === "additive" ? totalRange(score.components) : null;

  for (let i = 0; i < SAMPLES; i++) {
    let q;
    try {
      q = generateScoreQuestion(score, rng);
    } catch (e) {
      fail(score.id, `generator threw: ${(e as Error).message}`);
      continue;
    }

    if (q.options.length < 2 || q.options.length > 4) {
      fail(score.id, `bad option count ${q.options.length}`);
    }

    const correct = q.options.filter((o) => o.correct);
    if (correct.length !== 1) {
      fail(score.id, `expected exactly one correct option, got ${correct.length}`, q.options);
      continue;
    }
    const c = correct[0];

    const enLabels = q.options.map((o) => o.label.en);
    if (new Set(enLabels).size !== enLabels.length) {
      fail(score.id, "duplicate option labels", enLabels);
    }
    for (const o of q.options) {
      if (!o.label.he || !o.label.en) fail(score.id, "option missing bilingual label", o);
    }
    if (!q.stem.he || !q.stem.en) fail(score.id, "stem missing bilingual text", q.stem);

    if (!q.result.en.includes(c.label.en)) {
      fail(score.id, `result "${q.result.en}" does not match correct option "${c.label.en}"`);
    }

    if (score.kind === "additive") {
      if (typeof q.total !== "number") {
        fail(score.id, "additive question missing total");
        continue;
      }
      const sum = q.breakdown.reduce(
        (s, r) => s + (typeof r.points === "number" ? r.points : 0),
        0,
      );
      if (sum !== q.total) fail(score.id, `breakdown sum ${sum} != total ${q.total}`);

      if (q.questionKind === "total") {
        if (Number(c.label.en) !== q.total) {
          fail(score.id, `correct numeric "${c.label.en}" != total ${q.total}`);
        }
        for (const o of q.options) {
          const v = Number(o.label.en);
          if (!Number.isFinite(v)) fail(score.id, `non-numeric option "${o.label.en}"`);
          else if (range && (v < range.min || v > range.max)) {
            fail(score.id, `option ${v} out of range [${range.min}, ${range.max}]`);
          }
        }
      } else if (q.questionKind === "band") {
        const band = findBand(score.interpretation, q.total);
        if (!band) fail(score.id, `no band for total ${q.total}`);
        else if (c.label.en !== band.label.en) {
          fail(score.id, `band correct "${c.label.en}" != "${band.label.en}"`);
        }
      } else {
        fail(score.id, `unexpected additive questionKind ${q.questionKind}`);
      }
    } else if (score.kind === "classify") {
      if (q.questionKind !== "classify") fail(score.id, `classify wrong kind ${q.questionKind}`);
      const catLabels = new Set(score.categories.map((cat) => cat.label.en));
      if (!catLabels.has(c.label.en)) {
        fail(score.id, `classify correct "${c.label.en}" is not a category label`);
      }
    } else if (score.kind === "decode") {
      if (q.questionKind !== "decodeMeaning" && q.questionKind !== "decodeCode") {
        fail(score.id, `decode wrong kind ${q.questionKind}`);
      }
    }
  }
}

const total = SCORE_SYSTEMS.length * SAMPLES;
if (failures > 0) {
  console.error(`\n${failures} failure(s) across ${SCORE_SYSTEMS.length} scores (${SAMPLES} samples each).`);
  process.exit(1);
} else {
  console.log(
    `\u2713 All ${SCORE_SYSTEMS.length} scores passed ${SAMPLES} random samples each (${total} questions).`,
  );
}
