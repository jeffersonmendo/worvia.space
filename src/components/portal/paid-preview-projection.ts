export type PaidPreviewAssetSummary = {
  assetType: string;
  count: number;
  totalBytes: number;
};

export type PaidPreviewFile = {
  assetType: string;
};

export type PaidPreviewInput = {
  assetSummary?: PaidPreviewAssetSummary[] | null;
  colors?: string[] | null;
  description: string | null;
  name: string;
  previewImages?: PaidPreviewImage[] | null;
  sampleFiles?: PaidPreviewFile[] | null;
  price?: string | null;
  totalBytes?: number | null;
  totalFiles?: number | null;
  totalImages?: number | null;
};

export type PaidPreviewProjection = {
  assetSummary: PaidPreviewAssetSummary[];
  colors: string[];
  description: string | null;
  name: string;
  previewImages: PaidPreviewImage[];
  sampleFiles: PaidPreviewFile[];
  price: string | null;
  totalBytes: number;
  totalFiles: number;
  totalImages: number;
};

export type PaidPreviewDecision = "preview_required" | "paid-not-purchased";

export function isPaidPreviewDecision(
  decision: string,
): decision is PaidPreviewDecision {
  return decision === "preview_required" || decision === "paid-not-purchased";
}

export function projectPaidPreview(
  input: PaidPreviewInput,
): PaidPreviewProjection {
  return {
    assetSummary: (input.assetSummary ?? []).filter(
      (asset) =>
        asset.assetType.trim().length > 0 &&
        Number.isInteger(asset.count) &&
        asset.count > 0 &&
        Number.isInteger(asset.totalBytes) &&
        asset.totalBytes >= 0,
    ),
    colors: [...new Set(input.colors ?? [])].filter((color) =>
      /^(?:#[0-9a-f]{3,4}|#[0-9a-f]{6,8}|(?:rgb|rgba|hsl|hsla|hsb|hsba)\(.+\))$/i.test(
        color,
      ),
    ),
    description: input.description,
    name: input.name,
    previewImages: (input.previewImages ?? []).filter(
      (image) => image.src.trim().length > 0 && image.alt.trim().length > 0,
    ),
    sampleFiles: (input.sampleFiles ?? []).filter(
      (file) => file.assetType.trim().length > 0,
    ),
    price: input.price ?? null,
    totalBytes:
      Number.isInteger(input.totalBytes) && (input.totalBytes ?? 0) >= 0
        ? (input.totalBytes as number)
        : 0,
    totalFiles:
      Number.isInteger(input.totalFiles) && (input.totalFiles ?? 0) >= 0
        ? (input.totalFiles as number)
        : 0,
    totalImages:
      Number.isInteger(input.totalImages) && (input.totalImages ?? 0) >= 0
        ? (input.totalImages as number)
        : 0,
  };
}

export function formatPreviewBytes(bytes: number, locale: string) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}
export type PaidPreviewImage = {
  alt: string;
  src: string;
};
