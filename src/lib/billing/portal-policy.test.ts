import { describe, expect, test } from "bun:test";
import type { PortalDocument } from "@/domain/portal/document";
import {
  PORTAL_PLANS,
  upgradeDescriptionKey,
  validatePortalDocumentChange,
  validatePortalPublication,
  validatePortalVisibility,
} from "./portal-policy";

function documentWith(
  sections: Array<{
    items?: number;
    type: "colors" | "files" | "fonts" | "gallery" | "image" | "text";
  }>,
): PortalDocument {
  return {
    portal: { description: "", name: "Portal", theme: "light" },
    sections: sections.map(({ items = 0, type }, position) => ({
      allow_download: true,
      content: {
        ...(type === "gallery"
          ? {
              images: Array.from({ length: items }, (_, i) => ({
                allow_download: true,
                alt_text: "",
                aspect_ratio: "auto" as const,
                fit: "cover" as const,
                id: `i-${position}-${i}`,
                image_url: "",
                position: i,
                visible: true,
              })),
            }
          : {}),
        ...(type === "colors"
          ? {
              colors: Array.from({ length: items }, (_, i) => ({
                color_code: "#000",
                color_name: "",
                id: `c-${position}-${i}`,
                position: i,
                visible: true,
              })),
            }
          : {}),
        ...(type === "fonts"
          ? {
              fonts: Array.from({ length: items }, (_, i) => ({
                font_name: `Font ${i}`,
                id: `f-${position}-${i}`,
                position: i,
                visible: true,
              })),
            }
          : {}),
        ...(type === "files"
          ? {
              files: Array.from({ length: items }, (_, i) => ({
                allow_download: true,
                file_name: `file-${i}`,
                file_url: "",
                id: `x-${position}-${i}`,
                position: i,
                visible: true,
              })),
            }
          : {}),
      },
      description: "",
      id: `section-${position}`,
      layout: {},
      position,
      title: "",
      type,
      visible: true,
    })),
    version: 1,
  };
}

