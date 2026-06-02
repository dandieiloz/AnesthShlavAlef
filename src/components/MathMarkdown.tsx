"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ensureMathDelimiters } from "@/lib/math-delimit";

// KaTeX's Main-Regular font has no Hebrew glyphs, so it warns directly via
// console.warn (bypassing its `strict` handler) for every Hebrew character.
// Rendering falls back to the page font, so the output is fine — silence noise.
if (typeof window !== "undefined") {
  const w = window as unknown as { __katexWarnFilterInstalled?: boolean };
  if (!w.__katexWarnFilterInstalled) {
    w.__katexWarnFilterInstalled = true;
    const orig = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === "string" && first.startsWith("No character metrics for ")) return;
      orig(...args);
    };
  }
}

export function MathMarkdown({ children }: { children: string }) {
  const prepared = ensureMathDelimiters(children);
  return (
    <div className="answer-content prose prose-sm dark:prose-invert max-w-none" dir="rtl">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: "ignore", throwOnError: false }]]}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
