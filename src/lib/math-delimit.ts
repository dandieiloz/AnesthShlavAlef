// Characters that may appear in a math run *outside* of {...} groups.
// Hebrew letters are intentionally excluded — they end a math run.
const MATH_CHAR_RE = /[A-Za-z0-9_^+\-*/=.()<>:;,~ \t]/;

/**
 * Wrap stray LaTeX (commands like \Delta, \times, \dot{}, \text{}, \approx)
 * emitted by the model without $...$ delimiters. Inside {...} groups any
 * character is allowed (including Hebrew), so `\text{ (ב-mL O2/L)}` stays
 * atomic. Already-delimited math and code spans are left untouched.
 *
 * Must run BEFORE sentence splitting — otherwise the splitter shatters bare
 * equations like `\Delta C_O_2 = ... = 5.186 mL O2/dL.` on the trailing dot.
 */
export function ensureMathDelimiters(input: string): string {
  if (!input) return input;
  const segments = input.split(/(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g);
  return segments.map((seg, i) => (i % 2 === 1 ? seg : wrapMathInSegment(seg))).join("");
}

function wrapMathInSegment(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    // Find the next backslash that starts a LaTeX command (\Word).
    let cmd = -1;
    for (let j = i; j < s.length - 1; j++) {
      if (s[j] === "\\" && /[A-Za-z]/.test(s[j + 1])) {
        cmd = j;
        break;
      }
    }
    if (cmd === -1) {
      out += s.slice(i);
      break;
    }

    // Extend the math run backwards across math-safe chars on the same line.
    let start = cmd;
    while (start > i && MATH_CHAR_RE.test(s[start - 1]) && s[start - 1] !== "\n") {
      start--;
    }
    while (start < cmd && /\s/.test(s[start])) start++;

    // Walk forward through math chars and balanced brace groups.
    let end = cmd;
    while (end < s.length) {
      const c = s[end];
      if (c === "\n") break;
      if (c === "{") {
        let depth = 1;
        end++;
        while (end < s.length && depth > 0) {
          if (s[end] === "{") depth++;
          else if (s[end] === "}") depth--;
          end++;
        }
        continue;
      }
      if (c === "\\" && /[A-Za-z]/.test(s[end + 1] ?? "")) {
        end++;
        while (end < s.length && /[A-Za-z]/.test(s[end])) end++;
        continue;
      }
      if (MATH_CHAR_RE.test(c)) {
        end++;
        continue;
      }
      break;
    }

    let mathEnd = end;
    while (mathEnd > cmd && /[\s.,;:]/.test(s[mathEnd - 1])) mathEnd--;

    out += s.slice(i, start);
    out += `$${s.slice(start, mathEnd)}$`;
    out += s.slice(mathEnd, end);
    i = end;
  }
  return out;
}
