"use client";

import {
  IconArrowUpRight,
  IconCheck,
  IconFoldersFilled,
  IconPresentationFilled,
  IconSparklesFilled,
  IconSpiral,
} from "@tabler/icons-react";
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  PORTAL_LANDING_ENTRY,
  PORTAL_LANDING_LAYOUT,
  PORTAL_LANDING_SCROLL,
  PORTAL_SHADER_PRESENTATION,
} from "./portal-landing.config";

type LandingDetails = {
  benefits: Array<{
    description: string;
    title: string;
  }>;
  ctaDescription: string;
  ctaLabel: string;
  ctaTitle: string;
  description: string;
  pricing: {
    description: string;
    title: string;
  };
  plans: {
    description: string;
    free: LandingPlan;
    starter: LandingPlan;
    pro: LandingPlan;
    perPortal: string;
    premium: LandingPlan;
    title: string;
  };
  title: string;
};

type LandingPlan = {
  cta: string;
  description: string;
  features: string[];
  name: string;
  price: string;
  pricing: string;
};

type PortalLandingProps = {
  buttonLabel: string;
  description: string;
  details: LandingDetails;
  entryHref: "/home" | "/auth/sign-in";
  headerCreateAccountLabel: string;
  headerEntryLabel: string;
  title: string[];
};

type LandingHeaderNavProps = Pick<
  PortalLandingProps,
  "entryHref" | "headerCreateAccountLabel" | "headerEntryLabel"
>;

function InitialLandingHeaderNav({
  entryHref,
  headerCreateAccountLabel,
  headerEntryLabel,
}: LandingHeaderNavProps) {
  return (
    <nav
      aria-label="Worvia"
      className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
    >
      <Link
        aria-label="Worvia"
        className="inline-flex items-center"
        href="/"
      >
        <IconSpiral
          aria-hidden="true"
          className="size-8 stroke-[1.5] text-white"
        />
      </Link>

      <div className="flex items-center gap-2">
        <Link
          className={cn(
            buttonVariants({ size: "lg", variant: "link" }),
            "rounded-full text-white",
          )}
          href="/auth/sign-up"
        >
          {headerCreateAccountLabel}
        </Link>
        <Link
          className={cn(
            buttonVariants({ size: "lg", variant: "default" }),
            "rounded-full bg-white text-black",
          )}
          href={entryHref}
        >
          {headerEntryLabel}
        </Link>
      </div>
    </nav>
  );
}

