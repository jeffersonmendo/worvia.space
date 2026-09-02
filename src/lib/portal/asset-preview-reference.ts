import type {
  PortalDocument,
  PortalFileItem,
  PortalFontItem,
  PortalImageItem,
} from "@/domain/portal/document";
import type { Json } from "@/lib/supabase/database.types";

export function containsPortalAssetReference(
  value: Json | null | undefined,
  assetId: string | null,
  storagePath: string | null,
): boolean {
  if (typeof value === "string") {
    return (
      value === assetId ||
      value === storagePath ||
      Boolean(storagePath && value.includes(storagePath)) ||
      Boolean(assetId && value === `portal-asset:${assetId}`) ||
      Boolean(storagePath && value === `portal-asset-path:${storagePath}`)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) =>
      containsPortalAssetReference(item, assetId, storagePath),
    );
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      containsPortalAssetReference(item, assetId, storagePath),
    );
  }
  return false;
}

export function stablePortalAssetPreviewUrl(
  slug: string,
  assetId?: string,
  storagePath?: string,
) {
  const query = new URLSearchParams({ slug });
  if (assetId) query.set("assetId", assetId);
  else if (storagePath) query.set("path", storagePath);
  else return null;
  return `/api/portal-assets/preview?${query.toString()}`;
}

export function stablePortalImagePreviewUrl(slug: string, reference: string) {
  if (reference.startsWith("portal-asset:")) {
    const assetId = reference.slice("portal-asset:".length).trim();
    return assetId ? stablePortalAssetPreviewUrl(slug, assetId) : null;
  }
  if (reference.startsWith("portal-asset-path:")) {
    const storagePath = reference.slice("portal-asset-path:".length).trim();
    return storagePath
      ? stablePortalAssetPreviewUrl(slug, undefined, storagePath)
      : null;
  }
  return reference;
}

/**
 * Resolve an image reference for the editor without replacing a fresh upload's
 * signed URL before its stable asset reference is ready for the preview route.
 */
export function editorPortalImagePreviewUrl(
  image: Pick<PortalImageItem, "asset_id" | "image_url" | "storage_path">,
  portalSlug?: string,
) {
  if (!portalSlug || image.image_url.startsWith("/api/portal-assets/preview")) {
    return image.image_url;
  }

  // Fresh uploads already have asset metadata, but the protected preview
  // route cannot authorize them until the async autosave persists the
  // reference. Hydrated documents are normalized by
  // withStablePortalAssetPreviews, so keep the current URL here.
  return (
    stablePortalImagePreviewUrl(portalSlug, image.image_url) ?? image.image_url
  );
}

function stableImagePreview(image: PortalImageItem, slug: string) {
  const url = stablePortalAssetPreviewUrl(
    slug,
    image.asset_id,
    image.storage_path,
  );
  return url ? { ...image, image_url: url } : image;
}

function stableFilePreview(file: PortalFileItem, slug: string) {
  const url = stablePortalAssetPreviewUrl(
    slug,
    file.asset_id,
    file.storage_path,
  );
  return url ? { ...file, file_url: url } : file;
}

function stableFontPreview(font: PortalFontItem, slug: string) {
  const url = stablePortalAssetPreviewUrl(
    slug,
    font.asset_id,
    font.storage_path,
  );
  return url ? { ...font, file_url: url } : font;
}

/** Prevent a stale client document from reintroducing signed storage URLs. */
export function withStablePortalAssetPreviews(
  document: PortalDocument,
  slug: string,
): PortalDocument {
  if (!slug) return document;
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      content: {
        ...section.content,
        image: section.content.image
          ? stableImagePreview(section.content.image, slug)
          : section.content.image,
        images: section.content.images?.map((image) =>
          stableImagePreview(image, slug),
        ),
        files: section.content.files?.map((file) =>
          stableFilePreview(file, slug),
        ),
        fonts: section.content.fonts?.map((font) =>
          stableFontPreview(font, slug),
        ),
      },
    })),
  };
}
