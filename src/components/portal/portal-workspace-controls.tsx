"use client";

import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  IconBubbleTextFilled,
  IconClipboardTypographyFilled,
  IconFilesFilled,
  IconLayoutGridFilled,
  IconLoader2,
  IconPaletteFilled,
  IconPhotoFilled,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { flushPortalAutosave } from "@/application/portal/autosave-coordinator";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import { fontWeightMessageKey } from "@/application/portal/font-utils";
import {
  createSyncedTextDraft,
  handleSyncedTextDraftChange,
  syncTextDraftSource,
} from "@/application/portal/image-settings-draft";
import { applyContainedDemoOverlayOpenChange } from "@/application/portal/local-editor";
import {
  PORTAL_FILE_ACCEPT,
  PORTAL_IMAGE_ACCEPT,
  PortalFilePreview,
  portalFileTypeFromName,
} from "@/components/portal/file-preview";
import {
  PortalActionTriggerButton,
  PortalItemActionsOverlay,
} from "@/components/portal/portal-actions";
import { usePortalPlan } from "@/components/portal/portal-plan-provider";
import { PortalTypographyShowcase } from "@/components/portal/portal-typography-showcase";
import {
  type ColorFormat,
  formatPickerColor,
  normalizeHexInput,
  VisualColorPicker,
  visualColorPickerValue,
} from "@/components/portal/visual-color-picker";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  applySectionImagePresentation,
  createImageItem,
  defaultContentForType,
  defaultLayoutForType,
  type ImageAspectRatio,
  type ImageFit,
  type PortalColorItem,
  type PortalDocument,
  type PortalFileItem,
  type PortalFontItem,
  type PortalImageItem,
  type PortalSection,
  type PortalSectionType,
  portalQuickColors,
  uniqueForRender,
} from "@/domain/portal/document";
import {
  deleteManagedPortalAsset,
  type PortalAssetCategory,
  releaseManagedPortalAsset,
  shouldUseServerOwnedUpload,
  uploadManagedPortalAsset,
  uploadManagedPortalAssetServerOwned,
} from "@/infrastructure/portal/portal-assets-client";
import {
  aiCreditsQueryKey,
  canAffordAiOperation,
  useAiCredits,
} from "@/lib/billing/ai-credits-client";
import { markImageFieldManual } from "@/lib/portal/ai";
import type { AiContentTarget } from "@/lib/portal/ai-sdk";
import { useAiWorkflowStore } from "@/lib/portal/ai-workflow-store";
import { extractAssetMetadata } from "@/lib/portal/asset-metadata";
import {
  displayNameWithoutExtension,
  normalizeAssetDownloadName,
  sourceNameFromStoragePath,
} from "@/lib/portal/asset-names";
import {
  editorPortalImagePreviewUrl,
  stablePortalAssetPreviewUrl,
} from "@/lib/portal/asset-preview-reference";
import {
  reconcileOptimisticUpload,
  remainingOptimisticUploadSlots,
  rollbackOptimisticFontFile,
  useOptimisticUploads,
} from "@/lib/portal/optimistic-uploads";
import { PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT } from "@/lib/portal/scroll-to-section";
import { createRandomId } from "@/lib/random-id";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SectionOption = {
  accentClassName: string;
  icon: typeof IconBubbleTextFilled;
  type: Exclude<PortalSectionType, "empty">;
};

const sectionTypes: SectionOption[] = [
  {
    accentClassName: "bg-sky-500/15 text-sky-500",
    icon: IconBubbleTextFilled,
    type: "text",
  },
  {
    accentClassName: "bg-indigo-500/15 text-indigo-500",
    icon: IconPhotoFilled,
    type: "image",
  },
  {
    accentClassName: "bg-violet-500/15 text-violet-500",
    icon: IconLayoutGridFilled,
    type: "gallery",
  },
  {
    accentClassName: "bg-emerald-500/15 text-emerald-500",
    icon: IconPaletteFilled,
    type: "colors",
  },
  {
    accentClassName: "bg-amber-500/15 text-amber-500",
    icon: IconClipboardTypographyFilled,
    type: "fonts",
  },
  {
    accentClassName: "bg-slate-500/15 text-slate-500",
    icon: IconFilesFilled,
    type: "files",
  },
];

const imageFits: ImageFit[] = ["cover", "contain", "fill", "auto"];
const aspectRatios: ImageAspectRatio[] = ["auto", "1/1", "4/3", "16/9", "21/9"];
const galleryModes = ["grid", "comparison"] as const;

function ImproveWithAiButton({
  buttonLabel,
  className,
  portalId,
  showIcon = true,
  target,
  variant = "outline",
}: {
  buttonLabel?: string;
  className?: string;
  portalId: string;
  showIcon?: boolean;
  target: AiContentTarget;
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const t = useTranslations("PortalEditor.ai");
  const workspaceT = useTranslations("PortalEditor.workspace");
  const [improving, setImproving] = useState(false);
  const { data: creditData } = useAiCredits();
  const canAffordRefineCopy =
    creditData === undefined ||
    canAffordAiOperation(creditData.available, "refine-copy");
  const document = usePortalEditorStore(
    (state) => state.documentsByPortalId[portalId],
  );
  const updateDocument = usePortalEditorStore((state) => state.updateDocument);
  const queryClient = useQueryClient();
  const upsertJob = useAiWorkflowStore((state) => state.upsertJob);
  const targetKey = `${target.kind}:${target.id}`;
  const hasActiveTargetJob = useAiWorkflowStore((state) =>
    Object.values(state.jobsById).some(
      (job) =>
        job.portalId === portalId &&
        job.status === "loading" &&
        job.operation === "refine-copy" &&
        job.targetKey === targetKey,
    ),
  );
  function showInsufficientCreditsToast() {
    toast.warning(t("insufficientCredits"), {
      action: {
        label: workspaceT("credits.upgrade"),
        onClick: () =>
          window.dispatchEvent(new Event("billing:credits-upgrade")),
      },
    });
  }

  function documentWithRenderedImageDimensions(
    source: PortalDocument,
  ): PortalDocument {
    if (target.kind !== "section") return source;
    const sectionElement = window.document.getElementById(target.id);
    if (!sectionElement) return source;
    const renderedImages = Array.from(sectionElement.querySelectorAll("img"));
    let renderedIndex = 0;
    return {
      ...source,
      sections: source.sections.map((section) => {
        if (section.id !== target.id) return section;
        const enrich = (image: PortalImageItem) => {
          const rendered = renderedImages[renderedIndex++];
          return rendered?.naturalWidth && rendered.naturalHeight
            ? {
                ...image,
                height: rendered.naturalHeight,
                width: rendered.naturalWidth,
              }
            : image;
        };
        return {
          ...section,
          content: {
            ...section.content,
            image: section.content.image
              ? enrich(section.content.image)
              : section.content.image,
            images: section.content.images?.map(enrich),
          },
        };
      }),
    };
  }

  async function improve() {
    if (!document || improving) return;
    if (hasActiveTargetJob) {
      toast.info(t("alreadyInProgress"));
      return;
    }
    if (!canAffordRefineCopy) {
      showInsufficientCreditsToast();
      return;
    }
    setImproving(true);
    try {
      const documentForAi = documentWithRenderedImageDimensions(document);
      const requestId = createRandomId();
      const response = await fetch("/api/ai/portal-content", {
        body: JSON.stringify({
          currentDocument: documentForAi,
          portalId,
          requestId,
          target,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        document?: PortalDocument;
        error?: string;
        jobId?: string;
      } | null;
      if (!response.ok || (!result?.document && response.status !== 202)) {
        throw new Error(result?.error ?? "ai_operation_failed");
      }
      await queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey });
      if (response.status === 202) {
        if (!result?.jobId) throw new Error("ai_operation_failed");
        upsertJob({
          autoApply: true,
          errorCode: null,
          id: result.jobId,
          kind: "portal-content",
          operation: "refine-copy",
          portalId,
          requestId,
          status: "loading",
          targetKey,
          updatedAt: new Date().toISOString(),
        });
        toast.success(t("jobQueued"));
        toast.loading(workspaceT("aiImproveWithAiTitle"), {
          description: workspaceT("aiProcessingContent"),
          duration: Number.POSITIVE_INFINITY,
          id: `ai-workflow-${portalId}`,
        });
        return;
      }
      if (result?.document) {
        updateDocument(portalId, () => result.document as PortalDocument);
      }
      await queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey });
      toast.success(t("improveTextSuccess"));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason === "ai_workflow_in_progress") {
        toast.error(t("alreadyInProgress"));
      } else if (reason === "insufficient_credits") {
        showInsufficientCreditsToast();
      } else {
        toast.error(t("improveTextError"));
      }
    } finally {
      setImproving(false);
    }
  }

  return (
    <Button
      aria-disabled={!canAffordRefineCopy || undefined}
      className={cn(className, !canAffordRefineCopy && "opacity-60")}
      onClick={() => void improve()}
      size="sm"
      type="button"
      variant={variant}
    >
      {improving ? (
        <IconLoader2 className="animate-spin" />
      ) : showIcon ? (
        <IconSparkles />
      ) : null}
      {improving ? t("improvingText") : (buttonLabel ?? t("improveText"))}
    </Button>
  );
}

function ImproveSectionWithAiPopover({
  portalId,
  section,
}: {
  portalId: string;
  section: PortalSection;
}) {
  const t = useTranslations("PortalEditor.ai");
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={t("improveSection")}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <IconSparkles />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("improveSectionTitle")}</PopoverTitle>
          <PopoverDescription>
            {t("improveSectionDescription")}
          </PopoverDescription>
        </PopoverHeader>
        <ImproveWithAiButton
          buttonLabel={t("improveSection")}
          className="rounded-full"
          portalId={portalId}
          showIcon={false}
          target={{
            description: section.description,
            id: section.id,
            kind: "section",
            title: section.title,
          }}
          variant="default"
        />
      </PopoverContent>
    </Popover>
  );
}

const colorFormats: ColorFormat[] = [
  "hex",
  "hexa",
  "hsb",
  "hsba",
  "hsl",
  "hsla",
  "rgb",
  "rgba",
];

function toHexColor(value: string) {
  const hex = normalizeHexInput(value);
  return hex ? `#${hex}` : "#";
}

function completeHexColor(value: string, format: ColorFormat) {
  const length = format === "hexa" ? 8 : 6;
  const hex = normalizeHexInput(value, length);
  const fallback = format === "hexa" ? "FF0000FF" : "FF0000";
  return `#${(hex || fallback).padEnd(length, "0")}`;
}

function createColorDraft(color?: PortalColorItem): PortalColorItem {
  return color
    ? { ...color }
    : {
        color_code: "#FF0000",
        color_name: "",
        id: createRandomId("color"),
        position: 0,
        visible: true,
      };
}

