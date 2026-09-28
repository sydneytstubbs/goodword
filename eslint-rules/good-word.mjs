/**
 * Good Word lint rules (DESIGN-SYSTEM.md 11.5). Each one fails the build.
 *
 * - no-raw-values: hex, rgb()/hsl() and primitive tokens (--ink, --cobalt…)
 * - no-arbitrary-values: Tailwind arbitrary values, and spacing off the 4px token scale
 * - serif-type: Instrument Serif only through its 24px+ type utilities; only Inter and
 *   Instrument Serif may be loaded
 * - no-hardcoded-strings: UI copy comes from messages/en.json
 * - focus-outline: outline-none needs a focus-visible replacement
 */

const PRIMITIVE =
  /--(?:paper|white|stone-\d+|graphite|ink|cobalt(?:-\d+)?|red-\d+|green-\d+|clay|ochre|moss|plum)\b/;
const HEX = /(?:^|[\s:(,'"=])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const COLOR_FN = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;

// Tailwind arbitrary values: bg-[#fff], text-[17px], [mask:x], bg-(--x)
const ARBITRARY = /(?:^|\s)(?:[\w-]+:)*!?-?[a-z][\w-]*-\[[^\]\s]+\]|(?:^|\s)(?:[\w-]+:)*\[[a-z-]+:[^\]\s]+\]|-\(--[\w-]+\)/;
// Spacing on the token scale (3.3.1): --space-1..32, plus 0, px and 0.5 for hairline insets.
const SPACING = /(?:^|\s)(?:[\w-]+:)*(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?)(?=\s|$)/g;
const SPACING_SCALE = new Set(["0", "0.5", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "24", "32"]);

const SERIF_TYPE = /(?:^|\s)(?:[\w-]+:)*text-(?:display-xl|display-l|display-m|title-l|title-l-step|quote|wordmark|poster-title|poster-initial)(?=\s|$)/;
const INTER_TYPE = /(?:^|\s)(?:[\w-]+:)*text-(?:title-m|heading|body|body-marketing|body-strong|label|card-title|caption|overline)(?=\s|$)/;
const ALLOWED_FONTS = new Set(["Inter", "Instrument_Serif"]);

const OUTLINE_NONE = /(?:^|\s)(?:[\w-]+:)*outline-(?:none|hidden|0)(?=\s|$)/;
const OUTLINE_REPLACEMENT = /(?:^|\s)focus-visible:outline(?:-\d|-focus|\s|$)/;

const COPY_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
  "alt",
  "title",
  "placeholder",
  "label",
]);
const HAS_LETTERS = /\p{L}/u;

/** Every string a file contains: literals, template parts, JSX text. */
function stringVisitors(check) {
  return {
    Literal(node) {
      if (typeof node.value === "string") check(node, node.value);
    },
    TemplateElement(node) {
      check(node, node.value.cooked ?? node.value.raw);
    },
  };
}

function isHrefOrId(node) {
  const parent = node.parent;
  return (
    parent?.type === "JSXAttribute" &&
    ["href", "id", "htmlFor", "aria-controls", "aria-labelledby", "aria-describedby"].includes(parent.name.name)
  );
}

const noRawValues = {
  meta: {
    type: "problem",
    docs: { description: "Use semantic tokens, never hex values, color functions, or primitive tokens (DS 11.5)" },
    messages: {
      hex: "Hex color in a component. Use a semantic token class (bg-surface, text-muted…).",
      fn: "Raw color function in a component. Use a semantic token.",
      primitive: "Primitive token {{name}} in a component. Use a semantic role (DS 2.2).",
    },
    schema: [],
  },
  create(context) {
    return stringVisitors((node, value) => {
      if (isHrefOrId(node)) return;
      const primitive = value.match(PRIMITIVE);
      if (primitive) context.report({ node, messageId: "primitive", data: { name: primitive[0] } });
      else if (HEX.test(value)) context.report({ node, messageId: "hex" });
      else if (COLOR_FN.test(value)) context.report({ node, messageId: "fn" });
    });
  },
};

const noArbitraryValues = {
  meta: {
    type: "problem",
    docs: { description: "No Tailwind arbitrary values; spacing only from the token scale (DS 3.3.1, 11.2)" },
    messages: {
      arbitrary: "Tailwind arbitrary value “{{value}}”. Use a token class, or add a token to styles/tokens.css.",
      spacing: "“{{value}}” is off the spacing scale. Use 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24 or 32 (DS 3.3.1).",
    },
    schema: [],
  },
  create(context) {
    return stringVisitors((node, value) => {
      if (isHrefOrId(node)) return;
      const arbitrary = value.match(ARBITRARY);
      if (arbitrary) {
        context.report({ node, messageId: "arbitrary", data: { value: arbitrary[0].trim() } });
        return;
      }
      for (const match of value.matchAll(SPACING)) {
        if (!SPACING_SCALE.has(match[2])) {
          context.report({ node, messageId: "spacing", data: { value: match[0].trim() } });
        }
      }
    });
  },
};

