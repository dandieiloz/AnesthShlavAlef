/**
 * Question generator for the scoring-drill mode.
 *
 * `generateScoreQuestion(score)` randomizes patient parameters and returns a
 * self-contained multiple-choice question (stem, findings, 4 options, a full
 * breakdown, and a result line). Pure — uses an injectable RNG so the
 * verification script can run it deterministically and the runner can call it
 * with Math.random for truly-random drills.
 */
import type {
  AdditiveScore,
  AnswerOption,
  Bilingual,
  BreakdownRow,
  ClassifyCategory,
  ClassifyScore,
  DecodeScore,
  Finding,
  GeneratedQuestion,
  NumericSample,
  ScoreOption,
  ScoreSystem,
} from "./types";
import { adjustCategory, findBand, totalRange } from "./engine";

export type RNG = () => number;

// ---------------------------------------------------------------------------
// Small RNG / bilingual helpers
// ---------------------------------------------------------------------------

function randInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: RNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: RNG, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bi(he: string, en: string): Bilingual {
  return { he, en };
}

function biNum(n: number): Bilingual {
  const s = String(n);
  return { he: s, en: s };
}

function sampleNumber(rng: RNG, spec: NumericSample): number {
  const { min, max, decimals = 0 } = spec;
  const raw = rng() * (max - min) + min;
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}

function joinBi(a: Bilingual, b: Bilingual, sep = " — "): Bilingual {
  return bi(`${a.he}${sep}${b.he}`, `${a.en}${sep}${b.en}`);
}

