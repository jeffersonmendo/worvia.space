import { expect, test } from "bun:test";
import {
  applySectionImagePresentation,
  moveImageBetweenPortalSections,
  normalizePortalDocument,
  orderDocumentItemsForRender,
  portalQuickColors,
  uniqueForRender,
} from "./document";

function image(id: string, position = 0) {
  return {
    allow_download: true,
    alt_text: id,
    aspect_ratio: "auto" as const,
    fit: "contain" as const,
    id,
    image_url: `${id}.png`,
    position,
    visible: true,
  };
}

test("normalizes section-specific column limits", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        { id: "gallery", type: "gallery", layout: { columns: 5 } },
        { id: "files", type: "files", layout: { columns: 2 } },
        { id: "colors-invalid", type: "colors", layout: { columns: 6 } },
        { id: "colors-valid", type: "colors", layout: { columns: 5 } },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(document.sections.map((section) => section.layout.columns)).toEqual([
    3, 3, 4, 5,
  ]);
});

test("moves an image between gallery sections and reindexes both galleries", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          id: "gallery-a",
          type: "gallery",
          content: { images: [image("one"), image("two", 1)] },
        },
        {
          id: "gallery-b",
          type: "gallery",
          content: { images: [image("three")] },
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  const moved = moveImageBetweenPortalSections(document, {
    imageId: "two",
    sourceSectionId: "gallery-a",
    targetIndex: 0,
    targetSectionId: "gallery-b",
  });

  expect(
    moved.sections[0]?.content.images?.map(({ id, position }) => [
      id,
      position,
    ]),
  ).toEqual([["one", 0]]);
  expect(
    moved.sections[1]?.content.images?.map(({ id, position }) => [
      id,
      position,
    ]),
  ).toEqual([
    ["two", 0],
    ["three", 1],
  ]);
});

test("moves the image from an image section into an empty gallery", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        { id: "hero", type: "image", content: { image: image("logo") } },
        { id: "gallery", type: "gallery", content: { images: [] } },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  const moved = moveImageBetweenPortalSections(document, {
    imageId: "logo",
    sourceSectionId: "hero",
    targetIndex: 0,
    targetSectionId: "gallery",
  });

  expect(moved.sections[0]?.content.image).toBeNull();
  expect(moved.sections[1]?.content.images?.map((item) => item.id)).toEqual([
    "logo",
  ]);
});

test("does not move an image into a gallery that reached its limit", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        { id: "source", type: "gallery", content: { images: [image("one")] } },
        { id: "target", type: "gallery", content: { images: [image("two")] } },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(
    moveImageBetweenPortalSections(document, {
      imageId: "one",
      maxTargetImages: 1,
      sourceSectionId: "source",
      targetIndex: 0,
      targetSectionId: "target",
    }),
  ).toBe(document);
});

test("reorders images inside a full gallery without exceeding its limit", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          id: "gallery",
          type: "gallery",
          content: {
            images: [image("one"), image("two", 1), image("three", 2)],
          },
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  const moved = moveImageBetweenPortalSections(document, {
    imageId: "one",
    maxTargetImages: 3,
    sourceSectionId: "gallery",
    targetIndex: 2,
    targetSectionId: "gallery",
  });

  expect(moved.sections[0]?.content.images?.map((item) => item.id)).toEqual([
    "two",
    "three",
    "one",
  ]);
});

test("normalizes gallery-wide image presentation settings", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          type: "gallery",
          layout: {
            imageBackgroundColor: "#123ABC",
            imageContainerPadding: 99,
          },
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(document.sections[0]?.layout.imageBackgroundColor).toBe("#123ABC");
  expect(document.sections[0]?.layout.imageContainerPadding).toBe(25);
});

test("applies gallery-wide presentation to an image moved into that gallery", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          id: "source",
          type: "gallery",
          content: { images: [image("one")] },
        },
        {
          id: "target",
          type: "gallery",
          content: { images: [] },
          layout: {
            imageBackgroundColor: "transparent",
            imageContainerPadding: 12,
            imageAspectRatio: "16/9",
            imageFit: "fill",
          },
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  const moved = moveImageBetweenPortalSections(document, {
    imageId: "one",
    sourceSectionId: "source",
    targetIndex: 0,
    targetSectionId: "target",
  });
  const movedImage = moved.sections[1]?.content.images?.[0];

  expect(movedImage?.background_color).toBe("transparent");
  expect(movedImage?.container_padding).toBe(12);
  expect(movedImage?.field_origins?.background_color).toBe("manual");
  expect(movedImage?.field_origins?.container_padding).toBe("manual");
  expect(movedImage?.aspect_ratio).toBe("16/9");
  expect(movedImage?.fit).toBe("fill");
  expect(movedImage?.field_origins?.aspect_ratio).toBe("manual");
  expect(movedImage?.field_origins?.fit).toBe("manual");
});

