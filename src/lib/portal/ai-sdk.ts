import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import sharp from "sharp";
import { z } from "zod";
import type { PortalDocument, PortalSection } from "@/domain/portal/document";
import {
  type PortalPlan,
  portalGalleryItemLimit,
  portalGallerySectionLimit,
} from "@/lib/billing/portal-policy";
import type { AiAssetInput } from "@/lib/portal/ai-proposal";
import { isRenderableImageMimeType } from "@/lib/portal/asset-validation";

const enhancementSchema = z.object({
  assetInsights: z.array(
    z.object({
      assetId: z.string(),
      altText: z.string().max(380),
      contentType: z.enum([
        "logo",
        "mockup",
        "photograph",
        "illustration",
        "image",
      ]),
      description: z.string().max(500),
      displayName: z.string().max(160),
      downloadName: z.string().max(120),
      usage: z.string().max(300),
    }),
  ),
  copyPlan: z.array(
    z.object({
      description: z.string().max(500),
      sectionId: z.string(),
      title: z.string().max(120),
    }),
  ),
  colorInsights: z
    .array(
      z.object({
        colorCode: z.string(),
        name: z.string().max(80),
      }),
    )
    .max(5),
  sectionPlan: z.array(
    z.object({
      assetIds: z.array(z.string()),
      description: z.string().max(500),
      kind: z.enum(["image", "gallery", "fonts", "colors", "files"]),
      sectionId: z.string(),
      title: z.string().max(120),
    }),
  ),
  imageRecommendations: z.array(
    z.object({
      aspectRatio: z.enum(["auto", "1/1", "4/3", "16/9", "21/9"]),
      assetId: z.string(),
      backgroundColor: z.union([
        z.literal("secondary"),
        z.literal("transparent"),
        z.string().regex(/^#[0-9a-f]{6}$/i),
      ]),
      containerPadding: z.number().int().min(0).max(25),
      fit: z.enum(["cover", "contain", "fill", "auto"]),
    }),
  ),
  projectCopy: z.object({
    description: z.string().max(500),
    name: z.string().max(120),
  }),
  quarantinedAssetIds: z.array(z.string()),
});

const contentAnalysisSchema = z.object({
  assetInsights: enhancementSchema.shape.assetInsights,
  colorInsights: enhancementSchema.shape.colorInsights,
  imageRecommendations: enhancementSchema.shape.imageRecommendations,
  quarantinedAssetIds: z.array(z.string()),
});

const structurePlanSchema = z.object({
  colorInsights: enhancementSchema.shape.colorInsights,
  imageRecommendations: enhancementSchema.shape.imageRecommendations,
  quarantinedAssetIds: enhancementSchema.shape.quarantinedAssetIds,
  sectionPlan: z.array(
    z.object({
      assetIds: z.array(z.string()),
      kind: z.enum(["image", "gallery", "fonts", "colors", "files"]),
      sectionId: z.string(),
    }),
  ),
});

const copyPlanSchema = z.object({
  assetInsights: enhancementSchema.shape.assetInsights,
  copyPlan: enhancementSchema.shape.copyPlan,
  projectCopy: enhancementSchema.shape.projectCopy,
});

const contentImprovementSchema = z.object({
  description: z.string().max(500),
  title: z.string().max(120),
  altText: z.string().max(380),
});

const sectionImprovementSchema = z.object({
  colors: z.array(z.object({ id: z.string(), name: z.string().max(80) })),
  description: z.string().max(280),
  files: z.array(
    z.object({
      description: z.string().max(500),
      displayName: z.string().max(160),
      downloadName: z.string().max(120),
      id: z.string(),
    }),
  ),
  fonts: z.array(
    z.object({
      displayName: z.string().max(160),
      downloadName: z.string().max(120),
      id: z.string(),
      sampleDescription: z.string().max(300),
      usage: z.string().max(300),
    }),
  ),
  images: z.array(
    z.object({
      altText: z.string().max(380),
      aspectRatio: z.enum(["auto", "1/1", "4/3", "16/9", "21/9"]),
      backgroundColor: z.union([
        z.literal("secondary"),
        z.literal("transparent"),
        z.string().regex(/^#[0-9a-f]{6}$/i),
      ]),
      containerPadding: z.number().int().min(0).max(25),
      displayName: z.string().max(160),
      downloadName: z.string().max(120),
      fit: z.enum(["cover", "contain", "fill", "auto"]),
      id: z.string(),
    }),
  ),
  title: z.string().max(120),
});
const sectionCopySchema = z.object({
  description: z.string().max(280),
  title: z.string().max(120),
});

export type AiStructuredEnhancement = z.infer<typeof enhancementSchema>;

const sectionKinds = ["image", "gallery", "fonts", "colors", "files"] as const;
type AiSectionKind = (typeof sectionKinds)[number];

function fallbackCopy(kind: AiSectionKind, projectDescription: string) {
  const spanish = /[áéíóúñ¿¡]|\b(el|la|los|las|para|con|del|una|un|de)\b/i.test(
    projectDescription,
  );
  const copy = {
    colors: spanish
      ? ["Colores", "Paleta cromática del proyecto."]
      : ["Colors", "The project's color palette."],
    files: spanish
      ? ["Archivos", "Documentos y archivos de referencia del proyecto."]
      : ["Files", "Project documents and reference files."],
    fonts: spanish
      ? ["Tipografías", "Fuentes tipográficas utilizadas en el proyecto."]
      : ["Fonts", "Typography files used in the project."],
    gallery: spanish
      ? ["Galería", "Imágenes seleccionadas para presentar el proyecto."]
      : ["Gallery", "Selected images presenting the project."],
    image: spanish
      ? ["Imagen principal", "Imagen principal del proyecto."]
      : ["Main image", "The project's main image."],
  } satisfies Record<AiSectionKind, [string, string]>;
  return copy[kind];
}

function contextualFallbackCopy(
  kind: AiSectionKind,
  projectDescription: string,
  enhancement: AiStructuredEnhancement,
  assetIds: string[],
) {
  const insight = enhancement.assetInsights.find((item) =>
    assetIds.includes(item.assetId),
  );
  const languageSource = [
    projectDescription,
    enhancement.projectCopy.name,
    enhancement.projectCopy.description,
    insight?.description,
  ].join(" ");
  if (
    kind === "image" &&
    insight?.displayName.trim() &&
    insight.description.trim()
  )
    return [
      insight.displayName.trim().slice(0, 120),
      insight.description.trim().slice(0, 500),
    ];
  return fallbackCopy(kind, languageSource);
}

function isGenericImageCopy(title: string, description: string) {
  return (
    /^(main image|imagen principal)$/i.test(title.trim()) ||
    /^(the project's main image\.|imagen principal del proyecto\.)$/i.test(
      description.trim(),
    )
  );
}

function requiredSectionAssets(
  assets: AiAssetInput[],
  quarantinedAssetIds: string[] = [],
) {
  const activeAssets = assets.filter(
    (asset) => !quarantinedAssetIds.includes(asset.id),
  );
  const images = activeAssets.filter((asset) =>
    isRenderableImageMimeType(asset.mimeType),
  );
  const fonts = activeAssets.filter(
    (asset) =>
      /^font\//i.test(asset.mimeType) ||
      /\.(ttf|otf|woff2?)$/i.test(asset.name),
  );
  const files = activeAssets.filter(
    (asset) => !images.includes(asset) && !fonts.includes(asset),
  );
  const required: Partial<Record<AiSectionKind, string[]>> = {};
  const primaryImage = images.find((asset) => asset.isPrimary);
  const galleryImages = primaryImage
    ? images.filter((asset) => asset.id !== primaryImage.id)
    : images;
  if (primaryImage) required.image = [primaryImage.id];
  else if (images.length === 1) required.image = [images[0].id];
  if (galleryImages.length && !(galleryImages.length === 1 && !primaryImage))
    required.gallery = galleryImages.map((asset) => asset.id);
  if (fonts.length) required.fonts = fonts.map((asset) => asset.id);
  if (files.length) required.files = files.map((asset) => asset.id);
  const colorAssets = activeAssets.filter(
    (asset) => (asset.detectedColors?.length ?? 0) > 0,
  );
  if (colorAssets.length)
    required.colors = colorAssets.map((asset) => asset.id);
  return required;
}

/**
 * Repairs semantic omissions from structured model output before proposal
 * creation. Zod validates the shape, but it cannot require a section based on
 * the dynamic asset list.
 */
export function ensureAiStructuredEnhancementCompleteness(
  enhancement: AiStructuredEnhancement,
  assets: AiAssetInput[],
  projectDescription: string,
  generateColors = true,
): AiStructuredEnhancement {
  const required = requiredSectionAssets(
    assets,
    enhancement.quarantinedAssetIds,
  );
  if (!generateColors) delete required.colors;
  const projectFallback =
    projectDescription.trim().slice(0, 500) || "Portal project";
  const projectCopy = {
    description: enhancement.projectCopy.description.trim() || projectFallback,
    name: enhancement.projectCopy.name.trim() || projectFallback.slice(0, 120),
  };
  const sectionPlan = [...enhancement.sectionPlan];
  for (const kind of sectionKinds) {
    const assetIds = required[kind];
    if (!assetIds?.length) continue;
    const existing = sectionPlan.find((section) => section.kind === kind);
    const [title, description] = contextualFallbackCopy(
      kind,
      projectDescription,
      enhancement,
      existing?.assetIds ?? assetIds,
    );
    if (existing) {
      existing.assetIds = existing.assetIds.length
        ? existing.assetIds
        : assetIds;
      const replaceGenericCopy =
        kind === "image" &&
        isGenericImageCopy(existing.title, existing.description);
      existing.title =
        !existing.title.trim() || replaceGenericCopy ? title : existing.title;
      existing.description =
        !existing.description.trim() || replaceGenericCopy
          ? description
          : existing.description;
      continue;
    }
    sectionPlan.push({
      assetIds,
      description,
      kind,
      sectionId: `ai-${kind}`,
      title,
    });
  }
  return { ...enhancement, projectCopy, sectionPlan };
}

export type AiContentTarget =
  | { kind: "section"; id: string; title: string; description: string }
  | { kind: "image"; id: string; name: string; altText: string }
  | { kind: "file"; id: string; name: string; description: string };
export type AiContentImprovement = z.infer<typeof contentImprovementSchema>;
export type AiSectionImprovement = z.infer<typeof sectionImprovementSchema>;

/**
 * Keeps each visual analysis request bounded without dropping assets from the
 * portal. Small projects stay in one request; larger projects are split by
 * asset count and estimated byte size.
 */
export function chunkVisualAssets(
  assets: AiAssetInput[],
  batchSize = 6,
  maxBatchBytes = 12 * 1024 * 1024,
) {
  const candidates = assets.filter((asset) =>
    isRenderableImageMimeType(asset.mimeType),
  );
  const size = Math.max(1, batchSize);
  const batches: AiAssetInput[][] = [];
  let current: AiAssetInput[] = [];
  let currentBytes = 0;
  for (const asset of candidates) {
    const assetBytes = asset.sizeBytes ?? 0;
    const exceedsCount = current.length >= size;
    const exceedsBytes =
      current.length > 0 && currentBytes + assetBytes > maxBatchBytes;
    if (exceedsCount || exceedsBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(asset);
    currentBytes += assetBytes;
  }
  if (current.length) batches.push(current);
  return batches;
}

// Keep the original asset in Storage, but never send a 100+ MiB upload to the
// model provider. The provider only needs a bounded visual proxy for analysis.
export const AI_VISUAL_MAX_BYTES = 8 * 1024 * 1024;
const AI_VISUAL_MAX_DIMENSION = 2048;
export const AI_ANALYSIS_TIMEOUT_MS = 300_000;
export const AI_STRUCTURE_TIMEOUT_MS = 300_000;
export const AI_COPY_TIMEOUT_MS = 300_000;
export const AI_ANALYSIS_MAX_CONCURRENCY = 4;

export function classifyAiProviderError(error: unknown): string {
  const candidate = error as {
    message?: unknown;
    name?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  const message =
    typeof candidate?.message === "string" ? candidate.message : "";
  const status =
    typeof candidate?.status === "number"
      ? candidate.status
      : typeof candidate?.statusCode === "number"
        ? candidate.statusCode
        : null;

  if (
    message.startsWith("ai_visual_asset_fetch_failed:") ||
    message.startsWith("ai_visual_asset_prepare_failed:") ||
    message === "ai_analysis_timeout" ||
    message === "ai_structure_timeout" ||
    message === "ai_copy_timeout"
  )
    return message;
  if (candidate?.name === "AbortError" || /timed out|timeout/i.test(message))
    return "ai_provider_timeout";
  if (status === 429 || /\b429\b|rate limit|too many requests/i.test(message))
    return "ai_provider_rate_limited";
  if (status !== null && status >= 500) return "ai_provider_unavailable";

  const diagnostic = message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[secret]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return diagnostic ? `ai_provider_failed:${diagnostic}` : "ai_provider_failed";
}

async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutCode: string,
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await task(controller.signal);
  } catch (error) {
    if (
      timedOut ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw new Error(timeoutCode);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function prepareAiVisualAsset(
  bytes: Uint8Array,
  mediaType: string,
): Promise<{ data: Uint8Array; mediaType: string }> {
  // A file can be valid for the plan while still being too large to send
  // directly to the model. Inspect dimensions as well as bytes so a highly
  // compressed poster is bounded before it reaches the provider.
  const image = sharp(bytes, {
    failOn: "none",
    limitInputPixels: false,
  });
  const metadata = await image.metadata();
  const withinVisualBounds =
    bytes.byteLength <= AI_VISUAL_MAX_BYTES &&
    (metadata.width ?? 0) <= AI_VISUAL_MAX_DIMENSION &&
    (metadata.height ?? 0) <= AI_VISUAL_MAX_DIMENSION;
  if (withinVisualBounds) {
    return { data: bytes, mediaType };
  }

  const preview = await image
    .rotate()
    .resize({
      fit: "inside",
      height: AI_VISUAL_MAX_DIMENSION,
      withoutEnlargement: true,
      width: AI_VISUAL_MAX_DIMENSION,
    })
    .webp({ quality: 82 })
    .toBuffer();

  return { data: new Uint8Array(preview), mediaType: "image/webp" };
}

export async function generateAiSectionImprovement(
  section: PortalSection,
  contentLanguage: "en" | "es" = "en",
): Promise<AiSectionImprovement | null> {
  if (!process.env.AI_GATEWAY_API_KEY) return null;

  try {
    const configuredModel = process.env.AI_MODEL ?? "openai/gpt-5-mini";
    const isOpenAiApiKey = process.env.AI_GATEWAY_API_KEY.startsWith("sk-");
    const model = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          configuredModel.replace(/^openai\//, ""),
        )
      : configuredModel;
    const { output } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Improve the complete requested portal section, not just its heading.",
                "Return every existing item using its exact id. Never remove items, change URLs, or invent assets.",
                `Write every generated field in ${contentLanguage === "es" ? "Spanish" : "English"}, regardless of the source section language.`,
                "Keep the section title to no more than three words and do not use colons.",
                "The section description is visitor-facing: write one or two concise sentences explaining what the section contains.",
                "Do not write a design brief, instructions, production requirements, export dimensions, layout directions, or imperatives.",
                "Do not repeat source-file instructions as the section description.",
                "Use each image's width and height in pixels, aspect ratio, transparency, and current context to choose fit and aspect ratio; do not invent dimensions.",
                "Choose a contrasting background for transparent or light artwork, and choose padding from 0 to 25 pixels so logos and contained artwork have deliberate breathing room.",
                "For every image, improve alt text, visible name, lowercase hyphenated download name with the original extension, fit, and aspect ratio.",
                "When a section contains multiple images, choose the aspect ratio that appears most often from their dimensions and return that same ratio for every image; use fit per image to avoid harmful cropping.",
                "For every file and font, improve its description or usage and both visible and download names while preserving the original extension.",
                "For every color, generate a short human color name based on its color code, with the first letter uppercase.",
                "Use all supplied section, image, file, font, and color metadata before making decisions.",
                `Section to improve: ${JSON.stringify(section)}`,
              ].join("\n"),
            },
          ],
        },
      ],
      output: Output.object({
        description:
          "Complete improved copy and asset settings for one portal section.",
        name: "PortalSectionImprovement",
        schema: sectionImprovementSchema,
      }),
    });
    if (!output) return null;
    const descriptionLooksLikeBrief =
      /\b(create|build|keep|set|output|export|maintain|use|crea|mantén|configura|exporta)\b/i.test(
        output.description,
      ) || /\b\d+\s*[x×]\s*\d+|\b1\s*:\s*1\b/i.test(output.description);
    if (!descriptionLooksLikeBrief) return output;
    const rewritten = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Rewrite this portal section copy for visitors.",
                "Return only a short title of no more than three words and one or two concise sentences describing what the section contains.",
                "Do not give instructions, design directions, export specifications, dimensions, or production requirements.",
                `Current title: ${output.title}`,
                `Current description: ${output.description}`,
              ].join("\n"),
            },
          ],
        },
      ],
      output: Output.object({
        description: "Visitor-facing section copy.",
        name: "PortalSectionCopy",
        schema: sectionCopySchema,
      }),
    });
    return rewritten.output ? { ...output, ...rewritten.output } : output;
  } catch (error) {
    console.error("AI section improvement failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw new Error("ai_provider_failed");
  }
}

