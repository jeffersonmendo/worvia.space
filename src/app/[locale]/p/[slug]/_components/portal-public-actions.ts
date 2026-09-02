import type {
  PortalPublicActionConfig,
  PortalRenderActions,
} from "@/components/portal/portal-project-types";
import type { PortalExportSource } from "@/lib/portal/export-manifest";
import { portalExportHref } from "@/lib/portal/export-manifest";

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

export function buildPublicActions({
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
    sectionType: (type: string) => string;
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
    section: (section) =>
      slots.section?.download &&
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
        : [],
  };
}
