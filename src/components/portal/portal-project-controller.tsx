"use client";

import {
  IconAdjustmentsHorizontalFilled,
  IconColorSwatch,
  IconFileUpload,
  IconPalette,
  IconPencil,
  IconPhotoPlus,
  IconTypography,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useOptionalWorkspaceConfigSidebar } from "@/app/[locale]/(workspace)/_components/workspace-sidebar";
import {
  flushPortalAutosave,
  schedulePortalAutosave,
} from "@/application/portal/autosave-coordinator";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import { applyLocalDocumentUpdate } from "@/application/portal/local-editor";
import {
  portalAssetIds,
  removePortalAssetIds,
} from "@/application/portal/portal-asset-lifecycle";
import {
  applyRenderProjectDocument,
  portalDocumentToRenderProject,
} from "@/application/portal/portal-document-adapter";
import {
  movePortalItem,
  removePortalSection,
} from "@/application/portal/portal-editor-operations";
import { useOptionalPortalPlan } from "@/components/portal/portal-plan-provider";
import { VisualColorPicker } from "@/components/portal/visual-color-picker";
import { RenderProject } from "@/components/render/render-project";
import type {
  RenderProjectData,
  RenderProjectHandle,
  RenderProjectUi,
  SelectedAsset,
} from "@/components/render/visual-model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PortalDocument } from "@/domain/portal/document";
import {
  shouldUseServerOwnedUpload,
  uploadManagedPortalAsset,
  uploadManagedPortalAssetServerOwned,
} from "@/infrastructure/portal/portal-assets-client";
import type { SafePendingPortalAction } from "@/lib/billing/portal-plan-client";
import { recoverExpectedPortalAssetUploadRejection } from "@/lib/portal/portal-asset-upload-rejection";
import {
  configPanelTargetKey,
  resetConfigPanelScroll,
} from "@/lib/portal/reset-config-panel-scroll";
import {
  focusPortalSectionTitle,
  scrollToPortalSection,
} from "@/lib/portal/scroll-to-section";
import { createRandomId } from "@/lib/random-id";
import { createClient } from "@/lib/supabase/client";
import {
  getPanelConfigCopy,
  PanelConfig,
  type PanelConfigKind,
} from "./panel-config";
import { collectionAvailabilityFor } from "./portal-collection-availability";
import type { PortalProjectControllerProps } from "./portal-project-types";
import { PortalShell } from "./portal-shell";
import { usePortalEditorPersistence } from "./use-portal-editor-persistence";

type EditorConfigTarget =
  | { kind: "section"; sectionId: string }
  | {
      kind: "image" | "color" | "font" | "file";
      itemId: string;
      sectionId: string;
    };

type ColorCreationDraft = {
  code: string;
  name: string;
};

const INITIAL_COLOR_CREATION_DRAFT: ColorCreationDraft = {
  code: "#FF0000",
  name: "",
};

const noop = () => {};

