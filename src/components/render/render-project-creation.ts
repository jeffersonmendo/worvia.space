import type {
  RenderProjectData,
  RenderSectionContent,
  RenderSectionData,
  RenderSectionType,
} from "./visual-model";

/** Section kinds that an external editor control may add to a project. */
export type RenderCreatableSectionType = Exclude<RenderSectionType, "empty">;

/**
 * Optional visual values owned by the consumer when it creates a section.
 * No UI or business policy is coupled to this helper.
 */
export type RenderSectionCreationOptions = Partial<
  Pick<
    RenderSectionData,
    | "content"
    | "description"
    | "id"
    | "layout"
    | "position"
    | "title"
    | "visible"
  >
>;

function defaultContent(
  type: RenderCreatableSectionType,
): RenderSectionContent {
  switch (type) {
    case "text":
      return { body: "" };
    case "image":
      return { image: null };
    case "gallery":
    case "image_comparison":
      return { images: [] };
    case "colors":
      return { colors: [] };
    case "fonts":
      return { fonts: [] };
    case "files":
      return { files: [] };
  }
}

function defaultLayout(type: RenderCreatableSectionType) {
  switch (type) {
    case "gallery":
      return {
        columns: 3 as const,
        gap: "md" as const,
        mode: "grid" as const,
        width: "container" as const,
      };
    case "image_comparison":
      return {
        columns: 2 as const,
        gap: "md" as const,
        mode: "comparison" as const,
        width: "container" as const,
      };
    case "colors":
      return {
        columns: 4 as const,
        gap: "md" as const,
        mode: "palette" as const,
        width: "container" as const,
      };
    case "files":
      return {
        columns: 3 as const,
        gap: "md" as const,
        mode: "cards" as const,
        width: "container" as const,
      };
    case "text":
    case "image":
    case "fonts":
      return {
        gap: "md" as const,
        mode: "single" as const,
        width: "container" as const,
      };
  }
}

function createSectionId() {
  return `section-${crypto.randomUUID()}`;
}

/**
 * Creates a visual section for a consumer-owned modal, menu, or button.
 * It is deliberately independent from RenderProject so section creation stays
 * outside the renderer facade.
 */
export function createRenderProjectSection(
  type: RenderCreatableSectionType,
  options: RenderSectionCreationOptions = {},
): RenderSectionData {
  return {
    content: { ...defaultContent(type), ...options.content },
    description: options.description ?? "",
    id: options.id ?? createSectionId(),
    layout: { ...defaultLayout(type), ...options.layout },
    position: options.position ?? 0,
    title: options.title ?? "",
    type,
    visible: options.visible ?? true,
  };
}

/**
 * Returns a new controlled project snapshot with a section appended. Consumers
 * choose when and how to pass this snapshot to their RenderProject onChange.
 */
export function appendRenderProjectSection(
  project: RenderProjectData,
  type: RenderCreatableSectionType,
  options: RenderSectionCreationOptions = {},
): RenderProjectData {
  const position =
    options.position ??
    project.sections.reduce(
      (maximum, section) => Math.max(maximum, section.position),
      -1,
    ) + 1;
  const section = createRenderProjectSection(type, { ...options, position });

  return { ...project, sections: [...project.sections, section] };
}
