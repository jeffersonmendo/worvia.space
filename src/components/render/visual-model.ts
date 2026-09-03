import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { FileTypeIconType } from "@/components/file-type-icon";
import type { FieldOrigin } from "@/domain/portal/field-origin";

export type RenderImageFit = "cover" | "contain" | "fill" | "auto";
export type RenderImageAspectRatio = "auto" | "1/1" | "4/3" | "16/9" | "21/9";
export type RenderSectionType =
  | "empty"
  | "text"
  | "image"
  | "gallery"
  | "image_comparison"
  | "colors"
  | "fonts"
  | "files";
export type RenderLayoutMode =
  | "grid"
  | "stack"
  | "single"
  | "cards"
  | "palette"
  | "comparison";
export type RenderWidth = "container" | "wide" | "full";
export type RenderLayout = {
  align?: "left" | "center" | "right";
  background?: string;
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: "sm" | "md" | "lg";
  imageBackgroundColor?: string;
  imageContainerPadding?: number;
  imageAspectRatio?: RenderImageAspectRatio;
  imageFit?: RenderImageFit;
  mode?: RenderLayoutMode;
  padding?: number;
  showColorCode?: boolean;
  showColorName?: boolean;
  width?: RenderWidth;
};
export type RenderAssetStatus = "pending" | "ready";
export type RenderImageData = {
  alt: string;
  allowDownload?: boolean;
  assetId?: string;
  storagePath?: string;
  aspectRatio: RenderImageAspectRatio;
  background?: string;
  backgroundTransparent?: boolean;
  displayName?: string;
  downloadName?: string;
  draftId?: string;
  fit: RenderImageFit;
  fieldOrigins?: Partial<
    Record<
      | "fit"
      | "aspect_ratio"
      | "alt_text"
      | "background_color"
      | "container_padding"
      | "display_name"
      | "download_name"
      | "visible",
      FieldOrigin
    >
  >;
  height?: number;
  id: string;
  padding?: number;
  position: number;
  src: string;
  status?: RenderAssetStatus;
  visible: boolean;
  width?: number;
};
export type RenderColorData = {
  code: string;
  id: string;
  name: string;
  position: number;
  visible: boolean;
};
export type RenderFontData = {
  assetId?: string;
  storagePath?: string;
  draftId?: string;
  downloadName?: string;
  family: string;
  id: string;
  name?: string;
  position: number;
  provider?: string;
  sample?: string;
  src?: string;
  status?: RenderAssetStatus;
  usage?: string;
  visible: boolean;
  weight?: number;
  weights?: string;
};
export type RenderFileData = {
  assetId?: string;
  allowDownload?: boolean;
  aspectRatio?: RenderImageAspectRatio;
  storagePath?: string;
  background?: string;
  description?: string;
  downloadName?: string;
  draftId?: string;
  fileName: string;
  fileType?: FileTypeIconType;
  fit?: RenderImageFit;
  id: string;
  padding?: number;
  position: number;
  src: string;
  status?: RenderAssetStatus;
  visible: boolean;
};
export type RenderSectionContent = {
  body?: string;
  colors?: RenderColorData[];
  files?: RenderFileData[];
  fonts?: RenderFontData[];
  image?: RenderImageData | null;
  images?: RenderImageData[];
};
export type RenderSectionData = {
  content: RenderSectionContent;
  description: string;
  id: string;
  layout?: RenderLayout;
  position: number;
  title: string;
  type: RenderSectionType;
  visible: boolean;
};
export type RenderProjectData = {
  description: string;
  id: string;
  name: string;
  sections: RenderSectionData[];
};

/** Imperative editor-only navigation surface; consumers retain publication rules. */
export type RenderProjectHandle = {
  focusSectionTitle(sectionId: string): boolean;
};

