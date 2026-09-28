// Each DS 11.5 lint rule must actually fail on the thing it bans.
import { ESLint } from "eslint";
import stylelint from "stylelint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function eslintRules(code: string, filePath = "components/fixture.tsx") {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.severity === 2).map((m) => m.ruleId);
}

async function stylelintWarnings(code: string, codeFilename = "components/fixture.css") {
  const { results } = await stylelint.lint({ code, codeFilename });
  return results[0].warnings.map((w) => w.rule);
}

describe("no raw values in components", () => {
  it("flags hex colors", async () => {
    expect(await eslintRules(`export const A = () => <div className="text-default" data-c="#2B4BFF" />;`)).toContain(
      "good-word/no-raw-values",
    );
  });
  it("flags primitive tokens", async () => {
    expect(await eslintRules(`export const c = "var(--cobalt)";`, "components/fixture.ts")).toContain(
      "good-word/no-raw-values",
    );
  });
  it("flags rgb()", async () => {
    expect(await eslintRules(`export const c = "rgb(10 10 10)";`, "components/fixture.ts")).toContain(
      "good-word/no-raw-values",
    );
  });
  it("allows semantic tokens and in-page anchors", async () => {
    expect(await eslintRules(`export const c = "var(--surface)";`, "components/fixture.ts")).toEqual([]);
  });
  it("applies in app/(app) too", async () => {
    expect(await eslintRules(`export const c = "#fff";`, "app/(app)/fixture.ts")).toContain(
      "good-word/no-raw-values",
    );
  });
});

describe("no Tailwind arbitrary values", () => {
  it.each(["bg-[#2B4BFF]", "text-[17px]", "shadow-[0_0_4px_red]", "hover:w-[13px]", "[mask-type:alpha]", "bg-(--ink)"])(
    "flags %s",
    async (cls) => {
      expect(await eslintRules(`export const A = () => <div className="p-4 ${cls}" />;`)).toContain(
        "good-word/no-arbitrary-values",
      );
    },
  );
  it("flags spacing off the 4px token scale", async () => {
    expect(await eslintRules(`export const A = () => <div className="p-7" />;`)).toContain(
      "good-word/no-arbitrary-values",
    );
  });
  it("allows token classes", async () => {
    expect(await eslintRules(`export const A = () => <div className="bg-surface p-4 md:gap-6 text-muted shadow-md" />;`)).toEqual([]);
  });
});

describe("fonts", () => {
  it("flags serif type mixed with Inter sizes", async () => {
    expect(await eslintRules(`export const A = () => <p className="text-quote text-caption" />;`)).toContain(
      "good-word/serif-type",
    );
  });
  it("flags fontFamily", async () => {
    expect(await eslintRules(`export const s = { fontFamily: "Georgia" };`, "components/fixture.ts")).toContain(
      "good-word/serif-type",
    );
  });
  it("flags other Google fonts", async () => {
    expect(await eslintRules(`import { Fraunces } from "next/font/google";\nexport const f = Fraunces;`, "app/layout-fixture.tsx")).toContain(
      "good-word/serif-type",
    );
  });
  it("flags other font families in CSS", async () => {
    expect(await stylelintWarnings(`a { font-family: "Gochi Hand", cursive; }`)).toContain(
      "declaration-property-value-allowed-list",
    );
  });
  it("flags the serif outside typography.css", async () => {
    expect(await stylelintWarnings(`a { font-family: var(--font-display); }`)).toContain(
      "declaration-property-value-allowed-list",
    );
  });
});

describe("icons", () => {
  it("flags other icon libraries", async () => {
    expect(await eslintRules(`import { Plus } from "lucide-react";\nexport const I = Plus;`)).toContain(
      "no-restricted-imports",
    );
  });
  it("flags Phosphor outside the Icon wrapper", async () => {
    expect(await eslintRules(`import { Plus } from "@phosphor-icons/react";\nexport const I = Plus;`)).toContain(
      "no-restricted-imports",
    );
  });
  it("allows Phosphor inside the Icon wrapper", async () => {
    expect(
      await eslintRules(`import { Plus } from "@phosphor-icons/react/dist/ssr";\nexport const I = Plus;`, "components/icon.tsx"),
    ).toEqual([]);
  });
});

describe("hardcoded UI strings", () => {
  it("flags JSX text", async () => {
    expect(await eslintRules(`export const A = () => <button>Put in a good word</button>;`)).toContain(
      "good-word/no-hardcoded-strings",
    );
  });
  it("flags aria-label strings", async () => {
    expect(await eslintRules(`export const A = () => <button aria-label="Close" />;`)).toContain(
      "good-word/no-hardcoded-strings",
    );
  });
  it("allows copy from messages", async () => {
    expect(await eslintRules(`declare const t: (k: string) => string;\nexport const A = () => <button aria-label={t("close")}>{t("close")}</button>;`)).toEqual([]);
  });
});

describe("focus outlines", () => {
  it("flags outline-none without a replacement", async () => {
    expect(await eslintRules(`export const A = () => <button className="outline-none" />;`)).toContain(
      "good-word/focus-outline",
    );
  });
  it("allows outline-none with a focus-visible replacement", async () => {
    expect(await eslintRules(`export const A = () => <button className="outline-none focus-visible:outline-2" />;`)).toEqual([]);
  });
  it("flags outline: none in CSS", async () => {
    expect(await stylelintWarnings(`a:focus { outline: none; }`)).toContain(
      "declaration-property-value-disallowed-list",
    );
  });
});

describe("CSS raw values", () => {
  it("flags hex outside tokens.css", async () => {
    expect(await stylelintWarnings(`a { color: #0A0A0A; }`)).toContain("color-no-hex");
  });
  it("flags primitives outside tokens.css", async () => {
    expect(await stylelintWarnings(`a { color: var(--ink); }`)).toContain("declaration-property-value-disallowed-list");
  });
  it("allows raw values in tokens.css", async () => {
    expect(await stylelintWarnings(`:root { --ink: #0A0A0A; }`, "styles/tokens.css")).toEqual([]);
  });
});
