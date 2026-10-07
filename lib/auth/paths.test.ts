import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNext } from "./paths";

describe("safeNext", () => {
  it("keeps same-site paths, with their query", () => {
    expect(safeNext("/join/abc")).toBe("/join/abc");
    expect(safeNext("/list/1?sort=most")).toBe("/list/1?sort=most");
  });
  it("falls back for anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil", "", null, undefined, "/a\nb"]) {
      expect(safeNext(bad)).toBe("/home");
    }
  });
});

describe("isProtectedPath", () => {
  it("guards app routes and leaves public ones open", () => {
    expect(isProtectedPath("/list")).toBe(true);
    expect(isProtectedPath("/groups/1")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/sign-in")).toBe(false);
    expect(isProtectedPath("/join/abc")).toBe(false);
    expect(isProtectedPath("/join/abc/accept")).toBe(true);
    expect(isProtectedPath("/listish")).toBe(false);
  });
});
