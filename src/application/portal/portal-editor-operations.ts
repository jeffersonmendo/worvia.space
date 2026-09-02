import {
  createPortalSection,
  moveImageBetweenPortalSections,
  type PortalDocument,
  type PortalSection,
  type PortalSectionType,
} from "@/domain/portal/document";

export type PortalSectionHeadingPatch = Partial<
  Pick<PortalSection, "description" | "title">
>;

export type MovePortalImageInput = {
  imageId: string;
  maxTargetImages?: number;
  sourceSectionId: string;
  targetIndex: number;
  targetSectionId: string;
};

export type MovePortalItemInput = {
  itemId: string;
  kind: "image" | "color" | "file";
  maxTargetImages?: number;
  sourceSectionId: string;
  targetIndex: number;
  targetSectionId: string;
};

export function reindexPortalSections(sections: readonly PortalSection[]) {
  return sections.map((section, position) => ({ ...section, position }));
}

export function applyPortalSectionHeadingPatch(
  document: PortalDocument,
  sectionId: string,
  patch: PortalSectionHeadingPatch,
): PortalDocument {
  if (!document.sections.some((section) => section.id === sectionId)) {
    return document;
  }

  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId ? { ...section, ...patch } : section,
    ),
  };
}

export function removePortalSection(
  document: PortalDocument,
  sectionId: string,
): PortalDocument {
  if (!document.sections.some((section) => section.id === sectionId)) {
    return document;
  }

  return {
    ...document,
    sections: reindexPortalSections(
      document.sections.filter((section) => section.id !== sectionId),
    ),
  };
}

export function addPortalSection(
  document: PortalDocument,
  type: Exclude<PortalSectionType, "empty"> = "text",
): PortalDocument {
  return {
    ...document,
    sections: [
      ...document.sections,
      createPortalSection(type, document.sections.length),
    ],
  };
}

export function movePortalImage(
  document: PortalDocument,
  input: MovePortalImageInput,
): PortalDocument {
  const source = document.sections.find(
    (section) => section.id === input.sourceSectionId,
  );
  const target = document.sections.find(
    (section) => section.id === input.targetSectionId,
  );

  if (
    !source ||
    !target ||
    (target.type !== "gallery" && target.type !== "image_comparison") ||
    !Number.isInteger(input.targetIndex) ||
    input.targetIndex < 0 ||
    (input.maxTargetImages !== undefined &&
      (!Number.isFinite(input.maxTargetImages) || input.maxTargetImages < 0))
  ) {
    return document;
  }

  return moveImageBetweenPortalSections(document, input);
}

function reorderPortalItems<T extends { id: string; position: number }>(
  items: T[],
  itemId: string,
  targetIndex: number,
) {
  const sourceIndex = items.findIndex((item) => item.id === itemId);
  if (sourceIndex < 0) return items;

  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  if (!moved) return items;
  const insertionIndex = Math.min(Math.max(0, targetIndex), next.length);
  next.splice(insertionIndex, 0, moved);

  return next.map((item, position) => ({ ...item, position }));
}

export function movePortalItem(
  document: PortalDocument,
  input: MovePortalItemInput,
): PortalDocument {
  if (input.kind === "image") {
    return movePortalImage(document, {
      imageId: input.itemId,
      maxTargetImages: input.maxTargetImages,
      sourceSectionId: input.sourceSectionId,
      targetIndex: input.targetIndex,
      targetSectionId: input.targetSectionId,
    });
  }

  if (
    input.sourceSectionId !== input.targetSectionId ||
    !Number.isInteger(input.targetIndex) ||
    input.targetIndex < 0
  ) {
    return document;
  }

  const section = document.sections.find(
    ({ id }) => id === input.sourceSectionId,
  );
  const expectedType = input.kind === "color" ? "colors" : "files";
  if (!section || section.type !== expectedType) return document;

  if (input.kind === "color") {
    const colors = section.content.colors ?? [];
    const nextColors = reorderPortalItems(
      colors,
      input.itemId,
      input.targetIndex,
    );
    if (nextColors === colors) return document;
    return {
      ...document,
      sections: document.sections.map((current) =>
        current.id === section.id
          ? { ...current, content: { ...current.content, colors: nextColors } }
          : current,
      ),
    };
  }

  const files = section.content.files ?? [];
  const nextFiles = reorderPortalItems(files, input.itemId, input.targetIndex);
  if (nextFiles === files) return document;
  return {
    ...document,
    sections: document.sections.map((current) =>
      current.id === section.id
        ? { ...current, content: { ...current.content, files: nextFiles } }
        : current,
    ),
  };
}
