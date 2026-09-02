import "server-only";

import type {
  PortalDocument,
  PortalFileItem,
  PortalFontItem,
  PortalImageItem,
} from "@/domain/portal/document";
import { stablePortalAssetPreviewUrl } from "@/lib/portal/asset-preview-reference";
import {
  EXPORT_LIMITS,
  type ExportEntry,
  isCanonicalPortalAssetPath,
  parsePortalStorageReference,
} from "@/lib/portal/export-manifest";
import { isAllowedExportMime } from "@/lib/portal/export-mime";
import {
  selectPreviewUrl,
  shouldUseOriginalPreviewFallback,
} from "@/lib/portal/preview-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PREVIEWABLE_FILE_EXTENSIONS = new Set([
  "avif",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

// Preview URLs are returned in the rendered document and can remain in the
// client router cache while the editor is open. Five minutes is too short for
// that lifecycle, so keep the private signed URLs valid for one hour.
export const PORTAL_ASSET_PREVIEW_TTL_SECONDS = 60 * 60;

function parseLegacyPortalStorageReference(value: string) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(
      /^\/storage\/v1\/object\/(?:public|sign)\/portal-assets\/(.+)$/,
    );
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    if (
      !path ||
      path.split("/").some((part) => !part || part === "." || part === "..")
    )
      return null;
    return { bucket: "portal-assets" as const, path };
  } catch {
    return null;
  }
}

function resolvePreviewStorageReference(value: string) {
  return (
    parsePortalStorageReference(value, getSupabaseEnv().url) ??
    parseLegacyPortalStorageReference(value)
  );
}

