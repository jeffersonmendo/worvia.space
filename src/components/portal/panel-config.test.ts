import { expect, test } from "bun:test";
import {
  createPanelDeleteConfirmation,
  supportsFilePreviewPresentation,
} from "./panel-config";
import { visualColorPickerValue } from "./visual-color-picker";

const panelSource = await Bun.file(
  new URL("./panel-config.tsx", import.meta.url),
).text();
const controlsSource = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const colorPickerSource = await Bun.file(
  new URL("./visual-color-picker.tsx", import.meta.url),
).text();

function indexOfOrThrow(source: string, value: string) {
  const index = source.indexOf(value);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

test("orders PanelConfig fields with inputs before final switches", () => {
  const imageFields = panelSource.slice(
    indexOfOrThrow(panelSource, "function ImageFields"),
    indexOfOrThrow(panelSource, "function ColorFields"),
  );
  const galleryFields = panelSource.slice(
    indexOfOrThrow(panelSource, "function GallerySectionFields"),
    indexOfOrThrow(panelSource, "function ColorSectionFields"),
  );

  expect(indexOfOrThrow(imageFields, 'label="Nombre visible"')).toBeLessThan(
    indexOfOrThrow(imageFields, 'label="Mostrar imagen"'),
  );
  expect(indexOfOrThrow(imageFields, "<PaddingSlider")).toBeLessThan(
    indexOfOrThrow(imageFields, 'label="Mostrar imagen"'),
  );
  expect(indexOfOrThrow(galleryFields, "<ColorPickerField")).toBeLessThan(
    indexOfOrThrow(panelSource, 'label="Mostrar sección"'),
  );
});

test("keeps deletion pending when confirmation is canceled", () => {
  let deleteCalls = 0;
  let open = true;
  const confirmation = createPanelDeleteConfirmation(
    () => deleteCalls++,
    (nextOpen) => {
      open = nextOpen;
    },
  );

  confirmation.cancel();

  expect(open).toBe(false);
  expect(deleteCalls).toBe(0);
});

test("deletes only after confirmation", () => {
  let deleteCalls = 0;
  let open = true;
  const confirmation = createPanelDeleteConfirmation(
    () => deleteCalls++,
    (nextOpen) => {
      open = nextOpen;
    },
  );

  confirmation.confirm();

  expect(open).toBe(false);
  expect(deleteCalls).toBe(1);
});

test("uses contextual Spanish placeholders for every panel input and select", () => {
  expect(panelSource).toContain("placeholder={`Ingresa");
  expect(panelSource).toContain("placeholder={`Selecciona");
  expect(panelSource.match(/label\.toLowerCase\(\)/g)?.length).toBe(2);
});

test("renders icons in select options and selected values", () => {
  const selectField = panelSource.slice(
    indexOfOrThrow(panelSource, "function SelectField"),
    indexOfOrThrow(panelSource, "function PaddingSlider"),
  );

  expect(selectField).toContain(
    "const selectItems = options.map(([value, name, Icon]) => ({",
  );
  expect(selectField).toContain("items={selectItems}");
  expect(selectField.match(/<Icon aria-hidden \/>/g)?.length).toBe(2);
  expect(panelSource).toContain("const THREE_TO_FOUR_COLUMN_OPTIONS");
  expect(panelSource).toContain("const COLOR_COLUMN_OPTIONS");
  expect(panelSource).toContain("const WIDTH_OPTIONS");
  expect(panelSource).toContain("const GALLERY_LAYOUT_OPTIONS");
  expect(panelSource).toContain("const COLOR_LAYOUT_OPTIONS");
  expect(panelSource).toContain("const FIT_OPTIONS");
  expect(panelSource).toContain("const ASPECT_RATIO_OPTIONS");

  const columnOptions = panelSource.slice(
    indexOfOrThrow(panelSource, "const THREE_TO_FOUR_COLUMN_OPTIONS"),
    indexOfOrThrow(panelSource, "const WIDTH_OPTIONS"),
  );
  expect(columnOptions.match(/IconColumns\]/g)?.length).toBe(5);
  expect(columnOptions).not.toContain("IconNumber");
  expect(columnOptions).toContain('"3 columnas (2 en móvil)"');
  expect(columnOptions).toContain('"4 columnas (3 en móvil)"');
  expect(columnOptions).toContain('"5 columnas (4 en móvil)"');
  expect(
    panelSource.match(/options=\{THREE_TO_FOUR_COLUMN_OPTIONS\}/g)?.length,
  ).toBe(2);
  expect(panelSource).toContain("options={COLOR_COLUMN_OPTIONS}");
});

