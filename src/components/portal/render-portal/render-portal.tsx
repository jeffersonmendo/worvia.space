"use client";

import { isSortableOperation } from "@dnd-kit/dom/sortable";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { updatePortalDocument } from "@/app/[locale]/_actions/portals";
import {
  PORTAL_PLAN_RETRY_EVENT,
  useOptionalPortalPlan,
} from "@/components/portal/portal-plan-provider";
import {
  SectionActionToolbar,
  SectionContentEditor,
  SectionTypeDialog,
} from "@/components/portal/portal-workspace-controls";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { SafePendingPortalAction } from "@/lib/billing/portal-plan-client";
import { withStablePortalAssetPreviews } from "@/lib/portal/asset-preview-reference";
import {
  acknowledgePortalAutosaveConflict,
  ensurePortalAutosave,
  flushPortalAutosave,
  releasePortalAutosave,
  retryPortalAutosaveConflict,
  schedulePortalAutosave,
} from "@/lib/portal/autosave-coordinator";
import { AutosaveQueue } from "@/lib/portal/autosave-queue";
import {
  createPortalSection,
  hasPublicSectionContent,
  moveImageBetweenPortalSections,
  orderDocumentItemsForRender,
  type PortalDocument,
  type PortalSection,
  type PortalSectionType,
} from "@/lib/portal/document";
import { usePortalEditorStore } from "@/lib/portal/editor-store";
import {
  type PortalExportSource,
  portalExportHref,
} from "@/lib/portal/export-manifest";
import { deleteManagedPortalAsset } from "@/lib/portal/portal-assets-client";
import {
  PortalDocumentConflictError,
  persistPortalDocumentAtLatestRevision,
} from "@/lib/portal/revisioned-autosave";
import {
  focusPortalSectionTitle,
  scrollToPortalSection,
} from "@/lib/portal/scroll-to-section";
import { cn } from "@/lib/utils";
import {
  PortalActionButtons,
  PortalActionTriggerButton,
  PortalGlobalActionsOverlay,
  PortalSectionActionsToolbar,
} from "./portal-actions";
import { PortalSectionVisual } from "./portal-section-visuals";
import { PortalShell } from "./portal-shell";
import type {
  PortalAction,
  PortalPublicActionConfig,
  PortalRenderActions,
  RenderPortalProps,
} from "./types";

function compactActions(actions: PortalAction[] | undefined) {
  return (actions ?? []).filter(Boolean);
}

function reindex<T extends { position: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, position: index }));
}

function portalAssetIds(document: PortalDocument) {
  const ids = new Set<string>();
  for (const section of document.sections) {
    const items = [
      section.content.image,
      ...(section.content.images ?? []),
      ...(section.content.fonts ?? []),
      ...(section.content.files ?? []),
    ];
    for (const item of items) {
      if (item?.asset_id) ids.add(item.asset_id);
    }
  }
  return ids;
}

function removeAssetIds(ids: Iterable<string>, portalId: string) {
  for (const assetId of ids) {
    void deleteManagedPortalAsset(assetId, fetch, portalId).catch(() => {
      // Server reconciliation remains the fallback if immediate cleanup fails.
    });
  }
}

function itemDownloadHref(slug: string, itemId: string) {
  return `/api/portals/${encodeURIComponent(slug)}/assets/${encodeURIComponent(itemId)}`;
}

function sectionExportHref(
  slug: string,
  sectionId: string,
  exportSource?: PortalExportSource,
) {
  const params = new URLSearchParams({ section: sectionId });
  if (exportSource === "editor") params.set("source", exportSource);
  return `/api/portals/${encodeURIComponent(slug)}/export?${params.toString()}`;
}

function fontFamilyExportHref(
  slug: string,
  sectionId: string,
  fontFamily: string,
  exportSource?: PortalExportSource,
) {
  const params = new URLSearchParams({ fontFamily, section: sectionId });
  if (exportSource === "editor") params.set("source", exportSource);
  return `/api/portals/${encodeURIComponent(slug)}/export?${params.toString()}`;
}

function hasDownloadReference(value: {
  file_url?: string;
  storage_path?: string;
}) {
  return Boolean(value.storage_path || value.file_url);
}

