import { NextResponse } from "next/server";
import { resolvePortalAccess } from "@/infrastructure/portal/server-access";
import { containsPortalAssetReference } from "@/lib/portal/asset-preview-reference";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug");
  const assetId = params.get("assetId");
  const path = params.get("path");
  if (!slug || (!assetId && !path)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const access = await resolvePortalAccess(slug);
  if (access.decision !== "allowed" || !access.portal) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const [documentResult, blocksResult] = access.isOwner
    ? await Promise.all([
        admin
          .from("portal_documents")
          .select("document")
          .eq("portal_id", access.portal.id)
          .maybeSingle(),
        admin
          .from("portal_blocks")
          .select("content")
          .eq("portal_id", access.portal.id),
      ])
    : [null, null];
  const isReferenced = [
    documentResult?.data?.document,
    access.publication?.snapshot,
    ...(blocksResult?.data ?? []),
  ].some((document) => containsPortalAssetReference(document, assetId, path));
  if (!isReferenced) return new NextResponse("Not found", { status: 404 });

  let query = admin
    .from("portal_assets")
    .select("file_path,mime_type")
    .eq("portal_id", access.portal.id)
    .eq("state", "ready");
  query = assetId
    ? query.eq("id", assetId)
    : query.eq("file_path", path as string);
  const { data: asset } = await query.maybeSingle();
  if (!asset) return new NextResponse("Not found", { status: 404 });

  const downloaded = await admin.storage
    .from("portal-assets")
    .download(asset.file_path);
  if (downloaded.error || !downloaded.data) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(await downloaded.data.arrayBuffer(), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": asset.mime_type ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
