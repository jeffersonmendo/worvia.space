"use client";

import { useTranslations } from "next-intl";
import {
  fileTypeFromName,
  FileTypeIcon as PortalFileTypeIcon,
} from "@/components/file-type-icon";
import type { PortalFileType } from "@/domain/portal/document";
import { cn } from "@/lib/utils";

export { FileTypeIcon as PortalFileTypeIcon } from "@/components/file-type-icon";

export const PORTAL_FILE_ACCEPT = [
  ".pdf",
  ".ai",
  ".ait",
  ".eps",
  ".psd",
  ".psb",
  ".indd",
  ".indt",
  ".idml",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ".tif",
  ".tiff",
  ".txt",
  ".md",
  ".markdown",
].join(",");

export const PORTAL_IMAGE_ACCEPT = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
].join(",");

export function portalFileTypeFromName(
  fileName: string,
): PortalFileType | null {
  return fileTypeFromName(fileName);
}

export function portalFileTypeLabel(
  type: PortalFileType | undefined,
  fallback: { file: string; image: string },
) {
  if (type === "pdf") return "PDF";
  if (type === "ai") return "AI";
  if (type === "ait") return "AIT";
  if (type === "eps") return "EPS";
  if (type === "psd") return "PSD";
  if (type === "psb") return "PSB";
  if (type === "indd") return "INDD";
  if (type === "indt") return "INDT";
  if (type === "idml") return "IDML";
  if (type === "svg") return "SVG";
  if (type === "txt") return "TXT";
  if (type === "md") return "MD";
  if (type === "tiff") return "TIFF";
  if (type === "image") return fallback.image;
  return fallback.file;
}

export function isPortalFilePreviewable(type?: PortalFileType) {
  return type === "image" || type === "svg";
}

export function portalFilePreviewObjectFit(type?: PortalFileType) {
  return type === "svg" ? "object-contain" : "object-cover";
}

export function filePreviewPresentationStyle(
  containerPadding = 0,
  backgroundColor = "secondary",
) {
  return {
    backgroundColor:
      backgroundColor === "secondary" ? "var(--secondary)" : backgroundColor,
    padding: containerPadding,
  };
}

export function PortalFilePreview({
  backgroundColor,
  className,
  containerPadding,
  fileName,
  fileUrl,
  type,
}: {
  backgroundColor?: string;
  className?: string;
  containerPadding?: number;
  fileName: string;
  fileUrl?: string;
  type?: PortalFileType;
}) {
  const t = useTranslations("PortalViewer.file");
  return (
    <div
      className={cn(
        "flex aspect-square min-w-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-card p-4 text-center shadow-xs",
        className,
      )}
    >
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={
          isPortalFilePreviewable(type)
            ? filePreviewPresentationStyle(containerPadding, backgroundColor)
            : undefined
        }
      >
        {isPortalFilePreviewable(type) && fileUrl ? (
          // biome-ignore lint/performance/noImgElement: user uploaded asset preview.
          <img
            alt={fileName}
            className={cn("size-full", portalFilePreviewObjectFit(type))}
            src={fileUrl}
          />
        ) : (
          <PortalFileTypeIcon
            fallback={{
              file: t("fileAbbreviation"),
              image: t("imageAbbreviation"),
            }}
            type={type}
          />
        )}
      </div>
      <div className="min-w-0 max-w-full">
        <p className="truncate line-clamp-2 font-medium text-sm">{fileName}</p>
        <p className="text-muted-foreground text-xs">
          {portalFileTypeLabel(type, {
            file: t("file"),
            image: t("image"),
          })}
        </p>
      </div>
    </div>
  );
}
