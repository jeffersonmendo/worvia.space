import { startAiPortalProposal } from "@workflows/ai-portal-proposal";
import { NextResponse } from "next/server";
import { normalizePortalDocument } from "@/domain/portal/document";
import type { AiPortalOperation } from "@/lib/portal/ai";
import type { AiAssetInput } from "@/lib/portal/ai-proposal";
import { createAiWorkflowJob } from "@/lib/portal/ai-workflow";
import { createClient } from "@/lib/supabase/server";

const operations = new Set<AiPortalOperation>([
  "generate",
  "improve-project",
  "refine-copy",
]);

function isAsset(value: unknown): value is AiAssetInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.id === "string" &&
    typeof asset.name === "string" &&
    typeof asset.mimeType === "string" &&
    (asset.isPrimary === undefined || typeof asset.isPrimary === "boolean") &&
    (asset.fileUrl === undefined || typeof asset.fileUrl === "string")
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    assets?: unknown;
    excludedAssetIds?: unknown;
    existingDocument?: unknown;
    forceIncludeAssetIds?: unknown;
    operation?: AiPortalOperation;
    portalId?: string;
    projectDescription?: string;
    aiContext?: string;
    generateColors?: boolean;
    requestId?: string;
    autoApply?: boolean;
  } | null;
  if (
    !body?.portalId ||
    !body.projectDescription?.trim() ||
    !body.operation ||
    !operations.has(body.operation) ||
    !Array.isArray(body.assets) ||
    body.assets.length > 100 ||
    !body.assets.every(isAsset)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: activeJobs, error: activeJobsError } = await supabase
    .from("ai_workflow_jobs")
    .select("id")
    .eq("portal_id", body.portalId)
    .in("status", ["queued", "processing"])
    .limit(1);
  if (activeJobsError)
    return NextResponse.json({ error: "jobs_unavailable" }, { status: 503 });
  if (activeJobs?.length) {
    return NextResponse.json(
      { error: "ai_workflow_in_progress" },
      { status: 409 },
    );
  }

  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("name,short_description,cover_url,icon_url,theme,content_language")
    .eq("id", body.portalId)
    .single();
  if (portalError || !portal) {
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  }
  const { data: plan, error: planError } = await supabase.rpc("portal_plan", {
    target_portal_id: body.portalId,
  });
  if (
    planError ||
    !["free", "starter", "pro", "premium"].includes(plan ?? "")
  ) {
    return NextResponse.json({ error: "plan_unavailable" }, { status: 503 });
  }
  const projectDescription = body.projectDescription.trim().slice(0, 2000);
  const aiContext =
    typeof body.aiContext === "string"
      ? body.aiContext.trim().slice(0, 2000)
      : "";
  const existingDocument = body.existingDocument
    ? normalizePortalDocument(body.existingDocument, portal)
    : undefined;
  const requestId = body.requestId?.trim() || crypto.randomUUID();
  const creditRequestId =
    body.autoApply === true ? `${requestId}:apply` : requestId;
  const { data: creditResult, error: creditError } = await supabase.rpc(
    "reserve_ai_credits",
    {
      target_operation: body.operation,
      target_request_id: creditRequestId,
    },
  );
  if (creditError) {
    return NextResponse.json({ error: "credits_unavailable" }, { status: 503 });
  }
  if (!creditResult?.[0]?.ok) {
    return NextResponse.json(
      { error: creditResult?.[0]?.reason ?? "insufficient_credits" },
      { status: 402 },
    );
  }
  let workflowStarted = false;
  try {
    const job = await createAiWorkflowJob(supabase, {
      owner_id: userData.user.id,
      portal_id: body.portalId,
      kind: "portal-proposal",
      request_id: requestId,
      payload: {
        assets: body.assets,
        autoApply: body.autoApply === true,
        excludedAssetIds: Array.isArray(body.excludedAssetIds)
          ? body.excludedAssetIds.filter(
              (id): id is string => typeof id === "string",
            )
          : [],
        existingDocument,
        forceIncludeAssetIds: Array.isArray(body.forceIncludeAssetIds)
          ? body.forceIncludeAssetIds.filter(
              (id): id is string => typeof id === "string",
            )
          : [],
        operation: body.operation,
        plan,
        projectDescription,
        aiContext,
        generateColors: body.generateColors !== false,
      } as never,
    });
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      await supabase.rpc("complete_ai_credits", {
        target_request_id: creditRequestId,
        target_status: "refunded",
      });
      return NextResponse.json(
        { error: "authentication_required" },
        { status: 401 },
      );
    }
    if (job.status === "queued") {
      const run = await startAiPortalProposal({ accessToken, jobId: job.id });
      workflowStarted = true;
      await supabase
        .from("ai_workflow_jobs")
        .update({ workflow_run_id: run.runId })
        .eq("id", job.id);
    }
    return NextResponse.json(
      { jobId: job.id, ok: true, queued: true },
      { status: 202 },
    );
  } catch (error) {
    if (!workflowStarted) {
      await supabase.rpc("complete_ai_credits", {
        target_request_id: creditRequestId,
        target_status: "refunded",
      });
    }
    console.error("Failed to queue AI portal proposal", error);
    return NextResponse.json({ error: "ai_proposal_failed" }, { status: 503 });
  }
}
