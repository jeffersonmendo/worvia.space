import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { HomeOpenGraphCard } from "@/components/home-open-graph-card";
import { OpenGraphCard } from "@/components/open-graph-card";
import {
  getPortalShareSummary,
  resolvePortalAccess,
} from "@/infrastructure/portal/server-access";
import {
  OPEN_GRAPH_SIZE,
  resolvePortalSharePresentation,
} from "@/lib/public-metadata";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const alt = "Portal shared with Worvia";
export const contentType = "image/png";
export const size = OPEN_GRAPH_SIZE;

export default async function PortalOpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({
    locale,
    namespace: "PublicPortal.metadata",
  });
  let presentation = resolvePortalSharePresentation({
    decision: "not_found",
    fallback: { description: t("description"), title: t("title") },
  });
  let summary = getPortalShareSummary({
    paidPreview: null,
    publicationSnapshot: null,
  });
  let badge = t("freeBadge");
  let isPremium = false;
  let updatedAt = new Date().toISOString();

  if (hasSupabaseEnv()) {
    try {
      const access = await resolvePortalAccess(slug);
      if (access.decision === "not_found") {
        return new ImageResponse(<HomeOpenGraphCard />, size);
      }
      presentation = resolvePortalSharePresentation({
        decision: access.decision,
        fallback: { description: t("description"), title: t("title") },
        portal: access.portal
          ? {
              description: access.portal.short_description,
              fallbackDescription:
                access.decision === "preview_required"
                  ? t("paidDescription", { name: access.portal.name })
                  : t("discover", { name: access.portal.name }),
              name: access.portal.name,
            }
          : null,
      });
      summary = getPortalShareSummary({
        paidPreview: access.paidPreview,
        publicationSnapshot: access.publication?.snapshot,
      });
      badge =
        access.portal?.visibility === "paid"
          ? t("premiumBadge")
          : t("freeBadge");
      isPremium = access.portal?.visibility === "paid";
      updatedAt = access.portal?.updated_at || updatedAt;
    } catch {
      // Render the localized generic card when portal lookup is unavailable.
    }
  }

  return new ImageResponse(
    <OpenGraphCard
      badge={badge}
      colors={summary.colors}
      colorCount={summary.colorCount}
      description={presentation.description}
      fileTypes={summary.fileTypes}
      imageCount={summary.imageCount}
      isPremium={isPremium}
      labels={{
        colors: t("colorsLabel"),
        files: t("filesLabel"),
        images: t("imagesLabel"),
        lastUpdated: t("lastUpdatedLabel"),
        totalSize: t("totalSizeLabel"),
      }}
      title={presentation.title}
      totalBytes={summary.totalBytes}
      totalFiles={summary.totalFiles}
      updatedAt={updatedAt}
    />,
    size,
  );
}