test("uses designer-friendly language for select labels and options", () => {
  expect(panelSource).toContain('label="Distribución"');
  expect(panelSource).toContain('label="Ajuste de todas las imágenes"');
  expect(panelSource).toContain('label="Proporción de todas las imágenes"');
  expect(panelSource).toContain('label="Ajuste de imagen"');
  expect(panelSource).toContain('label="Proporción"');
  expect(panelSource).toContain('["cover", "Recortar para llenar", IconCrop]');
  expect(panelSource).toContain(
    '["contain", "Mostrar imagen completa", IconArrowsMinimize]',
  );
  expect(panelSource).toContain('["1/1", "Cuadrada · 1:1", IconCrop11]');
  expect(panelSource).not.toContain('label="Layout"');
  expect(panelSource).not.toContain('["cover", "Cover",');
  expect(panelSource).not.toContain('["stack", "Stack",');
});

test("binds all presentation padding controls to 0-25px sliders", () => {
  expect(panelSource).toContain("max={25}");
  expect(panelSource).toContain("min={0}");
  expect(panelSource).toContain("step={1}");
  expect(panelSource).toContain("value ?? 0");
  expect(panelSource.match(/<PaddingSlider/g)?.length).toBe(3);
  expect(panelSource).not.toContain("function NumberField");
});

test("binds the shared picker for backgrounds and color codes", () => {
  expect(panelSource).toContain(
    'import { VisualColorPicker } from "@/components/portal/visual-color-picker"',
  );
  expect(panelSource.match(/<ColorPickerField/g)?.length).toBe(4);
  expect(panelSource).toContain('format="hex"');
  expect(controlsSource).toContain(
    'from "@/components/portal/visual-color-picker"',
  );
  expect(controlsSource).not.toContain("function VisualColorPicker");
});

test("limits transparent background selection to image controls", () => {
  const imageFields = panelSource.slice(
    indexOfOrThrow(panelSource, "function ImageFields"),
    indexOfOrThrow(panelSource, "function ColorFields"),
  );
  const fileFields = panelSource.slice(
    indexOfOrThrow(panelSource, "function FileFields"),
    indexOfOrThrow(panelSource, "function FontFields"),
  );

  expect(imageFields).toContain("allowTransparency");
  expect(imageFields).toContain("backgroundTransparent");
  expect(fileFields).not.toContain("allowTransparency");
});

test("places the transparent-background action inside the color picker menu", () => {
  const popoverContent = colorPickerSource.slice(
    indexOfOrThrow(colorPickerSource, "<PopoverContent"),
    indexOfOrThrow(colorPickerSource, "</PopoverContent>"),
  );
  const picker = colorPickerSource.slice(
    indexOfOrThrow(colorPickerSource, "<ColorPicker"),
    indexOfOrThrow(colorPickerSource, "</ColorPicker>"),
  );

  expect(popoverContent).toContain("transparentBackground");
  expect(popoverContent).toContain(
    "onClick={() => onTransparencyChange?.(!transparent)}",
  );
  expect(picker).not.toContain("<Switch");
});

test("limits image and SVG file presentation controls to object fit, background color, and padding", () => {
  const fileFields = panelSource.slice(
    indexOfOrThrow(panelSource, "function FileFields"),
    indexOfOrThrow(panelSource, "function FontFields"),
  );
  const previewPresentation = panelSource.slice(
    indexOfOrThrow(panelSource, "function supportsFilePreviewPresentation"),
    indexOfOrThrow(panelSource, "function FileFields"),
  );

  expect(fileFields).toContain("supportsPreviewPresentation ?");
  expect(fileFields).toContain("supportsFilePreviewPresentation(item)");
  expect(previewPresentation).toContain("item.fileType !== undefined");
  expect(previewPresentation).toContain('item.fileType === "image"');
  expect(previewPresentation).toContain('item.fileType === "svg"');
  expect(
    indexOfOrThrow(previewPresentation, 'item.fileType === "image"'),
  ).toBeLessThan(indexOfOrThrow(previewPresentation, "/\\.(avif|gif"));
  expect(fileFields).toContain('label="Ajuste de imagen"');
  expect(fileFields).toContain("options={FIT_OPTIONS}");
  expect(fileFields).toContain('label="Color de fondo"');
  expect(fileFields).toContain(
    "onChange={(background) => onChange({ background })}",
  );
  expect(fileFields).toContain(
    '<PaddingSlider\n            label="Padding interno"',
  );
  expect(fileFields).toContain("onChange={(padding) => onChange({ padding })}");
  expect(fileFields).not.toContain('label="Proporción"');
  expect(fileFields).not.toContain("aspectRatio:");
  expect(fileFields).not.toContain("options={ASPECT_RATIO_OPTIONS}");
});

