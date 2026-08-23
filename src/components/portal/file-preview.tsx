"use client";

import { IconFileText, IconPhotoFilled } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { SVGProps } from "react";
import type { PortalFileType } from "@/lib/portal/document";
import { cn } from "@/lib/utils";

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

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

export function portalFileTypeFromName(
  fileName: string,
): PortalFileType | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  if (extension === "pdf") return "pdf";
  if (extension === "ai") return "ai";
  if (extension === "ait") return "ait";
  if (extension === "eps") return "eps";
  if (extension === "psd") return "psd";
  if (extension === "psb") return "psb";
  if (extension === "indd") return "indd";
  if (extension === "indt") return "indt";
  if (extension === "idml") return "idml";
  if (extension === "svg") return "svg";
  if (extension === "txt") return "txt";
  if (extension === "md" || extension === "markdown") return "md";
  if (extension === "tif" || extension === "tiff") return "tiff";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  return null;
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

const PdfIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    focusable="false"
    {...props}
    viewBox="0 0 75.32 92.604"
  >
    <path
      fill="#ff2116"
      d="M9.563 0C4.29 0 0 4.295 0 9.568v73.473c0 5.271 4.29 9.563 9.563 9.563h56.194c5.272 0 9.563-4.292 9.563-9.563V22.619s.151-1.768-.617-3.49a9.672 9.672 0 0 0-1.893-2.737L58.873 2.72S57.682 1.586 55.918.829C53.84-.062 51.7.031 51.7.031L51.732 0Z"
    />
    <path
      fill="#f5f5f5"
      d="M9.563 3.142h42.121s1.685.016 2.917.546a7.995 7.995 0 0 1 2.037 1.29l13.907 13.64s.837.884 1.244 1.794c.327.735.347 2.078.347 2.078v60.551a6.374 6.374 0 0 1-6.421 6.424H9.563a6.374 6.374 0 0 1-6.421-6.424V9.568a6.374 6.374 0 0 1 6.421-6.426Z"
    />
    <path
      fill="#ff2116"
      d="M18.804 55.135c-2.162-2.162.177-5.133 6.526-8.288l3.994-1.985 1.557-3.405a134.054 134.054 0 0 0 2.838-6.79l1.283-3.386-.884-2.506c-1.087-3.08-1.474-7.71-.785-9.374.934-2.255 3.994-2.024 5.205.393.946 1.888.849 5.307-.272 9.618l-.92 3.534.81 1.375c.445.756 1.746 2.55 2.89 3.989l2.152 2.676 2.677-.35c8.503-1.11 11.416.777 11.416 3.48 0 3.413-6.677 3.695-12.284-.243-1.262-.886-2.128-1.767-2.128-1.767s-3.513.716-5.243 1.182c-1.785.48-2.675.782-5.29 1.665 0 0-.918 1.332-1.516 2.301-2.224 3.604-4.821 6.59-6.676 7.677-2.077 1.217-4.254 1.3-5.35.204Z"
    />
    <text
      x="37.5"
      y="78"
      fill="#2c2c2c"
      fontSize="14"
      fontWeight="700"
      textAnchor="middle"
    >
      PDF
    </text>
  </svg>
);

const IllustratorIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    focusable="false"
    {...props}
    viewBox="0 0 83 80"
    fill="none"
  >
    <rect width="82.051" height="80" rx="14.53" fill="#330000" />
    <path
      d="M39.761 48.01H27.046l-2.587 8.036c-.035.146-.12.276-.241.366-.12.091-.269.137-.42.13h-6.44c-.367 0-.495-.202-.385-.606l11.009-31.705c.11-.33.22-.706.33-1.128.144-.735.218-1.481.22-2.23-.008-.052-.003-.105.014-.155s.045-.096.082-.133.083-.065.133-.082.104-.022.156-.015h8.752c.256 0 .403.092.44.275l12.495 35.228c.11.367 0 .551-.33.55h-7.156c-.123.014-.246-.018-.347-.089-.102-.07-.174-.176-.203-.296L39.76 48.01Zm-10.734-6.936h8.697c-.22-.733-.477-1.559-.77-2.477-.295-.917-.607-1.898-.936-2.945-.33-1.045-.66-2.091-.99-3.137s-.633-2.055-.908-3.027c-.276-.972-.523-1.862-.743-2.67h-.056a42.05 42.05 0 0 1-1.156 4.404c-.514 1.65-1.037 3.339-1.569 5.064-.532 1.725-1.055 3.321-1.568 4.788Z"
      fill="#FF9A00"
    />
    <path
      d="M54.236 55.991V29.681c0-.331.147-.496.441-.496h6.77c.293 0 .44.165.44.496V55.99c0 .367-.147.55-.44.55h-6.715c-.331 0-.496-.183-.496-.55ZM58.034 26.323a4.258 4.258 0 0 1-3.027-1.211 4.244 4.244 0 0 1-1.156-3.137c-.02-1.16.393-2.242 1.238-3.055a4.33 4.33 0 0 1 3.055-1.184c1.321 0 2.358.395 3.11 1.184.783.845 1.16 1.87 1.128 3.055a4.26 4.26 0 0 1-1.183 3.137 4.322 4.322 0 0 1-3.165 1.211Z"
      fill="#FF9A00"
    />
  </svg>
);

const EpsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    focusable="false"
    {...props}
    viewBox="0 0 83 80"
    fill="none"
  >
    <rect width="82.051" height="80" rx="14.53" fill="#330000" />
    <text
      x="41"
      y="48"
      fill="#FF9A00"
      fontSize="24"
      fontWeight="700"
      textAnchor="middle"
    >
      EPS
    </text>
  </svg>
);

const PhotoshopIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    focusable="false"
    {...props}
    viewBox="0 0 83 80"
    fill="none"
  >
    <rect width="82.051" height="80" rx="14.53" fill="#001E36" />
    <path
      d="M18.476 56.101V20.928c0-.256.11-.385.33-.385.587 0 1.122-.009 1.93-.027.807-.018 1.678-.037 2.614-.055.936-.018 1.927-.037 2.973-.055 1.045-.018 2.082-.027 3.11-.028 2.788 0 5.136.349 7.045 1.046a11.574 11.574 0 0 1 4.596 2.807 11.418 11.418 0 0 1 2.504 3.88 12.94 12.94 0 0 1 .77 4.431c0 2.936-.678 5.358-2.036 7.266a11.398 11.398 0 0 1-5.504 4.156c-2.312.862-4.88 1.155-7.706 1.155-.807 0-1.376-.01-1.706-.028-.33-.018-.826-.027-1.486-.027v10.982c.01.067.003.136-.018.2a.51.51 0 0 1-.106.171.51.51 0 0 1-.171.106.51.51 0 0 1-.201.018h-6.553c-.257 0-.385-.146-.385-.44Zm7.434-28.953V38.62c.476.037.916.055 1.321.055h1.816a12.83 12.83 0 0 0 3.936-.628 6.24 6.24 0 0 0 2.807-1.817c.715-.843 1.073-2.018 1.073-3.522.03-1.065-.248-2.116-.798-3.028a5.344 5.344 0 0 0-2.394-1.954c-1.28-.497-2.646-.731-4.018-.688-.881 0-1.66.01-2.34.028-.679.018-1.147.046-1.403.082Z"
      fill="#31A8FF"
    />
    <path
      d="M65.631 36.534a14.798 14.798 0 0 0-3.275-1.156 17.422 17.422 0 0 0-3.825-.44 8.007 8.007 0 0 0-2.064.247 1.98 1.98 0 0 0-1.074.689 1.71 1.71 0 0 0-.275.935c.01.322.126.632.33.88.322.377.715.685 1.156.909a28.56 28.56 0 0 0 2.422 1.128 22.59 22.59 0 0 1 5.256 2.505 7.759 7.759 0 0 1 2.698 2.835c.546 1.092.82 2.3.798 3.522a7.78 7.78 0 0 1-1.321 4.541 8.818 8.818 0 0 1-3.826 3.055c-1.67.734-3.734 1.101-6.192 1.101a23.42 23.42 0 0 1-4.651-.44 15.7 15.7 0 0 1-3.495-1.101.734.734 0 0 1-.385-.66v-5.945c-.007-.058.002-.117.026-.17a.365.365 0 0 1 .112-.133.24.24 0 0 1 .302.027 17.04 17.04 0 0 0 4.238 1.679c1.315.33 2.663.505 4.018.523 1.284 0 2.229-.165 2.835-.495a1.58 1.58 0 0 0 .908-1.431c0-.477-.275-.935-.826-1.376-.55-.44-1.669-.972-3.357-1.596a18.5 18.5 0 0 1-4.871-2.477 8.04 8.04 0 0 1-2.587-2.89 7.74 7.74 0 0 1-.798-3.495 7.89 7.89 0 0 1 1.156-4.128 8.775 8.775 0 0 1 3.578-3.137c1.614-.807 3.632-1.21 6.055-1.211 1.418-.012 2.835.09 4.238.303 1.016.129 2.008.397 2.95.798.15.043.27.154.33.303.037.134.056.273.056.412v5.56a.39.39 0 0 1-.166.33.53.53 0 0 1-.474 0Z"
      fill="#31A8FF"
    />
  </svg>
);

const SvgIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" focusable="false" {...props} viewBox="0 0 300 300">
    <g stroke="#000" strokeWidth="38.009" transform="translate(150 150)">
      {[0, 45, 90, 135].map((rotation) => (
        <path
          d="M-84.149-15.851a22.417 22.417 0 1 0 0 31.702H84.15a22.417 22.417 0 1 0 0-31.702Z"
          fill="#ffb13b"
          key={rotation}
          transform={`rotate(${rotation})`}
        />
      ))}
    </g>
  </svg>
);

const MdIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    focusable="false"
    {...props}
    viewBox="0 0 208 128"
    xmlSpace="preserve"
  >
    <path
      d="M15 5h178a10 10 0 0 1 10 10v98a10 10 0 0 1-10 10H15a10 10 0 0 1-10-10V15A10 10 0 0 1 15 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="10"
    />
    <path
      d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39H30zm125 0-30-33h20V30h20v35h20l-30 33z"
      fill="currentColor"
    />
  </svg>
);

export function PortalFileTypeIcon({
  className,
  fallback,
  type,
}: {
  className?: string;
  fallback: { file: string; image: string };
  type?: PortalFileType;
}) {
  const iconClassName = cn("size-16", className);
  if (type === "pdf") return <PdfIcon className={iconClassName} />;
  if (type === "ai" || type === "ait")
    return <IllustratorIcon className={iconClassName} />;
  if (type === "eps") return <EpsIcon className={iconClassName} />;
  if (type === "psd" || type === "psb")
    return <PhotoshopIcon className={iconClassName} />;
  if (type === "svg") return <SvgIcon className={iconClassName} />;
  if (type === "md") return <MdIcon className={iconClassName} />;
  if (type === "txt") return <IconFileText className={iconClassName} />;
  if (type === "image" || type === "tiff")
    return <IconPhotoFilled className={iconClassName} />;
  return (
    <span
      className={cn(
        "font-semibold text-muted-foreground text-xs uppercase",
        className,
      )}
    >
      {fallback.file}
    </span>
  );
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
