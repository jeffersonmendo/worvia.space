import type {
  PortalDocument,
  PortalSectionType,
} from "@/domain/portal/document";
import type { PortalVisibility } from "@/lib/supabase/database.types";

export type PortalPlan = "free" | "starter" | "pro" | "premium";
export type PortalPolicyCode =
  | "colors_items"
  | "colors_sections"
  | "files_items"
  | "files_sections"
  | "fonts_items"
  | "fonts_sections"
  | "gallery_items"
  | "gallery_sections"
  | "image_sections"
  | "plan_unavailable"
  | "password_requires_paid_plan"
  | "storage_bytes"
  | "text_sections"
  | "total_sections"
  | "upload_bytes";

export type PortalUpgradeReason = PortalPolicyCode | "upgrade_info";

export function upgradeDescriptionKey(reason: PortalUpgradeReason) {
  return reason === "upgrade_info"
    ? ("upgradeDescription" as const)
    : (`violations.${reason}` as const);
}

type SectionLimits = Partial<
  Record<PortalSectionType, { items?: number; sections: number }>
>;

export type PortalPlanPolicy = {
  maxUploadBytes: number;
  storageBytes: number;
  totalSections: number;
  sections: SectionLimits;
};

export const PORTAL_PLAN_PRICES_CENTS: Record<
  Exclude<PortalPlan, "free">,
  number
> = {
  starter: 499,
  pro: 999,
  premium: 1999,
};

export const PORTAL_PLAN_ORDER: PortalPlan[] = [
  "free",
  "starter",
  "pro",
  "premium",
];

export function planUpgradePriceCents(from: PortalPlan, to: PortalPlan) {
  if (from === to || from === "premium" || to === "free") return 0;
  const price = (plan: PortalPlan) =>
    plan === "free" ? 0 : PORTAL_PLAN_PRICES_CENTS[plan];
  return Math.max(0, price(to) - price(from));
}

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

export const PORTAL_PLANS: Record<PortalPlan, PortalPlanPolicy> = {
  free: {
    maxUploadBytes: 500 * MiB,
    storageBytes: 100 * MiB,
    totalSections: Number.POSITIVE_INFINITY,
    sections: {
      colors: { items: 10, sections: 1 },
      files: { items: 10, sections: 1 },
      fonts: { items: 3, sections: 1 },
      gallery: { items: 10, sections: 2 },
      image: { sections: 1 },
      text: { sections: 2 },
    },
  },
  starter: {
    maxUploadBytes: 500 * MiB,
    storageBytes: 500 * MiB,
    totalSections: 30,
    sections: {
      colors: { items: 20, sections: 2 },
      files: { items: 20, sections: 2 },
      fonts: { items: 5, sections: 2 },
      gallery: { items: 15, sections: 2 },
      image: { sections: 2 },
      text: { sections: 4 },
    },
  },
  pro: {
    maxUploadBytes: 500 * MiB,
    storageBytes: GiB,
    totalSections: 60,
    sections: {
      colors: { items: 40, sections: 4 },
      files: { items: 40, sections: 4 },
      fonts: { items: 10, sections: 4 },
      gallery: { items: 30, sections: 5 },
      image: { sections: 5 },
      text: { sections: 8 },
    },
  },
  premium: {
    maxUploadBytes: 500 * MiB,
    storageBytes: 2 * GiB,
    totalSections: 100,
    sections: {
      files: { items: 80, sections: 8 },
      fonts: { items: 20, sections: 8 },
      gallery: { items: 60, sections: 10 },
    },
  },
};

export function portalGalleryItemLimit(plan: PortalPlan) {
  return PORTAL_PLANS[plan].sections.gallery?.items ?? Number.POSITIVE_INFINITY;
}

export function portalGallerySectionLimit(plan: PortalPlan) {
  return PORTAL_PLANS[plan].sections.gallery?.sections ?? 0;
}

export function portalColorItemLimit(plan: PortalPlan) {
  return PORTAL_PLANS[plan].sections.colors?.items ?? Number.POSITIVE_INFINITY;
}

export type PortalPolicyResult =
  | { ok: true }
  | { code: PortalPolicyCode; limit: number; ok: false; value: number };

type Metric = { code: PortalPolicyCode; limit: number; value: number };

function isSectionType(
  sectionType: PortalSectionType,
  type: PortalSectionType,
) {
  return type === "gallery"
    ? sectionType === "gallery" || sectionType === "image_comparison"
    : sectionType === type;
}

function itemCount(document: PortalDocument, type: PortalSectionType) {
  return Math.max(
    0,
    ...document.sections
      .filter((section) => isSectionType(section.type, type))
      .map((section) => {
        if (type === "gallery") return section.content.images?.length ?? 0;
        if (type === "colors") return section.content.colors?.length ?? 0;
        if (type === "fonts") return section.content.fonts?.length ?? 0;
        if (type === "files") return section.content.files?.length ?? 0;
        return 0;
      }),
  );
}

function metrics(document: PortalDocument, plan: PortalPlan): Metric[] {
  const policy = PORTAL_PLANS[plan];
  const result: Metric[] = [
    {
      code: "total_sections",
      limit: policy.totalSections,
      value: document.sections.length,
    },
  ];
  for (const [type, limit] of Object.entries(policy.sections) as Array<
    [PortalSectionType, { items?: number; sections: number }]
  >) {
    result.push({
      code: `${type}_sections` as PortalPolicyCode,
      limit: limit.sections,
      value: document.sections.filter((section) =>
        isSectionType(section.type, type),
      ).length,
    });
    if (limit.items !== undefined) {
      result.push({
        code: `${type}_items` as PortalPolicyCode,
        limit: limit.items,
        value: itemCount(document, type),
      });
    }
  }
  return result;
}

function firstViolation(document: PortalDocument, plan: PortalPlan) {
  return metrics(document, plan).find(({ limit, value }) => value > limit);
}

export function validatePortalDocumentChange(
  previous: PortalDocument,
  next: PortalDocument,
  plan: PortalPlan,
): PortalPolicyResult {
  const before = new Map(
    metrics(previous, plan).map((item) => [item.code, item]),
  );
  const violation = metrics(next, plan).find(
    ({ code, limit, value }) =>
      value > limit && value > (before.get(code)?.value ?? 0),
  );
  return violation ? { ...violation, ok: false } : { ok: true };
}

export function validatePortalPublication(
  document: PortalDocument,
  plan: PortalPlan,
): PortalPolicyResult {
  const violation = firstViolation(document, plan);
  return violation ? { ...violation, ok: false } : { ok: true };
}

export function validatePortalVisibility(
  visibility: PortalVisibility,
  plan: PortalPlan,
): PortalPolicyResult {
  if (visibility === "password" && plan === "free") {
    return {
      code: "password_requires_paid_plan",
      limit: 0,
      ok: false,
      value: 0,
    };
  }
  return { ok: true };
}

export function getPortalPlanSnapshot(plan: PortalPlan) {
  return { plan, policy: PORTAL_PLANS[plan] };
}