export type RenderActionTools = {
  pickAssets(options: {
    sectionId: string;
    kind: "image" | "font" | "file";
    accept?: string;
    multiple?: boolean;
  }): void;
};
export type RenderActionInvocation<TContext> = {
  context: TContext;
  anchor: HTMLElement;
  tools: RenderActionTools;
};
export type RenderAction<TContext = unknown> = {
  attributes?: Record<string, string | undefined>;
  disabled?: boolean;
  download?: boolean;
  href?: string;
  icon: ComponentType<{
    "aria-hidden"?: boolean;
    "data-icon"?: string;
    className?: string;
  }>;
  id: string;
  label: string;
  pending?: boolean;
  onClick?: (invocation: RenderActionInvocation<TContext>) => void;
};
export type RenderActions = RenderAction[];
export type RenderProjectActionContext = { project: RenderProjectData };
export type RenderSectionActionContext = {
  project: RenderProjectData;
  section: RenderSectionData;
};
export type RenderItemActionContext<T> = RenderSectionActionContext & {
  item: T;
};
export type RenderCollectionKind = "image" | "color" | "font" | "file";
export type RenderCollectionAvailability = Readonly<
  Record<string, Partial<Record<RenderCollectionKind, boolean>>>
>;
export type RenderProjectActions = {
  /** A consumer-defined action rendered as the trailing editor tile for a collection. */
  collection?: (
    context: RenderCollectionActionContext,
  ) => RenderAction | undefined;
  project?: (context: RenderProjectActionContext) => RenderActions;
  section?: (context: RenderSectionActionContext) => RenderActions;
  image?: (context: RenderItemActionContext<RenderImageData>) => RenderActions;
  color?: (context: RenderItemActionContext<RenderColorData>) => RenderActions;
  font?: (context: RenderItemActionContext<RenderFontData>) => RenderActions;
  file?: (context: RenderItemActionContext<RenderFileData>) => RenderActions;
};
export type RenderCollectionActionContext = RenderSectionActionContext & {
  kind: RenderCollectionKind;
};
export type RenderActionVisibility = "always" | "hover";
export type RenderActionStyle = {
  visibility?: RenderActionVisibility;
  variant?: "ghost" | "secondary" | "destructive" | "default" | "outline";
  radius?:
    | "rounded-full"
    | "rounded-md"
    | "rounded-lg"
    | "rounded-xl"
    | "rounded-2xl"
    | "rounded-3xl";
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};
export type RenderProjectUi = {
  actions?: {
    project?: RenderActionStyle;
    section?: RenderActionStyle;
    item?: RenderActionStyle;
  };
  className?: string;
  contentClassName?: string;
  labels?: RenderProjectLabels;
  styleMode?: "auto" | "desktop" | "mobile";
  visibility?: RenderProjectVisibility;
};
export type RenderProjectChangeKind =
  | "project"
  | "section"
  | "section-order"
  | "item-order"
  | "asset-selection";
export type RenderProjectItemMove = {
  itemId: string;
  kind: "image" | "color" | "file";
  sourceSectionId: string;
  targetIndex: number;
  targetSectionId: string;
};
export type SelectedAsset = {
  draftId: string;
  sectionId: string;
  kind: "image" | "font" | "file";
  file: File;
};
export type RenderProjectChange = {
  project: RenderProjectData;
  kind: RenderProjectChangeKind;
  assets?: SelectedAsset[];
  rejectedFileCount?: number;
  itemMove?: RenderProjectItemMove;
};
export type RenderProjectLabels = {
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  nameLabel?: string;
  namePlaceholder?: string;
};
export type RenderProjectVisibility = {
  requireContent?: boolean;
  showEmptySections?: boolean;
  showHiddenSections?: boolean;
};

/** The one public facade. Editor is controlled; view deliberately has no editing surface. */
export type RenderProjectProps = (
  | {
      mode: "editor";
      onChange: (change: RenderProjectChange) => void | Promise<void>;
    }
  | {
      mode: "view";
      onChange?: (change: RenderProjectChange) => void | Promise<void>;
    }
) & {
  /** Consumer-controlled collection creation availability, keyed by section id. */
  collectionAvailability?: RenderCollectionAvailability;
  project: RenderProjectData;
  ui?: RenderProjectUi;
  actions?: RenderProjectActions;
};

/* Internal compatibility contracts used only by renderer leaves. */
export type RenderSectionChange =
  | { field: "title" | "description"; value: string }
  | { field: "position"; value: number }
  | { field: "visible"; value: boolean }
  | { field: "layout"; value: RenderLayout }
  | { field: "content"; value: RenderSectionContent };
export type RenderSectionSlotProps = {
  actions?: RenderActions;
  children: ReactNode;
  editable: boolean;
  onChange: (change: RenderSectionChange) => void;
  section: RenderSectionData;
};
export type RenderStyle = CSSProperties;
export type RenderChildren = ReactNode;
