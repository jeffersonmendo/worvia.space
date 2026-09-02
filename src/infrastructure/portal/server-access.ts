import "server-only";

import { cookies } from "next/headers";
import {
  accessCookieName,
  canExportPublishedSnapshot,
  hashOpaqueToken,
  type PortalAccessDecision,
  resolveAccessDecision,
} from "@/domain/portal/access";
import type {
  PaidPreviewAssetSummary,
  PaidPreviewFile,
  PaidPreviewImage,
} from "@/domain/portal/paid-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Json,
  Portal,
  PortalPublication,
} from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type ResolvedPortalAccess = {
  decision: PortalAccessDecision;
  portal: Pick<
    Portal,
    | "id"
    | "owner_id"
    | "name"
    | "created_at"
    | "updated_at"
    | "slug"
    | "visibility"
    | "status"
    | "published_publication_id"
    | "short_description"
    | "designer_name"
    | "cover_url"
    | "allow_downloads"
    | "allow_asset_downloads"
    | "allow_color_copy"
  > | null;
  publication: Pick<PortalPublication, "id" | "snapshot"> | null;
  isOwner: boolean;
  /** Narrow contract for the future paid-preview payload. Not used for authorization. */
  paidPreview: {
    assetSummary: PaidPreviewAssetSummary[];
    colors: string[];
    description: string | null;
    name: string;
    previewImages: PaidPreviewImage[];
    sampleFiles: PaidPreviewFile[];
    price: string | null;
    totalBytes: number;
    totalFiles: number;
    totalImages: number;
    unlockHref: string | null;
  } | null;
};

