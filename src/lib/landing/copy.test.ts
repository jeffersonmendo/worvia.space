import { describe, expect, test } from "bun:test";

const spanish = await Bun.file(
  new URL("../../../messages/es.json", import.meta.url),
).json();
const english = await Bun.file(
  new URL("../../../messages/en.json", import.meta.url),
).json();

describe("landing copy", () => {
  test("localizes the central present, deliver, and sell promise", () => {
    expect(spanish.Landing.titleLine1).toContain("Presenta");
    expect(spanish.Landing.titleLine1).toContain("entrega");
    expect(spanish.Landing.titleLine1).toContain("vende");
    expect(english.Landing.titleLine1).toContain("Present");
    expect(english.Landing.titleLine1).toContain("deliver");
    expect(english.Landing.titleLine1).toContain("sell");
    expect(spanish.Landing.cta).not.toBe(english.Landing.cta);
  });

  test("keeps every strategic section localized with matching keys", () => {
    expect(Object.keys(spanish.Landing).sort()).toEqual(
      Object.keys(english.Landing).sort(),
    );
    expect(Object.keys(spanish.Landing.details).sort()).toEqual(
      Object.keys(english.Landing.details).sort(),
    );
    expect(spanish.Landing.details.faq.items).toHaveLength(7);
    expect(english.Landing.details.faq.items).toHaveLength(7);
  });
});
