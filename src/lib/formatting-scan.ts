// Deterministic formatting-issue detection for question/answer content.
//
// Pure, side-effect-free helpers shared by the admin "formatting issues" scanner
// (src/app/admin/formatting-issues). Detection rules are reliably testable in
// isolation; some rules carry a deterministic auto-fix, others are flagged for an
// optional Gemini-assisted rewrite or manual review.
//
// The flagship case (see the screenshot that motivated this feature) is a literal
// `\n` inside an evidence quote: the `n` after the backslash looks like a LaTeX
// command to ensureMathDelimiters(), which wraps the whole run in `$...$` and KaTeX
// then renders it as spaced-out italics with a red `\n`. LITERAL_ESCAPE catches and
// fixes exactly that.

export type IssueSeverity = "error" | "warning" | "info";
export type FixKind = "auto" | "gemini" | "manual";

export interface RuleDef {
  id: string;
  /** Hebrew label shown in the admin UI. */
  label: string;
  /** Hebrew one-line description of the problem. */
  description: string;
  severity: IssueSeverity;
  fixKind: FixKind;
  /** Number of distinct occurrences in the text (0 = clean). */
  count(text: string): number;
  /** Deterministic fix. Present only when fixKind === "auto". */
  autoFix?(text: string): string;
}

// --- Individual detectors -------------------------------------------------

// A backslash followed by n/t/r that is NOT continued by a lowercase letter is a
// JSON-escape artifact (a newline/tab that was double-escaped), not a real LaTeX
// command — real commands like \nabla, \neq, \theta, \times, \rho, \rightarrow all
// continue with lowercase letters. `\nGrade`, `\n `, `\t7`, `\r<hebrew>` are artifacts.
const LITERAL_ESCAPE_RE = /(?<!\\)\\[ntr](?![a-z])/g;

function fixLiteralEscapes(text: string): string {
  return text
    .replace(/(?<!\\)\\n(?![a-z])/g, "\n")
    .replace(/(?<!\\)\\t(?![a-z])/g, " ")
    .replace(/(?<!\\)\\r(?![a-z])/g, "");
}

// Real control characters (TAB 0x09, BACKSPACE 0x08, FORM FEED 0x0C) produced when
// a LaTeX command collides with a JSON string escape (\text -> \t, \beta -> \b,
// \frac -> \f). Mirrors scripts/find-corrupted-explanations.ts.
const CONTROL_CHAR_RE = /[\t\b\f]/g;

/** Strip fenced/inline code so math/brace counting ignores code samples. */
function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

function countUnbalancedMath(text: string): number {
  const noCode = stripCode(text).replace(/\$\$[\s\S]*?\$\$/g, "").replace(/\\\$/g, "");
  const dollars = (noCode.match(/\$/g) ?? []).length;
  return dollars % 2 === 1 ? 1 : 0;
}

function countUnbalancedBraces(text: string): number {
  const noCode = stripCode(text).replace(/\\[{}]/g, "");
  let open = 0;
  let unmatchedClose = 0;
  for (const ch of noCode) {
    if (ch === "{") open++;
    else if (ch === "}") {
      if (open > 0) open--;
      else unmatchedClose++;
    }
  }
  return open + unmatchedClose;
}

// Trailing whitespace on a line or a run of 3+ spaces (outside code).
const WHITESPACE_ARTIFACT_RE = /[ \t]+$|[ ]{3,}/gm;

function countWhitespaceArtifacts(text: string): number {
  const noCode = stripCode(text);
  return (noCode.match(WHITESPACE_ARTIFACT_RE) ?? []).length;
}

function fixWhitespaceArtifacts(text: string): string {
  // Preserve code spans/blocks untouched; only normalize prose segments.
  const segments = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // code segment
      return seg
        .split("\n")
        .map((line) => line.replace(/[ \t]+$/, "").replace(/ {3,}/g, " "))
        .join("\n");
    })
    .join("");
}

// Unicode subscript/superscript maps for unwrapping simple inline math like
// `$N_2O$` (chemical formulae) into plain text `N₂O`. The quiz stem and answer
// options are NOT KaTeX-rendered, so a `$...$` wrapper shows the literal `$`
// signs; converting to Unicode renders identically in both plain-text and KaTeX
// contexts.
const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇",
  "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ",
  p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};
const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷",
  "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ",
  k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ",
  v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
};

// Inline `$...$` (single-dollar, non-empty, single line). `$$display$$` excluded.
const INLINE_MATH_RE = /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g;

