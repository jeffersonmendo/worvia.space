import { describe, expect, test } from "bun:test";
import type { PortalDocument } from "@/domain/portal/document";
import {
  applyRenderProjectChange,
  applyRenderProjectDocument,
  applyRenderSectionChange,
  portalDocumentToRenderProject,
} from "./portal-document-adapter";

function galleryFixture() {
  const section = document.sections[0];
  const image = section?.content.images?.[0];
  if (!section || !image) throw new Error("Missing gallery fixture");
  return { image, section };
}

const document: PortalDocument = {
  portal: {
    description: "Description",
    name: "Project",
    theme: "light",
  },
  sections: [
    {
      allow_download: true,
      content: {
        images: [
          {
            allow_download: true,
            alt_text: "Alt",
            aspect_ratio: "16/9",
            background_color: "#123456",
            container_padding: 12,
            fit: "contain",
            id: "image-1",
            image_url: "https://example.com/image.png",
            position: 0,
            visible: true,
          },
        ],
      },
      description: "Gallery",
      id: "section-1",
      layout: { columns: 3, gap: "lg", mode: "grid", width: "wide" },
      position: 0,
      title: "Images",
      type: "gallery",
      visible: true,
    },
  ],
  version: 1,
};

describe("portalDocumentToRenderProject", () => {
  test("round-trips image transparency independently from its selected background color", () => {
    const { image, section } = galleryFixture();
    const source: PortalDocument = {
      ...document,
      sections: [
        {
          ...section,
          content: {
            images: [
              {
                ...image,
                background_color: "#123456",
                background_transparent: true,
              },
            ],
          },
        },
      ],
    };
    const project = portalDocumentToRenderProject(source);

    expect(project.sections[0]?.content.images?.[0]).toMatchObject({
      background: "#123456",
      backgroundTransparent: true,
    });

    const restored = applyRenderProjectDocument(source, {
      ...project,
      sections: project.sections.map((section) => ({
        ...section,
        content: {
          ...section.content,
          images: section.content.images?.map((image) => ({
            ...image,
            backgroundTransparent: false,
          })),
        },
      })),
    });

    expect(restored.sections[0]?.content.images?.[0]).toMatchObject({
      background_color: "#123456",
      background_transparent: false,
    });
  });

  test("preserves a stored file type when the display name omits its extension", () => {
    const project = portalDocumentToRenderProject({
      ...document,
      sections: [
        {
          ...document.sections[0],
          content: {
            files: [
              {
                allow_download: true,
                display_name: "Ejercicio_1_Semana_1_entrega_final",
                file_name: "opaque-storage-name",
                file_type: "md",
                file_url: "https://example.com/lesson.md",
                id: "file-markdown",
                position: 0,
                visible: true,
              },
              {
                allow_download: true,
                display_name: "Notas_de_la_entrega",
                file_name: "Notas_de_la_entrega.md",
                file_url: "https://example.com/notes.md",
                id: "file-markdown-legacy",
                position: 1,
                visible: true,
              },
            ],
          },
          type: "files",
        },
      ],
    });

    expect(project.sections[0]?.content.files?.[0]).toMatchObject({
      fileName: "Ejercicio_1_Semana_1_entrega_final",
      fileType: "md",
    });
    expect(project.sections[0]?.content.files?.[1]).toMatchObject({
      fileName: "Notas_de_la_entrega",
      fileType: "md",
    });
  });

  test("round-trips a new file type when its display name has no extension", () => {
    const source: PortalDocument = {
      ...document,
      sections: [
        {
          ...document.sections[0],
          content: { files: [] },
          type: "files",
        },
      ],
    };
    const project = portalDocumentToRenderProject(source);
    const next = applyRenderProjectDocument(source, {
      ...project,
      sections: project.sections.map((section) => ({
        ...section,
        content: {
          files: [
            {
              fileName: "Release_notes",
              fileType: "md",
              id: "new-markdown",
              position: 0,
              src: "https://example.com/release-notes.md",
              visible: true,
            },
          ],
        },
      })),
    });

    expect(next.sections[0]?.content.files?.[0]?.file_type).toBe("md");
    expect(
      portalDocumentToRenderProject(next).sections[0]?.content.files?.[0]
        ?.fileType,
    ).toBe("md");
  });

  test("round-trips file image presentation through the render model", () => {
    const source: PortalDocument = {
      ...document,
      sections: [
        {
          ...document.sections[0],
          content: {
            files: [
              {
                allow_download: true,
                aspect_ratio: "4/3",
                background_color: "#123456",
                container_padding: 14,
                file_name: "logo.svg",
                file_type: "svg",
                file_url: "https://example.com/logo.svg",
                fit: "fill",
                id: "file-logo",
                position: 0,
                visible: true,
              },
            ],
          },
          type: "files",
        },
      ],
    };
    const project = portalDocumentToRenderProject(source);

    expect(project.sections[0]?.content.files?.[0]).toMatchObject({
      aspectRatio: "4/3",
      background: "#123456",
      fit: "fill",
      padding: 14,
    });
    expect(
      applyRenderProjectDocument(source, project).sections[0]?.content
        .files?.[0],
    ).toMatchObject({
      aspect_ratio: "4/3",
      background_color: "#123456",
      container_padding: 14,
      fit: "fill",
    });
  });

  test("forwards a prepared font URL to the shared render model", () => {
    const project = portalDocumentToRenderProject({
      ...document,
      sections: [
        {
          ...document.sections[0],
          content: {
            fonts: [
              {
                file_url:
                  "/api/portal-assets/preview?slug=project&assetId=font-asset",
                font_name: "Brand Sans",
                id: "font-1",
                position: 0,
                visible: true,
                weight: 600,
              },
            ],
          },
          type: "fonts",
        },
      ],
    });

    expect(project.sections[0]?.content.fonts?.[0]).toMatchObject({
      family: "Brand Sans",
      src: "/api/portal-assets/preview?slug=project&assetId=font-asset",
      weight: 600,
    });
  });

  test("persists a new font preview URL through the render-project round trip", () => {
    const next = applyRenderProjectDocument(document, {
      ...portalDocumentToRenderProject(document),
      sections: [
        ...portalDocumentToRenderProject(document).sections,
        {
          content: {
            fonts: [
              {
                assetId: "font-asset",
                family: "Brand Sans",
                id: "font-1",
                position: 0,
                src: "https://signed.example/brand-sans.woff2",
                storagePath: "owner/portal/font/brand-sans.woff2",
                visible: true,
                weight: 600,
              },
            ],
          },
          description: "",
          id: "fonts-1",
          position: 1,
          title: "Typography",
          type: "fonts",
          visible: true,
        },
      ],
    });

    expect(next.sections[1]?.content.fonts?.[0]?.file_url).toBe(
      "https://signed.example/brand-sans.woff2",
    );
  });

  test("adapts project, section layout, and image presentation data", () => {
    const project = portalDocumentToRenderProject(document);
    const section = project.sections[0];
    const image = section?.content.images?.[0];

    expect(project.name).toBe("Project");
    expect(section?.layout).toEqual({
      columns: 3,
      gap: "lg",
      mode: "grid",
      width: "wide",
    });
    expect(image).toMatchObject({
      aspectRatio: "16/9",
      background: "#123456",
      fit: "contain",
      padding: 12,
      src: "https://example.com/image.png",
    });
  });

  test("applies controlled project and section changes at the adapter boundary", () => {
    const changedProject = applyRenderProjectChange(document, {
      description: "Updated",
      name: "Updated project",
    });
    const changedSection = applyRenderSectionChange(
      changedProject,
      "section-1",
      {
        field: "layout",
        value: { columns: 2, mode: "comparison" },
      },
    );

    expect(changedSection.portal.name).toBe("Updated project");
    expect(changedSection.sections[0]?.layout).toEqual({
      columns: 2,
      mode: "comparison",
    });
    expect(document.portal.name).toBe("Project");
  });

  test("does not use legacy layout controls as render-time item fallbacks", () => {
    const next = portalDocumentToRenderProject({
      ...document,
      sections: [
        {
          ...document.sections[0],
          content: {
            images: [
              {
                allow_download: true,
                alt_text: "Alt",
                aspect_ratio: "16/9",
                fit: "contain",
                id: "image-1",
                image_url: "https://example.com/image.png",
                position: 0,
                visible: true,
              },
            ],
          },
          layout: {
            imageBackgroundColor: "#abcdef",
            imageContainerPadding: 8,
          },
        },
      ],
    });

    expect(next.sections[0]?.content.images?.[0]).toMatchObject({
      background: undefined,
      padding: undefined,
    });
  });

  test("eagerly reapplies gallery presentation after an item override", () => {
    const { image, section } = galleryFixture();
    const applyGalleryChange = (
      current: PortalDocument,
      change: Record<string, unknown>,
    ) => {
      const project = portalDocumentToRenderProject(current);
      return applyRenderProjectDocument(current, {
        ...project,
        sections: project.sections.map((section) =>
          section.id === "section-1"
            ? { ...section, layout: { ...section.layout, ...change } }
            : section,
        ),
      });
    };
    const applyItemChange = (
      current: PortalDocument,
      change: Record<string, unknown>,
    ) => {
      const project = portalDocumentToRenderProject(current);
      return applyRenderProjectDocument(current, {
        ...project,
        sections: project.sections.map((section) =>
          section.id === "section-1"
            ? {
                ...section,
                content: {
                  ...section.content,
                  images: section.content.images?.map((image, index) =>
                    index === 0 ? { ...image, ...change } : image,
                  ),
                },
              }
            : section,
        ),
      });
    };
    const withSecondImage: PortalDocument = {
      ...document,
      sections: [
        {
          ...section,
          content: {
            images: [
              image,
              {
                ...image,
                id: "image-2",
                position: 1,
              },
            ],
          },
        },
      ],
    };

    const globallyA = applyGalleryChange(withSecondImage, {
      imageAspectRatio: "1/1",
      imageBackgroundColor: "#aaaaaa",
      imageContainerPadding: 4,
      imageFit: "cover",
    });
    const itemB = applyItemChange(globallyA, {
      aspectRatio: "21/9",
      background: "#bbbbbb",
      fit: "contain",
      padding: 9,
    });
    const globallyC = applyGalleryChange(itemB, {
      imageAspectRatio: "4/3",
      imageBackgroundColor: "#cccccc",
      imageContainerPadding: 16,
      imageFit: "fill",
    });

    expect(
      globallyA.sections[0]?.content.images?.map((image) => [
        image.background_color,
        image.container_padding,
        image.aspect_ratio,
        image.fit,
      ]),
    ).toEqual([
      ["#aaaaaa", 4, "1/1", "cover"],
      ["#aaaaaa", 4, "1/1", "cover"],
    ]);
    expect(itemB.sections[0]?.content.images?.[0]).toMatchObject({
      aspect_ratio: "21/9",
      background_color: "#bbbbbb",
      container_padding: 9,
      field_origins: {
        aspect_ratio: "manual",
        background_color: "manual",
        container_padding: "manual",
        fit: "manual",
      },
      fit: "contain",
    });
    expect(
      globallyC.sections[0]?.content.images?.map((image) => [
        image.background_color,
        image.container_padding,
        image.aspect_ratio,
        image.fit,
      ]),
    ).toEqual([
      ["#cccccc", 16, "4/3", "fill"],
      ["#cccccc", 16, "4/3", "fill"],
    ]);
  });

  test("round-trips image field origins through the render model", () => {
    const { image, section } = galleryFixture();
    const source: PortalDocument = {
      ...document,
      sections: [
        {
          ...section,
          content: {
            images: [
              {
                ...image,
                field_origins: {
                  alt_text: "ai",
                  background_color: "manual",
                },
              },
            ],
          },
        },
      ],
    };
    const project = portalDocumentToRenderProject(source);

    expect(project.sections[0]?.content.images?.[0]?.fieldOrigins).toEqual({
      alt_text: "ai",
      background_color: "manual",
    });
    expect(
      applyRenderProjectDocument(source, project).sections[0]?.content
        .images?.[0]?.field_origins,
    ).toEqual({
      alt_text: "ai",
      background_color: "manual",
    });
  });

  test("creates a portal section when a consumer appends a RenderProject section", () => {
    const next = applyRenderProjectDocument(document, {
      ...portalDocumentToRenderProject(document),
      sections: [
        ...portalDocumentToRenderProject(document).sections,
        {
          content: { colors: [] },
          description: "",
          id: "colors-1",
          layout: { columns: 4, mode: "palette" },
          position: 1,
          title: "",
          type: "colors",
          visible: true,
        },
      ],
    });

    expect(next).not.toBe(document);
    expect(next.sections).toHaveLength(2);
    expect(next.sections[1]).toMatchObject({
      content: { colors: [] },
      id: "colors-1",
      position: 1,
      type: "colors",
    });
  });
});