describe("portal monetization policy", () => {
  test("uses informative upgrade copy when no limit was violated", () => {
    expect(upgradeDescriptionKey("upgrade_info")).toBe("upgradeDescription");
    expect(upgradeDescriptionKey("storage_bytes")).toBe(
      "violations.storage_bytes",
    );
  });
  test("publishes all documented plan limits", () => {
    expect(PORTAL_PLANS.free.storageBytes).toBe(100 * 1024 * 1024);
    expect(PORTAL_PLANS.free.maxUploadBytes).toBe(500 * 1024 * 1024);
    expect(PORTAL_PLANS.starter.storageBytes).toBe(500 * 1024 * 1024);
    expect(PORTAL_PLANS.starter.totalSections).toBe(30);
    expect(PORTAL_PLANS.pro.storageBytes).toBe(1024 * 1024 * 1024);
    expect(PORTAL_PLANS.pro.totalSections).toBe(60);
    expect(PORTAL_PLANS.premium.storageBytes).toBe(2 * 1024 * 1024 * 1024);
    expect(PORTAL_PLANS.premium.maxUploadBytes).toBe(500 * 1024 * 1024);
    expect(PORTAL_PLANS.premium.totalSections).toBe(100);
  });

  test("publishes Starter and Pro content limits", () => {
    expect(PORTAL_PLANS.starter.sections.colors).toEqual({
      items: 20,
      sections: 2,
    });
    expect(PORTAL_PLANS.starter.sections.files).toEqual({
      items: 20,
      sections: 2,
    });
    expect(PORTAL_PLANS.starter.sections.fonts).toEqual({
      items: 5,
      sections: 2,
    });
    expect(PORTAL_PLANS.starter.sections.gallery).toEqual({
      items: 15,
      sections: 2,
    });
    expect(PORTAL_PLANS.starter.sections.image).toEqual({ sections: 2 });
    expect(PORTAL_PLANS.starter.sections.text).toEqual({ sections: 4 });
    expect(PORTAL_PLANS.pro.sections.colors).toEqual({
      items: 40,
      sections: 4,
    });
    expect(PORTAL_PLANS.pro.sections.files).toEqual({ items: 40, sections: 4 });
    expect(PORTAL_PLANS.pro.sections.fonts).toEqual({ items: 10, sections: 4 });
    expect(PORTAL_PLANS.pro.sections.gallery).toEqual({
      items: 30,
      sections: 5,
    });
    expect(PORTAL_PLANS.pro.sections.image).toEqual({ sections: 5 });
    expect(PORTAL_PLANS.pro.sections.text).toEqual({ sections: 8 });
  });

  test("keeps every paid plan monotonic and publishes the rebalanced Premium limits", () => {
    const ordered = [
      PORTAL_PLANS.starter,
      PORTAL_PLANS.pro,
      PORTAL_PLANS.premium,
    ];
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      expect(current.storageBytes).toBeGreaterThanOrEqual(
        previous.storageBytes,
      );
      expect(current.totalSections).toBeGreaterThanOrEqual(
        previous.totalSections,
      );
      for (const type of ["files", "fonts", "gallery"] as const) {
        expect(current.sections[type]?.sections).toBeGreaterThanOrEqual(
          previous.sections[type]?.sections ?? 0,
        );
        expect(current.sections[type]?.items).toBeGreaterThanOrEqual(
          previous.sections[type]?.items ?? 0,
        );
      }
    }

    expect(PORTAL_PLANS.premium.sections.gallery).toEqual({
      items: 60,
      sections: 10,
    });
    expect(PORTAL_PLANS.premium.sections.fonts).toEqual({
      items: 20,
      sections: 8,
    });
    expect(PORTAL_PLANS.premium.sections.files).toEqual({
      items: 80,
      sections: 8,
    });
  });

  test("rejects additions over Free section and item limits", () => {
    const previous = documentWith([{ type: "gallery", items: 10 }]);
    expect(
      validatePortalDocumentChange(
        previous,
        documentWith([{ type: "gallery", items: 11 }]),
        "free",
      ),
    ).toMatchObject({ ok: false, code: "gallery_items" });
    expect(
      validatePortalDocumentChange(
        previous,
        documentWith([
          { type: "gallery", items: 10 },
          { type: "gallery", items: 0 },
          { type: "gallery", items: 0 },
        ]),
        "free",
      ),
    ).toMatchObject({ ok: false, code: "gallery_sections" });
  });

  test("counts legacy comparison sections and their images as galleries", () => {
    const previous = documentWith([{ type: "gallery", items: 9 }]);
    const comparison = documentWith([{ type: "gallery", items: 11 }]);
    comparison.sections[0].type = "image_comparison";
    expect(
      validatePortalDocumentChange(previous, comparison, "free"),
    ).toMatchObject({ ok: false, code: "gallery_items" });
  });

  test("allows reducing legacy content even while it remains over limit", () => {
    const result = validatePortalDocumentChange(
      documentWith([{ type: "gallery", items: 14 }]),
      documentWith([{ type: "gallery", items: 12 }]),
      "free",
    );
    expect(result).toEqual({ ok: true });
  });

  test("blocks publication until over-limit content is regularized", () => {
    expect(
      validatePortalPublication(
        documentWith([{ type: "text" }, { type: "text" }, { type: "text" }]),
        "free",
      ),
    ).toMatchObject({ ok: false, code: "text_sections" });
  });

  test("allows password visibility only for paid plans", () => {
    expect(validatePortalVisibility("password", "free")).toEqual({
      code: "password_requires_paid_plan",
      limit: 0,
      ok: false,
      value: 0,
    });
    for (const plan of ["starter", "pro", "premium"] as const) {
      expect(validatePortalVisibility("password", plan)).toEqual({ ok: true });
    }
  });
});