let optionCounter = 0;
function optId(): string {
  optionCounter += 1;
  return `o${optionCounter}`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function generateScoreQuestion(
  score: ScoreSystem,
  rng: RNG = Math.random,
): GeneratedQuestion {
  switch (score.kind) {
    case "additive":
      return genAdditive(score, rng);
    case "classify":
      return genClassify(score, rng);
    case "decode":
      return genDecode(score, rng);
  }
}

// ---------------------------------------------------------------------------
// Additive
// ---------------------------------------------------------------------------

function genAdditive(score: AdditiveScore, rng: RNG): GeneratedQuestion {
  const findings: Finding[] = [];
  const breakdown: BreakdownRow[] = [];
  const chosen: Record<string, ScoreOption> = {};
  let total = 0;

  for (const comp of score.components) {
    if (comp.derive) {
      const d = comp.derive({ rng, chosen });
      total += d.points;
      chosen[comp.id] = { value: d.value, points: d.points };
      findings.push({ label: comp.selfDescribing ? undefined : comp.label, text: d.shown });
      breakdown.push({ label: comp.label, value: d.value, points: d.points });
      continue;
    }
    const opt = pick(rng, comp.options);
    chosen[comp.id] = opt;
    total += opt.points;

    let shown: Bilingual = opt.value;
    if (opt.sample) {
      const v = sampleNumber(rng, opt.sample);
      const unit = opt.sample.unit;
      shown = unit ? bi(`${v} ${unit}`, `${v} ${unit}`) : biNum(v);
    }
    findings.push({ label: comp.selfDescribing ? undefined : comp.label, text: shown });
    breakdown.push({ label: comp.label, value: opt.value, points: opt.points });
  }

  const band = findBand(score.interpretation, total);
  const { min: lo, max: hi } = totalRange(score.components);
  const ask = pick(rng, score.ask);

  let stem: Bilingual;
  let options: AnswerOption[];

  if (ask === "band" && band) {
    stem = bi(
      `על פי הנתונים, מהי הקטגוריה לפי ${score.abbrev}?`,
      `Based on the findings, what is the ${score.abbrev} category?`,
    );
    options = buildBandOptions(rng, score.interpretation, band);
  } else {
    stem = bi(
      `על פי הנתונים, מהו ציון ${score.abbrev}?`,
      `Based on the findings, what is the ${score.abbrev} total?`,
    );
    options = buildNumericOptions(rng, total, lo, hi);
  }

  const result: Bilingual = band
    ? bi(
        `סך הכל ${total} → ${band.label.he}${band.detail ? ` (${band.detail.he})` : ""}`,
        `Total ${total} → ${band.label.en}${band.detail ? ` (${band.detail.en})` : ""}`,
      )
    : bi(`סך הכל: ${total}`, `Total: ${total}`);

  return {
    scoreId: score.id,
    questionKind: ask,
    stem,
    findings,
    options,
    breakdown,
    total,
    result,
  };
}

function buildNumericOptions(
  rng: RNG,
  correct: number,
  lo: number,
  hi: number,
): AnswerOption[] {
  const values = new Set<number>([correct]);
  for (const off of shuffle(rng, [1, -1, 2, -2, 3, -3])) {
    if (values.size >= 4) break;
    const v = correct + off;
    if (v >= lo && v <= hi) values.add(v);
  }
  // Tiny ranges: fill with any remaining in-range values.
  for (let v = lo; v <= hi && values.size < 4; v++) values.add(v);
  return shuffle(rng, [...values]).map((v) => ({
    id: optId(),
    label: biNum(v),
    correct: v === correct,
  }));
}

function buildBandOptions(
  rng: RNG,
  bands: AdditiveScore["interpretation"],
  correct: AdditiveScore["interpretation"][number],
): AnswerOption[] {
  const ci = bands.findIndex((b) => b === correct);
  const byDistance = [...bands].sort(
    (a, b) => Math.abs(bands.indexOf(a) - ci) - Math.abs(bands.indexOf(b) - ci),
  );
  const chosen = byDistance.slice(0, Math.min(4, bands.length));
  return shuffle(rng, chosen).map((b) => ({
    id: optId(),
    label: b.label,
    correct: b === correct,
  }));
}

// ---------------------------------------------------------------------------
// Classify
// ---------------------------------------------------------------------------

function genClassify(score: ClassifyScore, rng: RNG): GeneratedQuestion {
  const sorted = [...score.categories].sort((a, b) => a.order - b.order);
  const base = pick(rng, sorted);
  const presentation = pick(rng, base.presentations);

  const findings: Finding[] = [{ text: presentation }];
  const breakdown: BreakdownRow[] = [
    { label: bi("ממצאים קליניים", "Clinical presentation"), value: presentation },
  ];

  let final: ClassifyCategory = base;
  let note: Bilingual | undefined;

  if (score.adjust) {
    const isMostSevere = base.order === sorted[sorted.length - 1].order;
    const bump = !isMostSevere && rng() < 0.45;
    breakdown.push({ label: bi("דרגת בסיס", "Base grade"), value: base.label });
    if (bump) {
      const trigger = pick(rng, score.adjust.triggers);
      findings.push({ label: bi("מחלה נלווית", "Comorbidity"), text: trigger.finding });
      final = adjustCategory(sorted, base.id, 1);
      breakdown.push({
        label: bi("התאמה (מחלה נלווית)", "Adjustment (comorbidity)"),
        value: joinBi(trigger.finding, bi("דרגה אחת למעלה", "advance one grade")),
      });
      note = score.adjust.note;
    } else {
      findings.push({
        label: bi("מחלות נלוות", "Comorbidities"),
        text: bi("אין מחלה סיסטמית משמעותית", "No significant systemic disease"),
      });
    }
    breakdown.push({ label: bi("דרגה סופית", "Final grade"), value: final.label });
  } else {
    breakdown.push({ label: bi("דרגה", "Grade"), value: final.label });
  }

  const options = buildCategoryOptions(rng, sorted, final);
  const stem = bi(
    `על פי התיאור, מהי הדרגה לפי ${score.abbrev}?`,
    `Based on the description, what is the ${score.abbrev} grade?`,
  );
  const result: Bilingual = final.detail
    ? joinBi(final.label, final.detail)
    : final.label;

  return {
    scoreId: score.id,
    questionKind: "classify",
    stem,
    findings,
    options,
    breakdown,
    result,
    note,
  };
}

function buildCategoryOptions(
  rng: RNG,
  sorted: ClassifyCategory[],
  correct: ClassifyCategory,
): AnswerOption[] {
  const ci = sorted.findIndex((c) => c.id === correct.id);
  const byDistance = [...sorted].sort(
    (a, b) =>
      Math.abs(sorted.indexOf(a) - ci) - Math.abs(sorted.indexOf(b) - ci),
  );
  const chosen = byDistance.slice(0, Math.min(4, sorted.length));
  return shuffle(rng, chosen).map((c) => ({
    id: optId(),
    label: c.label,
    correct: c.id === correct.id,
  }));
}

// ---------------------------------------------------------------------------
// Decode (nomenclature)
// ---------------------------------------------------------------------------

function genDecode(score: DecodeScore, rng: RNG): GeneratedQuestion {
  const ask = pick(rng, score.ask);
  return ask === "decodeCode"
    ? genDecodeCode(score, rng)
    : genDecodeMeaning(score, rng);
}

function genDecodeMeaning(score: DecodeScore, rng: RNG): GeneratedQuestion {
  const code = pick(rng, score.sampleCodes);
  const posIdx = randInt(rng, 0, code.length - 1);
  const position = score.positions[posIdx];
  const letter = code[posIdx];
  const correct = position.letters.find((l) => l.code === letter);
  if (!correct) {
    throw new Error(`decode: code ${code} letter ${letter} invalid for position ${position.index}`);
  }

  // Distractors: other meanings in the same position first, then from other positions.
  const samePosition = position.letters.filter((l) => l.code !== letter);
  const otherPositions = score.positions
    .filter((p) => p.index !== position.index)
    .flatMap((p) => p.letters);
  const pool = dedupeMeanings([...samePosition, ...otherPositions], correct.meaning.en);
  const distractors = shuffle(rng, pool).slice(0, 3);

  const options = shuffle(rng, [correct.meaning, ...distractors.map((d) => d.meaning)]).map(
    (m) => ({ id: optId(), label: m, correct: m.en === correct.meaning.en }),
  );

  const stem = bi(
    `בקוצב עם הקוד "${code}", מה משמעות האות "${letter}" (מיקום ${position.index} — ${position.name.he})?`,
    `In a pacemaker coded "${code}", what does the letter "${letter}" mean (position ${position.index} — ${position.name.en})?`,
  );
  const findings: Finding[] = [
    { label: bi("קוד הקוצב", "Pacemaker code"), text: bi(code, code) },
    { label: bi("מיקום נבדק", "Position asked"), text: bi(`${position.index} — ${position.name.he}`, `${position.index} — ${position.name.en}`) },
  ];
  const breakdown: BreakdownRow[] = score.positions.slice(0, code.length).map((p, i) => {
    const l = p.letters.find((x) => x.code === code[i]);
    return {
      label: bi(`מיקום ${p.index} — ${p.name.he}`, `Position ${p.index} — ${p.name.en}`),
      value: l ? joinBi(bi(l.code, l.code), l.meaning, ": ") : bi(code[i], code[i]),
    };
  });

  return {
    scoreId: score.id,
    questionKind: "decodeMeaning",
    stem,
    findings,
    options,
    breakdown,
    result: joinBi(bi(letter, letter), correct.meaning, ": "),
  };
}

function genDecodeCode(score: DecodeScore, rng: RNG): GeneratedQuestion {
  // Build a 3-letter code (the common NBG length) from valid letters per position.
  const len = 3;
  const chosen = score.positions.slice(0, len).map((p) => pick(rng, p.letters));
  const code = chosen.map((l) => l.code).join("");

  const findings: Finding[] = chosen.map((l, i) => ({
    label: score.positions[i].name,
    text: l.meaning,
  }));

  // Distractors: vary one position to another valid letter, keep unique, ≠ correct.
  const candidates = new Set<string>();
  for (let i = 0; i < len; i++) {
    for (const alt of score.positions[i].letters) {
      if (alt.code === chosen[i].code) continue;
      const variant = chosen.map((c, j) => (j === i ? alt.code : c.code)).join("");
      if (variant !== code) candidates.add(variant);
    }
  }
  const distractors = shuffle(rng, [...candidates]).slice(0, 3);

  const options = shuffle(rng, [code, ...distractors]).map((c) => ({
    id: optId(),
    label: bi(c, c),
    correct: c === code,
  }));

  const breakdown: BreakdownRow[] = chosen.map((l, i) => ({
    label: bi(`מיקום ${score.positions[i].index} — ${score.positions[i].name.he}`, `Position ${score.positions[i].index} — ${score.positions[i].name.en}`),
    value: joinBi(bi(l.code, l.code), l.meaning, ": "),
  }));

  const stem = bi(
    "איזה קוד קוצב מתאים לתצורה הבאה?",
    "Which pacemaker code matches the following configuration?",
  );

  return {
    scoreId: score.id,
    questionKind: "decodeCode",
    stem,
    findings,
    options,
    breakdown,
    result: bi(code, code),
  };
}

function dedupeMeanings<T extends { meaning: Bilingual }>(
  letters: T[],
  excludeEn: string,
): T[] {
  const seen = new Set<string>([excludeEn]);
  const out: T[] = [];
  for (const l of letters) {
    if (seen.has(l.meaning.en)) continue;
    seen.add(l.meaning.en);
    out.push(l);
  }
  return out;
}
