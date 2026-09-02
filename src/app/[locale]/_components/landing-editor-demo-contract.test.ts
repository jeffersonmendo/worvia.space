import { describe, expect, test } from "bun:test";
import {
  assertUniqueDemoTarget,
  LANDING_EDITOR_DEMO_SEQUENCE,
  type LandingEditorDemoTarget,
} from "./landing-editor-demo-contract";

describe("landing editor demo target contract", () => {
  test("declares the exact unique semantic interaction sequence", () => {
    expect(LANDING_EDITOR_DEMO_SEQUENCE).toEqual([
      "project-description",
      "colors-section",
      "add-color",
      "color-code",
      "save-color",
      "gallery-section",
      "first-image-settings",
      "first-image-name",
      "first-image-download",
      "first-image-picker",
      "first-image-black",
      "popover-dismiss-arm",
      "editor-canvas",
      "publish",
    ]);
    expect(new Set(LANDING_EDITOR_DEMO_SEQUENCE).size).toBe(
      LANDING_EDITOR_DEMO_SEQUENCE.length,
    );
  });

  test("fails when a required target is missing or duplicated", () => {
    const root = (count: number) =>
      ({
        querySelectorAll: () => Array.from({ length: count }, () => ({})),
      }) as unknown as ParentNode;
    expect(() =>
      assertUniqueDemoTarget(root(0), "project-description"),
    ).toThrow("expected once, found 0");
    expect(() => assertUniqueDemoTarget(root(2), "publish")).toThrow(
      "expected once, found 2",
    );
    expect(
      assertUniqueDemoTarget(
        root(1),
        "editor-canvas" as LandingEditorDemoTarget,
      ),
    ).toBeDefined();
  });
});
