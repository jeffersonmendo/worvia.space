import type { ReactNode } from "react";
import type {
  RenderSectionChange,
  RenderSectionData,
} from "@/components/render/visual-model";
import type {
  PortalColorItem,
  PortalDocument,
  PortalFileItem,
  PortalFontItem,
  PortalImageItem,
  PortalSection,
} from "@/domain/portal/document";
import type { PortalExportSource } from "@/lib/portal/export-manifest";

export type PortalActionIcon =
  | "copy"
  | "download"
  | "edit"
  | "export"
  | "layers"
  | "lock"
  | "open"
  | "plus"
  | "refresh"
  | "remove"
  | "settings";

export type PortalAction = {
  attributes?: Record<string, string | undefined>;
  disabled?: boolean;
  download?: boolean;
  feedbackLabel?: string;
  href?: string;
  icon: PortalActionIcon;
  id: string;
  label: string;
  onClick?: () => void;
  size?: "icon-lg" | "icon-sm";
  variant?: "ghost" | "outline" | "secondary";
};

export type PortalActionContext<TItem> = {
  item: TItem;
  section: PortalSection;
};

export type PortalRenderActions = {
  color?: (context: PortalActionContext<PortalColorItem>) => PortalAction[];
  file?: (context: PortalActionContext<PortalFileItem>) => PortalAction[];
  font?: (context: PortalActionContext<PortalFontItem>) => PortalAction[];
  global?: () => PortalAction[];
  image?: (context: PortalActionContext<PortalImageItem>) => PortalAction[];
  section?: (section: PortalSection) => PortalAction[];
};

export type PortalRenderVisibility = {
  requireContent?: boolean;
  showEmptySections?: boolean;
  showHiddenSections?: boolean;
};

export type PortalPublicActionSlots = {
  global?: { exportAssets?: boolean };
  item?: {
    color?: { copy?: boolean };
    file?: { download?: boolean };
    font?: { download?: boolean };
    image?: { download?: boolean };
  };
  section?: { download?: boolean };
};

export type PortalPublicActionConfig = {
  exportSource?: PortalExportSource;
  slug: string;
  slots: PortalPublicActionSlots;
};

export type PortalActionConfig = {
  public?: PortalPublicActionConfig;
};

export type PortalStyleMode = "auto" | "desktop" | "mobile";
export type PortalProjectControllerProps = {
  actionConfig?: PortalActionConfig;
  className?: string;
  contentClassName?: string;
  document: PortalDocument;
  editable?: boolean;
  mode: "editor" | "demo";
  onSectionChange?: (
    section: RenderSectionData,
    change: RenderSectionChange,
  ) => void;
  /** Controlled editor mode for previews that must never autosave or upload. */
  localEditor?: {
    allowUploads: boolean;
    onDocumentChange: (document: PortalDocument) => void;
    /** Render the production editors while keeping managed side effects off. */
    showControls?: boolean;
    /** Keeps Base UI overlays inside an embedded editor viewport. */
    overlayContainer?: HTMLElement | null;
    portalId: string;
    slug?: string;
  };
  editor?: {
    documentRevision?: number | null;
    focus?: string;
    hasUnpublishedChanges?: boolean;
    locale: string;
    portalId: string;
    slug?: string;
  };
  sidebar?: ReactNode;
  /** Controls responsive presentation independently from the browser viewport. */
  styleMode?: PortalStyleMode;
  visibility?: PortalRenderVisibility;
};