export function PortalProjectController({
  className,
  contentClassName,
  document,
  editor,
  localEditor,
  mode,
  sidebar,
  styleMode = "auto",
  visibility,
}: PortalProjectControllerProps) {
  const isEditorMode = mode === "editor";
  const isDemoMode = mode === "demo";
  const isInteractiveMode = isEditorMode || isDemoMode;
  const uploadT = useTranslations("PortalEditor.upload");
  const summaryT = useTranslations("PortalViewer.summary");
  const storeDocument = usePortalEditorStore((state) =>
    isEditorMode && editor
      ? state.documentsByPortalId[editor.portalId]
      : undefined,
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
  const [draftProject, setDraftProject] = useState<RenderProjectData | null>(
    null,
  );
  const renderProjectRef = useRef<RenderProjectHandle>(null);
  const [configTarget, setConfigTarget] = useState<EditorConfigTarget | null>(
    null,
  );
  const [colorCreationSectionId, setColorCreationSectionId] = useState<
    string | null
  >(null);
  const localDocumentRef = useRef(document);
  const pendingAssetDeletionIdsRef = useRef(new Map<string, Set<string>>());
  const editorLocale = editor?.locale;
  const editorPortalId = editor?.portalId;
  const portalPlan = useOptionalPortalPlan();
  const workspaceConfigSidebar = useOptionalWorkspaceConfigSidebar();
  const configDrawerCloseVersion =
    workspaceConfigSidebar?.configDrawerCloseVersion ?? 0;
  const configDrawerHost = workspaceConfigSidebar?.configDrawerHost ?? null;
  const configSidebarHost = workspaceConfigSidebar?.configSidebarHost ?? null;
  const setConfigDrawerHeader =
    workspaceConfigSidebar?.setConfigDrawerHeader ?? noop;
  const setConfigSidebarOpen =
    workspaceConfigSidebar?.setConfigSidebarOpen ?? noop;
  const configDrawerCloseVersionRef = useRef(configDrawerCloseVersion);

  useEffect(() => {
    localDocumentRef.current = document;
  }, [document]);

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
      removePortalAssetIds(safeToDelete, portalId);
    },
    [],
  );

  usePortalEditorPersistence({
    document,
    documentRevision: editor?.documentRevision,
    enabled: isEditorMode,
    flushPersistedAssetDeletions,
    hasUnpublishedChanges: editor?.hasUnpublishedChanges,
    hydrateDocument,
    locale: editorLocale,
    markDocumentPersisted,
    portalId: editorPortalId,
    resetAutosaveState,
    setAutosaveState,
    slug: editor?.slug,
    updateStoreDocument,
  });

  const activeDocument = isEditorMode ? (storeDocument ?? document) : document;

  function changeEditableDocument(
    update: (current: PortalDocument) => PortalDocument,
    options: {
      flush?: boolean;
      retry?: SafePendingPortalAction;
    } = {},
  ) {
    if (isDemoMode && localEditor) {
      applyLocalDocumentUpdate(
        localDocumentRef,
        localEditor.onDocumentChange,
        update,
      );
      return;
    }
    if (!isEditorMode || !editor) return;
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
      removePortalAssetIds(
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

  function removeEditableSection(sectionId: string) {
    if (!isEditorMode || !editor) return;
    changeEditableDocument((current) =>
      removePortalSection(current, sectionId),
    );
  }

  /**
   * Action callbacks intentionally mutate at the application boundary.  The
   * renderer receives only the resulting controlled snapshot and never learns
   * what an action id means.
   */
  function updateRenderSection(
    sectionId: string,
    update: (
      section: RenderProjectData["sections"][number],
    ) => RenderProjectData["sections"][number],
  ) {
    changeEditableDocument(
      (current) => {
        const currentProject = portalDocumentToRenderProject(current);
        return applyRenderProjectDocument(current, {
          ...currentProject,
          sections: currentProject.sections.map((section) =>
            section.id === sectionId ? update(section) : section,
          ),
        });
      },
      { flush: true },
    );
  }

  function removeRenderItem(
    sectionId: string,
    kind: "image" | "color" | "font" | "file",
    itemId: string,
  ) {
    updateRenderSection(sectionId, (section) => {
      if (kind === "image") {
        return {
          ...section,
          content: {
            ...section.content,
            image:
              section.content.image?.id === itemId
                ? null
                : section.content.image,
            images: section.content.images?.filter(
              (item) => item.id !== itemId,
            ),
          },
        };
      }
      const key =
        kind === "color" ? "colors" : kind === "font" ? "fonts" : "files";
      return {
        ...section,
        content: {
          ...section.content,
          [key]: section.content[key]?.filter((item) => item.id !== itemId),
        },
      };
    });
  }

  function changePanelConfiguration(
    target: EditorConfigTarget,
    values: {
      item?: object;
      layout?: object;
      section?: { visible?: boolean };
    },
  ) {
    updateRenderSection(target.sectionId, (section) => {
      if (target.kind === "section") {
        return {
          ...section,
          layout: { ...section.layout, ...values.layout },
          ...(values.section ?? {}),
        };
      }
      if (target.kind === "image") {
        const updateImage = (
          item: NonNullable<typeof section.content.image>,
        ) => ({ ...item, ...values.item });
        return {
          ...section,
          content: {
            ...section.content,
            image:
              section.content.image?.id === target.itemId
                ? updateImage(section.content.image)
                : section.content.image,
            images: section.content.images?.map((item) =>
              item.id === target.itemId ? updateImage(item) : item,
            ),
          },
        };
      }
      if (target.kind === "color") {
        return {
          ...section,
          content: {
            ...section.content,
            colors: section.content.colors?.map((item) => {
              if (item.id !== target.itemId) return item;
              return { ...item, ...values.item };
            }),
          },
        };
      }
      if (target.kind === "font") {
        return {
          ...section,
          content: {
            ...section.content,
            fonts: section.content.fonts?.map((item) => {
              if (item.id !== target.itemId) return item;
              return { ...item, ...values.item };
            }),
          },
        };
      }
      return {
        ...section,
        content: {
          ...section.content,
          files: section.content.files?.map((item) => {
            if (item.id !== target.itemId) return item;
            return { ...item, ...values.item };
          }),
        },
      };
    });
  }

  useEffect(() => {
    if (!editor?.focus) return;
    if (renderProjectRef.current?.focusSectionTitle(editor.focus)) return;
    scrollToPortalSection(editor.focus);
    focusPortalSectionTitle(editor.focus);
  }, [editor?.focus]);

  const renderDocument = activeDocument;

  function withoutPendingDrafts(project: RenderProjectData): RenderProjectData {
    return {
      ...project,
      sections: project.sections.map((section) => ({
        ...section,
        content: {
          ...section.content,
          image:
            section.content.image?.status === "pending"
              ? null
              : section.content.image,
          images: section.content.images?.filter(
            (item) =>
              item.status !== "pending" && !item.src.startsWith("blob:"),
          ),
          files: section.content.files?.filter(
            (item) =>
              item.status !== "pending" && !item.src.startsWith("blob:"),
          ),
          fonts: section.content.fonts?.filter(
            (item) => item.status !== "pending",
          ),
        },
      })),
    };
  }

  function replaceDraft(
    project: RenderProjectData,
    selected: SelectedAsset,
    uploaded: { assetId: string; path: string; previewUrl: string },
  ): RenderProjectData {
    return {
      ...project,
      sections: project.sections.map((section) =>
        section.id !== selected.sectionId
          ? section
          : {
              ...section,
              content: {
                ...section.content,
                image:
                  section.content.image?.draftId === selected.draftId
                    ? {
                        ...section.content.image,
                        assetId: uploaded.assetId,
                        draftId: undefined,
                        storagePath: uploaded.path,
                        src: uploaded.previewUrl,
                        status: "ready",
                      }
                    : section.content.image,
                images: section.content.images?.map((item) =>
                  item.draftId === selected.draftId
                    ? {
                        ...item,
                        assetId: uploaded.assetId,
                        draftId: undefined,
                        storagePath: uploaded.path,
                        src: uploaded.previewUrl,
                        status: "ready",
                      }
                    : item,
                ),
                files: section.content.files?.map((item) =>
                  item.draftId === selected.draftId
                    ? {
                        ...item,
                        assetId: uploaded.assetId,
                        draftId: undefined,
                        storagePath: uploaded.path,
                        src: uploaded.previewUrl,
                        status: "ready",
                      }
                    : item,
                ),
                fonts: section.content.fonts?.map((item) =>
                  item.draftId === selected.draftId
                    ? {
                        ...item,
                        assetId: uploaded.assetId,
                        draftId: undefined,
                        storagePath: uploaded.path,
                        src: uploaded.previewUrl,
                        status: "ready",
                      }
                    : item,
                ),
              },
            },
      ),
    };
  }

  function mergeCanonicalDraft(
    latest: RenderProjectData,
    source: RenderProjectData,
    selected: SelectedAsset,
    uploaded: { assetId: string; path: string; previewUrl: string },
  ) {
    const canonical = replaceDraft(source, selected, uploaded);
    const sourceSection = canonical.sections.find(
      (section) => section.id === selected.sectionId,
    );
    if (!sourceSection) return latest;
    return {
      ...latest,
      sections: latest.sections.map((section) => {
        if (section.id !== selected.sectionId) return section;
        if (selected.kind === "image") {
          if (sourceSection.type === "image")
            return {
              ...section,
              content: {
                ...section.content,
                image: sourceSection.content.image,
              },
            };
          const item = sourceSection.content.images?.find(
            (image) => image.assetId === uploaded.assetId,
          );
          return item
            ? {
                ...section,
                content: {
                  ...section.content,
                  images: [
                    ...(section.content.images ?? []).filter(
                      (image) => image.id !== item.id,
                    ),
                    item,
                  ],
                },
              }
            : section;
        }
        if (selected.kind === "file") {
          const item = sourceSection.content.files?.find(
            (file) => file.assetId === uploaded.assetId,
          );
          return item
            ? {
                ...section,
                content: {
                  ...section.content,
                  files: [
                    ...(section.content.files ?? []).filter(
                      (file) => file.id !== item.id,
                    ),
                    item,
                  ],
                },
              }
            : section;
        }
        const item = sourceSection.content.fonts?.find(
          (font) => font.assetId === uploaded.assetId,
        );
        return item
          ? {
              ...section,
              content: {
                ...section.content,
                fonts: [
                  ...(section.content.fonts ?? []).filter(
                    (font) => font.id !== item.id,
                  ),
                  item,
                ],
              },
            }
          : section;
      }),
    };
  }

  async function uploadSelectedAssets(assets: SelectedAsset[]) {
    if (!editor) return [];
    const storage = createClient().storage;
    return Promise.all(
      assets.map(async (selected) => {
        const category = selected.kind === "image" ? "gallery" : selected.kind;
        const uploaded = shouldUseServerOwnedUpload(selected.file.size)
          ? await uploadManagedPortalAssetServerOwned({
              category,
              file: selected.file,
              portalId: editor.portalId,
            })
          : await uploadManagedPortalAsset({
              category,
              file: selected.file,
              portalId: editor.portalId,
              storage,
            });
        return { selected, uploaded };
      }),
    );
  }

  const project = draftProject ?? portalDocumentToRenderProject(renderDocument);
  const collectionAvailability = collectionAvailabilityFor(
    project,
    portalPlan?.status === "ready" ? portalPlan.snapshot.policy : undefined,
  );

  const ui: RenderProjectUi = {
    className: "min-w-0 flex-1 pb-40",
    contentClassName,
    labels: {
      descriptionLabel: summaryT("description"),
      descriptionPlaceholder: summaryT("descriptionPlaceholder"),
      nameLabel: summaryT("name"),
      namePlaceholder: summaryT("namePlaceholder"),
    },
    actions: {
      item: {
        radius: "rounded-lg",
        variant: "outline",
      },
      section: {
        radius: "rounded-lg",
        variant: "ghost",
      },
    },
    styleMode,
    visibility,
  };
  const configSection = configTarget
    ? project.sections.find((section) => section.id === configTarget.sectionId)
    : undefined;
  const configItem =
    configTarget?.kind === "image"
      ? [
          configSection?.content.image,
          ...(configSection?.content.images ?? []),
        ].find((item) => item?.id === configTarget.itemId)
      : configTarget?.kind === "color"
        ? configSection?.content.colors?.find(
            (item) => item.id === configTarget.itemId,
          )
        : configTarget?.kind === "font"
          ? configSection?.content.fonts?.find(
              (item) => item.id === configTarget.itemId,
            )
          : configTarget?.kind === "file"
            ? configSection?.content.files?.find(
                (item) => item.id === configTarget.itemId,
              )
            : undefined;
  const configPanel: PanelConfigKind | undefined =
    configTarget && configSection
      ? configTarget.kind === "section"
        ? configSection.type === "gallery" ||
          configSection.type === "image_comparison"
          ? "section-gallery"
          : configSection.type === "colors"
            ? "section-colors"
            : configSection.type === "files"
              ? "section-files"
              : configSection.type === "fonts"
                ? "section-fonts"
                : configSection.type === "image"
                  ? "section-image"
                  : "section-text"
        : configTarget.kind
      : undefined;
  const hasConfigPanel = Boolean(
    configTarget &&
      configSection &&
      configPanel &&
      (configTarget.kind === "section" || configItem),
  );
  useEffect(() => {
    setConfigSidebarOpen(hasConfigPanel);
    return () => {
      setConfigSidebarOpen(false);
    };
  }, [hasConfigPanel, setConfigSidebarOpen]);
  useEffect(() => {
    setConfigDrawerHeader(configPanel ? getPanelConfigCopy(configPanel) : null);
    return () => setConfigDrawerHeader(null);
  }, [configPanel, setConfigDrawerHeader]);
  useEffect(() => {
    if (configDrawerCloseVersion === configDrawerCloseVersionRef.current)
      return;
    configDrawerCloseVersionRef.current = configDrawerCloseVersion;
    setConfigTarget(null);
  }, [configDrawerCloseVersion]);
  useEffect(() => {
    const root = globalThis.document.documentElement;
    if (!hasConfigPanel || !configSidebarHost) {
      root.style.removeProperty("--portal-right-sidebar-width");
      return;
    }
    root.style.setProperty("--portal-right-sidebar-width", "19rem");
    return () => {
      root.style.removeProperty("--portal-right-sidebar-width");
    };
  }, [configSidebarHost, hasConfigPanel]);
  const configPanelHost = configSidebarHost ?? configDrawerHost;
  const configPanelTarget = configTarget
    ? configPanelTargetKey(configTarget)
    : null;
  useEffect(() => {
    if (!configPanelTarget) return;
    resetConfigPanelScroll(configPanelHost);
  }, [configPanelHost, configPanelTarget]);
  const configSidebar =
    hasConfigPanel &&
    configPanelHost &&
    configTarget &&
    configSection &&
    configPanel
      ? createPortal(
          <PanelConfig
            item={configItem ?? undefined}
            onChange={(values) =>
              changePanelConfiguration(configTarget, values)
            }
            onClose={() => setConfigTarget(null)}
            onDelete={() => {
              if (configTarget.kind === "section")
                removeEditableSection(configTarget.sectionId);
              else
                removeRenderItem(
                  configTarget.sectionId,
                  configTarget.kind,
                  configTarget.itemId,
                );
              setConfigTarget(null);
            }}
            panel={configPanel}
            presentation={
              configPanelHost === configDrawerHost ? "drawer" : "sidebar"
            }
            section={configSection}
          />,
          configPanelHost,
        )
      : null;
  return (
    <>
      <PortalShell
        className={className}
        sidebar={sidebar}
        styleMode={styleMode}
      >
        <RenderProject
          collectionAvailability={collectionAvailability}
          mode={isInteractiveMode ? "editor" : "view"}
          ref={renderProjectRef}
          actions={
            isEditorMode
              ? {
                  section: ({ section }) => [
                    {
                      id: "configure-section",
                      label: "Configure section",
                      icon: IconAdjustmentsHorizontalFilled,
                      onClick: () =>
                        setConfigTarget({
                          kind: "section",
                          sectionId: section.id,
                        }),
                    },
                  ],
                  collection: ({ kind, section }) => {
                    if (
                      kind === "image" &&
                      (section.type === "image" ||
                        section.type === "gallery" ||
                        section.type === "image_comparison")
                    )
                      return {
                        id: "pick-image",
                        label: "Add image",
                        icon: IconPhotoPlus,
                        onClick: ({ tools }) =>
                          tools.pickAssets({
                            sectionId: section.id,
                            kind,
                            multiple: section.type !== "image",
                          }),
                      };
                    if (kind === "font" && section.type === "fonts")
                      return {
                        id: "pick-font",
                        label: "Add font",
                        icon: IconTypography,
                        onClick: ({ tools }) =>
                          tools.pickAssets({ sectionId: section.id, kind }),
                      };
                    if (kind === "file" && section.type === "files")
                      return {
                        id: "pick-file",
                        label: "Add file",
                        icon: IconFileUpload,
                        onClick: ({ tools }) =>
                          tools.pickAssets({ sectionId: section.id, kind }),
                      };
                    if (kind === "color" && section.type === "colors")
                      return {
                        id: "add-color",
                        label: "Add color",
                        icon: IconColorSwatch,
                        onClick: () => setColorCreationSectionId(section.id),
                      };
                    return undefined;
                  },
                  image: ({ item, section }) => [
                    {
                      id: "configure-image",
                      label: "Configure image",
                      icon: IconPencil,
                      onClick: () =>
                        setConfigTarget({
                          kind: "image",
                          sectionId: section.id,
                          itemId: item.id,
                        }),
                    },
                  ],
                  color: ({ item, section }) => [
                    {
                      id: "configure-color",
                      label: "Configure color",
                      icon: IconPalette,
                      onClick: () =>
                        setConfigTarget({
                          kind: "color",
                          sectionId: section.id,
                          itemId: item.id,
                        }),
                    },
                  ],
                  font: ({ item, section }) => [
                    {
                      id: "configure-font",
                      label: "Configure font",
                      icon: IconPencil,
                      onClick: () =>
                        setConfigTarget({
                          kind: "font",
                          sectionId: section.id,
                          itemId: item.id,
                        }),
                    },
                  ],
                  file: ({ item, section }) => [
                    {
                      id: "configure-file",
                      label: "Configure file",
                      icon: IconPencil,
                      onClick: () =>
                        setConfigTarget({
                          kind: "file",
                          sectionId: section.id,
                          itemId: item.id,
                        }),
                    },
                  ],
                }
              : undefined
          }
          project={project}
          ui={ui}
          onChange={(change) => {
            if (change.rejectedFileCount) {
              toast.error(
                uploadT("skippedAssets", { count: change.rejectedFileCount }),
                {
                  id: `portal-asset-upload-error:${editor?.portalId ?? "unknown"}`,
                },
              );
              if (!change.assets?.length) return;
            }
            const itemMove = change.itemMove;
            if (change.kind === "item-order" && itemMove) {
              changeEditableDocument((current) =>
                movePortalItem(current, itemMove),
              );
              return;
            }
            const persistableProject = withoutPendingDrafts(change.project);
            if (change.assets?.length && isEditorMode) {
              setDraftProject(change.project);
              changeEditableDocument((current) =>
                applyRenderProjectDocument(current, persistableProject),
              );
              void uploadSelectedAssets(change.assets)
                .then((replacements) => {
                  changeEditableDocument((current) => {
                    let latest = portalDocumentToRenderProject(current);
                    for (const replacement of replacements)
                      latest = mergeCanonicalDraft(
                        latest,
                        change.project,
                        replacement.selected,
                        replacement.uploaded,
                      );
                    return applyRenderProjectDocument(current, latest);
                  });
                  setDraftProject(null);
                })
                .catch((error) => {
                  if (
                    recoverExpectedPortalAssetUploadRejection({
                      error,
                      onInvalidAsset: () => {
                        setDraftProject(null);
                        toast.error(uploadT("invalidAsset"), {
                          id: `portal-asset-upload-error:${editor?.portalId}`,
                        });
                      },
                    })
                  ) {
                    return;
                  }
                  throw error;
                });
              return;
            }
            if (draftProject) setDraftProject(change.project);
            changeEditableDocument((current) =>
              applyRenderProjectDocument(current, persistableProject),
            );
          }}
        />
      </PortalShell>
      <ColorCreationDialog
        onConfirm={({ code, name }) => {
          if (!colorCreationSectionId) return;
          updateRenderSection(colorCreationSectionId, (current) => ({
            ...current,
            content: {
              ...current.content,
              colors: [
                ...(current.content.colors ?? []),
                {
                  code,
                  id: createRandomId("color"),
                  name,
                  position: current.content.colors?.length ?? 0,
                  visible: true,
                },
              ],
            },
          }));
          setColorCreationSectionId(null);
        }}
        onOpenChange={(open) => {
          if (!open) setColorCreationSectionId(null);
        }}
        open={colorCreationSectionId !== null}
      />
      {configSidebar}
    </>
  );
}

function ColorCreationDialog({
  onConfirm,
  onOpenChange,
  open,
}: {
  onConfirm: (draft: ColorCreationDraft) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [draft, setDraft] = useState<ColorCreationDraft>(
    INITIAL_COLOR_CREATION_DRAFT,
  );

  useEffect(() => {
    if (open) setDraft(INITIAL_COLOR_CREATION_DRAFT);
  }, [open]);

  const name = draft.name.trim();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add color</DialogTitle>
          <DialogDescription>
            Choose a color and give it a name before adding it to this section.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Color</FieldLabel>
            <VisualColorPicker
              format="hex"
              onChange={(code) => setDraft((current) => ({ ...current, code }))}
              value={draft.code}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-color-name">Name</FieldLabel>
            <Input
              id="new-color-name"
              maxLength={40}
              onChange={(event) => {
                const name = event.currentTarget.value;
                setDraft((current) => ({ ...current, name }));
              }}
              placeholder="e.g. Brand red"
              value={draft.name}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={!name}
            onClick={() => onConfirm({ ...draft, name })}
            type="button"
          >
            Add color
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
