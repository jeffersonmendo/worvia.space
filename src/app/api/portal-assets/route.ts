import { NextResponse } from "next/server";
import { PORTAL_ASSET_PREVIEW_TTL_SECONDS } from "@/infrastructure/portal/server-assets";
import { deletePreparedPortalAsset } from "@/lib/portal/asset-deletion";
import {
  areAssetMimeTypesCompatible,
  inferAssetMimeType,
  normalizeAssetMimeType,
  validateAssetBytes,
  validateAssetDeclaration,
} from "@/lib/portal/asset-validation";
import { sanitizeAssetName } from "@/lib/portal/export-manifest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const categories = new Set([
  "cover",
  "file",
  "font",
  "gallery",
  "icon",
  "image",
]);

async function canEditPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  portalId: string,
) {
  const { data } = await supabase.rpc("can_edit_portal", {
    target_portal_id: portalId,
  });
  return data === true;
}

async function cleanupExpiredReservations() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("portal_assets")
    .select("id,file_path")
    .eq("state", "reserved")
    .lte("reservation_expires_at", new Date().toISOString())
    .limit(25);
  if (!data?.length) return;
  const removed = await admin.storage
    .from("portal-assets")
    .remove(data.map((asset) => asset.file_path));
  if (!removed.error) {
    await admin
      .from("portal_assets")
      .delete()
      .in(
        "id",
        data.map((asset) => asset.id),
      );
  }
}

class PortalAssetDeletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function deletePortalAsset(
  assetId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const admin = createAdminClient();
  await deletePreparedPortalAsset({
    finalize: async () => {
      const { data, error } = await admin.rpc(
        "finalize_portal_asset_deletion",
        { target_asset_id: assetId },
      );
      if (error || !data) {
        throw new PortalAssetDeletionError(
          error?.message ?? "asset_delete_finalize_failed",
          502,
        );
      }
    },
    prepare: async () => {
      const { data: path, error } = await supabase.rpc(
        "delete_portal_asset_record",
        { target_asset_id: assetId },
      );
      if (error || !path) {
        const referenced = error?.code === "23503";
        const notFound = error?.message === "Asset not found";
        throw new PortalAssetDeletionError(
          referenced
            ? "asset_referenced"
            : (error?.message ?? "asset_not_found"),
          referenced ? 409 : notFound ? 404 : 403,
        );
      }
      return path;
    },
    removeStorage: async (path) => {
      const removed = await admin.storage.from("portal-assets").remove([path]);
      if (removed.error) {
        throw new PortalAssetDeletionError("storage_delete_failed", 502);
      }
    },
  });
}

async function finalizePortalAsset(
  assetId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("portal_assets")
    .select("id,portal_id,file_path,name,mime_type,category,state")
    .eq("id", assetId)
    .maybeSingle();

  if (!asset || !(await canEditPortal(supabase, asset.portal_id))) {
    return null;
  }
  if (asset.state === "ready") return asset;

  const info = await admin.storage.from("portal-assets").info(asset.file_path);
  if (info.error || !info.data.size) {
    return null;
  }

  const downloaded = await admin.storage
    .from("portal-assets")
    .download(asset.file_path);
  const storedMimeType = normalizeAssetMimeType(info.data.contentType);
  // Supabase Storage can report application/octet-stream for proprietary Adobe
  // formats even when the upload was sent with the canonical declared MIME.
  // The bytes are still validated below, so falling back to the reservation's
  // allowlisted declaration does not weaken content validation.
  const actualMimeType =
    storedMimeType && storedMimeType !== "application/octet-stream"
      ? storedMimeType
      : normalizeAssetMimeType(asset.mime_type);
  if (
    downloaded.error ||
    !downloaded.data ||
    !actualMimeType ||
    !asset.name ||
    !asset.category ||
    !areAssetMimeTypesCompatible(asset.name, asset.mime_type, actualMimeType) ||
    !validateAssetDeclaration({
      category: asset.category as never,
      mimeType: actualMimeType,
      name: asset.name,
    }) ||
    !validateAssetBytes(
      new Uint8Array(await downloaded.data.arrayBuffer()),
      actualMimeType,
      asset.name,
    )
  ) {
    await deletePortalAsset(asset.id, supabase).catch(() => undefined);
    return null;
  }

  const { data: finalized, error } = await admin.rpc("finalize_portal_asset", {
    actual_mime_type: actualMimeType,
    actual_size_bytes: info.data.size,
    target_asset_id: asset.id,
  });
  if (error || !finalized) {
    await deletePortalAsset(asset.id, supabase).catch(() => undefined);
    return null;
  }

  return finalized;
}

