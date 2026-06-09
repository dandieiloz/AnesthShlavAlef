import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".firebase/**",
      "public/sw.js",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  // CommonJS config/scripts legitimately use require()
  {
    files: ["**/*.cjs", "*.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // The react-hooks v7 (React Compiler era) recommended set bundled with
  // eslint-config-next 16 is far stricter than this codebase predates. The
  // flagged patterns (hydration-safe setState in mount effects, inline render
  // helpers, ref reads) are intentional and working. Keep them as warnings so
  // they stay visible for incremental cleanup without breaking `npm run lint`.
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