function ScrollLandingHeaderNav({
  entryHref,
  headerCreateAccountLabel,
  headerEntryLabel,
}: LandingHeaderNavProps) {
  return (
    <nav
      aria-label="Worvia"
      className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
    >
      <Link
        aria-label="Worvia"
        className="inline-flex items-center"
        href="/"
      >
        <IconSpiral aria-hidden="true" className="size-8 stroke-[1.5]" />
      </Link>

      <div className="flex items-center gap-2">
        <Link
          className={cn(
            buttonVariants({ size: "lg", variant: "link" }),
            "rounded-full",
          )}
          href="/auth/sign-up"
        >
          {headerCreateAccountLabel}
        </Link>
        <Link
          className={cn(
            buttonVariants({ size: "lg", variant: "default" }),
            "rounded-full",
          )}
          href={entryHref}
        >
          {headerEntryLabel}
        </Link>
      </div>
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
  const benefitIcons = [
    IconPresentationFilled,
    IconFoldersFilled,
    IconSparklesFilled,
  ] as const;

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
          entryHref={entryHref}
          headerCreateAccountLabel={headerCreateAccountLabel}
          headerEntryLabel={headerEntryLabel}
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
                entryHref={entryHref}
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
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "min-w-32 rounded-full",
                  )}
                >
                  {buttonLabel}
                  <IconArrowUpRight data-icon="inline-end" />
                </Link>
              </motion.div>
            </motion.section>
          </div>
        </div>
      </div>

      <section className={PORTAL_LANDING_LAYOUT.details}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 sm:gap-16">
          <header className="w-full max-w-4xl">
            <div className="flex flex-col gap-4 text-center">
              <h2
                className="text-balance text-3xl font-medium tracking-tight sm:text-5xl lg:text-6xl"
                id="landing-details-title"
              >
                {details.title}
              </h2>
              <p className="mx-auto max-w-3xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                {details.description}
              </p>
            </div>
          </header>

          <div className="grid w-full gap-4 md:grid-cols-3">
            {details.benefits.map((benefit, index) => {
              const BenefitIcon = benefitIcons[index] ?? IconSparklesFilled;

              return (
                <article
                  className="flex flex-col gap-5 py-8"
                  key={benefit.title}
                >
                  <BenefitIcon
                    aria-hidden="true"
                    className="size-6 text-muted-foreground"
                  />
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-medium">{benefit.title}</h3>
                    <p className="leading-relaxed text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="landing-pricing-title"
        className="relative z-20 px-5 pb-24 sm:px-8 sm:pb-32 lg:pb-40"
      >
        <Card className="mx-auto max-w-4xl border-brand/30 bg-gradient-to-br from-brand-surface-strong via-brand-surface to-background">
          <CardHeader className="gap-4 text-center">
            <h2
              className="text-balance text-3xl font-medium tracking-tight sm:text-5xl"
              id="landing-pricing-title"
            >
              {details.pricing.title}
            </h2>
            <CardDescription className="mx-auto max-w-2xl text-balance text-base leading-relaxed sm:text-lg">
              {details.pricing.description}
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section
        aria-labelledby="landing-plans-title"
        className="relative z-20 px-5 py-24 sm:px-8 sm:py-32 lg:py-40"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 sm:gap-16">
          <header className="w-full max-w-4xl text-center">
            <div className="flex flex-col gap-4">
              <h2
                className="text-balance text-3xl font-medium tracking-tight sm:text-5xl lg:text-6xl"
                id="landing-plans-title"
              >
                {details.plans.title}
              </h2>
              <p className="mx-auto max-w-3xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                {details.plans.description}
              </p>
            </div>
          </header>

          <div className="grid w-full gap-4 lg:grid-cols-2">
            {(
              [
                ["free", details.plans.free],
                ["starter", details.plans.starter],
                ["pro", details.plans.pro],
                ["premium", details.plans.premium],
              ] as const
            ).map(([key, plan]) => (
              <Card
                className={cn(
                  "flex h-full flex-col",
                  key === "premium" && "border-primary shadow-lg",
                )}
                key={key}
              >
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <CardTitle className="text-2xl">
                        {plan.name} · {plan.price}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {plan.description}
                      </CardDescription>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {plan.pricing}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground">
                      {details.plans.perPortal}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="flex flex-col gap-4">
                    {plan.features.map((feature) => (
                      <li
                        className="flex items-start gap-3 text-sm leading-relaxed"
                        key={feature}
                      >
                        <IconCheck
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-primary"
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link
                    className={cn(
                      buttonVariants({
                        size: "lg",
                        variant: key === "premium" ? "default" : "outline",
                      }),
                      "w-full rounded-full",
                    )}
                    href="/auth/sign-up"
                  >
                    {plan.cta}
                    <IconArrowUpRight data-icon="inline-end" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className={PORTAL_LANDING_LAYOUT.finalCta}>
        <Separator />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-5 pt-16 text-center sm:px-8 sm:pt-24">
          <div className="flex w-full max-w-3xl flex-col items-center gap-3">
            <h2 className="text-balance text-3xl font-medium tracking-tight sm:text-5xl">
              {details.ctaTitle}
            </h2>
            <p className="max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
              {details.ctaDescription}
            </p>
          </div>
          <Link
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}
            href="/auth/sign-up"
          >
            {details.ctaLabel}
            <IconArrowUpRight data-icon="inline-end" />
          </Link>
        </div>
      </section>
    </main>
  );
}
