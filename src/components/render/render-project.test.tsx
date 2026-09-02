import { describe, expect, mock, test } from "bun:test";
import { IconPhotoPlus, IconSettings } from "@tabler/icons-react";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RenderProjectData, RenderSectionData } from "./visual-model";

function withMarker(
  render: ReactElement<Record<string, unknown>>,
  children: ReactNode,
) {
  return cloneElement(render, { children, "data-dialog-trigger": "" });
}

mock.module("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({
    children,
    render,
  }: {
    children: ReactNode;
    render: ReactElement<Record<string, unknown>>;
  }) => withMarker(render, children),
}));
mock.module("server-only", () => ({}));

const { RenderActions } = await import("./render-actions");
const { RenderColors } = await import("./render-colors");
const { RenderFile, RenderFiles } = await import("./render-files");
const { RenderFonts } = await import("./render-fonts");
const { RenderGallery } = await import("./render-gallery");
const { RenderImage } = await import("./render-image");
const { RenderProject } = await import("./render-project");
const { RenderSection } = await import("./render-section");
const { RenderText } = await import("./render-text");
const renderImageSource = await Bun.file(
  new URL("./render-image.tsx", import.meta.url),
).text();
const renderGallerySource = await Bun.file(
  new URL("./render-gallery.tsx", import.meta.url),
).text();
const renderProjectSource = await Bun.file(
  new URL("./render-project.tsx", import.meta.url),
).text();
const renderColorsSource = await Bun.file(
  new URL("./render-colors.tsx", import.meta.url),
).text();
const renderFilesSource = await Bun.file(
  new URL("./render-files.tsx", import.meta.url),
).text();

const image = {
  alt: "Logo",
  aspectRatio: "1/1" as const,
  background: "#123456",
  fit: "contain" as const,
  id: "image-2",
  padding: 12,
  position: 1,
  src: "https://example.com/logo.png",
  visible: true,
};

const sections: RenderSectionData[] = [
  {
    content: { body: "Body text" },
    description: "Text description",
    id: "text",
    position: 2,
    title: "Text section",
    type: "text",
    visible: true,
  },
  {
    content: { images: [image, { ...image, id: "image-1", position: 0 }] },
    description: "Gallery description",
    id: "gallery",
    layout: { columns: 2, gap: "lg", mode: "comparison", width: "wide" },
    position: 0,
    title: "Gallery section",
    type: "gallery",
    visible: true,
  },
];

const project: RenderProjectData = {
  description: "Project description",
  id: "project-1",
  name: "Project name",
  sections,
};

