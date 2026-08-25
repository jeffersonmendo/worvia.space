"use client";

import { IconArrowUpRight, IconMenu2, IconSpiral } from "@tabler/icons-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useEffect, useState } from "react";
import { ShaderBackground } from "@/components/motion/shader-background";
import { TextReveal } from "@/components/motion/text-reveal";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { getLandingActionHrefs } from "@/lib/landing/actions";
import { cn } from "@/lib/utils";
import { LandingSections } from "./landing-sections";
import type { LandingDetails } from "./landing-types";
import {
  PORTAL_LANDING_ENTRY,
  PORTAL_LANDING_LAYOUT,
  PORTAL_LANDING_SCROLL,
  PORTAL_SHADER_PRESENTATION,
} from "./portal-landing.config";

type PortalLandingProps = {
  buttonLabel: string;
  description: string;
  details: LandingDetails;
  entryHref: "/home" | "/auth/sign-up";
  headerCreateAccountLabel: string;
  headerEntryLabel: string;
  headerLanguageLabel: string;
  headerMenuLabel: string;
  locale: string;
  title: string[];
};

type LandingHeaderNavProps = Pick<
  PortalLandingProps,
  "entryHref" | "headerCreateAccountLabel" | "headerEntryLabel"
> &
  Pick<
    PortalLandingProps,
    "details" | "headerLanguageLabel" | "headerMenuLabel" | "locale"
  >;

