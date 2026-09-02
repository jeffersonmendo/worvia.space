import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PortalProjectController } from "@/components/portal";
import {
  PortalPlanProvider,
  PortalPlanStatus,
} from "@/components/portal/portal-plan-provider";
import {
  normalizePortalDocument,
  type PortalDocument,
  portalBlocksToDocument,
  portalDocumentToJson,
} from "@/domain/portal/document";
import { prepareDocumentForRendering } from "@/infrastructure/portal/server-assets";
import {
  getConnectStatusSummary,
  normalizeConnectStatusSummary,
} from "@/infrastructure/portal/workspace-read-models";
import type { Json, Portal, PortalBlock } from "@/lib/supabase/database.types";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PortalWorkspaceToolbar } from "../../_components/portal-workspace-toolbar";
import { WorkspaceProjectRegistration } from "../../_components/workspace-sidebar";
import { PortalAiDialog } from "./_components/portal-ai-dialog";
import { PortalSectionOrderPopover } from "./_components/portal-section-order-popover";
import { SettingsDialog } from "./_components/portal-settings-dialog";
import { PublishPortalButton } from "./_components/publish-portal-button";

type Props = {
  params: Promise<{ locale: string; portalId: string }>;
  searchParams: Promise<{ focus?: string }>;
};

type PortalWorkspace = {
  portal: Portal;
  blocks: PortalBlock[];
  document: PortalDocument;
  documentRevision: number | null;
  hasUnpublishedChanges: boolean;
  paidPriceCents: number | null;
  connectStatus: ReturnType<typeof normalizeConnectStatusSummary>;
};

type PublicationSnapshot = {
  document?: Json;
  portal?: Record<string, Json | undefined>;
};

const publicPortalFields = [
  "name",
  "slug",
  "short_description",
  "visibility",
  "designer_name",
  "designer_website_url",
] as const;

function asPublicationSnapshot(value: Json | null): PublicationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, Json | undefined>;
  const portal =
    record.portal &&
    typeof record.portal === "object" &&
    !Array.isArray(record.portal)
      ? (record.portal as Record<string, Json | undefined>)
      : undefined;

  return {
    document: record.document,
    portal,
  };
}

function hasUnpublishedPortalChanges({
  document,
  portal,
  snapshot,
}: {
  document: PortalDocument;
  portal: Portal;
  snapshot: PublicationSnapshot | null;
}) {
  if (portal.status !== "published" || !snapshot) {
    return true;
  }

  const snapshotPortal = snapshot.portal;

  if (!snapshotPortal) {
    return true;
  }

  const portalChanged = publicPortalFields.some(
    (field) => (portal[field] ?? null) !== (snapshotPortal[field] ?? null),
  );

  if (portalChanged) {
    return true;
  }

  const snapshotDocument = normalizePortalDocument(snapshot.document, {
    cover_url:
      typeof snapshotPortal.cover_url === "string"
        ? snapshotPortal.cover_url
        : null,
    icon_url:
      typeof snapshotPortal.icon_url === "string"
        ? snapshotPortal.icon_url
        : null,
    name:
      typeof snapshotPortal.name === "string"
        ? snapshotPortal.name
        : portal.name,
    short_description:
      typeof snapshotPortal.short_description === "string"
        ? snapshotPortal.short_description
        : null,
    theme: ["light", "dark", "auto"].includes(String(snapshotPortal.theme))
      ? (snapshotPortal.theme as Portal["theme"])
      : portal.theme,
  });

  return (
    JSON.stringify(portalDocumentToJson(document)) !==
    JSON.stringify(portalDocumentToJson(snapshotDocument))
  );
}