describe("RenderProject visual contract", () => {
  test("orders sections and selects the renderer by type", () => {
    const html = renderToStaticMarkup(
      <RenderProject mode="view" project={project} />,
    );

    expect(html.indexOf("Gallery section")).toBeLessThan(
      html.indexOf("Text section"),
    );
    expect(html).toContain("Body text");
    expect(html).toContain("grid-cols-2");
  });

  test("preserves collection and image presentation configuration", () => {
    const html = renderToStaticMarkup(
      <RenderGallery
        items={[image]}
        layout={{ columns: 3, gap: "lg", mode: "grid", width: "full" }}
      />,
    );

    expect(html).toContain("grid-cols-3");
    expect(html).toContain("gap-6");
    expect(html).toContain("aspect-square");
    expect(html).toContain("object-contain");
    expect(html).toContain("padding:12px");
    expect(html).toContain("background-color:#123456");
  });

  test("renders a transparent image background while retaining its selected color", () => {
    const html = renderToStaticMarkup(
      <RenderImage
        image={{ ...image, backgroundTransparent: true }}
        previewable={false}
      />,
    );

    expect(html).not.toContain("background-color:#123456");
    expect(html).toContain("aspect-square");
  });

  test("edits comparison image descriptions only in editor mode", () => {
    const editor = renderToStaticMarkup(
      <RenderGallery
        editable
        items={[image]}
        layout={{ mode: "comparison" }}
        onItemDescriptionChange={() => undefined}
      />,
    );
    const view = renderToStaticMarkup(
      <RenderGallery items={[image]} layout={{ mode: "comparison" }} />,
    );
    const editableGrid = renderToStaticMarkup(
      <RenderGallery editable items={[image]} layout={{ mode: "grid" }} />,
    );
    const legacyEditor = renderToStaticMarkup(
      <RenderProject
        mode="editor"
        onChange={() => undefined}
        project={{
          ...project,
          sections: [
            {
              ...sections[1],
              layout: {},
              type: "image_comparison",
            },
          ],
        }}
      />,
    );

    expect(editor).toContain("<textarea");
    expect(editor).toContain('aria-label="Image description"');
    expect(editor).toContain(">Logo</textarea>");
    expect(editor).not.toContain("<figcaption");
    expect(view).not.toContain("<textarea");
    expect(view).toContain("<figcaption");
    expect(view).toContain("Logo</figcaption>");
    expect(editableGrid).not.toContain("<textarea");
    expect(legacyEditor).toContain('aria-label="Image description"');
  });

  test("renders a gallery item's presentation instead of conflicting layout controls", () => {
    const html = renderToStaticMarkup(
      <RenderGallery
        items={[image]}
        layout={{
          imageAspectRatio: "16/9",
          imageBackgroundColor: "#abcdef",
          imageContainerPadding: 2,
          imageFit: "cover",
        }}
      />,
    );

    expect(html).toContain("aspect-square");
    expect(html).toContain("object-contain");
    expect(html).toContain("padding:12px");
    expect(html).toContain("background-color:#123456");
    expect(html).not.toContain("aspect-video");
    expect(html).not.toContain("object-cover");
    expect(html).not.toContain("padding:2px");
    expect(html).not.toContain("background-color:#abcdef");
  });

  test("keeps image media inside an absolute padded stage with actions as its sibling", () => {
    const html = renderToStaticMarkup(
      <RenderImage
        actions={[{ icon: IconSettings, id: "settings", label: "Settings" }]}
        editable={false}
        image={{ ...image, background: "#ff0000" }}
        previewable={false}
      />,
    );

    expect(html).toMatch(
      /<div class="relative [^"]*rounded-xl bg-muted aspect-square" style="background-color:#ff0000">/,
    );
    expect(html).toContain(
      '<div class="absolute inset-0" style="padding:12px">',
    );
    expect(html).toContain("object-contain");
    expect(html.indexOf('class="absolute inset-0"')).toBeLessThan(
      html.indexOf("data-render-actions"),
    );
    const media = renderImageSource.slice(
      renderImageSource.indexOf("const media = ("),
      renderImageSource.indexOf("return ("),
    );
    expect(media).toContain("</div>\n      <RenderActions");
  });

  test("disables native browser dragging for rendered image and file previews", () => {
    const imageMarkup = renderToStaticMarkup(<RenderImage image={image} />);
    const fileMarkup = renderToStaticMarkup(
      <RenderFile
        file={{
          fileName: "preview.png",
          id: "file-image",
          position: 0,
          src: "https://example.com/preview.png",
          visible: true,
        }}
      />,
    );

    expect(imageMarkup.match(/<img /g)).toHaveLength(2);
    expect(imageMarkup.match(/draggable="false"/g)).toHaveLength(2);
    expect(fileMarkup.match(/<img /g)).toHaveLength(1);
    expect(fileMarkup).toContain('draggable="false"');
  });

  test("top-aligns gallery cells for mixed image ratios", () => {
    expect(renderGallerySource).toContain('"items-start"');
    expect(renderGallerySource).toContain('className="h-fit self-start"');
  });

  test("editable changes presentation and emits controlled callbacks", () => {
    const onChange = mock(() => undefined);
    const html = renderToStaticMarkup(
      <RenderSection
        description="Description"
        editable
        id="section-1"
        onChange={onChange}
        title="Title"
      >
        <RenderText body="Text" />
      </RenderSection>,
    );

    expect(html).toContain('name="title"');
    expect(html).toContain('name="description"');
    expect(onChange).not.toHaveBeenCalled();
  });

  test("renders external actions with React icons and no implicit behavior", () => {
    const onClick = mock(() => undefined);
    const html = renderToStaticMarkup(
      <RenderImage
        actions={[
          {
            attributes: { "demo-id": "image-settings" },
            icon: IconSettings,
            id: "settings",
            label: "Settings",
            onClick,
          },
        ]}
        image={image}
      />,
    );

    expect(html).toContain("Settings");
    expect(html).toContain("tabler-icon-settings");
    expect(html).toContain('demo-id="image-settings"');
    expect(html).not.toContain("<a ");
    expect(html).not.toContain(" download=");
  });

  test("keeps section overlay actions inset while item actions retain edge bleed", () => {
    const action = [{ icon: IconSettings, id: "settings", label: "Settings" }];
    const sectionRight = renderToStaticMarkup(
      <RenderActions actions={action} layout="overlay" scope="section" />,
    );
    const sectionLeft = renderToStaticMarkup(
      <RenderActions
        actions={action}
        layout="overlay"
        policy={{ position: "top-left" }}
        scope="section"
      />,
    );
    const item = renderToStaticMarkup(
      <RenderActions actions={action} layout="overlay" scope="item" />,
    );
    const itemLeft = renderToStaticMarkup(
      <RenderActions
        actions={action}
        layout="overlay"
        policy={{ position: "top-left" }}
        scope="item"
      />,
    );
    const sectionHeader = renderToStaticMarkup(
      <RenderSection actions={action} id="section-actions" title="Files" />,
    );

    expect(sectionRight).toContain("top-2.5 right-2.5");
    expect(sectionRight).not.toContain("-right-2.5");
    expect(sectionLeft).toContain("top-2.5 left-2.5");
    expect(item).toContain("top-2.5 right-2.5");
    expect(itemLeft).toContain("top-2.5 left-2.5");
    expect(sectionHeader).toContain('data-layout="inline"');
    expect(sectionHeader).not.toContain("-right-2");
  });

  test("exposes standalone collection renderers", () => {
    const html = renderToStaticMarkup(
      <>
        <RenderColors items={[]} layout={{ columns: 4 }} />
        <RenderFonts items={[]} />
        <RenderFiles items={[]} layout={{ columns: 3 }} />
      </>,
    );

    expect(html).toContain("grid-cols-4");
    expect(html).toContain("grid-cols-3");
  });

  test("loads each typography sample from its prepared font asset", () => {
    const html = renderToStaticMarkup(
      <RenderFonts
        items={[
          {
            family: "Brand Sans",
            id: "font-1",
            position: 0,
            sample: "The quick brown fox",
            src: "/api/portal-assets/preview?slug=project&assetId=font-asset",
            visible: true,
            weight: 600,
          },
        ]}
      />,
    );

    expect(html).toContain('@font-face { font-family: "portal-font-font-1"');
    expect(html).toContain(
      'src: url("/api/portal-assets/preview?slug=project&assetId=font-asset")',
    );
    expect(html).toContain("font-weight: 600");
    expect(html).toContain(
      'style="font-family:&quot;portal-font-font-1&quot;;font-weight:600"',
    );
  });

  test("uses the exported file-card leaf for collection and standalone previews", () => {
    const file = {
      background: "#123456",
      fileName: "guide.pdf",
      id: "file-1",
      padding: 12,
      position: 0,
      src: "https://example.com/guide.pdf",
      visible: false,
    };

    const standalone = renderToStaticMarkup(<RenderFile file={file} />);
    const collection = renderToStaticMarkup(<RenderFiles items={[file]} />);

    expect(standalone).toContain('data-render-file-preview="pdf"');
    expect(standalone).toContain("guide.pdf");
    expect(standalone).toContain("aspect-square");
    expect(collection).not.toContain("guide.pdf");
  });

  test.each([
    ["guide.pdf", "pdf", ">PDF</text>"],
    ["brand.ai", "ai", 'fill="#FF9A00"'],
    ["template.ait", "ait", 'fill="#FF9A00"'],
    ["mark.eps", "eps", ">EPS</text>"],
    ["mockup.psd", "psd", 'fill="#31A8FF"'],
    ["large-mockup.psb", "psb", 'fill="#31A8FF"'],
    ["notes.txt", "txt", "tabler-icon-file-text"],
    ["README.md", "md", 'viewBox="0 0 208 128"'],
    ["README.markdown", "md", 'viewBox="0 0 208 128"'],
    ["catalog.indd", "indd", ">INDD</span>"],
    ["catalog-template.indt", "indt", ">INDT</span>"],
    ["catalog.idml", "idml", ">IDML</span>"],
    ["scan.tif", "tiff", "tabler-icon-photo-filled"],
    ["scan.tiff", "tiff", "tabler-icon-photo-filled"],
  ])(
    "uses the supported %s file-type icon without an image border",
    (fileName, type, iconMarker) => {
      const html = renderToStaticMarkup(
        <RenderFile
          file={{
            fileName,
            id: `file-${type}`,
            position: 0,
            src: `https://example.com/${fileName}`,
            visible: true,
          }}
        />,
      );

      expect(html).toContain(`data-render-file-preview="${type}"`);
      expect(html).toContain(iconMarker);
      expect(html).not.toContain("border-border/50 border");
    },
  );

  test.each([
    ["guide.pdf", "pdf", "#ff2116"],
    ["brand.ai", "ai", "#FF9A00"],
    ["mark.eps", "eps", "#FF9A00"],
    ["mockup.psd", "psd", "#31A8FF"],
    ["README.md", "md", "var(--muted-foreground)"],
  ])(
    "uses a subtle branded background for %s previews",
    (fileName, type, color) => {
      const html = renderToStaticMarkup(
        <RenderFile
          file={{
            fileName,
            id: `file-background-${type}`,
            position: 0,
            src: `https://example.com/${fileName}`,
            visible: true,
          }}
        />,
      );

      expect(html).toContain(
        `background-color:color-mix(in oklch, ${color} 12%, transparent)`,
      );
    },
  );

  test.each(["logo.svg", "photo.png", "photo.jpg", "photo.webp"])(
    "keeps the image preview rounded and unbordered for %s previews",
    (fileName) => {
      const html = renderToStaticMarkup(
        <RenderFile
          file={{
            fileName,
            id: `file-${fileName}`,
            position: 0,
            src: `https://example.com/${fileName}`,
            visible: true,
          }}
        />,
      );

      expect(html).toContain('data-render-file-preview="image"');
      expect(html).toContain("rounded-2xl object-contain");
      expect(html).not.toContain("border border-border/50");
      expect(html).toContain(`<img alt=""`);
    },
  );

  test("applies configured file presentation and legacy defaults", () => {
    const configured = renderToStaticMarkup(
      <RenderFile
        file={{
          aspectRatio: "16/9",
          fileName: "cover.png",
          fit: "cover",
          id: "configured-file",
          position: 0,
          src: "https://example.com/cover.png",
          visible: true,
        }}
      />,
    );
    const legacy = renderToStaticMarkup(
      <RenderFile
        file={{
          fileName: "legacy.png",
          id: "legacy-file",
          position: 0,
          src: "https://example.com/legacy.png",
          visible: true,
        }}
      />,
    );

    expect(configured).toContain("aspect-video");
    expect(configured).toContain("object-cover");
    expect(legacy).toContain("aspect-square");
    expect(legacy).toContain("object-contain");
  });

  test("applies file background color only to image and SVG previews", () => {
    const image = renderToStaticMarkup(
      <RenderFile
        file={{
          background: "#123456",
          fileName: "cover.png",
          id: "image-file",
          padding: 14,
          position: 0,
          src: "https://example.com/cover.png",
          visible: true,
        }}
      />,
    );
    const document = renderToStaticMarkup(
      <RenderFile
        file={{
          background: "#123456",
          fileName: "guide.pdf",
          id: "document-file",
          padding: 14,
          position: 0,
          src: "https://example.com/guide.pdf",
          visible: true,
        }}
      />,
    );

    expect(image).toContain("background-color:#123456");
    expect(image).toContain("padding:14px");
    expect(document).not.toContain("background-color:#123456");
    expect(document).not.toContain("padding:14px");
  });

  test("applies file padding to an explicitly typed SVG preview", () => {
    const svg = renderToStaticMarkup(
      <RenderFile
        file={{
          fileName: "asset.pdf",
          fileType: "svg",
          id: "svg-file",
          padding: 8,
          position: 0,
          src: "https://example.com/asset.svg",
          visible: true,
        }}
      />,
    );

    expect(svg).toContain('data-render-file-preview="image"');
    expect(svg).toContain("padding:8px");
  });

  test("renders the Markdown icon and clamps uninterrupted file names to two lines", () => {
    const html = renderToStaticMarkup(
      <RenderFile
        file={{
          fileName: "Ejercicio_1_Semana_1_entrega_final_documentada",
          fileType: "md",
          id: "file-markdown-long-name",
          position: 0,
          src: "https://example.com/Ejercicio_1_Semana_1_entrega_final_documentada.md",
          visible: true,
        }}
      />,
    );

    expect(html).toContain('data-render-file-preview="md"');
    expect(html).toContain('viewBox="0 0 208 128"');
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("min-w-0");
    expect(html).toContain("break-all");
    expect(html).not.toContain("truncate");
  });
});

