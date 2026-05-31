"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ensureMathDelimiters } from "@/lib/math-delimit";

export function MathMarkdown({ children }: { children: string }) {
  const prepared = ensureMathDelimiters(children);
  return (
    <div className="answer-content prose prose-sm dark:prose-invert max-w-none" dir="rtl">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