async function getWorkspace(
  locale: string,
  portalId: string,
): Promise<PortalWorkspace> {
  if (!hasSupabaseEnv()) {
    notFound();
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const { data: portal } = await supabase
    .from("portals")
    .select(
      "id,owner_id,name,slug,short_description,cover_url,icon_url,visibility,seo_title,seo_description,social_image_url,custom_domain,allow_downloads,allow_asset_downloads,allow_color_copy,allow_pdf_downloads,theme,designer_name,designer_logo_url,designer_photo_url,designer_website_url,designer_social_links,status,published_publication_id,published_at,created_at,updated_at",
    )
    .eq("id", portalId)
    .single();

  if (!portal) {
    notFound();
  }
  const safePortal: Portal = {
    ...portal,
    content_language: "en",
    password_hash: null,
  };

  const [
    { data: blocks },
    { data: portalDocumentRow },
    { data: publicationRow },
    { data: paidOffer },
    connectSummary,
  ] = await Promise.all([
    supabase
      .from("portal_blocks")
      .select("*")
      .eq("portal_id", portalId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("portal_documents")
      .select("document,revision")
      .eq("portal_id", portalId)
      .maybeSingle(),
    portal.published_publication_id
      ? supabase
          .from("portal_publications")
          .select("snapshot")
          .eq("id", portal.published_publication_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("paid_portal_offers" as never)
      .select("price_cents")
      .eq("portal_id", portalId)
      .eq("is_active", true)
      .maybeSingle() as unknown as Promise<{
      data: { price_cents: number } | null;
    }>,
    getConnectStatusSummary(supabase),
  ]);

  const fallbackDocument = portalBlocksToDocument(safePortal, blocks ?? []);
  const storedDocument = portalDocumentRow?.document
    ? normalizePortalDocument(portalDocumentRow.document, safePortal)
    : fallbackDocument;
  const document = await prepareDocumentForRendering(storedDocument, {
    ownerId: portal.owner_id,
    portalId: portal.id,
    slug: portal.slug,
  });

  const snapshot = asPublicationSnapshot(publicationRow?.snapshot ?? null);
  const hasUnpublishedChanges = hasUnpublishedPortalChanges({
    document: storedDocument,
    portal: safePortal,
    snapshot,
  });

  return {
    blocks: blocks ?? [],
    document,
    documentRevision: portalDocumentRow?.revision ?? null,
    hasUnpublishedChanges,
    paidPriceCents: paidOffer?.price_cents ?? null,
    connectStatus: normalizeConnectStatusSummary(connectSummary),
    portal: safePortal,
  };
}

export default async function CreatePortalPage({
  params,
  searchParams,
}: Props) {
  const { locale, portalId } = await params;
  const { focus } = await searchParams;

  setRequestLocale(locale);
  const {
    connectStatus,
    document,
    documentRevision,
    hasUnpublishedChanges,
    paidPriceCents,
    portal,
  } = await getWorkspace(locale, portalId);
  return (
    <PortalPlanProvider locale={locale} portalId={portal.id}>
      <WorkspaceProjectRegistration
        project={{
          id: portal.id,
          name: portal.name,
        }}
      />
      <PortalWorkspaceToolbar
        initialHasUnpublishedChanges={hasUnpublishedChanges}
        portalId={portal.id}
        portalSlug={portal.slug}
      />
      <PortalSectionOrderPopover
        document={document}
        portalId={portal.id}
        triggerless
      />
      <div className="hidden">
        <SettingsDialog
          initialConnectReady={connectStatus.connected}
          initialPaidPriceCents={paidPriceCents}
          locale={locale}
          portal={portal}
          triggerless
        />
        <PortalPlanStatus triggerless />
        <PortalAiDialog portalId={portal.id} triggerless />
        <PublishPortalButton
          initialHasUnpublishedChanges={hasUnpublishedChanges}
          locale={locale}
          portalId={portal.id}
          triggerless
        />
      </div>
      <PortalProjectController
        mode="editor"
        className="min-h-0"
        document={document}
        editor={{
          documentRevision,
          focus,
          hasUnpublishedChanges,
          locale,
          portalId: portal.id,
          slug: portal.slug,
        }}
      />
    </PortalPlanProvider>
  );
}
