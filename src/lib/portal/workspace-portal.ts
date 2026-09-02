import { notFound, redirect } from "next/navigation";
import {
  normalizePortalDocument,
  portalBlocksToDocument,
} from "@/domain/portal/document";
import {
  getConnectStatusSummary,
  normalizeConnectStatusSummary,
} from "@/infrastructure/portal/workspace-read-models";
import type { Portal } from "@/lib/supabase/database.types";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function getWorkspacePortal(locale: string, portalId: string) {
  if (!hasSupabaseEnv()) notFound();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/${locale}/auth/sign-in`);

  const { data: portal } = await supabase
    .from("portals")
    .select(
      "id,owner_id,name,slug,short_description,cover_url,icon_url,content_language,visibility,seo_title,seo_description,social_image_url,custom_domain,allow_downloads,allow_asset_downloads,allow_color_copy,allow_pdf_downloads,theme,designer_name,designer_logo_url,designer_photo_url,designer_website_url,designer_social_links,status,published_publication_id,published_at,created_at,updated_at",
    )
    .eq("id", portalId)
    .single();

  if (!portal) notFound();

  const safePortal = {
    ...portal,
    content_language: portal.content_language === "es" ? "es" : "en",
    password_hash: null,
  } as Portal;
  const [{ data: documentRow }, { data: blocks }, connectSummary] =
    await Promise.all([
      supabase
        .from("portal_documents")
        .select("document")
        .eq("portal_id", portalId)
        .maybeSingle(),
      supabase
        .from("portal_blocks")
        .select("*")
        .eq("portal_id", portalId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      getConnectStatusSummary(supabase),
    ]);

  const { data: paidOffer } = (await supabase
    .from("paid_portal_offers" as never)
    .select("price_cents")
    .eq("portal_id", portalId)
    .eq("is_active", true)
    .maybeSingle()) as unknown as { data: { price_cents: number } | null };

  const { data: paidPurchase } = await supabase
    .from("paid_portal_purchases")
    .select("id")
    .eq("portal_id", portalId)
    .limit(1)
    .maybeSingle();
  const { data: entitlement } = await supabase
    .from("portal_entitlements")
    .select("status,plan")
    .eq("portal_id", portalId)
    .eq("status", "active")
    .maybeSingle();
  const plan =
    entitlement?.status === "active" ? (entitlement.plan ?? "premium") : "free";
  return {
    document: documentRow?.document
      ? normalizePortalDocument(documentRow.document, safePortal)
      : portalBlocksToDocument(safePortal, blocks ?? []),
    paidPriceCents: paidOffer?.price_cents ?? null,
    hasPortalPurchase: portal.visibility === "paid" && Boolean(paidPurchase),
    plan,
    canPurchase: portal.owner_id === userData.user.id,
    connectStatus: normalizeConnectStatusSummary(connectSummary),
    portal: safePortal,
  };
}
