// `pdf-parse`'s main entry (`index.js`) runs a debug block that reads a bundled
// sample PDF off disk at import time, which throws in bundled/serverless builds.
// Importing the internal library entry skips that block. It ships no types, so we
// declare a minimal surface here.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(data: Buffer | Uint8Array): Promise<PdfParseResult>;
  export default pdfParse;
}
