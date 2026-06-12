/**
 * Type definitions for the clinical scoring-drill mode.
 *
 * Each score is encoded as declarative, bilingual data. Questions are generated
 * at runtime from random patient parameters — there are no question rows in the
 * database. The same pure-TS modules run on the client (the runner) and in the
 * verification script (scripts/check-scores.ts).
 *
 * Per-score clinical content (names, labels, interpretation, Miller citation)
 * lives in the definitions/ folder. Only generic UI chrome lives in i18n.ts.
 */

export type ContentLocale = "he" | "en";

export interface Bilingual {
  he: string;
  en: string;
}

/** Self-rated confidence for a score. Mirrors the Prisma `ConfidenceLevel` enum. */
export type ConfidenceLevel = "CONFIDENT" | "OK" | "WEAK";

export type ScoreCategoryId =
  | "ponvPacu"
  | "sleepAirway"
  | "cardiacPeriop"
  | "pulmonary"
  | "neuro"
  | "renal"
  | "hepatic"
  | "obstetric";

export interface ScoreCategory {
  id: ScoreCategoryId;
  label: Bilingual;
  order: number;
}

/** A reference to a Miller's Anesthesia chapter, used for citations. */
export interface MillerRef {
  chapter: number;
  title: Bilingual;
}

export interface MillerCitation {
  primary: MillerRef;
  also?: MillerRef[];
}

// ---------------------------------------------------------------------------
// Additive scores (sum of component points)
// ---------------------------------------------------------------------------

/**
 * When present on an option, the generator samples a concrete number in
 * [min, max] and shows it in the findings (e.g. "Bilirubin: 2.4 mg/dL"),
 * while the breakdown still shows the band label + points. The sample range
 * must lie inside the band the option represents.
 */
export interface NumericSample {
  min: number;
  max: number;
  decimals?: number; // default 0
  unit?: string;
}

export interface ScoreOption {
  /** Value label shown in findings + breakdown, e.g. "Yes", "51–80 years". */
  value: Bilingual;
  points: number;
  sample?: NumericSample;
}

export interface ScoreComponent {
  id: string;
  /** Component name, e.g. "Age", "Female sex". */
  label: Bilingual;
  options: ScoreOption[];
  /**
   * When true, the option value is a complete phrase (e.g. "Woman" / "Man")
   * and the finding is shown without the label prefix.
   */
  selfDescribing?: boolean;
  /**
   * Optional coupling hook: derive this component's chosen option from the RNG
   * and the options already picked for earlier components (which must appear
   * before it in `components`). Used e.g. for STOP-BANG, where the neck-
   * circumference threshold depends on the patient's sex. The returned `points`
   * must equal one of `options`' points so the total / breakdown stay valid.
   */
  derive?: (ctx: DeriveContext) => DerivedComponent;
}

/** Context passed to a component's `derive` hook during generation. */
export interface DeriveContext {
  rng: () => number;
  /** Options already chosen for earlier components, keyed by component id. */
  chosen: Record<string, ScoreOption>;
}

/** Result of a component's `derive` hook. */
export interface DerivedComponent {
  /** Must equal one of the component's option points. */
  points: number;
  /** Concrete finding text shown in the question, e.g. "44 cm" (no threshold hint). */
  shown: Bilingual;
  /** Value label for the breakdown + rubric; equal one option's value to highlight it. */
  value: Bilingual;
}

export interface InterpretationBand {
  /** Inclusive total range. */
  min: number;
  max: number;
  label: Bilingual; // e.g. "Class A", "Low risk"
  detail?: Bilingual; // e.g. "~10% PONV risk", "5–6 points"
}

export type AdditiveAsk = "total" | "band";

export interface AdditiveScore extends ScoreBase {
  kind: "additive";
  components: ScoreComponent[];
  interpretation: InterpretationBand[];
  ask: AdditiveAsk[];
}

// ---------------------------------------------------------------------------
// Classify scores (map a presentation to a category/grade/stage)
// ---------------------------------------------------------------------------

