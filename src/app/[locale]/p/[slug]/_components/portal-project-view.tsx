"use client";

import {
  IconCopy,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconLayersIntersect,
  IconLock,
  IconPackageExport,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { portalDocumentToRenderProject } from "@/application/portal/portal-document-adapter";
import type {
  PortalAction,
  PortalActionConfig,
  PortalActionContext,
  PortalActionIcon,
} from "@/components/portal/portal-project-types";
import { PortalShell } from "@/components/portal/portal-shell";
import { RenderProject } from "@/components/render/render-project";
import type {
  RenderAction,
  RenderProjectActions,
} from "@/components/render/visual-model";
import type {
  PortalColorItem,
  PortalDocument,
  PortalFileItem,
  PortalFontItem,
  PortalImageItem,
  PortalSection,
} from "@/domain/portal/document";
import { PortalBrandFooter } from "./portal-brand-footer";
import { buildPublicActions } from "./portal-public-actions";

const actionIcons = {
  copy: IconCopy,
  download: IconDownload,
  edit: IconEdit,
  export: IconPackageExport,
  layers: IconLayersIntersect,
  lock: IconLock,
  open: IconExternalLink,
  plus: IconPlus,
  refresh: IconRefresh,
  remove: IconX,
  settings: IconSettings,
} satisfies Record<PortalActionIcon, RenderAction["icon"]>;

function adaptAction(action: PortalAction): RenderAction {
  return {
    attributes: action.attributes,
    disabled: action.disabled,
    download: action.download,
    href: action.href,
    icon: actionIcons[action.icon],
    id: action.id,
    label: action.label,
    onClick: action.onClick ? () => action.onClick?.() : undefined,
  };
}

function adaptActions(actions: PortalAction[]) {
  return actions.filter(Boolean).map(adaptAction);
}

function createPublicActions(
  document: PortalDocument,
  config: PortalActionConfig["public"],
  copy: Parameters<typeof buildPublicActions>[0]["copy"],
): RenderProjectActions | undefined {
  if (!config) return undefined;
  const source = buildPublicActions({ ...config, copy });
  const sections = new Map(
    document.sections.map((section) => [section.id, section]),
  );

  function context<
    TItem extends
      | PortalColorItem
      | PortalFileItem
      | PortalFontItem
      | PortalImageItem,
  >(item: TItem, section: PortalSection): PortalActionContext<TItem> {
    return { item, section };
  }

  return {
    project: () => adaptActions(source.global?.() ?? []),
    color: ({ item, section }) => {
      const domainSection = section && sections.get(section.id);
      const domainItem = domainSection?.content.colors?.find(
        (candidate) => candidate.id === item.id,
      );
      return domainSection && domainItem
        ? adaptActions(source.color?.(context(domainItem, domainSection)) ?? [])
        : [];
    },
    file: ({ item, section }) => {
      const domainSection = section && sections.get(section.id);
      const domainItem = domainSection?.content.files?.find(
        (candidate) => candidate.id === item.id,
      );
      return domainSection && domainItem
        ? adaptActions(source.file?.(context(domainItem, domainSection)) ?? [])
        : [];
    },
    font: ({ item, section }) => {
      const domainSection = section && sections.get(section.id);
      const domainItem = domainSection?.content.fonts?.find(
        (candidate) => candidate.id === item.id,
      );
      return domainSection && domainItem
        ? adaptActions(source.font?.(context(domainItem, domainSection)) ?? [])
        : [];
    },
    image: ({ item, section }) => {
      const domainSection = section && sections.get(section.id);
      const candidates = [
        ...(domainSection?.content.images ?? []),
        ...(domainSection?.content.image ? [domainSection.content.image] : []),
      ];
      const domainItem = candidates.find(
        (candidate) => candidate.id === item.id,
      );
      return domainSection && domainItem
        ? adaptActions(source.image?.(context(domainItem, domainSection)) ?? [])
        : [];
    },
    section: ({ section }) => {
      const domainSection = sections.get(section.id);
      return domainSection
        ? adaptActions(source.section?.(domainSection) ?? [])
        : [];
    },
  };
}

export function PortalProjectView({
  actionConfig,
  className,
  contentClassName,
  document,
  sidebar,
  styleMode = "auto",
  visibility,
}: {
  actionConfig?: PortalActionConfig;
  className?: string;
  contentClassName?: string;
  document: PortalDocument;
  sidebar?: React.ReactNode;
  styleMode?: "auto" | "desktop" | "mobile";
  visibility?: {
    requireContent?: boolean;
    showEmptySections?: boolean;
    showHiddenSections?: boolean;
  };
}) {
  const t = useTranslations();
  const publicConfig = actionConfig?.public;
  const actions = createPublicActions(document, publicConfig, {
    copied: t("PortalViewer.actions.copied"),
    copyColor: (color) => t("PortalViewer.actions.copyColor", { color }),
    downloadFile: (name) => t("PortalViewer.actions.downloadFile", { name }),
    downloadFont: (name) => t("PortalViewer.actions.downloadFont", { name }),
    downloadImage: (name) => t("PortalViewer.actions.downloadImage", { name }),
    downloadSection: (name) =>
      t("PortalViewer.actions.downloadSection", { name }),
    exportAll: t("PortalViewer.actions.exportAll"),
    imageFallback: t("PortalViewer.actions.imageFallback"),
    sectionType: (type) => t(`PortalViewer.sectionTypes.${type}`),
  });

  return (
    <PortalShell className={className} sidebar={sidebar} styleMode={styleMode}>
      <RenderProject
        mode="view"
        actions={actions}
        project={portalDocumentToRenderProject(document)}
        ui={{
          contentClassName,
          styleMode,
          visibility,
          actions: {
            item: {
              visibility: "always",
              variant: "outline",
              radius: "rounded-lg",
            },
            section: {
              variant: "ghost",
              visibility: "always",
              radius: "rounded-lg",
            },
          },
        }}
      />
      <PortalBrandFooter
        brand={t("PortalViewer.branding.brand")}
        credit={t("PortalViewer.branding.credit")}
        styleMode={styleMode}
      />
    </PortalShell>
  );
}
