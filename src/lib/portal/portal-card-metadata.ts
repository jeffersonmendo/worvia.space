import {
  stablePortalAssetPreviewUrl,
  stablePortalImagePreviewUrl,
} from "@/lib/portal/asset-preview-reference";

export const PORTAL_CARD_FILE_TYPES = ["ai", "psd", "eps", "pdf"] as const;

export type PortalCardFileType = (typeof PORTAL_CARD_FILE_TYPES)[number];
export type PortalCardImage = {
  alt: string;
  backgroundColor?: string;
  containerPadding?: number;
  height?: number;
  url: string;
  width?: number;
};

function normalizeImageBackgroundColor(value: unknown) {
  if (value === "transparent" || value === "secondary") return value;
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : "secondary";
}

function normalizeImageContainerPadding(value: unknown) {
  return Math.min(
    10,
    Math.max(
      0,
      typeof value === "number" && Number.isFinite(value) ? value : 0,
    ),
  );
}

export function normalizePortalCardFileTypes(values: unknown) {
  if (!Array.isArray(values)) return [];
  const supported = new Set<string>(PORTAL_CARD_FILE_TYPES);
  const found = new Set(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().replace(/^\./, "").toLowerCase())
      .filter((value) => supported.has(value)),
  );
  return PORTAL_CARD_FILE_TYPES.filter((value) => found.has(value));
}

export function normalizePortalCardFileCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export const normalizePortalCardImageCount = normalizePortalCardFileCount;

export function normalizePortalCardColors(values: unknown) {
  return normalizePortalCardColorValues(values).slice(0, 4);
}

function normalizePortalCardColorValues(values: unknown) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values
    .filter((value): value is string => typeof value === "string")
    .filter((value) => /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value))
    .filter((value) => {
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function normalizePortalCardColorCount(values: unknown) {
  return normalizePortalCardColorValues(values).length;
}

export function normalizePortalCardImages(
  values: unknown,
  slug: string,
): PortalCardImage[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values
    .flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const record = value as Record<string, unknown>;
      const reference = typeof record.url === "string" ? record.url.trim() : "";
      const assetId =
        typeof record.assetId === "string" ? record.assetId.trim() : "";
      const storagePath =
        typeof record.storagePath === "string" ? record.storagePath.trim() : "";
      const url =
        assetId || storagePath
          ? stablePortalAssetPreviewUrl(slug, assetId, storagePath)
          : reference
            ? stablePortalImagePreviewUrl(slug, reference)
            : null;
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [
        {
          alt: typeof record.alt === "string" ? record.alt : "",
          backgroundColor: normalizeImageBackgroundColor(
            record.backgroundColor ?? record.background_color,
          ),
          containerPadding: normalizeImageContainerPadding(
            record.containerPadding ?? record.container_padding,
          ),
          height:
            typeof record.height === "number" && record.height > 0
              ? record.height
              : undefined,
          url,
          width:
            typeof record.width === "number" && record.width > 0
              ? record.width
              : undefined,
        },
      ];
    })
    .slice(0, 1);
}
