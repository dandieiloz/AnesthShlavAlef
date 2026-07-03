import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";
import { db } from "@/lib/db";
import { auth, isEmailBlocked } from "@/lib/auth";

type Choice = "A" | "B" | "C" | "D";

const HEBREW_LETTERS: Record<Choice, string> = { A: "א", B: "ב", C: "ג", D: "ד" };
const CHOICES: Choice[] = ["A", "B", "C", "D"];

type EvidenceCitation = {
  chapterNumber: number;
  chapterTitle: string;
  sectionPath: string | null;
  quote: string;
  pageStart?: number | null;
  pageEnd?: number | null;
};

// --- Best-effort math/markdown normalization -------------------------------

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅",
  "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋",
  "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ",
};
const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
  "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻",
  "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};
const SYMBOLS: Record<string, string> = {
  "\\times": "×", "\\cdot": "·", "\\div": "÷", "\\pm": "±", "\\mp": "∓",
  "\\le": "≤", "\\leq": "≤", "\\ge": "≥", "\\geq": "≥", "\\ne": "≠", "\\neq": "≠",
  "\\approx": "≈", "\\rightarrow": "→", "\\to": "→", "\\leftarrow": "←",
  "\\Rightarrow": "⇒", "\\uparrow": "↑", "\\downarrow": "↓", "\\infty": "∞",
  "\\degree": "°", "\\circ": "°", "\\percent": "%", "\\alpha": "α", "\\beta": "β",
  "\\gamma": "γ", "\\delta": "δ", "\\Delta": "Δ", "\\mu": "µ", "\\rho": "ρ",
  "\\sigma": "σ", "\\lambda": "λ", "\\pi": "π", "\\Omega": "Ω", "\\omega": "ω",
};

function convertScripts(text: string): string {
  // Subscripts: _{...} or _x
  text = text.replace(/_\{([^}]*)\}/g, (_, b: string) =>
    [...b].every((c) => c in SUBSCRIPTS) ? [...b].map((c) => SUBSCRIPTS[c]).join("") : `_${b}`,
  );
  text = text.replace(/_([A-Za-z0-9+\-=()])/g, (_, c: string) => SUBSCRIPTS[c] ?? `_${c}`);
  // Superscripts: ^{...} or ^x
  text = text.replace(/\^\{([^}]*)\}/g, (_, b: string) =>
    [...b].every((c) => c in SUPERSCRIPTS) ? [...b].map((c) => SUPERSCRIPTS[c]).join("") : `^${b}`,
  );
  text = text.replace(/\^([A-Za-z0-9+\-=()])/g, (_, c: string) => SUPERSCRIPTS[c] ?? `^${c}`);
  return text;
}

/** Best-effort conversion of inline/markdown content to readable plain text. */
function normalizeText(input: string): string {
  if (!input) return "";
  let text = input.replace(/\r\n/g, "\n");
  // Unwrap math regions ($$...$$ and $...$), normalizing their inner content.
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner: string) => normalizeMath(inner));
  text = text.replace(/\$([^$\n]+)\$/g, (_, inner: string) => normalizeMath(inner));
  // Strip markdown emphasis/code markers, keep the text.
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/(?<!\*)\*(?!\*)([^*\n]+)\*/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  // Markdown headings/list markers at line start -> plain.
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^[-*]\s+/gm, "• ");
  return text.trim();
}

function normalizeMath(inner: string): string {
  let s = inner;
  // \text{...}, \mathrm{...}, \mathbf{...} -> inner content
  s = s.replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^}]*)\}/g, "$1");
  // \frac{a}{b} -> a/b
  s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)");
  // Symbols
  for (const [tex, sym] of Object.entries(SYMBOLS)) {
    s = s.split(tex).join(sym);
  }
  s = convertScripts(s);
  // Drop leftover braces and remaining backslash commands.
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\\([A-Za-z]+)/g, "$1");
  s = s.replace(/\\/g, "");
  return s.replace(/\s+/g, " ").trim();
}

function parseWhyOthersWrong(raw: string): Partial<Record<Choice, string>> {
  const map: Partial<Record<Choice, string>> = {};
  const parts = (raw || "").replace(/\r\n/g, "\n").split(/\n+(?=[A-D]\.\s)/);
  for (const part of parts) {
    const m = part.match(/^([A-D])\.\s*([\s\S]+)$/);
    if (m) map[m[1] as Choice] = m[2].trim();
  }
  return map;
}

// --- docx paragraph helpers (RTL) ------------------------------------------

function rtlParagraph(
  runs: TextRun[],
  opts: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; spacingBefore?: number } = {},
): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    heading: opts.heading,
    spacing: { after: 120, before: opts.spacingBefore ?? 0 },
    children: runs,
  });
}

function run(text: string, opts: { bold?: boolean; italics?: boolean; color?: string } = {}): TextRun {
  return new TextRun({ text, rightToLeft: true, bold: opts.bold, italics: opts.italics, color: opts.color });
}

/** Split normalized text into paragraphs on blank lines, preserving single newlines as soft breaks. */
function textToParagraphs(text: string, opts: { spacingBefore?: number } = {}): Paragraph[] {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) return [];
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const runs: TextRun[] = [];
    lines.forEach((line, idx) => {
      if (idx > 0) runs.push(new TextRun({ text: line, rightToLeft: true, break: 1 }));
      else runs.push(run(line));
    });
    return rtlParagraph(runs, { spacingBefore: i === 0 ? opts.spacingBefore : 0 });
  });
}

