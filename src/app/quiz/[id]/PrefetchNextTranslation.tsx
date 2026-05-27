"use client";

import { useEffect } from "react";
import { prefetchQuestionTranslationAction } from "@/app/(user)/actions";

/**
 * Fire-and-forget client trigger that warms the translation cache for the next
 * unanswered question while the user is reading the current one. Renders nothing.
 */
export function PrefetchNextTranslation({ questionId }: { questionId: number }) {
  useEffect(() => {
    // Don't await — purely background. Errors are swallowed; the next render
    // will re-attempt translation on the server anyway.
    prefetchQuestionTranslationAction(questionId).catch(() => {});
  }, [questionId]);

  return null;
}