function HeaderActions({
  details,
  entryHref,
  headerCreateAccountLabel,
  headerEntryLabel,
  headerLanguageLabel,
  headerMenuLabel,
  locale,
  inverted = false,
}: LandingHeaderNavProps & { inverted?: boolean }) {
  const alternateLocale = locale === "es" ? "en" : "es";
  const actionHrefs = getLandingActionHrefs(entryHref);
  return (
    <>
      <div className="hidden items-center gap-5 lg:flex">
        {details.navigation.map((item) => (
          <a
            className={cn(
              "text-sm transition-colors",
              inverted
                ? "text-white/75 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Link
          aria-label={`${headerLanguageLabel}: ${alternateLocale.toUpperCase()}`}
          className={cn(
            buttonVariants({ size: "sm", variant: "ghost" }),
            inverted && "text-white hover:bg-white/10 hover:text-white",
          )}
          href="/"
          locale={alternateLocale}
        >
          {alternateLocale.toUpperCase()}
        </Link>
        <Link
          className={cn(
            buttonVariants({ size: "sm", variant: "ghost" }),
            inverted && "text-white hover:bg-white/10 hover:text-white",
          )}
          href={actionHrefs.enter}
        >
          {headerEntryLabel}
        </Link>
        <Link
          className={cn(
            buttonVariants({ size: "sm" }),
            inverted && "bg-white text-black hover:bg-white/90",
          )}
          href={actionHrefs.create}
        >
          {headerCreateAccountLabel}
        </Link>
      </div>
      <Sheet>
        <SheetTrigger
          className={cn(
            buttonVariants({ size: "icon", variant: "ghost" }),
            "sm:hidden",
            inverted && "text-white hover:bg-white/10 hover:text-white",
          )}
          aria-label={headerMenuLabel}
        >
          <IconMenu2 />
        </SheetTrigger>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Worvia</SheetTitle>
          </SheetHeader>
          <nav
            aria-label={headerMenuLabel}
            className="flex flex-col gap-1 px-4"
          >
            {details.navigation.map((item) => (
              <SheetClose
                key={item.href}
                render={
                  <a
                    aria-label={item.label}
                    className={buttonVariants({ variant: "ghost" })}
                    href={item.href}
                  >
                    <span className="sr-only">{item.label}</span>
                  </a>
                }
              >
                {item.label}
              </SheetClose>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 p-4">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/"
              locale={alternateLocale}
            >
              {headerLanguageLabel}: {alternateLocale.toUpperCase()}
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={actionHrefs.enter}
            >
              {headerEntryLabel}
            </Link>
            <Link className={buttonVariants()} href={actionHrefs.create}>
              {headerCreateAccountLabel}
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function InitialLandingHeaderNav({
  details,
  entryHref,
  headerCreateAccountLabel,
  headerEntryLabel,
  headerLanguageLabel,
  headerMenuLabel,
  locale,
}: LandingHeaderNavProps) {
  return (
    <nav
      aria-label="Worvia"
      className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
    >
      <Link aria-label="Worvia" className="inline-flex items-center" href="/">
        <IconSpiral
          aria-hidden="true"
          className="size-8 stroke-[1.5] text-white"
        />
      </Link>

      <HeaderActions
        inverted
        {...{
          details,
          entryHref,
          headerCreateAccountLabel,
          headerEntryLabel,
          headerLanguageLabel,
          headerMenuLabel,
          locale,
        }}
      />
    </nav>
  );
}

function ScrollLandingHeaderNav({
  details,
  entryHref,
  headerCreateAccountLabel,
  headerEntryLabel,
  headerLanguageLabel,
  headerMenuLabel,
  locale,
}: LandingHeaderNavProps) {
  return (
    <nav
      aria-label="Worvia"
      className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
    >
      <Link aria-label="Worvia" className="inline-flex items-center" href="/">
        <IconSpiral aria-hidden="true" className="size-8 stroke-[1.5]" />
      </Link>

      <HeaderActions
        {...{
          details,
          entryHref,
          headerCreateAccountLabel,
          headerEntryLabel,
          headerLanguageLabel,
          headerMenuLabel,
          locale,
        }}
      />
    </nav>
  );
}

export function PortalLanding({
  buttonLabel,
  description,
  details,
  entryHref,
  headerCreateAccountLabel,
  headerEntryLabel,
  headerLanguageLabel,
  headerMenuLabel,
  locale,
  title,
}: PortalLandingProps) {
  const [isInitialHeaderInteractive, setIsInitialHeaderInteractive] =
    useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      setIsInitialHeaderInteractive(true);
    }
  }, [reducedMotion]);
  const { scrollY } = useScroll();
  const clipPath = useTransform(
    scrollY,
    reducedMotion ? [0, 1] : [0, PORTAL_LANDING_SCROLL.distance],
    [
      "inset(0px round 0px)",
      `inset(${PORTAL_LANDING_SCROLL.inset}px round ${PORTAL_LANDING_SCROLL.radius}px)`,
    ],
  );
  const contentY = useTransform(
    scrollY,
    [0, PORTAL_LANDING_SCROLL.distance],
    reducedMotion ? [0, 0] : [0, PORTAL_LANDING_SCROLL.contentOffset],
  );
  const initialHeaderPadding = useTransform(
    scrollY,
    reducedMotion ? [0, 1] : [0, PORTAL_LANDING_SCROLL.distance],
    [0, 20],
  );
  const headerRevealRange = reducedMotion
    ? [
        PORTAL_LANDING_SCROLL.headerRevealStart,
        PORTAL_LANDING_SCROLL.headerRevealStart + 1,
      ]
    : [
        PORTAL_LANDING_SCROLL.headerRevealStart,
        PORTAL_LANDING_SCROLL.headerRevealEnd,
      ];
  const headerOpacity = useTransform(scrollY, headerRevealRange, [0, 1]);
  const headerY = useTransform(
    scrollY,
    headerRevealRange,
    reducedMotion ? [0, 0] : [-14, 0],
  );
  const headerVisibility = useTransform(scrollY, (value) =>
    value < PORTAL_LANDING_SCROLL.headerRevealStart ? "hidden" : "visible",
  );
  return (
    <main className={PORTAL_LANDING_LAYOUT.viewport}>
      <motion.header
        className={PORTAL_LANDING_LAYOUT.header}
        style={{
          opacity: headerOpacity,
          visibility: headerVisibility,
          y: headerY,
        }}
      >
        <ScrollLandingHeaderNav
          details={details}
          entryHref={entryHref}
          headerCreateAccountLabel={headerCreateAccountLabel}
          headerEntryLabel={headerEntryLabel}
          headerLanguageLabel={headerLanguageLabel}
          headerMenuLabel={headerMenuLabel}
          locale={locale}
        />
      </motion.header>

      <div className={PORTAL_LANDING_LAYOUT.heroTrack}>
        <div className={PORTAL_LANDING_LAYOUT.hero}>
          <div className={PORTAL_LANDING_LAYOUT.frame}>
            <motion.header
              animate={{ opacity: 1, y: 0 }}
              className={PORTAL_LANDING_LAYOUT.initialHeader}
              inert={!isInitialHeaderInteractive}
              initial={reducedMotion ? false : { opacity: 0, y: -12 }}
              onAnimationComplete={() => setIsInitialHeaderInteractive(true)}
              style={{
                paddingLeft: initialHeaderPadding,
                paddingRight: initialHeaderPadding,
                paddingTop: initialHeaderPadding,
              }}
              transition={{
                delay: reducedMotion ? 0 : PORTAL_LANDING_ENTRY.titleDelay,
                duration: reducedMotion
                  ? 0
                  : PORTAL_LANDING_ENTRY.contentDuration,
              }}
            >
              <InitialLandingHeaderNav
                details={details}
                entryHref={entryHref}
                headerCreateAccountLabel={headerCreateAccountLabel}
                headerEntryLabel={headerEntryLabel}
                headerLanguageLabel={headerLanguageLabel}
                headerMenuLabel={headerMenuLabel}
                locale={locale}
              />
            </motion.header>

            <div
              aria-hidden="true"
              className={PORTAL_LANDING_LAYOUT.portalStage}
            >
              <motion.div
                className={PORTAL_LANDING_LAYOUT.portal}
                style={{ clipPath }}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{
                  height: PORTAL_LANDING_ENTRY.expandedHeight,
                  opacity: 1,
                  width: PORTAL_LANDING_ENTRY.expandedWidth,
                }}
                transition={{
                  height: {
                    delay: reducedMotion
                      ? 0
                      : PORTAL_LANDING_ENTRY.expansionDelay,
                    duration: reducedMotion
                      ? 0
                      : PORTAL_LANDING_ENTRY.expansionDuration,
                    ease: [0.76, 0, 0.24, 1],
                  },
                  opacity: {
                    delay: reducedMotion ? 0 : PORTAL_LANDING_ENTRY.frameDelay,
                    duration: reducedMotion
                      ? 0
                      : PORTAL_LANDING_ENTRY.frameDuration,
                  },
                  width: {
                    delay: reducedMotion
                      ? 0
                      : PORTAL_LANDING_ENTRY.expansionDelay,
                    duration: reducedMotion
                      ? 0
                      : PORTAL_LANDING_ENTRY.expansionDuration,
                    ease: [0.76, 0, 0.24, 1],
                  },
                }}
              >
                <div className={PORTAL_LANDING_LAYOUT.portalInterior}>
                  <div className={PORTAL_LANDING_LAYOUT.gradientPlane}>
                    <motion.div
                      className={PORTAL_LANDING_LAYOUT.ignitionLayer}
                      initial={reducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        delay: reducedMotion
                          ? 0
                          : PORTAL_LANDING_ENTRY.ignitionDelay,
                        duration: reducedMotion
                          ? 0
                          : PORTAL_LANDING_ENTRY.ignitionDuration,
                      }}
                    >
                      <div
                        aria-hidden="true"
                        className={PORTAL_LANDING_LAYOUT.fallback}
                      />

                      <ShaderBackground
                        className={PORTAL_SHADER_PRESENTATION.className}
                        colors={["#050509", "#171129", "#7560a6", "#07070b"]}
                        distortion={0.78}
                        proportion={0.28}
                        shape="edge"
                        shapeScale={0.34}
                        softness={0.88}
                        speed={PORTAL_SHADER_PRESENTATION.speed}
                        swirl={0.82}
                        swirlIterations={7}
                        variant="warp"
                      />
                    </motion.div>
                  </div>
                </div>

                <motion.div
                  className={PORTAL_LANDING_LAYOUT.portalFrame}
                  initial={reducedMotion ? false : { opacity: 1 }}
                  animate={{ opacity: reducedMotion ? 0 : [1, 1, 0] }}
                  transition={{
                    delay: reducedMotion
                      ? 0
                      : PORTAL_LANDING_ENTRY.expansionDelay,
                    duration: reducedMotion
                      ? 0
                      : PORTAL_LANDING_ENTRY.expansionDuration,
                    times: [0, PORTAL_LANDING_ENTRY.frameFadeProgress, 1],
                  }}
                />
              </motion.div>
            </div>

            <motion.section
              className={PORTAL_LANDING_LAYOUT.content}
              style={{ y: contentY }}
            >
              <div className={PORTAL_LANDING_LAYOUT.heroCopy}>
                <TextReveal
                  as="h1"
                  blur={18}
                  className={PORTAL_LANDING_LAYOUT.title}
                  delay={reducedMotion ? 0 : PORTAL_LANDING_ENTRY.titleDelay}
                  split="word"
                  stagger={PORTAL_LANDING_ENTRY.titleStagger}
                  text={title}
                  yOffset="55%"
                />

                <TextReveal
                  as="p"
                  blur={8}
                  className={PORTAL_LANDING_LAYOUT.description}
                  delay={
                    reducedMotion ? 0 : PORTAL_LANDING_ENTRY.descriptionDelay
                  }
                  split="word"
                  stagger={PORTAL_LANDING_ENTRY.descriptionStagger}
                  text={description}
                  yOffset="30%"
                />
              </div>

              <motion.div
                className={PORTAL_LANDING_LAYOUT.cta}
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: reducedMotion ? 0 : PORTAL_LANDING_ENTRY.ctaDelay,
                  duration: reducedMotion
                    ? 0
                    : PORTAL_LANDING_ENTRY.contentDuration,
                }}
              >
                <Link
                  href={entryHref}
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "min-w-32 rounded-full",
                  )}
                >
                  {buttonLabel}
                  <IconArrowUpRight data-icon="inline-end" />
                </Link>
                <a
                  className={cn(
                    buttonVariants({ size: "lg", variant: "ghost" }),
                    "rounded-full text-white",
                  )}
                  href={details.navigation[0]?.href ?? "#product"}
                >
                  {details.heroSecondary}
                </a>
              </motion.div>
            </motion.section>
          </div>
        </div>
      </div>

      <LandingSections
        actionLabel={buttonLabel}
        details={details}
        entryHref={entryHref}
      />
    </main>
  );
}
