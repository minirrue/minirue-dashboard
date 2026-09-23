import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Installed Claude Code skill libraries — vendored third-party scripts,
    // untracked by git and shipped to nobody. Not this project's code to hold
    // to its rules.
    ".claude/**",

    // Local Impeccable review harnesses (gitignored Playwright .cjs scripts).
    // Not app code; linting them crashed the whole run on a plugin lookup.
    ".impeccable/review/**",

    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Honour the `_` prefix the codebase already uses for deliberately-unused
      // bindings. Everything genuinely dead is deleted rather than renamed.
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],

      /**
       * A warning, not an error — and deliberately still on.
       *
       * Every occurrence in this repo is one of two patterns that a Next.js App
       * Router app cannot express any other way:
       *
       *   - the mounted flag that defers client-only UI past hydration
       *     (components/ui/ClientOnly.tsx is the canonical one), and
       *   - reading something that does not exist on the server — window
       *     dimensions, localStorage, a resolved query — which can only happen
       *     after mount, i.e. in an effect.
       *
       * Rewriting those to satisfy the rule reintroduces the hydration
       * mismatches they exist to prevent, so they are not going to be rewritten
       * to make a linter quiet. Left as a warning rather than switched off
       * because the rule does also catch genuine cascading-render bugs, and a
       * new one should still be visible to whoever adds it.
       */
      "react-hooks/set-state-in-effect": "warn",

      /**
       * A warning too, and for the same reason: it reports an OPTIMIZATION the
       * React Compiler declined, not a defect.
       *
       * "Compilation Skipped: Existing memoization could not be preserved"
       * means the compiler bailed out of optimizing a component whose manual
       * useMemo it could not prove equivalent — in both cases here a memo that
       * returns a closure (a d3 quantize scale, a row mapper). The components
       * behave correctly either way; they are just not compiler-optimized.
       *
       * Left visible rather than switched off: a new one is worth knowing
       * about, and the fix is usually to drop the manual memo and let the
       * compiler do it — which is a performance change worth measuring, not one
       * to make blind to satisfy a linter.
       */
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);

export default eslintConfig;