test("does not expose image presentation controls when an explicit PDF type has an image filename", () => {
  expect(
    supportsFilePreviewPresentation({
      fileName: "document.png",
      fileType: "pdf",
    }),
  ).toBe(false);
});

test("uses the filename extension when file type is absent", () => {
  expect(
    supportsFilePreviewPresentation({
      fileName: "document.png",
    }),
  ).toBe(true);
});

test("normalizes only the picker display value so sentinel colors persist", () => {
  expect(visualColorPickerValue("#aabbcc")).toBe("#aabbcc");
  expect(visualColorPickerValue("transparent")).toBe("#00000000");
  expect(visualColorPickerValue("secondary")).toBe("#FF0000");
});

test("renders item previews in naturally flowing content before their fields", () => {
  const panelContent = panelSource.slice(
    indexOfOrThrow(panelSource, 'className="p-4"'),
    indexOfOrThrow(panelSource, "function SwitchField"),
  );

  expect(panelContent).toContain(
    "<PanelItemPreview item={item} panel={panel} />",
  );
  expect(panelContent).toContain('className="w-full max-w-[200px]"');
  expect(panelContent).not.toContain('className="b-4');
  expect(indexOfOrThrow(panelContent, "<PanelItemPreview")).toBeLessThan(
    indexOfOrThrow(panelContent, "<FieldGroup>"),
  );
  expect(panelSource).not.toContain("overflow-y-auto");
  expect(panelSource).not.toContain('className="min-h-0 flex-1');
  expect(panelSource).toContain(
    'panel === "image" || panel === "color" || panel === "file"',
  );
  expect(panelSource).not.toContain('panel === "font" ||');
});

test("uses focused presentation helpers for the accessible image preview", () => {
  expect(panelSource).toContain(
    'import {\n  aspectClass,\n  fitClass,\n  presentationBackgroundStyle,\n  presentationPaddingStyle,\n} from "@/components/render/render-utils"',
  );
  expect(panelSource).toContain(
    'alt={image.alt || image.displayName || "Imagen"}',
  );
  expect(panelSource).toContain(
    'className={cn("size-full", fitClass(image.fit))}',
  );
  expect(panelSource).toContain(
    "presentationBackgroundStyle(\n            image.background,\n            image.backgroundTransparent",
  );
  expect(panelSource).toContain('"relative overflow-hidden"');
  expect(panelSource).toContain("aspectClass(image.aspectRatio)");
  expect(panelSource).not.toContain('className="aspect-[4/3] overflow-hidden"');
  expect(panelSource).toContain("src={image.src}");
  expect(panelSource).not.toContain('from "@/components/render/render-image"');
});

test("uses the same absolute padded image stage as the renderer preview", () => {
  const imagePreview = panelSource.slice(
    indexOfOrThrow(panelSource, 'if (panel === "image")'),
    indexOfOrThrow(panelSource, 'if (panel === "color")'),
  );

  expect(imagePreview).toContain('"relative overflow-hidden"');
  expect(imagePreview).toContain("aspectClass(image.aspectRatio)");
  expect(imagePreview).toContain('className="absolute inset-0"');
  expect(imagePreview).toContain(
    "style={presentationPaddingStyle(image.padding)}",
  );
  expect(imagePreview).not.toContain(
    "style={presentationStyle(image.background, image.padding)}",
  );
});

test("renders the literal color code beside its swatch", () => {
  expect(panelSource).toContain("style={{ backgroundColor: color.code }}");
  expect(panelSource).toContain("{color.code}");
});

test("reuses the renderer file-card leaf for the file preview", () => {
  expect(panelSource).toContain(
    'import { RenderFile } from "@/components/render/render-files"',
  );
  expect(panelSource).toContain('<RenderFile className="mb-4" file={file} />');
  expect(panelSource).not.toContain("PortalFilePreview");
  expect(panelSource).not.toContain("portalFileTypeFromName");
});
