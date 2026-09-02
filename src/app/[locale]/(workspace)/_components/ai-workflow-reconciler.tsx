"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PortalDocument } from "@/domain/portal/document";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  canRefreshCompletedDocumentJob,
  hasAuthoritativeDocumentAck,
  type PendingDocumentJobRefresh,
  shouldRequestDocumentRefresh,
} from "@/lib/portal/ai-job-reconciliation";
import type {
  AiWorkflowProgress,
  AiWorkflowProgressDetail,
} from "@/lib/portal/ai-workflow-store";
import { useAiWorkflowStore } from "@/lib/portal/ai-workflow-store";
import { createTrailingReconciler } from "@/lib/request-reconciliation";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  portal_id: string;
  portal_name: string | null;
  kind: "portal-operation" | "portal-content" | "portal-proposal";
  status: "queued" | "processing" | "completed" | "error" | "cancelled";
  request_id: string;
  result: {
    document?: PortalDocument;
    proposal?: unknown;
    progress?: AiWorkflowProgress;
    progressDetail?: AiWorkflowProgressDetail;
  } | null;
  payload?: {
    operation?: "generate" | "improve-project" | "refine-copy";
    autoApply?: boolean;
    target?: { id?: string; kind?: string };
  };
  operation?: "generate" | "improve-project" | "refine-copy";
  autoApply?: boolean;
  error_code: string | null;
  updated_at: string;
};

type JobsResponse = { jobs?: Job[] } | null;
let aiJobsRequestInFlight: Promise<JobsResponse> | null = null;

function fetchAiJobs() {
  if (aiJobsRequestInFlight) return aiJobsRequestInFlight;
  const request = fetch("/api/ai/jobs", { cache: "no-store" })
    .then(async (response) =>
      response.ok
        ? ((await response.json().catch(() => null)) as JobsResponse)
        : null,
    )
    .catch(() => null);
  aiJobsRequestInFlight = request.finally(() => {
    aiJobsRequestInFlight = null;
  });
  return aiJobsRequestInFlight;
}

