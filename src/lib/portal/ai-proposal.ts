import {
  createDefaultPortalDocument,
  createImageItem,
  createPortalSection,
  type PortalDocument,
  type PortalFileType,
  type PortalSection,
} from "@/domain/portal/document";
import { AI_OPERATION_COSTS } from "@/lib/billing/ai-credits";
import {
  type PortalPlan as BillingPortalPlan,
  portalColorItemLimit,
  portalGalleryItemLimit,
  validatePortalPublication,
} from "@/lib/billing/portal-policy";
import {
  type AiPortalOperation,
  type AssetAnalysisInput,
  analyzeImageAsset,
  applyAiImageAnalysis,
  unifyImagePresentation,
} from "@/lib/portal/ai";
import type { AiStructuredEnhancement } from "@/lib/portal/ai-sdk";
import {
  capitalizeFirstLetter,
  normalizeAssetDownloadName,
} from "@/lib/portal/asset-names";
import { isRenderableImageMimeType } from "@/lib/portal/asset-validation";

export type AiAssetInput = AssetAnalysisInput & {
  fileUrl?: string;
  sizeBytes?: number;
  description?: string;
};

export type QuarantinedAsset = {
  assetId: string;
  reason: "irrelevant" | "duplicate" | "unsupported";
  confidence: "low" | "medium" | "high";
  recommendation: "review" | "exclude";
};

export type GenerationWarning = {
  code: "quarantine" | "plan_limit" | "missing_metadata";
  message: string;
};
export type DetectedColor = {
  color_code: string;
  confidence: "medium" | "high";
};
export type AiPortalProposal = {
  proposedDocument: PortalDocument;
  includedAssets: string[];
  quarantinedAssets: QuarantinedAsset[];
  detectedColors: DetectedColor[];
  detectedFonts: string[];
  warnings: GenerationWarning[];
  creditCost: number;
};

export function preserveManualPortalFields(
  current: PortalDocument,
  proposed: PortalDocument,
): PortalDocument {
  const currentSections = new Map(
    current.sections.map((section) => [section.id, section]),
  );
  return {
    ...proposed,
    sections: proposed.sections.map((section) => {
      const previous = currentSections.get(section.id);
      if (!previous) return section;
      const manualSection = Object.fromEntries(
        Object.entries(previous.field_origins ?? {})
          .filter(([, origin]) => origin === "manual")
          .map(([field]) => [field, previous[field as keyof typeof previous]]),
      ) as Partial<PortalSection>;
      const previousImages = new Map(
        (previous.content.images ?? []).map((image) => [image.id, image]),
      );
      const previousFiles = new Map(
        (previous.content.files ?? []).map((file) => [file.id, file]),
      );
      const previousFonts = new Map(
        (previous.content.fonts ?? []).map((font) => [font.id, font]),
      );
      const mergeImage = (
        image: NonNullable<PortalSection["content"]["image"]>,
      ) => {
        const old = previousImages.get(image.id) ?? previous.content.image;
        if (!old) return image;
        return {
          ...image,
          ...Object.fromEntries(
            Object.entries(old.field_origins ?? {})
              .filter(([, origin]) => origin === "manual")
              .map(([field]) => [field, old[field as keyof typeof old]]),
          ),
        };
      };
      const mergeAssetNames = <
        T extends {
          display_name?: string;
          download_name?: string;
          field_origins?: Partial<
            Record<"display_name" | "download_name", "ai" | "manual">
          >;
        },
      >(
        item: T,
        old: T | undefined,
      ) => {
        if (!old) return item;
        const displayManual = old.field_origins?.display_name === "manual";
        const downloadManual = old.field_origins?.download_name === "manual";
        if (!displayManual && !downloadManual) return item;
        return {
          ...item,
          display_name: displayManual ? old.display_name : item.display_name,
          download_name: downloadManual
            ? old.download_name
            : item.download_name,
          field_origins: {
            ...item.field_origins,
            ...(displayManual ? { display_name: "manual" as const } : {}),
            ...(downloadManual ? { download_name: "manual" as const } : {}),
          },
        };
      };
      return {
        ...section,
        ...manualSection,
        content: {
          ...section.content,
          image: section.content.image
            ? mergeImage(section.content.image)
            : section.content.image,
          images: section.content.images?.map(mergeImage),
          files: section.content.files?.map((file) =>
            mergeAssetNames(file, previousFiles.get(file.id)),
          ),
          fonts: section.content.fonts?.map((font) =>
            mergeAssetNames(font, previousFonts.get(font.id)),
          ),
        },
      };
    }),
  };
}

