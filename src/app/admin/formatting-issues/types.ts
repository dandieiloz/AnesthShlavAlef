import type { FieldIssue } from "@/lib/formatting-scan";

/** Where a scanned text field lives, used to route reads/writes back to the DB. */
export type IssueSource = "QUESTION" | "ANSWER" | "EVIDENCE";

/** A single scanned field carrying one or more detected formatting issues. */
export interface ScanRecord {
  questionId: number;
  source: IssueSource;
  /** DB field name (or "quote" for evidence). */
  field: string;
  /** Hebrew label for the field. */
  fieldLabel: string;
  /** Index into evidenceCitations[] when source === "EVIDENCE", else null. */
  citationIndex: number | null;
  /** Short question-stem preview for context. */
  stemPreview: string;
  /** Full original field value. */
  original: string;
  /** Deterministically auto-fixed value, or null when no auto-fix applies. */
  autoFixed: string | null;
  issues: FieldIssue[];
}

export interface ScanResult {
  records: ScanRecord[];
  scannedQuestions: number;
  totalIssues: number;
}
