import { startAiPortalContent } from "@workflows/ai-portal-content";
import { NextResponse } from "next/server";
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
import {
  createAiWorkflowJob,
  markAiWorkflowJob,
} from "@/lib/portal/ai-workflow";
import {
  capitalizeFirstLetter,
  normalizeAssetDownloadName,
  sourceNameFromStoragePath,
} from "@/lib/portal/asset-names";
import { createAccessTokenClient, createClient } from "@/lib/supabase/server";

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

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const supabase = authorization?.startsWith("Bearer ")
    ? createAccessTokenClient(authorization.slice("Bearer ".length))
    : await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    currentDocument?: unknown;
    portalId?: string;
    requestId?: string;
    target?: unknown;
  } | null;
  if (
    !body?.portalId ||
    !body.requestId ||
    !isTarget(body.target) ||
    !body.currentDocument
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const workflowJobId = request.headers.get("x-ai-workflow-job-id");
  let creditReserved = false;
  if (!workflowJobId) {
    const target = body.target as AiContentTarget;
    const { data: activeJobs, error: activeJobsError } = await supabase
      .from("ai_workflow_jobs")
      .select("payload")
      .eq("portal_id", body.portalId)
      .in("status", ["queued", "processing"]);
    if (activeJobsError)
      return NextResponse.json({ error: "jobs_unavailable" }, { status: 503 });
    const duplicateTarget = (activeJobs ?? []).some((activeJob) => {
      const payload =
        activeJob.payload && typeof activeJob.payload === "object"
          ? (activeJob.payload as { target?: { id?: string; kind?: string } })
          : null;
      return (
        payload?.target?.id === target.id &&
        payload?.target?.kind === target.kind
      );
    });
    if (duplicateTarget)
      return NextResponse.json(
        { error: "ai_workflow_in_progress" },
        { status: 409 },
      );
    const { data: creditResult, error: creditError } = await supabase.rpc(
      "reserve_ai_credits",
      {
        target_operation: "refine-copy",
        target_request_id: body.requestId,
      },
    );
    if (creditError)
      return NextResponse.json(
        { error: "credits_unavailable" },
        { status: 503 },
      );
    if (!creditResult?.[0]?.ok)
      return NextResponse.json(
        { error: creditResult?.[0]?.reason ?? "insufficient_credits" },
        { status: 402 },
      );
    creditReserved = true;
  }
  const job = workflowJobId
    ? (
        await supabase
          .from("ai_workflow_jobs")
          .select(
            "id,portal_id,kind,status,request_id,payload,result,error_code,created_at,updated_at",
          )
          .eq("id", workflowJobId)
          .single()
      ).data
    : await createAiWorkflowJob(supabase, {
        owner_id: user.user.id,
        portal_id: body.portalId,
        kind: "portal-content",
        request_id: body.requestId,
        payload: {
          currentDocument: body.currentDocument,
          portalId: body.portalId,
          requestId: body.requestId,
          target: body.target,
        } as never,
      });
  if (!job) {
    if (creditReserved)
      await supabase.rpc("complete_ai_credits", {
        target_request_id: body.requestId,
        target_status: "refunded",
      });
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }
  if (!workflowJobId) {
    const accessToken = (await supabase.auth.getSession()).data.session
      ?.access_token;
    if (!accessToken) {
      if (creditReserved)
        await supabase.rpc("complete_ai_credits", {
          target_request_id: body.requestId,
          target_status: "refunded",
        });
      return NextResponse.json(
        { error: "authentication_required" },
        { status: 401 },
      );
    }
    let run: Awaited<ReturnType<typeof startAiPortalContent>>;
    try {
      run = await startAiPortalContent({
        accessToken,
        jobId: job.id,
      });
    } catch (error) {
      if (creditReserved)
        await supabase.rpc("complete_ai_credits", {
          target_request_id: body.requestId,
          target_status: "refunded",
        });
      throw error;
    }
    await supabase
      .from("ai_workflow_jobs")
      .update({ workflow_run_id: run.runId })
      .eq("id", job.id);
    return NextResponse.json(
      { jobId: job.id, ok: true, queued: true },
      { status: 202 },
    );
  }
  await markAiWorkflowJob(supabase, job.id, {
    status: "processing",
    started_at: new Date().toISOString(),
  });

  const { data: portal } = await supabase
    .from("portals")
    .select("name,short_description,cover_url,icon_url,theme,content_language")
    .eq("id", body.portalId)
    .single();
  if (!portal)
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });

  const current = normalizePortalDocument(body.currentDocument, portal);
  const target = body.target;
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
  if (!exists)
    return NextResponse.json({ error: "target_not_found" }, { status: 404 });

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
      return NextResponse.json(
        { error: "ai_provider_failed" },
        { status: 503 },
      );
    }
    throw error;
  }
  if (!improvement)
    return NextResponse.json(
      { error: "ai_content_unavailable" },
      { status: 503 },
    );

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
    target_portal_id: body.portalId,
    target_request_id: body.requestId,
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
    return NextResponse.json({ error: reason }, { status: 422 });
  }
  await markAiWorkflowJob(supabase, job.id, {
    status: "completed",
    result: { document: data?.[0]?.document ?? proposed } as never,
    completed_at: new Date().toISOString(),
  });
  return NextResponse.json({
    document: data?.[0]?.document ?? proposed,
    ok: true,
    jobId: job.id,
  });
}