type ProposalInput = {
  assets: AiAssetInput[];
  excludedAssetIds?: string[];
  existingDocument?: PortalDocument;
  forceIncludeAssetIds?: string[];
  operation: AiPortalOperation;
  enhancement?: AiStructuredEnhancement | null;
  plan: BillingPortalPlan;
  portal: Parameters<typeof createDefaultPortalDocument>[0];
  projectDescription: string;
  generateColors?: boolean;
};

const irrelevant =
  /financial|finance|invoice|tax|admin|salary|contract|legal|budget|password/i;
const fontMime = /font|ttf|otf|woff/i;
const fileTypeByMime: Record<string, PortalFileType> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
};
const AI_GENERATED_COLOR_LIMIT = 5;

function sectionWithCopy(
  section: PortalSection,
  title: string,
  description: string,
): PortalSection {
  return {
    ...section,
    title,
    description,
    field_origins: {
      title: "ai",
      description: "ai",
      position: "ai",
      layout: "ai",
    },
  };
}

export function createAiPortalProposal(input: ProposalInput): AiPortalProposal {
  const document = input.existingDocument
    ? structuredClone(input.existingDocument)
    : createDefaultPortalDocument(input.portal);
  const quarantinedAssets: QuarantinedAsset[] = [];
  const includedAssets: string[] = [];
  const seenNames = new Set<string>();
  const images = [] as ReturnType<typeof createImageItem>[];
  const files = [] as NonNullable<PortalSection["content"]["files"]>;
  const fonts = [] as NonNullable<PortalSection["content"]["fonts"]>;
  const detectedFonts: string[] = [];
  const detectedColors = new Set<string>();
  const aiQuarantinedIds = new Set(
    input.enhancement?.quarantinedAssetIds ?? [],
  );
  const forceIncludedIds = new Set(input.forceIncludeAssetIds ?? []);
  const excludedIds = new Set(input.excludedAssetIds ?? []);
  const insightFor = (assetId: string) =>
    input.enhancement?.assetInsights.find(
      (insight) => insight.assetId === assetId,
    );

  if (input.enhancement?.projectCopy) {
    document.portal = {
      ...document.portal,
      description:
        input.enhancement.projectCopy.description.trim() ||
        document.portal.description,
      name: input.enhancement.projectCopy.name.trim() || document.portal.name,
    };
  }

  for (const asset of input.assets) {
    if (excludedIds.has(asset.id)) continue;
    const normalizedName = asset.name.trim().toLowerCase();
    if (seenNames.has(normalizedName)) {
      quarantinedAssets.push({
        assetId: asset.id,
        reason: "duplicate",
        confidence: "high",
        recommendation: "exclude",
      });
      continue;
    }
    seenNames.add(normalizedName);
    if (
      !forceIncludedIds.has(asset.id) &&
      (aiQuarantinedIds.has(asset.id) || irrelevant.test(normalizedName))
    ) {
      quarantinedAssets.push({
        assetId: asset.id,
        reason: "irrelevant",
        confidence: "high",
        recommendation: "review",
      });
      continue;
    }
    includedAssets.push(asset.id);
    const insight = insightFor(asset.id);
    for (const color of asset.detectedColors ?? []) detectedColors.add(color);
    const fileUrl = asset.fileUrl ?? `portal-asset:${asset.id}`;
    if (isRenderableImageMimeType(asset.mimeType)) {
      const image = {
        ...createImageItem(fileUrl, images.length),
        asset_id: asset.id,
        alt_text:
          insight?.altText ||
          insight?.description ||
          asset.description ||
          asset.name,
        display_name: insight?.displayName?.trim() || asset.name,
        download_name: normalizeAssetDownloadName(
          insight?.downloadName,
          asset.name,
        ),
        storage_path: asset.storagePath,
        height: asset.height,
        width: asset.width,
      };
      const existingImage = input.existingDocument?.sections
        .flatMap((s) => s.content.images ?? [])
        .find((item) => item.asset_id === asset.id);
      const imageWithAiName = {
        ...(existingImage ?? image),
        display_name:
          existingImage?.field_origins?.display_name === "manual"
            ? existingImage.display_name
            : image.display_name,
        download_name:
          existingImage?.field_origins?.download_name === "manual"
            ? existingImage.download_name
            : image.download_name,
      };
      const recommendation = input.enhancement?.imageRecommendations.find(
        (item) => item.assetId === asset.id,
      );
      images.push(
        applyAiImageAnalysis(imageWithAiName, {
          ...analyzeImageAsset(asset),
          ...(recommendation
            ? {
                aspectRatio: recommendation.aspectRatio,
                backgroundColor: recommendation.backgroundColor,
                containerPadding: recommendation.containerPadding,
                fit: recommendation.fit,
              }
            : {}),
        }),
      );
    } else if (fontMime.test(asset.mimeType)) {
      const fontName = asset.name.replace(/\.[^.]+$/, "") || asset.id;
      detectedFonts.push(fontName);
      fonts.push({
        asset_id: asset.id,
        file_name: asset.name,
        file_url: fileUrl,
        storage_path: asset.storagePath,
        font_name: fontName,
        id: `font_${asset.id}`,
        position: fonts.length,
        usage: insight?.usage || undefined,
        display_name: insight?.displayName?.trim() || asset.name,
        download_name: normalizeAssetDownloadName(
          insight?.downloadName,
          asset.name,
        ),
        field_origins: { display_name: "ai", download_name: "ai" },
        visible: true,
      });
    } else {
      files.push({
        allow_download: true,
        description: insight?.description || undefined,
        display_name: insight?.displayName?.trim() || asset.name,
        download_name: normalizeAssetDownloadName(
          insight?.downloadName,
          asset.name,
        ),
        field_origins: { display_name: "ai", download_name: "ai" },
        asset_id: asset.id,
        file_name: asset.name,
        file_size: asset.sizeBytes ? String(asset.sizeBytes) : undefined,
        file_type: fileTypeByMime[asset.mimeType],
        file_url: fileUrl,
        storage_path: asset.storagePath,
        id: `file_${asset.id}`,
        position: files.length,
        visible: true,
      });
    }
  }

  const plannedImageIds = new Set(
    (
      input.enhancement?.sectionPlan
        .filter(
          (section) => section.kind === "image" || section.kind === "gallery",
        )
        .flatMap((section) => section.assetIds) ?? []
    ).filter((assetId): assetId is string => typeof assetId === "string"),
  );
  const imageOrder = new Map<string, number>();
  let order = 0;
  for (const asset of input.assets) {
    if (asset.isPrimary && isRenderableImageMimeType(asset.mimeType)) {
      imageOrder.set(asset.id, order++);
    }
  }
  for (const assetId of plannedImageIds) {
    if (!imageOrder.has(assetId)) imageOrder.set(assetId, order++);
  }
  images.sort(
    (left, right) =>
      (imageOrder.get(left.asset_id ?? "") ?? Number.MAX_SAFE_INTEGER) -
      (imageOrder.get(right.asset_id ?? "") ?? Number.MAX_SAFE_INTEGER),
  );
  images.forEach((image, position) => {
    image.position = position;
  });

  const sections: PortalSection[] = [];
  const detectedColorByCode = new Map(
    [...detectedColors].map((color) => [color.toLowerCase(), color]),
  );
  const prioritizedColors = [
    ...(input.enhancement?.colorInsights ?? [])
      .map((insight) =>
        detectedColorByCode.get(insight.colorCode.toLowerCase()),
      )
      .filter((color): color is string => Boolean(color)),
    ...detectedColors,
  ];
  const colorsForDocument = [...new Set(prioritizedColors)].slice(
    0,
    Math.min(AI_GENERATED_COLOR_LIMIT, portalColorItemLimit(input.plan)),
  );
  const presentedImages = unifyImagePresentation(images);
  const primaryImageId = input.assets.find(
    (asset) => asset.isPrimary && isRenderableImageMimeType(asset.mimeType),
  )?.id;
  const presentedPrimaryImage = primaryImageId
    ? presentedImages.find((image) => image.asset_id === primaryImageId)
    : undefined;
  const hasPlannedImageSection = Boolean(
    input.enhancement?.sectionPlan.some((section) => section.kind === "image"),
  );
  const presentedGalleryImages = presentedPrimaryImage
    ? presentedImages.filter((image) => image !== presentedPrimaryImage)
    : images.length > 1 || !hasPlannedImageSection
      ? presentedImages
      : [];
  const plannedSection = (
    kind: "image" | "gallery" | "fonts" | "colors" | "files",
  ) => input.enhancement?.sectionPlan.find((section) => section.kind === kind);
  const sectionCopy = (
    kind: "image" | "gallery" | "fonts" | "colors" | "files",
  ) => {
    const copy = plannedSection(kind);
    if (!input.enhancement) return { title: "", description: "" };
    if (!copy?.title.trim() || !copy.description.trim()) {
      throw new Error(`ai_section_copy_missing:${kind}`);
    }
    return copy;
  };
  if (presentedPrimaryImage)
    (() => {
      const copy = sectionCopy("image");
      sections.push(
        sectionWithCopy(
          {
            ...createPortalSection("image", sections.length),
            content: { image: presentedPrimaryImage },
          },
          copy.title,
          copy.description,
        ),
      );
    })();
  else if (images.length === 1 && plannedSection("image"))
    (() => {
      const copy = sectionCopy("image");
      sections.push(
        sectionWithCopy(
          {
            ...createPortalSection("image", sections.length),
            content: { image: presentedImages[0] },
          },
          copy.title,
          copy.description,
        ),
      );
    })();
  if (
    presentedGalleryImages.length &&
    (presentedPrimaryImage || images.length > 1 || plannedSection("gallery"))
  )
    (() => {
      const copy = sectionCopy("gallery");
      const itemLimit = portalGalleryItemLimit(input.plan);
      const galleryBatches =
        itemLimit === Number.POSITIVE_INFINITY
          ? [presentedGalleryImages]
          : (() => {
              const batchCount = Math.ceil(
                presentedGalleryImages.length / itemLimit,
              );
              const baseBatchSize = Math.floor(
                presentedGalleryImages.length / batchCount,
              );
              const remainder = presentedGalleryImages.length % batchCount;
              let cursor = 0;
              return Array.from({ length: batchCount }, (_, index) => {
                const batchSize = baseBatchSize + (index < remainder ? 1 : 0);
                const batch = presentedGalleryImages.slice(
                  cursor,
                  cursor + batchSize,
                );
                cursor += batchSize;
                return batch;
              });
            })();
      galleryBatches.forEach((batch, index) => {
        sections.push(
          sectionWithCopy(
            {
              ...createPortalSection("gallery", sections.length),
              content: { images: batch },
            },
            galleryBatches.length > 1
              ? `${copy.title} ${index + 1}`
              : copy.title,
            copy.description,
          ),
        );
      });
    })();
  if (fonts.length)
    (() => {
      const copy = sectionCopy("fonts");
      sections.push(
        sectionWithCopy(
          {
            ...createPortalSection("fonts", sections.length),
            content: { fonts },
          },
          copy.title,
          copy.description,
        ),
      );
    })();
  if (colorsForDocument.length && input.generateColors !== false)
    (() => {
      const copy = sectionCopy("colors");
      sections.push(
        sectionWithCopy(
          {
            ...createPortalSection("colors", sections.length),
            content: {
              colors: colorsForDocument.map((color, position) => ({
                color_code: color,
                color_name: capitalizeFirstLetter(
                  input.enhancement?.colorInsights.find(
                    (insight) =>
                      insight.colorCode.toLowerCase() === color.toLowerCase(),
                  )?.name ?? "",
                ),
                id: `color_${color.slice(1)}`,
                position,
                visible: true,
              })),
            },
          },
          copy.title,
          copy.description,
        ),
      );
    })();
  if (files.length)
    (() => {
      const copy = sectionCopy("files");
      sections.push(
        sectionWithCopy(
          {
            ...createPortalSection("files", sections.length),
            content: { files },
          },
          copy.title,
          copy.description,
        ),
      );
    })();
  const improveExistingSections = (existingSections: PortalSection[]) =>
    existingSections.map((section) => {
      const copy =
        input.enhancement?.copyPlan?.find(
          (item) => item.sectionId === section.id,
        ) ??
        input.enhancement?.sectionPlan.find(
          (item) => item.sectionId === section.id,
        );
      return copy
        ? {
            ...section,
            title:
              section.field_origins?.title === "manual"
                ? section.title
                : copy.title,
            description:
              section.field_origins?.description === "manual"
                ? section.description
                : copy.description,
            field_origins: {
              ...section.field_origins,
              title:
                section.field_origins?.title === "manual"
                  ? ("manual" as const)
                  : ("ai" as const),
              description:
                section.field_origins?.description === "manual"
                  ? ("manual" as const)
                  : ("ai" as const),
            },
          }
        : section;
    });
  const mergeNewSections = (
    existingSections: PortalSection[],
    additions: PortalSection[],
  ) => {
    const merged = structuredClone(existingSections);
    for (const addition of additions) {
      const sameType = merged.find((section) => section.type === addition.type);
      if (sameType && addition.type === "gallery") {
        sameType.content.images = unifyImagePresentation([
          ...(sameType.content.images ?? []),
          ...(addition.content.images ?? []),
        ]);
        continue;
      }
      if (sameType && addition.type === "files") {
        sameType.content.files = [
          ...(sameType.content.files ?? []),
          ...(addition.content.files ?? []),
        ];
        continue;
      }
      if (sameType && addition.type === "fonts") {
        sameType.content.fonts = [
          ...(sameType.content.fonts ?? []),
          ...(addition.content.fonts ?? []),
        ];
        continue;
      }
      if (sameType && addition.type === "colors") {
        sameType.content.colors = [
          ...(sameType.content.colors ?? []),
          ...(addition.content.colors ?? []),
        ];
        continue;
      }
      if (addition.type === "image") {
        const gallery = merged.find((section) => section.type === "gallery");
        if (gallery && addition.content.image) {
          gallery.content.images = unifyImagePresentation([
            ...(gallery.content.images ?? []),
            addition.content.image,
          ]);
          continue;
        }
        if (sameType?.type === "image" && sameType.content.image) {
          sameType.type = "gallery";
          sameType.content = {
            images: unifyImagePresentation(
              [sameType.content.image, addition.content.image].filter(
                (
                  image,
                ): image is NonNullable<PortalSection["content"]["image"]> =>
                  Boolean(image),
              ),
            ),
          };
          sameType.layout = { ...sameType.layout, mode: "grid" };
          continue;
        }
      }
      if (addition.type === "gallery") {
        const image = merged.find((section) => section.type === "image");
        if (image?.content.image) {
          image.type = "gallery";
          image.content = {
            images: unifyImagePresentation([
              image.content.image,
              ...(addition.content.images ?? []),
            ]),
          };
          image.layout = { ...image.layout, mode: "grid" };
          continue;
        }
      }
      merged.push(addition);
    }
    return merged;
  };
  document.sections =
    input.operation === "refine-copy" && input.existingDocument
      ? input.existingDocument.sections.map((section) => {
          const kind =
            section.type === "gallery"
              ? "gallery"
              : section.type === "image"
                ? "image"
                : section.type === "fonts"
                  ? "fonts"
                  : section.type === "colors"
                    ? "colors"
                    : section.type === "files"
                      ? "files"
                      : undefined;
          const copy = kind
            ? (input.enhancement?.copyPlan?.find(
                (item) => item.sectionId === section.id,
              ) ??
              input.enhancement?.sectionPlan.find(
                (item) => item.sectionId === section.id || item.kind === kind,
              ))
            : input.enhancement?.copyPlan?.find(
                (item) => item.sectionId === section.id,
              );
          return copy
            ? {
                ...section,
                title:
                  section.field_origins?.title === "manual"
                    ? section.title
                    : copy.title,
                description:
                  section.field_origins?.description === "manual"
                    ? section.description
                    : copy.description,
              }
            : section;
        })
      : input.operation === "improve-project" && input.existingDocument
        ? mergeNewSections(
            improveExistingSections(input.existingDocument.sections),
            sections,
          ).map((section, index) => ({ ...section, position: index }))
        : input.operation === "generate"
          ? sections
          : [...document.sections, ...sections].map((section, index) => ({
              ...section,
              position: index,
            }));
  const policy = validatePortalPublication(document, input.plan);
  return {
    proposedDocument: document,
    includedAssets,
    quarantinedAssets,
    detectedColors: colorsForDocument.map((color_code) => ({
      color_code,
      confidence: "high" as const,
    })),
    detectedFonts,
    warnings: [
      ...(quarantinedAssets.length
        ? [
            {
              code: "quarantine" as const,
              message:
                "Algunos archivos requieren revisión antes de aplicarse.",
            },
          ]
        : []),
      ...(policy.ok
        ? []
        : [
            {
              code: "plan_limit" as const,
              message: `La propuesta supera el límite ${policy.code}.`,
            },
          ]),
    ],
    creditCost: AI_OPERATION_COSTS[input.operation],
  };
}
