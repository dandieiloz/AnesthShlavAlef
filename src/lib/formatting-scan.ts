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
