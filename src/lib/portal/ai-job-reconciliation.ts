import type { PortalAutosaveState } from "@/application/portal/editor-store";

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