export function AiWorkflowReconciler() {
  const t = useTranslations("PortalEditor.workspace");
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  const tRef = useRef(t);
  const [cancelJobId, setCancelJobId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const previousStatusesRef = useRef(new Map<string, Job["status"]>());
  const appliedDocumentJobByPortalRef = useRef(new Map<string, string>());
  const pendingDocumentJobRefreshByPortalRef = useRef(
    new Map<string, PendingDocumentJobRefresh>(),
  );
  const upsertJob = useAiWorkflowStore((state) => state.upsertJob);
  const removeJob = useAiWorkflowStore((state) => state.removeJob);
  pathnameRef.current = pathname;
  routerRef.current = router;
  tRef.current = t;

  useEffect(() => {
    let disposed = false;
    const previousStatuses = previousStatusesRef.current;
    const appliedDocumentJobByPortal = appliedDocumentJobByPortalRef.current;
    const pendingDocumentJobRefreshByPortal =
      pendingDocumentJobRefreshByPortalRef.current;
    const currentPortalId = () =>
      pathnameRef.current.match(/\/create\/([^/]+)/)?.[1] ?? null;
    const translate = (...args: Parameters<typeof t>) => tRef.current(...args);
    const progressDescription = (job: Job) => {
      if (
        job.result?.progress === "analyzing-assets" &&
        job.result.progressDetail?.batch
      )
        return translate("aiAnalyzingAssets");
      if (job.result?.progress === "analyzing-assets")
        return translate("aiAnalyzingAssets");
      if (job.result?.progress === "generating-copy")
        return translate("aiGeneratingCopy");
      if (job.result?.progress === "generating-structure")
        return translate("aiGeneratingStructure");
      if (job.result?.progress === "applying") return translate("aiApplying");
      if (job.kind === "portal-content")
        return translate("aiProcessingContent");
      if (job.kind === "portal-operation") return translate("aiApplying");
      return translate("aiPreparing");
    };
    const actionTitle = (job: Job) => {
      const title =
        job.operation === "generate"
          ? translate("aiCreatingProjectTitle")
          : job.operation === "refine-copy"
            ? translate("aiImproveWithAiTitle")
            : translate("aiAddWithAiTitle");
      if (job.result?.progressDetail?.batch) {
        return `${title} · ${translate("aiBatchLabel", {
          batch: job.result.progressDetail.batch,
          total: job.result.progressDetail.total,
        })}`;
      }
      return title;
    };
    const failureDescription = (job: Job) => {
      if (job.error_code === "insufficient_credits")
        return translate("aiInsufficientCredits");
      if (job.error_code === "plan_limit") return translate("aiPlanLimit");
      return translate("aiFailedDescription", {
        code: job.error_code ?? "unknown",
      });
    };
    const runReconciliation = async () => {
      const body = await fetchAiJobs();
      if (!body || disposed) return;
      const latestDocumentJobByPortal = new Map<string, Job>();
      for (const job of body?.jobs ?? []) {
        if (
          job.status === "completed" &&
          (job.kind !== "portal-proposal" || job.autoApply === true) &&
          job.result?.document
        ) {
          const current = latestDocumentJobByPortal.get(job.portal_id);
          if (!current || job.updated_at > current.updated_at)
            latestDocumentJobByPortal.set(job.portal_id, job);
        }
      }
      for (const job of body?.jobs ?? []) {
        upsertJob({
          id: job.id,
          portalId: job.portal_id,
          portalName: job.portal_name,
          kind: job.kind,
          status:
            job.status === "completed"
              ? "completed"
              : job.status === "error"
                ? "error"
                : job.status === "cancelled"
                  ? "cancelled"
                  : "loading",
          requestId: job.request_id,
          errorCode: job.error_code,
          updatedAt: job.updated_at,
          operation:
            job.operation ??
            (job.kind === "portal-content" ? "refine-copy" : undefined),
          autoApply: job.autoApply,
          targetKey:
            job.payload?.target?.kind && job.payload.target.id
              ? `${job.payload.target.kind}:${job.payload.target.id}`
              : undefined,
          progress: job.result?.progress,
          progressDetail: job.result?.progressDetail,
          proposal: (job.result as { proposal?: never } | null)?.proposal,
        });
        const wasActive =
          previousStatuses.get(job.id) === "queued" ||
          previousStatuses.get(job.id) === "processing";
        const isInternalApplyJob =
          job.kind === "portal-operation" && job.request_id.endsWith(":apply");
        const canCancel =
          job.result?.progress !== "generating-structure" &&
          job.result?.progress !== "generating-copy";
        const activePortalId = currentPortalId();
        const belongsToCurrentProject = Boolean(
          activePortalId && job.portal_id === activePortalId,
        );
        const toastId = `ai-workflow-${job.portal_id}`;
        if (
          belongsToCurrentProject &&
          !isInternalApplyJob &&
          (job.status === "queued" || job.status === "processing")
        ) {
          toast.loading(actionTitle(job), {
            action: canCancel
              ? {
                  label: translate("aiCancelAction"),
                  onClick: () => setCancelJobId(job.id),
                }
              : null,
            description: progressDescription(job),
            duration: Number.POSITIVE_INFINITY,
            id: toastId,
          });
        } else if (
          !isInternalApplyJob &&
          belongsToCurrentProject &&
          wasActive &&
          job.status === "completed"
        ) {
          toast.success(translate("aiCompletedTitle"), {
            action: null,
            description: translate("aiCompletedDescription"),
            id: toastId,
          });
        } else if (
          belongsToCurrentProject &&
          !isInternalApplyJob &&
          wasActive &&
          job.status === "error"
        ) {
          toast.error(translate("aiFailedTitle"), {
            action: null,
            description: failureDescription(job),
            id: toastId,
          });
        } else if (
          belongsToCurrentProject &&
          !isInternalApplyJob &&
          wasActive &&
          job.status === "cancelled"
        ) {
          toast.info(translate("aiCancelledTitle"), {
            action: null,
            description: translate("aiCancelledDescription"),
            id: toastId,
          });
        } else if (!belongsToCurrentProject && !isInternalApplyJob) {
          toast.dismiss(toastId);
        }
        previousStatuses.set(job.id, job.status);
        if (
          (job.status === "queued" || job.status === "processing") &&
          job.kind === "portal-operation"
        ) {
          void fetch(`/api/ai/jobs/${job.id}/process`, { method: "POST" });
        }
        const isLatestDocumentJob =
          latestDocumentJobByPortal.get(job.portal_id)?.id === job.id;
        if (
          job.status === "completed" &&
          (job.kind !== "portal-proposal" || job.autoApply === true) &&
          job.result?.document
        ) {
          if (
            isLatestDocumentJob &&
            appliedDocumentJobByPortal.get(job.portal_id) !== job.id
          ) {
            if (activePortalId === job.portal_id) {
              const editorState = usePortalEditorStore.getState();
              const autosave = editorState.autosaveByPortalId[job.portal_id];
              if (!canRefreshCompletedDocumentJob(autosave)) {
                continue;
              }
              const pending = pendingDocumentJobRefreshByPortal.get(
                job.portal_id,
              );
              const currentHydrationGeneration =
                editorState.serverHydrationGenerationByPortalId[job.portal_id];
              const currentRevision =
                editorState.documentServerRevisionByPortalId[job.portal_id];
              if (
                pending?.jobId === job.id &&
                hasAuthoritativeDocumentAck(
                  pending,
                  currentHydrationGeneration,
                  currentRevision,
                )
              ) {
                pendingDocumentJobRefreshByPortal.delete(job.portal_id);
                appliedDocumentJobByPortal.set(job.portal_id, job.id);
                removeJob(job.id);
                continue;
              }
              // AI apply RPCs persist before the job is completed. Refresh the
              // authoritative draft instead of replaying an old job result
              // into Zustand on every page load.
              if (
                shouldRequestDocumentRefresh(pending, job.id, job.updated_at)
              ) {
                pendingDocumentJobRefreshByPortal.set(job.portal_id, {
                  baselineHydrationGeneration: currentHydrationGeneration,
                  baselineRevision: currentRevision,
                  jobId: job.id,
                  jobVersion: job.updated_at,
                });
                routerRef.current.refresh();
              }
              continue;
            }
            continue;
          }
          removeJob(job.id);
        }
      }
    };
    const reconcile = createTrailingReconciler(runReconciliation);
    void reconcile();
    const reconcileOnNavigation = () => void reconcile();
    window.addEventListener(
      "portal-ai-workflow-reconcile",
      reconcileOnNavigation,
    );
    const cancelFromSidebar = (event: Event) => {
      const jobId = (event as CustomEvent<string>).detail;
      if (jobId) setCancelJobId(jobId);
    };
    window.addEventListener("portal-ai-workflow-cancel", cancelFromSidebar);
    const unsubscribeEditor = usePortalEditorStore.subscribe(
      (state, previous) => {
        const activePortalId = currentPortalId();
        if (!activePortalId) return;
        const autosave = state.autosaveByPortalId[activePortalId];
        const previousAutosave = previous.autosaveByPortalId[activePortalId];
        const wasBlocked =
          previousAutosave?.status === "saving" ||
          previousAutosave?.status === "error";
        const isSettled = canRefreshCompletedDocumentJob(autosave);
        const hydrationAcknowledged =
          state.serverHydrationGenerationByPortalId[activePortalId] !==
          previous.serverHydrationGenerationByPortalId[activePortalId];
        if ((wasBlocked && isSettled) || hydrationAcknowledged)
          void reconcile();
      },
    );
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const setupRealtime = async () => {
      const { data } = await supabase.auth.getUser();
      if (disposed || !data.user) return;
      channel = supabase
        .channel("ai-workflow-jobs")
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: `owner_id=eq.${data.user.id}`,
            schema: "public",
            table: "ai_workflow_jobs",
          },
          () => void reconcile(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void reconcile();
        });
    };
    void setupRealtime();
    return () => {
      disposed = true;
      window.removeEventListener(
        "portal-ai-workflow-reconcile",
        reconcileOnNavigation,
      );
      window.removeEventListener(
        "portal-ai-workflow-cancel",
        cancelFromSidebar,
      );
      unsubscribeEditor();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [removeJob, upsertJob]);

  useEffect(() => {
    const currentPortalId = pathname.match(/\/create\/([^/]+)/)?.[1] ?? null;
    for (const job of Object.values(useAiWorkflowStore.getState().jobsById)) {
      if (
        job.status === "loading" &&
        job.portalId !== currentPortalId &&
        !(job.kind === "portal-operation" && job.requestId.endsWith(":apply"))
      ) {
        toast.dismiss(`ai-workflow-${job.portalId}`);
      }
    }
    window.dispatchEvent(new Event("portal-ai-workflow-reconcile"));
  }, [pathname]);

  async function confirmCancel() {
    if (!cancelJobId) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/ai/jobs/${cancelJobId}/cancel`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("cancel_failed");
      setCancelJobId(null);
    } catch {
      toast.error(t("aiCancelFailed"));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !cancelling) setCancelJobId(null);
      }}
      open={Boolean(cancelJobId)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("aiCancelTitle")}</DialogTitle>
          <DialogDescription>{t("aiCancelDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={cancelling}
            onClick={() => setCancelJobId(null)}
            variant="outline"
          >
            {t("aiCancelNo")}
          </Button>
          <Button disabled={cancelling} onClick={() => void confirmCancel()}>
            {t("aiCancelYes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
