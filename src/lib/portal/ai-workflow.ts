import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { normalizePortalDocument } from "@/domain/portal/document";
import type { PortalPlan } from "@/lib/billing/portal-policy";
import type { AiPortalOperation } from "@/lib/portal/ai";
import {
  type AiAssetInput,
  createAiPortalProposal,
  preserveManualPortalFields,
} from "@/lib/portal/ai-proposal";
import { generateAiStructuredEnhancement } from "@/lib/portal/ai-sdk";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type AiWorkflowKind =
  | "portal-operation"
  | "portal-content"
  | "portal-proposal";
export type AiWorkflowStatus =
  | "queued"
  | "processing"
  | "completed"
  | "error"
  | "cancelled";
export type AiWorkflowJob = {
  id: string;
  portal_id: string;
  kind: AiWorkflowKind;
  status: AiWorkflowStatus;
  request_id: string;
  result: Json | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

type JobInsert = {
  owner_id: string;
  portal_id: string;
  kind: AiWorkflowKind;
  request_id: string;
  payload: Json;
};

type WorkflowClient = SupabaseClient<Database>;

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const record = error as { code?: unknown; message?: unknown };
    if (typeof record.message === "string" && record.message)
      return record.message;
    if (typeof record.code === "string" && record.code) return record.code;
  }
  return fallback;
}

export function createWorkflowClient(accessToken: string): WorkflowClient {
  const { publishableKey, url } = getSupabaseEnv();
  return createSupabaseClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createAiWorkflowJob(
  supabase: WorkflowClient,
  input: JobInsert,
) {
  const { data, error } = await supabase
    .from("ai_workflow_jobs")
    .insert(input)
    .select(
      "id,portal_id,kind,status,request_id,result,error_code,created_at,updated_at",
    )
    .single();
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("ai_workflow_jobs")
      .select(
        "id,portal_id,kind,status,request_id,result,error_code,created_at,updated_at",
      )
      .eq("request_id", input.request_id)
      .single();
    if (existingError) throw existingError;
    return existing;
  }
  if (error) throw error;
  return data;
}

export async function markAiWorkflowJob(
  supabase: WorkflowClient,
  id: string,
  patch: {
    status: AiWorkflowStatus;
    result?: Json | null;
    error_code?: string | null;
    started_at?: string;
    completed_at?: string;
  },
) {
  const { error } = await supabase
    .from("ai_workflow_jobs")
    .update(patch)
    .eq("id", id)
    .neq("status", "cancelled");
  if (error) throw error;
}

type AiOperationJob = Pick<AiWorkflowJob, "id"> & {
  portal_id: string;
  request_id: string;
  payload: Json;
};