test("maps every gallery presentation key without touching unrelated layout", () => {
  const original = {
    ...image("presentation"),
    field_origins: { alt_text: "ai" as const },
  };

  expect(
    applySectionImagePresentation(original, {
      columns: 4,
      imageAspectRatio: "21/9",
      imageBackgroundColor: "#112233",
      imageContainerPadding: 17,
      imageFit: "auto",
    }),
  ).toEqual({
    ...original,
    aspect_ratio: "21/9",
    background_color: "#112233",
    container_padding: 17,
    fit: "auto",
    field_origins: {
      alt_text: "ai",
      aspect_ratio: "manual",
      background_color: "manual",
      container_padding: "manual",
      fit: "manual",
    },
  });
});

test("assigns unique ids to duplicate color items", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            colors: [
              { id: "color_202020", color_code: "#202020" },
              { id: "color_202020", color_code: "#202020" },
            ],
          },
          type: "colors",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(
    document.sections[0]?.content.colors?.map((color) => color.id),
  ).toEqual(["color_202020", "color_202020_1"]);
});

test("preserves custom positions when preparing items for rendering", () => {
  const items = uniqueForRender(
    [
      { id: "section-a", position: 1 },
      { id: "section-b", position: 0 },
    ],
    "section",
  );

  expect(items.map((item) => item.id)).toEqual(["section-b", "section-a"]);
  expect(items.map((item) => item.position)).toEqual([0, 1]);
});

test("orders nested editor assets before the first client render", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            images: [
              { id: "black-icon", image_url: "black", position: 1 },
              { id: "white-icon", image_url: "white", position: 0 },
            ],
          },
          type: "gallery",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  const ordered = orderDocumentItemsForRender(document);
  expect(ordered.sections[0]?.content.images?.map((image) => image.id)).toEqual(
    ["white-icon", "black-icon"],
  );
});

test("normalizes image container padding and background presentation", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            image: {
              background_color: "#f4f4f5",
              container_padding: 24,
              image_url: "image.png",
            },
          },
          type: "image",
        },
        {
          content: {
            files: [
              {
                background_color: "transparent",
                container_padding: 80,
                file_name: "logo.svg",
                file_type: "svg",
                file_url: "logo.svg",
              },
            ],
          },
          type: "files",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(document.sections[0]?.content.image).toMatchObject({
    background_color: "#f4f4f5",
    container_padding: 24,
  });
  expect(document.sections[1]?.content.files?.[0]).toMatchObject({
    background_color: "transparent",
    container_padding: 25,
  });
});

test("defaults image presentation to zero padding and the secondary background", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: { image: { image_url: "image.png" } },
          type: "image",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(document.sections[0]?.content.image).toMatchObject({
    background_color: "secondary",
    container_padding: 0,
  });
});

test("preserves transparent image backgrounds without discarding their selected color", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            image: {
              background_color: "#123456",
              background_transparent: true,
              image_url: "image.png",
            },
          },
          type: "image",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(document.sections[0]?.content.image).toMatchObject({
    background_color: "#123456",
    background_transparent: true,
  });
});

test("ignores non-boolean image transparency values", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            image: {
              background_color: "#123456",
              background_transparent: "true",
              image_url: "image.png",
            },
          },
          type: "image",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(document.sections[0]?.content.image).toMatchObject({
    background_color: "#123456",
    background_transparent: false,
  });
});

test("normalizes file image presentation and preserves legacy defaults", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            files: [
              { file_name: "legacy.png", file_url: "legacy.png" },
              {
                aspect_ratio: "invalid",
                file_name: "invalid.svg",
                file_url: "invalid.svg",
                fit: "invalid",
              },
              {
                aspect_ratio: "16/9",
                file_name: "configured.png",
                file_url: "configured.png",
                fit: "cover",
              },
            ],
          },
          type: "files",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(
    document.sections[0]?.content.files?.map((file) => [
      file.aspect_ratio,
      file.fit,
    ]),
  ).toEqual([
    ["1/1", "contain"],
    ["1/1", "contain"],
    ["16/9", "cover"],
  ]);
});

test("uses Color section values as deduplicated quick colors", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            colors: [
              { color_code: "#112233", visible: true },
              { color_code: "#112233", visible: true },
              { color_code: "rgb(255, 0, 0)", visible: true },
              { color_code: "invalid", visible: true },
              { color_code: "#ffffff", visible: false },
            ],
          },
          type: "colors",
          visible: true,
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(portalQuickColors(document)).toEqual([
    "#112233",
    "rgb(255, 0, 0)",
    "#ffffff",
  ]);
});