function detectColorFormat(color?: PortalColorItem): ColorFormat {
  const code = color?.color_code.trim().toLowerCase() ?? "";
  if (code.startsWith("rgba")) return "rgba";
  if (code.startsWith("rgb")) return "rgb";
  if (code.startsWith("hsla")) return "hsla";
  if (code.startsWith("hsl")) return "hsl";
  if (code.startsWith("hsba")) return "hsba";
  if (code.startsWith("hsb")) return "hsb";
  if (/^#[0-9a-f]{8}$/i.test(code)) return "hexa";
  return "hex";
}

const colorNameMaxLength = 40;

function reindexUnique<T extends { id: string; position: number }>(
  items: T[],
  prefix: string,
) {
  const seen = new Set<string>();

  return items.map((item, index) => {
    const id = item.id && !seen.has(item.id) ? item.id : createRandomId(prefix);
    seen.add(id);
    return { ...item, id, position: index };
  });
}

async function uploadPortalAsset({
  category,
  file,
  portalId,
}: {
  category: PortalAssetCategory;
  file: File;
  portalId: string;
}) {
  if (shouldUseServerOwnedUpload(file.size)) {
    return uploadManagedPortalAssetServerOwned({ category, file, portalId });
  }
  return uploadManagedPortalAsset({
    category,
    file,
    portalId,
    storage: createClient().storage,
  });
}

export function SectionTypeDialog({
  openRequestKey,
  onSelectComplete,
  onSelect,
  trigger,
  triggerNativeButton = true,
}: {
  openRequestKey?: string;
  onSelectComplete?: () => void;
  onSelect: (type: Exclude<PortalSectionType, "empty">) => void;
  trigger: ReactElement;
  triggerNativeButton?: boolean;
}) {
  const t = useTranslations("PortalEditor.sections");
  const [open, setOpen] = useState(false);
  const selectionPendingRef = useRef(false);

  useEffect(() => {
    if (!openRequestKey) return;

    const openDialog = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      if (customEvent.detail?.key !== openRequestKey) return;
      setOpen(true);
    };

    document.addEventListener(PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT, openDialog);
    return () =>
      document.removeEventListener(
        PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT,
        openDialog,
      );
  }, [openRequestKey]);
  return (
    <Dialog
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen && selectionPendingRef.current) {
          selectionPendingRef.current = false;
          onSelectComplete?.();
        }
      }}
      open={open}
    >
      <DialogTrigger nativeButton={triggerNativeButton} render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("chooseDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {sectionTypes.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                className="group h-auto min-w-0 justify-start gap-3 overflow-hidden rounded-lg border border-border bg-card px-4 py-4 text-left hover:bg-muted"
                key={item.type}
                onClick={() => {
                  selectionPendingRef.current = true;
                  onSelect(item.type);
                  setOpen(false);
                }}
                type="button"
                variant="outline"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                    item.accentClassName,
                  )}
                >
                  <Icon aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">
                    {t(`types.${item.type}.label`)}
                  </span>
                  <span className="line-clamp-2 text-wrap font-normal text-muted-foreground text-xs leading-relaxed">
                    {t(`types.${item.type}.description`)}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileContainerPresentationControls({
  backgroundColor = "secondary",
  containerPadding = 0,
  controlId = "file-image-presentation",
  labels,
  onChange,
  portalId,
  quickColors,
  overlayContainer,
  targetPrefix,
}: {
  backgroundColor?: string;
  containerPadding?: number;
  controlId?: string;
  labels: { background: string; padding: string; transparent: string };
  onChange: (presentation: {
    background_color: string;
    container_padding: number;
  }) => void;
  portalId: string;
  quickColors?: string[];
  overlayContainer?: HTMLElement | null;
  targetPrefix?: string;
}) {
  const isTransparent = backgroundColor === "transparent";
  const document = usePortalEditorStore(
    (state) => state.documentsByPortalId[portalId],
  );
  const paletteColors = quickColors ?? portalQuickColors(document);

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${controlId}-padding`}>
          {labels.padding}: {containerPadding}px
        </FieldLabel>
        <Slider
          aria-label={labels.padding}
          id={`${controlId}-padding`}
          max={25}
          min={0}
          onValueChange={(value) =>
            onChange({
              background_color: backgroundColor,
              container_padding:
                typeof value === "number" ? value : (value[0] ?? 0),
            })
          }
          step={1}
          value={[containerPadding]}
        />
      </Field>
      <Field className="flex flex-row items-center justify-between gap-3">
        <FieldLabel htmlFor={`${controlId}-transparent`}>
          {labels.transparent}
        </FieldLabel>
        <Switch
          checked={isTransparent}
          id={`${controlId}-transparent`}
          onCheckedChange={(checked) =>
            onChange({
              background_color: checked ? "transparent" : "secondary",
              container_padding: containerPadding,
            })
          }
        />
      </Field>
      {!isTransparent ? (
        <Field>
          <FieldLabel htmlFor={`${controlId}-background`}>
            {labels.background}
          </FieldLabel>
          <VisualColorPicker
            format="hex"
            overlayContainer={overlayContainer}
            onChange={(value) =>
              onChange({
                background_color: value,
                container_padding: containerPadding,
              })
            }
            value={
              backgroundColor === "secondary" ? "#E5E5E5" : backgroundColor
            }
            paletteColors={paletteColors}
            targetPrefix={targetPrefix}
          />
        </Field>
      ) : null}
    </>
  );
}

function ImageContainerPresentationControls({
  demoTargetPrefix,
  image,
  onSave,
  overlayContainer,
  portalId,
  quickColors,
}: {
  demoTargetPrefix?: string;
  image: PortalImageItem;
  onSave: (image: PortalImageItem) => void;
  overlayContainer?: HTMLElement | null;
  portalId: string;
  quickColors?: string[];
}) {
  const t = useTranslations("PortalEditor.image");
  return (
    <FileContainerPresentationControls
      backgroundColor={image.background_color}
      containerPadding={image.container_padding}
      controlId={image.id}
      labels={{
        background: t("background"),
        padding: t("padding"),
        transparent: t("transparentBackground"),
      }}
      onChange={(presentation) => {
        let nextImage: PortalImageItem = { ...image, ...presentation };
        if (presentation.background_color !== image.background_color) {
          nextImage = markImageFieldManual(nextImage, "background_color");
        }
        if (presentation.container_padding !== image.container_padding) {
          nextImage = markImageFieldManual(nextImage, "container_padding");
        }
        onSave(nextImage);
      }}
      portalId={portalId}
      quickColors={quickColors}
      overlayContainer={overlayContainer}
      targetPrefix={demoTargetPrefix}
    />
  );
}

function ImageSettingsPopover({
  demoTargetPrefix,
  image,
  onOpenChange,
  onSave,
  portalId,
  open,
  trigger,
  localMode = false,
  overlayContainer,
  quickColors,
}: {
  demoTargetPrefix?: string;
  image: PortalImageItem;
  onOpenChange: (open: boolean) => void;
  onSave: (image: PortalImageItem) => void;
  portalId: string;
  open: boolean;
  trigger: ReactElement;
  localMode?: boolean;
  overlayContainer?: HTMLElement | null;
  quickColors?: string[];
}) {
  const t = useTranslations("PortalEditor");
  const imageFitItems = imageFits.map((value) => ({
    label: t(`image.fitOptions.${value}`),
    value,
  }));
  const aspectRatioItems = aspectRatios.map((value) => ({
    label: value === "auto" ? t("image.ratioAuto") : value,
    value,
  }));
  const imageName = image.display_name ?? "";
  const imageDownloadName = displayNameWithoutExtension(
    image.download_name || sourceNameFromStoragePath(image.storage_path),
  );
  const [nameDraft, setNameDraft] = useState(() =>
    createSyncedTextDraft(imageName),
  );
  const [downloadNameDraft, setDownloadNameDraft] = useState(() =>
    createSyncedTextDraft(imageDownloadName),
  );
  useEffect(
    () => setNameDraft((state) => syncTextDraftSource(state, imageName)),
    [imageName],
  );
  useEffect(
    () =>
      setDownloadNameDraft((state) =>
        syncTextDraftSource(state, imageDownloadName),
      ),
    [imageDownloadName],
  );
  function updateImage(nextImage: PortalImageItem) {
    onSave(nextImage);
  }

  return (
    <Popover
      modal={overlayContainer ? false : undefined}
      onOpenChange={(nextOpen, details) =>
        applyContainedDemoOverlayOpenChange(
          Boolean(overlayContainer),
          nextOpen,
          onOpenChange,
          { ...details, container: overlayContainer },
        )
      }
      open={open}
    >
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align="end"
        className="w-80"
        collisionBoundary={overlayContainer ?? undefined}
        portalContainer={overlayContainer}
        positionMethod={overlayContainer ? "absolute" : "fixed"}
        side="bottom"
      >
        <PopoverHeader>
          <PopoverTitle>{t("image.settings")}</PopoverTitle>
          <PopoverDescription>
            {t("image.settingsDescription")}
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup>
          {!localMode ? (
            <ImproveWithAiButton
              buttonLabel={t("ai.improveTextLabel")}
              className="rounded-full"
              portalId={portalId}
              showIcon={false}
              target={{
                altText: image.alt_text,
                id: image.id,
                kind: "image",
                name: image.display_name ?? image.image_url,
              }}
              variant="default"
            />
          ) : null}
          <Field>
            <FieldLabel>{t("image.name")}</FieldLabel>
            <Input
              demo-id={
                demoTargetPrefix ? `${demoTargetPrefix}-name` : undefined
              }
              data-portal-demo-target={
                demoTargetPrefix ? `${demoTargetPrefix}-name` : undefined
              }
              value={nameDraft.draft}
              onChange={(event) =>
                handleSyncedTextDraftChange(setNameDraft, event)
              }
              onBlur={() =>
                updateImage(
                  markImageFieldManual(
                    {
                      ...image,
                      display_name: nameDraft.draft.trim(),
                    },
                    "display_name",
                  ),
                )
              }
              placeholder={t("image.namePlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel>{t("image.downloadName")}</FieldLabel>
            <Input
              value={downloadNameDraft.draft}
              onChange={(event) =>
                handleSyncedTextDraftChange(setDownloadNameDraft, event)
              }
              onBlur={() =>
                updateImage(
                  markImageFieldManual(
                    {
                      ...image,
                      download_name: normalizeAssetDownloadName(
                        downloadNameDraft.draft,
                        sourceNameFromStoragePath(image.storage_path),
                      ),
                    },
                    "download_name",
                  ),
                )
              }
              placeholder={t("image.downloadNamePlaceholder")}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("image.fit")}</FieldLabel>
              <Select
                items={imageFitItems}
                value={image.fit}
                onValueChange={(value) =>
                  value &&
                  updateImage(
                    markImageFieldManual(
                      { ...image, fit: value as ImageFit },
                      "fit",
                    ),
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {imageFitItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("image.ratio")}</FieldLabel>
              <Select
                items={aspectRatioItems}
                value={image.aspect_ratio}
                onValueChange={(value) =>
                  value &&
                  updateImage(
                    markImageFieldManual(
                      { ...image, aspect_ratio: value as ImageAspectRatio },
                      "aspect_ratio",
                    ),
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {aspectRatioItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <ImageContainerPresentationControls
            demoTargetPrefix={demoTargetPrefix}
            image={image}
            onSave={updateImage}
            overlayContainer={overlayContainer}
            portalId={portalId}
            quickColors={quickColors}
          />
          <Field className="flex flex-row items-center justify-between gap-3">
            <FieldLabel htmlFor={`${image.id}-visible`}>
              {t("common.visible")}
            </FieldLabel>
            <Switch
              checked={image.visible}
              id={`${image.id}-visible`}
              onCheckedChange={(checked) =>
                updateImage({ ...image, visible: checked })
              }
            />
          </Field>
          <Field className="flex flex-row items-center justify-between gap-3">
            <FieldLabel htmlFor={`${image.id}-download`}>
              {t("common.allowDownload")}
            </FieldLabel>
            <Switch
              demo-id={
                demoTargetPrefix ? `${demoTargetPrefix}-download` : undefined
              }
              data-portal-demo-target={
                demoTargetPrefix ? `${demoTargetPrefix}-download` : undefined
              }
              checked={image.allow_download}
              id={`${image.id}-download`}
              onCheckedChange={(checked) =>
                updateImage({ ...image, allow_download: checked })
              }
            />
          </Field>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

function ImageTile({
  captionEditable = false,
  dragHandleRef,
  image,
  isDragging = false,
  onRemove,
  onSave,
  portalId,
  portalSlug,
  pending = false,
  localMode = false,
  overlayContainer,
  quickColors,
  demoTargetPrefix,
}: {
  captionEditable?: boolean;
  dragHandleRef?: (element: Element | null) => void;
  image: PortalImageItem;
  isDragging?: boolean;
  onRemove: () => void;
  onSave: (image: PortalImageItem) => void;
  portalId: string;
  portalSlug?: string;
  pending?: boolean;
  localMode?: boolean;
  overlayContainer?: HTMLElement | null;
  quickColors?: string[];
  demoTargetPrefix?: string;
}) {
  const t = useTranslations("PortalEditor.image");
  const ratioClass =
    image.aspect_ratio === "1/1"
      ? "aspect-square"
      : image.aspect_ratio === "4/3"
        ? "aspect-[4/3]"
        : image.aspect_ratio === "16/9"
          ? "aspect-video"
          : image.aspect_ratio === "21/9"
            ? "aspect-[21/9]"
            : "aspect-[4/3]";
  const fitClass =
    image.fit === "contain"
      ? "object-contain"
      : image.fit === "fill"
        ? "object-fill"
        : image.fit === "auto"
          ? "object-scale-down"
          : "object-cover";
  const [useStablePreview, setUseStablePreview] = useState(false);
  const [previewRetry, setPreviewRetry] = useState(0);
  const previewRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableImageUrl = portalSlug
    ? stablePortalAssetPreviewUrl(
        portalSlug,
        image.asset_id,
        image.storage_path,
      )
    : null;
  const imageUrl =
    useStablePreview && stableImageUrl
      ? stableImageUrl
      : editorPortalImagePreviewUrl(image, portalSlug);
  useEffect(() => {
    return () => {
      if (previewRetryTimer.current) {
        clearTimeout(previewRetryTimer.current);
        previewRetryTimer.current = null;
      }
    };
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <figure
      aria-busy={pending}
      className={cn("flex h-fit flex-col gap-2", pending && "animate-pulse")}
    >
      <div
        data-portal-demo-target={
          demoTargetPrefix ? `${demoTargetPrefix}-card` : undefined
        }
        className={cn(
          "group/item relative overflow-hidden rounded-xl bg-muted",
          ratioClass,
          !image.visible && "opacity-50",
          isDragging && "opacity-70",
        )}
        style={{
          backgroundColor:
            !image.background_color || image.background_color === "secondary"
              ? "var(--secondary)"
              : image.background_color,
        }}
      >
        <div
          className="absolute inset-0"
          style={{ padding: image.container_padding ?? 0 }}
        >
          {/* biome-ignore lint/performance/noImgElement: user uploaded Storage asset. */}
          <img
            alt={image.alt_text}
            className={cn(
              "size-full",
              fitClass,
              dragHandleRef && "cursor-grab active:cursor-grabbing",
            )}
            ref={dragHandleRef}
            src={imageUrl}
            key={`${imageUrl}:${previewRetry}`}
            onError={() => {
              if (!stableImageUrl || imageUrl === stableImageUrl) return;
              if (previewRetry < 3) {
                previewRetryTimer.current = setTimeout(() => {
                  setPreviewRetry((current) => current + 1);
                }, 400);
                return;
              }
              setUseStablePreview(true);
            }}
          />
        </div>
        {pending ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white">
            <IconLoader2 className="size-4 animate-spin" />
            <span className="text-sm">{t("uploading")}</span>
          </div>
        ) : null}
        {!pending ? (
          <PortalItemActionsOverlay forceVisible position="top-3-right">
            <ImageSettingsPopover
              image={image}
              demoTargetPrefix={demoTargetPrefix}
              onOpenChange={setSettingsOpen}
              onSave={onSave}
              portalId={portalId}
              open={settingsOpen}
              localMode={localMode}
              overlayContainer={overlayContainer}
              quickColors={quickColors}
              trigger={
                <PortalActionTriggerButton
                  demo-id={
                    demoTargetPrefix
                      ? `${demoTargetPrefix}-settings`
                      : undefined
                  }
                  data-portal-demo-target={
                    demoTargetPrefix
                      ? `${demoTargetPrefix}-settings`
                      : undefined
                  }
                  icon="settings"
                  label={t("settings")}
                  variant="ghost"
                />
              }
            />
            {!localMode ? (
              <Button
                aria-label={t("remove")}
                className="rounded-full"
                onClick={onRemove}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <IconX data-icon="inline-start" />
              </Button>
            ) : null}
          </PortalItemActionsOverlay>
        ) : null}
      </div>
      {captionEditable && !pending ? (
        <Textarea
          className="resize-none border-none bg-transparent! px-0 text-muted-foreground text-sm shadow-none outline-none focus-visible:ring-0"
          defaultValue={image.alt_text}
          maxLength={380}
          onBlur={(event) =>
            onSave({ ...image, alt_text: event.currentTarget.value })
          }
          placeholder={t("altPlaceholder")}
        />
      ) : null}
    </figure>
  );
}

function AddImageTile({
  aspectRatio = "auto",
  category = "image",
  maxFiles,
  onAdd,
  ownerKey,
  portalId,
}: {
  aspectRatio?: ImageAspectRatio;
  category?: "gallery" | "image";
  label?: string;
  maxFiles?: number;
  onAdd: (image: PortalImageItem) => void;
  ownerKey: string;
  portalId: string;
}) {
  const t = useTranslations("PortalEditor.image");
  const { requestUpgrade, snapshot, status } = usePortalPlan();
  const inputRef = useRef<HTMLInputElement>(null);
  const optimistic = useOptimisticUploads<PortalImageItem>();
  useEffect(() => {
    optimistic.claimOwner(ownerKey);
    return () => optimistic.invalidate();
  }, [optimistic.claimOwner, optimistic.invalidate, ownerKey]);
  const availableSlots = remainingOptimisticUploadSlots(
    maxFiles ?? (category === "gallery" ? Number.POSITIVE_INFINITY : 1),
    0,
    optimistic.pending.length,
  );
  const ratioClass =
    aspectRatio === "1/1"
      ? "aspect-square"
      : aspectRatio === "4/3"
        ? "aspect-[4/3]"
        : aspectRatio === "16/9"
          ? "aspect-video"
          : aspectRatio === "21/9"
            ? "aspect-[21/9]"
            : "aspect-[4/3]";
  function handleFiles(fileList: FileList | null | undefined) {
    const slotsAtSelection = remainingOptimisticUploadSlots(
      maxFiles ?? (category === "gallery" ? Number.POSITIVE_INFINITY : 1),
      0,
      optimistic.count(),
    );
    const files = Array.from(fileList ?? []).slice(0, slotsAtSelection);
    if (!files.length) return;
    if (status !== "ready") {
      requestUpgrade("plan_unavailable");
      return;
    }
    if (files.some((file) => file.size > snapshot.policy.maxUploadBytes)) {
      requestUpgrade("upload_bytes", undefined, {
        fileSizeBytes: Math.max(...files.map((file) => file.size)),
      });
      return;
    }
    if (
      snapshot.storageUsedBytes +
        files.reduce((total, file) => total + file.size, 0) >
      snapshot.policy.storageBytes
    ) {
      requestUpgrade("storage_bytes", undefined, {
        fileSizeBytes: files.reduce((total, file) => total + file.size, 0),
      });
      return;
    }
    for (const file of files) {
      const pending = optimistic.add(file, ({ id, previewUrl }) => ({
        ...createImageItem(previewUrl, 0),
        id,
      }));
      void (async () => {
        try {
          const metadata = await extractAssetMetadata(file);
          const asset = await uploadPortalAsset({
            category,
            file,
            portalId,
          });
          if (!asset.previewUrl) throw new Error(t("uploadError"));
          const reconciled = await reconcileOptimisticUpload({
            asset,
            commit: (finalized) =>
              onAdd({
                ...createImageItem(finalized.previewUrl, 0),
                asset_id: finalized.assetId,
                storage_path: finalized.path,
                ...metadata,
              }),
            discard: (finalized) =>
              deleteManagedPortalAsset(finalized.assetId, fetch, portalId),
            id: pending.id,
            registry: optimistic,
          });
          if (reconciled) {
            releaseManagedPortalAsset(asset.assetId);
          }
        } catch (uploadError) {
          const stillOwned = optimistic.owns(pending.id);
          optimistic.remove(pending.id);
          if (!stillOwned) return;
          console.error("Portal image upload failed", {
            error:
              uploadError instanceof Error
                ? { name: uploadError.name, message: uploadError.message }
                : String(uploadError),
            portalId,
          });
          toast.error(t("uploadError"), {
            id: `portal-image-upload-error:${portalId}`,
          });
        }
      })();
    }
  }
  return (
    <div className="contents">
      {optimistic.pending.map(({ id, value }) => (
        <ImageTile
          image={{ ...value, aspect_ratio: aspectRatio }}
          key={id}
          onRemove={() => undefined}
          onSave={() => undefined}
          pending
          portalId={portalId}
          portalSlug=""
        />
      ))}
      {availableSlots === 0 ? null : (
        <button
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            ratioClass,
          )}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <IconPlus />
        </button>
      )}
      <input
        accept={PORTAL_IMAGE_ACCEPT}
        className="sr-only"
        ref={inputRef}
        type="file"
        multiple={category === "gallery"}
        onChange={(event) => {
          handleFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function GalleryLayoutControls({
  images,
  onImagesChange,
  portalId,
  section,
  updateSection,
}: {
  images: PortalImageItem[];
  onImagesChange: (images: PortalImageItem[]) => void;
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor");
  const sharedFit = images.every((image) => image.fit === images[0]?.fit)
    ? images[0]?.fit
    : null;
  const sharedAspectRatio = images.every(
    (image) => image.aspect_ratio === images[0]?.aspect_ratio,
  )
    ? images[0]?.aspect_ratio
    : null;
  const columnItems = [3, 4].map((columns) => ({
    label: t("common.columns", { count: columns }),
    value: String(columns),
  }));
  const selectedColumns = [3, 4].includes(section.layout.columns ?? 3)
    ? (section.layout.columns ?? 3)
    : 3;
  const imageFitItems = imageFits.map((value) => ({
    label: t(`image.fitOptions.${value}`),
    value,
  }));
  const aspectRatioItems = aspectRatios.map((ratio) => ({
    label: ratio === "auto" ? t("image.ratioAuto") : ratio,
    value: ratio,
  }));

  const selectedMode =
    section.layout.mode === "comparison" || section.type === "image_comparison"
      ? "comparison"
      : "grid";
  function updateGlobalPresentation(presentation: {
    background_color: string;
    container_padding: number;
  }) {
    const nextImages = images.map((image) =>
      markImageFieldManual(
        markImageFieldManual({ ...image, ...presentation }, "background_color"),
        "container_padding",
      ),
    );
    updateSection({
      ...section,
      content: { ...section.content, images: reindexUnique(nextImages, "img") },
      layout: {
        ...section.layout,
        imageBackgroundColor: presentation.background_color,
        imageContainerPadding: presentation.container_padding,
      },
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field className="sm:col-span-2">
        <FieldLabel>{t("common.layout")}</FieldLabel>
        <Select
          items={galleryModes.map((value) => ({
            label: t(`gallery.${value}`),
            value,
          }))}
          value={selectedMode}
          onValueChange={(value) => {
            if (value === "comparison") {
              updateSection({
                ...section,
                content: { images: reindexUnique(images.slice(0, 2), "img") },
                layout: { ...section.layout, columns: 2, mode: "comparison" },
                type: "gallery",
              });
              return;
            }

            if (value === "grid") {
              updateSection({
                ...section,
                layout: {
                  ...section.layout,
                  columns: selectedColumns,
                  mode: "grid",
                },
                type: "gallery",
              });
            }
          }}
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {galleryModes.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`gallery.${value}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      {selectedMode === "grid" ? (
        <Field className="sm:col-span-2">
          <FieldLabel>{t("common.columnsLabel")}</FieldLabel>
          <Select
            items={columnItems}
            value={String(selectedColumns)}
            onValueChange={(value) =>
              value &&
              updateSection({
                ...section,
                layout: {
                  ...section.layout,
                  columns: Number(value) as 3 | 4,
                  mode: "grid",
                },
                type: "gallery",
              })
            }
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {columnItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field>
        <FieldLabel>{t("gallery.globalFit")}</FieldLabel>
        <Select
          items={imageFitItems}
          value={sharedFit}
          onValueChange={(value) =>
            value &&
            onImagesChange(
              images.map((image) =>
                markImageFieldManual(
                  { ...image, fit: value as ImageFit },
                  "fit",
                ),
              ),
            )
          }
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={t("common.mixedValues")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {imageFitItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{t("gallery.globalRatio")}</FieldLabel>
        <Select
          items={aspectRatioItems}
          value={sharedAspectRatio}
          onValueChange={(value) =>
            value &&
            onImagesChange(
              images.map((image) =>
                markImageFieldManual(
                  { ...image, aspect_ratio: value as ImageAspectRatio },
                  "aspect_ratio",
                ),
              ),
            )
          }
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={t("common.mixedValues")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {aspectRatioItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <div className="contents sm:[&>*]:col-span-2">
        <FileContainerPresentationControls
          backgroundColor={section.layout.imageBackgroundColor}
          containerPadding={section.layout.imageContainerPadding}
          controlId={`${section.id}-global-image-presentation`}
          labels={{
            background: t("gallery.globalBackground"),
            padding: t("gallery.globalPadding"),
            transparent: t("image.transparentBackground"),
          }}
          onChange={updateGlobalPresentation}
          portalId={portalId}
        />
      </div>
    </div>
  );
}

function GallerySettingsPopover({
  onOpenChange,
  open,
  portalId,
  section,
  trigger,
  updateSection,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  portalId: string;
  section: PortalSection;
  trigger: ReactElement;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.gallery");
  const images = uniqueForRender(section.content.images ?? [], "img");

  function saveImages(nextImages: PortalImageItem[]) {
    updateSection({
      ...section,
      content: { images: reindexUnique(nextImages, "img") },
      type: "gallery",
    });
  }

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-80" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("settings")}</PopoverTitle>
          <PopoverDescription>{t("settingsDescription")}</PopoverDescription>
        </PopoverHeader>
        <ImproveWithAiButton
          portalId={portalId}
          target={{
            description: section.description,
            id: section.id,
            kind: "section",
            title: section.title,
          }}
        />
        <GalleryLayoutControls
          images={images}
          onImagesChange={saveImages}
          portalId={portalId}
          section={section}
          updateSection={updateSection}
        />
      </PopoverContent>
    </Popover>
  );
}

function FilesLayoutControls({
  section,
  updateSection,
}: {
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor");
  const columnItems = [3, 4].map((columns) => ({
    label: t("common.columns", { count: columns }),
    value: String(columns),
  }));
  const selectedColumns = [3, 4].includes(section.layout.columns ?? 3)
    ? (section.layout.columns ?? 3)
    : 3;

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("common.columnsLabel")}</FieldLabel>
        <Select
          items={columnItems}
          value={String(selectedColumns)}
          onValueChange={(value) =>
            value &&
            updateSection({
              ...section,
              layout: {
                ...section.layout,
                columns: Number(value) as 3 | 4,
                mode: "cards",
              },
            })
          }
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {columnItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}

function FilesSettingsPopover({
  onOpenChange,
  open,
  portalId,
  section,
  trigger,
  updateSection,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  portalId: string;
  section: PortalSection;
  trigger: ReactElement;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.files");
  const aiT = useTranslations("PortalEditor.ai");
  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-72" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("settings")}</PopoverTitle>
          <PopoverDescription>{t("settingsDescription")}</PopoverDescription>
        </PopoverHeader>
        <ImproveWithAiButton
          buttonLabel={aiT("improveTextLabel")}
          className="rounded-full"
          portalId={portalId}
          target={{
            description: section.description,
            id: section.id,
            kind: "section",
            title: section.title,
          }}
        />
        <FilesLayoutControls section={section} updateSection={updateSection} />
      </PopoverContent>
    </Popover>
  );
}

function ColorsSettingsPopover({
  onOpenChange,
  open,
  portalId,
  section,
  trigger,
  updateSection,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  portalId: string;
  section: PortalSection;
  trigger: ReactElement;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor");
  const layoutModeItems = [
    { label: t("colors.palette"), value: "palette" },
    { label: t("colors.stack"), value: "stack" },
  ];
  const columnItems = [3, 4, 5, 6].map((columns) => ({
    label: t("common.columns", { count: columns }),
    value: String(columns),
  }));
  const isStackLayout = section.layout.mode === "stack";

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-80" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("colors.settings")}</PopoverTitle>
          <PopoverDescription>
            {t("colors.settingsDescription")}
          </PopoverDescription>
        </PopoverHeader>
        <ImproveWithAiButton
          portalId={portalId}
          target={{
            description: section.description,
            id: section.id,
            kind: "section",
            title: section.title,
          }}
        />
        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("common.layout")}</FieldLabel>
              <Select
                items={layoutModeItems}
                value={section.layout.mode ?? "palette"}
                onValueChange={(value) =>
                  value &&
                  updateSection({
                    ...section,
                    layout: {
                      ...section.layout,
                      mode: value as PortalSection["layout"]["mode"],
                    },
                  })
                }
              >
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {layoutModeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("common.columnsLabel")}</FieldLabel>
              <Select
                disabled={isStackLayout}
                items={columnItems}
                value={String(section.layout.columns ?? 4)}
                onValueChange={(value) =>
                  value &&
                  updateSection({
                    ...section,
                    layout: {
                      ...section.layout,
                      columns: Number(value) as 1 | 2 | 3 | 4 | 5 | 6,
                    },
                  })
                }
              >
                <SelectTrigger
                  className="w-full"
                  disabled={isStackLayout}
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {columnItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field orientation="horizontal">
            <FieldLabel htmlFor={`${section.id}-show-color-name`}>
              {t("colors.showName")}
            </FieldLabel>
            <Switch
              checked={
                section.layout.columns === 6
                  ? false
                  : (section.layout.showColorName ?? true)
              }
              disabled={section.layout.columns === 6}
              id={`${section.id}-show-color-name`}
              onCheckedChange={(checked) =>
                updateSection({
                  ...section,
                  layout: { ...section.layout, showColorName: checked },
                })
              }
            />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor={`${section.id}-show-color-code`}>
              {t("colors.showCode")}
            </FieldLabel>
            <Switch
              checked={
                section.layout.columns === 6
                  ? false
                  : (section.layout.showColorCode ?? true)
              }
              disabled={section.layout.columns === 6}
              id={`${section.id}-show-color-code`}
              onCheckedChange={(checked) =>
                updateSection({
                  ...section,
                  layout: { ...section.layout, showColorCode: checked },
                })
              }
            />
          </Field>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

function ImageEditor({
  portalId,
  portalSlug,
  section,
  updateSection,
}: {
  portalId: string;
  portalSlug: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const image = section.content.image;
  if (!image) {
    return (
      <AddImageTile
        ownerKey={section.id}
        portalId={portalId}
        onAdd={(nextImage) =>
          updateSection({
            ...section,
            content: { image: { ...nextImage, position: 0 } },
          })
        }
      />
    );
  }
  return (
    <SortableGalleryItem
      captionEditable
      image={image}
      index={0}
      sectionId={section.id}
      onRemove={() => {
        updateSection({ ...section, content: { image: null } });
      }}
      onSave={(nextImage) =>
        updateSection({ ...section, content: { image: nextImage } })
      }
      portalId={portalId}
      portalSlug={portalSlug}
    />
  );
}

function SortableGalleryItem({
  captionEditable = false,
  image,
  index,
  onRemove,
  onSave,
  portalId,
  portalSlug,
  sectionId,
  localMode = false,
  overlayContainer,
  quickColors,
  demoTargetPrefix,
}: {
  captionEditable?: boolean;
  image: PortalImageItem;
  index: number;
  onRemove: () => void;
  onSave: (image: PortalImageItem) => void;
  portalId: string;
  portalSlug: string;
  sectionId: string;
  localMode?: boolean;
  overlayContainer?: HTMLElement | null;
  quickColors?: string[];
  demoTargetPrefix?: string;
}) {
  const { handleRef, isDragging, ref } = useSortable({
    group: sectionId,
    id: image.id,
    index,
    plugins: (defaults) =>
      defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
  });

  return (
    <div className="h-fit self-start" ref={ref}>
      <ImageTile
        captionEditable={captionEditable}
        dragHandleRef={handleRef}
        image={image}
        isDragging={isDragging}
        onRemove={onRemove}
        onSave={onSave}
        portalId={portalId}
        portalSlug={portalSlug}
        localMode={localMode}
        overlayContainer={overlayContainer}
        quickColors={quickColors}
        demoTargetPrefix={demoTargetPrefix}
      />
    </div>
  );
}

function GalleryDropTarget({
  children,
  index,
  sectionId,
}: {
  children: ReactNode;
  index: number;
  sectionId: string;
}) {
  const { isDropTarget, ref } = useSortable({
    disabled: { draggable: true },
    group: sectionId,
    id: `gallery-drop-${sectionId}`,
    index,
    plugins: (defaults) =>
      defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
  });

  return (
    <div
      className={cn(
        "order-last grid h-fit w-full self-start",
        isDropTarget && "rounded-xl ring-2 ring-primary",
      )}
      ref={ref}
    >
      {children}
    </div>
  );
}

type GalleryEditorProps = {
  portalId: string;
  portalSlug: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
  localMode?: boolean;
  overlayContainer?: HTMLElement | null;
  quickColors?: string[];
};

function GalleryEditor(props: GalleryEditorProps) {
  if (props.localMode) {
    return (
      <GalleryEditorContent {...props} maxImages={Number.POSITIVE_INFINITY} />
    );
  }
  return <ManagedGalleryEditor {...props} />;
}

function ManagedGalleryEditor(props: GalleryEditorProps) {
  const { requestUpgrade, snapshot, status } = usePortalPlan();
  const isComparison =
    props.section.layout.mode === "comparison" ||
    props.section.type === "image_comparison";
  const maxImages = isComparison
    ? 2
    : status === "ready"
      ? (snapshot.policy.sections.gallery?.items ?? Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;
  return (
    <GalleryEditorContent
      {...props}
      maxImages={maxImages}
      requestUpgrade={requestUpgrade}
      status={status}
    />
  );
}

function GalleryEditorContent({
  portalId,
  portalSlug,
  section,
  updateSection,
  localMode = false,
  overlayContainer,
  quickColors,
  maxImages,
  requestUpgrade,
  status = "unavailable",
}: GalleryEditorProps & {
  maxImages: number;
  requestUpgrade?: (code: "gallery_items") => void;
  status?: "error" | "loading" | "ready" | "unavailable";
}) {
  const t = useTranslations("PortalEditor.gallery");
  const isComparison =
    section.layout.mode === "comparison" || section.type === "image_comparison";
  const images = uniqueForRender(section.content.images ?? [], "img").slice(
    0,
    maxImages,
  );
  const imagesRef = useRef(images);
  const sectionRef = useRef(section);
  useEffect(() => {
    imagesRef.current = images;
    sectionRef.current = section;
  }, [images, section]);
  function saveImages(nextImages: PortalImageItem[]) {
    const currentSection = sectionRef.current;
    const currentIsComparison =
      currentSection.layout.mode === "comparison" ||
      currentSection.type === "image_comparison";
    const limitedImages = currentIsComparison
      ? nextImages.slice(0, 2)
      : nextImages;
    updateSection({
      ...currentSection,
      content: { images: reindexUnique(limitedImages, "img") },
      layout: currentIsComparison
        ? { ...currentSection.layout, columns: 2, mode: "comparison" }
        : currentSection.layout,
      type: "gallery",
    });
  }
  const columns = isComparison
    ? 2
    : [3, 4].includes(section.layout.columns ?? 3)
      ? (section.layout.columns ?? 3)
      : 3;
  const sharedAspectRatio = images.every(
    (image) => image.aspect_ratio === images[0]?.aspect_ratio,
  )
    ? images[0]?.aspect_ratio
    : null;
  const addImageAspectRatio = sharedAspectRatio ?? "auto";
  const imageLimitReached =
    status === "ready" &&
    Number.isFinite(maxImages) &&
    images.length >= maxImages;
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "grid items-start gap-4",
          columns === 2 && "grid-cols-2",
          columns === 3 &&
            "grid-cols-2 lg:grid-cols-3 group-data-[style-mode=desktop]/portal:grid-cols-3! group-data-[style-mode=mobile]/portal:grid-cols-2!",
          columns === 4 &&
            "grid-cols-3 lg:grid-cols-4 group-data-[style-mode=desktop]/portal:grid-cols-4! group-data-[style-mode=mobile]/portal:grid-cols-3!",
        )}
      >
        {images.map((image, index) => (
          <SortableGalleryItem
            captionEditable={isComparison}
            image={image}
            index={index}
            key={image.id}
            portalId={portalId}
            portalSlug={portalSlug}
            sectionId={section.id}
            localMode={localMode}
            overlayContainer={overlayContainer}
            quickColors={quickColors}
            demoTargetPrefix={
              localMode && index === 0 ? "first-image" : undefined
            }
            onRemove={() => {
              saveImages(images.filter((item) => item.id !== image.id));
            }}
            onSave={(nextImage) =>
              saveImages(
                images.map((item) =>
                  item.id === nextImage.id ? nextImage : item,
                ),
              )
            }
          />
        ))}
        {!localMode && images.length < maxImages ? (
          <GalleryDropTarget index={images.length} sectionId={section.id}>
            <AddImageTile
              aspectRatio={addImageAspectRatio}
              category="gallery"
              maxFiles={maxImages - images.length}
              ownerKey={section.id}
              portalId={portalId}
              onAdd={(image) => {
                const nextImages = [
                  ...imagesRef.current,
                  applySectionImagePresentation(
                    {
                      ...image,
                      aspect_ratio: addImageAspectRatio,
                      position: imagesRef.current.length,
                    },
                    sectionRef.current.layout,
                  ),
                ];
                imagesRef.current = nextImages;
                saveImages(nextImages);
              }}
            />
          </GalleryDropTarget>
        ) : imageLimitReached && !isComparison ? (
          <button
            aria-label={t("limitReached")}
            className="flex aspect-square items-center justify-center rounded-xl border border-dashed text-muted-foreground"
            onClick={() => requestUpgrade?.("gallery_items")}
            type="button"
          >
            <span className="text-center text-sm">{t("limitReached")}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ColorDialog({
  color,
  onSave,
  overlayContainer,
  trigger,
}: {
  color?: PortalColorItem;
  onSave: (color: PortalColorItem) => void;
  overlayContainer?: HTMLElement | null;
  trigger: ReactElement;
}) {
  const t = useTranslations("PortalEditor");
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ColorFormat>(() =>
    detectColorFormat(color),
  );
  const [draft, setDraft] = useState<PortalColorItem>(() =>
    createColorDraft(color),
  );

  useEffect(() => {
    if (!open) return;
    setDraft(createColorDraft(color));
    setFormat(detectColorFormat(color));
  }, [color, open]);

  const hexValue = draft.color_code.startsWith("#")
    ? normalizeHexInput(draft.color_code)
    : "";
  const pickerValue = visualColorPickerValue(draft.color_code);
  const colorFormatItems = colorFormats.map((value) => ({
    label: t(`colors.formats.${value}`),
    value,
  }));

  function updateFormat(value: ColorFormat) {
    setFormat(value);
    setDraft({ ...draft, color_code: formatPickerColor(pickerValue, value) });
  }

  function updateFromPicker(value: string) {
    setDraft({ ...draft, color_code: value });
  }

  return (
    <Dialog
      disablePointerDismissal={Boolean(overlayContainer)}
      modal={overlayContainer ? false : undefined}
      onOpenChange={(nextOpen) =>
        applyContainedDemoOverlayOpenChange(
          Boolean(overlayContainer),
          nextOpen,
          setOpen,
        )
      }
      open={open}
    >
      <DialogTrigger render={trigger} />
      <DialogContent
        className={
          overlayContainer
            ? "w-[min(28rem,calc(100%-2rem))] max-w-none"
            : undefined
        }
        contained={Boolean(overlayContainer)}
        portalContainer={overlayContainer}
      >
        <DialogHeader>
          <DialogTitle>{t("colors.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("colors.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr] group-data-[style-mode=desktop]/portal:grid-cols-[160px_1fr]">
            <Field>
              <FieldLabel>{t("colors.format")}</FieldLabel>
              <Select
                items={colorFormatItems}
                value={format}
                onValueChange={(value) =>
                  value && updateFormat(value as ColorFormat)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("colors.format")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {colorFormatItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t("colors.picker")}</FieldLabel>
              <VisualColorPicker
                format={format}
                value={pickerValue}
                onChange={updateFromPicker}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>{t("colors.code")}</FieldLabel>
            {format === "hex" || format === "hexa" ? (
              <div className="flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="px-2.5 text-muted-foreground text-sm">#</span>
                <Input
                  demo-id={!color ? "color-code" : undefined}
                  data-portal-demo-target={!color ? "color-code" : undefined}
                  className="border-none px-0 shadow-none focus-visible:ring-0"
                  maxLength={format === "hexa" ? 8 : 6}
                  placeholder={format === "hexa" ? "FF0000FF" : "FF0000"}
                  value={hexValue}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      color_code: toHexColor(e.currentTarget.value),
                    })
                  }
                />
              </div>
            ) : (
              <Input
                className="font-mono"
                placeholder={formatPickerColor("#FF0000", format)}
                value={draft.color_code}
                onChange={(e) =>
                  setDraft({ ...draft, color_code: e.currentTarget.value })
                }
              />
            )}
          </Field>

          <Field>
            <FieldLabel>{t("colors.name")}</FieldLabel>
            <Input
              maxLength={colorNameMaxLength}
              placeholder={t("colors.namePlaceholder")}
              value={draft.color_name}
              onChange={(e) =>
                setDraft({ ...draft, color_name: e.currentTarget.value })
              }
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor={`${draft.id}-visible`}>
              {t("common.visible")}
            </FieldLabel>
            <Switch
              checked={draft.visible}
              id={`${draft.id}-visible`}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, visible: checked })
              }
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            demo-id={!color ? "save-color" : undefined}
            data-portal-demo-target={!color ? "save-color" : undefined}
            onClick={() => {
              onSave({
                ...draft,
                color_code:
                  format === "hex" || format === "hexa"
                    ? completeHexColor(draft.color_code, format)
                    : draft.color_code,
              });
              setOpen(false);
            }}
            type="button"
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableColorItem({
  color,
  index,
  isStack,
  onRemove,
  onSave,
  showColorCode,
  showColorName,
}: {
  color: PortalColorItem;
  index: number;
  isStack: boolean;
  onRemove: () => void;
  onSave: (color: PortalColorItem) => void;
  showColorCode: boolean;
  showColorName: boolean;
}) {
  const t = useTranslations("PortalEditor.colors");
  const { handleRef, isDragging, ref } = useSortable({
    group: "colors",
    id: color.id,
    index,
  });

  return (
    <div
      className={cn(
        "group/item relative",
        isStack && "flex items-center gap-3",
        !color.visible && "opacity-50",
        isDragging && "opacity-70",
      )}
      ref={ref}
    >
      <button
        aria-label={t("move")}
        className={cn(
          "aspect-square cursor-grab rounded-lg border active:cursor-grabbing",
          isStack ? "size-14 shrink-0" : "w-full",
        )}
        ref={handleRef}
        style={{ backgroundColor: color.color_code }}
        type="button"
      />
      {showColorName || showColorCode ? (
        <div
          className={cn(
            "flex min-w-0 flex-col items-start justify-start gap-1 text-sm",
            !isStack && "mt-3",
          )}
        >
          {showColorName ? (
            <div className="max-w-full truncate font-medium">
              {color.color_name || t("fallback")}
            </div>
          ) : null}
          {showColorCode ? (
            <span
              className={cn("max-w-full truncate text-muted-foreground", {
                "text-primary": !showColorName,
              })}
            >
              {color.color_code}
            </span>
          ) : null}
        </div>
      ) : null}
      <PortalItemActionsOverlay forceVisible position="top-3-right">
        <ColorDialog
          color={color}
          onSave={onSave}
          trigger={
            <PortalActionTriggerButton
              icon="edit"
              label={t("edit")}
              variant="ghost"
            />
          }
        />
        <Button
          className="rounded-full"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <IconX data-icon="inline-start" />
        </Button>
      </PortalItemActionsOverlay>
    </div>
  );
}

function ColorsEditor({
  section,
  updateSection,
  overlayContainer,
}: {
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
  overlayContainer?: HTMLElement | null;
}) {
  const colors = uniqueForRender(section.content.colors ?? [], "color");
  const isStack = section.layout.mode === "stack";
  const columns = isStack ? 1 : (section.layout.columns ?? 4);
  const showColorName =
    columns === 6 ? false : (section.layout.showColorName ?? true);
  const showColorCode =
    columns === 6 ? false : (section.layout.showColorCode ?? true);

  function saveColors(nextColors: PortalColorItem[]) {
    updateSection({
      ...section,
      content: { colors: reindexUnique(nextColors, "color") },
    });
  }
  return (
    <div className="flex flex-col gap-4">
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled || !event.operation.target) {
            return;
          }

          const nextColors = move(colors, event);

          if (nextColors !== colors) {
            saveColors(nextColors);
          }
        }}
      >
        <div
          className={cn(
            isStack ? "flex flex-col gap-4" : "grid gap-4",
            !isStack &&
              columns === 3 &&
              "grid-cols-2 lg:grid-cols-3 group-data-[style-mode=desktop]/portal:grid-cols-3! group-data-[style-mode=mobile]/portal:grid-cols-2!",
            !isStack &&
              columns === 4 &&
              "grid-cols-3 lg:grid-cols-4 group-data-[style-mode=desktop]/portal:grid-cols-4! group-data-[style-mode=mobile]/portal:grid-cols-3!",
            !isStack &&
              columns === 5 &&
              "grid-cols-4 lg:grid-cols-5 group-data-[style-mode=desktop]/portal:grid-cols-5! group-data-[style-mode=mobile]/portal:grid-cols-4!",
            !isStack &&
              columns === 6 &&
              "grid-cols-5 lg:grid-cols-6 group-data-[style-mode=desktop]/portal:grid-cols-6! group-data-[style-mode=mobile]/portal:grid-cols-5!",
          )}
        >
          {colors.map((color, index) => (
            <SortableColorItem
              color={color}
              index={index}
              isStack={isStack}
              key={color.id}
              onRemove={() =>
                saveColors(colors.filter((item) => item.id !== color.id))
              }
              onSave={(nextColor) =>
                saveColors(
                  colors.map((item) =>
                    item.id === nextColor.id ? nextColor : item,
                  ),
                )
              }
              showColorCode={showColorCode}
              showColorName={showColorName}
            />
          ))}
          <ColorDialog
            overlayContainer={overlayContainer}
            onSave={(color) =>
              saveColors([...colors, { ...color, position: colors.length }])
            }
            trigger={
              <button
                data-portal-demo-target="add-color"
                className={cn(
                  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-background text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isStack ? "size-14 shrink-0" : "aspect-square",
                )}
                type="button"
              >
                <IconPlus className="size-4" />
              </button>
            }
          />
        </div>
      </DragDropProvider>
    </div>
  );
}

const maxFontFamilies = 4;

function inferFontMetadata(fileName: string) {
  const cleanName = fileName.replace(/\.(otf|ttf|woff2?|ttc)$/i, "");
  const normalized = cleanName.replace(/[_.]+/g, "-");
  const weightPatterns: Array<[RegExp, number]> = [
    [/thin/i, 100],
    [/(extra|ultra)[-\s]?light/i, 200],
    [/light/i, 300],
    [/(regular|book|roman|normal)/i, 400],
    [/medium/i, 500],
    [/(semi|demi)[-\s]?bold/i, 600],
    [/(extra|ultra)[-\s]?bold/i, 800],
    [/(black|heavy)/i, 900],
    [/bold/i, 700],
  ];
  const numericWeight = normalized.match(/(^|[-\s])([1-9]00)([-\s]|$)/);
  const weight = numericWeight
    ? Number(numericWeight[2])
    : (weightPatterns.find(([pattern]) => pattern.test(normalized))?.[1] ??
      400);
  const family = normalized
    .replace(
      /[-\s]?(thin|extra[-\s]?light|ultra[-\s]?light|light|regular|book|roman|normal|medium|semi[-\s]?bold|demi[-\s]?bold|bold|extra[-\s]?bold|ultra[-\s]?bold|black|heavy)([-\s]?(italic|oblique))?/gi,
      "",
    )
    .replace(/[-\s]?[1-9]00([-\s]?(italic|oblique))?/gi, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    fontName: family || cleanName,
    weight,
  };
}

function fontFamilyFor(font: PortalFontItem) {
  return `portal-font-${font.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function fontFaceFor(font: PortalFontItem) {
  if (!font.file_url) return null;
  return `@font-face{font-family:"${fontFamilyFor(font)}";src:url("${font.file_url}");font-weight:${font.weight ?? 400};font-style:normal;font-display:swap;}`;
}

function FontDialog({
  font,
  onSave,
  portalId,
  trigger,
}: {
  font?: PortalFontItem;
  onSave: (font: PortalFontItem | PortalFontItem[]) => void;
  portalId: string;
  trigger: ReactElement;
}) {
  const t = useTranslations("PortalEditor.fonts");
  const { requestUpgrade, snapshot, status } = usePortalPlan();
  const viewerT = useTranslations("PortalViewer.fonts");
  const weightLabel = (weight: number) => String(weight);
  const weightName = (weight: number) => {
    const key = fontWeightMessageKey(weight);
    return key ? t(key) : t("weightFallback");
  };
  const [draft, setDraft] = useState<PortalFontItem>(() =>
    font
      ? { ...font }
      : {
          font_name: "",
          id: createRandomId("font"),
          position: 0,
          sample_description: viewerT("sampleDescription"),
          sample_text: viewerT("sampleTitle"),
          visible: true,
          weight: 400,
          weights: "400",
        },
  );
  const [uploadedFonts, setUploadedFonts] = useState<PortalFontItem[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const optimistic = useOptimisticUploads<PortalFontItem>();
  const isUploading = optimistic.pending.length > 0;
  const canSave = font
    ? Boolean(draft.file_url) && !isUploading
    : uploadedFonts.length > 0 && !isUploading;
  const displayedFonts = font
    ? [draft]
    : [...uploadedFonts, ...optimistic.pending.map(({ value }) => value)];
  const dialogFontFaces = displayedFonts
    .map(fontFaceFor)
    .filter(Boolean)
    .join("\n");

  function handleSave() {
    onSave(font ? draft : uploadedFonts);
    setUploadedFonts([]);
    if (inputRef.current) inputRef.current.value = "";
    setOpen(false);
  }

  function handleFontFiles(fileList: FileList | null | undefined) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    if (status !== "ready") {
      requestUpgrade("plan_unavailable");
      return;
    }
    if (files.some((file) => file.size > snapshot.policy.maxUploadBytes)) {
      requestUpgrade("upload_bytes", undefined, {
        fileSizeBytes: Math.max(...files.map((file) => file.size)),
      });
      return;
    }
    if (
      snapshot.storageUsedBytes +
        files.reduce((total, file) => total + file.size, 0) >
      snapshot.policy.storageBytes
    ) {
      requestUpgrade("storage_bytes", undefined, {
        fileSizeBytes: files.reduce((total, file) => total + file.size, 0),
      });
      return;
    }

    for (const [index, file] of files.entries()) {
      const metadata = inferFontMetadata(file.name);
      const pending = optimistic.add(file, ({ id, previewUrl }) => ({
        file_name: file.name,
        file_url: previewUrl,
        font_name: metadata.fontName,
        id,
        position: uploadedFonts.length + index,
        sample_description: viewerT("sampleDescription"),
        sample_text: viewerT("sampleTitle"),
        visible: true,
        weight: metadata.weight,
        weights: weightLabel(metadata.weight),
      }));
      void (async () => {
        try {
          const asset = await uploadPortalAsset({
            category: "font",
            file,
            portalId,
          });
          if (!asset.previewUrl) throw new Error(t("uploadError"));
          const uploaded = {
            asset_id: asset.assetId,
            file_name: file.name,
            file_url: asset.previewUrl,
            storage_path: asset.path,
            font_name: metadata.fontName,
            id: pending.id.replace(/^pending_/, "font_"),
            position: pending.value.position,
            sample_description: viewerT("sampleDescription"),
            sample_text: viewerT("sampleTitle"),
            visible: true,
            weight: metadata.weight,
            weights: weightLabel(metadata.weight),
          } satisfies PortalFontItem;
          const reconciled = await reconcileOptimisticUpload({
            asset: uploaded,
            commit: (finalized) => {
              setUploadedFonts((current) => [...current, finalized]);
              setDraft((current) => (current.file_url ? current : finalized));
            },
            discard: (finalized) =>
              deleteManagedPortalAsset(finalized.asset_id, fetch, portalId),
            id: pending.id,
            registry: optimistic,
          });
          if (reconciled) {
            await flushPortalAutosave(portalId);
            releaseManagedPortalAsset(asset.assetId);
          }
        } catch (error) {
          const stillOwned = optimistic.owns(pending.id);
          optimistic.remove(pending.id);
          if (!stillOwned) return;
          console.error("Portal font upload failed", {
            error: error instanceof Error ? error.message : String(error),
            portalId,
          });
          toast.error(t("uploadError"), {
            id: `portal-font-upload-error:${portalId}`,
          });
        }
      })();
    }
  }

  function handleFontFile(file: File | undefined) {
    if (!file) return;
    if (status !== "ready") {
      requestUpgrade("plan_unavailable");
      return;
    }
    if (file.size > snapshot.policy.maxUploadBytes) {
      requestUpgrade("upload_bytes", undefined, { fileSizeBytes: file.size });
      return;
    }
    if (snapshot.storageUsedBytes + file.size > snapshot.policy.storageBytes) {
      requestUpgrade("storage_bytes", undefined, { fileSizeBytes: file.size });
      return;
    }
    const metadata = inferFontMetadata(file.name);

    const previousDraft = draft;
    const pending = optimistic.add(file, ({ id, previewUrl }) => ({
      ...draft,
      file_name: file.name,
      file_url: previewUrl,
      font_name: draft.font_name || metadata.fontName,
      id,
      weight: metadata.weight,
      weights: weightLabel(metadata.weight),
    }));
    setDraft(pending.value);
    void (async () => {
      try {
        const asset = await uploadPortalAsset({
          category: "font",
          file,
          portalId,
        });
        if (!asset.previewUrl) throw new Error(t("uploadError"));
        const reconciled = await reconcileOptimisticUpload({
          asset,
          commit: (finalized) =>
            setDraft((current) => ({
              ...current,
              asset_id: finalized.assetId,
              file_name: file.name,
              file_url: finalized.previewUrl,
              font_name: current.font_name || metadata.fontName,
              id: previousDraft.id,
              storage_path: finalized.path,
            })),
          discard: (finalized) =>
            deleteManagedPortalAsset(finalized.assetId, fetch, portalId),
          id: pending.id,
          registry: optimistic,
        });
        if (reconciled) {
          await flushPortalAutosave(portalId);
          releaseManagedPortalAsset(asset.assetId);
        }
      } catch (error) {
        const stillOwned = optimistic.owns(pending.id);
        optimistic.remove(pending.id);
        if (!stillOwned) return;
        setDraft((current) =>
          rollbackOptimisticFontFile(previousDraft, current, pending.id),
        );
        console.error("Portal font replacement failed", {
          error: error instanceof Error ? error.message : String(error),
          portalId,
        });
        toast.error(t("uploadError"), {
          id: `portal-font-upload-error:${portalId}`,
        });
      }
    })();
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        {dialogFontFaces ? <style>{dialogFontFaces}</style> : null}
        <DialogHeader>
          <DialogTitle>
            {font ? t("dialogTitle") : t("uploadFamily")}
          </DialogTitle>
          <DialogDescription>
            {font ? t("editDescription") : t("uploadDescription")}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{t("file")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
                type="button"
                variant="outline"
              >
                <IconPlus data-icon="inline-start" />
                {isUploading
                  ? t("uploading")
                  : font
                    ? t("replace")
                    : t("upload")}
              </Button>
              {font && (draft.file_name || draft.file_url) ? (
                <span className="text-muted-foreground text-sm">
                  {draft.file_name || t("uploaded")}
                </span>
              ) : null}
              {!font && uploadedFonts.length ? (
                <span className="text-muted-foreground text-sm">
                  {t("filesReady", { count: uploadedFonts.length })}
                </span>
              ) : null}
            </div>
            <input
              accept=".otf,.ttf,.woff,.woff2,font/*"
              className="sr-only"
              ref={inputRef}
              type="file"
              multiple={!font}
              onChange={(event) =>
                font
                  ? handleFontFile(event.currentTarget.files?.[0])
                  : handleFontFiles(event.currentTarget.files)
              }
            />
          </Field>
          {font ? (
            <>
              <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
                <Field>
                  <FieldLabel>{t("familyDetected")}</FieldLabel>
                  <Input
                    value={draft.font_name}
                    onChange={(e) =>
                      setDraft({ ...draft, font_name: e.currentTarget.value })
                    }
                    placeholder="Labil Grotesk"
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("weight")}</FieldLabel>
                  <Input
                    inputMode="numeric"
                    min={100}
                    max={900}
                    step={100}
                    type="number"
                    value={draft.weight ?? 400}
                    onChange={(e) => {
                      const weight = Number(e.currentTarget.value) || 400;
                      setDraft({
                        ...draft,
                        weight,
                        weights: weightLabel(weight),
                      });
                    }}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>{t("previewTitle")}</FieldLabel>
                <Input
                  value={draft.sample_text ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, sample_text: e.currentTarget.value })
                  }
                  placeholder={viewerT("sampleTitle")}
                />
              </Field>
              <Field>
                <FieldLabel>{t("previewDescription")}</FieldLabel>
                <Textarea
                  value={draft.sample_description ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sample_description: e.currentTarget.value,
                    })
                  }
                  placeholder={viewerT("sampleDescription")}
                />
              </Field>
            </>
          ) : displayedFonts.length ? (
            <div className="scroll-fade-y max-h-72 overflow-y-auto">
              <div className="flex flex-col gap-2">
                {displayedFonts.map((item) => (
                  <Attachment
                    aria-busy={optimistic.pending.some(
                      ({ id }) => id === item.id,
                    )}
                    className={cn(
                      "w-full",
                      optimistic.pending.some(({ id }) => id === item.id) &&
                        "animate-pulse opacity-60",
                    )}
                    key={item.id}
                  >
                    <AttachmentMedia>
                      <span
                        className="font-semibold text-xs"
                        style={
                          item.file_url
                            ? { fontFamily: `"${fontFamilyFor(item)}"` }
                            : undefined
                        }
                      >
                        Aa
                      </span>
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{item.font_name}</AttachmentTitle>
                      <AttachmentDescription>
                        {fontWeightLabel(item, weightName(item.weight ?? 400))}{" "}
                        · {item.file_name}
                      </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      {!optimistic.pending.some(({ id }) => id === item.id) ? (
                        <AttachmentAction
                          aria-label={t("remove", {
                            name: item.file_name || t("uploaded"),
                          })}
                          onClick={() =>
                            setUploadedFonts((current) =>
                              current.filter(
                                (fontItem) => fontItem.id !== item.id,
                              ),
                            )
                          }
                          type="button"
                        >
                          <IconX data-icon="inline-start" />
                        </AttachmentAction>
                      ) : null}
                    </AttachmentActions>
                  </Attachment>
                ))}
              </div>
            </div>
          ) : null}
          {font ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={draft.visible}
                onChange={(e) =>
                  setDraft({ ...draft, visible: e.currentTarget.checked })
                }
                type="checkbox"
              />
              {t("visible")}
            </label>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button disabled={!canSave} onClick={handleSave} type="button">
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FontFamilyDialog({
  family,
  fonts,
  onSave,
  trigger,
}: {
  family: string;
  fonts: PortalFontItem[];
  onSave: (fonts: PortalFontItem[]) => void;
  trigger: ReactElement;
}) {
  const t = useTranslations("PortalEditor.fonts");
  const weightName = (weight: number) => {
    const key = fontWeightMessageKey(weight);
    return key ? t(key) : t("weightFallback");
  };
  const [familyName, setFamilyName] = useState(family);
  const [draftFonts, setDraftFonts] = useState(fonts);

  useEffect(() => {
    setFamilyName(family);
    setDraftFonts(fonts);
  }, [family, fonts]);

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editFamily")}</DialogTitle>
          <DialogDescription>{t("editFamilyDescription")}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{t("familyName")}</FieldLabel>
            <Input
              value={familyName}
              onChange={(event) => setFamilyName(event.currentTarget.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("familyWeights")}</FieldLabel>
            {draftFonts.length ? (
              <div className="scroll-fade-y max-h-72 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  {draftFonts.map((font) => (
                    <Attachment className="w-full" key={font.id}>
                      <AttachmentMedia>
                        <span
                          className="font-semibold text-xs"
                          style={
                            font.file_url
                              ? { fontFamily: `"${fontFamilyFor(font)}"` }
                              : undefined
                          }
                        >
                          Aa
                        </span>
                      </AttachmentMedia>
                      <AttachmentContent>
                        <AttachmentTitle>
                          {fontWeightLabel(
                            font,
                            weightName(font.weight ?? 400),
                          )}
                        </AttachmentTitle>
                        <AttachmentDescription>
                          {font.file_name || t("uploaded")}
                        </AttachmentDescription>
                      </AttachmentContent>
                      <AttachmentActions>
                        <AttachmentAction
                          aria-label={t("delete", {
                            name:
                              font.file_name ||
                              fontWeightLabel(
                                font,
                                weightName(font.weight ?? 400),
                              ),
                          })}
                          onClick={() =>
                            setDraftFonts((current) =>
                              current.filter((item) => item.id !== font.id),
                            )
                          }
                          type="button"
                        >
                          <IconX data-icon="inline-start" />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
                {t("noWeights")}
              </p>
            )}
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={() =>
              onSave(
                draftFonts.map((font) => ({
                  ...font,
                  font_name: familyName.trim() || family,
                })),
              )
            }
            type="button"
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fontWeightLabel(font: PortalFontItem, fallback: string) {
  const persistedWeight = Number.parseInt(font.weights ?? "", 10);
  const weight =
    font.weight ?? (Number.isNaN(persistedWeight) ? 400 : persistedWeight);
  return `${weight} ${fallback}`;
}

function groupedFonts(fonts: PortalFontItem[], undetectedFamily: string) {
  const groups = new Map<string, PortalFontItem[]>();
  for (const font of fonts.filter((item) => item.visible)) {
    const key = font.font_name || undetectedFamily;
    groups.set(key, [...(groups.get(key) ?? []), font]);
  }

  return Array.from(groups.entries())
    .map(([family, items]) => ({
      family,
      items: [...items].sort((a, b) => (b.weight ?? 400) - (a.weight ?? 400)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

function exceedsFontFamilyLimit(
  currentFonts: PortalFontItem[],
  nextFonts: PortalFontItem[],
  undetectedFamily: string,
) {
  const familyNames = new Set(
    currentFonts
      .filter((font) => font.visible)
      .map((font) => font.font_name || undetectedFamily),
  );
  for (const font of nextFonts) {
    familyNames.add(font.font_name || undetectedFamily);
  }
  return familyNames.size > maxFontFamilies;
}

export function FontsEditor({
  portalId,
  section,
  updateSection,
}: {
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.fonts");
  const viewerT = useTranslations("PortalViewer.fonts");
  const fonts = uniqueForRender(section.content.fonts ?? [], "font");
  const typeScaleSettings = section.content.type_scale_settings ?? {
    base_size: 20,
    ratio: 1.03,
  };
  function saveFonts(nextFonts: PortalFontItem[]) {
    updateSection({
      ...section,
      content: {
        ...section.content,
        fonts: reindexUnique(nextFonts, "font"),
        type_scale_settings: typeScaleSettings,
      },
    });
  }
  const fontGroups = groupedFonts(fonts, t("undetectedFamily"));
  const canAddFontFamily = fontGroups.length < maxFontFamilies;
  const fontFaces = fonts.map(fontFaceFor).filter(Boolean).join("\n");

  return (
    <div className="flex flex-col gap-8">
      {fontFaces ? <style>{fontFaces}</style> : null}
      <section className="flex flex-col gap-4">
        <PortalTypographyShowcase
          alphabetSample={viewerT("alphabetSample")}
          familiesLabel={viewerT("familiesLabel")}
          fonts={fonts}
          renderActions={(font) => {
            const group = fontGroups.find((candidate) =>
              candidate.items.some((item) => item.id === font.id),
            );
            if (!group) return null;

            return (
              <div className="flex gap-2">
                <FontFamilyDialog
                  family={group.family}
                  fonts={group.items}
                  onSave={(nextGroupFonts) => {
                    saveFonts([
                      ...fonts.filter(
                        (item) => !group.items.some(({ id }) => id === item.id),
                      ),
                      ...nextGroupFonts,
                    ]);
                  }}
                  trigger={
                    <PortalActionTriggerButton
                      icon="edit"
                      label={t("editFamily")}
                      variant="secondary"
                    />
                  }
                />
                <Button
                  aria-label={t("delete", { name: group.family })}
                  onClick={() => {
                    saveFonts(
                      fonts.filter(
                        (item) => !group.items.some(({ id }) => id === item.id),
                      ),
                    );
                  }}
                  size="icon-sm"
                  type="button"
                  variant="secondary"
                >
                  <IconX data-icon="inline-start" />
                </Button>
              </div>
            );
          }}
          sampleLabels={[
            viewerT("styles.heading1"),
            viewerT("styles.heading2"),
            viewerT("styles.heading3"),
            viewerT("styles.heading4"),
            viewerT("styles.body"),
            viewerT("styles.caption"),
          ]}
          undetectedFamily={t("undetectedFamily")}
          weightName={(weight) => {
            const key = fontWeightMessageKey(weight);
            return key ? t(key) : t("weightFallback");
          }}
        />
        <div className="flex flex-col gap-10">
          {canAddFontFamily ? (
            <FontDialog
              portalId={portalId}
              onSave={(font) => {
                const nextFonts = Array.isArray(font) ? font : [font];
                if (
                  exceedsFontFamilyLimit(
                    fonts,
                    nextFonts,
                    t("undetectedFamily"),
                  )
                )
                  return;
                saveFonts([
                  ...fonts,
                  ...nextFonts.map((item, index) => ({
                    ...item,
                    position: fonts.length + index,
                  })),
                ]);
              }}
              trigger={
                <Button
                  className="min-h-16 shadow-none"
                  type="button"
                  variant="outline"
                >
                  <IconPlus data-icon="inline-start" />
                </Button>
              }
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SortableFileItem({
  file,
  index,
  onRemove,
  onSave,
  portalId,
}: {
  file: PortalFileItem;
  index: number;
  onRemove: () => void;
  onSave: (file: PortalFileItem) => void;
  portalId: string;
}) {
  const { handleRef, isDragging, ref } = useSortable({
    group: "files",
    id: file.id,
    index,
  });

  return (
    <div
      className={cn("group/item relative", isDragging && "opacity-60")}
      ref={ref}
    >
      <div ref={handleRef}>
        <PortalFilePreview
          backgroundColor={file.background_color}
          className="cursor-grab active:cursor-grabbing"
          containerPadding={file.container_padding}
          fileName={file.display_name || file.file_name}
          fileUrl={file.file_url}
          type={
            file.file_type ??
            portalFileTypeFromName(file.file_name) ??
            undefined
          }
        />
      </div>
      <PortalItemActionsOverlay position="top-2-right">
        <FilesItemSettingsPopover
          file={file}
          onSave={onSave}
          portalId={portalId}
        />
        <Button
          className="rounded-full"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <IconX data-icon="inline-start" />
        </Button>
      </PortalItemActionsOverlay>
    </div>
  );
}

function FilesItemSettingsPopover({
  file,
  onSave,
  portalId,
}: {
  file: PortalFileItem;
  onSave: (file: PortalFileItem) => void;
  portalId: string;
}) {
  const t = useTranslations("PortalEditor.files");
  const imageT = useTranslations("PortalEditor.image");
  const [open, setOpen] = useState(false);
  const fileType = file.file_type ?? portalFileTypeFromName(file.file_name);
  const isImageFile = fileType === "image" || fileType === "svg";
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <PortalActionTriggerButton
            icon="settings"
            label={t("itemSettings")}
            variant="secondary"
          />
        }
      />
      <PopoverContent align="end" className="w-80" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("itemSettings")}</PopoverTitle>
          <PopoverDescription>
            {t("itemSettingsDescription")}
          </PopoverDescription>
        </PopoverHeader>
        <ImproveWithAiButton
          portalId={portalId}
          target={{
            description: file.description ?? "",
            id: file.id,
            kind: "file",
            name: file.display_name ?? file.file_name,
          }}
          variant="default"
        />
        <Field>
          <FieldLabel>{t("displayName")}</FieldLabel>
          <Input
            defaultValue={file.display_name ?? ""}
            onBlur={(event) =>
              onSave({
                ...file,
                display_name: event.currentTarget.value.trim(),
                field_origins: {
                  ...file.field_origins,
                  display_name: "manual",
                },
              })
            }
            placeholder={t("displayNamePlaceholder")}
          />
        </Field>
        {isImageFile ? (
          <FileContainerPresentationControls
            backgroundColor={file.background_color}
            containerPadding={file.container_padding}
            labels={{
              background: imageT("background"),
              padding: imageT("padding"),
              transparent: imageT("transparentBackground"),
            }}
            controlId={file.id}
            onChange={(presentation) => onSave({ ...file, ...presentation })}
            portalId={portalId}
          />
        ) : null}
        <Field>
          <FieldLabel>{t("downloadName")}</FieldLabel>
          <Input
            defaultValue={displayNameWithoutExtension(
              file.download_name || file.file_name,
            )}
            onBlur={(event) =>
              onSave({
                ...file,
                download_name: normalizeAssetDownloadName(
                  event.currentTarget.value,
                  file.file_name,
                ),
                field_origins: {
                  ...file.field_origins,
                  download_name: "manual",
                },
              })
            }
            placeholder={t("downloadNamePlaceholder")}
          />
        </Field>
      </PopoverContent>
    </Popover>
  );
}

function FilesEditor({
  portalId,
  section,
  updateSection,
}: {
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.files");
  const { requestUpgrade, snapshot, status } = usePortalPlan();
  const files = uniqueForRender(section.content.files ?? [], "file");
  const columns = [3, 4].includes(section.layout.columns ?? 3)
    ? (section.layout.columns ?? 3)
    : 3;
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(
    null,
  );
  const optimistic = useOptimisticUploads<PortalFileItem>();
  const fileLimit = snapshot.policy.sections.files?.items;
  const fileLimitReached =
    status === "ready" &&
    fileLimit !== undefined &&
    files.length + optimistic.pending.length >= fileLimit;
  const filesRef = useRef(files);
  const sectionRef = useRef(section);
  useEffect(() => {
    optimistic.claimOwner(section.id);
    return () => optimistic.invalidate();
  }, [optimistic.claimOwner, optimistic.invalidate, section.id]);
  useEffect(() => {
    filesRef.current = files;
    sectionRef.current = section;
  }, [files, section]);
  function saveFiles(nextFiles: PortalFileItem[]) {
    const currentSection = sectionRef.current;
    const currentColumns = [3, 4].includes(currentSection.layout.columns ?? 3)
      ? (currentSection.layout.columns ?? 3)
      : 3;
    updateSection({
      ...currentSection,
      content: { files: reindexUnique(nextFiles, "file") },
      layout: {
        ...currentSection.layout,
        columns: currentColumns,
        mode: "cards",
      },
    });
  }
  function handleFile(file: File | undefined) {
    if (!file) return;
    const fileType = portalFileTypeFromName(file.name);
    if (!fileType) {
      setFileValidationError(t("invalidFormat"));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFileValidationError(null);
    if (status !== "ready") {
      requestUpgrade("plan_unavailable");
      return;
    }
    if (fileLimitReached) {
      requestUpgrade("files_items");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > snapshot.policy.maxUploadBytes) {
      requestUpgrade("upload_bytes", undefined, { fileSizeBytes: file.size });
      return;
    }
    if (snapshot.storageUsedBytes + file.size > snapshot.policy.storageBytes) {
      requestUpgrade("storage_bytes", undefined, { fileSizeBytes: file.size });
      return;
    }
    const pending = optimistic.add(file, ({ id, previewUrl }) => ({
      allow_download: true,
      file_name: file.name,
      file_size: `${Math.ceil(file.size / 1024)}KB`,
      file_type: fileType,
      file_url: previewUrl,
      id,
      position: filesRef.current.length,
      visible: true,
    }));
    void (async () => {
      try {
        const asset = await uploadPortalAsset({
          category: "file",
          file,
          portalId,
        });
        if (!asset.previewUrl) throw new Error(t("uploadError"));
        const reconciled = await reconcileOptimisticUpload({
          asset,
          commit: (finalized) => {
            const nextFiles = [
              ...filesRef.current,
              {
                asset_id: finalized.assetId,
                allow_download: true,
                file_name: file.name,
                file_size: `${Math.ceil(finalized.sizeBytes / 1024)}KB`,
                file_type: fileType,
                file_url: finalized.previewUrl,
                storage_path: finalized.path,
                id: createRandomId("file"),
                position: filesRef.current.length,
                visible: true,
              },
            ];
            filesRef.current = nextFiles;
            saveFiles(nextFiles);
          },
          discard: (finalized) =>
            deleteManagedPortalAsset(finalized.assetId, fetch, portalId),
          id: pending.id,
          registry: optimistic,
        });
        if (reconciled) {
          await flushPortalAutosave(portalId);
          releaseManagedPortalAsset(asset.assetId);
        }
      } catch (uploadError) {
        const stillOwned = optimistic.owns(pending.id);
        optimistic.remove(pending.id);
        if (!stillOwned) return;
        console.error("Portal file upload failed", {
          error:
            uploadError instanceof Error
              ? { name: uploadError.name, message: uploadError.message }
              : String(uploadError),
          portalId,
        });
        toast.error(t("uploadError"), {
          id: `portal-file-upload-error:${portalId}`,
        });
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    })();
  }
  return (
    <Field data-invalid={Boolean(fileValidationError) || undefined}>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled || !event.operation.target) return;

          const nextFiles = move(files, event);

          if (nextFiles !== files) {
            saveFiles(nextFiles);
          }
        }}
      >
        <div
          className={cn(
            "grid gap-x-4 gap-y-4",
            columns === 3 &&
              "grid-cols-2 lg:grid-cols-3 group-data-[style-mode=desktop]/portal:grid-cols-3! group-data-[style-mode=mobile]/portal:grid-cols-2!",
            columns === 4 &&
              "grid-cols-3 lg:grid-cols-4 group-data-[style-mode=desktop]/portal:grid-cols-4! group-data-[style-mode=mobile]/portal:grid-cols-3!",
          )}
        >
          {files.map((file, index) => (
            <SortableFileItem
              file={file}
              index={index}
              key={file.id}
              portalId={portalId}
              onRemove={() => {
                saveFiles(files.filter((item) => item.id !== file.id));
              }}
              onSave={(nextFile) =>
                saveFiles(
                  files.map((item) =>
                    item.id === nextFile.id ? nextFile : item,
                  ),
                )
              }
            />
          ))}
          {optimistic.pending.map(({ id, value }) => (
            <div aria-busy="true" className="relative animate-pulse" key={id}>
              <PortalFilePreview
                backgroundColor={value.background_color}
                containerPadding={value.container_padding}
                fileName={value.file_name}
                fileUrl={value.file_url}
                type={value.file_type}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-black/50 text-white">
                <IconLoader2 className="size-4 animate-spin" />
                <span className="text-sm">{t("uploading")}</span>
              </div>
            </div>
          ))}
          {fileLimitReached ? (
            <button
              aria-label={t("limitReached")}
              className="flex aspect-square items-center justify-center rounded-xl border border-dashed text-muted-foreground"
              onClick={() => requestUpgrade("files_items")}
              type="button"
            >
              <span className="text-center text-sm">{t("limitReached")}</span>
            </button>
          ) : (
            <>
              <button
                aria-label={t("upload")}
                aria-describedby={
                  fileValidationError ? "portal-file-error" : undefined
                }
                aria-invalid={Boolean(fileValidationError) || undefined}
                className="flex aspect-square items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground hover:bg-muted"
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                <IconPlus />
                <span className="sr-only">{t("upload")}</span>
              </button>
              <input
                aria-describedby={
                  fileValidationError ? "portal-file-error" : undefined
                }
                aria-invalid={Boolean(fileValidationError) || undefined}
                className="sr-only"
                ref={inputRef}
                type="file"
                accept={PORTAL_FILE_ACCEPT}
                onChange={(e) => handleFile(e.currentTarget.files?.[0])}
              />
            </>
          )}
        </div>
      </DragDropProvider>
      {fileValidationError ? (
        <div id="portal-file-error">
          <FieldError>{fileValidationError}</FieldError>
        </div>
      ) : null}
    </Field>
  );
}

export function SectionContentEditor({
  localMode = false,
  overlayContainer,
  portalId,
  portalSlug,
  quickColors,
  section,
  updateSection,
}: {
  localMode?: boolean;
  overlayContainer?: HTMLElement | null;
  portalId: string;
  portalSlug: string;
  quickColors?: string[];
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.sections");
  if (section.type === "empty")
    return (
      <div data-portal-section-content tabIndex={-1}>
        <SectionTypeDialog
          onSelect={(type) =>
            updateSection({
              ...section,
              content: defaultContentForType(type),
              layout: defaultLayoutForType(type),
              type,
            })
          }
          trigger={
            <Button className="h-28 w-full" type="button" variant="outline">
              <IconPlus data-icon="inline-start" />
              <span className="sr-only">{t("add")}</span>
            </Button>
          }
        />
      </div>
    );
  if (section.type === "text") return null;
  if (section.type === "image")
    return (
      <ImageEditor
        portalId={portalId}
        portalSlug={portalSlug}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "gallery")
    return (
      <GalleryEditor
        localMode={localMode}
        overlayContainer={overlayContainer}
        portalId={portalId}
        portalSlug={portalSlug}
        quickColors={quickColors}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "colors")
    return (
      <ColorsEditor
        overlayContainer={overlayContainer}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "fonts")
    return (
      <FontsEditor
        portalId={portalId}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "files")
    return (
      <FilesEditor
        portalId={portalId}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "image_comparison")
    return (
      <GalleryEditor
        portalId={portalId}
        portalSlug={portalSlug}
        section={{
          ...section,
          layout: { ...section.layout, columns: 2, mode: "comparison" },
          content: { images: (section.content.images ?? []).slice(0, 2) },
          type: "gallery",
        }}
        updateSection={updateSection}
      />
    );
  return null;
}

export function SectionActionToolbar({
  onRemove,
  portalId,
  section,
  updateSection,
}: {
  onRemove: () => void;
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.sections");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colorsSettingsOpen, setColorsSettingsOpen] = useState(false);

  return (
    <>
      <ImproveSectionWithAiPopover portalId={portalId} section={section} />
      {section.type === "gallery" || section.type === "image_comparison" ? (
        <GallerySettingsPopover
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          portalId={portalId}
          section={section}
          updateSection={updateSection}
          trigger={
            <PortalActionTriggerButton
              icon="settings"
              label={t("configure")}
              variant="ghost"
            />
          }
        />
      ) : null}
      {section.type === "files" ? (
        <FilesSettingsPopover
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          portalId={portalId}
          section={section}
          updateSection={updateSection}
          trigger={
            <PortalActionTriggerButton
              icon="settings"
              label={t("configure")}
              variant="ghost"
            />
          }
        />
      ) : null}
      {section.type === "colors" ? (
        <ColorsSettingsPopover
          onOpenChange={setColorsSettingsOpen}
          open={colorsSettingsOpen}
          portalId={portalId}
          section={section}
          updateSection={updateSection}
          trigger={
            <PortalActionTriggerButton
              icon="settings"
              label={t("configure")}
              variant="ghost"
            />
          }
        />
      ) : null}
      <SectionTypeDialog
        onSelect={(type) =>
          updateSection({
            ...section,
            content: defaultContentForType(type),
            layout: defaultLayoutForType(type),
            type,
          })
        }
        trigger={
          <PortalActionTriggerButton
            icon="refresh"
            label={t("changeType")}
            variant="ghost"
          />
        }
      />
      <Button
        className="rounded-full"
        onClick={onRemove}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <IconTrash data-icon="inline-start" />
      </Button>
    </>
  );
}