function buildPublicActions({
  copy,
  exportSource,
  slots,
  slug,
}: PortalPublicActionConfig & {
  copy: {
    copied: string;
    copyColor: (color: string) => string;
    downloadFile: (name: string) => string;
    downloadFont: (name: string) => string;
    downloadImage: (name: string) => string;
    downloadSection: (name: string) => string;
    exportAll: string;
    imageFallback: string;
    sectionType: (type: PortalSectionType) => string;
  };
}): PortalRenderActions {
  return {
    color: ({ item }) =>
      slots.item?.color?.copy
        ? [
            {
              feedbackLabel: copy.copied,
              icon: "copy",
              id: `copy-${item.id}`,
              label: copy.copyColor(item.color_code),
              onClick: () => copyText(item.color_code),
            },
          ]
        : [],
    file: ({ item }) =>
      slots.item?.file?.download &&
      item.allow_download &&
      hasDownloadReference(item)
        ? [
            {
              download: true,
              href: itemDownloadHref(slug, item.id),
              icon: "download",
              id: `download-${item.id}`,
              label: copy.downloadFile(item.display_name || item.file_name),
            },
          ]
        : [],
    font: ({ item, section }) =>
      slots.item?.font?.download &&
      section.allow_download &&
      hasDownloadReference(item)
        ? [
            {
              download: true,
              href: fontFamilyExportHref(
                slug,
                section.id,
                item.font_name,
                exportSource,
              ),
              icon: "download",
              id: `download-font-family-${section.id}-${item.font_name}`,
              label: copy.downloadFont(item.font_name),
            },
          ]
        : [],
    global: () =>
      slots.global?.exportAssets
        ? [
            {
              download: true,
              href: portalExportHref(slug, exportSource),
              icon: "export",
              id: "export-all",
              label: copy.exportAll,
              size: "icon-lg",
              variant: "ghost",
            },
          ]
        : [],
    image: ({ item, section }) =>
      slots.item?.image?.download &&
      section.allow_download &&
      item.allow_download
        ? [
            {
              download: true,
              href: itemDownloadHref(slug, item.id),
              icon: "download",
              id: `download-${item.id}`,
              label: copy.downloadImage(
                item.display_name || item.alt_text || copy.imageFallback,
              ),
            },
          ]
        : [],
    section: (section) => {
      return slots.section?.download &&
        section.allow_download &&
        section.type !== "text"
        ? [
            {
              download: true,
              href: sectionExportHref(slug, section.id, exportSource),
              icon: "download",
              id: `download-section-${section.id}`,
              label: copy.downloadSection(
                section.title || copy.sectionType(section.type),
              ),
              variant: "ghost",
            },
          ]
        : [];
    },
  };
}

function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function PortalSummary({
  document,
  editable,
  onPortalChange,
}: {
  document: PortalDocument;
  editable?: boolean;
  onPortalChange: (portal: Partial<PortalDocument["portal"]>) => void;
}) {
  const t = useTranslations("PortalViewer.summary");
  const portal = document.portal;

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <Input
          aria-label={t("name")}
          autoComplete="off"
          className={cn(
            "border-none bg-transparent! px-0 text-2xl! font-medium shadow-none focus-visible:ring-0",
            !editable && "pointer-events-none",
          )}
          data-portal-editor-field
          data-portal-name
          onChange={(event) =>
            editable && onPortalChange({ name: event.currentTarget.value })
          }
          placeholder={editable ? t("namePlaceholder") : undefined}
          readOnly={!editable}
          tabIndex={editable ? undefined : -1}
          value={portal.name}
        />
      </Field>
      <Field>
        <Textarea
          aria-label={t("description")}
          autoComplete="off"
          className={cn(
            "resize-none whitespace-pre-wrap border-none bg-transparent! px-0 text-muted-foreground shadow-none focus-visible:ring-0",
            !editable && "pointer-events-none",
          )}
          data-portal-editor-field
          maxLength={500}
          onChange={(event) =>
            editable &&
            onPortalChange({ description: event.currentTarget.value })
          }
          placeholder={editable ? t("descriptionPlaceholder") : undefined}
          readOnly={!editable}
          rows={2}
          tabIndex={editable ? undefined : -1}
          value={portal.description ?? ""}
        />
      </Field>
    </div>
  );
}

