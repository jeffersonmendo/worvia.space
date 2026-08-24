import type {
  PortalDocument,
  PortalImageItem,
  PortalSection,
} from "./document";

export const EXPORT_LIMITS = {
  maxEntries: 100,
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalBytes: 250 * 1024 * 1024,
  timeoutMs: 30_000,
} as const;

export type PortalExportSource = "editor" | "published";

export function portalExportHref(
  slug: string,
  source: PortalExportSource = "published",
) {
  const href = `/api/portals/${encodeURIComponent(slug)}/export`;
  return source === "editor" ? `${href}?source=editor` : href;
}

export function selectPortalExportDocument<T>({
  current,
  published,
  source,
}: {
  current: T | null;
  published: T | null;
  source: PortalExportSource;
}) {
  return source === "editor" ? current : published;
}

export type ExportCategory = "colors" | "images" | "fonts" | "files";
export type ExportEntry = {
  allowDownload: boolean;
  category: ExportCategory;
  destination: string;
  itemId: string;
  fontFamily?: string;
  name: string;
  sectionId: string;
  storage?: { bucket: "portal-assets"; path: string };
  text?: string;
};
export type ExportManifest = {
  entries: ExportEntry[];
  ownerId: string;
  portalId: string;
  rootName: string;
  slug: string;
};

export function isCanonicalPortalAssetPath(
  path: string,
  ownerId: string,
  portalId: string,
) {
  const parts = path.split("/");
  return (
    parts.length >= 3 &&
    parts.every(Boolean) &&
    ((parts[0] === ownerId && parts[1] === portalId) ||
      (parts[0] === portalId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          parts[1] ?? "",
        )))
  );
}
export type ManifestScope =
  | { kind: "portal" }
  | { kind: "section"; sectionId: string }
  | { itemId: string; kind: "item" }
  | { fontFamily: string; kind: "font-family"; sectionId: string };

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function hasFileExtension(name: string) {
  return /\.[a-zA-Z0-9]{1,10}\s*$/.test(name);
}

function fileNameFromStoragePath(path: string | undefined) {
  const raw = path?.split("/").filter(Boolean).at(-1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      "",
    );
  } catch {
    return raw;
  }
}

function imageDownloadLabel(image: PortalImageItem) {
  if (image.download_name) return image.download_name;
  const sourceName = fileNameFromStoragePath(image.storage_path);
  if (sourceName) return sourceName;
  const ext = extensionFromUrl(image.image_url, "jpg");
  return `image-${image.position + 1}.${ext}`;
}

export function sanitizeAssetName(value: string, fallback: string) {
  const extension = value.match(/\.([a-zA-Z0-9]{1,10})\s*$/)?.[1];
  const base =
    stripExtension(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\.\.+/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "")
      .slice(0, 100) || fallback;
  return extension ? `${base}.${extension.toLowerCase()}` : base;
}

export function parsePortalStorageReference(
  value: string,
  storageOrigin: string,
) {
  try {
    const url = new URL(value, storageOrigin);
    if (url.origin !== new URL(storageOrigin).origin) return null;
    const match = url.pathname.match(
      /^\/storage\/v1\/object\/(?:public|sign)\/portal-assets\/(.+)$/,
    );
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    if (
      !path ||
      path.split("/").some((part) => !part || part === "." || part === "..")
    )
      return null;
    return { bucket: "portal-assets" as const, path };
  } catch {
    return null;
  }
}

function resolvePortalStorageReference(input: {
  storageOrigin: string;
  storagePath?: string;
  url?: string;
}) {
  if (input.storagePath) {
    const path = input.storagePath.trim();
    if (
      path &&
      !path.startsWith("/") &&
      !path.split("/").some((part) => !part || part === "." || part === "..")
    )
      return { bucket: "portal-assets" as const, path };
  }
  return input.url
    ? parsePortalStorageReference(input.url, input.storageOrigin)
    : null;
}

export function buildColorsText(section: PortalSection) {
  return `${(section.content.colors ?? [])
    .filter((color) => color.visible)
    .sort((a, b) => a.position - b.position)
    .map((color) => {
      const codes = [`HEX ${color.color_code}`];
      if (color.rgb) codes.push(`RGB ${color.rgb}`);
      if (color.cmyk) codes.push(`CMYK ${color.cmyk}`);
      if (color.pantone) codes.push(`PANTONE ${color.pantone}`);
      return `${color.color_name || "Color"}: ${codes.join(" | ")}`;
    })
    .join("\n")}\n`;
}

function extensionFromUrl(value: string, fallback: string) {
  try {
    const ext = new URL(value).pathname.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1];
    return ext?.toLowerCase() ?? fallback;
  } catch {
    return fallback;
  }
}

