import { describe, expect, test } from "bun:test";
import type { RenderProjectData } from "@/components/render/visual-model";
import { PORTAL_PLANS } from "@/lib/billing/portal-policy";
import { collectionAvailabilityFor } from "./portal-collection-availability";

function itemLimit(section: { items?: number } | undefined) {
  const items = section?.items;
  if (typeof items !== "number") throw new Error("Expected an item limit");
  return items;
}

function projectWith(
  type: "colors" | "files" | "fonts" | "gallery" | "image_comparison",
  items: number,
): RenderProjectData {
  const content =
    type === "colors"
      ? {
          colors: Array.from({ length: items }, (_, position) => ({
            code: "#000",
            id: `${type}-${position}`,
            name: "Black",
            position,
            visible: true,
          })),
        }
      : type === "fonts"
        ? {
            fonts: Array.from({ length: items }, (_, position) => ({
              family: "Sans",
              id: `${type}-${position}`,
              position,
              visible: true,
            })),
          }
        : type === "files"
          ? {
              files: Array.from({ length: items }, (_, position) => ({
                fileName: "file.pdf",
                id: `${type}-${position}`,
                position,
                src: "",
                visible: true,
              })),
            }
          : {
              images: Array.from({ length: items }, (_, position) => ({
                alt: "",
                aspectRatio: "auto" as const,
                fit: "contain" as const,
                id: `${type}-${position}`,
                position,
                src: "",
                visible: true,
              })),
            };
  return {
    description: "",
    id: "project",
    name: "Project",
    sections: [
      {
        content,
        description: "",
        id: "section",
        position: 0,
        title: "Section",
        type,
        visible: true,
      },
    ],
  };
}

describe("collectionAvailabilityFor", () => {
  test.each([
    ["gallery", "image", itemLimit(PORTAL_PLANS.free.sections.gallery)],
    [
      "image_comparison",
      "image",
      itemLimit(PORTAL_PLANS.free.sections.gallery),
    ],
    ["colors", "color", itemLimit(PORTAL_PLANS.free.sections.colors)],
    ["fonts", "font", itemLimit(PORTAL_PLANS.free.sections.fonts)],
    ["files", "file", itemLimit(PORTAL_PLANS.free.sections.files)],
  ] as const)(
    "blocks %s additions at its Free threshold",
    (type, kind, limit) => {
      expect(
        collectionAvailabilityFor(projectWith(type, limit), PORTAL_PLANS.free)
          ?.section?.[kind],
      ).toBe(false);
      expect(
        collectionAvailabilityFor(
          projectWith(type, limit - 1),
          PORTAL_PLANS.free,
        )?.section?.[kind],
      ).toBe(true);
    },
  );

  test("leaves collections with no item limit addable", () => {
    expect(
      collectionAvailabilityFor(
        projectWith("colors", 100),
        PORTAL_PLANS.premium,
      )?.section?.color,
    ).toBeUndefined();
  });
});
