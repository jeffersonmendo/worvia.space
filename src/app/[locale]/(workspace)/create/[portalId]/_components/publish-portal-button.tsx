"use client";

import { IconLoader2, IconWorldUpload } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { publishPortalById } from "@/app/[locale]/_actions/portals";
import { flushPortalAutosave } from "@/application/portal/autosave-coordinator";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import {
  PortalPublishFailure,
  publishPortalAfterAutosave,
} from "@/application/portal/publish-flow";
import {
  PORTAL_PLAN_RETRY_EVENT,
  usePortalPlan,
} from "@/components/portal/portal-plan-provider";
import { Button } from "@/components/ui/button";
import { validatePortalPublicationReadiness } from "@/domain/portal/publication-readiness";
import type { SafePendingPortalAction } from "@/lib/billing/portal-plan-client";
import { showPortalPublishError } from "@/lib/portal/portal-error-feedback";

export function PublishPortalButton({
  initialHasUnpublishedChanges,
  locale,
  portalId,
  triggerless = false,
}: {
  initialHasUnpublishedChanges: boolean;
  locale: string;
  portalId: string;
  triggerless?: boolean;
}) {
  const t = useTranslations("PortalEditor.workspace");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { guardPublication } = usePortalPlan();
  const storeHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.hasUnpublishedChangesByPortalId[portalId],
  );
  const hasUnpublishedChanges =
    storeHasUnpublishedChanges ?? initialHasUnpublishedChanges;
  const initializeHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.initializeHasUnpublishedChanges,
  );
  const markPublishedIfRevision = usePortalEditorStore(
    (state) => state.markPublishedIfRevision,
  );
  const setLastPublishedPortalId = usePortalEditorStore(
    (state) => state.setLastPublishedPortalId,
  );
  const setPublishError = usePortalEditorStore(
    (state) => state.setPublishError,
  );
  const setPublishingPortalId = usePortalEditorStore(
    (state) => state.setPublishingPortalId,
  );
  const setPublicationIssues = usePortalEditorStore(
    (state) => state.setPublicationIssues,
  );
  const setPublicationPopoverOpen = usePortalEditorStore(
    (state) => state.setPublicationPopoverOpen,
  );

  useEffect(() => {
    initializeHasUnpublishedChanges(portalId, initialHasUnpublishedChanges);
  }, [initialHasUnpublishedChanges, initializeHasUnpublishedChanges, portalId]);

  const publishMutation = useMutation({
    mutationFn: () =>
      publishPortalAfterAutosave(
        () => flushPortalAutosave(portalId),
        async () => {
          const publishedRevision =
            usePortalEditorStore.getState().documentRevisionByPortalId[
              portalId
            ] ?? 0;
          await publishPortalById({
            locale,
            portalId,
            returnTo: `/${locale}/create/${portalId}`,
          });
          return publishedRevision;
        },
      ),
    onError: (error) => {
      setPublishError(null);
      if (
        !(error instanceof PortalPublishFailure) ||
        error.stage === "publish"
      ) {
        showPortalPublishError(portalId, t("publishError"));
      }
      setPublishingPortalId(null);
    },
    onMutate: () => {
      setPublishError(null);
      setPublishingPortalId(portalId);
    },
    onSuccess: async (publishedRevision) => {
      markPublishedIfRevision(portalId, publishedRevision);
      setLastPublishedPortalId(portalId);
      setPublishingPortalId(null);
      toast.success(t("publishSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["portal", portalId] });
      router.refresh();
    },
  });

  const attemptPublication = useCallback(() => {
    if (!hasUnpublishedChanges) return;

    const document =
      usePortalEditorStore.getState().documentsByPortalId[portalId];
    if (document) {
      const issues = validatePortalPublicationReadiness(document);
      setPublicationIssues(portalId, issues);
      if (issues.length > 0) {
        setPublishError(null);
        setPublicationPopoverOpen(portalId, true);
        return;
      }
    }
    if (document && !guardPublication(document)) return;
    publishMutation.mutate();
  }, [
    guardPublication,
    hasUnpublishedChanges,
    portalId,
    publishMutation.mutate,
    setPublicationIssues,
    setPublicationPopoverOpen,
    setPublishError,
  ]);

  useEffect(() => {
    if (!triggerless) return;
    const publish = () => attemptPublication();
    window.addEventListener("portal-workspace:publish", publish);
    return () =>
      window.removeEventListener("portal-workspace:publish", publish);
  }, [attemptPublication, triggerless]);

  useEffect(() => {
    const retry = (event: Event) => {
      const action = (event as CustomEvent<SafePendingPortalAction>).detail;
      if (action.kind === "publish") attemptPublication();
    };
    window.addEventListener(PORTAL_PLAN_RETRY_EVENT, retry);
    return () => window.removeEventListener(PORTAL_PLAN_RETRY_EVENT, retry);
  }, [attemptPublication]);

  if (triggerless) return null;

  return (
    <Button
      className="rounded-full"
      disabled={publishMutation.isPending || !hasUnpublishedChanges}
      onClick={attemptPublication}
      size="lg"
      type="button"
    >
      {publishMutation.isPending ? (
        <IconLoader2 className="animate-spin" data-icon="inline-start" />
      ) : (
        <IconWorldUpload data-icon="inline-start" />
      )}
      {t("publish")}
    </Button>
  );
}
