"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export function MathMarkdown({ children }: { children: string }) {
  return (
    <div className="answer-content prose prose-sm dark:prose-invert max-w-none" dir="rtl">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
