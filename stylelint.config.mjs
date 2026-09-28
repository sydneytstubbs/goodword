// CSS lint rules (DESIGN-SYSTEM.md 11.5). Raw values live only in styles/tokens.css.

const PRIMITIVE =
  "/var\\(--(paper|white|stone-\\d+|graphite|ink|cobalt(-\\d+)?|red-\\d+|green-\\d+|clay|ochre|moss|plum)\\)/";
const OUTLINE_NONE = ["/^none$/", "/^0(px)?$/"];

/** @type {import("stylelint").Config} */
const config = {
  ignoreFiles: ["node_modules/**", ".next/**", "playwright-report/**", "test-results/**"],
  rules: {
    // `outline: none` without a replacement focus style.
    "declaration-property-value-disallowed-list": {
      "/^outline(-style)?$/": OUTLINE_NONE,
      "/.*/": [PRIMITIVE],
    },
    // Only the two brand typefaces, and the serif only through typography.css.
    "declaration-property-value-allowed-list": {
      "font-family": ["/^var\\(--font-body\\)$/", "inherit"],
    },
    "color-no-hex": true,
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "oklch", "oklab", "lab", "lch"],
  },
  overrides: [
    {
      files: ["styles/tokens.css"],
      rules: {
        "declaration-property-value-disallowed-list": { "/^outline(-style)?$/": OUTLINE_NONE },
        "color-no-hex": null,
        "function-disallowed-list": null,
      },
    },
    {
      files: ["styles/typography.css"],
      rules: {
        "declaration-property-value-allowed-list": {
          "font-family": ["/^var\\(--font-(body|display)\\)$/", "inherit"],
        },
      },
    },
  ],
};

export default config;