export interface ClassifyCategory {
  id: string;
  label: Bilingual; // e.g. "Grade II", "Injury"
  /** Severity order; ascending = less severe → more severe. */
  order: number;
  /** Distinct clinical presentations; one is sampled as the vignette. */
  presentations: Bilingual[];
  detail?: Bilingual;
}

/**
 * Optional multi-parameter reference grid for a classify score (e.g. Miller
 * tables 33.4 / 33.5). When present, the explanation renders this as a table —
 * parameters as columns, one row per category — instead of the `·`-packed
 * per-category detail text. Each row links to a category id for highlighting.
 */
export interface ScaleTableRow {
  /** Matches a ClassifyCategory.id; that row is highlighted when active. */
  categoryId: string;
  /** Cell values, one per column in `ScaleTable.columns`. */
  cells: Bilingual[];
}

export interface ScaleTable {
  /** Column headers (the parameters), e.g. Vmax, Mean gradient, AVA. */
  columns: Bilingual[];
  /** Rows in display order; each maps to a category and its cell values. */
  rows: ScaleTableRow[];
}

export interface ClassifyTrigger {
  label: Bilingual; // e.g. "Diabetes"
  finding: Bilingual; // e.g. "Known diabetes mellitus"
}

export interface ClassifyAdjust {
  /** Each trigger, if present, advances one step toward the most-severe category. */
  triggers: ClassifyTrigger[];
  note: Bilingual; // the rule explanation, shown after answering
}

export interface ClassifyScore extends ScoreBase {
  kind: "classify";
  categories: ClassifyCategory[];
  adjust?: ClassifyAdjust;
  /** Optional reference grid rendered as a table in the explanation. */
  scaleTable?: ScaleTable;
}

// ---------------------------------------------------------------------------
// Decode scores (nomenclature, e.g. pacemaker NBG code)
// ---------------------------------------------------------------------------

export interface DecodeLetter {
  code: string; // "O", "A", "V", "D", "T", "I", "R"
  meaning: Bilingual;
}

export interface DecodePosition {
  index: number; // 1-based position
  name: Bilingual; // "Chamber Paced"
  letters: DecodeLetter[];
}

export type DecodeAsk = "decodeMeaning" | "decodeCode";

export interface DecodeScore extends ScoreBase {
  kind: "decode";
  positions: DecodePosition[];
  /** Real-world example codes used as scaffolding for generation. */
  sampleCodes: string[];
  ask: DecodeAsk[];
}

// ---------------------------------------------------------------------------
// Common base + union
// ---------------------------------------------------------------------------

export interface ScoreBase {
  id: string;
  abbrev: string; // "Apfel", "RCRI"
  name: Bilingual; // full name
  category: ScoreCategoryId;
  blurb: Bilingual; // one-line description for the picker
  miller: MillerCitation;
}

export type ScoreSystem = AdditiveScore | ClassifyScore | DecodeScore;

// ---------------------------------------------------------------------------
// Generated question
// ---------------------------------------------------------------------------

export type QuestionKind = AdditiveAsk | "classify" | DecodeAsk;

export interface Finding {
  label?: Bilingual; // e.g. "Age"
  text: Bilingual; // e.g. "63 years" or a full sentence
}

export interface AnswerOption {
  id: string;
  label: Bilingual;
  correct: boolean;
}

export interface BreakdownRow {
  label: Bilingual;
  value: Bilingual;
  points?: number;
}

export interface GeneratedQuestion {
  scoreId: string;
  questionKind: QuestionKind;
  stem: Bilingual;
  findings: Finding[];
  options: AnswerOption[];
  breakdown: BreakdownRow[];
  /** Total points for additive scores (for display). */
  total?: number;
  /** Result summary line, e.g. "Total 3 → Class A (5–6 points)". */
  result: Bilingual;
  /** Optional extra note (e.g. the adjust-rule explanation). */
  note?: Bilingual;
}
