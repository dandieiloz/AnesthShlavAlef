import "server-only";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

/** Max upload size. Kept under the 10mb server-action body limit (multipart overhead + other fields). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

export class FileExtractionError extends Error {}

export type ExtractedFile = { text: string; fileName: string };

type FileKind = "pdf" | "docx";

function detectKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (file.type === PDF_MIME || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX_MIME || name.endsWith(".docx")) return "docx";
  // Legacy binary .doc is not supported by mammoth.
  if (file.type === DOC_MIME || name.endsWith(".doc")) {
    throw new FileExtractionError("פורמט .doc הישן אינו נתמך — שמרו כקובץ PDF או Word חדש (.docx)");
  }
  throw new FileExtractionError("סוג קובץ לא נתמך — יש להעלות קובץ PDF או Word (.docx)");
}

/** Extract plain text from an uploaded PDF or Word (.docx) file. Server-only. */
export async function extractTextFromFile(file: File): Promise<ExtractedFile> {
  if (file.size === 0) throw new FileExtractionError("הקובץ ריק");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new FileExtractionError(`הקובץ גדול מדי (מקסימום ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`);
  }

  const kind = detectKind(file);
  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    if (kind === "pdf") {
      const result = await pdfParse(buffer);
      text = result.text ?? "";
    } else {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value ?? "";
    }
  } catch {
    throw new FileExtractionError("שגיאה בקריאת הקובץ — ודאו שהקובץ תקין ונסו שוב");
  }

  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (text.length < 20) {
    throw new FileExtractionError("לא הצלחנו לחלץ טקסט מהקובץ — ייתכן שהוא סרוק כתמונה");
  }
  return { text, fileName: file.name };
}
