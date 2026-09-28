import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import goodWord from "./eslint-rules/good-word.mjs";

// Icon and UI libraries other than Phosphor are not allowed (DS 3.5, 11.5; CLAUDE.md).
const bannedLibraries = [
  { group: ["lucide-react", "react-icons", "react-icons/*", "react-feather", "@heroicons/*", "@tabler/icons-react", "@radix-ui/react-icons", "@mui/icons-material", "@mui/icons-material/*", "@fortawesome/*", "@iconify/*", "@remixicon/*", "phosphor-react"], message: "Phosphor (@phosphor-icons/react) is the only icon library. Use the Icon component." },
  { group: ["@mui/*", "@chakra-ui/*", "@radix-ui/themes", "@mantine/*", "antd", "@headlessui/*", "daisyui", "flowbite*"], message: "No UI component libraries. Hand-build with Tailwind (DS 11.4)." },
];
const phosphorOnlyInIcon = {
  group: ["@phosphor-icons/react", "@phosphor-icons/react/*"],
  message: "Import icons through components/icon.tsx so weight and size defaults live in one place (DS 3.5).",
};

// Where the strict design rules apply (DS 11.5).
const PRODUCT = ["components/**/*.{ts,tsx}", "app/(app)/**/*.{ts,tsx}"];
const DESIGN = [...PRODUCT, "app/(marketing)/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "good-word": goodWord },
    rules: {
      "no-restricted-imports": ["error", { patterns: [...bannedLibraries, phosphorOnlyInIcon] }],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "good-word/serif-type": "error",
      "good-word/focus-outline": "error",
    },
  },
  {
    files: ["components/icon.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: bannedLibraries }],
    },
  },
  {
    files: DESIGN,
    rules: {
      "good-word/no-arbitrary-values": "error",
      // No inline styles in components (DS 11.3).
      "react/forbid-dom-props": ["error", { forbid: ["style"] }],
    },
  },
  {
    // Primitives are allowed only in tokens.css and fixed-color marketing sections (DS 2.2).
    files: [...PRODUCT, "lib/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts"],
    rules: {
      "good-word/no-raw-values": "error",
    },
  },
  {
    files: PRODUCT,
    rules: {
      "good-word/no-hardcoded-strings": "error",
    },
  },
  {
    // Generated images (favicon, Apple icon, Open Graph) are rendered by next/og,
    // which only understands inline styles and needs the font named directly.
    files: ["app/**/{icon,apple-icon,opengraph-image}.tsx", "app/_brand/**/*.tsx"],
    rules: {
      "react/forbid-dom-props": "off",
      "good-word/serif-type": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