function separator(): Paragraph {
  return new Paragraph({
    bidirectional: true,
    spacing: { before: 240, after: 240 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "AAAAAA" } },
    children: [],
  });
}

type QuestionForExport = Awaited<ReturnType<typeof loadQuestions>>[number];

function loadQuestions(ids: number[]) {
  return db.question.findMany({
    where: { id: { in: ids } },
    include: { geminiAnswer: true },
    orderBy: { id: "asc" },
  });
}

function buildQuestionBlock(q: QuestionForExport): Paragraph[] {
  const blocks: Paragraph[] = [];
  const ans = q.geminiAnswer;
  const correct = (ans?.correctAnswer ?? q.correctAnswer) as Choice | null;
  const accepted = (q.acceptedAnswers ?? []) as Choice[];

  // Heading
  blocks.push(rtlParagraph([run(`שאלה ${q.id}`, { bold: true })], { heading: HeadingLevel.HEADING_2 }));
  if (q.source) {
    blocks.push(rtlParagraph([run(`מקור: ${q.source}`, { italics: true, color: "666666" })]));
  }

  // Stem
  blocks.push(...textToParagraphs(normalizeText(q.stem)));

  // Options
  const optionText: Record<Choice, string> = {
    A: q.optionA,
    B: q.optionB,
    C: q.optionC,
    D: q.optionD,
  };
  for (const c of CHOICES) {
    const isCorrect = correct === c;
    const isAccepted = accepted.includes(c);
    const runs: TextRun[] = [
      run(`${HEBREW_LETTERS[c]}. `, { bold: true }),
      run(normalizeText(optionText[c]), { bold: isCorrect }),
    ];
    if (isCorrect) runs.push(run("  ✓ (תשובה נכונה)", { bold: true, color: "1A7F37" }));
    else if (isAccepted) runs.push(run("  (מתקבלת גם)", { color: "1A7F37" }));
    blocks.push(rtlParagraph(runs));
  }

  // Answer line
  if (correct) {
    blocks.push(rtlParagraph([run("תשובה נכונה: ", { bold: true }), run(HEBREW_LETTERS[correct], { bold: true })]));
  }

  if (ans) {
    // Explanation
    if (ans.explanation?.trim()) {
      blocks.push(rtlParagraph([run("הסבר", { bold: true })], { heading: HeadingLevel.HEADING_3, spacingBefore: 120 }));
      blocks.push(...textToParagraphs(normalizeText(ans.explanation)));
    }

    // Why others wrong
    const why = parseWhyOthersWrong(ans.whyOthersWrong);
    const whyEntries = CHOICES.filter((c) => why[c]);
    if (whyEntries.length > 0) {
      blocks.push(
        rtlParagraph([run("מדוע האחרים שגויים", { bold: true })], {
          heading: HeadingLevel.HEADING_3,
          spacingBefore: 120,
        }),
      );
      for (const c of whyEntries) {
        blocks.push(
          rtlParagraph([run(`${HEBREW_LETTERS[c]}. `, { bold: true }), run(normalizeText(why[c]!))]),
        );
      }
    }

    // Evidence citations / sources
    const citations = (ans.evidenceCitations as EvidenceCitation[] | null) ?? null;
    if (citations && citations.length > 0) {
      blocks.push(
        rtlParagraph([run("מקורות", { bold: true })], { heading: HeadingLevel.HEADING_3, spacingBefore: 120 }),
      );
      citations.forEach((cit, idx) => {
        const parts: string[] = [`פרק ${cit.chapterNumber} — ${cit.chapterTitle}`];
        if (cit.sectionPath) parts.push(cit.sectionPath);
        if (cit.pageStart != null) {
          parts.push(cit.pageEnd != null && cit.pageEnd !== cit.pageStart ? `עמ׳ ${cit.pageStart}–${cit.pageEnd}` : `עמ׳ ${cit.pageStart}`);
        }
        const header = parts.join(" · ");
        const runs: TextRun[] = [run(`[${idx + 1}] `, { bold: true }), run(header, { color: "555555" })];
        blocks.push(rtlParagraph(runs));
        if (cit.quote?.trim()) {
          blocks.push(rtlParagraph([run(`„${normalizeText(cit.quote)}”`, { italics: true })]));
        }
      });
    }
  }

  return blocks;
}

export async function POST(request: Request) {
  // Admin guard (return JSON 401/403 instead of redirecting, since this is fetched).
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await isEmailBlocked(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let ids: number[];
  try {
    const body = (await request.json()) as { ids?: unknown };
    ids = Array.isArray(body.ids)
      ? body.ids.map((v) => Number(v)).filter((n) => Number.isInteger(n))
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "No questions selected" }, { status: 400 });
  }

  const questions = await loadQuestions(ids);
  if (questions.length === 0) {
    return NextResponse.json({ error: "No questions found" }, { status: 404 });
  }

  const children: Paragraph[] = [];
  questions.forEach((q, idx) => {
    if (idx > 0) children.push(separator());
    children.push(...buildQuestionBlock(q));
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `questions-export-${new Date().toISOString().slice(0, 10)}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
