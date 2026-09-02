import { describe, expect, test } from "bun:test";
import {
  createUniqueSlugCandidate,
  normalizeDesignerName,
  normalizeWebsiteUrl,
  validateDesignerName,
  validateSlug,
} from "./settings";

describe("portal settings", () => {
  test("creates a valid unique slug when the project name is already used", () => {
    expect(createUniqueSlugCandidate("Brand Guide", "abcdef12")).toBe(
      "brand-guide-abcdef12",
    );
    expect(createUniqueSlugCandidate("a".repeat(80), "abcdef12")).toHaveLength(
      80,
    );
  });

  test("accepts only canonical lowercase slugs", () => {
    expect(validateSlug("brand-guide")).toEqual({ valid: true });
    expect(validateSlug("Brand guide")).toEqual({
      error: "Usa solo letras minúsculas, números y guiones.",
      valid: false,
    });
  });

  test("rejects malformed or repeated slug separators", () => {
    expect(validateSlug("brand--guide").valid).toBe(false);
    expect(validateSlug("-brand").valid).toBe(false);
  });

  test("normalizes bare websites to HTTPS and rejects unsafe protocols", () => {
    expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com/");
    expect(normalizeWebsiteUrl("http://example.com")).toBeNull();
    expect(normalizeWebsiteUrl("javascript:alert(1)")).toBeNull();
  });

  test("validates designer word and character limits without silent truncation", () => {
    expect(validateDesignerName("Ana María Studio")).toEqual({ valid: true });
    expect(
      validateDesignerName("uno dos tres cuatro cinco seis siete ocho nueve")
        .valid,
    ).toBe(false);
    expect(validateDesignerName("a".repeat(81)).valid).toBe(false);
    expect(normalizeDesignerName("  Ana   María  ")).toBe("Ana María");
  });
});
