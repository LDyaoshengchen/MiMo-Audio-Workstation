import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("save notice layout regression guard", () => {
  it("keeps both saving and failure notices outside document flow", () => {
    const rule = css.match(/\.workspace-save-notice\s*\{([^}]+)\}/)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toMatch(/position:\s*fixed\s*;/);
    expect(rule).toMatch(/bottom:\s*24px\s*;/);
    expect(rule).toMatch(/max-width:\s*calc\(100vw - 48px\)/);
    expect(rule).toMatch(/flex-wrap:\s*wrap/);
  });
  it("allows clicking error recovery actions but does not intercept clicks while saving", () => {
    const saving = css.match(/\.workspace-save-notice\[role="status"\]\s*\{([^}]+)\}/)?.[1];
    const error = css.match(/\.workspace-save-notice\[role="alert"\]\s*\{([^}]+)\}/)?.[1];
    expect(saving).toMatch(/pointer-events:\s*none/);
    expect(error).not.toMatch(/pointer-events:\s*none/);
  });
});