test("uses one facade for editor fields and view-only presentation", () => {
  const editor = renderToStaticMarkup(
    <RenderProject
      mode="editor"
      onChange={() => undefined}
      project={project}
    />,
  );
  const view = renderToStaticMarkup(
    <RenderProject mode="view" project={project} />,
  );
  expect(editor).toContain('data-render-mode="editor"');
  expect(editor).toContain("data-portal-name");
  expect(view).toContain('data-render-mode="view"');
  expect(view).not.toContain("data-portal-name");
});

test("reserves inline space for project and section actions in both modes", () => {
  const actions = {
    project: () => [
      { icon: IconSettings, id: "project-action", label: "Project action" },
    ],
    section: () => [
      { icon: IconSettings, id: "section-action", label: "Section action" },
    ],
  };
  const editor = renderToStaticMarkup(
    <RenderProject
      actions={actions}
      mode="editor"
      onChange={() => undefined}
      project={project}
    />,
  );
  const view = renderToStaticMarkup(
    <RenderProject actions={actions} mode="view" project={project} />,
  );

  for (const html of [editor, view]) {
    expect(html).toContain("data-render-project-heading");
    expect(html.match(/data-layout="inline"/g)?.length).toBe(3);
    expect(html).toContain("min-w-0 flex-1");
  }
  expect(renderImageSource).toContain(
    'className="resize-none border-none bg-transparent! px-0 text-balance',
  );
});

