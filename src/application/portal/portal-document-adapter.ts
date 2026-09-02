import { fileTypeFromName } from "@/components/file-type-icon";
import type {
  RenderColorData,
  RenderFileData,
  RenderFontData,
  RenderImageData,
  RenderProjectData,
  RenderSectionChange,
  RenderSectionData,
} from "@/components/render/visual-model";
import {
  applyChangedGalleryImagePresentation,
  applySectionImagePresentation,
  createPortalSection,
  galleryImagePresentationFields,
  type PortalColorItem,
  type PortalDocument,
  type PortalFileItem,
  type PortalFontItem,
  type PortalImageItem,
} from "@/domain/portal/document";

function imageToRenderImage(image: PortalImageItem): RenderImageData {
  return {
    alt: image.alt_text,
    allowDownload: image.allow_download,
    assetId: image.asset_id,
    storagePath: image.storage_path,
    aspectRatio: image.aspect_ratio,
    background: image.background_color,
    backgroundTransparent: image.background_transparent,
    displayName: image.display_name,
    downloadName: image.download_name,
    fit: image.fit,
    fieldOrigins: image.field_origins,
    height: image.height,
    id: image.id,
    padding: image.container_padding,
    position: image.position,
    src: image.image_url,
    visible: image.visible,
    width: image.width,
  };
}

function colorToRenderColor(color: PortalColorItem): RenderColorData {
  return {
    code: color.color_code,
    id: color.id,
    name: color.color_name,
    position: color.position,
    visible: color.visible,
  };
}

function fontToRenderFont(font: PortalFontItem): RenderFontData {
  return {
    family: font.font_name,
    downloadName: font.download_name,
    assetId: font.asset_id,
    storagePath: font.storage_path,
    id: font.id,
    name: font.display_name,
    position: font.position,
    provider: font.provider,
    sample: font.sample_text,
    src: font.file_url,
    usage: font.usage,
    visible: font.visible,
    weight: font.weight,
    weights: font.weights,
  };
}

function fileToRenderFile(file: PortalFileItem): RenderFileData {
  return {
    assetId: file.asset_id,
    allowDownload: file.allow_download,
    storagePath: file.storage_path,
    background: file.background_color,
    description: file.description,
    downloadName: file.download_name,
    aspectRatio: file.aspect_ratio,
    fileName: file.display_name || file.file_name,
    fileType: file.file_type ?? fileTypeFromName(file.file_name) ?? undefined,
    fit: file.fit,
    id: file.id,
    padding: file.container_padding,
    position: file.position,
    src: file.file_url,
    visible: file.visible,
  };
}

function renderImageToPortalImage(
  image: RenderImageData,
  previous?: PortalImageItem,
): PortalImageItem {
  const fieldOrigins = {
    ...previous?.field_origins,
    ...image.fieldOrigins,
  };
  for (const field of galleryImagePresentationFields) {
    const value = (image as Record<string, unknown>)[field.render];
    if (previous && value !== undefined && value !== previous[field.image]) {
      fieldOrigins[field.image] = "manual";
    }
  }
  return {
    ...previous,
    allow_download: image.allowDownload ?? previous?.allow_download ?? true,
    asset_id: image.assetId,
    storage_path: image.storagePath,
    alt_text: image.alt,
    aspect_ratio: image.aspectRatio,
    background_color: image.background,
    background_transparent: image.backgroundTransparent,
    container_padding: image.padding,
    download_name: image.downloadName,
    fit: image.fit,
    ...(Object.keys(fieldOrigins).length > 0
      ? { field_origins: fieldOrigins }
      : {}),
    height: image.height,
    id: image.id,
    image_url: image.src,
    position: image.position,
    visible: image.visible,
    width: image.width,
  };
}

function renderContentToPortalContent(
  content: NonNullable<RenderSectionData["content"]>,
  previous: PortalDocument["sections"][number]["content"],
  layout: RenderSectionData["layout"],
) {
  const previousImages = new Map(
    (previous.images ?? []).map((image) => [image.id, image]),
  );
  const previousColors = new Map(
    (previous.colors ?? []).map((color) => [color.id, color]),
  );
  const previousFonts = new Map(
    (previous.fonts ?? []).map((font) => [font.id, font]),
  );
  const previousFiles = new Map(
    (previous.files ?? []).map((file) => [file.id, file]),
  );

  return {
    ...previous,
    body_md: content.body,
    colors: content.colors?.map((color) => ({
      ...previousColors.get(color.id),
      color_code: color.code,
      color_name: color.name,
      id: color.id,
      position: color.position,
      visible: color.visible,
    })),
    files: content.files?.map((file) => ({
      ...previousFiles.get(file.id),
      allow_download:
        file.allowDownload ??
        previousFiles.get(file.id)?.allow_download ??
        true,
      background_color: file.background,
      container_padding: file.padding,
      description: file.description,
      asset_id: file.assetId,
      aspect_ratio:
        file.aspectRatio ?? previousFiles.get(file.id)?.aspect_ratio ?? "1/1",
      storage_path: file.storagePath,
      display_name: file.fileName,
      download_name: file.downloadName,
      file_name: previousFiles.get(file.id)?.file_name ?? file.fileName,
      file_type:
        file.fileType ??
        previousFiles.get(file.id)?.file_type ??
        fileTypeFromName(
          previousFiles.get(file.id)?.file_name ?? file.fileName,
        ) ??
        undefined,
      file_url: file.src,
      fit: file.fit ?? previousFiles.get(file.id)?.fit ?? "contain",
      id: file.id,
      position: file.position,
      visible: file.visible,
    })),
    fonts: content.fonts?.map((font) => ({
      ...previousFonts.get(font.id),
      asset_id: font.assetId,
      storage_path: font.storagePath,
      display_name: font.name,
      download_name: font.downloadName,
      file_url: font.src ?? previousFonts.get(font.id)?.file_url,
      font_name: font.family,
      id: font.id,
      position: font.position,
      provider: font.provider,
      sample_text: font.sample,
      usage: font.usage,
      visible: font.visible,
      weight: font.weight,
      weights: font.weights,
    })),
    image: content.image
      ? renderImageToPortalImage(content.image, previous.image ?? undefined)
      : content.image,
    images: content.images?.map((image) => {
      const previousImage = previousImages.get(image.id);
      const nextImage = renderImageToPortalImage(image, previousImage);
      return previousImage
        ? nextImage
        : applySectionImagePresentation(nextImage, layout ?? {});
    }),
  };
}

