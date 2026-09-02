import type {
  ImageAspectRatio,
  ImageFit,
  PortalImageItem,
} from "@/domain/portal/document";

export type AiPortalOperation = "generate" | "improve-project" | "refine-copy";
export type { FieldOrigin } from "@/domain/portal/field-origin";

export type AssetAnalysisInput = {
  id: string;
  isPrimary?: boolean;
  name: string;
  mimeType: string;
  storagePath?: string;
  fileUrl?: string;
  sizeBytes?: number;
  description?: string;
  detectedColors?: string[];
  width?: number;
  height?: number;
  hasTransparency?: boolean;
};

export type ImageAnalysis = {
  assetId: string;
  backgroundColor: string;
  contentType: "logo" | "mockup" | "photograph" | "illustration" | "image";
  containerPadding: number;
  orientation: "portrait" | "landscape" | "square" | "unknown";
  aspectRatio: ImageAspectRatio;
  fit: ImageFit;
};

function ratio(width?: number, height?: number) {
  if (!width || !height)
    return { orientation: "unknown" as const, aspectRatio: "auto" as const };
  const value = width / height;
  if (Math.abs(value - 1) < 0.08)
    return { orientation: "square" as const, aspectRatio: "1/1" as const };
  if (value >= 2)
    return { orientation: "landscape" as const, aspectRatio: "21/9" as const };
  if (value >= 1.45)
    return { orientation: "landscape" as const, aspectRatio: "16/9" as const };
  if (value > 1)
    return { orientation: "landscape" as const, aspectRatio: "4/3" as const };
  return { orientation: "portrait" as const, aspectRatio: "auto" as const };
}

export function constrainImageAspectRatio(
  width: number | undefined,
  height: number | undefined,
  requested: ImageAspectRatio,
): ImageAspectRatio {
  if (!width || !height) return requested;
  const actual = ratio(width, height).aspectRatio;
  if (actual === "1/1") return requested === "1/1" ? requested : actual;
  return actual;
}

export function unifyImagePresentation(images: PortalImageItem[]) {
  if (images.length < 2) return images;
  const aspectCounts = new Map<ImageAspectRatio, number>();
  for (const image of images) {
    const aspect = constrainImageAspectRatio(
      image.width,
      image.height,
      image.aspect_ratio,
    );
    aspectCounts.set(aspect, (aspectCounts.get(aspect) ?? 0) + 1);
  }
  const dominantAspect = images.reduce<ImageAspectRatio | null>(
    (dominant, image) => {
      const aspect = constrainImageAspectRatio(
        image.width,
        image.height,
        image.aspect_ratio,
      );
      if (!dominant) return aspect;
      return (aspectCounts.get(aspect) ?? 0) > (aspectCounts.get(dominant) ?? 0)
        ? aspect
        : dominant;
    },
    null,
  );
  if (!dominantAspect) return images;
  return images.map((image) => ({
    ...image,
    aspect_ratio:
      image.field_origins?.aspect_ratio === "manual"
        ? image.aspect_ratio
        : dominantAspect,
    fit: image.fit === "auto" ? "cover" : image.fit,
    field_origins: {
      ...image.field_origins,
      aspect_ratio: image.field_origins?.aspect_ratio ?? "ai",
      fit: image.field_origins?.fit ?? "ai",
    },
  }));
}

export function analyzeImageAsset(asset: AssetAnalysisInput): ImageAnalysis {
  const filename = asset.name.toLowerCase();
  const isLogo = asset.hasTransparency || /logo|mark|brand|icon/.test(filename);
  const isMockup = /mockup|device|screen|wireframe/.test(filename);
  const dimensions = ratio(asset.width, asset.height);
  return {
    assetId: asset.id,
    backgroundColor: isLogo ? "secondary" : "transparent",
    contentType: isLogo
      ? "logo"
      : isMockup
        ? "mockup"
        : /illustration|sketch|vector/.test(filename)
          ? "illustration"
          : "photograph",
    containerPadding: isLogo ? 16 : 0,
    fit: isLogo || isMockup ? "contain" : "cover",
    ...dimensions,
  };
}

export function applyAiImageAnalysis(
  image: PortalImageItem,
  analysis: ImageAnalysis,
): PortalImageItem {
  return {
    ...image,
    background_color:
      image.field_origins?.background_color === "manual"
        ? image.background_color
        : analysis.backgroundColor,
    container_padding:
      image.field_origins?.container_padding === "manual"
        ? image.container_padding
        : analysis.containerPadding,
    fit: image.field_origins?.fit === "manual" ? image.fit : analysis.fit,
    aspect_ratio:
      image.field_origins?.aspect_ratio === "manual"
        ? image.aspect_ratio
        : analysis.aspectRatio,
    field_origins: {
      ...image.field_origins,
      alt_text: image.field_origins?.alt_text ?? "ai",
      background_color: image.field_origins?.background_color ?? "ai",
      container_padding: image.field_origins?.container_padding ?? "ai",
      fit: image.field_origins?.fit ?? "ai",
      aspect_ratio: image.field_origins?.aspect_ratio ?? "ai",
    },
  };
}

export function markImageFieldManual(
  image: PortalImageItem,
  field:
    | "fit"
    | "aspect_ratio"
    | "alt_text"
    | "background_color"
    | "container_padding"
    | "display_name"
    | "download_name"
    | "visible",
): PortalImageItem {
  return {
    ...image,
    field_origins: { ...image.field_origins, [field]: "manual" },
  };
}