function jsonRecord(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : null;
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function snapshotDocumentRecord(snapshot: Json | null | undefined) {
  const root = jsonRecord(snapshot);
  return jsonRecord(root?.document) ?? root;
}

function previewColorValues(value: unknown): string[] {
  const colors: string[] = [];
  const visit = (current: unknown) => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== "object") return;
    const record = current as Record<string, unknown>;
    for (const key of ["color_code", "color"]) {
      const color = record[key];
      if (
        typeof color === "string" &&
        /^(?:#[0-9a-f]{3,4}|#[0-9a-f]{6,8}|(?:rgb|rgba|hsl|hsla|hsb|hsba)\(.+\))$/i.test(
          color,
        )
      ) {
        colors.push(color);
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return [...new Set(colors)];
}

function publishedImageAssetKeys(snapshot: Json | null | undefined) {
  const record = snapshotDocumentRecord(snapshot);
  if (!record) return [];
  const sections = Array.isArray(record.sections) ? record.sections : [];
  const keys: string[] = [];
  for (const section of [...sections].sort(
    (left, right) =>
      Number((left as Record<string, unknown>)?.position ?? 0) -
      Number((right as Record<string, unknown>)?.position ?? 0),
  )) {
    if (!section || typeof section !== "object") continue;
    const sectionRecord = section as Record<string, unknown>;
    const content = sectionRecord.content;
    if (!content || typeof content !== "object") continue;
    const contentRecord = content as Record<string, unknown>;
    const images =
      sectionRecord.type === "image"
        ? contentRecord.image
          ? [contentRecord.image]
          : []
        : Array.isArray(contentRecord.images)
          ? [...contentRecord.images].sort(
              (left, right) =>
                Number((left as Record<string, unknown>)?.position ?? 0) -
                Number((right as Record<string, unknown>)?.position ?? 0),
            )
          : [];
    for (const image of images) {
      if (!image || typeof image !== "object") continue;
      const imageRecord = image as Record<string, unknown>;
      if (imageRecord.visible === false) continue;
      const assetId = stringValue(imageRecord.asset_id as Json | undefined);
      const storagePath = stringValue(
        imageRecord.storage_path as Json | undefined,
      );
      if (assetId) keys.push(`id:${assetId}`);
      else if (storagePath) keys.push(`path:${storagePath}`);
    }
  }
  return [...new Set(keys)];
}

function publishedImagePresentation(snapshot: Json | null | undefined) {
  const result = new Map<
    string,
    { backgroundColor?: string; containerPadding?: number }
  >();
  const record = snapshotDocumentRecord(snapshot);
  if (!record) return result;
  const sections = Array.isArray(record.sections) ? record.sections : [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const sectionRecord = section as Record<string, unknown>;
    const content = sectionRecord.content;
    if (!content || typeof content !== "object") continue;
    const contentRecord = content as Record<string, unknown>;
    const layout =
      sectionRecord.layout && typeof sectionRecord.layout === "object"
        ? (sectionRecord.layout as Record<string, unknown>)
        : {};
    const images =
      sectionRecord.type === "image"
        ? contentRecord.image
          ? [contentRecord.image]
          : []
        : Array.isArray(contentRecord.images)
          ? contentRecord.images
          : [];
    for (const image of images) {
      if (!image || typeof image !== "object") continue;
      const imageRecord = image as Record<string, unknown>;
      const assetId = stringValue(imageRecord.asset_id as Json | undefined);
      const storagePath = stringValue(
        imageRecord.storage_path as Json | undefined,
      );
      const key = assetId
        ? `id:${assetId}`
        : storagePath
          ? `path:${storagePath}`
          : null;
      if (!key) continue;
      result.set(key, {
        backgroundColor:
          stringValue(imageRecord.background_color as Json | undefined) ??
          stringValue(layout.imageBackgroundColor as Json | undefined) ??
          undefined,
        containerPadding:
          typeof imageRecord.container_padding === "number"
            ? imageRecord.container_padding
            : typeof layout.imageContainerPadding === "number"
              ? layout.imageContainerPadding
              : undefined,
      });
    }
  }
  return result;
}

function booleanValue(value: Json | undefined) {
  return typeof value === "boolean" ? value : false;
}

function paidPreviewValue(value: Json | undefined) {
  const record = jsonRecord(value);
  if (!record) return null;
  const assetSummary = Array.isArray(record.asset_summary)
    ? record.asset_summary.flatMap((item) => {
        const asset = jsonRecord(item);
        const assetType = stringValue(asset?.asset_type);
        const count = asset?.count;
        const totalBytes = asset?.total_bytes;
        return assetType &&
          typeof count === "number" &&
          typeof totalBytes === "number"
          ? [{ assetType, count, totalBytes }]
          : [];
      })
    : [];
  const sampleFiles = Array.isArray(record.sample_files)
    ? record.sample_files.flatMap((item) => {
        const file = jsonRecord(item);
        const assetType = stringValue(file?.asset_type);
        return assetType ? [{ assetType }] : [];
      })
    : [];
  return {
    assetSummary,
    colors: previewColorValues(record.colors),
    description: stringValue(record.description),
    name: stringValue(record.name) ?? "",
    previewImages: [],
    sampleFiles,
    price: stringValue(record.price),
    totalBytes: typeof record.total_bytes === "number" ? record.total_bytes : 0,
    totalFiles: typeof record.total_files === "number" ? record.total_files : 0,
    totalImages:
      typeof record.total_images === "number" ? record.total_images : 0,
    unlockHref: stringValue(record.unlock_href),
  };
}

function assetType(asset: {
  category: string | null;
  mime_type: string | null;
  name: string;
}) {
  const extension = asset.name.split(".").pop()?.toLowerCase();
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
    "tif",
    "tiff",
  ];
  if (knownExtensions.includes(extension ?? "")) return extension as string;
  if (asset.category?.trim()) return asset.category.trim();
  if (asset.mime_type?.startsWith("image/")) return "image";
  if (asset.mime_type?.includes("pdf")) return "pdf";
  return asset.mime_type?.split("/").at(-1) || "file";
}

function jsonArray(value: Json | undefined) {
  return Array.isArray(value) ? value : [];
}

function fileSizeBytes(value: Json | undefined) {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.max(0, value);
  if (typeof value !== "string") return 0;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)?$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "B").toUpperCase();
  return Math.round(
    amount * ({ B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[unit] ?? 1),
  );
}

