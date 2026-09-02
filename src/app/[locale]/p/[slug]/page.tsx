import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  hasPublicSectionContent,
  normalizePortalDocument,
  type PortalDocument,
} from "@/domain/portal/document";
import { isPaidPreviewDecision } from "@/domain/portal/paid-preview";
import {
  getSnapshotDocument,
  resolvePortalAccess,
} from "@/infrastructure/portal/server-access";
import { prepareDocumentForRendering } from "@/infrastructure/portal/server-assets";
import { confirmPaidPortalCheckout } from "@/lib/billing/confirm-paid-portal-checkout";
import { portalExportHref } from "@/lib/portal/export-manifest";
import {
  buildPortalMetadata,
  resolvePortalSharePresentation,
} from "@/lib/public-metadata";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { PortalDocumentSidebarReadOnly } from "./_components/document-sidebar";
import { PortalEntryTransition } from "./_components/entry-transition";
import { PaidPreview } from "./_components/paid-preview";
import { PortalProjectView } from "./_components/portal-project-view";
import { PublicPortalShell } from "./_components/public-portal-header";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ error?: string; session_id?: string }>;
};

async function PasswordGate({
  error,
  locale,
  name,
  slug,
}: {
  error: boolean;
  locale: string;
  name: string;
  slug: string;
}) {
  const t = await getTranslations({
    locale,
    namespace: "PublicPortal.password",
  });
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <form
          action={`/${locale}/p/${encodeURIComponent(slug)}/unlock`}
          method="post"
        >
          <CardContent>
            <FieldGroup>
              <Field data-invalid={error || undefined}>
                <FieldLabel htmlFor="portal-password">{t("label")}</FieldLabel>
                <Input
                  aria-invalid={error || undefined}
                  autoComplete="current-password"
                  id="portal-password"
                  name="password"
                  placeholder={t("placeholder")}
                  required
                  type="password"
                />
                {error ? <FieldError>{t("invalid")}</FieldError> : null}
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="pt-6">
            <Button className="w-full" type="submit">
              {t("submit")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

export default async function PublicPortalPage({
  params,
  searchParams,
}: Props) {
  const { locale, slug } = await params;
  const { error, session_id } = await searchParams;
  setRequestLocale(locale);
  if (!hasSupabaseEnv()) notFound();
  const headerT = await getTranslations({
    locale,
    namespace: "PublicPortal.header",
  });

  if (session_id) await confirmPaidPortalCheckout(slug, session_id);

  const access = await resolvePortalAccess(slug);
  if (!access.portal || access.decision === "not_found") notFound();
  if (access.decision === "password_required") {
    return (
      <PublicPortalShell downloadLabel={headerT("download")}>
        <PasswordGate
          error={error === "invalid"}
          locale={locale}
          name={access.portal.name}
          slug={slug}
        />
      </PublicPortalShell>
    );
  }
  if (isPaidPreviewDecision(access.decision)) {
    return (
      <PublicPortalShell
        downloadLabel={headerT("download")}
        purchaseAction={{
          label: headerT("buy", { price: access.paidPreview?.price ?? "—" }),
          locale,
          portalId: access.portal.id,
          price: access.paidPreview?.price ?? null,
          slug,
        }}
      >
        <PaidPreview
          locale={locale}
          name={access.paidPreview?.name || access.portal.name}
          description={
            access.paidPreview?.description ?? access.portal.short_description
          }
          previewImages={access.paidPreview?.previewImages}
          assetSummary={access.paidPreview?.assetSummary}
          colors={access.paidPreview?.colors}
          sampleFiles={access.paidPreview?.sampleFiles}
          price={access.paidPreview?.price}
          totalBytes={access.paidPreview?.totalBytes}
          totalFiles={access.paidPreview?.totalFiles}
          totalImages={access.paidPreview?.totalImages}
          updatedAt={access.portal.updated_at}
        />
      </PublicPortalShell>
    );
  }

  let document: PortalDocument | null = null;
  const snapshotDocument = getSnapshotDocument(access.publication?.snapshot);
  const fallback = {
    cover_url: access.portal.cover_url,
    icon_url: null,
    name: access.portal.name,
    short_description: access.portal.short_description,
    theme: "auto" as const,
  };
  if (snapshotDocument)
    document = normalizePortalDocument(snapshotDocument, fallback);

  if (!document) notFound();
  const renderDocument = await prepareDocumentForRendering(document, {
    ownerId: access.portal.owner_id,
    portalId: access.portal.id,
    slug: access.portal.slug,
  });
  const visibleSections = renderDocument.sections.filter(
    (section) =>
      section.visible &&
      section.type !== "empty" &&
      hasPublicSectionContent(section),
  );
  const portal = access.portal;
  const exportSource = "published" as const;

  return (
    <PublicPortalShell
      downloadHref={
        portal.allow_downloads
          ? portalExportHref(slug, exportSource)
          : undefined
      }
      downloadLabel={headerT("download")}
    >
      <PortalEntryTransition
        iconUrl={renderDocument.portal.icon_url ?? null}
        name={renderDocument.portal.name}
      >
        <PortalProjectView
          document={renderDocument}
          actionConfig={{
            public: {
              exportSource,
              slug,
              slots: {
                global: { exportAssets: portal.allow_downloads },
                item: {
                  color: { copy: portal.allow_color_copy },
                  file: { download: portal.allow_asset_downloads },
                  font: { download: portal.allow_asset_downloads },
                  image: { download: portal.allow_asset_downloads },
                },
                section: { download: portal.allow_downloads },
              },
            },
          }}
          sidebar={
            <PortalDocumentSidebarReadOnly
              exportHref={
                portal.allow_downloads
                  ? portalExportHref(slug, exportSource)
                  : undefined
              }
              sectionIds={visibleSections.map((section) => section.id)}
              sections={visibleSections}
            />
          }
          visibility={{ requireContent: true }}
        />
      </PortalEntryTransition>
    </PublicPortalShell>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({
    locale,
    namespace: "PublicPortal.metadata",
  });
  const genericMetadata: Metadata = {
    description: t("description"),
    robots: { follow: false, index: false },
    title: t("title"),
  };
  if (!hasSupabaseEnv()) return genericMetadata;
  try {
    const access = await resolvePortalAccess(slug);
    const presentation = resolvePortalSharePresentation({
      decision: access.decision,
      fallback: {
        description: t("description"),
        title: t("title"),
      },
      portal: access.portal
        ? {
            description: access.portal.short_description,
            fallbackDescription: isPaidPreviewDecision(access.decision)
              ? t("paidDescription", {
                  name: access.portal.name,
                })
              : t("discover", {
                  name: access.portal.name,
                }),
            name: access.portal.name,
          }
        : null,
    });
    if (!presentation.indexable && !isPaidPreviewDecision(access.decision)) {
      return genericMetadata;
    }
    const metadata = buildPortalMetadata({
      description: presentation.description,
      locale,
      name: presentation.title,
      slug,
    });
    if (isPaidPreviewDecision(access.decision)) {
      metadata.robots = { follow: false, index: false };
    }
    return metadata;
  } catch {
    return genericMetadata;
  }
}