test("opens the image lightbox only in view mode", () => {
  const imageProject: RenderProjectData = {
    ...project,
    sections: [
      {
        content: { image },
        description: "",
        id: "image-section",
        position: 0,
        title: "Image",
        type: "image",
        visible: true,
      },
    ],
  };
  const editor = renderToStaticMarkup(
    <RenderProject
      mode="editor"
      onChange={() => undefined}
      project={imageProject}
    />,
  );
  const view = renderToStaticMarkup(
    <RenderProject mode="view" project={imageProject} />,
  );

  expect(editor).not.toContain("Open Logo");
  expect(view).toContain("Open Logo");
});

test("limits image sections to one full-width image with an optional description", () => {
  const imageProject: RenderProjectData = {
    ...project,
    sections: [
      {
        content: { image },
        description: "",
        id: "image-section",
        position: 0,
        title: "Image",
        type: "image",
        visible: true,
      },
    ],
  };
  const actions = {
    collection: () => ({
      icon: IconPhotoPlus,
      id: "pick-image",
      label: "Add image",
    }),
  };
  const editor = renderToStaticMarkup(
    <RenderProject
      actions={actions}
      mode="editor"
      onChange={() => undefined}
      project={imageProject}
    />,
  );
  const view = renderToStaticMarkup(
    <RenderProject actions={actions} mode="view" project={imageProject} />,
  );
  const emptyEditor = renderToStaticMarkup(
    <RenderProject
      actions={actions}
      mode="editor"
      onChange={() => undefined}
      project={{
        ...imageProject,
        sections: [{ ...imageProject.sections[0], content: { image: null } }],
      }}
    />,
  );

  expect(editor).toContain('class="w-full"');
  expect(editor).not.toContain("sm:grid-cols-2");
  expect(editor).toContain('aria-label="Image description"');
  expect(editor).toContain(">Logo</textarea>");
  expect(editor).not.toContain('data-render-add-tile="image"');
  expect(view).toContain("<figcaption");
  expect(emptyEditor).toContain('data-render-add-tile="image"');
});

