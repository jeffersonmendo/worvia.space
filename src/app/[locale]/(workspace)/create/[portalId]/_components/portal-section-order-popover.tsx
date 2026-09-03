"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { IconGripVertical, IconPlus, IconStack2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { schedulePortalAutosave } from "@/application/portal/autosave-coordinator";
import { usePortalEditorStore } from "@/application/portal/editor-store";
import {
  applyRenderProjectDocument,
  portalDocumentToRenderProject,
} from "@/application/portal/portal-document-adapter";
import {
  PORTAL_PLAN_RETRY_EVENT,
  usePortalPlan,
} from "@/components/portal/portal-plan-provider";
import { SectionTypeDialog } from "@/components/portal/portal-workspace-controls";
import { appendRenderProjectSection } from "@/components/render";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type PortalDocument,
  type PortalSection,
  type PortalSectionType,
  uniqueForRender,
} from "@/domain/portal/document";
import {
  focusPortalSectionTitle,
  requestPortalAddSectionDialog,
  scrollToPortalSection,
} from "@/lib/portal/scroll-to-section";
import { cn } from "@/lib/utils";

function reindex<T extends { position: number }>(items: T[]) {
  return items.map((item, position) => ({ ...item, position }));
}

function SectionOrderItem({
  index,
  section,
}: {
  index: number;
  section: PortalSection;
}) {
  const t = useTranslations("PortalEditor.sections");
  const sectionName = section.title || t(`types.${section.type}.label`);
  const { handleRef, isDragging, ref } = useSortable({
    id: section.id,
    index,
    type: "portal-section-order",
  });

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-2 text-sm",
        isDragging && "opacity-50",
      )}
      ref={ref}
    >
      <button
        aria-label={t("move", { name: sectionName })}
        className="flex shrink-0 cursor-grab gap-2 items-center justify-center active:cursor-grabbing"
        ref={handleRef}
        type="button"
      >
        <IconGripVertical className="size-3 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate first-letter:uppercase">
          {sectionName}
        </span>
      </button>
    </div>
  );
}

function usePortalDocumentDraft(portalId: string, document: PortalDocument) {
  const storeDocument = usePortalEditorStore(
    (state) => state.documentsByPortalId[portalId],
  );
  const hydrateDocument = usePortalEditorStore(
    (state) => state.hydrateDocument,
  );

  useEffect(() => {
    hydrateDocument(portalId, document);
  }, [document, hydrateDocument, portalId]);

  return storeDocument ?? document;
}

export function PortalSectionOrderPopover({
  document,
  portalId,
  triggerless = false,
}: {
  document: PortalDocument;
  portalId: string;
  triggerless?: boolean;
}) {
  const t = useTranslations("PortalEditor.sections");
  const triggerId = "portal-section-order-trigger";
  const draft = usePortalDocumentDraft(portalId, document);
  const updateDraft = usePortalEditorStore((state) => state.updateDocument);
  const { guardDocumentChange } = usePortalPlan();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!triggerless) return;
    const openOrder = () => setOpen(true);
    window.addEventListener("portal-workspace:order", openOrder);
    return () =>
      window.removeEventListener("portal-workspace:order", openOrder);
  }, [triggerless]);
  const pendingSectionIdRef = useRef<string | null>(null);
  const sections = uniqueForRender(
    draft.sections.filter(
      (section) => section.visible && section.type !== "empty",
    ),
    "sec",
  );

  function save(
    update: (current: PortalDocument) => PortalDocument,
    retry?: { kind: "add-section"; type: Exclude<PortalSectionType, "empty"> },
  ) {
    const current =
      usePortalEditorStore.getState().documentsByPortalId[portalId] ?? document;
    const candidate = update(current);
    if (!guardDocumentChange(current, candidate, retry)) return;
    const updated = updateDraft(portalId, () => candidate);
    if (updated) {
      schedulePortalAutosave(portalId, updated);
    }
  }

  function addSection(type: Exclude<PortalSectionType, "empty">) {
    save(
      (current) => {
        const project = appendRenderProjectSection(
          portalDocumentToRenderProject(current),
          type,
        );
        const section = project.sections.at(-1);
        if (!section) return current;
        pendingSectionIdRef.current = section.id;
        return applyRenderProjectDocument(current, project);
      },
      { kind: "add-section", type },
    );
  }

  function revealPendingSection() {
    const sectionId = pendingSectionIdRef.current;
    if (!sectionId) return;

    pendingSectionIdRef.current = null;
    scrollToPortalSection(sectionId);
    focusPortalSectionTitle(sectionId);
  }

  function completeSectionSelection() {
    if (open) return setOpen(false);
    revealPendingSection();
  }

  useEffect(() => {
    const retry = (event: Event) => {
      const action = (
        event as CustomEvent<{
          kind: string;
          type?: Exclude<PortalSectionType, "empty">;
        }>
      ).detail;
      if (action.kind === "add-section" && action.type) addSection(action.type);
    };
    window.addEventListener(PORTAL_PLAN_RETRY_EVENT, retry);
    return () => window.removeEventListener(PORTAL_PLAN_RETRY_EVENT, retry);
  });

  return (
    <Popover
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) revealPendingSection();
      }}
      open={open}
      triggerId={triggerless ? triggerId : undefined}
    >
      {!triggerless ? (
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <PopoverTrigger
              render={
                <Button
                  aria-label={t("order")}
                  className="rounded-full"
                  size="icon-lg"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <IconStack2 />
              <span className="sr-only">{t("order")}</span>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("order")}</TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger
          id={triggerId}
          nativeButton={false}
          render={
            <span
              aria-hidden="true"
              className="fixed bottom-20 left-1/2 size-px"
            />
          }
        />
      )}
      <PopoverContent align="center" className="w-72" side="top" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>{t("orderTitle")}</PopoverTitle>
          <PopoverDescription>{t("orderDescription")}</PopoverDescription>
        </PopoverHeader>
        <Button
          aria-label={t("add")}
          data-portal-add-section
          onClick={() => requestPortalAddSectionDialog()}
          size="sm"
          type="button"
          variant="outline"
        >
          <IconPlus data-icon="inline-start" />
          {t("add")}
        </Button>
        <DragDropProvider
          onDragEnd={(event) => {
            if (!event.canceled) {
              const nextSections = move(sections, event);
              const orderedIds = nextSections.map((section) => section.id);
              save((current) => {
                const sectionsById = new Map(
                  current.sections.map((section) => [section.id, section]),
                );
                const orderedSections = orderedIds.flatMap((id) => {
                  const section = sectionsById.get(id);
                  return section ? [section] : [];
                });
                const orderedIdSet = new Set(orderedIds);
                const remainingVisibleSections = current.sections.filter(
                  (section) =>
                    section.visible &&
                    section.type !== "empty" &&
                    !orderedIdSet.has(section.id),
                );
                const hiddenSections = current.sections.filter(
                  (section) => section.type === "empty" || !section.visible,
                );
                return {
                  ...current,
                  sections: reindex([
                    ...orderedSections,
                    ...remainingVisibleSections,
                    ...hiddenSections,
                  ]),
                };
              });
            }
          }}
        >
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {sections.map((section, index) => (
              <SectionOrderItem
                index={index}
                key={section.id}
                section={section}
              />
            ))}
          </div>
        </DragDropProvider>
      </PopoverContent>
      <SectionTypeDialog
        onSelect={addSection}
        onSelectComplete={completeSectionSelection}
        openRequestKey="portal-add-section"
        trigger={<span aria-hidden="true" />}
        triggerNativeButton={false}
      />
    </Popover>
  );
}
