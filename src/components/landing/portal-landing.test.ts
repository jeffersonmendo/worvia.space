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
    expect(PORTAL_LANDING_LAYOUT.title).toContain("text-5xl");
    expect(PORTAL_LANDING_LAYOUT.content).toContain("select-none");
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain("!bg-background !backdrop-blur-none");
    expect(source).toContain("!bg-background/50 !backdrop-blur-xl");
    expect(source).toContain(
      '"inset-x-auto top-2 left-1/2 w-[calc(100%-1rem)] max-w-7xl -translate-x-1/2 rounded-3xl border border-border/50"',
    );
    expect(source).toContain(
      "color-mix(in oklab, var(--background) 50%, transparent)",
    );
    expect(source).toContain(
      'backdropFilter: isHeaderPastHero ? "blur(24px)" : "none"',
    );
    expect(source).toContain("const initialHeaderOpacity = useTransform");
    expect(PORTAL_LANDING_SCROLL.headerRevealStart).toBe(240);
    expect(PORTAL_LANDING_SCROLL.headerRevealEnd).toBe(300);
    expect(source).toContain("reducedMotion ? false");
    expect(source).toContain("reducedMotion ? [0, 0]");
  });

  test("renders auth-aware primary actions and an internal demo action", () => {
    expect(pageSource).toContain("getLandingEntryHref(isAuthenticated)");
    expect(source).toContain("href={entryHref}");
    expect(source).toContain("heroButtonLabel");
    expect(source).toContain('buttonVariants({ size: "lg" })');
    expect(source).toContain("bg-white text-black hover:bg-white/90");
    expect(source).not.toContain("details.heroSecondary");
    expect(source).toContain("IconArrowDown");
    expect(source).toContain("absolute bottom-6 left-1/2");
    expect(source).toContain("-translate-x-1/2");
    expect(source).toContain("text-white");
    expect(source).toContain("<IconArrowDown size={28} />");
    expect(source).toContain("repeat: Number.POSITIVE_INFINITY");
    expect(source).toContain(
      "initial={reducedMotion ? false : { opacity: 0 }}",
    );
    expect(source).toContain("[0, -18]");
    expect(pageSource).toContain("getLandingActionCopyKeys(isAuthenticated)");
    expect(pageSource).toContain("buttonLabel={t(actionCopyKeys.primary)}");
    expect(pageSource).toContain(
      'headerCreateAccountLabel={t("header.createAccount")}',
    );
    expect(pageSource).toContain('headerEntryLabel={t("header.signIn")}');
    expect(sections).toContain("{actionLabel}");
    expect(sections).toContain("href={entryHref}");
    expect(sections).not.toContain('href="/auth/sign-up"');
  });

  test("provides ghost anchor navigation and static auth actions", () => {
    expect(source).toContain("details.navigation.map");
    expect(source).not.toContain("Sheet");
    expect(source).toContain('className="flex items-center gap-1 sm:gap-2"');
    expect(source).not.toContain("headerLanguageLabel");
    expect(source).toContain(
      'buttonVariants({ variant: "ghost", size: "sm" })',
    );
    expect(source).toContain('buttonVariants({ size: "sm", variant: "link" })');
    expect(source).toContain('href="/auth/sign-in"');
    expect(source).toContain('href="/auth/sign-up"');
    expect(source).toContain('"rounded-full"');
    expect(source).toContain(
      'buttonVariants({ variant: "ghost", size: "sm" })',
    );
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
