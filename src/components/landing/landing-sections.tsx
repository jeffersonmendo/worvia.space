import {
  IconArrowUpRight,
  IconCheck,
  IconDownload,
  IconFile,
  IconPhoto,
  IconSparkles,
  IconTypography,
} from "@tabler/icons-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
import type { LandingDetails } from "./landing-types";

const sectionClass = "relative z-20 scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28";

function SectionHeading({
  description,
  eyebrow,
  title,
}: {
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
      <Badge variant="outline">{eyebrow}</Badge>
      <h2 className="text-balance text-3xl font-medium tracking-tight sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="text-balance text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function LandingSections({
  actionLabel,
  details,
  entryHref,
}: {
  actionLabel: string;
  details: LandingDetails;
  entryHref: "/home" | "/auth/sign-up";
}) {
  const [productId, howId, sellId, aiId, pricingId, faqId] =
    details.navigation.map(({ href }) => href.slice(1));
  return (
    <>
      <section
        aria-labelledby="landing-demo-title"
        className={sectionClass}
        id={productId}
      >
        <SectionHeading
          description={details.demo.description}
          eyebrow={details.demo.eyebrow}
          title={details.demo.title}
        />
        <div className="mx-auto mt-12 grid max-w-6xl overflow-hidden rounded-2xl border bg-card shadow-2xl lg:grid-cols-[0.7fr_1.3fr]">
          <div className="flex flex-col gap-5 border-b p-6 lg:border-r lg:border-b-0">
            <Badge variant="secondary">{details.demo.editorLabel}</Badge>
            <div className="flex flex-col gap-2">
              {details.demo.sections.map((item, index) => {
                const Icon =
                  [IconPhoto, IconTypography, IconFile, IconDownload][index] ??
                  IconFile;
                return (
                  <div
                    className="flex items-center gap-3 rounded-lg border bg-background p-3"
                    key={item}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-auto flex items-center gap-2">
              <span className="size-6 rounded-full bg-brand-surface-strong" />
              <span className="size-6 rounded-full bg-primary" />
              <span className="size-6 rounded-full bg-muted" />
            </div>
          </div>
          <div className="flex min-h-96 flex-col justify-between gap-8 bg-gradient-to-br from-brand-surface-strong via-background to-background p-8 sm:p-12">
            <Badge className="self-start" variant="outline">
              {details.demo.publishedLabel}
            </Badge>
            <div className="flex max-w-xl flex-col gap-4">
              <p
                className="text-4xl font-medium tracking-tight sm:text-6xl"
                id="landing-demo-title"
              >
                {details.demo.projectTitle}
              </p>
              <p className="text-muted-foreground sm:text-lg">
                {details.demo.projectDescription}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 rounded-lg bg-primary/20" />
              <div className="h-20 rounded-lg bg-brand-surface-strong" />
              <div className="h-20 rounded-lg bg-muted" />
            </div>
          </div>
        </div>
      </section>

      <section className={cn(sectionClass, "bg-muted/30")} id={howId}>
        <SectionHeading
          eyebrow={details.steps.eyebrow}
          title={details.steps.title}
        />
        <ol className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {details.steps.items.map((item, index) => (
            <li key={item.title}>
              <Card className="h-full">
                <CardHeader>
                  <Badge variant="secondary">
                    {String(index + 1).padStart(2, "0")}
                  </Badge>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionClass} id={sellId}>
        <SectionHeading
          eyebrow={details.journeys.eyebrow}
          title={details.journeys.title}
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-2">
          {details.journeys.items.map((item) => (
            <Card className="h-full" key={item.title}>
              <CardHeader>
                <CardTitle className="text-2xl">{item.title}</CardTitle>
                <CardDescription className="text-base">
                  {item.description}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <span className="text-sm font-medium text-primary">
                  {item.action}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
        <Card className="mx-auto mt-8 max-w-6xl border-brand/30 bg-brand-surface">
          <CardHeader>
            <Badge className="w-fit" variant="secondary">
              {details.monetization.eyebrow}
            </Badge>
            <CardTitle className="text-3xl">
              {details.monetization.title}
            </CardTitle>
            <CardDescription className="text-base">
              {details.monetization.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="font-medium">
                {details.monetization.commissionTitle}
              </h3>
              {details.monetization.tiers.map((tier) => (
                <p className="flex items-center gap-2" key={tier}>
                  <IconCheck aria-hidden="true" className="size-4" />
                  {tier}
                </p>
              ))}
              <p className="text-sm text-muted-foreground">
                {details.monetization.stripe}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {details.monetization.examples.map((example) => (
                <p
                  className="rounded-lg border bg-background p-3 text-sm"
                  key={example}
                >
                  {example}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={cn(sectionClass, "bg-muted/30")}>
        <SectionHeading
          description={details.buyer.description}
          eyebrow={details.buyer.eyebrow}
          title={details.buyer.title}
        />
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
          {details.buyer.items.map((item) => (
            <Card key={item}>
              <CardHeader>
                <IconDownload
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                <CardTitle className="text-base">{item}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className={sectionClass} id={aiId}>
        <Card className="mx-auto max-w-5xl border-brand/30">
          <CardHeader>
            <Badge className="w-fit" variant="secondary">
              <IconSparkles data-icon="inline-start" />
              {details.ai.eyebrow}
            </Badge>
            <CardTitle className="text-3xl sm:text-5xl">
              {details.ai.title}
            </CardTitle>
            <CardDescription className="text-base sm:text-lg">
              {details.ai.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {details.ai.credits.map((credit) => (
              <p
                className="rounded-lg bg-muted p-4 text-sm font-medium"
                key={credit}
              >
                {credit}
              </p>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className={cn(sectionClass, "bg-muted/30")}>
        <SectionHeading
          eyebrow={details.security.eyebrow}
          title={details.security.title}
        />
        <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {details.security.items.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-muted-foreground">
          {details.security.note}
        </p>
      </section>

      <section className={sectionClass} id={pricingId}>
        <SectionHeading
          description={details.plans.description}
          eyebrow={details.plans.perPortal}
          title={details.plans.title}
        />
        <div className="mx-auto mt-12 grid max-w-7xl gap-4 lg:grid-cols-4">
          {(["free", "starter", "pro", "premium"] as const).map((key) => {
            const plan = details.plans[key];
            return (
              <Card
                className={cn(
                  "flex h-full flex-col",
                  key === "premium" && "border-primary",
                )}
                key={key}
              >
                <CardHeader>
                  <Badge
                    className="w-fit"
                    variant={key === "premium" ? "default" : "outline"}
                  >
                    {details.plans.perPortal}
                  </Badge>
                  <CardTitle className="text-2xl">
                    {plan.name} · {plan.price}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="text-sm text-muted-foreground">
                    {plan.pricing}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="flex flex-col gap-3">
                    {plan.features.map((feature) => (
                      <li
                        className="flex items-start gap-2 text-sm"
                        key={feature}
                      >
                        <IconCheck
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-primary"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link
                    className={cn(
                      buttonVariants({
                        variant: key === "premium" ? "default" : "outline",
                      }),
                      "w-full",
                    )}
                    href={entryHref}
                  >
                    {plan.cta}
                    <IconArrowUpRight data-icon="inline-end" />
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      <section className={cn(sectionClass, "bg-muted/30")} id={faqId}>
        <SectionHeading
          eyebrow={details.faq.eyebrow}
          title={details.faq.title}
        />
        <Accordion
          className="mx-auto mt-10 max-w-3xl"
          defaultValue={[]}
          multiple
        >
          {details.faq.items.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="relative z-20 px-5 py-24 text-center sm:px-8">
        <Separator />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 pt-20">
          <h2 className="text-balance text-3xl font-medium sm:text-5xl">
            {details.ctaTitle}
          </h2>
          <p className="text-balance text-muted-foreground sm:text-lg">
            {details.ctaDescription}
          </p>
          <Link className={buttonVariants({ size: "lg" })} href={entryHref}>
            {actionLabel}
            <IconArrowUpRight data-icon="inline-end" />
          </Link>
        </div>
      </section>
    </>
  );
}
