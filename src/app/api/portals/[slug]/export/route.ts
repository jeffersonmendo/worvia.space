import { NextResponse } from "next/server";
import {
  normalizePortalDocument,
  portalBlocksToDocument,
} from "@/domain/portal/document";
import {
  getAuthorizedDocument,
  resolvePortalAccess,
} from "@/infrastructure/portal/server-access";
import { fetchStorageEntry } from "@/infrastructure/portal/server-assets";
import { recordPaidPortalDownload } from "@/lib/billing/paid-portal-downloads";
import {
  buildExportManifest,
  buildManifestText,
  EXPORT_LIMITS,
  type ManifestScope,
  sanitizeAssetName,
  selectManifestScope,
  selectPortalExportDocument,
} from "@/lib/portal/export-manifest";
import { createZip } from "@/lib/portal/zip";
import type { Portal } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportPortal = Pick<
  Portal,
  | "allow_asset_downloads"
  | "allow_downloads"
  | "cover_url"
  | "id"
  | "name"
  | "owner_id"
  | "short_description"
>;

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

function scopeFromUrl(url: URL): ManifestScope | null {
  const sectionId = url.searchParams.get("section");
  const itemId = url.searchParams.get("item");
  const fontFamily = url.searchParams.get("fontFamily");
  if (itemId && (sectionId || fontFamily)) return null;
  if (fontFamily && sectionId)
    return { fontFamily, kind: "font-family", sectionId };
  if (fontFamily) return null;
  if (sectionId) return { kind: "section", sectionId };
  if (itemId) return { itemId, kind: "item" };
  return { kind: "portal" };
}

