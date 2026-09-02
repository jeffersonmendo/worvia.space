import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePortalDocument,
  type PortalDocument,
} from "@/domain/portal/document";
import {
  constrainImageAspectRatio,
  unifyImagePresentation,
} from "@/lib/portal/ai";
import {
  type AiContentImprovement,
  type AiContentTarget,
  type AiSectionImprovement,
  generateAiContentImprovement,
  generateAiSectionImprovement,
} from "@/lib/portal/ai-sdk";
import { markAiWorkflowJob } from "@/lib/portal/ai-workflow";
import {
  capitalizeFirstLetter,
  normalizeAssetDownloadName,
  sourceNameFromStoragePath,
} from "@/lib/portal/asset-names";
import type { Database } from "@/lib/supabase/database.types";

function isTarget(value: unknown): value is AiContentTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const target = value as Record<string, unknown>;
  return (
    (target.kind === "section" &&
      typeof target.id === "string" &&
      typeof target.title === "string" &&
      typeof target.description === "string") ||
    (target.kind === "image" &&
      typeof target.id === "string" &&
      typeof target.name === "string" &&
      typeof target.altText === "string") ||
    (target.kind === "file" &&
      typeof target.id === "string" &&
      typeof target.name === "string" &&
      typeof target.description === "string")
  );
}

function applyImprovement(
  document: PortalDocument,
  target: AiContentTarget,
  improvement: { altText: string; description: string; title: string },
) {
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (target.kind === "section" && section.id === target.id) {
        return {
          ...section,
          description: improvement.description,
          title: improvement.title,
          field_origins: {
            ...section.field_origins,
            description: "ai" as const,
            title: "ai" as const,
          },
        };
      }
      if (target.kind === "image") {
        const updateImage = (
          image: NonNullable<typeof section.content.image>,
        ) =>
          image.id === target.id
            ? {
                ...image,
                alt_text: improvement.altText,
                field_origins: {
                  ...image.field_origins,
                  alt_text: "ai" as const,
                },
              }
            : image;
        return {
          ...section,
          content: {
            ...section.content,
            image: section.content.image
              ? updateImage(section.content.image)
              : section.content.image,
            images: section.content.images?.map((image) => updateImage(image)),
          },
        };
      }
      if (target.kind === "file") {
        return {
          ...section,
          content: {
            ...section.content,
            files: section.content.files?.map((file) =>
              file.id === target.id
                ? { ...file, description: improvement.description }
                : file,
            ),
          },
        };
      }
      return section;
    }),
  };
}

function applySectionImprovement(
  document: PortalDocument,
  sectionId: string,
  improvement: AiSectionImprovement,
) {
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const images = new Map(improvement.images.map((item) => [item.id, item]));
      const files = new Map(improvement.files.map((item) => [item.id, item]));
      const fonts = new Map(improvement.fonts.map((item) => [item.id, item]));
      const colors = new Map(improvement.colors.map((item) => [item.id, item]));
      const improveImage = (
        image: NonNullable<typeof section.content.image>,
      ) => {
        const next = images.get(image.id);
        if (!next) return image;
        return {
          ...image,
          alt_text: next.altText,
          background_color:
            image.field_origins?.background_color === "manual"
              ? image.background_color
              : next.backgroundColor,
          aspect_ratio: constrainImageAspectRatio(
            image.width,
            image.height,
            next.aspectRatio,
          ),
          display_name: next.displayName,
          container_padding:
            image.field_origins?.container_padding === "manual"
              ? image.container_padding
              : next.containerPadding,
          download_name: normalizeAssetDownloadName(
            next.downloadName,
            sourceNameFromStoragePath(image.storage_path),
          ),
          field_origins: {
            ...image.field_origins,
            alt_text: "ai" as const,
            background_color:
              image.field_origins?.background_color === "manual"
                ? ("manual" as const)
                : ("ai" as const),
            container_padding:
              image.field_origins?.container_padding === "manual"
                ? ("manual" as const)
                : ("ai" as const),
            aspect_ratio: "ai" as const,
            display_name: "ai" as const,
            download_name: "ai" as const,
            fit: "ai" as const,
          },
          fit: next.fit,
        };
      };
      const nextSection = {
        ...section,
        description: improvement.description,
        title: improvement.title,
        field_origins: {
          ...section.field_origins,
          description: "ai" as const,
          title: "ai" as const,
        },
        content: {
          ...section.content,
          colors: section.content.colors?.map((color) => ({
            ...color,
            color_name: capitalizeFirstLetter(
              colors.get(color.id)?.name ?? color.color_name,
            ),
          })),
          files: section.content.files?.map((file) => {
            const next = files.get(file.id);
            return next
              ? {
                  ...file,
                  description: next.description,
                  display_name: next.displayName,
                  download_name: normalizeAssetDownloadName(
                    next.downloadName,
                    file.file_name,
                  ),
                  field_origins: {
                    ...file.field_origins,
                    display_name: "ai" as const,
                    download_name: "ai" as const,
                  },
                }
              : file;
          }),
          fonts: section.content.fonts?.map((font) => {
            const next = fonts.get(font.id);
            return next
              ? {
                  ...font,
                  display_name: next.displayName,
                  download_name: normalizeAssetDownloadName(
                    next.downloadName,
                    font.file_name ?? font.font_name,
                  ),
                  sample_description: next.sampleDescription,
                  usage: next.usage,
                  field_origins: {
                    ...font.field_origins,
                    display_name: "ai" as const,
                    download_name: "ai" as const,
                  },
                }
              : font;
          }),
          image: section.content.image
            ? improveImage(section.content.image)
            : section.content.image,
          images: section.content.images?.map(improveImage),
        },
      };
      return {
        ...nextSection,
        content: {
          ...nextSection.content,
          images: nextSection.content.images
            ? unifyImagePresentation(nextSection.content.images)
            : nextSection.content.images,
        },
      };
    }),
  };
}