test("resolves renderer action visuals without leaf configuration", () => {
  const html = renderToStaticMarkup(
    <RenderProject
      actions={{
        section: () => [
          { icon: IconSettings, id: "inspect", label: "Inspect" },
        ],
      }}
      mode="view"
      project={project}
    />,
  );
  expect(html).toContain("rounded-full");
  expect(html).toContain('data-visibility="hover"');
});

test("binds hover actions to their owning section and item groups", () => {
  const hover = renderToStaticMarkup(
    <RenderProject
      actions={{
        image: () => [
          { icon: IconSettings, id: "inspect-image", label: "Inspect image" },
        ],
        section: () => [
          {
            icon: IconSettings,
            id: "inspect-section",
            label: "Inspect section",
          },
        ],
      }}
      mode="view"
      project={{
        ...project,
        sections: [
          {
            content: { image },
            description: "",
            id: "image-section",
            position: 0,
            title: "Image",
            type: "image",
            visible: true,
          },
        ],
      }}
    />,
  );
  const always = renderToStaticMarkup(
    <RenderProject
      actions={{
        section: () => [
          {
            icon: IconSettings,
            id: "inspect-section",
            label: "Inspect section",
          },
        ],
      }}
      mode="view"
      project={project}
      ui={{ actions: { section: { visibility: "always" } } }}
    />,
  );

  expect(hover).toContain("group/section");
  expect(hover).toContain("group/item");
  expect(hover).toContain("group-hover/section:opacity-100");
  expect(hover).toContain("group-focus-within/section:opacity-100");
  expect(hover).toContain("group-hover/item:opacity-100");
  expect(hover).toContain("group-focus-within/item:opacity-100");
  expect(hover).not.toContain("sm:group-hover:opacity-100");
  expect(always).toMatch(
    /class="([^"]*)" data-layout="[^"]*" data-render-actions="true"[^>]*data-visibility="always"/,
  );
  const alwaysClasses = always.match(
    /class="([^"]*)" data-layout="[^"]*" data-render-actions="true"[^>]*data-visibility="always"/,
  )?.[1];
  expect(alwaysClasses).not.toContain("opacity-0");
});