function snapshotAssetSummary(snapshot: Json | null | undefined) {
  const root = jsonRecord(snapshot);
  const document = jsonRecord(root?.document) ?? root;
  const sections = jsonArray(document?.sections ?? root?.blocks).flatMap(
    (item) => {
      const section = jsonRecord(item);
      return section ? [section] : [];
    },
  );
  const filesWithSizes = sections.flatMap((section) =>
    section.type === "files" || section.type === "file"
      ? (section.type === "file"
          ? [section.content]
          : jsonArray(jsonRecord(section.content)?.files)
        ).flatMap((item) => {
          const file = jsonRecord(item);
          const name = stringValue(file?.file_name) ?? stringValue(file?.name);
          return name
            ? [
                {
                  assetType: assetType({
                    category:
                      stringValue(file?.category) ??
                      stringValue(file?.file_type),
                    mime_type: stringValue(file?.mime_type),
                    name,
                  }),
                  name,
                  sizeBytes: fileSizeBytes(file?.file_size),
                },
              ]
            : [];
        })
      : [],
  );
  const imageCount = sections.reduce((count, section) => {
    if (section.type === "image") return count + 1;
    return (
      count +
      (section.type === "gallery"
        ? jsonArray(jsonRecord(section.content)?.images).length
        : 0)
    );
  }, 0);
  return {
    files: filesWithSizes.map(({ assetType }) => ({ assetType })),
    imageCount,
    totalBytes: filesWithSizes.reduce((sum, file) => sum + file.sizeBytes, 0),
    totalFiles: filesWithSizes.length,
  };
}

export type PortalShareSummary = {
  colors: string[];
  colorCount: number;
  fileTypes: string[];
  imageCount: number;
  totalBytes: number;
  totalFiles: number;
};

const shareFileType = (value: string) => {
  const type = value.trim().toLowerCase().replace(/^\./, "");
  if (["ai", "ait", "illustrator"].includes(type)) return "ai";
  if (["eps", "postscript"].includes(type)) return "eps";
  if (["psd", "psb", "photoshop"].includes(type)) return "psd";
  if (type === "pdf") return "pdf";
  return null;
};

const shareFileTypes = (values: string[]) =>
  [...new Set(values.map(shareFileType).filter(Boolean))] as string[];

export function getPortalShareSummary({
  paidPreview,
  publicationSnapshot,
}: {
  paidPreview: ResolvedPortalAccess["paidPreview"];
  publicationSnapshot: Json | null | undefined;
}): PortalShareSummary {
  if (paidPreview) {
    return {
      colors: paidPreview.colors,
      colorCount: paidPreview.colors.length,
      fileTypes: shareFileTypes(
        paidPreview.sampleFiles.map((file) => file.assetType),
      ),
      imageCount: paidPreview.totalImages,
      totalBytes: paidPreview.totalBytes,
      totalFiles: paidPreview.totalFiles,
    };
  }

  const summary = snapshotAssetSummary(publicationSnapshot);
  return {
    colors: previewColorValues(publicationSnapshot),
    colorCount: previewColorValues(publicationSnapshot).length,
    fileTypes: shareFileTypes(summary.files.map((file) => file.assetType)),
    imageCount: summary.imageCount,
    totalBytes: summary.totalBytes,
    totalFiles: summary.totalFiles,
  };
}

