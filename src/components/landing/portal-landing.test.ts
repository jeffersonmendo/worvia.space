import { describe, expect, test } from "bun:test";
import {
  PORTAL_LANDING_ENTRY,
  PORTAL_LANDING_LAYOUT,
  PORTAL_LANDING_SCROLL,
  PORTAL_SHADER_PRESENTATION,
} from "./portal-landing.config";

const source = await Bun.file(
  new URL("./portal-landing.tsx", import.meta.url),
).text();
const sections = await Bun.file(
  new URL("./landing-sections.tsx", import.meta.url),
).text();
const pageSource = await Bun.file(
  new URL("../../app/[locale]/page.tsx", import.meta.url),
).text();

const messages = await Promise.all(
  ["es", "en"].map((locale) =>
    Bun.file(
      new URL(`../../../messages/${locale}.json`, import.meta.url),
    ).json(),
  ),
);

describe("PortalLanding", () => {
  test("preserves the animated identity and reduced-motion path", () => {
    expect(PORTAL_LANDING_LAYOUT.hero).toContain("sticky");
    expect(PORTAL_LANDING_LAYOUT.heroTrack).toContain(
      `calc(100dvh+${PORTAL_LANDING_SCROLL.distance}px)`,
    );
    expect(PORTAL_SHADER_PRESENTATION.speed).toBeGreaterThanOrEqual(0.5);
    expect(PORTAL_LANDING_ENTRY.expandedHeight).toBe("100dvh");
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("reducedMotion ? false");
    expect(source).toContain("reducedMotion ? [0, 0]");
  });

  test("renders auth-aware primary actions and an internal demo action", () => {
    expect(pageSource).toContain("getLandingEntryHref(isAuthenticated)");
    expect(source).toContain("href={entryHref}");
    expect(source).toContain("details.heroSecondary");
    expect(source).toContain("details.navigation[0]?.href");
    expect(pageSource).toContain("getLandingActionCopyKeys(isAuthenticated)");
    expect(pageSource).toContain("buttonLabel={t(actionCopyKeys.primary)}");
    expect(pageSource).toContain(
      "headerCreateAccountLabel={t(actionCopyKeys.primary)}",
    );
    expect(sections).toContain("{actionLabel}");
    expect(sections).toContain("href={entryHref}");
    expect(sections).not.toContain('href="/auth/sign-up"');
  });

  test("provides anchor navigation, language switching, and an accessible mobile sheet", () => {
    expect(source).toContain("details.navigation.map");
    expect(source).toContain("<SheetTitle>Worvia</SheetTitle>");
    expect(source).toContain("aria-label={headerMenuLabel}");
    expect(source).toContain("locale={alternateLocale}");
    for (const { Landing } of messages) {
      expect(Landing.details.navigation).toHaveLength(6);
      expect(
        Landing.details.navigation.every(({ href }: { href: string }) =>
          href.startsWith("#"),
        ),
      ).toBeTrue();
    }
  });

  test("builds focused product sections from installed design-system components", () => {
    for (const component of ["Card", "Badge", "Separator", "Accordion"]) {
      expect(sections).toContain(component);
    }
    for (const key of [
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
      expect(sections).toContain(`details.${key}`);
    }
    expect(sections).toContain(
      'const sectionClass = "relative z-20 scroll-mt-20',
    );
  });

  test("uses semantic sections and correctly labelled FAQ controls", () => {
    expect(sections.match(/<section/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sections).toContain("<AccordionTrigger>");
    expect(sections).toContain("<AccordionContent>");
    expect(sections).toContain('aria-labelledby="landing-demo-title"');
  });
});
