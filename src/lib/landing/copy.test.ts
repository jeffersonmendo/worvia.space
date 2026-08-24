import { describe, expect, test } from "bun:test";

const spanish = await Bun.file(
  new URL("../../../messages/es.json", import.meta.url),
).json();
const english = await Bun.file(
  new URL("../../../messages/en.json", import.meta.url),
).json();

describe("landing copy", () => {
  test("does not render a redundant audience eyebrow", () => {
    expect("eyebrow" in spanish.Landing).toBeFalse();
    expect("eyebrow" in english.Landing).toBeFalse();
  });

  test("keeps the creative product voice localized", () => {
    expect(spanish.Landing.description).toContain("Worvia");
    expect(spanish.Landing.description).toContain("sistemas de marca");
    expect(spanish.Landing.description).toContain("proyectos");
    expect(english.Landing.description).toContain("Worvia");
    expect(english.Landing.description).toContain("brand systems");
    expect(english.Landing.description).toContain("projects");
    expect(spanish.Landing.cta).not.toBe(english.Landing.cta);
  });

  test("explains the product for designers in a localized project section", () => {
    for (const landing of [spanish.Landing, english.Landing]) {
      expect(landing.details.title.length).toBeGreaterThan(0);
      expect(landing.details.description.length).toBeGreaterThan(0);
      expect(landing.details.benefits).toHaveLength(3);
      for (const benefit of landing.details.benefits) {
        expect(Object.keys(benefit).sort()).toEqual(["description", "title"]);
        expect(benefit.title.length).toBeGreaterThan(0);
        expect(benefit.description.length).toBeGreaterThan(0);
      }
      expect(landing.details.ctaTitle.length).toBeGreaterThan(0);
      expect(landing.details.ctaDescription.length).toBeGreaterThan(0);
      expect(landing.details.ctaLabel.length).toBeGreaterThan(0);
    }
    expect(spanish.Landing.details.ctaLabel).toBe("Crear cuenta");
    expect(english.Landing.details.ctaLabel).toBe("Create account");
  });
});
