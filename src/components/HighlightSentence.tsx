"use client";

import { MathMarkdown } from "@/components/MathMarkdown";

// Stored sentenceText keeps the answer's inline markup: KaTeX math ($…$, $$…$$)
// and citation anchors that injectCitationAnchors() produced, e.g.
// "[2](#cite-1775-2)". Outside the answer card there is no citation panel to
// link to, so collapse those anchors back to a plain "[2]" marker and drop any
// stray trailing list bullet left over from sentence splitting, then render the
// rest through MathMarkdown so formulae display instead of showing raw LaTeX.
const CITE_LINK_RE = /\[(\d+)\]\(#cite-[^)]*\)/g;
const TRAILING_BULLET_RE = /[\s\n]*[-*]\s*$/;

export function HighlightSentence({ text }: { text: string }) {
  const cleaned = text.replace(CITE_LINK_RE, "[$1]").replace(TRAILING_BULLET_RE, "").trim();
  // Strip the prose paragraph margins so a single highlighted sentence stays compact.
  return (
    <div className="text-sm leading-snug [&_.answer-content]:!text-sm [&_p]:!my-0 [&_ul]:!my-0 [&_ol]:!my-0">
      <MathMarkdown>{cleaned}</MathMarkdown>
    </div>
  );
}
