import { describe, expect, test } from "bun:test";

const renderer = (
  await Promise.all([
    Bun.file(
      new URL("./portal-workspace-controls.tsx", import.meta.url),
    ).text(),
    Bun.file(new URL("../render/render-project.tsx", import.meta.url)).text(),
    Bun.file(
      new URL("./portal-project-controller.tsx", import.meta.url),
    ).text(),
  ])
).join("\n");
const globalStyles = await Bun.file(
  new URL("../../app/globals.css", import.meta.url),
).text();

describe("portal editor text fields", () => {
  test("disable autocomplete for the portal summary and section headings", () => {
    expect(renderer.match(/autoComplete="off"/g)?.length ?? 0).toBeGreaterThan(
      0,
    );
    expect(
      renderer.match(/data-portal-editor-field/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
  });

  test("neutralize the browser autofill background only for editor fields", () => {
    expect(globalStyles).toContain(
      "[data-portal-editor-field]:-webkit-autofill",
    );
    expect(globalStyles).toContain("-webkit-background-clip: text");
  });
});