export async function GET(request: Request) {
  const portalId = new URL(request.url).searchParams.get("portalId");
  if (!portalId) {
    return NextResponse.json({ error: "portal_id_required" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!(await canEditPortal(supabase, portalId))) {
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  }

  await cleanupExpiredReservations();
  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("portal_assets")
    .select("id,name,file_path,mime_type,size_bytes,category,state")
    .eq("portal_id", portalId)
    .eq("state", "reserved")
    .gt("reservation_expires_at", new Date().toISOString())
    .limit(25);

  return NextResponse.json({
    assets: (pending ?? []).map((asset) => ({
      assetId: asset.id,
      category: asset.category,
      mimeType: asset.mime_type,
      name: asset.name,
      path: asset.file_path,
      sizeBytes: asset.size_bytes,
      state: asset.state,
    })),
  });
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    try {
      const form = await request.formData();
      const file = form.get("file");
      const portalId = form.get("portalId");
      const category = form.get("category");
      if (
        !(file instanceof File) ||
        typeof portalId !== "string" ||
        typeof category !== "string"
      ) {
        return NextResponse.json({ error: "invalid_asset" }, { status: 400 });
      }
      const mimeType = inferAssetMimeType(file.name, file.type);
      if (
        !categories.has(category) ||
        !validateAssetDeclaration({
          category: category as never,
          mimeType,
          name: file.name,
        })
      ) {
        return NextResponse.json({ error: "invalid_asset" }, { status: 400 });
      }
      const supabase = await createClient();
      if (!(await canEditPortal(supabase, portalId))) {
        return NextResponse.json(
          { error: "portal_not_found" },
          { status: 404 },
        );
      }
      await cleanupExpiredReservations();
      const assetId = crypto.randomUUID();
      const { data: reserved, error: reservationError } = await supabase.rpc(
        "reserve_portal_asset",
        {
          asset_category: category,
          asset_id: assetId,
          asset_mime_type: mimeType,
          asset_name: sanitizeAssetName(file.name, "asset"),
          asset_size_bytes: file.size,
          target_portal_id: portalId,
        },
      );
      if (reservationError || !reserved) {
        return NextResponse.json(
          { error: reservationError?.message ?? "reservation_failed" },
          { status: reservationError?.code === "P0001" ? 422 : 403 },
        );
      }
      const admin = createAdminClient();
      const uploaded = await admin.storage
        .from("portal-assets")
        .upload(reserved.file_path, file, {
          contentType: mimeType,
          upsert: false,
        });
      if (uploaded.error) {
        await deletePortalAsset(assetId, supabase).catch(() => undefined);
        return NextResponse.json(
          { error: "storage_upload_failed" },
          { status: 502 },
        );
      }
      const preview = await admin.storage
        .from("portal-assets")
        .createSignedUrl(reserved.file_path, PORTAL_ASSET_PREVIEW_TTL_SECONDS);
      if (preview.error || !preview.data.signedUrl) {
        return NextResponse.json(
          { error: "preview_authorization_failed" },
          { status: 502 },
        );
      }
      return NextResponse.json(
        {
          asset: { id: assetId, state: "reserved", size_bytes: file.size },
          assetId,
          path: reserved.file_path,
          previewUrl: preview.data.signedUrl,
          state: "reserved",
        },
        { status: 202 },
      );
    } catch (error) {
      console.error("Server-owned portal asset upload failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "upload_processing_failed" },
        { status: 502 },
      );
    }
  }

  const body = (await request.json().catch(() => null)) as {
    category?: string;
    mimeType?: string;
    name?: string;
    portalId?: string;
    sizeBytes?: number;
  } | null;
  if (
    !body?.portalId ||
    !body.name ||
    !body.mimeType ||
    !Number.isSafeInteger(body.sizeBytes) ||
    (body.sizeBytes ?? 0) <= 0 ||
    !categories.has(body.category ?? "") ||
    !validateAssetDeclaration({
      category: body.category as never,
      mimeType: body.mimeType,
      name: body.name,
    })
  ) {
    return NextResponse.json({ error: "invalid_asset" }, { status: 400 });
  }
  const assetId = crypto.randomUUID();
  const assetName = sanitizeAssetName(body.name, "asset");
  const supabase = await createClient();
  await cleanupExpiredReservations();
  const { data: asset, error } = await supabase.rpc("reserve_portal_asset", {
    asset_category: body.category as string,
    asset_id: assetId,
    asset_mime_type: body.mimeType,
    asset_name: assetName,
    asset_size_bytes: body.sizeBytes as number,
    target_portal_id: body.portalId,
  });
  if (error || !asset) {
    return NextResponse.json(
      { error: error?.message ?? "reservation_failed" },
      { status: error?.code === "P0001" ? 422 : 403 },
    );
  }
  const signed = await createAdminClient()
    .storage.from("portal-assets")
    .createSignedUploadUrl(asset.file_path, { upsert: false });
  if (signed.error) {
    await deletePortalAsset(asset.id, supabase).catch(() => undefined);
    return NextResponse.json(
      { error: "upload_authorization_failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({
    assetId: asset.id,
    path: asset.file_path,
    token: signed.data.token,
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    assetId?: string;
  } | null;
  if (!body?.assetId) {
    return NextResponse.json({ error: "asset_id_required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  const finalized = await finalizePortalAsset(body.assetId, supabase);
  if (!finalized) {
    return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
  }
  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("portal_assets")
    .select("file_path")
    .eq("id", body.assetId)
    .maybeSingle();
  if (!asset)
    return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
  const preview = await admin.storage
    .from("portal-assets")
    .createSignedUrl(asset.file_path, PORTAL_ASSET_PREVIEW_TTL_SECONDS);
  if (preview.error || !preview.data.signedUrl) {
    return NextResponse.json(
      { error: "preview_authorization_failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({
    asset: finalized,
    previewUrl: preview.data.signedUrl,
  });
}

export async function DELETE(request: Request) {
  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId)
    return NextResponse.json({ error: "asset_id_required" }, { status: 400 });
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  try {
    await deletePortalAsset(assetId, supabase);
  } catch (error) {
    if (error instanceof PortalAssetDeletionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "asset_delete_failed" }, { status: 502 });
  }
  return NextResponse.json({ deleted: true });
}
