import { NextResponse } from "next/server";
import { normalizePortalDocument } from "@/domain/portal/document";
import {
  getAuthorizedDocument,
  resolvePortalAccess,
} from "@/infrastructure/portal/server-access";
import { fetchStorageEntry } from "@/infrastructure/portal/server-assets";
import { recordPaidPortalDownload } from "@/lib/billing/paid-portal-downloads";
import {
  buildExportManifest,
  EXPORT_LIMITS,
  selectManifestScope,
} from "@/lib/portal/export-manifest";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string; slug: string }> },
) {
  const { itemId, slug } = await params;
  const access = await resolvePortalAccess(slug);
  if (
    access.decision !== "allowed" ||
    !access.portal?.allow_downloads ||
    !access.portal.allow_asset_downloads
  )
    return new NextResponse("Not found", { status: 404 });
  const rawDocument = await getAuthorizedDocument(access);
  if (!rawDocument) return new NextResponse("Not found", { status: 404 });
  const document = normalizePortalDocument(rawDocument, {
    cover_url: access.portal.cover_url,
    icon_url: null,
    name: access.portal.name,
    short_description: access.portal.short_description,
    theme: "auto",
  });
  const manifest = buildExportManifest(document, {
    portalId: access.portal.id,
    ownerId: access.portal.owner_id,
    slug,
    storageOrigin: getSupabaseEnv().url,
  });
  const entry = selectManifestScope(manifest, { itemId, kind: "item" })
    .entries[0];
  if (!entry?.storage) return new NextResponse("Not found", { status: 404 });
  try {
    const { bytes, mime } = await fetchStorageEntry(
      entry,
      EXPORT_LIMITS.maxFileBytes,
      { ownerId: access.portal.owner_id, portalId: access.portal.id },
    );
    if (
      !(await recordPaidPortalDownload({
        assetId: itemId,
        kind: "asset",
        portalId: access.portal.id,
      }))
    )
      return new NextResponse("Forbidden", { status: 403 });
    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${entry.name}"`,
        "Content-Length": String(bytes.length),
        "Content-Type": mime,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