export function buildExportManifest(
  document: PortalDocument,
  options: {
    ownerId: string;
    portalId: string;
    slug: string;
    storageOrigin: string;
  },
): ExportManifest {
  const entries: ExportEntry[] = [];
  const used = new Map<string, number>();
  const uniqueDestination = (destination: string) => {
    const seen = used.get(destination) ?? 0;
    used.set(destination, seen + 1);
    if (!seen) return destination;
    const dot = destination.lastIndexOf(".");
    return dot > destination.lastIndexOf("/")
      ? `${destination.slice(0, dot)}-${seen + 1}${destination.slice(dot)}`
      : `${destination}-${seen + 1}`;
  };

  for (const section of [...document.sections].sort(
    (a, b) => a.position - b.position,
  )) {
    if (
      !section.visible ||
      !section.allow_download ||
      section.type === "text" ||
      section.type === "empty"
    )
      continue;
    const sectionName = sanitizeAssetName(
      section.title || section.type,
      section.type,
    );
    if (section.type === "colors") {
      const text = buildColorsText(section);
      if (text.trim())
        entries.push({
          allowDownload: true,
          category: "colors",
          destination: `colors/${sectionName}/colors.txt`,
          itemId: `colors-${section.id}`,
          name: "colors.txt",
          sectionId: section.id,
          text,
        });
      continue;
    }
    const addAsset = (input: {
      allowDownload: boolean;
      category: ExportCategory;
      fontFamily?: string;
      id: string;
      label: string;
      storagePath?: string;
      url?: string;
    }) => {
      if (!input.allowDownload || (!input.url && !input.storagePath)) return;
      const storage = resolvePortalStorageReference({
        storageOrigin: options.storageOrigin,
        storagePath: input.storagePath,
        url: input.url,
      });
      if (!storage) return;
      if (
        !isCanonicalPortalAssetPath(
          storage.path,
          options.ownerId,
          options.portalId,
        )
      )
        return;
      const fallbackExt = input.category === "images" ? "jpg" : "bin";
      const sourceName = hasFileExtension(input.label)
        ? input.label
        : `${input.label}.${extensionFromUrl(input.url ?? storage.path, fallbackExt)}`;
      const name = sanitizeAssetName(
        sourceName,
        `${input.category}-${input.id}`,
      );
      entries.push({
        allowDownload: true,
        category: input.category,
        destination: uniqueDestination(
          `${input.category}/${sectionName}/${name}`,
        ),
        fontFamily: input.fontFamily,
        itemId: input.id,
        name,
        sectionId: section.id,
        storage,
      });
    };
    if (section.type === "image" && section.content.image) {
      const image = section.content.image;
      addAsset({
        allowDownload: image.allow_download,
        category: "images",
        id: image.id,
        label: imageDownloadLabel(image),
        storagePath: image.storage_path,
        url: image.image_url,
      });
    }
    if (section.type === "gallery" || section.type === "image_comparison") {
      for (const image of (section.content.images ?? [])
        .filter((item) => item.visible)
        .sort((a, b) => a.position - b.position)) {
        addAsset({
          allowDownload: image.allow_download,
          category: "images",
          id: image.id,
          label: imageDownloadLabel(image),
          storagePath: image.storage_path,
          url: image.image_url,
        });
      }
    }
    if (section.type === "fonts") {
      for (const font of (section.content.fonts ?? [])
        .filter((item) => item.visible)
        .sort((a, b) => a.position - b.position)) {
        addAsset({
          allowDownload: true,
          category: "fonts",
          fontFamily: font.font_name,
          id: font.id,
          label:
            font.download_name ||
            font.display_name ||
            font.file_name ||
            font.font_name,
          storagePath: font.storage_path,
          url: font.file_url,
        });
      }
    }
    if (section.type === "files") {
      for (const file of (section.content.files ?? [])
        .filter((item) => item.visible)
        .sort((a, b) => a.position - b.position)) {
        addAsset({
          allowDownload: file.allow_download,
          category: "files",
          id: file.id,
          label: file.download_name || file.display_name || file.file_name,
          storagePath: file.storage_path,
          url: file.file_url,
        });
      }
    }
  }
  if (entries.length > EXPORT_LIMITS.maxEntries)
    throw new Error("EXPORT_ENTRY_LIMIT");
  return {
    entries,
    ownerId: options.ownerId,
    portalId: options.portalId,
    rootName: `portal-${sanitizeAssetName(options.slug, "portal")}`,
    slug: options.slug,
  };
}

export function selectManifestScope(
  manifest: ExportManifest,
  scope: ManifestScope,
): ExportManifest {
  const entries =
    scope.kind === "portal"
      ? manifest.entries
      : scope.kind === "section"
        ? manifest.entries.filter(
            (entry) => entry.sectionId === scope.sectionId,
          )
        : scope.kind === "item"
          ? manifest.entries.filter((entry) => entry.itemId === scope.itemId)
          : manifest.entries.filter(
              (entry) =>
                entry.sectionId === scope.sectionId &&
                entry.category === "fonts" &&
                entry.fontFamily === scope.fontFamily,
            );
  return { ...manifest, entries };
}

export function buildManifestText(
  manifest: ExportManifest,
  omitted: string[] = [],
) {
  const lines = [
    "Worvia export",
    `Portal: ${manifest.slug}`,
    "",
    "Files:",
    ...manifest.entries.map((entry) => `- ${entry.destination}`),
  ];
  if (omitted.length)
    lines.push("", "Omitted:", ...omitted.map((item) => `- ${item}`));
  return `${lines.join("\n")}\n`;
}
