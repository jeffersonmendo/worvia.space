"use client";

import {
  SectionActionToolbar,
  SectionContentEditor,
} from "@/components/portal/portal-workspace-controls";
import { RenderSection } from "@/components/render/render-section";
import type { RenderSectionSlotProps } from "@/components/render/visual-model";
import {
  type PortalDocument,
  type PortalSection,
  portalQuickColors,
} from "@/domain/portal/document";

export function PortalProjectSection({
  document,
  editor,
  localEditor,
  onRemoveSection,
  onSectionChange,
  section,
  showEditorControls,
  ...slot
}: RenderSectionSlotProps & {
  document: PortalDocument;
  editor?: { portalId: string; slug?: string };
  localEditor?: {
    overlayContainer?: HTMLElement | null;
    portalId: string;
    slug?: string;
  };
  onRemoveSection: (sectionId: string) => void;
  onSectionChange: (section: PortalSection) => void;
  showEditorControls: boolean;
}) {
  const isDemo = Boolean(localEditor);
  const domainSection = document.sections.find(
    (item) => item.id === section.id,
  );
  if (!domainSection) return null;
  return (
    <RenderSection
      {...slot}
      description={section.description}
      header={
        editor ? (
          <SectionActionToolbar
            onRemove={() => onRemoveSection(section.id)}
            portalId={editor.portalId}
            section={domainSection}
            updateSection={onSectionChange}
          />
        ) : null
      }
      id={section.id}
      layout={section.layout}
      onChange={(change) =>
        onSectionChange({
          ...domainSection,
          ...(change.field === "title" ? { title: change.value } : {}),
          ...(change.field === "description"
            ? { description: change.value }
            : {}),
        })
      }
      title={section.title}
    >
      {showEditorControls ? (
        <SectionContentEditor
          localMode={isDemo}
          overlayContainer={isDemo ? localEditor?.overlayContainer : undefined}
          portalId={editor?.portalId ?? localEditor?.portalId ?? ""}
          portalSlug={editor?.slug ?? localEditor?.slug ?? ""}
          quickColors={portalQuickColors(document)}
          section={domainSection}
          updateSection={onSectionChange}
        />
      ) : (
        slot.children
      )}
    </RenderSection>
  );
}
