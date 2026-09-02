import { describe, expect, test } from "bun:test";
import type { PortalFontItem } from "@/domain/portal/document";
import { fontWeightLabel } from "./font-utils";

function font(weight: number, weights?: string) {
  return { weight, weights } as PortalFontItem;
}

describe("font weight labels", () => {
  test("renders canonical numeric weights with a localized safe fallback", () => {
    expect(fontWeightLabel(font(450, "450"), "Weight")).toBe("450 Weight");
  });

  test("does not leak a previously persisted locale-specific label", () => {
    expect(fontWeightLabel(font(400, "400 Regular"), "Peso")).toBe("400 Peso");
  });
});