const serifType = {
  meta: {
    type: "problem",
    docs: { description: "Only Inter and Instrument Serif; Instrument Serif only at 24px and up (DS 3.2.2)" },
    messages: {
      mixed: "Serif type utility combined with an Inter type utility. Serif is for 24px and up only; pick one.",
      fontFamily: "Don't set font-family directly. Use a type utility (text-body, text-title-l…).",
      font: "Only Inter and Instrument Serif may be loaded (found {{name}}).",
      localFont: "Load fonts from next/font/google (Inter, Instrument Serif) only.",
    },
    schema: [],
  },
  create(context) {
    return {
      ...stringVisitors((node, value) => {
        if (SERIF_TYPE.test(value) && INTER_TYPE.test(value)) context.report({ node, messageId: "mixed" });
      }),
      Property(node) {
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (key === "fontFamily") context.report({ node, messageId: "fontFamily" });
      },
      ImportDeclaration(node) {
        if (node.source.value === "next/font/local") context.report({ node, messageId: "localFont" });
        if (node.source.value === "next/font/google") {
          for (const spec of node.specifiers) {
            const name = spec.imported?.name ?? spec.local.name;
            if (!ALLOWED_FONTS.has(name)) context.report({ node: spec, messageId: "font", data: { name } });
          }
        }
      },
    };
  },
};

const noHardcodedStrings = {
  meta: {
    type: "problem",
    docs: { description: "UI copy lives in messages/en.json (DS 10, 11.5)" },
    messages: {
      text: "Hardcoded UI text “{{text}}”. Move it to messages/en.json and use t().",
    },
    schema: [],
  },
  create(context) {
    const report = (node, text) =>
      context.report({ node, messageId: "text", data: { text: text.trim().slice(0, 40) } });
    return {
      JSXText(node) {
        if (HAS_LETTERS.test(node.value)) report(node, node.value);
      },
      JSXAttribute(node) {
        const name = typeof node.name.name === "string" ? node.name.name : "";
        if (!COPY_ATTRIBUTES.has(name) || !node.value) return;
        if (node.value.type === "Literal" && HAS_LETTERS.test(String(node.value.value))) {
          report(node.value, String(node.value.value));
        }
        const expr = node.value.expression;
        if (expr?.type === "Literal" && typeof expr.value === "string" && HAS_LETTERS.test(expr.value)) {
          report(expr, expr.value);
        }
        if (expr?.type === "TemplateLiteral" && expr.quasis.some((q) => HAS_LETTERS.test(q.value.raw))) {
          report(expr, expr.quasis.map((q) => q.value.raw).join("…"));
        }
      },
      JSXExpressionContainer(node) {
        if (node.parent?.type !== "JSXElement" && node.parent?.type !== "JSXFragment") return;
        const expr = node.expression;
        if (expr.type === "Literal" && typeof expr.value === "string" && HAS_LETTERS.test(expr.value)) {
          report(expr, expr.value);
        }
        if (expr.type === "TemplateLiteral" && expr.quasis.some((q) => HAS_LETTERS.test(q.value.raw))) {
          report(expr, expr.quasis.map((q) => q.value.raw).join("…"));
        }
      },
    };
  },
};

const focusOutline = {
  meta: {
    type: "problem",
    docs: { description: "outline-none needs a replacement focus style (DS 3.8, 11.5)" },
    messages: {
      outline: "outline-none/outline-0 removes the focus ring. Keep the global ring, or add focus-visible:outline-* in the same class list.",
    },
    schema: [],
  },
  create(context) {
    return stringVisitors((node, value) => {
      if (OUTLINE_NONE.test(value) && !OUTLINE_REPLACEMENT.test(value)) {
        context.report({ node, messageId: "outline" });
      }
    });
  },
};

const plugin = {
  meta: { name: "good-word" },
  rules: {
    "no-raw-values": noRawValues,
    "no-arbitrary-values": noArbitraryValues,
    "serif-type": serifType,
    "no-hardcoded-strings": noHardcodedStrings,
    "focus-outline": focusOutline,
  },
};

export default plugin;
