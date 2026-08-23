import { describe, expect, test } from "bun:test";
import { PORTAL_ENTRY_TIMING } from "./portal-entry-transition.config";

const source = await Bun.file(
  new URL("./portal-entry-transition.tsx", import.meta.url),
).text();
const pageSource = await Bun.file(
  new URL("../../app/[locale]/p/[slug]/page.tsx", import.meta.url),
).text();
const loadingSource = await Bun.file(
  new URL("../../app/[locale]/p/[slug]/loading.tsx", import.meta.url),
).text();
const english = await Bun.file(
  new URL("../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../messages/es.json", import.meta.url),
).json();

describe("PortalEntryTransition", () => {
  test("keeps the complete branded entrance within 850ms", () => {
    expect(PORTAL_ENTRY_TIMING.totalDuration).toBeLessThanOrEqual(0.85);
    expect(PORTAL_ENTRY_TIMING.identityDelay).toBeLessThan(
      PORTAL_ENTRY_TIMING.surfaceDelay,
    );
    expect(PORTAL_ENTRY_TIMING.surfaceDelay).toBeLessThan(
      PORTAL_ENTRY_TIMING.fadeDelay,
    );
    expect(
      PORTAL_ENTRY_TIMING.fadeDelay + PORTAL_ENTRY_TIMING.fadeDuration,
    ).toBe(PORTAL_ENTRY_TIMING.totalDuration);
  });

  test("uses motion preferences and restores content interaction", () => {
    expect(source).toContain('from "motion/react"');
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("inert={isEntryActive}");
    expect(source).toContain("onAnimationComplete");
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("reducedMotion ? false");
  });

  test("shows portal identity with an initial fallback and no cover image", () => {
    expect(source).toContain("iconUrl");
    expect(source).toContain("portalInitial");
    expect(source).toContain("onError");
    expect(source).not.toContain("coverUrl");
    expect(source).not.toContain("cover_url");
  });

  test("wraps only the allowed rendered portal", () => {
    const gateIndex = pageSource.indexOf(
      'access.decision === "password_required"',
    );
    const transitionIndex = pageSource.indexOf("<PortalEntryTransition");
    const rendererIndex = pageSource.indexOf("<RenderPortal");

    expect(gateIndex).toBeGreaterThan(-1);
    expect(transitionIndex).toBeGreaterThan(gateIndex);
    expect(rendererIndex).toBeGreaterThan(transitionIndex);
    expect(pageSource).toContain("name={renderDocument.portal.name}");
    expect(pageSource).toContain(
      "iconUrl={renderDocument.portal.icon_url ?? null}",
    );
  });

  test("provides a localized neutral route loader with Skeleton", () => {
    expect(loadingSource).toContain('from "@/components/ui/skeleton"');
    expect(loadingSource).toContain("useTranslations");
    expect(loadingSource).toContain('useTranslations("PublicPortal.loading")');
    expect(loadingSource).toContain("<output");
    expect(loadingSource).toContain('className="sr-only"');
    expect(loadingSource).toContain("w-full max-w-[900px]");
    expect(english.PublicPortal.loading.label).toBe("Loading portal");
    expect(spanish.PublicPortal.loading.label).toBe("Cargando portal");
  });
});