test("uses dnd-kit only for collection items and never makes sections sortable", () => {
  const editor = renderToStaticMarkup(
    <RenderProject
      mode="editor"
      onChange={() => undefined}
      project={project}
    />,
  );
  const view = renderToStaticMarkup(
    <RenderProject mode="view" project={project} />,
  );
  expect(renderProjectSource).toContain("DragDropProvider");
  expect(renderProjectSource).toContain("isSortable(source)");
  expect(renderProjectSource).not.toContain("draggedSectionId");
  expect(renderProjectSource).not.toContain("draggable={editor}");
  expect(renderGallerySource).toContain("RenderSortableItem");
  expect(renderColorsSource).toContain("RenderSortableItem");
  expect(renderFilesSource).toContain("RenderSortableItem");
  expect(editor).toContain("data-render-sortable-item");
  expect(view).not.toContain("data-render-sortable-item");
});

test("renders collection add affordances as trailing tiles only in editor mode", () => {
  const onClick = mock(() => undefined);
  const editor = renderToStaticMarkup(
    <RenderProject
      actions={{
        collection: () => ({
          icon: IconPhotoPlus,
          id: "pick-image",
          label: "Add image",
          onClick,
        }),
      }}
      mode="editor"
      onChange={() => undefined}
      project={project}
    />,
  );
  const view = renderToStaticMarkup(
    <RenderProject
      actions={{
        collection: () => ({
          icon: IconPhotoPlus,
          id: "pick-image",
          label: "Add image",
          onClick,
        }),
      }}
      mode="view"
      project={project}
    />,
  );

  expect(editor).toContain('data-render-add-tile="image"');
  expect(editor).toContain("Add image");
  expect(view).not.toContain("data-render-add-tile");
});

