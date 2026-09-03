import type { PortalAutosaveState } from "@/application/portal/editor-store";

type PersistedAiWorkflowJob = {
  status: "loading" | "completed" | "error" | "cancelled";
  updatedAt: string;
};

export function getTerminalRecoveryJobIds(
  jobsById: Record<string, PersistedAiWorkflowJob>,
  activeJobIds: Set<string>,
  limit: number,
) {
  return Object.entries(jobsById)
    .filter(([id, job]) => job.status === "loading" && !activeJobIds.has(id))
    .sort(([, left], [, right]) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )
    .slice(0, limit)
    .map(([id]) => id);
}

export function canRefreshCompletedDocumentJob(
  autosave: PortalAutosaveState | undefined,
) {
  return autosave?.status !== "saving" && autosave?.status !== "error";
}

export type PendingDocumentJobRefresh = {
  baselineHydrationGeneration: number | undefined;
  baselineRevision: number | undefined;
  jobId: string;
  jobVersion: string;
};

export function shouldRequestDocumentRefresh(
  pending: PendingDocumentJobRefresh | undefined,
  jobId: string,
  jobVersion: string,
) {
  return pending?.jobId !== jobId || pending.jobVersion !== jobVersion;
}

export function hasAuthoritativeDocumentAck(
  pending: PendingDocumentJobRefresh,
  currentHydrationGeneration: number | undefined,
  currentRevision: number | undefined,
) {
  return (
    currentHydrationGeneration !== undefined &&
    (pending.baselineHydrationGeneration === undefined ||
      currentHydrationGeneration > pending.baselineHydrationGeneration) &&
    currentRevision !== undefined &&
    (pending.baselineRevision === undefined ||
      currentRevision >= pending.baselineRevision)
  );
}
