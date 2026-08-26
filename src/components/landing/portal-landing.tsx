"use client";

import { IconArrowDown, IconSpiral } from "@tabler/icons-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ShaderBackground } from "@/components/motion/shader-background";
import { TextReveal } from "@/components/motion/text-reveal";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
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
  heroButtonLabel: string;
  headerCreateAccountLabel: string;
  headerEntryLabel: string;
  title: string[];
};

type LandingHeaderNavProps = Pick<
  PortalLandingProps,
  "headerCreateAccountLabel" | "headerEntryLabel"
> &
  Pick<PortalLandingProps, "details">;

type HeaderActionProps = Pick<
  PortalLandingProps,
  "headerCreateAccountLabel" | "headerEntryLabel"
>;

function HeaderActions({
  headerCreateAccountLabel,
  headerEntryLabel,
  inverted = false,
}: HeaderActionProps & { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link
        className={cn(
          buttonVariants({ size: "sm", variant: "link" }),
          inverted && "text-white hover:text-white/80",
        )}
        href="/auth/sign-up"
      >
        {headerCreateAccountLabel}
      </Link>
      <Link
        className={cn(
          buttonVariants({ size: "sm" }),
          "rounded-full",
          inverted && "bg-white text-black hover:bg-white/90",
        )}
        href="/auth/sign-in"
      >
        {headerEntryLabel}
      </Link>
    </div>
  );
}

function LandingNavigation({
  details,
  inverted = false,
}: Pick<LandingHeaderNavProps, "details"> & { inverted?: boolean }) {
  return (
    <div className="hidden items-center gap-1 lg:flex">
      {details.navigation.map((item) => (
        <a
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "rounded-full",
            inverted && "text-white/75 hover:bg-white/10 hover:text-white",
          )}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

function InitialLandingHeaderNav({
  details,
  headerCreateAccountLabel,
  headerEntryLabel,
}: LandingHeaderNavProps) {
  return (
    <nav
      aria-label="Worvia"
      className="relative z-10 mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4"
    >
      <div className="flex items-center gap-4">
        <Link aria-label="Worvia" className="inline-flex items-center" href="/">
          <IconSpiral
            aria-hidden="true"
            className="size-8 stroke-[1.5] text-white"
          />
        </Link>
        <LandingNavigation details={details} inverted />
      </div>

      <HeaderActions
        inverted
        {...{
          headerCreateAccountLabel,
          headerEntryLabel,
        }}
      />
    </nav>
  );
}

function ScrollLandingHeaderNav({
  details,
  headerCreateAccountLabel,
  headerEntryLabel,
}: LandingHeaderNavProps) {
  return (
    <nav
      aria-label="Worvia"
      className="relative z-10 mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4"
    >
      <div className="flex items-center gap-4">
        <Link aria-label="Worvia" className="inline-flex items-center" href="/">
          <IconSpiral aria-hidden="true" className="size-8 stroke-[1.5]" />
        </Link>
        <LandingNavigation details={details} />
      </div>

      <HeaderActions
        {...{
          headerCreateAccountLabel,
          headerEntryLabel,
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
  heroButtonLabel,
  headerCreateAccountLabel,
  headerEntryLabel,
  title,
}: PortalLandingProps) {
  const [isInitialHeaderInteractive, setIsInitialHeaderInteractive] =
    useState(false);
  const [isHeaderPastHero, setIsHeaderPastHero] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      setIsInitialHeaderInteractive(true);
    }
  }, [reducedMotion]);
  const { scrollY } = useScroll();
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsHeaderPastHero(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(hero);

    return () => observer.disconnect();
  }, []);
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
  const initialHeaderOpacity = useTransform(
    scrollY,
    reducedMotion ? [0, 1] : [0, PORTAL_LANDING_SCROLL.distance],
    reducedMotion ? [1, 1] : [1, 0],
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
  const scrollCueY = useTransform(
    scrollY,
    reducedMotion ? [0, 1] : [0, PORTAL_LANDING_SCROLL.distance],
    [0, -18],
  );
  return (
    <main className={PORTAL_LANDING_LAYOUT.viewport}>
      <motion.header
        className={cn(
          PORTAL_LANDING_LAYOUT.header,
          isHeaderPastHero &&
            "inset-x-auto top-2 left-1/2 w-[calc(100%-1rem)] max-w-7xl -translate-x-1/2 rounded-3xl border border-border/50",
          isHeaderPastHero
            ? "!bg-background/50 !backdrop-blur-xl"
            : "!bg-background !backdrop-blur-none",
        )}
        style={{
          opacity: headerOpacity,
          visibility: headerVisibility,
          y: headerY,
          backgroundColor: isHeaderPastHero
            ? "color-mix(in oklab, var(--background) 50%, transparent)"
            : "var(--background)",
          backdropFilter: isHeaderPastHero ? "blur(24px)" : "none",
          WebkitBackdropFilter: isHeaderPastHero ? "blur(24px)" : "none",
        }}
      >
        <ScrollLandingHeaderNav
          details={details}
          headerCreateAccountLabel={headerCreateAccountLabel}
          headerEntryLabel={headerEntryLabel}
        />
      </motion.header>

      <div className={PORTAL_LANDING_LAYOUT.heroTrack}>
        <div className={PORTAL_LANDING_LAYOUT.hero} ref={heroRef}>
          <div className={PORTAL_LANDING_LAYOUT.frame}>
            <motion.header
              animate={{ opacity: 1, y: 0 }}
              className={PORTAL_LANDING_LAYOUT.initialHeader}
              inert={!isInitialHeaderInteractive}
              initial={reducedMotion ? false : { opacity: 0, y: -12 }}
              onAnimationComplete={() => setIsInitialHeaderInteractive(true)}
              style={{
                opacity: initialHeaderOpacity,
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
                headerCreateAccountLabel={headerCreateAccountLabel}
                headerEntryLabel={headerEntryLabel}
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
                    buttonVariants({ size: "lg" }),
                    "min-w-32 rounded-full bg-white text-black hover:bg-white/90",
                  )}
                >
                  {heroButtonLabel}
                </Link>
              </motion.div>
            </motion.section>

            <motion.div
              aria-hidden="true"
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-white"
              initial={reducedMotion ? false : { opacity: 0 }}
              style={{ y: scrollCueY }}
              transition={{
                delay: reducedMotion ? 0 : PORTAL_LANDING_ENTRY.ctaDelay,
                duration: reducedMotion
                  ? 0
                  : PORTAL_LANDING_ENTRY.contentDuration,
              }}
            >
              <motion.div
                animate={reducedMotion ? undefined : { y: [0, 5, 0] }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  repeat: Number.POSITIVE_INFINITY,
                }}
              >
                <IconArrowDown size={28} />
              </motion.div>
            </motion.div>
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
