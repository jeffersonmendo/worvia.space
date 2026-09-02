"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { updatePortalDocument } from "@/app/[locale]/_actions/portals";
import {
  acknowledgePortalAutosaveConflict,
  ensurePortalAutosave,
  flushPortalAutosave,
  releasePortalAutosave,
  retryPortalAutosaveConflict,
} from "@/application/portal/autosave-coordinator";
import type { AutosaveStatus } from "@/application/portal/autosave-queue";
import { AutosaveQueue } from "@/application/portal/autosave-queue";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import type { PortalDocument } from "@/domain/portal/document";
import { withStablePortalAssetPreviews } from "@/lib/portal/asset-preview-reference";
import {
  PortalDocumentConflictError,
  persistPortalDocumentAtLatestRevision,
} from "@/lib/portal/revisioned-autosave";

export type UsePortalEditorPersistenceProps = {
  document: PortalDocument;
  documentRevision?: number | null;
  enabled: boolean;
  flushPersistedAssetDeletions: (
    portalId: string,
    document: PortalDocument,
  ) => void;
  hasUnpublishedChanges?: boolean;
  locale?: string;
  markDocumentPersisted: (portalId: string, revision: number) => void;
  resetAutosaveState: (portalId: string) => void;
  setAutosaveState: (
    portalId: string,
    state: { error: string | null; status: AutosaveStatus },
  ) => void;
  slug?: string;
  updateStoreDocument: (
    portalId: string,
    update: (document: PortalDocument) => PortalDocument,
  ) => PortalDocument | undefined;
  hydrateDocument: (
    portalId: string,
    document: PortalDocument,
    revision?: number | null,
    hasUnpublishedChanges?: boolean,
  ) => void;
  portalId?: string;
};

export function usePortalEditorPersistence({
  document,
  documentRevision,
  enabled,
  flushPersistedAssetDeletions,
  hasUnpublishedChanges,
  locale,
  markDocumentPersisted,
  resetAutosaveState,
  setAutosaveState,
  slug,
  updateStoreDocument,
  hydrateDocument,
  portalId,
}: UsePortalEditorPersistenceProps) {
  const router = useRouter();
  const t = useTranslations();

  useEffect(() => {
    if (!enabled || !locale || !portalId) return;
    ensurePortalAutosave(portalId, ({ hasPredecessor }) => {
      if (!hasPredecessor) resetAutosaveState(portalId);
      return new AutosaveQueue<PortalDocument>({
        delay: 700,
        onStatusChange: (status, error) => {
          if (error) {
            console.error("Portal autosave failed", { error, portalId });
          }
          setAutosaveState(portalId, {
            error: error ? "autosave_failed" : null,
            status,
          });
        },
        save: async (nextDocument) => {
          await persistPortalDocumentAtLatestRevision({
            acknowledge: (revision) => {
              markDocumentPersisted(portalId, revision);
              flushPersistedAssetDeletions(portalId, nextDocument);
            },
            document: nextDocument,
            getExpectedRevision: () =>
              usePortalEditorStore.getState().documentServerRevisionByPortalId[
                portalId
              ] ?? null,
            persist: async (value, expectedRevision) => {
              const formData = new FormData();
              formData.set("locale", locale);
              formData.set("portal_id", portalId);
              formData.set("document_json", JSON.stringify(value));
              if (expectedRevision !== null) {
                formData.set("expected_revision", String(expectedRevision));
              }
              return updatePortalDocument(formData);
            },
            reconcileConflict: () => {
              toast.warning(t("PortalEditor.autosave.conflict"), {
                action: {
                  label: t("PortalEditor.autosave.conflictRetry"),
                  onClick: () => {
                    const recovery =
                      retryPortalAutosaveConflict<PortalDocument>(portalId);
                    if (!recovery) {
                      router.refresh();
                      return;
                    }
                    updateStoreDocument(portalId, () => recovery);
                    void flushPortalAutosave(portalId)
                      .then(() =>
                        toast.dismiss(`portal-autosave-conflict:${portalId}`),
                      )
                      .catch(() => undefined);
                  },
                },
                description: t("PortalEditor.autosave.conflictDescription"),
                duration: Number.POSITIVE_INFINITY,
                id: `portal-autosave-conflict:${portalId}`,
              });
              setTimeout(() => router.refresh(), 0);
            },
          });
        },
        shouldRetry: (error) => !(error instanceof PortalDocumentConflictError),
      });
    });
    return () => releasePortalAutosave(portalId);
  }, [
    enabled,
    flushPersistedAssetDeletions,
    locale,
    markDocumentPersisted,
    portalId,
    resetAutosaveState,
    router,
    setAutosaveState,
    t,
    updateStoreDocument,
  ]);

  useEffect(() => {
    if (!enabled || !portalId) return;
    const stateBeforeHydration = usePortalEditorStore.getState();
    const priorServerRevision =
      stateBeforeHydration.documentServerRevisionByPortalId[portalId];
    hydrateDocument(
      portalId,
      withStablePortalAssetPreviews(document, slug ?? ""),
      documentRevision,
      hasUnpublishedChanges,
    );
    if (
      stateBeforeHydration.autosaveByPortalId[portalId]?.status ===
        "conflict" &&
      documentRevision != null &&
      (priorServerRevision === undefined ||
        documentRevision > priorServerRevision) &&
      usePortalEditorStore.getState().documentServerRevisionByPortalId[
        portalId
      ] === documentRevision
    ) {
      acknowledgePortalAutosaveConflict(portalId);
    }
  }, [
    document,
    documentRevision,
    hasUnpublishedChanges,
    hydrateDocument,
    portalId,
    slug,
    enabled,
  ]);
}