function sectionToRenderSection(
  section: PortalDocument["sections"][number],
): RenderSectionData {
  return {
    content: {
      body: section.content.body_md,
      colors: section.content.colors?.map(colorToRenderColor),
      files: section.content.files?.map(fileToRenderFile),
      fonts: section.content.fonts?.map(fontToRenderFont),
      image: section.content.image
        ? imageToRenderImage(section.content.image)
        : null,
      images: section.content.images?.map(imageToRenderImage),
    },
    description: section.description,
    id: section.id,
    layout: {
      align: section.layout.align,
      columns: section.layout.columns,
      gap: section.layout.gap,
      imageBackgroundColor: section.layout.imageBackgroundColor,
      imageContainerPadding: section.layout.imageContainerPadding,
      imageAspectRatio: section.layout.imageAspectRatio,
      imageFit: section.layout.imageFit,
      mode: section.layout.mode,
      showColorCode: section.layout.showColorCode,
      showColorName: section.layout.showColorName,
      width: section.layout.width,
    },
    position: section.position,
    title: section.title,
    type: section.type,
    visible: section.visible,
  };
}

export function portalDocumentToRenderProject(
  document: PortalDocument,
): RenderProjectData {
  return {
    description: document.portal.description,
    id: "portal",
    name: document.portal.name,
    sections: document.sections.map(sectionToRenderSection),
  };
}

export function portalSectionToRenderSection(
  section: PortalDocument["sections"][number],
): RenderSectionData {
  return sectionToRenderSection(section);
}

/** Apply UI changes at the application boundary, never inside RenderProject. */
export function applyRenderProjectChange(
  document: PortalDocument,
  change: Pick<RenderProjectData, "name" | "description">,
): PortalDocument {
  return {
    ...document,
    portal: {
      ...document.portal,
      ...change,
    },
  };
}

/** Adapt controlled section changes back into the persisted domain model. */
export function applyRenderSectionChange(
  document: PortalDocument,
  sectionId: string,
  change: RenderSectionChange,
): PortalDocument {
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.id !== sectionId) return section;

      if (change.field === "title" || change.field === "description") {
        return { ...section, [change.field]: change.value };
      }
      if (change.field === "position") {
        return { ...section, position: change.value };
      }
      if (change.field === "layout") {
        return {
          ...section,
          layout: change.value,
          content:
            section.type === "gallery" && section.content.images
              ? {
                  ...section.content,
                  images: applyChangedGalleryImagePresentation(
                    section.content.images,
                    section.layout,
                    change.value,
                  ),
                }
              : section.content,
        };
      }
      if (change.field !== "content") return section;
      return {
        ...section,
        content: {
          ...section.content,
          ...renderContentToPortalContent(
            change.value,
            section.content,
            section.layout,
          ),
        },
      };
    }),
  };
}

/** Apply the renderer's controlled immutable snapshot at the application boundary. */
export function applyRenderProjectDocument(
  document: PortalDocument,
  project: RenderProjectData,
): PortalDocument {
  let next: PortalDocument = {
    ...document,
    portal: {
      ...document.portal,
      name: project.name,
      description: project.description,
    },
  };
  for (const section of project.sections) {
    if (!next.sections.some((candidate) => candidate.id === section.id)) {
      const created = createPortalSection(section.type, section.position);
      next = {
        ...next,
        sections: [...next.sections, { ...created, id: section.id }],
      };
    }
    next = applyRenderSectionChange(next, section.id, {
      field: "content",
      value: section.content,
    });
    next = applyRenderSectionChange(next, section.id, {
      field: "layout",
      value: section.layout ?? {},
    });
    next = applyRenderSectionChange(next, section.id, {
      field: "position",
      value: section.position,
    });
    next = applyRenderSectionChange(next, section.id, {
      field: "title",
      value: section.title,
    });
    next = applyRenderSectionChange(next, section.id, {
      field: "description",
      value: section.description,
    });
  }
  return next;
}
