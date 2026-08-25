import { describe, expect, test } from "bun:test";

const locales = await Promise.all(
  ["es", "en"].map(async (locale) =>
    Bun.file(
      new URL(`../../../messages/${locale}.json`, import.meta.url),
    ).json(),
  ),
);

describe("strategic landing contract", () => {
  test("keeps the full structured narrative in parity", () => {
    const [spanish, english] = locales.map(({ Landing }) => Landing);
    expect(Object.keys(spanish.details).sort()).toEqual(
      Object.keys(english.details).sort(),
    );
    for (const key of [
      "navigation",
      "demo",
      "steps",
      "journeys",
      "monetization",
      "buyer",
      "ai",
      "security",
      "plans",
      "faq",
    ]) {
      expect(spanish.details[key]).toBeTruthy();
      expect(english.details[key]).toBeTruthy();
    }
  });

  test("publishes commercial facts without unsupported claims", () => {
    for (const { Landing } of locales) {
      const copy = JSON.stringify(Landing);
      expect(copy).toContain("4.35");
      expect(copy).toContain("500");
      expect(copy).toContain("5%");
      expect(copy).toContain("8%");
      expect(copy).toContain("Stripe");
      expect(copy).toContain("7");
      expect(copy).toContain("3");
      expect(copy).toContain("2");
      expect(copy).toContain("1");
      expect(copy.toLowerCase()).not.toContain("marketplace");
      expect(copy).not.toMatch(/(?:buy|purchase|comprar) (?:AI )?credits/i);
    }
  });

  test("publishes corrected Free, Starter, and Premium limits", () => {
    for (const { Landing } of locales) {
      const free = Landing.details.plans.free.features.join(" ");
      const starter = Landing.details.plans.starter.features.join(" ");
      const premium = Landing.details.plans.premium.features.join(" ");
      expect(free).toMatch(/2|dos/);
      expect(starter).toContain("15");
      for (const value of [
        "100",
        "2 GB",
        "10",
        "60",
        "8",
        "20",
        "80",
        "500 MB",
      ]) {
        expect(premium).toContain(value);
      }
    }
  });
});
