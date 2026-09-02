"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  normalizePortalDocument,
  portalDocumentToJson,
} from "@/domain/portal/document";
import {
  createUniqueSlugCandidate,
  normalizeDesignerName,
  normalizeSlug,
  normalizeWebsiteUrl,
  validateDesignerName,
  validateSlug,
} from "@/domain/portal/settings";
import { isAuthenticationRequiredError } from "@/lib/auth/auth-error";
import {
  PAID_PORTAL_MAX_PRICE_CENTS,
  PAID_PORTAL_MIN_PRICE_CENTS,
} from "@/lib/portal/paid-access";
import {
  normalizePortalCardColorCount,
  normalizePortalCardColors,
  normalizePortalCardFileCount,
  normalizePortalCardFileTypes,
  normalizePortalCardImageCount,
  normalizePortalCardImages,
} from "@/lib/portal/portal-card-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Json,
  Portal,
  PortalBlockType,
  PortalTheme,
  PortalVisibility,
} from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const blockTypes = new Set<PortalBlockType>([
  "text",
  "image",
  "gallery",
  "color",
  "typography",
  "file",
  "video",
  "comparison",
  "divider",
  "assets",
  "empty",
]);

type CreationVisibility = "public" | "private";

export type HomePortal = Pick<
  Portal,
  "id" | "name" | "slug" | "updated_at" | "visibility"
> & {
  hasPurchasedPlan: boolean;
  isPurchased: boolean;
  purchasedAt?: string;
  plan?: "free" | "starter" | "pro" | "premium";
  storageUsedBytes?: number;
  canDelete?: boolean;
  isFavorite: boolean;
  colors?: string[];
  totalColorCount?: number;
  fileTypes?: Array<"ai" | "psd" | "eps" | "pdf">;
  totalFileCount?: number;
  totalImageCount?: number;
  images?: Array<{
    alt: string;
    backgroundColor?: string;
    containerPadding?: number;
    height?: number;
    url: string;
    width?: number;
  }>;
};

export type HomePortalsResult = {
  error: "loadFailed" | null;
  portals: HomePortal[];
};

function logHomePortalsError(stage: string, error: unknown) {
  const details =
    error && typeof error === "object"
      ? {
          code:
            "code" in error && typeof error.code === "string"
              ? error.code
              : "unknown",
          name:
            "name" in error && typeof error.name === "string"
              ? error.name
              : "UnknownError",
        }
      : { code: "unknown", name: "UnknownError" };

  console.error("Failed to load home portals", { stage, ...details });
}

function homePortalsFailure(stage: string, error: unknown): HomePortalsResult {
  logHomePortalsError(stage, error);
  return { error: "loadFailed", portals: [] };
}

async function requireAuthenticatedUser(locale: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect(`/${locale}/auth/sign-in`);
  }

  return supabase;
}

export async function getHomePortals(
  locale: string,
): Promise<HomePortalsResult> {
  try {
    const supabase = await requireAuthenticatedUser(locale);
    const { data, error } = await supabase.rpc("get_home_workspace_summary");
    if (error) return homePortalsFailure("read-home-summary", error);
    const rows = Array.isArray((data as { portals?: unknown })?.portals)
      ? (data as { portals: Array<Record<string, unknown>> }).portals
      : [];
    return {
      error: null,
      portals: rows.map((portal) => ({
        id: String(portal.id),
        name: String(portal.name),
        slug: String(portal.slug),
        updated_at: String(portal.updatedAt),
        visibility: portal.visibility as Portal["visibility"],
        hasPurchasedPlan: portal.hasPurchasedPlan === true,
        isPurchased: portal.isPurchased === true,
        purchasedAt:
          typeof portal.purchasedAt === "string"
            ? portal.purchasedAt
            : undefined,
        plan:
          portal.plan === "starter" ||
          portal.plan === "pro" ||
          portal.plan === "premium"
            ? portal.plan
            : "free",
        storageUsedBytes:
          typeof portal.storageUsedBytes === "number"
            ? portal.storageUsedBytes
            : 0,
        canDelete: portal.canDelete !== false,
        isFavorite: portal.isFavorite === true,
        colors: normalizePortalCardColors(portal.colors),
        totalColorCount: normalizePortalCardColorCount(portal.colors),
        fileTypes: normalizePortalCardFileTypes(portal.fileTypes),
        totalFileCount: normalizePortalCardFileCount(portal.totalFileCount),
        totalImageCount: normalizePortalCardImageCount(portal.totalImageCount),
        images: normalizePortalCardImages(portal.images, String(portal.slug)),
      })),
    };
  } catch (error) {
    unstable_rethrow(error);
    return homePortalsFailure("unexpected", error);
  }
}