test("honors externally controlled collection availability without plan knowledge", () => {
  const actions = {
    collection: () => ({
      icon: IconPhotoPlus,
      id: "pick-image",
      label: "Add image",
    }),
  };
  const unavailable = renderToStaticMarkup(
    <RenderProject
      actions={actions}
      collectionAvailability={{ gallery: { image: false } }}
      mode="editor"
      onChange={() => undefined}
      project={project}
    />,
  );
  const available = renderToStaticMarkup(
    <RenderProject
      actions={actions}
      collectionAvailability={{ gallery: { image: true } }}
      mode="editor"
      onChange={() => undefined}
      project={project}
    />,
  );

  expect(unavailable).not.toContain('data-render-add-tile="image"');
  expect(available).toContain('data-render-add-tile="image"');
  expect(renderProjectSource).not.toContain("portal-policy");
});

test("keeps collection additions out of compact section actions", () => {
  const html = renderToStaticMarkup(
    <RenderProject
      actions={{
        collection: () => ({
          icon: IconPhotoPlus,
          id: "pick-image",
          label: "Add image",
        }),
        section: () => [
          { icon: IconSettings, id: "configure", label: "Configure section" },
        ],
      }}
      mode="editor"
      onChange={() => undefined}
      project={project}
    />,
  );

  expect(html.match(/data-render-actions/g)?.length).toBe(2);
  expect(html).toContain('data-render-add-tile="image"');
});

test("applies resolved view action policy while editor keeps locked defaults", () => {
  const view = renderToStaticMarkup(
    <RenderProject
      actions={{
        section: () => [
          { icon: IconSettings, id: "inspect", label: "Inspect" },
        ],
      }}
      mode="view"
      project={project}
      ui={{
        actions: { section: { position: "bottom-left", visibility: "always" } },
      }}
    />,
  );
  const editor = renderToStaticMarkup(
    <RenderProject
      actions={{
        section: () => [
          { icon: IconSettings, id: "inspect", label: "Inspect" },
        ],
      }}
      mode="editor"
      onChange={() => undefined}
      project={project}
      ui={{
        actions: { section: { position: "bottom-left", visibility: "hover" } },
      }}
    />,
  );
  expect(view).toContain('data-position="bottom-left"');
  expect(view).toContain('data-visibility="always"');
  expect(editor).toContain('data-position="top-right"');
  expect(editor).toContain('data-visibility="always"');
});

test("keeps render leaves free of portal-domain preview imports", async () => {
  const source = await Bun.file(
    new URL("./render-files.tsx", import.meta.url),
  ).text();
  expect(source).not.toContain("@/components/portal/");
  expect(source).not.toContain("@/domain/portal/");
});
