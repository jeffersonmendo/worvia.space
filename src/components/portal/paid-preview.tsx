import {
  IconCalendarEventFilled,
  IconCheck,
  IconCrownFilled,
  IconDatabaseFilled,
  IconPhotoFilled,
} from "@tabler/icons-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { PortalFileType } from "@/lib/portal/document";
import type { PortalCardFileType } from "@/lib/portal/portal-card-metadata";
import {
  formatPreviewBytes,
  type PaidPreviewInput,
  projectPaidPreview,
} from "./paid-preview-projection";
import { PortalColorStack, PortalFileTypeBadges } from "./portal-card-metadata";

export type PaidPreviewProps = PaidPreviewInput & {
  locale: string;
  updatedAt?: string | null;
};

export async function PaidPreview({
  locale,
  updatedAt,
  ...input
}: PaidPreviewProps) {
  const t = await getTranslations({
    locale,
    namespace: "PublicPortal.preview",
  });
  const preview = projectPaidPreview(input);
  const previewImage = preview.previewImages[0]?.src;
  const totalFiles =
    preview.totalFiles ||
    preview.assetSummary.reduce((sum, item) => sum + item.count, 0);
  const totalBytes =
    preview.totalBytes ||
    preview.assetSummary.reduce((sum, item) => sum + item.totalBytes, 0);
  const totalImages =
    preview.totalImages ||
    preview.assetSummary.find((item) => item.assetType === "image")?.count ||
    0;
  const previewThumbnails = preview.previewImages.slice(1, 5);
  const remainingPreviewImages = Math.max(
    totalImages - 1 - previewThumbnails.length,
    0,
  );
  const fileGroups = preview.sampleFiles.reduce<
    Array<{ count: number; name: string; type: string }>
  >((groups, file) => {
    const type = paidPreviewFileType("", file.assetType) ?? file.assetType;
    const name = fileTypeLabel("", type);
    if (name === "file" || !hasPaidPreviewIcon(type)) return groups;
    const existing = groups.find((group) => group.name === name);
    if (existing) existing.count += 1;
    else groups.push({ count: 1, name, type });
    return groups;
  }, []);
  const adobeTypes = new Set([
    "psd",
    "psb",
    "ai",
    "ait",
    "eps",
    "indd",
    "indt",
    "idml",
  ]);
  fileGroups.sort(
    (left, right) =>
      Number(!adobeTypes.has(left.type)) -
        Number(!adobeTypes.has(right.type)) || right.count - left.count,
  );
  const fileTypes = fileGroups
    .map((file) => file.type)
    .filter(
      (type, index, values): type is PortalCardFileType =>
        ["ai", "psd", "eps", "pdf"].includes(type) &&
        values.indexOf(type) === index,
    )
    .slice(0, 4);
  const visibleColorCount = Math.min(preview.colors.length, 4);

  return (
    <main className="min-h-dvh px-2 py-2 text-foreground">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8">
        <div className="grid w-full min-w-0 gap-8 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col justify-start p-1">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-4xl">
              {preview.name}
            </h1>
            {preview.description ? (
              <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
                {preview.description}
              </p>
            ) : null}

            <div className="mt-10 flex flex-col gap-3 text-sm">
              <Badge className="w-fit gap-1.5 border-0 bg-amber-400/15 text-amber-700 dark:text-amber-300">
                <IconCrownFilled data-icon="inline-start" />
                {t("premium")}
              </Badge>
              <PortalFileTypeBadges
                emptyLabel={t("noFiles")}
                fileCountLabel={
                  totalFiles > fileTypes.length
                    ? t("filesCount", { count: totalFiles - fileTypes.length })
                    : t("filesTotal", { count: totalFiles })
                }
                fileTypes={fileTypes}
                label={t("fileTypesLabel")}
                totalFileCount={totalFiles}
              />
              {preview.colors.length ? (
                <PortalColorStack
                  colorCountLabel={
                    preview.colors.length > visibleColorCount
                      ? t("colorsCount", {
                          count: preview.colors.length - visibleColorCount,
                        })
                      : t("colorsTotal", { count: preview.colors.length })
                  }
                  colors={preview.colors}
                  emptyLabel={t("noColors")}
                  label={t("colorsLabel")}
                />
              ) : null}
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconPhotoFilled aria-hidden="true" className="size-4" />
                <span>
                  {t("totalImages")} · {totalImages}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconDatabaseFilled aria-hidden="true" className="size-4" />
                <span>
                  {t("totalSize")} · {formatPreviewBytes(totalBytes, locale)}
                </span>
              </div>
              {updatedAt ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconCalendarEventFilled
                    aria-hidden="true"
                    className="size-4"
                  />
                  <span>
                    {t("updatedAt")} · {formatPreviewDate(updatedAt, locale)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-10">
              <p className="text-sm font-medium">{t("benefitsTitle")}</p>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <Benefit>{t("oneTimePayment")}</Benefit>
                <Benefit>{t("fullAccess")}</Benefit>
                <Benefit>{t("originalImages")}</Benefit>
                <Benefit>{t("privateAccess")}</Benefit>
                <Benefit>{t("lifetimeUpdates")}</Benefit>
              </ul>
            </div>
          </section>

          <section className="min-w-0 p-1">
            <div className="flex w-full flex-col gap-6">
              {previewImage ? (
                <>
                  <div className="relative overflow-hidden rounded-2xl">
                    {/* biome-ignore lint/performance/noImgElement: This URL is a server-generated preview derivative. */}
                    <img
                      alt=""
                      className="aspect-[16/10] w-full object-cover"
                      src={previewImage}
                    />
                  </div>
                  {previewThumbnails.length ? (
                    <ul
                      aria-label={t("imagesLabel")}
                      className="scroll-fade flex w-full gap-3 overflow-x-auto pb-1"
                    >
                      {previewThumbnails.map((image) => (
                        <li
                          className="size-[100px] shrink-0 overflow-hidden rounded-lg bg-secondary"
                          key={image.src}
                        >
                          {/* biome-ignore lint/performance/noImgElement: These URLs are server-generated preview derivatives. */}
                          <img
                            alt={image.alt}
                            className="size-full object-contain"
                            src={image.src}
                          />
                        </li>
                      ))}
                      {remainingPreviewImages ? (
                        <li className="flex size-[100px] shrink-0 list-none items-center justify-center rounded-lg bg-secondary px-2 text-center text-sm font-medium text-muted-foreground">
                          {t("moreImages", { count: remainingPreviewImages })}
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="flex flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-1.5">
            <span>{t("poweredBy")}</span>
            <Link className="font-medium underline underline-offset-4" href="/">
              Portals Design
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function paidPreviewFileType(
  name: string,
  type: string,
): PortalFileType | undefined {
  const extension = name.split(".").pop()?.toLowerCase();
  const normalizedType = type.trim().toLowerCase().replace(/^\./, "");
  const knownExtensions = [
    "pdf",
    "ai",
    "ait",
    "eps",
    "psd",
    "psb",
    "indd",
    "indt",
    "idml",
    "svg",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "avif",
    "md",
    "txt",
    "tif",
    "tiff",
  ];
  const candidate = knownExtensions.includes(extension ?? "")
    ? extension
    : normalizedType.split("/").pop()?.split(".").pop();
  if (candidate === "pdf") return "pdf";
  if (candidate === "ai") return "ai";
  if (candidate === "ait") return "ait";
  if (candidate === "eps" || candidate === "postscript") return "eps";
  if (candidate === "illustrator" || normalizedType.includes("illustrator"))
    return "ai";
  if (candidate === "psd" || normalizedType.includes("photoshop")) return "psd";
  if (candidate === "psb") return "psb";
  if (candidate === "indd") return "indd";
  if (candidate === "indt") return "indt";
  if (candidate === "idml") return "idml";
  if (candidate === "svg") return "svg";
  if (candidate === "md") return "md";
  if (candidate === "txt") return "txt";
  if (candidate === "tif" || candidate === "tiff") return "tiff";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(candidate ?? ""))
    return "image";
  return undefined;
}

function hasPaidPreviewIcon(type: string) {
  return ["ai", "ait", "eps", "md", "pdf", "psb", "psd", "svg"].includes(type);
}

function normalizedFileType(name: string, type: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  const knownExtensions = [
    "ai",
    "ait",
    "eps",
    "psd",
    "psb",
    "indd",
    "indt",
    "idml",
    "pdf",
    "svg",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "avif",
    "md",
    "txt",
    "tif",
    "tiff",
  ];
  return knownExtensions.includes(extension ?? "")
    ? (extension ?? type.toLowerCase())
    : type.toLowerCase();
}

function fileTypeLabel(name: string, type: string) {
  const normalized = normalizedFileType(name, type);
  if (["ai", "ait"].includes(normalized)) return "Adobe Illustrator";
  if (normalized === "eps") return "EPS";
  if (["psd", "psb"].includes(normalized)) return "Adobe Photoshop";
  if (["indd", "indt", "idml"].includes(normalized)) return "Adobe InDesign";
  if (normalized === "pdf") return "PDF";
  return normalized;
}

function Benefit({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <IconCheck className="size-4 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </li>
  );
}

function formatPreviewDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