function PortalSectionHeading({
  actions,
  controls,
  editable,
  onSectionTitleChange,
  section,
}: {
  actions: PortalAction[];
  controls?: ReactNode;
  editable?: boolean;
  onSectionTitleChange?: (
    patch: Partial<
      Pick<
        RenderPortalProps["document"]["sections"][number],
        "description" | "title"
      >
    >,
  ) => void;
  section: RenderPortalProps["document"]["sections"][number];
}) {
  const t = useTranslations("PortalViewer.section");
  const sectionTypeT = useTranslations("PortalViewer.sectionTypes");
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        {editable ? (
          <input
            autoComplete="off"
            className="w-full border-none bg-transparent px-0 font-heading font-medium text-lg text-primary! tracking-tight outline-none placeholder:text-muted-foreground"
            data-portal-section-title
            data-portal-editor-field
            maxLength={70}
            minLength={1}
            onChange={(event) =>
              onSectionTitleChange?.({ title: event.currentTarget.value })
            }
            placeholder={t("titlePlaceholder")}
            value={section.title}
          />
        ) : section.title ? (
          <h2 className="px-0 font-heading font-medium text-lg text-primary tracking-tight">
            {section.title}
          </h2>
        ) : (
          <span />
        )}
        {actions.length || controls ? (
          <PortalSectionActionsToolbar>
            <PortalActionButtons actions={actions} />
            {controls}
          </PortalSectionActionsToolbar>
        ) : null}
      </div>
      {editable ? (
        <Textarea
          autoComplete="off"
          className="resize-none border-none bg-transparent! px-0 text-muted-foreground text-sm shadow-none outline-none focus-visible:ring-0"
          data-portal-editor-field
          maxLength={1500}
          onChange={(event) =>
            onSectionTitleChange?.({
              description: event.currentTarget.value,
            })
          }
          placeholder={t("descriptionPlaceholder")}
          value={section.description}
        />
      ) : section.description ? (
        <Textarea
          aria-label={t("descriptionLabel", {
            title: section.title || sectionTypeT(section.type),
          })}
          className="pointer-events-none resize-none whitespace-pre-wrap border-none bg-transparent! px-0 text-muted-foreground text-sm shadow-none outline-none focus-visible:ring-0"
          readOnly
          tabIndex={-1}
          value={section.description}
        />
      ) : null}
      {section.content.body_md ? (
        <p className="whitespace-pre-wrap text-sm">{section.content.body_md}</p>
      ) : null}
    </div>
  );
}

export type PortalBrandFooterProps = Pick<
  RenderPortalProps,
  "actionConfig" | "editor"
> & {
  brand: string;
  credit: string;
};

export function PortalBrandFooter({
  actionConfig,
  brand,
  credit,
  editor,
}: PortalBrandFooterProps) {
  if (!actionConfig?.public || editor) return null;

  return (
    <footer className="flex justify-center lg:col-start-2">
      <p className="text-sm text-muted-foreground">
        {credit}{" "}
        <Link
          className="underline underline-offset-4 transition-colors hover:text-blue-600"
          href="/"
        >
          {brand}
        </Link>
      </p>
    </footer>
  );
}

