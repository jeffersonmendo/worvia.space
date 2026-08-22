import {
  IconFileOff,
  IconFiles,
  IconPaletteOff,
  IconPhotoOff,
} from "@tabler/icons-react";
import Image from "next/image";
import { PortalFileTypeIcon } from "@/components/portal/file-preview";
import type {
  PortalCardFileType,
  PortalCardImage,
} from "@/lib/portal/portal-card-metadata";
import { cn } from "@/lib/utils";

export function PortalFileTypeBadges({
  fileTypes,
  fileCountLabel,
  emptyLabel,
  label,
  totalFileCount,
}: {
  emptyLabel: string;
  fileCountLabel?: string;
  fileTypes: PortalCardFileType[];
  label: string;
  totalFileCount: number;
}) {
  if (totalFileCount === 0)
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <IconFileOff aria-hidden="true" className="size-4" />
        <span>{emptyLabel}</span>
      </div>
    );

  if (fileTypes.length === 0)
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <IconFiles aria-hidden="true" className="size-4" />
        <span>{fileCountLabel}</span>
      </div>
    );

  return (
    <div className="flex items-center gap-2">
      <ul aria-label={label} className="flex items-center gap-1">
        {fileTypes.map((fileType) => (
          <li key={fileType}>
            <span
              aria-label={`.${fileType}`}
              className="block"
              role="img"
              title={`.${fileType}`}
            >
              <PortalFileTypeIcon
                className="size-5"
                fallback={{ file: fileType.toUpperCase(), image: fileType }}
                type={fileType}
              />
            </span>
          </li>
        ))}
      </ul>
      {fileCountLabel ? (
        <span className="text-muted-foreground">{fileCountLabel}</span>
      ) : null}
    </div>
  );
}

export function PortalColorStack({
  colorCountLabel,
  colors,
  emptyLabel,
  label,
}: {
  colorCountLabel?: string;
  colors: string[];
  emptyLabel: string;
  label: string;
}) {
  if (colors.length === 0)
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <IconPaletteOff aria-hidden="true" className="size-4" />
        <span>{emptyLabel}</span>
      </div>
    );

  return (
    <div className="flex items-center gap-2">
      <ul aria-label={label} className="flex items-center gap-1">
        {colors.slice(0, 4).map((color) => (
          <li key={color}>
            <span
              aria-label={color}
              className={cn(
                "block size-5 rounded-sm",
                /^#(?:000|000000|fff|ffffff)$/i.test(color.trim()) &&
                  "border border-primary/50",
              )}
              role="img"
              style={{ backgroundColor: color }}
            />
          </li>
        ))}
      </ul>
      {colorCountLabel ? (
        <span className="text-muted-foreground">{colorCountLabel}</span>
      ) : null}
    </div>
  );
}

export function PortalImageStack({
  emptyLabel,
  imageCountLabel,
  images,
  label,
  totalImageCount,
}: {
  emptyLabel: string;
  imageCountLabel?: string;
  images: PortalCardImage[];
  label: string;
  totalImageCount: number;
}) {
  if (totalImageCount === 0)
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <div
          aria-hidden="true"
          className="flex size-[100px] shrink-0 items-center justify-center rounded-md border bg-secondary"
        >
          <IconPhotoOff className="size-4" />
        </div>
        <span>{emptyLabel}</span>
      </div>
    );
  return (
    <div className="flex items-center gap-3">
      <ul aria-label={label} className="flex flex-wrap items-center gap-3">
        {images.slice(0, 1).map((image) => (
          <li className="shrink-0" key={image.url}>
            <Image
              alt={image.alt}
              className="size-[100px] rounded-md object-contain"
              height={100}
              loading="lazy"
              sizes="100px"
              src={image.url}
              style={{
                backgroundColor:
                  !image.backgroundColor ||
                  image.backgroundColor === "secondary"
                    ? "var(--secondary)"
                    : image.backgroundColor,
                padding: image.containerPadding ?? 0,
              }}
              unoptimized={
                image.url.startsWith("/api/portal-assets/preview?") ||
                !image.url.startsWith("/")
              }
              width={100}
            />
          </li>
        ))}
      </ul>
      {imageCountLabel ? (
        <span className="text-muted-foreground">{imageCountLabel}</span>
      ) : null}
    </div>
  );
}