export async function generateAiContentImprovement(
  target: AiContentTarget,
  contentLanguage: "en" | "es" = "en",
): Promise<z.infer<typeof contentImprovementSchema> | null> {
  if (!process.env.AI_GATEWAY_API_KEY) return null;

  try {
    const configuredModel = process.env.AI_MODEL ?? "openai/gpt-5-mini";
    const isOpenAiApiKey = process.env.AI_GATEWAY_API_KEY.startsWith("sk-");
    const model = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          configuredModel.replace(/^openai\//, ""),
        )
      : configuredModel;
    const { output } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Improve only the requested portal content.",
                `Return specific, natural copy in ${contentLanguage === "es" ? "Spanish" : "English"}.`,
                "Do not invent facts. Do not use placeholders or a colon.",
                "Keep section titles short, with no more than three words.",
                `Target: ${JSON.stringify(target)}`,
              ].join("\n"),
            },
          ],
        },
      ],
      output: Output.object({
        description: "Improved copy for one portal target.",
        name: "PortalContentImprovement",
        schema: contentImprovementSchema,
      }),
    });
    return output ?? null;
  } catch (error) {
    console.error("AI content improvement failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw new Error("ai_provider_failed");
  }
}

export async function generateAiStructuredEnhancement({
  assets,
  existingDocument,
  onProgress,
  operation = "generate",
  projectDescription,
  aiContext = "",
  generateColors = true,
  contentLanguage = "en",
  plan,
}: {
  assets: AiAssetInput[];
  existingDocument?: PortalDocument;
  onProgress?: (
    stage: "analyzing-assets" | "generating-structure" | "generating-copy",
    detail?: { batch: number; total: number },
  ) => Promise<void>;
  operation?: "generate" | "improve-project" | "refine-copy";
  projectDescription: string;
  aiContext?: string;
  generateColors?: boolean;
  contentLanguage?: "en" | "es";
  plan?: PortalPlan;
}): Promise<AiStructuredEnhancement | null> {
  if (!process.env.AI_GATEWAY_API_KEY) return null;

  try {
    const isOpenAiApiKey = process.env.AI_GATEWAY_API_KEY.startsWith("sk-");
    const analysisConfiguredModel =
      process.env.AI_ANALYSIS_MODEL ?? "openai/gpt-5-mini";
    const analysisModel = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          analysisConfiguredModel.replace(/^openai\//, ""),
        )
      : analysisConfiguredModel;
    const structureConfiguredModel =
      process.env.AI_STRUCTURE_MODEL ??
      process.env.AI_COMPOSITION_MODEL ??
      "openai/gpt-5-mini";
    const structureModel = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          structureConfiguredModel.replace(/^openai\//, ""),
        )
      : structureConfiguredModel;
    const copyConfiguredModel =
      process.env.AI_COPY_MODEL ??
      process.env.AI_COMPOSITION_MODEL ??
      "openai/gpt-5-mini";
    const copyModel = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          copyConfiguredModel.replace(/^openai\//, ""),
        )
      : copyConfiguredModel;
    const contentAnalyses: z.infer<typeof contentAnalysisSchema>[] = [];
    const visualBatches = chunkVisualAssets(assets);
    const analysisBatches = visualBatches.length ? visualBatches : [assets];
    await onProgress?.("analyzing-assets", {
      batch: 0,
      total: analysisBatches.length,
    });
    const batchAnalyses: Array<z.infer<typeof contentAnalysisSchema> | null> =
      Array.from({ length: analysisBatches.length }, () => null);
    let completedBatches = 0;
    const analyzeBatch = async (batchIndex: number) => {
      const batch = analysisBatches[batchIndex];
      const analysis = await withTimeout(
        async (signal) => {
          const visualAssets = await Promise.all(
            batch
              .filter(
                (asset) =>
                  typeof asset.fileUrl === "string" &&
                  /^https?:\/\//.test(asset.fileUrl),
              )
              .map(async (asset) => {
                const response = await fetch(asset.fileUrl as string, {
                  signal,
                });
                if (!response.ok) {
                  throw new Error(
                    `ai_visual_asset_fetch_failed:${response.status}`,
                  );
                }
                let prepared: { data: Uint8Array; mediaType: string };
                try {
                  prepared = await prepareAiVisualAsset(
                    new Uint8Array(await response.arrayBuffer()),
                    asset.mimeType,
                  );
                } catch {
                  throw new Error(`ai_visual_asset_prepare_failed:${asset.id}`);
                }
                return { type: "file" as const, ...prepared };
              }),
          );
          const inventory = batchIndex === 0 ? assets : batch;
          const { output } = await generateText({
            abortSignal: signal,
            model: analysisModel,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: [
                      "Analyze the supplied asset inventory before any portal composition.",
                      "Return one assetInsight for every supplied asset id.",
                      "For visual assets, describe only what is visible.",
                      "Use transparent edges, light artwork, and dominant colors to recommend backgroundColor and containerPadding for every visual asset. Prefer secondary for transparent white artwork, transparent for edge-to-edge photography, or a contrasting #RRGGBB color when visual evidence supports it.",
                      "Treat .ai, .eps, .psd, and other Adobe source files as downloadable originals, not as visual assets. Do not inspect or invent their binary contents; use only filename, MIME type, size, and supplied metadata.",
                      "For other non-visual files, use only the filename, MIME type, size, and supplied metadata. Do not invent contents that are not available.",
                      "Return detected colors only when they are present in supplied metadata.",
                      `Asset inventory for this request: ${JSON.stringify(inventory)}`,
                    ].join("\n"),
                  },
                  ...visualAssets,
                ],
              },
            ],
            output: Output.object({
              description: "Content analysis for one asset batch.",
              name: "PortalAssetContentAnalysis",
              schema: contentAnalysisSchema,
            }),
          });
          return output;
        },
        AI_ANALYSIS_TIMEOUT_MS,
        "ai_analysis_timeout",
      );
      batchAnalyses[batchIndex] = analysis;
      completedBatches += 1;
      await onProgress?.("analyzing-assets", {
        batch: completedBatches,
        total: analysisBatches.length,
      });
    };
    let nextBatchIndex = 0;
    const worker = async () => {
      while (nextBatchIndex < analysisBatches.length) {
        const batchIndex = nextBatchIndex++;
        await analyzeBatch(batchIndex);
      }
    };
    await Promise.all(
      Array.from(
        {
          length: Math.min(AI_ANALYSIS_MAX_CONCURRENCY, analysisBatches.length),
        },
        worker,
      ),
    );
    contentAnalyses.push(
      ...batchAnalyses.filter(
        (analysis): analysis is z.infer<typeof contentAnalysisSchema> =>
          Boolean(analysis),
      ),
    );
    const analyzedAssetInsights = [
      ...new Map(
        contentAnalyses
          .flatMap((analysis) => analysis.assetInsights)
          .map((insight) => [insight.assetId, insight] as const),
      ).values(),
    ];

    await onProgress?.("generating-structure");
    const structurePrompt = [
      "Create only the portal structure plan from the completed asset analysis.",
      "Do not write visitor-facing copy, project names, or section descriptions in this step.",
      "Return only valid asset IDs and preserve the analyzed facts.",
      "Choose the required section kinds, asset membership, image order, aspect ratios, image backgrounds and padding, quarantine decisions, and color insights.",
      "If an asset is explicitly marked as primary, place it in its own image section. Put all remaining images in one or more gallery sections.",
      ...(plan
        ? [
            `Gallery rules for the ${plan} plan: each gallery can contain at most ${portalGalleryItemLimit(plan)} images and the portal can contain at most ${portalGallerySectionLimit(plan)} gallery sections. If there are more images, plan multiple balanced galleries.`,
          ]
        : []),
      generateColors
        ? "Generate at most 5 color insights, prioritizing the most important and representative colors from supplied metadata."
        : "Do not generate color insights.",
      `Project description: ${projectDescription}`,
      `Assets: ${JSON.stringify(assets)}`,
      `Completed asset analysis: ${JSON.stringify(contentAnalyses)}`,
    ].join("\n");
    const { output: structurePlan } = await withTimeout(
      (abortSignal) =>
        generateText({
          abortSignal,
          model: structureModel,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: structurePrompt }],
            },
          ],
          output: Output.object({
            description:
              "A safe portal structure plan without visitor-facing copy.",
            name: "PortalStructurePlan",
            schema: structurePlanSchema,
          }),
        }),
      AI_STRUCTURE_TIMEOUT_MS,
      "ai_structure_timeout",
    );
    if (!structurePlan) return null;

    await onProgress?.("generating-copy");
    const copyPrompt = [
      "Generate only the project and visitor-facing copy for the validated portal structure below.",
      "Do not change section kinds, asset IDs, image order, quarantine decisions, or color insights.",
      "Return concise, specific copy. Never use instructions, design directions, export specifications, or placeholders.",
      "Do not treat the project description as factual ground truth; it may be an incorrect user-entered label.",
      "Use the analyzed asset insights and visual evidence as the source of truth, and correct it when it conflicts with the analyzed visual evidence.",
      "Do not infer an unseen product or category from a user label; describe only what the analyzed evidence supports.",
      "The project name and description must identify the visible subject or organization, not an assumed product.",
      "Return a human-readable displayName and lowercase hyphenated downloadName for every asset while preserving extensions.",
      "Write every generated name, title, description, and label in the requested portal language.",
      "Section titles must be no more than three words. Do not use a colon and do not repeat descriptions.",
      operation === "refine-copy"
        ? `Rewrite every existing section and project copy while preserving exact sectionId values. Existing document: ${JSON.stringify(existingDocument)}.`
        : operation === "improve-project" && existingDocument
          ? `Improve the existing project copy without deleting existing content. Existing document: ${JSON.stringify(existingDocument)}.`
          : "Create useful, specific copy for the planned portal.",
      `Portal language: ${contentLanguage === "es" ? "Spanish" : "English"}`,
      `Project description: ${projectDescription}`,
      `Assets: ${JSON.stringify(assets)}`,
      `Analyzed asset insights: ${JSON.stringify(analyzedAssetInsights)}`,
      `Validated structure plan: ${JSON.stringify(structurePlan)}`,
      aiContext.trim()
        ? `Additional context from the user: ${aiContext.trim().slice(0, 2000)}`
        : "No additional user context was provided.",
    ].join("\n");
    const { output: copyPlan } = await withTimeout(
      (abortSignal) =>
        generateText({
          abortSignal,
          model: copyModel,
          messages: [
            { role: "user", content: [{ type: "text", text: copyPrompt }] },
          ],
          output: Output.object({
            description:
              "Visitor-facing portal copy based on a validated structure.",
            name: "PortalCopyPlan",
            schema: copyPlanSchema,
          }),
        }),
      AI_COPY_TIMEOUT_MS,
      "ai_copy_timeout",
    );
    if (!copyPlan) return null;

    const copyBySectionId = new Map(
      copyPlan.copyPlan.map((sectionCopy) => [
        sectionCopy.sectionId,
        sectionCopy,
      ]),
    );
    return ensureAiStructuredEnhancementCompleteness(
      {
        ...structurePlan,
        sectionPlan: structurePlan.sectionPlan.map((section) => ({
          ...section,
          ...(copyBySectionId.get(section.sectionId) ?? {
            description: "",
            title: "",
          }),
        })),
        ...copyPlan,
      },
      assets,
      projectDescription,
      generateColors,
    );
  } catch (error) {
    const errorCode = classifyAiProviderError(error);
    console.error("AI structured enhancement failed", {
      error: error instanceof Error ? error.message : "unknown_error",
      errorCode,
      operation,
    });
    throw new Error(errorCode);
  }
}