export function RenderPortal({
  actionConfig,
  className,
  contentClassName,
  document,
  editable = false,
  editor,
  sidebar,
  visibility,
}: RenderPortalProps) {
  const t = useTranslations();
  const router = useRouter();
  const storeDocument = usePortalEditorStore((state) =>
    editor ? state.documentsByPortalId[editor.portalId] : undefined,
  );
  const hydrateDocument = usePortalEditorStore(
    (state) => state.hydrateDocument,
  );
  const setAutosaveState = usePortalEditorStore(
    (state) => state.setAutosaveState,
  );
  const resetAutosaveState = usePortalEditorStore(
    (state) => state.resetAutosaveState,
  );
  const markDocumentPersisted = usePortalEditorStore(
    (state) => state.markDocumentPersisted,
  );
  const updateStoreDocument = usePortalEditorStore(
    (state) => state.updateDocument,
  );
  const pendingSectionIdRef = useRef<string | null>(null);
  const pendingAssetDeletionIdsRef = useRef(new Map<string, Set<string>>());
  const editorLocale = editor?.locale;
  const editorPortalId = editor?.portalId;
  const portalPlan = useOptionalPortalPlan();

  const queueAssetDeletions = useCallback(function queueAssetDeletions(
    portalId: string,
    removedAssetIds: Iterable<string>,
    retainedAssetIds: ReadonlySet<string>,
  ) {
    const pending =
      pendingAssetDeletionIdsRef.current.get(portalId) ?? new Set<string>();
    for (const assetId of retainedAssetIds) pending.delete(assetId);
    for (const assetId of removedAssetIds) pending.add(assetId);
    if (pending.size > 0) {
      pendingAssetDeletionIdsRef.current.set(portalId, pending);
    } else {
      pendingAssetDeletionIdsRef.current.delete(portalId);
    }
  }, []);

  const flushPersistedAssetDeletions = useCallback(
    function flushPersistedAssetDeletions(
      portalId: string,
      persistedDocument: PortalDocument,
    ) {
      const pending = pendingAssetDeletionIdsRef.current.get(portalId);
      if (!pending?.size) return;

      const persistedAssets = portalAssetIds(persistedDocument);
      const latestDocument =
        usePortalEditorStore.getState().documentsByPortalId[portalId];
      const latestAssets = latestDocument
        ? portalAssetIds(latestDocument)
        : persistedAssets;
      const safeToDelete = [...pending].filter(
        (assetId) =>
          !persistedAssets.has(assetId) && !latestAssets.has(assetId),
      );
      for (const assetId of safeToDelete) pending.delete(assetId);
      if (pending.size === 0) {
        pendingAssetDeletionIdsRef.current.delete(portalId);
      }
      removeAssetIds(safeToDelete, portalId);
    },
    [],
  );

  useEffect(() => {
    if (!editorLocale || !editorPortalId) return;
    ensurePortalAutosave(editorPortalId, ({ hasPredecessor }) => {
      if (!hasPredecessor) resetAutosaveState(editorPortalId);
      return new AutosaveQueue<PortalDocument>({
        delay: 700,
        onStatusChange: (status, error) => {
          if (error) {
            console.error("Portal autosave failed", {
              error,
              portalId: editorPortalId,
            });
          }
          setAutosaveState(editorPortalId, {
            error: error ? "autosave_failed" : null,
            status,
          });
        },
        save: async (nextDocument) => {
          await persistPortalDocumentAtLatestRevision({
            acknowledge: (revision) => {
              markDocumentPersisted(editorPortalId, revision);
              flushPersistedAssetDeletions(editorPortalId, nextDocument);
            },
            document: nextDocument,
            getExpectedRevision: () =>
              usePortalEditorStore.getState().documentServerRevisionByPortalId[
                editorPortalId
              ] ?? null,
            persist: async (value, expectedRevision) => {
              const fd = new FormData();
              fd.set("locale", editorLocale);
              fd.set("portal_id", editorPortalId);
              fd.set("document_json", JSON.stringify(value));
              if (expectedRevision !== null) {
                fd.set("expected_revision", String(expectedRevision));
              }
              return await updatePortalDocument(fd);
            },
            reconcileConflict: () => {
              toast.warning(t("PortalEditor.autosave.conflict"), {
                action: {
                  label: t("PortalEditor.autosave.conflictRetry"),
                  onClick: () => {
                    const recovery =
                      retryPortalAutosaveConflict<PortalDocument>(
                        editorPortalId,
                      );
                    if (!recovery) {
                      router.refresh();
                      return;
                    }
                    updateStoreDocument(editorPortalId, () => recovery);
                    void flushPortalAutosave(editorPortalId)
                      .then(() =>
                        toast.dismiss(
                          `portal-autosave-conflict:${editorPortalId}`,
                        ),
                      )
                      .catch(() => {
                        // A repeated conflict keeps the recovery action visible.
                      });
                  },
                },
                description: t("PortalEditor.autosave.conflictDescription"),
                duration: Number.POSITIVE_INFINITY,
                id: `portal-autosave-conflict:${editorPortalId}`,
              });
              setTimeout(() => router.refresh(), 0);
            },
          });
        },
        shouldRetry: (error) => !(error instanceof PortalDocumentConflictError),
      });
    });
    return () => releasePortalAutosave(editorPortalId);
  }, [
    editorLocale,
    editorPortalId,
    flushPersistedAssetDeletions,
    resetAutosaveState,
    markDocumentPersisted,
    router,
    setAutosaveState,
    t,
    updateStoreDocument,
  ]);

  useEffect(() => {
    if (!editorPortalId) return;
    const stateBeforeHydration = usePortalEditorStore.getState();
    const priorServerRevision =
      stateBeforeHydration.documentServerRevisionByPortalId[editorPortalId];
    hydrateDocument(
      editorPortalId,
      withStablePortalAssetPreviews(document, editor?.slug ?? ""),
      editor?.documentRevision,
      editor?.hasUnpublishedChanges,
    );
    if (
      stateBeforeHydration.autosaveByPortalId[editorPortalId]?.status ===
        "conflict" &&
      editor?.documentRevision != null &&
      (priorServerRevision === undefined ||
        editor.documentRevision > priorServerRevision) &&
      usePortalEditorStore.getState().documentServerRevisionByPortalId[
        editorPortalId
      ] === editor.documentRevision
    ) {
      acknowledgePortalAutosaveConflict(editorPortalId);
    }
  }, [
    document,
    editor?.documentRevision,
    editor?.hasUnpublishedChanges,
    editor?.slug,
    editorPortalId,
    hydrateDocument,
  ]);

  const activeDocument = editor ? (storeDocument ?? document) : document;

  function changeEditableDocument(
    update: (current: PortalDocument) => PortalDocument,
    options: {
      flush?: boolean;
      retry?: SafePendingPortalAction;
    } = {},
  ) {
    if (!editor) return;
    const current =
      usePortalEditorStore.getState().documentsByPortalId[editor.portalId] ??
      document;
    const candidate = update(current);
    const currentAssets = portalAssetIds(current);
    const candidateAssets = portalAssetIds(candidate);
    if (
      portalPlan &&
      !portalPlan.guardDocumentChange(current, candidate, options.retry)
    ) {
      removeAssetIds(
        [...candidateAssets].filter((assetId) => !currentAssets.has(assetId)),
        editor.portalId,
      );
      return;
    }
    const next = updateStoreDocument(editor.portalId, () => candidate);
    if (next) {
      queueAssetDeletions(
        editor.portalId,
        [...currentAssets].filter((assetId) => !candidateAssets.has(assetId)),
        candidateAssets,
      );
      schedulePortalAutosave(editor.portalId, next);
      if (options.flush) {
        void flushPortalAutosave(editor.portalId).catch(() => {
          // Autosave retains the failed snapshot and exposes its retry UI.
        });
      }
    }
  }

  function saveEditablePortal(patch: Partial<PortalDocument["portal"]>) {
    changeEditableDocument((current) => ({
      ...current,
      portal: { ...current.portal, ...patch },
    }));
  }

  function updateEditableSection(nextSection: PortalSection) {
    if (!editor) return;
    changeEditableDocument(
      (current) => ({
        ...current,
        sections: current.sections.map((section) =>
          section.id === nextSection.id ? nextSection : section,
        ),
      }),
      { flush: true },
    );
  }

  function moveEditableImage(event: DragEndEvent) {
    if (!isSortableOperation(event.operation)) return;
    const { source, target } = event.operation;
    if (
      !editor ||
      event.canceled ||
      !target ||
      !source ||
      source.initialGroup == null ||
      target.group == null ||
      typeof target.index !== "number"
    ) {
      return;
    }

    const targetSectionId = String(target.group);
    const targetSection = activeDocument.sections.find(
      (section) => section.id === targetSectionId,
    );
    if (
      !targetSection ||
      (targetSection.type !== "gallery" &&
        targetSection.type !== "image_comparison")
    ) {
      return;
    }
    const maxTargetImages =
      targetSection.type === "image_comparison" ||
      targetSection.layout.mode === "comparison"
        ? 2
        : portalPlan?.status === "ready"
          ? (portalPlan.snapshot.policy.sections.gallery?.items ??
            Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY;
    const isCrossSectionMove = String(source.initialGroup) !== targetSectionId;
    if (
      isCrossSectionMove &&
      (targetSection.content.images?.length ?? 0) >= maxTargetImages
    ) {
      if (targetSection.type === "gallery") {
        portalPlan?.requestUpgrade("gallery_items");
      }
      return;
    }

    changeEditableDocument(
      (current) =>
        moveImageBetweenPortalSections(current, {
          imageId: String(source.id),
          maxTargetImages,
          sourceSectionId: String(source.initialGroup),
          targetIndex: target.index,
          targetSectionId,
        }),
      { flush: true },
    );
  }

  function updateEditableSectionHeading(
    sectionId: string,
    patch: Partial<Pick<PortalSection, "description" | "title">>,
  ) {
    changeEditableDocument((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section,
      ),
    }));
  }

  function removeEditableSection(sectionId: string) {
    if (!editor) return;
    changeEditableDocument((current) => ({
      ...current,
      sections: reindex(
        current.sections.filter((section) => section.id !== sectionId),
      ),
    }));
  }

  function addEditableSection(
    type: Exclude<PortalSectionType, "empty"> = "text",
  ) {
    if (!editor) return;
    changeEditableDocument(
      (current) => {
        const section = createPortalSection(type, current.sections.length);
        pendingSectionIdRef.current = section.id;
        return {
          ...current,
          sections: [...current.sections, section],
        };
      },
      { retry: { kind: "add-section", type } },
    );
  }

  useEffect(() => {
    if (!editor) return;
    const retry = (event: Event) => {
      const action = (event as CustomEvent<SafePendingPortalAction>).detail;
      if (action.kind === "add-section") addEditableSection(action.type);
    };
    window.addEventListener(PORTAL_PLAN_RETRY_EVENT, retry);
    return () => window.removeEventListener(PORTAL_PLAN_RETRY_EVENT, retry);
  });

  function activatePendingSection() {
    const sectionId = pendingSectionIdRef.current;
    if (!sectionId) return;
    pendingSectionIdRef.current = null;
    scrollToPortalSection(sectionId);
    focusPortalSectionTitle(sectionId);
  }

  useEffect(() => {
    if (!editor?.focus) return;
    scrollToPortalSection(editor.focus);
    focusPortalSectionTitle(editor.focus);
  }, [editor?.focus]);

  const renderDocument = editor
    ? orderDocumentItemsForRender(activeDocument)
    : activeDocument;

  const visibleSections = renderDocument.sections.filter((section) => {
    if (!visibility?.showHiddenSections && !section.visible) return false;
    if (!visibility?.showEmptySections && section.type === "empty")
      return false;
    if (visibility?.requireContent && !hasPublicSectionContent(section)) {
      return false;
    }
    return true;
  });
  const renderActions = actionConfig?.public
    ? buildPublicActions({
        ...actionConfig.public,
        copy: {
          copied: t("PortalViewer.actions.copied"),
          copyColor: (color) => t("PortalViewer.actions.copyColor", { color }),
          downloadFile: (name) =>
            t("PortalViewer.actions.downloadFile", { name }),
          downloadFont: (name) =>
            t("PortalViewer.actions.downloadFont", { name }),
          downloadImage: (name) =>
            t("PortalViewer.actions.downloadImage", { name }),
          downloadSection: (name) =>
            t("PortalViewer.actions.downloadSection", { name }),
          exportAll: t("PortalViewer.actions.exportAll"),
          imageFallback: t("PortalViewer.actions.imageFallback"),
          sectionType: (type) => t(`PortalViewer.sectionTypes.${type}`),
        },
      })
    : undefined;
  const globalActions = compactActions(renderActions?.global?.());

  return (
    <PortalShell className={className} sidebar={sidebar}>
      <section
        className={cn("relative flex flex-col gap-10 pb-40", contentClassName)}
      >
        {globalActions.length ? (
          <PortalGlobalActionsOverlay>
            <PortalActionButtons actions={globalActions} />
          </PortalGlobalActionsOverlay>
        ) : null}
        <PortalSummary
          document={renderDocument}
          editable={editable}
          onPortalChange={saveEditablePortal}
        />
        <DragDropProvider onDragEnd={moveEditableImage}>
          <div className="flex flex-col gap-30 pt-10">
            {visibleSections.map((section) => (
              <section
                className="group/section relative flex scroll-mt-8 flex-col gap-4 p-0"
                id={section.id}
                key={section.id}
              >
                <PortalSectionHeading
                  actions={compactActions(renderActions?.section?.(section))}
                  controls={
                    editor ? (
                      <SectionActionToolbar
                        onRemove={() => removeEditableSection(section.id)}
                        portalId={editor.portalId}
                        section={section}
                        updateSection={updateEditableSection}
                      />
                    ) : null
                  }
                  editable={editable}
                  onSectionTitleChange={(patch) =>
                    updateEditableSectionHeading(section.id, patch)
                  }
                  section={section}
                />
                {editor ? (
                  <SectionContentEditor
                    portalId={editor.portalId}
                    portalSlug={editor.slug ?? ""}
                    section={section}
                    updateSection={updateEditableSection}
                  />
                ) : (
                  <PortalSectionVisual
                    actions={renderActions}
                    section={section}
                  />
                )}
              </section>
            ))}
          </div>
        </DragDropProvider>
        {editor ? (
          <div className="mx-auto mt-10">
            <SectionTypeDialog
              openRequestKey="portal-add-section"
              onSelect={addEditableSection}
              onSelectComplete={activatePendingSection}
              trigger={
                <PortalActionTriggerButton
                  data-portal-add-section
                  icon="plus"
                  label={t("PortalEditor.sections.add")}
                  size="icon-lg"
                  variant="outline"
                />
              }
            />
          </div>
        ) : null}
      </section>
      <PortalBrandFooter
        actionConfig={actionConfig}
        brand={t("PortalViewer.branding.brand")}
        credit={t("PortalViewer.branding.credit")}
        editor={editor}
      />
    </PortalShell>
  );
}