// Convert a simple inline-math body into plain Unicode text, or return null when
// it contains a LaTeX command or a sub/superscript char with no Unicode mapping —
// in which case the span is left untouched so real math is never garbled. Requires
// at least one sub/superscript so bare equations like `$5 = 3 + 2$` are left alone.
function convertSimpleMathBody(body: string): string | null {
  if (body.includes("\\")) return null; // real LaTeX command
  let out = "";
  let i = 0;
  let sawScript = false;
  while (i < body.length) {
    const c = body[i];
    if (c === "_" || c === "^") {
      const map = c === "_" ? SUBSCRIPT_MAP : SUPERSCRIPT_MAP;
      i++;
      let token: string;
      if (body[i] === "{") {
        const close = body.indexOf("}", i);
        if (close === -1) return null;
        token = body.slice(i + 1, close);
        i = close + 1;
      } else {
        token = body[i] ?? "";
        i++;
      }
      if (token.length === 0) return null;
      for (const ch of token) {
        const mapped = map[ch];
        if (!mapped) return null;
        out += mapped;
      }
      sawScript = true;
    } else if (/[A-Za-z0-9()., +\-=/]/.test(c)) {
      out += c;
      i++;
    } else {
      return null; // unexpected char → not a simple formula
    }
  }
  return sawScript ? out : null;
}

function countStrayInlineMath(text: string): number {
  const noCode = stripCode(text);
  let n = 0;
  for (const m of noCode.matchAll(INLINE_MATH_RE)) {
    if (convertSimpleMathBody(m[1]) != null) n++;
  }
  return n;
}

function fixStrayInlineMath(text: string): string {
  const segments = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return segments
    .map((seg, i) =>
      i % 2 === 1
        ? seg
        : seg.replace(INLINE_MATH_RE, (full, body: string) => {
            const conv = convertSimpleMathBody(body);
            return conv == null ? full : conv;
          }),
    )
    .join("");
}