async function enrichPaidPreview(
  portalId: string,
  preview: ResolvedPortalAccess["paidPreview"],
) {
  if (!preview) return null;
  const admin = createAdminClient();
  const [
    { data: offer },
    { data: assets },
    { data: publication },
    { data: documentRow },
    { data: blocks },
  ] = await Promise.all([
    admin
      .from("paid_portal_offers")
      .select("price_cents,currency")
      .eq("portal_id", portalId)
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("portal_assets")
      .select("id,name,mime_type,category,size_bytes,position,file_path")
      .eq("portal_id", portalId)
      .eq("state", "ready")
      .order("position", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("portal_publications")
      .select("snapshot")
      .eq("portal_id", portalId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("portal_documents")
      .select("document")
      .eq("portal_id", portalId)
      .maybeSingle(),
    admin
      .from("portal_blocks")
      .select("type,content")
      .eq("portal_id", portalId)
      .eq("is_visible", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  const readyAssets = assets ?? [];
  const summary = new Map<string, PaidPreviewAssetSummary>();
  let totalBytes = 0;
  let totalImages = 0;
  for (const asset of readyAssets) {
    const sizeBytes = asset.size_bytes ?? 0;
    const type = assetType(asset);
    const current = summary.get(type) ?? {
      assetType: type,
      count: 0,
      totalBytes: 0,
    };
    current.count += 1;
    current.totalBytes += sizeBytes;
    summary.set(type, current);
    totalBytes += sizeBytes;
    if (asset.mime_type?.startsWith("image/")) totalImages += 1;
  }
  const selected = readyAssets;
  const sampleFiles = selected.map((asset) => ({
    assetType: assetType(asset),
  }));
  const price = offer?.price_cents
    ? new Intl.NumberFormat("en-US", {
        currency: (offer.currency || "usd").toUpperCase(),
        style: "currency",
      }).format(offer.price_cents / 100)
    : preview.price;
  const publishedSummary = snapshotAssetSummary(publication?.snapshot);
  const editorSummary = documentRow?.document
    ? snapshotAssetSummary(documentRow.document)
    : snapshotAssetSummary({ blocks: blocks ?? [] } as Json);
  const snapshot =
    readyAssets.length === 0
      ? publishedSummary.totalFiles || publishedSummary.imageCount
        ? publishedSummary
        : editorSummary
      : null;
  const contentFiles = [...publishedSummary.files, ...editorSummary.files];
  const colors = previewColorValues([documentRow?.document, blocks]);
  const imageAssets = readyAssets.filter((asset) =>
    asset.mime_type?.startsWith("image/"),
  );
  const publishedImageKeys = publishedImageAssetKeys(publication?.snapshot);
  const imagePresentations = publishedImagePresentation(publication?.snapshot);
  const orderedPreviewImageAssets = [
    ...publishedImageKeys
      .map((key) =>
        imageAssets.find((asset) =>
          key.startsWith("id:")
            ? asset.id === key.slice(3)
            : asset.file_path === key.slice(5),
        ),
      )
      .filter((asset): asset is (typeof imageAssets)[number] => Boolean(asset)),
  ];
  const hasPreviewImage = orderedPreviewImageAssets.length > 0;
  return {
    ...preview,
    assetSummary: summary.size ? [...summary.values()] : preview.assetSummary,
    colors: colors.length ? colors : preview.colors,
    previewImages: hasPreviewImage
      ? orderedPreviewImageAssets.slice(0, 6).map((asset, imageIndex) => ({
          alt: `Portal preview ${imageIndex + 1}`,
          ...(imagePresentations.get(`id:${asset.id}`) ??
            imagePresentations.get(`path:${asset.file_path}`)),
          src: `/api/portal/paid-preview-image?portal_id=${encodeURIComponent(portalId)}&asset_id=${encodeURIComponent(asset.id)}`,
        }))
      : [],
    price,
    sampleFiles: contentFiles.length
      ? contentFiles
      : sampleFiles.length
        ? sampleFiles
        : (snapshot?.files ?? []),
    totalBytes: readyAssets.length
      ? totalBytes
      : (snapshot?.totalBytes ?? totalBytes),
    totalFiles: readyAssets.length
      ? readyAssets.length
      : (snapshot?.totalFiles ?? 0),
    totalImages: readyAssets.length ? totalImages : (snapshot?.imageCount ?? 0),
  };
}

function parsePortalPayload(
  value: Json | null,
): Pick<ResolvedPortalAccess, "paidPreview" | "portal" | "publication"> {
  const payload = jsonRecord(value);
  const portal = jsonRecord(payload?.portal);
  if (!portal) return { paidPreview: null, portal: null, publication: null };
  const publication = jsonRecord(payload?.publication);
  return {
    paidPreview: paidPreviewValue(portal?.paid_preview),
    portal: {
      allow_asset_downloads: booleanValue(portal.allow_asset_downloads),
      allow_color_copy: booleanValue(portal.allow_color_copy),
      allow_downloads: booleanValue(portal.allow_downloads),
      cover_url: stringValue(portal.cover_url),
      created_at: stringValue(portal.created_at) ?? "",
      designer_name: stringValue(portal.designer_name),
      id: stringValue(portal.id) ?? "",
      name: stringValue(portal.name) ?? "",
      owner_id: stringValue(portal.owner_id) ?? "",
      published_publication_id: stringValue(portal.published_publication_id),
      short_description: stringValue(portal.short_description),
      slug: stringValue(portal.slug) ?? "",
      status: (stringValue(portal.status) ?? "draft") as Portal["status"],
      updated_at: stringValue(portal.updated_at) ?? "",
      visibility: (stringValue(portal.visibility) ??
        "private") as Portal["visibility"],
    },
    publication: publication
      ? {
          id: stringValue(publication.id) ?? "",
          snapshot: publication.snapshot ?? null,
        }
      : null,
  };
}

async function hasValidUnlock(portalId: string) {
  const token = (await cookies()).get(accessCookieName(portalId))?.value;
  if (!token) return false;
  const admin = createAdminClient();
  const tokenHash = await hashOpaqueToken(token);
  const { data } = await admin
    .from("portal_access_sessions")
    .select("id")
    .eq("portal_id", portalId)
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

export async function resolvePortalAccess(
  slug: string,
): Promise<ResolvedPortalAccess> {
  const admin = createAdminClient();
  const authClient = await createClient();
  const [{ data: payload }, { data: userData }] = await Promise.all([
    authClient.rpc("get_public_portal_payload", { portal_slug: slug }),
    authClient.auth.getUser(),
  ]);
  let { paidPreview, portal, publication } = parsePortalPayload(payload);
  if (!portal)
    return {
      decision: "not_found",
      isOwner: false,
      paidPreview: null,
      portal: null,
      publication: null,
    };
  if (
    portal.visibility === "paid" &&
    (!portal.created_at || !portal.updated_at)
  ) {
    const { data: portalMetadata } = await admin
      .from("portals")
      .select("created_at,updated_at")
      .eq("id", portal.id)
      .maybeSingle();
    if (portalMetadata) {
      portal = {
        ...portal,
        created_at: portalMetadata.created_at,
        updated_at: portalMetadata.updated_at,
      };
    }
  }
  if (portal.visibility === "paid") {
    paidPreview = await enrichPaidPreview(portal.id, paidPreview);
  }
  const userId = userData.user?.id ?? null;
  const { data: hasActivePaidAccess } =
    portal.visibility === "paid" && userId
      ? await authClient.rpc("portal_has_paid_access", {
          target_portal_id: portal.id,
        })
      : { data: false };
  const unlocked =
    portal.visibility === "password" ? await hasValidUnlock(portal.id) : false;
  const decision = resolveAccessDecision({
    ownerId: portal.owner_id,
    status: portal.status,
    unlocked,
    userId,
    visibility: portal.visibility,
    hasActivePaidAccess: Boolean(hasActivePaidAccess),
  });
  if (decision !== "allowed")
    return {
      decision,
      isOwner: userId === portal.owner_id,
      paidPreview,
      portal,
      publication: null,
    };
  let authorizedPublication = publication;
  if (
    portal.visibility === "paid" &&
    portal.published_publication_id &&
    !authorizedPublication
  ) {
    const { data } = await admin
      .from("portal_publications")
      .select("id,snapshot")
      .eq("id", portal.published_publication_id)
      .maybeSingle();
    authorizedPublication = data;
  }
  return {
    decision,
    isOwner: userId === portal.owner_id,
    paidPreview,
    portal,
    publication: authorizedPublication,
  };
}

export function getSnapshotDocument(snapshot: Json | null | undefined) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return null;
  const document = (snapshot as Record<string, Json | undefined>).document;
  return document && typeof document === "object" && !Array.isArray(document)
    ? document
    : null;
}

export async function getAuthorizedDocument(access: ResolvedPortalAccess) {
  const snapshot = getSnapshotDocument(access.publication?.snapshot);
  if (
    !access.portal ||
    !canExportPublishedSnapshot({
      decision: access.decision,
      hasSnapshot: Boolean(snapshot),
      publishedPublicationId: access.portal.published_publication_id,
      status: access.portal.status,
    })
  )
    return null;
  return snapshot;
}