async function resolveEditorExport(slug: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data: portal } = await supabase
    .from("portals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!portal?.allow_downloads) return null;
  const { data: canEdit } = await supabase.rpc("can_edit_portal", {
    target_portal_id: portal.id,
  });
  if (canEdit !== true) return null;
  const { data: row } = await supabase
    .from("portal_documents")
    .select("document")
    .eq("portal_id", portal.id)
    .maybeSingle();
  if (row?.document) return { document: row.document, portal };
  const { data: blocks } = await supabase
    .from("portal_blocks")
    .select("*")
    .eq("portal_id", portal.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return {
    document: portalBlocksToDocument(portal as Portal, blocks ?? []),
    portal,
  };
}

async function createResponse(
  request: Request,
  slug: string,
  bodyScope?: ManifestScope,
) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") ?? "published";
  if (source !== "editor" && source !== "published") {
    return new NextResponse("Invalid export source", { status: 400 });
  }
  let portal: ExportPortal;
  let currentDocument = null;
  let publishedDocument = null;
  if (source === "editor") {
    const editorExport = await resolveEditorExport(slug);
    if (!editorExport) return notFound();
    portal = editorExport.portal;
    currentDocument = editorExport.document;
  } else {
    const access = await resolvePortalAccess(slug);
    if (access.decision !== "allowed" || !access.portal?.allow_downloads) {
      return notFound();
    }
    portal = access.portal;
    publishedDocument = await getAuthorizedDocument(access);
    if (!publishedDocument && access.portal.status === "draft") {
      const editorExport = await resolveEditorExport(slug);
      if (editorExport) {
        portal = editorExport.portal;
        publishedDocument = editorExport.document;
      }
    }
  }
  const rawDocument = selectPortalExportDocument({
    current: currentDocument,
    published: publishedDocument,
    source,
  });
  if (!rawDocument) return notFound();
  const document = normalizePortalDocument(rawDocument, {
    cover_url: portal.cover_url,
    icon_url: null,
    name: portal.name,
    short_description: portal.short_description,
    theme: "auto",
  });
  const scope = bodyScope ?? scopeFromUrl(new URL(request.url));
  if (!scope) return new NextResponse("Invalid export scope", { status: 400 });
  const complete = buildExportManifest(document, {
    portalId: portal.id,
    ownerId: portal.owner_id,
    slug,
    storageOrigin: getSupabaseEnv().url,
  });
  let manifest = selectManifestScope(complete, scope);
  if (!portal.allow_asset_downloads)
    manifest = {
      ...manifest,
      entries: manifest.entries.filter((entry) => entry.category === "colors"),
    };
  if (!manifest.entries.length) return notFound();
  if (
    !(await recordPaidPortalDownload({
      assetId: bodyScope?.kind === "item" ? bodyScope.itemId : undefined,
      kind: "export",
      portalId: portal.id,
    }))
  )
    return new NextResponse("Forbidden", { status: 403 });

  if (
    scope.kind === "section" &&
    manifest.entries.every((entry) => entry.category === "colors")
  ) {
    const text = manifest.entries.map((entry) => entry.text ?? "").join("");
    return new NextResponse(text, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${sanitizeAssetName(portal.name, slug)}-colors.txt"`,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const files: { bytes: Uint8Array; name: string }[] = [];
  const omitted: string[] = [];
  let totalBytes = 0;
  const deadline = Date.now() + EXPORT_LIMITS.timeoutMs;
  const archiveName = (name: string) =>
    scope.kind === "portal" ? `${manifest.rootName}/${name}` : name;
  for (const entry of manifest.entries) {
    if (Date.now() >= deadline)
      return new NextResponse("Export timed out", { status: 504 });
    if (entry.text !== undefined) {
      const bytes = new TextEncoder().encode(entry.text);
      files.push({ bytes, name: archiveName(entry.destination) });
      totalBytes += bytes.length;
      continue;
    }
    try {
      const result = await fetchStorageEntry(
        entry,
        EXPORT_LIMITS.maxTotalBytes - totalBytes,
        { ownerId: portal.owner_id, portalId: portal.id },
      );
      files.push({ bytes: result.bytes, name: archiveName(entry.destination) });
      totalBytes += result.bytes.length;
    } catch (error) {
      if (Date.now() >= deadline)
        return new NextResponse("Export timed out", { status: 504 });
      omitted.push(
        `${entry.destination}: ${error instanceof Error ? error.message : "unavailable"}`,
      );
    }
  }
  if (!files.length)
    return new NextResponse("Export unavailable", { status: 422 });
  const manifestBytes = new TextEncoder().encode(
    buildManifestText(manifest, omitted),
  );
  if (totalBytes + manifestBytes.length > EXPORT_LIMITS.maxTotalBytes)
    return new NextResponse("Export too large", { status: 413 });
  files.push({ bytes: manifestBytes, name: archiveName("manifest.txt") });
  const archive = createZip(files);
  const suffix =
    scope.kind === "section"
      ? `-${sanitizeAssetName(scope.sectionId, "section")}`
      : scope.kind === "font-family"
        ? `-${sanitizeAssetName(scope.fontFamily, "font-family")}`
        : "";
  return new NextResponse(archive, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${manifest.rootName}${suffix}.zip"`,
      "Content-Type": "application/zip",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return createResponse(request, (await params).slug);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  let scope: ManifestScope;
  try {
    const body = (await request.json()) as {
      fontFamily?: string;
      itemId?: string;
      kind?: string;
      sectionId?: string;
    };
    scope =
      body.kind === "section" && body.sectionId
        ? { kind: "section", sectionId: body.sectionId }
        : body.kind === "font-family" && body.fontFamily && body.sectionId
          ? {
              fontFamily: body.fontFamily,
              kind: "font-family",
              sectionId: body.sectionId,
            }
          : body.kind === "item" && body.itemId
            ? { itemId: body.itemId, kind: "item" }
            : body.kind === "portal"
              ? { kind: "portal" }
              : (() => {
                  throw new Error("scope");
                })();
  } catch {
    return new NextResponse("Invalid export scope", { status: 400 });
  }
  return createResponse(request, (await params).slug, scope);
}