// Split text into alternating prose / (code|math) segments. Odd indices are the
// captured code/math delimiters and must be left untouched.
function splitProseSegments(text: string): string[] {
  return text.split(/(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
}

// Citation markers like `[1, 2]`, `[2,1]`, `[1,2,3]` bundle several references in
// one bracket. injectCitationAnchors() in AnswerExplanation only linkifies a
// single-number bracket `[N]`, so the extra numbers stay plain text (one citation
// "not rendered"). Splitting into adjacent single brackets `[1][2]` lets the
// existing renderer linkify each one.
const MULTI_CITATION_RE = /\[\s*\d+(?:\s*,\s*\d+)+\s*\]/g;

function countMultiCitations(text: string): number {
  const segs = splitProseSegments(text);
  let n = 0;
  segs.forEach((seg, i) => {
    if (i % 2 === 1) return;
    n += (seg.match(MULTI_CITATION_RE) ?? []).length;
  });
  return n;
}

function fixMultiCitations(text: string): string {
  const segs = splitProseSegments(text);
  return segs
    .map((seg, i) =>
      i % 2 === 1
        ? seg
        : seg.replace(MULTI_CITATION_RE, (m) => {
            const nums = m.replace(/[[\]\s]/g, "").split(",").filter(Boolean);
            return nums.map((num) => `[${num}]`).join("");
          }),
    )
    .join("");
}

// --- Rule registry --------------------------------------------------------

export const RULES: RuleDef[] = [
  {
    id: "LITERAL_ESCAPE",
    label: "תווי בריחה מילוליים (\\n, \\t, \\r)",
    description:
      "רצף כמו \\n מופיע כטקסט גולמי במקום שורה חדשה, וגורם ל-KaTeX להציג את הטקסט כמתמטיקה נטויה עם \\n אדום.",
    severity: "error",
    fixKind: "auto",
    count: (text) => (text.match(LITERAL_ESCAPE_RE) ?? []).length,
    autoFix: fixLiteralEscapes,
  },
  {
    id: "CONTROL_CHAR",
    label: "תווי בקרה פגומים",
    description:
      "תווי בקרה (TAB/BACKSPACE/FORM-FEED) שנוצרו כשפקודת LaTeX התנגשה עם בריחת JSON (\\text→\\t, \\beta→\\b, \\frac→\\f).",
    severity: "error",
    fixKind: "gemini",
    count: (text) => (text.match(CONTROL_CHAR_RE) ?? []).length,
  },
  {
    id: "UNBALANCED_MATH",
    label: "תוחם מתמטיקה לא מאוזן ($)",
    description: "מספר אי-זוגי של תוחמי $ — נוסחה פתוחה שתשבור את הרינדור.",
    severity: "warning",
    fixKind: "gemini",
    count: countUnbalancedMath,
  },
  {
    id: "UNBALANCED_BRACES",
    label: "סוגריים מסולסלים לא מאוזנים ({ })",
    description: "מספר לא תואם של { ו-} — קבוצת LaTeX פתוחה שתשבור את הרינדור.",
    severity: "warning",
    fixKind: "gemini",
    count: countUnbalancedBraces,
  },
  {
    id: "STRAY_MATH_DELIMITER",
    label: "תוחמי $ מיותרים סביב נוסחה פשוטה",
    description:
      "ביטוי כמו $N_2O$ עטוף בתוחמי $; בשדות שאינם מרונדרים ב-KaTeX (כמו גוף השאלה והתשובות) מוצגים סימני ה-$ כפשוטם. התיקון ממיר ל-Unicode (למשל N₂O).",
    severity: "warning",
    fixKind: "auto",
    count: countStrayInlineMath,
    autoFix: fixStrayInlineMath,
  },
  {
    id: "MULTI_CITATION",
    label: "סימון ציטוט מרובה בסוגר אחד ([1, 2])",
    description:
      "סימון כמו [1, 2] או [2,1] אורז כמה הפניות בסוגר אחד; הרינדור מקשר רק סוגר עם מספר יחיד, ולכן רק ציטוט אחד הופך לקישור והשאר מוצגים כטקסט. התיקון מפצל ל-[1][2] כך שכל מספר יקושר בנפרד.",
    severity: "warning",
    fixKind: "auto",
    count: countMultiCitations,
    autoFix: fixMultiCitations,
  },
  {
    id: "WHITESPACE_ARTIFACT",
    label: "רווחים מיותרים",
    description: "רווחים בסוף שורה או רצף של 3+ רווחים.",
    severity: "info",
    fixKind: "auto",
    count: countWhitespaceArtifacts,
    autoFix: fixWhitespaceArtifacts,
  },
];

const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

// --- Public API -----------------------------------------------------------

export interface FieldIssue {
  ruleId: string;
  label: string;
  description: string;
  severity: IssueSeverity;
  fixKind: FixKind;
  count: number;
}

/** Detect all formatting issues present in a single text field. */
export function scanFieldText(text: string | null | undefined): FieldIssue[] {
  if (!text) return [];
  const issues: FieldIssue[] = [];
  for (const rule of RULES) {
    const count = rule.count(text);
    if (count > 0) {
      issues.push({
        ruleId: rule.id,
        label: rule.label,
        description: rule.description,
        severity: rule.severity,
        fixKind: rule.fixKind,
        count,
      });
    }
  }
  return issues;
}

/** True if any detected issue is deterministically auto-fixable. */
export function hasAutoFixableIssue(issues: FieldIssue[]): boolean {
  return issues.some((i) => i.fixKind === "auto");
}

/**
 * Apply every auto-fix rule (or a specified subset) to a text value.
 * Idempotent and deterministic — safe to re-run.
 */
export function autoFixText(text: string, ruleIds?: string[]): string {
  let out = text;
  for (const rule of RULES) {
    if (rule.fixKind !== "auto" || !rule.autoFix) continue;
    if (ruleIds && !ruleIds.includes(rule.id)) continue;
    out = rule.autoFix(out);
  }
  return out;
}

/** Extract a short context window around the first match of a rule, for previews. */
export function issueSnippet(text: string, ruleId: string, radius = 60): string {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) return "";
  const re =
    ruleId === "LITERAL_ESCAPE"
      ? new RegExp(LITERAL_ESCAPE_RE.source)
      : ruleId === "CONTROL_CHAR"
      ? new RegExp(CONTROL_CHAR_RE.source)
      : ruleId === "STRAY_MATH_DELIMITER"
      ? new RegExp(INLINE_MATH_RE.source)
      : ruleId === "MULTI_CITATION"
      ? new RegExp(MULTI_CITATION_RE.source)
      : ruleId === "WHITESPACE_ARTIFACT"
      ? new RegExp(WHITESPACE_ARTIFACT_RE.source, "m")
      : null;
  if (!re) return text.slice(0, radius * 2);
  const m = re.exec(text);
  if (!m) return text.slice(0, radius * 2);
  const start = Math.max(0, m.index - radius);
  const end = Math.min(text.length, m.index + m[0].length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