export async function processAiContentJob(
  supabase: SupabaseClient<Database>,
  job: {
    id: string;
    portal_id: string;
    request_id: string;
    payload: Database["public"]["Tables"]["ai_workflow_jobs"]["Row"]["payload"];
  },
) {
  const payload = job.payload as Record<string, unknown>;
  const currentDocument = payload.currentDocument;
  const target = payload.target;
  if (!currentDocument || !isTarget(target))
    throw new Error("invalid_job_payload");
  await markAiWorkflowJob(supabase, job.id, {
    status: "processing",
    started_at: new Date().toISOString(),
  });

  const { data: portal } = await supabase
    .from("portals")
    .select("name,short_description,cover_url,icon_url,theme,content_language")
    .eq("id", job.portal_id)
    .single();
  if (!portal) throw new Error("portal_not_found");

  const current = normalizePortalDocument(currentDocument, portal);
  const exists =
    target.kind === "section"
      ? current.sections.some((section) => section.id === target.id)
      : target.kind === "image"
        ? current.sections.some(
            (section) =>
              section.content.image?.id === target.id ||
              section.content.images?.some((image) => image.id === target.id),
          )
        : current.sections.some((section) =>
            section.content.files?.some((file) => file.id === target.id),
          );
  if (!exists) throw new Error("target_not_found");

  let improvement: AiContentImprovement | AiSectionImprovement | null;
  try {
    improvement =
      target.kind === "section"
        ? await generateAiSectionImprovement(
            current.sections.find(
              (section) => section.id === target.id,
            ) as NonNullable<PortalDocument["sections"][number]>,
            portal.content_language === "es" ? "es" : "en",
          )
        : await generateAiContentImprovement(
            target,
            portal.content_language === "es" ? "es" : "en",
          );
  } catch (error) {
    if (error instanceof Error && error.message === "ai_provider_failed") {
      throw new Error("ai_provider_failed");
    }
    throw error;
  }
  if (!improvement) throw new Error("ai_content_unavailable");

  const proposed =
    target.kind === "section"
      ? applySectionImprovement(
          current,
          target.id,
          improvement as AiSectionImprovement,
        )
      : applyImprovement(current, target, improvement as AiContentImprovement);
  const { data, error } = await supabase.rpc("apply_ai_portal_document", {
    proposed_document: proposed,
    target_operation: "refine-copy",
    target_portal_id: job.portal_id,
    target_request_id: job.request_id,
  });
  if (error) {
    const reason = error.message.toLowerCase().includes("insufficient_credits")
      ? "insufficient_credits"
      : "ai_operation_failed";
    await markAiWorkflowJob(supabase, job.id, {
      status: "error",
      error_code: reason,
      completed_at: new Date().toISOString(),
    });
    throw new Error(reason);
  }
  await markAiWorkflowJob(supabase, job.id, {
    status: "completed",
    result: { document: data?.[0]?.document ?? proposed } as never,
    completed_at: new Date().toISOString(),
  });
  return data?.[0]?.document ?? proposed;
}