export async function claimAiOperationJob(
  supabase: WorkflowClient,
  id: string,
) {
  const { data, error } = await supabase
    .from("ai_workflow_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "queued")
    .select("id,portal_id,request_id,payload")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function completeAiWorkflowCredits(
  supabase: WorkflowClient,
  requestId: string,
  status: "committed" | "refunded",
) {
  const { error } = await supabase.rpc("complete_ai_credits", {
    target_request_id: requestId,
    target_status: status,
  });
  if (error) throw error;
}

export async function processAiOperationJob(
  supabase: WorkflowClient,
  job: Pick<AiWorkflowJob, "id">,
) {
  const claimedJob = await claimAiOperationJob(supabase, job.id);
  if (!claimedJob) return null;
  return processClaimedAiOperationJob(supabase, claimedJob);
}

export async function processClaimedAiOperationJob(
  supabase: WorkflowClient,
  job: AiOperationJob,
) {
  const payload = job.payload as Record<string, Json | undefined>;
  const operation = payload.operation as AiPortalOperation;
  const proposedDocument = payload.proposedDocument;
  if (!proposedDocument || !operation) throw new Error("invalid_job_payload");
  try {
    const { data: portal } = await supabase
      .from("portals")
      .select(
        "name,short_description,cover_url,icon_url,theme,content_language",
      )
      .eq("id", job.portal_id)
      .single();
    const { data: saved } = await supabase
      .from("portal_documents")
      .select("document")
      .eq("portal_id", job.portal_id)
      .maybeSingle();
    if (!portal) throw new Error("portal_not_found");
    const proposed = normalizePortalDocument(proposedDocument, portal);
    const current = saved?.document
      ? normalizePortalDocument(saved.document, portal)
      : proposed;
    const safeDocument = preserveManualPortalFields(current, proposed);
    const { data, error } = await supabase.rpc("apply_ai_portal_document", {
      proposed_document: safeDocument,
      target_operation: operation,
      target_portal_id: job.portal_id,
      target_request_id: job.request_id,
    });
    if (error) throw error;
    const result = data?.[0]?.document ?? proposedDocument;
    await markAiWorkflowJob(supabase, job.id, {
      status: "completed",
      result: { document: result } as Json,
      completed_at: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    const code = errorMessage(error, "ai_operation_failed");
    await markAiWorkflowJob(supabase, job.id, {
      status: "error",
      error_code: code,
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}

export async function processAiProposalJob(
  supabase: WorkflowClient,
  job: Pick<AiWorkflowJob, "id"> & {
    owner_id: string;
    portal_id: string;
    request_id: string;
    payload: Json;
  },
) {
  const payload = job.payload as Record<string, unknown>;
  const assets = payload.assets as AiAssetInput[];
  const operation = payload.operation as AiPortalOperation;
  const projectDescription = payload.projectDescription;
  const aiContext = payload.aiContext;
  const generateColors = payload.generateColors !== false;
  const plan = payload.plan;
  if (
    !Array.isArray(assets) ||
    !operation ||
    typeof projectDescription !== "string" ||
    typeof plan !== "string"
  ) {
    throw new Error("invalid_job_payload");
  }

  await markAiWorkflowJob(supabase, job.id, {
    status: "processing",
    started_at: new Date().toISOString(),
    result: { progress: "analyzing-assets" } as Json,
  });
  try {
    const { data: portal } = await supabase
      .from("portals")
      .select(
        "name,short_description,cover_url,icon_url,theme,content_language",
      )
      .eq("id", job.portal_id)
      .single();
    if (!portal) throw new Error("portal_not_found");

    const existingDocument = payload.existingDocument
      ? normalizePortalDocument(payload.existingDocument, portal)
      : undefined;
    const enhancement = await generateAiStructuredEnhancement({
      assets,
      existingDocument,
      onProgress: async (progress, progressDetail) => {
        await markAiWorkflowJob(supabase, job.id, {
          status: "processing",
          result: { progress, progressDetail } as Json,
        });
      },
      operation,
      projectDescription,
      aiContext: typeof aiContext === "string" ? aiContext : "",
      generateColors,
      contentLanguage: portal.content_language === "es" ? "es" : "en",
      plan: plan as PortalPlan,
    });
    if (!enhancement) throw new Error("ai_content_unavailable");
    if (
      !enhancement.projectCopy.name.trim() ||
      !enhancement.projectCopy.description.trim()
    ) {
      throw new Error("ai_content_incomplete");
    }
    const proposal = createAiPortalProposal({
      assets,
      excludedAssetIds: Array.isArray(payload.excludedAssetIds)
        ? payload.excludedAssetIds.filter(
            (id): id is string => typeof id === "string",
          )
        : undefined,
      existingDocument,
      forceIncludeAssetIds: Array.isArray(payload.forceIncludeAssetIds)
        ? payload.forceIncludeAssetIds.filter(
            (id): id is string => typeof id === "string",
          )
        : undefined,
      operation,
      enhancement,
      plan: plan as "free" | "starter" | "pro" | "premium",
      portal,
      projectDescription,
      generateColors,
    });
    // Persist the proposal before the optional apply phase. This lets the
    // client show that analysis finished while the durable apply step keeps
    // running, including after a page reload.
    await markAiWorkflowJob(supabase, job.id, {
      status: "processing",
      result: { proposal } as Json,
    });
    if (payload.autoApply === true) {
      await markAiWorkflowJob(supabase, job.id, {
        status: "processing",
        result: { progress: "applying", proposal } as Json,
      });
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("authentication_required");
      const operationJob = await createAiWorkflowJob(supabase, {
        owner_id: userData.user.id,
        portal_id: job.portal_id,
        kind: "portal-operation",
        request_id: `${job.request_id}:apply`,
        payload: {
          operation,
          proposedDocument: proposal.proposedDocument,
        } as Json,
      });
      const document = await processAiOperationJob(supabase, {
        id: operationJob.id,
      });
      if (!document) throw new Error("ai_operation_not_queued");
      await markAiWorkflowJob(supabase, job.id, {
        status: "completed",
        result: { document, proposal } as Json,
        completed_at: new Date().toISOString(),
      });
      return { document, proposal };
    }
    await completeAiWorkflowCredits(supabase, job.request_id, "committed");
    await markAiWorkflowJob(supabase, job.id, {
      status: "completed",
      result: { proposal } as Json,
      completed_at: new Date().toISOString(),
    });
    return proposal;
  } catch (error) {
    const message = errorMessage(error, "ai_content_failed");
    const errorCode = message.startsWith("ai_section_copy_missing:")
      ? "ai_content_incomplete"
      : message;
    await markAiWorkflowJob(supabase, job.id, {
      status: "error",
      error_code: errorCode,
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}
