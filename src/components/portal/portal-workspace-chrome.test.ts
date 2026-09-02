import { describe, expect, test } from "bun:test";
import {
  WORKSPACE_HEADER_POSITION_CLASS,
  WORKSPACE_HEADER_SURFACE_CLASS,
  workspaceHeaderClass,
} from "./portal-workspace-chrome";

describe("workspaceHeaderClass", () => {
  test("keeps production left padding override after the shared horizontal padding", () => {
    const classes = workspaceHeaderClass(
      WORKSPACE_HEADER_POSITION_CLASS.viewport,
    );
    expect(classes).toContain("px-4");
    expect(classes).toContain("pl-2");
    expect(classes.indexOf("px-4")).toBeLessThan(classes.indexOf("pl-2"));
  });

  test("uses the standard shared padding inside an already-offset inset", () => {
    const classes = workspaceHeaderClass(WORKSPACE_HEADER_POSITION_CLASS.inset);
    expect(classes).toContain("px-4");
    expect(classes).not.toContain("pl-2");
    expect(classes).toContain("left-0");
  });

  test("matches the floating sidebar border contract", () => {
    expect(WORKSPACE_HEADER_SURFACE_CLASS).toContain(
      "ring-1 ring-sidebar-border",
    );
    expect(WORKSPACE_HEADER_SURFACE_CLASS).not.toContain(
      "border border-border/50",
    );
  });

  test("keeps the default right gutter but uses the open sidebar outer width", () => {
    expect(WORKSPACE_HEADER_POSITION_CLASS.viewport).toContain(
      "right-[var(--portal-right-sidebar-width,0.5rem)]",
    );
    expect(WORKSPACE_HEADER_POSITION_CLASS.viewport).not.toContain(
      "right-[calc(var(--portal-right-sidebar-width,0px)+0.5rem)]",
    );
  });
});