export async function togglePortalFavorite(args: {
  locale: string;
  portalId: string;
  isFavorite: boolean;
}): Promise<
  { error: null } | { error: "saveFailed" | "authenticationRequired" }
> {
  try {
    const supabase = await requireAuthenticatedUser(args.locale);
    const { error } = await supabase.rpc(
      args.isFavorite ? "remove_portal_favorite" : "add_portal_favorite",
      { target_portal_id: args.portalId },
    );
    if (error) return { error: "saveFailed" };
    revalidatePath(`/${args.locale}/home`);
    return { error: null };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "saveFailed" };
  }
}

export async function getRecentWorkspaceFavorites(locale: string) {
  const supabase = await requireAuthenticatedUser(locale);
  const { data, error } = await supabase.rpc("get_recent_workspace_favorites", {
    target_limit: 5,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getBoolean(formData: FormData, key: string, defaultValue = false) {
  const values = formData.getAll(key);

  if (values.length === 0) {
    return defaultValue;
  }

  return values.some((value) => value === "on" || value === "true");
}

function actionFailure(message: string): never {
  throw new Error(message);
}

function parseJsonObject(value: string): Record<string, Json> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, Json>;
    }
  } catch {
    return null;
  }

  return null;
}

function getGalleryImages(formData: FormData) {
  const existing = parseJsonObject(getString(formData, "content_json"));
  const rawImages = existing?.images;

  if (!Array.isArray(rawImages)) {
    return [];
  }

  return rawImages
    .map((item) => {
      if (typeof item === "string") {
        return {
          allow_download: true,
          alt: "",
          id: crypto.randomUUID(),
          url: item,
          visible: true,
        };
      }

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";

      if (!url) {
        return null;
      }

      return {
        allow_download:
          typeof record.allow_download === "boolean"
            ? record.allow_download
            : true,
        alt: typeof record.alt === "string" ? record.alt : "",
        id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
        url,
        visible: typeof record.visible === "boolean" ? record.visible : true,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

const slugify = normalizeSlug;

function getBlockType(formData: FormData): PortalBlockType {
  const type = getString(formData, "type") as PortalBlockType;

  return blockTypes.has(type) ? type : "text";
}

function buildBlockContent(formData: FormData, type: PortalBlockType): Json {
  const contentJson = parseJsonObject(getString(formData, "content_json"));

  if (contentJson) {
    return contentJson;
  }

  if (type === "empty") {
    return {};
  }

  if (type === "text") {
    return { body: getString(formData, "body") };
  }

  if (type === "image") {
    return {
      alt: getString(formData, "alt"),
      image_url: getString(formData, "image_url"),
    };
  }

  if (type === "color") {
    return {
      cmyk: getString(formData, "cmyk"),
      color_name: getString(formData, "color_name"),
      hex: getString(formData, "hex") || "#111111",
      opacity: getString(formData, "opacity") || "100%",
      pantone: getString(formData, "pantone"),
      rgb: getString(formData, "rgb"),
    };
  }

  if (type === "typography") {
    return {
      file_url: getString(formData, "file_url"),
      font_name: getString(formData, "font_name"),
      preview: getString(formData, "preview"),
      provider: getString(formData, "provider"),
      usage: getString(formData, "usage"),
      weights: getString(formData, "weights"),
    };
  }

  if (type === "video") {
    return { video_url: getString(formData, "video_url") };
  }

  if (type === "comparison") {
    return {
      after_label: getString(formData, "after_label"),
      after_url: getString(formData, "after_url"),
      before_label: getString(formData, "before_label"),
      before_url: getString(formData, "before_url"),
    };
  }

  if (type === "file") {
    return {
      file_name: getString(formData, "file_name"),
      file_url: getString(formData, "file_url"),
    };
  }

  if (type === "gallery") {
    const uploadedImage = getString(formData, "image_url");
    const images = getString(formData, "image_urls")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      images: uploadedImage ? [uploadedImage, ...images] : images,
    };
  }

  return {};
}

async function insertPortal({
  coverUrl = null,
  locale,
  name,
  rawSlug = name,
  visibility = "private",
}: {
  coverUrl?: string | null;
  locale: string;
  name: string;
  rawSlug?: string;
  visibility?: CreationVisibility;
}) {
  const t = await getTranslations({ locale, namespace: "Actions" });
  if (!name) actionFailure(t("nameRequired"));
  if (visibility !== "public" && visibility !== "private") {
    actionFailure(t("visibilityInvalid"));
  }
  const slug = slugify(rawSlug);
  if (!validateSlug(slug).valid) actionFailure(t("slugInvalid"));
  const supabase = await requireAuthenticatedUser(locale);

  const createPortalRecord = (candidateSlug: string) =>
    supabase.rpc("create_portal", {
      portal_cover_url: coverUrl,
      portal_name: name,
      portal_slug: candidateSlug,
      portal_visibility: visibility,
    } as never);

  let { data, error } = await createPortalRecord(slug);

  // Project names are allowed to repeat. The first version used the name as
  // the slug directly, so a retry after a partial creation hit the owner's
  // unique (owner_id, slug) constraint and surfaced only a generic toast.
  if (error?.code === "23505") {
    ({ data, error } = await createPortalRecord(
      createUniqueSlugCandidate(slug, crypto.randomUUID()),
    ));
  }

  if (error || !data) {
    actionFailure(error?.message ?? t("createPortalFailed"));
  }

  return data;
}

export async function createPortalFromHome({
  locale,
  contentLanguage = locale,
  name,
  visibility = "private",
}: {
  locale: string;
  contentLanguage?: string;
  name: string;
  visibility?: CreationVisibility;
}) {
  try {
    const portal = await insertPortal({
      locale,
      name: name.trim(),
      visibility,
    });
    const supabase = await requireAuthenticatedUser(locale);
    const { error: languageError } = await supabase.rpc(
      "update_portal_settings",
      {
        portal_content_language: contentLanguage === "es" ? "es" : "en",
        portal_name: portal.name,
        portal_slug: portal.slug,
        target_portal_id: portal.id,
      },
    );
    if (languageError) throw new Error(languageError.message);

    revalidatePath(`/${locale}/home`);

    return { error: null, id: portal.id } as const;
  } catch (error) {
    unstable_rethrow(error);

    if (isAuthenticationRequiredError(error)) {
      return { error: "authenticationRequired", id: null } as const;
    }

    console.error("Failed to create portal from home", {
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "unknown",
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { error: "createPortalFailed", id: null } as const;
  }
}

async function getPortalStoragePaths(
  admin: ReturnType<typeof createAdminClient>,
  portalId: string,
  databasePaths: string[],
) {
  const bucket = admin.storage.from("portal-assets");
  const paths = new Set(databasePaths);
  const { data: assetFolders, error: foldersError } = await bucket.list(
    portalId,
    { limit: 1000 },
  );

  if (foldersError) {
    throw new Error(foldersError.message);
  }

  for (const entry of assetFolders ?? []) {
    if (entry.id) {
      paths.add(`${portalId}/${entry.name}`);
      continue;
    }

    const folder = `${portalId}/${entry.name}`;
    const { data: files, error: filesError } = await bucket.list(folder, {
      limit: 1000,
    });

    if (filesError) {
      throw new Error(filesError.message);
    }

    for (const file of files ?? []) {
      if (file.id) {
        paths.add(`${folder}/${file.name}`);
      }
    }
  }

  return [...paths];
}

export async function deletePortalFromHome({
  locale,
  portalId,
  confirmationPhrase,
  confirmationSlug,
}: {
  locale: string;
  portalId: string;
  confirmationPhrase: string;
  confirmationSlug: string;
}) {
  try {
    const homeT = await getTranslations({ locale, namespace: "Home" });
    const supabase = await requireAuthenticatedUser(locale);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { error: "authenticationRequired" } as const;
    }

    const { data: portal } = await supabase
      .from("portals")
      .select("id,slug,visibility")
      .eq("id", portalId)
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (!portal) {
      return { error: "portalNotFound" } as const;
    }

    const expectedPhrase = homeT("delete.phrasePlaceholder");
    if (
      confirmationSlug !== portal.slug ||
      confirmationPhrase !== expectedPhrase
    ) {
      return { error: "deleteConfirmationInvalid" } as const;
    }

    if (portal.visibility === "paid") {
      const { data: purchase, error: purchaseError } = await supabase
        .from("paid_portal_purchases")
        .select("id")
        .eq("portal_id", portalId)
        .limit(1)
        .maybeSingle();

      if (purchaseError) {
        throw new Error(purchaseError.message);
      }

      if (purchase) {
        return { error: "portalPurchaseProtected" } as const;
      }
    }

    const admin = createAdminClient();
    const { data: assets, error: assetsError } = await admin
      .from("portal_assets")
      .select("file_path")
      .eq("portal_id", portalId);

    if (assetsError) {
      throw new Error(assetsError.message);
    }

    const paths = await getPortalStoragePaths(
      admin,
      portalId,
      (assets ?? []).map((asset) => asset.file_path),
    );
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await admin.storage
        .from("portal-assets")
        .remove(paths.slice(index, index + 100));

      if (error) {
        throw new Error(error.message);
      }
    }

    const { error: deleteError } = await supabase.rpc("delete_portal", {
      target_portal_id: portalId,
    });

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/${locale}/home`);
    return { error: null } as const;
  } catch (error) {
    unstable_rethrow(error);

    if (
      error instanceof Error &&
      error.message === "Paid portals with purchases cannot be deleted"
    ) {
      return { error: "portalPurchaseProtected" } as const;
    }

    console.error("Failed to delete portal", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return { error: "deletePortalFailed" } as const;
  }
}

export async function deletePortalFromSettings({
  locale,
  portalId,
  confirmationSlug,
}: {
  locale: string;
  portalId: string;
  confirmationSlug: string;
}) {
  const homeT = await getTranslations({ locale, namespace: "Home" });
  return deletePortalFromHome({
    confirmationPhrase: homeT("delete.phrasePlaceholder"),
    confirmationSlug,
    locale,
    portalId,
  });
}

export async function createPortal(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const name = getString(formData, "name");
  const rawSlug = getString(formData, "slug") || name;
  const coverUrl = getString(formData, "cover_url") || null;
  const rawVisibility = getString(formData, "visibility") || "private";
  if (rawVisibility !== "public" && rawVisibility !== "private") {
    const t = await getTranslations({ locale, namespace: "Actions" });
    actionFailure(t("visibilityInvalid"));
  }
  const visibility = rawVisibility as CreationVisibility;
  const data = await insertPortal({
    coverUrl,
    locale,
    name,
    rawSlug,
    visibility,
  });

  revalidatePath(`/${locale}/home`);
  redirect(`/${locale}/create/${data.id}`);
}

export async function updatePortalSettings(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const t = await getTranslations({ locale, namespace: "Actions" });
  const portalId = getString(formData, "portal_id");
  const supabase = await requireAuthenticatedUser(locale);

  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select(
      "id,owner_id,name,slug,visibility,short_description,content_language,designer_name,designer_website_url,allow_asset_downloads,allow_color_copy,allow_downloads,allow_pdf_downloads,cover_url,custom_domain,designer_logo_url,designer_photo_url,icon_url,theme,social_image_url",
    )
    .eq("id", portalId)
    .single();

  if (portalError || !portal) {
    actionFailure(portalError?.message ?? t("portalNotFound"));
  }

  const nextName = formData.has("name")
    ? getString(formData, "name")
    : portal.name;
  const nextShortDescription = formData.has("short_description")
    ? getString(formData, "short_description").slice(0, 500) || null
    : portal.short_description;
  const nextSlug = formData.has("slug")
    ? getString(formData, "slug")
    : portal.slug;
  if (!validateSlug(nextSlug).valid) actionFailure(t("slugInvalid"));
  const nextDesignerName = formData.has("designer_name")
    ? normalizeDesignerName(getString(formData, "designer_name")) || null
    : portal.designer_name;
  if (nextDesignerName && !validateDesignerName(nextDesignerName).valid) {
    actionFailure(t("designerNameInvalid"));
  }
  const rawWebsite = getString(formData, "designer_website_url");
  const nextDesignerWebsiteUrl = formData.has("designer_website_url")
    ? normalizeWebsiteUrl(rawWebsite)
    : portal.designer_website_url;
  if (
    formData.has("designer_website_url") &&
    rawWebsite &&
    !nextDesignerWebsiteUrl
  ) {
    actionFailure(t("websiteHttps"));
  }
  const nextContentLanguage = formData.has("content_language")
    ? getString(formData, "content_language")
    : null;
  if (nextContentLanguage && !["en", "es"].includes(nextContentLanguage)) {
    actionFailure(t("contentLanguageInvalid"));
  }

  const { error } = await supabase.rpc("update_portal_settings", {
    portal_allow_asset_downloads: portal.allow_asset_downloads,
    portal_allow_color_copy: portal.allow_color_copy,
    portal_allow_downloads: portal.allow_downloads,
    portal_allow_pdf_downloads: portal.allow_pdf_downloads,
    portal_content_language: nextContentLanguage ?? portal.content_language,
    portal_cover_url: portal.cover_url,
    portal_custom_domain: portal.custom_domain,
    portal_designer_logo_url: portal.designer_logo_url,
    portal_designer_name: nextDesignerName,
    portal_designer_photo_url: portal.designer_photo_url,
    portal_designer_website_url: nextDesignerWebsiteUrl,
    portal_icon_url: portal.icon_url,
    portal_name: nextName,
    portal_seo_description: nextShortDescription,
    portal_seo_title: nextName,
    portal_short_description: nextShortDescription,
    portal_slug: nextSlug,
    portal_social_image_url: portal.cover_url,
    portal_theme: portal.theme as PortalTheme,
    portal_visibility: portal.visibility,
    target_portal_id: portalId,
  } as never);

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
  revalidatePath(`/${locale}/home`);
}

export async function checkPortalSlugAvailability(
  slug: string,
  portalId: string,
  locale: string,
) {
  const t = await getTranslations({ locale, namespace: "Actions" });
  const validation = validateSlug(slug);
  if (!validation.valid) return { available: false, error: t("slugInvalid") };
  const supabase = await requireAuthenticatedUser(locale);
  const { data, error } = await supabase.rpc("is_portal_slug_available", {
    candidate_slug: slug,
    current_portal_id: portalId,
  });
  if (error) return { available: false, error: t("slugCheckFailed") };
  return data
    ? { available: true, error: null }
    : { available: false, error: t("slugTaken") };
}

export async function savePrivacySettings(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const t = await getTranslations({ locale, namespace: "Actions" });
  const portalId = getString(formData, "portal_id");
  const visibility = getString(formData, "visibility") as PortalVisibility;
  const password = getString(formData, "password") || null;
  if (!["public", "private", "password", "paid"].includes(visibility))
    actionFailure(t("privacyInvalid"));
  if (
    visibility === "password" &&
    password &&
    (password.length < 8 || password.length > 128)
  ) {
    actionFailure(t("passwordLength"));
  }
  const supabase = await requireAuthenticatedUser(locale);
  const { data: currentPortal, error: currentPortalError } = await supabase
    .from("portals")
    .select("visibility")
    .eq("id", portalId)
    .maybeSingle();
  if (currentPortalError || !currentPortal) {
    actionFailure(currentPortalError?.message ?? t("portalNotFound"));
  }
  if (currentPortal.visibility === "paid" && visibility !== "paid") {
    actionFailure(t("paidPortalImmutable"));
  }
  if (visibility === "paid") {
    const priceDollars = Number.parseFloat(getString(formData, "price"));
    const priceCents = Number.isFinite(priceDollars)
      ? Math.round(priceDollars * 100)
      : Number.NaN;
    if (
      !Number.isInteger(priceCents) ||
      priceCents < PAID_PORTAL_MIN_PRICE_CENTS ||
      priceCents > PAID_PORTAL_MAX_PRICE_CENTS
    ) {
      actionFailure(t("paidPriceInvalid"));
    }
    const previewMetadataValue = getString(formData, "preview_metadata");
    let previewMetadata: Json = {};
    if (previewMetadataValue) {
      try {
        const parsed = JSON.parse(previewMetadataValue) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          actionFailure(t("paidPreviewInvalid"));
        }
        previewMetadata = parsed as Json;
      } catch {
        actionFailure(t("paidPreviewInvalid"));
      }
    }
    const { error: offerError } = await supabase.rpc(
      "upsert_paid_portal_offer",
      {
        offer_currency: "usd",
        offer_is_active: true,
        offer_preview_metadata: previewMetadata,
        offer_price_cents: priceCents,
        target_portal_id: portalId,
      } as never,
    );
    if (offerError) actionFailure(t("paidOfferUnavailable"));
    const { data: connectReady } = await supabase.rpc(
      "creator_has_active_connect_onboarding",
      { target_owner_id: (await supabase.auth.getUser()).data.user?.id ?? "" },
    );
    if (!connectReady) {
      revalidatePath(`/${locale}/create/${portalId}`);
      return;
    }
  }
  const { error } = await supabase.rpc("set_portal_privacy", {
    portal_password: password,
    portal_visibility: visibility,
    target_portal_id: portalId,
  } as never);
  if (error) actionFailure(error.message);
  revalidatePath(`/${locale}/create/${portalId}`);
  revalidatePath(`/${locale}/home`);
}

type PortalSummaryActionState = {
  error: string | null;
  saved: boolean;
};

export async function updatePortalSummary(
  _state: PortalSummaryActionState,
  formData: FormData,
): Promise<PortalSummaryActionState> {
  const locale = getString(formData, "locale") || "en";
  const t = await getTranslations({ locale, namespace: "Actions" });
  const portalId = getString(formData, "portal_id");
  const name = getString(formData, "name");
  const supabase = await requireAuthenticatedUser(locale);

  if (!name) {
    return { error: t("nameRequired"), saved: false };
  }

  const { error } = await supabase.rpc("update_portal_summary", {
    portal_name: name,
    portal_short_description: getString(formData, "short_description") || null,
    target_portal_id: portalId,
  } as never);

  if (error) {
    return { error: error.message, saved: false };
  }

  revalidatePath(`/${locale}/create/${portalId}`);
  revalidatePath(`/${locale}/home`);
  return { error: null, saved: true };
}

export async function createEmptySection(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const t = await getTranslations({ locale, namespace: "Actions" });
  const portalId = getString(formData, "portal_id");
  const position = Number(getString(formData, "position") || "0");
  const supabase = await requireAuthenticatedUser(locale);

  const { data, error } = await supabase.rpc("create_empty_portal_section", {
    section_position: position,
    target_portal_id: portalId,
  });

  if (error || !data) {
    actionFailure(error?.message ?? t("createSectionFailed"));
  }

  revalidatePath(`/${locale}/create/${portalId}`);
  redirect(`/${locale}/create/${portalId}?focus=${data.id}`);
}

export async function updateSectionShell(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const blockId = getString(formData, "block_id");
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("update_portal_section_shell", {
    section_description: getString(formData, "description"),
    section_title: getString(formData, "title"),
    target_block_id: blockId,
    target_portal_id: portalId,
  });

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
}

export async function setPortalBlockType(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const blockId = getString(formData, "block_id");
  const type = getBlockType(formData);
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("set_portal_block_type", {
    block_layout: getString(formData, "layout") || "default",
    block_type: type,
    target_block_id: blockId,
    target_portal_id: portalId,
  });

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
  redirect(`/${locale}/create/${portalId}?focus=${blockId}`);
}

export async function upsertPortalBlock(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const blockId = getString(formData, "block_id") || null;
  const type = getBlockType(formData);
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const position = Number(getString(formData, "position") || "0");
  const layout = getString(formData, "layout") || "default";
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("upsert_portal_block", {
    block_allow_download: getBoolean(formData, "allow_download", true),
    block_content: buildBlockContent(formData, type),
    block_description: description,
    block_id: blockId,
    block_is_visible: getBoolean(formData, "is_visible", true),
    block_layout: layout,
    block_position: position,
    block_title: title,
    block_type: type,
    target_portal_id: portalId,
  } as never);

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
}

export async function upsertGalleryImage(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const blockId = getString(formData, "block_id") || null;
  const imageId = getString(formData, "image_id") || crypto.randomUUID();
  const imageUrl = getString(formData, "image_url");
  const images = getGalleryImages(formData);
  const nextImage = {
    allow_download: getBoolean(formData, "item_allow_download", true),
    alt: getString(formData, "alt"),
    id: imageId,
    url: imageUrl,
    visible: getBoolean(formData, "item_visible", true),
  };
  const nextImages = images.some((image) => image.id === imageId)
    ? images.map((image) => (image.id === imageId ? nextImage : image))
    : [...images, nextImage];
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("upsert_portal_block", {
    block_allow_download: getBoolean(formData, "allow_download", true),
    block_content: { images: nextImages },
    block_description: getString(formData, "description"),
    block_id: blockId,
    block_is_visible: getBoolean(formData, "is_visible", true),
    block_layout: getString(formData, "layout") || "grid",
    block_position: Number(getString(formData, "position") || "0"),
    block_title: getString(formData, "title"),
    block_type: "gallery",
    target_portal_id: portalId,
  } as never);

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
}

export async function removeGalleryImage(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const blockId = getString(formData, "block_id") || null;
  const imageId = getString(formData, "image_id");
  const images = getGalleryImages(formData).filter(
    (image) => image.id !== imageId,
  );
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("upsert_portal_block", {
    block_allow_download: getBoolean(formData, "allow_download", true),
    block_content: { images },
    block_description: getString(formData, "description"),
    block_id: blockId,
    block_is_visible: getBoolean(formData, "is_visible", true),
    block_layout: getString(formData, "layout") || "grid",
    block_position: Number(getString(formData, "position") || "0"),
    block_title: getString(formData, "title"),
    block_type: "gallery",
    target_portal_id: portalId,
  } as never);

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
}

export async function reorderGalleryImages(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const blockId = getString(formData, "block_id") || null;
  const orderedIds = getString(formData, "ordered_ids")
    .split(",")
    .filter(Boolean);
  const images = getGalleryImages(formData);
  const imageById = new Map(images.map((image) => [image.id, image]));
  const orderedImages = orderedIds
    .map((id) => imageById.get(id))
    .filter((image): image is (typeof images)[number] => Boolean(image));
  const missingImages = images.filter(
    (image) => !orderedIds.includes(image.id),
  );
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("upsert_portal_block", {
    block_allow_download: getBoolean(formData, "allow_download", true),
    block_content: { images: [...orderedImages, ...missingImages] },
    block_description: getString(formData, "description"),
    block_id: blockId,
    block_is_visible: getBoolean(formData, "is_visible", true),
    block_layout: getString(formData, "layout") || "grid",
    block_position: Number(getString(formData, "position") || "0"),
    block_title: getString(formData, "title"),
    block_type: "gallery",
    target_portal_id: portalId,
  } as never);

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
}

export async function reorderPortalSections(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const orderedBlockIds = getString(formData, "ordered_block_ids")
    .split(",")
    .filter(Boolean);
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("reorder_portal_blocks", {
    ordered_block_ids: orderedBlockIds,
    target_portal_id: portalId,
  });

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
}

export async function updatePortalDocument(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const documentJson = getString(formData, "document_json");
  const expectedRevisionValue = getString(formData, "expected_revision");
  const expectedRevision = expectedRevisionValue
    ? Number(expectedRevisionValue)
    : null;
  const supabase = await requireAuthenticatedUser(locale);

  const { data: portal } = await supabase
    .from("portals")
    .select(
      "id,owner_id,name,slug,short_description,cover_url,icon_url,visibility,seo_title,seo_description,social_image_url,custom_domain,allow_downloads,allow_asset_downloads,allow_color_copy,allow_pdf_downloads,theme,designer_name,designer_logo_url,designer_photo_url,designer_website_url,designer_social_links,status,published_publication_id,published_at,created_at,updated_at",
    )
    .eq("id", portalId)
    .single();

  if (!portal) {
    actionFailure("Portal not found");
  }

  const parsed = parseJsonObject(documentJson);
  const normalizedDocument = normalizePortalDocument(parsed, portal);

  const { data, error } = (await supabase.rpc(
    "upsert_portal_document_if_revision" as never,
    {
      expected_revision: expectedRevision,
      portal_document: portalDocumentToJson(normalizedDocument),
      target_portal_id: portalId,
    } as never,
  )) as unknown as {
    data: { revision: number } | null;
    error: { message: string } | null;
  };

  if (error) {
    if (error.message.includes("portal_document_conflict")) {
      return { kind: "conflict" as const };
    }
    actionFailure(error.message);
  }
  if (!data) {
    actionFailure("Portal document was not saved");
  }

  revalidatePath(`/${locale}/create/${portalId}`);
  revalidatePath(`/${locale}/home`);
  return { kind: "saved" as const, revision: data.revision };
}

export async function deletePortalBlock(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const blockId = getString(formData, "block_id");
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("delete_portal_block", {
    target_block_id: blockId,
    target_portal_id: portalId,
  });

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/create/${portalId}`);
}

type PublishPortalInput = {
  locale: string;
  portalId: string;
  returnTo?: string;
};

export async function publishPortalById({
  locale,
  portalId,
  returnTo = `/${locale}/home`,
}: PublishPortalInput) {
  const supabase = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("publish_portal", {
    target_portal_id: portalId,
  });

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/home`);
  revalidatePath(returnTo);
}

export async function publishPortal(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const portalId = getString(formData, "portal_id");
  const returnTo = getString(formData, "return_to") || `/${locale}/home`;

  await publishPortalById({ locale, portalId, returnTo });
}
