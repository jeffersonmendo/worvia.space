"use client";

import {
  IconAlertCircle,
  IconCheck,
  IconFile,
  IconFileUpload,
  IconLoader2,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PortalDocument } from "@/domain/portal/document";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRouter } from "@/i18n/navigation";
import {
  shouldUseServerOwnedUpload,
  uploadManagedPortalAsset,
  uploadManagedPortalAssetServerOwned,
} from "@/infrastructure/portal/portal-assets-client";
import {
  aiCreditsQueryKey,
  canAffordAiOperation,
  finalizeAiCredits,
  reserveAiCredits,
  useAiCredits,
} from "@/lib/billing/ai-credits-client";
import type { AiAssetInput, AiPortalProposal } from "@/lib/portal/ai-proposal";
import {
  useAiWorkflowStore,
  waitForAiWorkflowJob,
} from "@/lib/portal/ai-workflow-store";
import { extractAssetMetadata } from "@/lib/portal/asset-metadata";
import {
  inferAssetMimeType,
  isRenderableImageMimeType,
} from "@/lib/portal/asset-validation";
import { createRandomId } from "@/lib/random-id";
import { createClient } from "@/lib/supabase/client";

export function PortalAiDialog({
  portalId,
  triggerless = false,
}: {
  portalId: string;
  triggerless?: boolean;
}) {
  const t = useTranslations("PortalEditor.ai");
  const workspaceT = useTranslations("PortalEditor.workspace");
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [
    { files: selectedFiles, isDragging, errors: fileErrors },
    {
      clearFiles,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      getInputProps,
      removeFile,
    },
  ] = useFileUpload({
    accept: "image/*,.pdf,.txt,.md,.ai,.eps,.psd,.indd,.ttf,.otf,.woff,.woff2",
    maxSize: 500 * 1024 * 1024,
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [proposal, setProposal] = useState<AiPortalProposal | null>(null);
  const [proposalError, setProposalError] = useState(false);
  const [applyError, setApplyError] = useState(false);
  const [applyErrorCode, setApplyErrorCode] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [operation, setOperation] = useState<
    "generate" | "improve-project" | "refine-copy"
  >("generate");
  const [applyImmediately, setApplyImmediately] = useState(false);
  const [analyzedAssets, setAnalyzedAssets] = useState<AiAssetInput[]>([]);
  const [proposalRequestId, setProposalRequestId] = useState<string | null>(
    null,
  );
  const [quarantineDecisions, setQuarantineDecisions] = useState<
    Record<string, "include" | "exclude">
  >({});
  const currentDocument = usePortalEditorStore(
    (state) => state.documentsByPortalId[portalId],
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: creditData } = useAiCredits();
  const canAffordOperation =
    creditData === undefined ||
    canAffordAiOperation(creditData.available, operation);
  const upsertJob = useAiWorkflowStore((state) => state.upsertJob);
  const hasActiveProjectJob = useAiWorkflowStore((state) =>
    Object.values(state.jobsById).some(
      (job) => job.portalId === portalId && job.status === "loading",
    ),
  );

  useEffect(() => {
    setFiles(selectedFiles.map(({ file }) => file));
    setAnalyzed(false);
  }, [selectedFiles]);

  useEffect(() => {
    if (!triggerless) return;
    const openUpload = () => {
      if (hasActiveProjectJob) {
        toast.info(t("alreadyInProgress"));
        return;
      }
      if (
        creditData &&
        !canAffordAiOperation(creditData.available, "improve-project")
      ) {
        toast.warning(t("insufficientCredits"));
        return;
      }
      setOperation("improve-project");
      setApplyImmediately(true);
      clearFiles();
      setAnalyzed(false);
      setAnalyzedAssets([]);
      setProposal(null);
      setProposalError(false);
      setApplyError(false);
      setApplyErrorCode(null);
      setQuarantineDecisions({});
      setOpen(true);
    };
    window.addEventListener("portal-workspace:upload", openUpload);
    return () =>
      window.removeEventListener("portal-workspace:upload", openUpload);
  }, [clearFiles, creditData, hasActiveProjectJob, t, triggerless]);

  async function analyze() {
    if (hasActiveProjectJob) {
      toast.info(t("alreadyInProgress"));
      return;
    }
    if (!canAffordOperation) {
      toast.warning(t("insufficientCredits"));
      return;
    }
    setAnalyzing(true);
    setProposalError(false);
    setApplyError(false);
    setApplyErrorCode(null);
    const nextProposalRequestId = createRandomId();
    const creditRequestId = applyImmediately
      ? `${nextProposalRequestId}:apply`
      : nextProposalRequestId;
    let creditReserved = false;
    try {
      await reserveAiCredits(operation, creditRequestId);
      creditReserved = true;
      await queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey });
      const uploaded = [] as {
        assetId: string;
        file: File;
        height?: number;
        hasTransparency?: boolean;
        path: string;
        previewUrl: string;
        width?: number;
      }[];
      for (const file of operation === "refine-copy" ? [] : files) {
        const mimeType = inferAssetMimeType(file.name, file.type);
        const category = isRenderableImageMimeType(mimeType)
          ? "image"
          : mimeType.startsWith("font/")
            ? "font"
            : "file";
        const asset = shouldUseServerOwnedUpload(file.size)
          ? await uploadManagedPortalAssetServerOwned({
              category,
              file,
              portalId,
            })
          : await uploadManagedPortalAsset({
              category,
              file,
              portalId,
              storage: createClient().storage,
            });
        uploaded.push({
          ...asset,
          file,
          ...(await extractAssetMetadata(file)),
        });
      }
      const assets = uploaded.map(
        ({ assetId, file, path, previewUrl, ...metadata }) => ({
          fileUrl: previewUrl,
          id: assetId,
          mimeType: inferAssetMimeType(file.name, file.type),
          name: file.name,
          sizeBytes: file.size,
          storagePath: path,
          ...metadata,
        }),
      );
      setAnalyzedAssets(assets);
      const response = await fetch("/api/ai/portal-proposals", {
        body: JSON.stringify({
          assets,
          autoApply: applyImmediately,
          operation,
          portalId,
          projectDescription:
            files.map((file) => file.name).join(", ") ||
            currentDocument?.portal.description ||
            "Portal project",
          existingDocument: currentDocument,
          requestId: nextProposalRequestId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        document?: PortalDocument;
        error?: string;
        jobId?: string;
        proposal?: AiPortalProposal;
      };
      if (!response.ok) throw new Error(result.error ?? "proposal_error");
      if (response.status === 202 && result.jobId) {
        creditReserved = false;
        setProposalRequestId(nextProposalRequestId);
        upsertJob({
          autoApply: applyImmediately,
          errorCode: null,
          id: result.jobId,
          kind: "portal-proposal",
          operation,
          portalId,
          requestId: nextProposalRequestId,
          status: "loading",
          updatedAt: new Date().toISOString(),
        });
        toast.success(t("jobQueued"));
        toast.loading(
          operation === "refine-copy"
            ? workspaceT("aiImproveWithAiTitle")
            : workspaceT("aiAddWithAiTitle"),
          {
            description: workspaceT("aiProcessingContent"),
            duration: Number.POSITIVE_INFINITY,
            id: `ai-workflow-${portalId}`,
          },
        );
        if (applyImmediately) {
          // The durable workflow continues in the background. Keep the
          // editor available instead of trapping the user in a loading modal.
          setOpen(false);
          return;
        }
        const job = await waitForAiWorkflowJob(result.jobId);
        if (!job.proposal) throw new Error("proposal_error");
        result.proposal = job.proposal;
      }
      if (!result.proposal) throw new Error("proposal_error");
      if (applyImmediately && currentDocument) {
        // autoApply is handled by the durable proposal workflow. Submitting
        // another operation here could apply the same proposal twice.
        if (result.document) router.refresh();
        await queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey });
        toast.success(t("newFilesApplied"));
        setOpen(false);
        return;
      }
      setProposalRequestId(nextProposalRequestId);
      setProposal(result.proposal);
      setAnalyzed(true);
    } catch (error) {
      if (creditReserved) {
        await finalizeAiCredits(creditRequestId, "refunded").catch(
          () => undefined,
        );
        await queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey });
      }
      if (applyImmediately) {
        const reason = error instanceof Error ? error.message : "";
        setApplyErrorCode(reason || null);
        toast.error(
          reason === "ai_workflow_in_progress"
            ? t("alreadyInProgress")
            : reason === "insufficient_credits"
              ? t("insufficientCredits")
              : reason === "plan_limit"
                ? t("planLimit")
                : t("applyError"),
        );
        setApplyError(true);
      } else {
        const reason = error instanceof Error ? error.message : "";
        if (reason === "ai_workflow_in_progress") {
          toast.info(t("alreadyInProgress"));
        } else {
          setProposalError(true);
        }
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function decideQuarantine(
    assetId: string,
    decision: "include" | "exclude",
  ) {
    const nextDecisions = { ...quarantineDecisions, [assetId]: decision };
    setQuarantineDecisions(nextDecisions);
    setAnalyzing(true);
    const nextProposalRequestId = createRandomId();
    try {
      const response = await fetch("/api/ai/portal-proposals", {
        body: JSON.stringify({
          assets: analyzedAssets,
          excludedAssetIds: Object.entries(nextDecisions)
            .filter(([, value]) => value === "exclude")
            .map(([id]) => id),
          existingDocument: currentDocument,
          forceIncludeAssetIds: Object.entries(nextDecisions)
            .filter(([, value]) => value === "include")
            .map(([id]) => id),
          operation,
          portalId,
          projectDescription:
            currentDocument?.portal.description || "Portal project",
          requestId: nextProposalRequestId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        jobId?: string;
        proposal?: AiPortalProposal;
      };
      if (!response.ok) throw new Error(result.error ?? "proposal_error");
      if (response.status === 202 && result.jobId) {
        setProposalRequestId(nextProposalRequestId);
        upsertJob({
          autoApply: false,
          errorCode: null,
          id: result.jobId,
          kind: "portal-proposal",
          operation,
          portalId,
          requestId: nextProposalRequestId,
          status: "loading",
          updatedAt: new Date().toISOString(),
        });
        toast.success(t("jobQueued"));
        toast.loading(
          operation === "refine-copy"
            ? workspaceT("aiImproveWithAiTitle")
            : workspaceT("aiAddWithAiTitle"),
          {
            description: workspaceT("aiProcessingContent"),
            duration: Number.POSITIVE_INFINITY,
            id: `ai-workflow-${portalId}`,
          },
        );
        const job = await waitForAiWorkflowJob(result.jobId);
        if (!job.proposal) throw new Error("proposal_error");
        result.proposal = job.proposal;
      }
      if (!result.proposal) throw new Error("proposal_error");
      setProposal(result.proposal);
    } catch {
      setProposalError(true);
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyProposal() {
    if (!proposal || !currentDocument || applying) return;
    const requestId = proposalRequestId ?? createRandomId();
    setApplying(true);
    setApplyError(false);
    try {
      const response = await fetch("/api/ai/portal-operations", {
        body: JSON.stringify({
          operation,
          portalId,
          proposedDocument: proposal.proposedDocument,
          requestId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("apply_failed");
      if (response.status !== 202) {
        router.refresh();
      }
      await queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey });
      setOpen(false);
    } catch {
      setApplyError(true);
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      {!triggerless ? (
        <Button
          className="rounded-lg"
          onClick={() => {
            if (
              creditData &&
              !canAffordAiOperation(creditData.available, "improve-project")
            ) {
              toast.warning(t("insufficientCredits"));
              return;
            }
            clearFiles();
            setOperation("improve-project");
            setApplyImmediately(true);
            setAnalyzed(false);
            setOpen(true);
          }}
          size="sm"
        >
          <IconFileUpload data-icon="inline-start" /> {t("uploadNewFiles")}
        </Button>
      ) : null}
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetContent
          className="w-full overflow-y-auto sm:max-w-xl"
          side="right"
        >
          <SheetHeader>
            <SheetTitle>{t("uploadTitle")}</SheetTitle>
            <SheetDescription>{t("uploadDescription")}</SheetDescription>
          </SheetHeader>
          <FieldGroup className="px-4 pb-4">
            <Field>
              <FieldLabel className="sr-only" htmlFor="portal-ai-files">
                {t("filesLabel")}
              </FieldLabel>
              <div className="flex flex-col gap-3">
                <label
                  className={`relative flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed p-6 pt-14 text-center transition-colors ${canAffordOperation ? "cursor-pointer hover:bg-accent/50" : "cursor-not-allowed opacity-60"} data-[dragging=true]:bg-accent/50`}
                  data-dragging={isDragging || undefined}
                  onDragEnter={canAffordOperation ? handleDragEnter : undefined}
                  onDragLeave={canAffordOperation ? handleDragLeave : undefined}
                  onDragOver={canAffordOperation ? handleDragOver : undefined}
                  onDrop={canAffordOperation ? handleDrop : undefined}
                  htmlFor="portal-ai-files"
                >
                  <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{t("filesAdded", { count: files.length })}</span>
                    <span className="font-medium text-foreground">
                      {t("addWithAi")}
                    </span>
                  </div>
                  <input
                    {...getInputProps()}
                    aria-label={t("filesLabel")}
                    className="sr-only"
                    disabled={!canAffordOperation}
                    id="portal-ai-files"
                    multiple
                  />
                  <span className="mb-3 flex size-11 items-center justify-center rounded-full border bg-background">
                    <IconUpload className="size-5 text-muted-foreground" />
                  </span>
                  <p className="font-medium">{t("uploadPrompt")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("uploadDetails")}
                  </p>
                </label>
                {selectedFiles.length > 0 ? (
                  <div className="scroll-fade-y max-h-72 overflow-y-auto">
                    <ul
                      aria-label={t("filesLabel")}
                      className="flex flex-col gap-2"
                    >
                      {selectedFiles.map(({ file, id, preview }) => (
                        <li key={id}>
                          <Attachment className="w-full">
                            <AttachmentMedia
                              variant={preview ? "image" : "icon"}
                            >
                              {preview ? (
                                <Image
                                  alt=""
                                  height={40}
                                  src={preview}
                                  unoptimized
                                  width={40}
                                />
                              ) : (
                                <IconFile />
                              )}
                            </AttachmentMedia>
                            <AttachmentContent>
                              <AttachmentTitle>{file.name}</AttachmentTitle>
                              <AttachmentDescription>
                                {file.type || t("file")} ·{" "}
                                {Math.max(1, Math.round(file.size / 1024))} KB
                              </AttachmentDescription>
                            </AttachmentContent>
                            <AttachmentActions>
                              <AttachmentAction
                                aria-label={`${t("remove")} ${file.name}`}
                                onClick={() => removeFile(id)}
                              >
                                <IconX />
                              </AttachmentAction>
                            </AttachmentActions>
                          </Attachment>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {fileErrors.length > 0 ? (
                  <div
                    className="flex items-start gap-2 text-xs text-destructive"
                    role="alert"
                  >
                    <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{fileErrors[0]}</span>
                  </div>
                ) : null}
              </div>
            </Field>
            {analyzed ? (
              <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <IconCheck /> {t("proposalReady")}
                </div>
                <p className="text-muted-foreground">
                  {t("proposalDescription")}
                </p>
                {proposal ? (
                  <>
                    <Badge variant="outline">
                      {t("proposalSummary", {
                        quarantine: proposal.quarantinedAssets.length,
                        sections: proposal.proposedDocument.sections.length,
                      })}
                    </Badge>
                    {operation === "refine-copy" && currentDocument ? (
                      <div className="flex flex-col gap-2 rounded-md border bg-background p-3 text-xs">
                        <p className="font-medium">{t("copyPreview")}</p>
                        {proposal.proposedDocument.sections.map((section) => {
                          const current = currentDocument.sections.find(
                            (item) => item.id === section.id,
                          );
                          if (
                            !current ||
                            (current.title === section.title &&
                              current.description === section.description)
                          ) {
                            return null;
                          }
                          return (
                            <div
                              className="flex flex-col gap-1"
                              key={section.id}
                            >
                              <span className="font-medium">
                                {section.title}
                              </span>
                              <span className="text-muted-foreground">
                                {section.description}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {proposal.quarantinedAssets.length > 0 ? (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                        <p className="font-medium">{t("quarantineTitle")}</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                          {proposal.quarantinedAssets.map((asset) => (
                            <li
                              className="flex items-center justify-between gap-2"
                              key={asset.assetId}
                            >
                              <span>
                                {asset.assetId} · {asset.reason} ·{" "}
                                {asset.confidence}
                              </span>
                              <span className="flex shrink-0 gap-1">
                                <Button
                                  onClick={() =>
                                    void decideQuarantine(
                                      asset.assetId,
                                      "include",
                                    )
                                  }
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {t("quarantineKeep")}
                                </Button>
                                <Button
                                  onClick={() =>
                                    void decideQuarantine(
                                      asset.assetId,
                                      "exclude",
                                    )
                                  }
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  {t("quarantineExclude")}
                                </Button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {proposal.warnings.length > 0 ? (
                      <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-400">
                        {proposal.warnings.map((warning) => (
                          <li key={`${warning.code}-${warning.message}`}>
                            {warning.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
            {proposalError ? (
              <p className="text-sm text-destructive">{t("proposalError")}</p>
            ) : null}
            {applyError ? (
              <p className="text-sm text-destructive">
                {t("applyError")}
                {applyErrorCode ? ` Code: ${applyErrorCode}` : ""}
              </p>
            ) : null}
          </FieldGroup>
          <SheetFooter>
            <Button onClick={() => setOpen(false)} variant="outline">
              {t("cancel")}
            </Button>
            <Button
              disabled={
                (operation !== "refine-copy" && files.length === 0) ||
                analyzing ||
                applying ||
                analyzed ||
                !canAffordOperation
              }
              onClick={() => void analyze()}
            >
              {analyzing ? <IconLoader2 className="animate-spin" /> : null}
              {analyzing
                ? t("analyzing")
                : applyImmediately
                  ? t("analyzeAndApply")
                  : t("analyzeAndPreview")}
            </Button>
            {analyzed ? (
              <Button disabled={applying} onClick={() => void applyProposal()}>
                {applying ? <IconLoader2 className="animate-spin" /> : null}
                {applying
                  ? t("applying")
                  : t("apply", { count: proposal?.creditCost ?? 3 })}
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