export async function fetchStorageEntry(
  entry: ExportEntry,
  remainingBytes: number,
  authorization: { ownerId: string; portalId: string },
) {
  if (
    !entry.storage ||
    !isCanonicalPortalAssetPath(
      entry.storage.path,
      authorization.ownerId,
      authorization.portalId,
    )
  )
    throw new Error("Storage path rejected");

  const { data, error } = await createAdminClient()
    .storage.from(entry.storage.bucket)
    .download(entry.storage.path);
  if (error || !data) {
    throw new Error(error?.message ?? "Storage download failed");
  }

  const mime =
    data.type?.split(";", 1)[0]?.toLowerCase() || "application/octet-stream";
  if (!isAllowedExportMime(mime)) {
    throw new Error("Asset MIME rejected");
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  if (
    bytes.length > EXPORT_LIMITS.maxFileBytes ||
    bytes.length > remainingBytes
  )
    throw new Error("Asset size limit exceeded");

  return { bytes, mime };
}

type PortalAssetAuthorization = {
  ownerId: string;
  portalId: string;
  slug: string;
};

async function previewImage(
  image: PortalImageItem,
  authorization: PortalAssetAuthorization,
) {
  if (!image.visible) return { ...image, image_url: "" };
  const canonicalUrl = stablePortalAssetPreviewUrl(
    authorization.slug,
    image.asset_id,
    image.storage_path,
  );
  if (canonicalUrl) {
    return { ...image, image_url: canonicalUrl };
  }
  const storage = image.storage_path
    ? { bucket: "portal-assets" as const, path: image.storage_path }
    : resolvePreviewStorageReference(image.image_url);
  if (
    !storage ||
    !isCanonicalPortalAssetPath(
      storage.path,
      authorization.ownerId,
      authorization.portalId,
    )
  )
    return { ...image, image_url: "" };
  const stableUrl = stablePortalAssetPreviewUrl(
    authorization.slug,
    image.asset_id,
    storage.path,
  );
  if (stableUrl)
    return { ...image, image_url: stableUrl, storage_path: storage.path };
  const supabaseUrl = getSupabaseEnv().url;
  const bucket = createAdminClient().storage.from(storage.bucket);
  const { data, error } = await bucket.createSignedUrl(
    storage.path,
    PORTAL_ASSET_PREVIEW_TTL_SECONDS,
    {
      transform: { height: 1200, quality: 75, resize: "contain", width: 1600 },
    },
  );
  const requiresOriginalFallback =
    shouldUseOriginalPreviewFallback(supabaseUrl);
  if (!requiresOriginalFallback && !error && data.signedUrl) {
    return { ...image, image_url: data.signedUrl };
  }

  // Local Supabase installations may run without the image proxy. Preserve
  // private access semantics with a short-lived signed original instead of
  // hiding the image or leaking its persisted URL.
  const fallback = await bucket.createSignedUrl(
    storage.path,
    PORTAL_ASSET_PREVIEW_TTL_SECONDS,
  );
  return {
    ...image,
    image_url: selectPreviewUrl(
      data?.signedUrl,
      fallback.error ? null : fallback.data?.signedUrl,
      supabaseUrl,
    ),
  };
}

export function isPreviewableImageFile(file: PortalFileItem) {
  if (file.file_type !== undefined) {
    return file.file_type === "image" || file.file_type === "svg";
  }
  const extension = file.file_name.split(".").pop()?.toLowerCase();
  return extension ? PREVIEWABLE_FILE_EXTENSIONS.has(extension) : false;
}

async function previewFile(
  file: PortalFileItem,
  authorization: PortalAssetAuthorization,
) {
  const hasDownloadableAsset = Boolean(file.file_url || file.storage_path);
  if (!file.visible) return { ...file, file_url: "" };
  const canonicalUrl = stablePortalAssetPreviewUrl(
    authorization.slug,
    file.asset_id,
    file.storage_path,
  );
  if (canonicalUrl && isPreviewableImageFile(file)) {
    return { ...file, file_url: canonicalUrl };
  }
  if (!isPreviewableImageFile(file)) {
    return { ...file, file_url: hasDownloadableAsset ? "available" : "" };
  }

  const storage = file.storage_path
    ? { bucket: "portal-assets" as const, path: file.storage_path }
    : file.file_url
      ? resolvePreviewStorageReference(file.file_url)
      : null;
  if (
    !storage ||
    !isCanonicalPortalAssetPath(
      storage.path,
      authorization.ownerId,
      authorization.portalId,
    )
  ) {
    return { ...file, file_url: hasDownloadableAsset ? "available" : "" };
  }
  const stableUrl = stablePortalAssetPreviewUrl(
    authorization.slug,
    file.asset_id,
    storage.path,
  );
  if (stableUrl)
    return { ...file, file_url: stableUrl, storage_path: storage.path };

  const bucket = createAdminClient().storage.from(storage.bucket);
  const { data, error } = await bucket.createSignedUrl(
    storage.path,
    PORTAL_ASSET_PREVIEW_TTL_SECONDS,
    {
      transform: { height: 600, quality: 70, resize: "contain", width: 600 },
    },
  );
  const fallback = error
    ? await bucket.createSignedUrl(
        storage.path,
        PORTAL_ASSET_PREVIEW_TTL_SECONDS,
      )
    : null;

  return {
    ...file,
    file_url:
      selectPreviewUrl(
        data?.signedUrl,
        fallback?.error ? null : fallback?.data?.signedUrl,
        getSupabaseEnv().url,
      ) || (hasDownloadableAsset ? "available" : ""),
  };
}

async function previewFont(
  font: PortalFontItem,
  authorization: PortalAssetAuthorization,
) {
  if (!font.visible) return { ...font, file_url: undefined };
  const canonicalUrl = stablePortalAssetPreviewUrl(
    authorization.slug,
    font.asset_id,
    font.storage_path,
  );
  if (canonicalUrl) {
    return { ...font, file_url: canonicalUrl };
  }
  const storage = font.storage_path
    ? { bucket: "portal-assets" as const, path: font.storage_path }
    : font.file_url
      ? resolvePreviewStorageReference(font.file_url)
      : null;
  if (
    !storage ||
    !isCanonicalPortalAssetPath(
      storage.path,
      authorization.ownerId,
      authorization.portalId,
    )
  ) {
    return { ...font, file_url: undefined };
  }
  const stableUrl = stablePortalAssetPreviewUrl(
    authorization.slug,
    font.asset_id,
    storage.path,
  );
  if (stableUrl)
    return { ...font, file_url: stableUrl, storage_path: storage.path };

  const { data, error } = await createAdminClient()
    .storage.from(storage.bucket)
    .createSignedUrl(storage.path, PORTAL_ASSET_PREVIEW_TTL_SECONDS);

  return {
    ...font,
    file_url: error ? undefined : data.signedUrl,
  };
}

/** Removes original URLs from the RSC payload and creates short-lived optimized previews. */
export async function prepareDocumentForRendering(
  document: PortalDocument,
  authorization: PortalAssetAuthorization,
) {
  return {
    ...document,
    sections: await Promise.all(
      document.sections.map(async (section) => {
        const renderImage = (image: PortalImageItem) =>
          section.visible
            ? previewImage(image, authorization)
            : Promise.resolve({ ...image, image_url: "" });
        return {
          ...section,
          content: {
            ...section.content,
            image: section.content.image
              ? await renderImage(section.content.image)
              : section.content.image,
            images: section.content.images
              ? await Promise.all(section.content.images.map(renderImage))
              : section.content.images,
            fonts: section.content.fonts
              ? await Promise.all(
                  section.content.fonts.map((font) =>
                    previewFont(font, authorization),
                  ),
                )
              : section.content.fonts,
            files: section.content.files
              ? await Promise.all(
                  section.content.files.map((file) =>
                    previewFile(file, authorization),
                  ),
                )
              : section.content.files,
          },
        };
      }),
    ),
  } satisfies PortalDocument;
}
