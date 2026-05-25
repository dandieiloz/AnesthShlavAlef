// Back-compat shim. The RAG pipeline now lives under src/lib/rag/.
// Existing callers import { generateExplanationForQuestion } from '@/lib/rag' and continue to work.
export { generateExplanationForQuestionV2 as generateExplanationForQuestion } from '@/lib/rag/index';
export * from '@/lib/rag/index';
