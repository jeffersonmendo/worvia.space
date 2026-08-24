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
const pageSource = await Bun.file(
  new URL("../../app/[locale]/page.tsx", import.meta.url),
).text();
const globalStyles = await Bun.file(
  new URL("../../app/globals.css", import.meta.url),
).text();
const english = await Bun.file(
  new URL("../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../messages/es.json", import.meta.url),
).json();

const wordCount = (value: string) => value.trim().split(/\s+/).length;

describe("PortalLanding", () => {
  test("adds document scroll and detaches the hero surface from the viewport", () => {
    expect(PORTAL_LANDING_LAYOUT.viewport).toContain("min-h-dvh");
    expect(PORTAL_LANDING_LAYOUT.viewport).not.toContain("overflow-hidden");
    expect(PORTAL_LANDING_LAYOUT.hero).toContain("sticky");
    expect(PORTAL_LANDING_LAYOUT.heroTrack).toContain(
      `calc(100dvh+${PORTAL_LANDING_SCROLL.distance}px)`,
    );
    expect(source).toContain("useScroll");
    expect(source).toContain("useTransform");
    expect(PORTAL_LANDING_SCROLL.inset).toBeGreaterThanOrEqual(20);
    expect(PORTAL_LANDING_SCROLL.radius).toBeGreaterThanOrEqual(16);
    expect(PORTAL_LANDING_SCROLL.contentOffset).toBe(68);
    expect(PORTAL_LANDING_SCROLL.distance).toBe(240);
    expect(source).toContain("clipPath");
    expect(source).toContain("const contentY = useTransform(");
    expect(source).toContain("style={{ y: contentY }}");
    expect(source).toContain("reducedMotion ? [0, 0]");
  });

  test("compacts every vertical region for short viewports", () => {
    for (const region of [
      PORTAL_LANDING_LAYOUT.hero,
      PORTAL_LANDING_LAYOUT.portal,
      PORTAL_LANDING_LAYOUT.title,
      PORTAL_LANDING_LAYOUT.description,
      PORTAL_LANDING_LAYOUT.cta,
    ]) {
      expect(region).toContain("[@media(max-height:500px)]:");
    }
  });

  test("keeps the portal movement visible while allowing reduced motion", () => {
    expect(PORTAL_SHADER_PRESENTATION.speed).toBeGreaterThanOrEqual(0.5);
    expect(PORTAL_SHADER_PRESENTATION.className).toContain("opacity-90");
    expect(source).toContain("useReducedMotion");
  });

  test("reveals the portal before the supporting copy and action", () => {
    expect(PORTAL_LANDING_ENTRY.frameDelay).toBeLessThan(
      PORTAL_LANDING_ENTRY.ignitionDelay,
    );
    expect(PORTAL_LANDING_ENTRY.ignitionDelay).toBeLessThan(
      PORTAL_LANDING_ENTRY.expansionDelay,
    );
    expect(PORTAL_LANDING_ENTRY.expansionDelay).toBeLessThan(
      PORTAL_LANDING_ENTRY.titleDelay,
    );
    expect(PORTAL_LANDING_ENTRY.titleDelay).toBeLessThan(
      PORTAL_LANDING_ENTRY.descriptionDelay,
    );
    expect(PORTAL_LANDING_ENTRY.descriptionDelay).toBeLessThan(
      PORTAL_LANDING_ENTRY.ctaDelay,
    );
    expect(
      PORTAL_LANDING_ENTRY.ctaDelay + PORTAL_LANDING_ENTRY.contentDuration,
    ).toBeLessThanOrEqual(3);

    const maxTitleWords = Math.max(
      ...[english, spanish].map(
        ({ Landing }) =>
          wordCount(Landing.titleLine1) + wordCount(Landing.titleLine2),
      ),
    );
    const maxDescriptionWords = Math.max(
      ...[english, spanish].map(({ Landing }) =>
        wordCount(Landing.description),
      ),
    );
    const titleFinish =
      PORTAL_LANDING_ENTRY.titleDelay +
      (maxTitleWords - 1) * PORTAL_LANDING_ENTRY.titleStagger +
      PORTAL_LANDING_ENTRY.textRevealDuration;
    const descriptionFinish =
      PORTAL_LANDING_ENTRY.descriptionDelay +
      (maxDescriptionWords - 1) * PORTAL_LANDING_ENTRY.descriptionStagger +
      PORTAL_LANDING_ENTRY.textRevealDuration;

    expect(PORTAL_LANDING_ENTRY.titleDelay).toBeGreaterThanOrEqual(
      PORTAL_LANDING_ENTRY.expansionDelay +
        PORTAL_LANDING_ENTRY.expansionDuration,
    );
    expect(PORTAL_LANDING_ENTRY.descriptionDelay).toBeGreaterThanOrEqual(
      PORTAL_LANDING_ENTRY.expansionDelay +
        PORTAL_LANDING_ENTRY.expansionDuration,
    );
    expect(Math.max(titleFinish, descriptionFinish)).toBeLessThanOrEqual(3);
  });

  test("inherits the active theme without flashing the portal visual", () => {
    expect(PORTAL_LANDING_LAYOUT.viewport.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.viewport).toContain("bg-background");
    expect(PORTAL_LANDING_LAYOUT.heroTrack).toContain("bg-background");
    expect(PORTAL_LANDING_LAYOUT.hero).toContain("bg-background");
    expect(PORTAL_LANDING_LAYOUT.frame).toContain("bg-background");
    expect(PORTAL_LANDING_LAYOUT.header).toContain("bg-brand-surface-strong");
    expect(globalStyles).toContain(
      "--color-brand-surface-strong: var(--brand-surface-strong);",
    );
    const rootTheme = globalStyles.slice(
      globalStyles.indexOf(":root {"),
      globalStyles.indexOf(".dark {"),
    );
    const darkTheme = globalStyles.slice(globalStyles.indexOf(".dark {"));
    expect(rootTheme).toContain(
      "--brand-surface-strong: oklch(0.5 0.19 292 / 22%);",
    );
    expect(darkTheme).toContain(
      "--brand-surface-strong: oklch(0.72 0.14 292 / 10%);",
    );
    expect(source).toContain("PORTAL_LANDING_ENTRY.frameDelay");
    expect(source).toContain("PORTAL_LANDING_ENTRY.ignitionDelay");
  });

  test("keeps only the requested landing accents invariant white", () => {
    expect(PORTAL_LANDING_LAYOUT.viewport.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.heroTrack.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.hero.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.frame.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.details.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.finalCta.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.header.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.initialHeader.split(" ")).not.toContain(
      "dark",
    );
    expect(PORTAL_LANDING_LAYOUT.heroCopy.split(" ")).not.toContain("dark");
    expect(PORTAL_LANDING_LAYOUT.heroCopy.split(" ")).toContain("contents");
    expect(PORTAL_LANDING_LAYOUT.title.split(" ")).toContain("text-white");
    expect(PORTAL_LANDING_LAYOUT.description.split(" ")).toContain(
      "text-white/80",
    );
    expect(source).toContain(
      "<div className={PORTAL_LANDING_LAYOUT.heroCopy}>",
    );

    const heroCopyStart = source.indexOf(
      "<div className={PORTAL_LANDING_LAYOUT.heroCopy}>",
    );
    const heroCopyEnd = source.indexOf("</div>", heroCopyStart);
    const heroCopy = source.slice(heroCopyStart, heroCopyEnd);

    expect(heroCopy).toContain('as="h1"');
    expect(heroCopy).toContain('as="p"');
    expect(heroCopy).not.toContain("PORTAL_LANDING_LAYOUT.cta");

    const initialNavStart = source.indexOf("function InitialLandingHeaderNav(");
    const scrollNavStart = source.indexOf("function ScrollLandingHeaderNav(");
    const initialNav = source.slice(initialNavStart, scrollNavStart);
    const scrollNavEnd = source.indexOf(
      "export function PortalLanding(",
      scrollNavStart,
    );
    const scrollNav = source.slice(scrollNavStart, scrollNavEnd);
    const initialOutlineLinkStart = initialNav.indexOf('href="/auth/sign-up"');
    const initialOutlineLink = initialNav.slice(
      initialNav.lastIndexOf("<Link", initialOutlineLinkStart),
      initialNav.indexOf("</Link>", initialOutlineLinkStart),
    );

    expect(initialNav).toContain("<IconSpiral");
    expect(initialNav).toContain('className="size-8 stroke-[1.5] text-white"');
    expect(initialOutlineLink).toContain('"rounded-full text-white"');
    expect(scrollNav).toContain("<IconSpiral");
    expect(scrollNav).toContain('className="size-8 stroke-[1.5]"');
    expect(scrollNav).not.toContain("text-white");
  });

  test("renders the SSR-safe ignition inside a visible obsidian frame", () => {
    expect(PORTAL_LANDING_ENTRY.initialHeight).toContain("400px");
    expect(PORTAL_LANDING_LAYOUT.portalFrame).toContain(
      "portal-obsidian-frame",
    );
    expect(PORTAL_LANDING_LAYOUT.fallback).toContain("portal-landing-fallback");
    expect(source).toContain("PORTAL_LANDING_LAYOUT.portalFrame");
    expect(source).toContain("PORTAL_LANDING_LAYOUT.fallback");
    expect(globalStyles).toContain(".portal-obsidian-frame");
    expect(source).toContain("PORTAL_LANDING_LAYOUT.ignitionLayer");
    expect(globalStyles).not.toContain("@keyframes portal-landing-ignite");
    const fallbackRule = globalStyles.match(
      /\.portal-landing-fallback\s*\{[\s\S]*?\}/,
    );
    expect(fallbackRule?.[0]).not.toContain("animation:");
  });

  test("keeps brand marks in the two header navs only", () => {
    expect(source.match(/<IconSpiral/g)).toHaveLength(2);
    expect(source).toContain('aria-label="Worvia"');
    expect(source).not.toContain('role="img"');
    expect(source).not.toContain(
      '<IconSpiral\n                  aria-label="Worvia"',
    );
    expect(source).not.toContain("PORTAL_LANDING_LAYOUT.logo");
    expect(source).not.toContain("eyebrow");
  });

  test("reveals the fixed header after parallax without fading the hero mark", () => {
    expect(PORTAL_LANDING_SCROLL.headerRevealStart).toBe(400);
    expect(PORTAL_LANDING_SCROLL.headerRevealEnd).toBe(460);
    expect(PORTAL_LANDING_LAYOUT.header).toContain("fixed");
    expect(PORTAL_LANDING_LAYOUT.header).toContain("h-16");
    expect(PORTAL_LANDING_LAYOUT.header).not.toContain("border-b");
    expect(PORTAL_LANDING_LAYOUT.header).not.toContain("border-black");
    expect(PORTAL_LANDING_LAYOUT.header).not.toContain("border-border");
    expect(PORTAL_LANDING_LAYOUT.header).toContain("bg-brand-surface-strong");
    expect(PORTAL_LANDING_LAYOUT.header).toContain("backdrop-blur");
    expect(source).toContain("const headerOpacity = useTransform(");
    expect(source).toContain("const headerY = useTransform(");
    expect(source).toContain("reducedMotion ? [0, 0] : [-14, 0]");
    expect(source).not.toContain("headerTop");
    expect(source).not.toContain("headerInset");
    expect(source).not.toContain("headerBorderRadius");
    const fixedHeaderStart = source.indexOf(
      "<motion.header\n        className={PORTAL_LANDING_LAYOUT.header}",
    );
    const fixedHeaderEnd = source.indexOf("</motion.header>", fixedHeaderStart);
    const fixedHeader = source.slice(fixedHeaderStart, fixedHeaderEnd);
    expect(fixedHeader).not.toContain("padding");
    expect(source).toContain("y: headerY");
    expect(source).not.toContain("heroMarkOpacity");
    expect(source).not.toContain("style={{ opacity: heroMarkOpacity }}");
    expect(source).toContain("visibility: headerVisibility");
    expect(source.match(/<IconSpiral/g)).toHaveLength(2);
    expect(source).toContain('href="/auth/sign-up"');
    expect(source).toContain("href={entryHref}");
    expect(pageSource).toContain("headerCreateAccountLabel={");
    expect(pageSource).toContain("headerEntryLabel={");
    expect(english.Landing.header).toEqual({
      createAccount: "Create account",
      enter: "Enter",
      signIn: "Log in",
    });
    expect(spanish.Landing.header).toEqual({
      createAccount: "Crear cuenta",
      enter: "Entrar",
      signIn: "Ingresar",
    });
  });

  test("explains portal pricing and labels every plan as priceable", () => {
    expect(source).toContain('aria-labelledby="landing-pricing-title"');
    expect(source).toContain("details.pricing.title");
    expect(source).toContain("details.pricing.description");
    expect(source).toContain("{plan.pricing}");
    expect(source).toContain("from-brand-surface-strong");
    expect(english.Landing.details.pricing).toEqual({
      title: "Put a price on your project.",
      description:
        "Designers can set a price for project access and turn a finished presentation into a paid experience for their clients.",
    });
    expect(spanish.Landing.details.pricing).toEqual({
      title: "Ponle precio a tu proyecto.",
      description:
        "Los diseñadores pueden fijar un precio para el acceso al proyecto y convertir una presentación terminada en una experiencia de pago para sus clientes.",
    });

    for (const locale of [english, spanish]) {
      for (const plan of [
        locale.Landing.details.plans.free,
        locale.Landing.details.plans.starter,
        locale.Landing.details.plans.pro,
        locale.Landing.details.plans.premium,
      ]) {
        expect(plan.pricing).toBeTruthy();
      }
    }
  });

  test("shares large prioritized actions with a transparent initial header", () => {
    expect(PORTAL_LANDING_LAYOUT.initialHeader).toContain("absolute");
    expect(PORTAL_LANDING_LAYOUT.initialHeader).toContain("h-16");
    expect(PORTAL_LANDING_LAYOUT.initialHeader).not.toMatch(/(?:^|\s)bg-/);
    expect(PORTAL_LANDING_LAYOUT.initialHeader).not.toContain("border");
    expect(PORTAL_LANDING_LAYOUT.initialHeader).not.toContain("backdrop-blur");
    expect(PORTAL_LANDING_LAYOUT.initialHeader).not.toContain("fixed");
    expect(PORTAL_LANDING_LAYOUT.initialHeader).not.toContain("sticky");
    expect(source).not.toContain("initialHeaderVisibility");
    const initialHeaderClass = source.indexOf(
      "className={PORTAL_LANDING_LAYOUT.initialHeader}",
    );
    const initialHeaderStart = source.lastIndexOf(
      "<motion.header",
      initialHeaderClass,
    );
    const initialHeaderEnd = source.indexOf(
      "</motion.header>",
      initialHeaderStart,
    );
    const initialHeader = source.slice(initialHeaderStart, initialHeaderEnd);
    expect(initialHeaderStart).toBeGreaterThan(-1);
    expect(initialHeader).not.toContain("style={{ visibility:");
    expect(initialHeader).toContain(
      "initial={reducedMotion ? false : { opacity: 0, y: -12 }}",
    );
    expect(initialHeader).toContain("animate={{ opacity: 1, y: 0 }}");
    expect(initialHeader).toContain(
      "delay: reducedMotion ? 0 : PORTAL_LANDING_ENTRY.titleDelay",
    );
    expect(initialHeader).toContain("duration: reducedMotion");
    expect(initialHeader).toContain("PORTAL_LANDING_ENTRY.contentDuration");
    expect(source).toContain("const initialHeaderPadding = useTransform(");
    const paddingTransformStart = source.indexOf(
      "const initialHeaderPadding = useTransform(",
    );
    const paddingTransformEnd = source.indexOf(");", paddingTransformStart);
    const paddingTransform = source.slice(
      paddingTransformStart,
      paddingTransformEnd,
    );
    expect(paddingTransform).toContain(
      "reducedMotion ? [0, 1] : [0, PORTAL_LANDING_SCROLL.distance]",
    );
    expect(paddingTransform).toContain("[0, 20]");
    expect(paddingTransform).not.toContain("[20, 20]");
    expect(initialHeader).toContain("paddingLeft: initialHeaderPadding");
    expect(initialHeader).toContain("paddingRight: initialHeaderPadding");
    expect(initialHeader).toContain("paddingTop: initialHeaderPadding");
    expect(initialHeader).not.toContain("paddingBottom");
    expect(source).toContain(
      "const [isInitialHeaderInteractive, setIsInitialHeaderInteractive] =",
    );
    expect(source).toContain("useState(false)");
    expect(source).toContain(
      "useEffect(() => {\n    if (reducedMotion) {\n      setIsInitialHeaderInteractive(true);\n    }\n  }, [reducedMotion]);",
    );
    expect(initialHeader).toContain("inert={!isInitialHeaderInteractive}");
    expect(initialHeader).toContain(
      "onAnimationComplete={() => setIsInitialHeaderInteractive(true)}",
    );
    expect(source).not.toContain("function LandingHeaderNav(");
    expect(source).not.toContain("<LandingHeaderNav");
    expect(source.match(/<InitialLandingHeaderNav/g)).toHaveLength(1);
    expect(source.match(/<ScrollLandingHeaderNav/g)).toHaveLength(1);
    expect(source.match(/<IconSpiral/g)).toHaveLength(2);

    const initialNavStart = source.indexOf("function InitialLandingHeaderNav(");
    const scrollNavStart = source.indexOf("function ScrollLandingHeaderNav(");
    const initialNav = source.slice(initialNavStart, scrollNavStart);
    const scrollNavEnd = source.indexOf(
      "export function PortalLanding(",
      scrollNavStart,
    );
    const scrollNav = source.slice(scrollNavStart, scrollNavEnd);
    const initialCreateStart = initialNav.indexOf('href="/auth/sign-up"');
    const initialCreate = initialNav.slice(
      initialNav.lastIndexOf("<Link", initialCreateStart),
      initialNav.indexOf("</Link>", initialCreateStart),
    );
    const initialEntryStart = initialNav.indexOf("href={entryHref}");
    const initialEntry = initialNav.slice(
      initialNav.lastIndexOf("<Link", initialEntryStart),
      initialNav.indexOf("</Link>", initialEntryStart),
    );
    const scrollCreateStart = scrollNav.indexOf('href="/auth/sign-up"');
    const scrollCreate = scrollNav.slice(
      scrollNav.lastIndexOf("<Link", scrollCreateStart),
      scrollNav.indexOf("</Link>", scrollCreateStart),
    );
    const scrollEntryStart = scrollNav.indexOf("href={entryHref}");
    const scrollEntry = scrollNav.slice(
      scrollNav.lastIndexOf("<Link", scrollEntryStart),
      scrollNav.indexOf("</Link>", scrollEntryStart),
    );

    expect(initialNavStart).toBeGreaterThan(-1);
    expect(scrollNavStart).toBeGreaterThan(initialNavStart);
    expect(initialCreate).toContain(
      'buttonVariants({ size: "lg", variant: "link" })',
    );
    expect(initialCreate).not.toContain('variant: "outline"');
    expect(initialCreate).not.toMatch(/\bbg-/);
    expect(initialCreate).not.toMatch(/\bborder-/);
    expect(initialNav).toContain(
      'buttonVariants({ size: "lg", variant: "default" })',
    );
    expect(initialEntry).toContain("bg-white");
    expect(initialEntry).toContain("text-black");
    expect(initialNav.indexOf('href="/auth/sign-up"')).toBeLessThan(
      initialNav.indexOf("href={entryHref}"),
    );
    expect(scrollCreate).toContain(
      'buttonVariants({ size: "lg", variant: "link" })',
    );
    expect(scrollCreate).not.toContain('variant: "outline"');
    expect(scrollCreate).not.toMatch(/\bbg-/);
    expect(scrollCreate).not.toMatch(/\bborder-/);
    expect(scrollNav).toContain(
      'buttonVariants({ size: "lg", variant: "default" })',
    );
    expect(scrollEntry).not.toContain("bg-white");
    expect(scrollEntry).not.toContain("text-black");
    expect(scrollNav.indexOf('href="/auth/sign-up"')).toBeLessThan(
      scrollNav.indexOf("href={entryHref}"),
    );
  });

  test("expands the portal window without scaling the shader plane", () => {
    expect(PORTAL_LANDING_ENTRY.expandedWidth).toBe("100%");
    expect(PORTAL_LANDING_ENTRY.expandedHeight).toBe("100dvh");
    expect(source).toContain("PORTAL_LANDING_ENTRY.expansionDuration");
    expect(PORTAL_LANDING_LAYOUT.gradientPlane).toContain("w-screen");
    expect(PORTAL_LANDING_LAYOUT.gradientPlane).toContain("h-dvh");
    expect(source).toContain("PORTAL_LANDING_LAYOUT.gradientPlane");
    expect(source).not.toContain("PORTAL_LANDING_ENTRY.expansionScale");
    expect(source).not.toContain("scale: reducedMotion");
    expect(source).not.toContain("style={{ scale");
    expect(source).not.toContain("maxPixelCount={1920 * 1080}");
    expect(PORTAL_LANDING_LAYOUT.portal).not.toContain("260px)]!");
    expect(PORTAL_LANDING_LAYOUT.content).toContain("z-10");
  });

  test("separates the transparent editorial section from its sign-up action", () => {
    expect(source).toContain('href="/auth/sign-up"');
    expect(source).toContain('buttonVariants({ size: "lg"');
    expect(source).toContain("rounded-full");
    expect(source).toContain("details.benefits.map");
    expect(PORTAL_LANDING_LAYOUT.details).not.toMatch(/(?:^|\s)bg-/);
    expect(PORTAL_LANDING_LAYOUT.finalCta).not.toMatch(/(?:^|\s)bg-/);
    expect(source).toContain("PORTAL_LANDING_LAYOUT.finalCta");
    expect(source).toContain('className="w-full max-w-4xl"');
    expect(source).toContain("<article");
    expect(source).not.toContain(
      'className="flex flex-col gap-5 border-t border-border py-8"',
    );
    expect(source).toContain("<h3");
    expect(source).not.toContain("benefit.label");
    expect(source).not.toContain("benefit.outcome");
    expect(source).toContain("<Separator />");

    const detailsStart = source.indexOf(
      "<section className={PORTAL_LANDING_LAYOUT.details}>",
    );
    const detailsEnd = source.indexOf("</section>", detailsStart);
    const finalCtaStart = source.indexOf(
      "<section className={PORTAL_LANDING_LAYOUT.finalCta}>",
    );
    expect(detailsStart).toBeGreaterThan(-1);
    expect(detailsEnd).toBeLessThan(finalCtaStart);
    expect(source.slice(detailsStart, detailsEnd)).not.toContain("Separator");
    expect(source.slice(finalCtaStart)).toContain("<Separator />");
  });

  test("communicates the real Free and Premium limits per portal", () => {
    expect(source).toContain("details.plans.free");
    expect(source).toContain('id="landing-plans-title"');
    expect(english.Landing.details.plans.free.features).toContain(
      "100 MB for this project",
    );
    expect(english.Landing.details.plans.premium.features).toContain(
      "2 GB dedicated to this project",
    );
    expect(spanish.Landing.details.plans.free.features).toContain(
      "100 MB para este proyecto",
    );
    expect(spanish.Landing.details.plans.premium.features).toContain(
      "2 GB dedicados a este proyecto",
    );
  });

  test("uses filled Tabler icons for every landing benefit", () => {
    const tablerImport = source.slice(
      source.indexOf("import {"),
      source.indexOf('} from "@tabler/icons-react"'),
    );
    const benefitIconSetup = source.slice(
      source.indexOf("const benefitIcons ="),
      source.indexOf("return (", source.indexOf("const benefitIcons =")),
    );

    expect(tablerImport).toContain("IconPresentationFilled");
    expect(tablerImport).toContain("IconFoldersFilled");
    expect(tablerImport).toContain("IconSparklesFilled");
    expect(tablerImport).not.toMatch(/\bIconPresentation\b/);
    expect(tablerImport).not.toMatch(/\bIconFolders\b/);
    expect(tablerImport).not.toMatch(/\bIconSparkles\b/);
    expect(benefitIconSetup.indexOf("IconPresentationFilled")).toBeLessThan(
      benefitIconSetup.indexOf("IconFoldersFilled"),
    );
    expect(benefitIconSetup.indexOf("IconFoldersFilled")).toBeLessThan(
      benefitIconSetup.indexOf("IconSparklesFilled"),
    );
    expect(source).toContain("benefitIcons[index] ?? IconSparklesFilled");
  });

  test("covers every viewport edge without retaining the frame inset", () => {
    expect(PORTAL_LANDING_LAYOUT.portalInterior.split(" ")).toContain(
      "inset-0",
    );
    expect(PORTAL_LANDING_LAYOUT.portalInterior).not.toContain("inset-5");
    expect(PORTAL_LANDING_LAYOUT.portal).not.toContain("p-5");
    expect(globalStyles).toContain("border: 20px solid");
  });

  test("removes the obsidian frame before the portal finishes opening", () => {
    expect(PORTAL_LANDING_ENTRY.frameFadeProgress).toBeGreaterThan(0);
    expect(PORTAL_LANDING_ENTRY.frameFadeProgress).toBeLessThan(1);
    expect(source).toContain("PORTAL_LANDING_ENTRY.frameFadeProgress");
    expect(source).toContain("opacity: reducedMotion ? 0 : [1, 1, 0]");
  });
});
