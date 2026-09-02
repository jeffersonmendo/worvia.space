"use client";

import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconAspectRatio,
  IconColumns,
  IconColumns2,
  IconContainer,
  IconCrop,
  IconCrop11,
  IconCrop169,
  IconLayoutDistributeHorizontal,
  IconLayoutGrid,
  IconMaximize,
  IconPalette,
  IconPanoramaHorizontal,
  IconPhoto,
  IconRectangle,
  IconStack,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { VisualColorPicker } from "@/components/portal/visual-color-picker";
import { RenderFile } from "@/components/render/render-files";
import {
  aspectClass,
  fitClass,
  presentationBackgroundStyle,
  presentationPaddingStyle,
} from "@/components/render/render-utils";
import type {
  RenderColorData,
  RenderFileData,
  RenderFontData,
  RenderImageData,
  RenderLayout,
  RenderSectionData,
} from "@/components/render/visual-model";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type PanelConfigKind =
  | "section-gallery"
  | "section-image"
  | "section-colors"
  | "section-files"
  | "section-fonts"
  | "section-text"
  | "image"
  | "color"
  | "file"
  | "font";

export function getPanelConfigCopy(panel: PanelConfigKind) {
  const title = {
    "section-gallery": "Configurar galería",
    "section-image": "Configurar sección de imagen",
    "section-colors": "Configurar colores",
    "section-files": "Configurar archivos",
    "section-fonts": "Configurar fuentes",
    "section-text": "Configurar sección",
    image: "Configurar imagen",
    color: "Configurar color",
    file: "Configurar archivo",
    font: "Configurar fuente",
  }[panel];
  return {
    description: panel.startsWith("section-")
      ? "Ajusta las opciones de esta sección."
      : "Ajusta las opciones de este elemento.",
    title,
  };
}

type PanelItem =
  | RenderImageData
  | RenderColorData
  | RenderFileData
  | RenderFontData;

export function createPanelDeleteConfirmation(
  onDelete: () => void,
  setOpen: (open: boolean) => void,
) {
  return {
    cancel: () => setOpen(false),
    confirm: () => {
      setOpen(false);
      onDelete();
    },
  };
}

type SelectOption = readonly [value: string, name: string, icon: typeof IconX];

const THREE_TO_FOUR_COLUMN_OPTIONS = [
  ["3", "3 columnas (2 en móvil)", IconColumns],
  ["4", "4 columnas (3 en móvil)", IconColumns],
] satisfies readonly SelectOption[];

const COLOR_COLUMN_OPTIONS = [
  ["3", "3 columnas (2 en móvil)", IconColumns],
  ["4", "4 columnas (3 en móvil)", IconColumns],
  ["5", "5 columnas (4 en móvil)", IconColumns],
] satisfies readonly SelectOption[];

const WIDTH_OPTIONS = [
  ["container", "Contenido centrado", IconContainer],
  ["wide", "Ancho ampliado", IconLayoutDistributeHorizontal],
  ["full", "Ancho completo", IconMaximize],
] satisfies readonly SelectOption[];

const GALLERY_LAYOUT_OPTIONS = [
  ["grid", "Cuadrícula", IconLayoutGrid],
  ["comparison", "Comparar lado a lado", IconColumns2],
] satisfies readonly SelectOption[];

const COLOR_LAYOUT_OPTIONS = [
  ["palette", "Paleta", IconPalette],
  ["stack", "Lista vertical", IconStack],
] satisfies readonly SelectOption[];

const FIT_OPTIONS = [
  ["cover", "Recortar para llenar", IconCrop],
  ["contain", "Mostrar imagen completa", IconArrowsMinimize],
  ["fill", "Estirar para llenar", IconArrowsMaximize],
  ["auto", "Automático", IconPhoto],
] satisfies readonly SelectOption[];

const ASPECT_RATIO_OPTIONS = [
  ["auto", "Proporción original", IconAspectRatio],
  ["1/1", "Cuadrada · 1:1", IconCrop11],
  ["4/3", "Horizontal · 4:3", IconRectangle],
  ["16/9", "Panorámica · 16:9", IconCrop169],
  ["21/9", "Ultrapanorámica · 21:9", IconPanoramaHorizontal],
] satisfies readonly SelectOption[];

export function PanelConfig({
  className,
  item,
  onChange,
  onClose,
  onDelete,
  panel,
  presentation = "sidebar",
  section,
}: {
  className?: string;
  item?: PanelItem;
  onChange: (change: {
    item?: Partial<PanelItem>;
    layout?: Partial<RenderLayout>;
    section?: Partial<Pick<RenderSectionData, "visible">>;
  }) => void;
  onClose: () => void;
  onDelete: () => void;
  panel: PanelConfigKind;
  presentation?: "drawer" | "sidebar";
  section: RenderSectionData;
}) {
  const [isDeleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const isSection = panel.startsWith("section-");
  const { description, title } = getPanelConfigCopy(panel);
  const updateLayout = (layout: Partial<RenderLayout>) => onChange({ layout });
  const updateItem = (item: Partial<PanelItem>) => onChange({ item });
  const currentLayout = section.layout ?? {};
  const previewablePanel =
    panel === "image" || panel === "color" || panel === "file";
  const deleteConfirmation = createPanelDeleteConfirmation(
    onDelete,
    setDeleteConfirmationOpen,
  );
  const deleteLabel = isSection
    ? "Eliminar sección"
    : `Eliminar ${panel === "image" ? "imagen" : panel === "color" ? "color" : panel === "file" ? "archivo" : "fuente"}`;

  return (
    <aside
      aria-label={title}
      className={cn(
        "flex w-full flex-col",
        className ?? (presentation === "drawer" ? "h-fit" : "h-full"),
      )}
    >
      {presentation === "sidebar" ? (
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm">{title}</h2>
            <p className="text-muted-foreground text-xs">{description}</p>
          </div>
          <Button
            aria-label="Cerrar configuración"
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <IconX />
          </Button>
        </header>
      ) : null}
      <div className="p-4">
        {previewablePanel && item ? (
          <div className="flex items-center justify-center">
            <div className="w-full max-w-[200px]">
              <PanelItemPreview item={item} panel={panel} />
            </div>
          </div>
        ) : null}
        <FieldGroup>
          {panel === "section-gallery" ? (
            <GallerySectionFields
              layout={currentLayout}
              onChange={updateLayout}
            />
          ) : null}
          {panel === "section-colors" ? (
            <ColorSectionFields
              layout={currentLayout}
              onChange={updateLayout}
            />
          ) : null}
          {panel === "section-files" ? (
            <ColumnsField
              columns={currentLayout.columns}
              defaultColumns={3}
              onChange={(columns) => updateLayout({ columns })}
              options={THREE_TO_FOUR_COLUMN_OPTIONS}
            />
          ) : null}
          {panel === "section-image" || panel === "section-fonts" ? (
            <WidthField
              value={currentLayout.width}
              onChange={(width) => updateLayout({ width })}
            />
          ) : null}
          {panel === "image" && item ? (
            <ImageFields item={item as RenderImageData} onChange={updateItem} />
          ) : null}
          {panel === "color" && item ? (
            <ColorFields item={item as RenderColorData} onChange={updateItem} />
          ) : null}
          {panel === "file" && item ? (
            <FileFields item={item as RenderFileData} onChange={updateItem} />
          ) : null}
          {panel === "font" && item ? (
            <FontFields item={item as RenderFontData} onChange={updateItem} />
          ) : null}
          {isSection ? (
            <SwitchField
              checked={section.visible}
              label="Mostrar sección"
              onCheckedChange={(visible) => onChange({ section: { visible } })}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onClose} type="button" variant="outline">
              Cerrar
            </Button>
            <Button
              onClick={() => setDeleteConfirmationOpen(true)}
              type="button"
              variant="destructive"
            >
              {deleteLabel}
            </Button>
          </div>
        </FieldGroup>
      </div>
      <AlertDialog
        onOpenChange={setDeleteConfirmationOpen}
        open={isDeleteConfirmationOpen}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{`${deleteLabel}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={deleteConfirmation.cancel}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteConfirmation.confirm}
              type="button"
              variant="destructive"
            >
              {deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function PanelItemPreview({
  item,
  panel,
}: {
  item: PanelItem;
  panel: "image" | "color" | "file";
}) {
  if (panel === "image") {
    const image = item as RenderImageData;
    return (
      <div className="mb-4 overflow-hidden rounded-xl border bg-card">
        <div
          className={cn(
            "relative overflow-hidden",
            aspectClass(image.aspectRatio),
          )}
          style={presentationBackgroundStyle(
            image.background,
            image.backgroundTransparent,
          )}
        >
          <div
            className="absolute inset-0"
            style={presentationPaddingStyle(image.padding)}
          >
            {/* biome-ignore lint/performance/noImgElement: previewing the selected user image. */}
            <img
              alt={image.alt || image.displayName || "Imagen"}
              className={cn("size-full", fitClass(image.fit))}
              src={image.src}
            />
          </div>
        </div>
      </div>
    );
  }

  if (panel === "color") {
    const color = item as RenderColorData;
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border bg-card p-3">
        <div
          className="size-12 shrink-0 rounded-lg border"
          style={{ backgroundColor: color.code }}
        />
        <p className="font-mono text-sm">{color.code}</p>
      </div>
    );
  }

  const file = item as RenderFileData;
  return <RenderFile className="mb-4" file={file} />;
}

function SwitchField({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel>{label}</FieldLabel>
      </FieldContent>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  );
}
function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={`Ingresa ${label.toLowerCase()}`}
        value={value ?? ""}
      />
    </Field>
  );
}
function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  value?: string;
}) {
  const selectItems = options.map(([value, name, Icon]) => ({
    label: (
      <>
        <Icon aria-hidden />
        <span>{name}</span>
      </>
    ),
    value,
  }));

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={selectItems}
        onValueChange={(next) => next && onChange(next)}
        value={value ?? options[0][0]}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Selecciona ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([value, name, Icon]) => (
              <SelectItem key={value} value={value}>
                <Icon aria-hidden />
                <span>{name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
function PaddingSlider({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value?: number;
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-muted-foreground text-sm">{`${value ?? 0}px`}</span>
      </div>
      <Slider
        max={25}
        min={0}
        onValueChange={(next) =>
          onChange(Array.isArray(next) ? (next[0] ?? 0) : next)
        }
        step={1}
        value={[Math.max(0, Math.min(25, value ?? 0))]}
      />
    </Field>
  );
}
function ColorPickerField({
  allowTransparency = false,
  label,
  onChange,
  onTransparentChange,
  transparent = false,
  value,
}: {
  allowTransparency?: boolean;
  label: string;
  onChange: (value: string) => void;
  onTransparentChange?: (transparent: boolean) => void;
  transparent?: boolean;
  value: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <VisualColorPicker
        allowTransparency={allowTransparency}
        format="hex"
        onChange={onChange}
        onTransparencyChange={onTransparentChange}
        transparent={transparent}
        value={value}
      />
    </Field>
  );
}
function ColumnsField({
  columns,
  defaultColumns,
  onChange,
  options,
}: {
  columns?: number;
  defaultColumns: 3 | 4;
  onChange: (columns: 1 | 2 | 3 | 4 | 5 | 6) => void;
  options: readonly SelectOption[];
}) {
  const value = String(columns ?? defaultColumns);

  return (
    <SelectField
      label="Número de columnas"
      onChange={(value) => onChange(Number(value) as 1 | 2 | 3 | 4 | 5 | 6)}
      options={options}
      value={
        options.some(([optionValue]) => optionValue === value)
          ? value
          : String(defaultColumns)
      }
    />
  );
}
function WidthField({
  onChange,
  value,
}: {
  onChange: (width: "container" | "wide" | "full") => void;
  value?: string;
}) {
  return (
    <SelectField
      label="Ancho de la sección"
      onChange={(value) => onChange(value as "container" | "wide" | "full")}
      options={WIDTH_OPTIONS}
      value={value}
    />
  );
}
function GallerySectionFields({
  layout,
  onChange,
}: {
  layout: RenderLayout;
  onChange: (change: Partial<RenderLayout>) => void;
}) {
  return (
    <>
      <SelectField
        label="Distribución"
        onChange={(mode) =>
          onChange({
            mode: mode as RenderLayout["mode"],
            columns: mode === "comparison" ? 2 : (layout.columns ?? 3),
          })
        }
        options={GALLERY_LAYOUT_OPTIONS}
        value={layout.mode === "comparison" ? "comparison" : "grid"}
      />
      {layout.mode !== "comparison" ? (
        <ColumnsField
          columns={layout.columns}
          defaultColumns={3}
          onChange={(columns) => onChange({ columns })}
          options={THREE_TO_FOUR_COLUMN_OPTIONS}
        />
      ) : null}
      <SelectField
        label="Ajuste de todas las imágenes"
        onChange={(imageFit) =>
          onChange({ imageFit: imageFit as RenderLayout["imageFit"] })
        }
        options={FIT_OPTIONS}
        value={layout.imageFit}
      />
      <SelectField
        label="Proporción de todas las imágenes"
        onChange={(imageAspectRatio) =>
          onChange({
            imageAspectRatio:
              imageAspectRatio as RenderLayout["imageAspectRatio"],
          })
        }
        options={ASPECT_RATIO_OPTIONS}
        value={layout.imageAspectRatio}
      />
      <PaddingSlider
        label="Padding global"
        onChange={(imageContainerPadding) =>
          onChange({ imageContainerPadding })
        }
        value={layout.imageContainerPadding}
      />
      <ColorPickerField
        label="Fondo global"
        onChange={(imageBackgroundColor) => onChange({ imageBackgroundColor })}
        value={layout.imageBackgroundColor ?? "transparent"}
      />
    </>
  );
}
function ColorSectionFields({
  layout,
  onChange,
}: {
  layout: RenderLayout;
  onChange: (change: Partial<RenderLayout>) => void;
}) {
  return (
    <>
      <SelectField
        label="Distribución"
        onChange={(mode) => onChange({ mode: mode as RenderLayout["mode"] })}
        options={COLOR_LAYOUT_OPTIONS}
        value={layout.mode}
      />
      <ColumnsField
        columns={layout.columns}
        defaultColumns={4}
        onChange={(columns) => onChange({ columns })}
        options={COLOR_COLUMN_OPTIONS}
      />
      <SwitchField
        checked={layout.showColorName ?? true}
        label="Mostrar nombre"
        onCheckedChange={(showColorName) => onChange({ showColorName })}
      />
      <SwitchField
        checked={layout.showColorCode ?? true}
        label="Mostrar código"
        onCheckedChange={(showColorCode) => onChange({ showColorCode })}
      />
    </>
  );
}
function ImageFields({
  item,
  onChange,
}: {
  item: RenderImageData;
  onChange: (change: Partial<PanelItem>) => void;
}) {
  return (
    <>
      <TextField
        label="Nombre visible"
        onChange={(displayName) => onChange({ displayName })}
        value={item.displayName}
      />
      <TextField
        label="Nombre de descarga"
        onChange={(downloadName) => onChange({ downloadName })}
        value={item.downloadName}
      />
      <TextField
        label="Texto alternativo"
        onChange={(alt) => onChange({ alt })}
        value={item.alt}
      />
      <SelectField
        label="Ajuste de imagen"
        onChange={(fit) => onChange({ fit: fit as RenderImageData["fit"] })}
        options={FIT_OPTIONS}
        value={item.fit}
      />
      <SelectField
        label="Proporción"
        onChange={(aspectRatio) =>
          onChange({
            aspectRatio: aspectRatio as RenderImageData["aspectRatio"],
          })
        }
        options={ASPECT_RATIO_OPTIONS}
        value={item.aspectRatio}
      />
      <PaddingSlider
        label="Padding interno"
        onChange={(padding) => onChange({ padding })}
        value={item.padding}
      />
      <ColorPickerField
        allowTransparency
        label="Color de fondo"
        onChange={(background) =>
          onChange({ background, backgroundTransparent: false })
        }
        onTransparentChange={(backgroundTransparent) =>
          onChange({ backgroundTransparent })
        }
        transparent={item.backgroundTransparent ?? false}
        value={item.background ?? "secondary"}
      />
      <SwitchField
        checked={item.visible}
        label="Mostrar imagen"
        onCheckedChange={(visible) => onChange({ visible })}
      />
      <SwitchField
        checked={item.allowDownload ?? true}
        label="Permitir descarga"
        onCheckedChange={(allowDownload) => onChange({ allowDownload })}
      />
    </>
  );
}
function ColorFields({
  item,
  onChange,
}: {
  item: RenderColorData;
  onChange: (change: Partial<PanelItem>) => void;
}) {
  return (
    <>
      <TextField
        label="Nombre"
        onChange={(name) => onChange({ name })}
        value={item.name}
      />
      <ColorPickerField
        label="Código"
        onChange={(code) => onChange({ code })}
        value={item.code}
      />
      <SwitchField
        checked={item.visible}
        label="Mostrar color"
        onCheckedChange={(visible) => onChange({ visible })}
      />
    </>
  );
}

export function supportsFilePreviewPresentation(
  item: Pick<RenderFileData, "fileName" | "fileType">,
) {
  if (item.fileType !== undefined) {
    return item.fileType === "image" || item.fileType === "svg";
  }

  return /\.(avif|gif|jpe?g|png|svg|tiff?|webp)$/i.test(item.fileName);
}

function FileFields({
  item,
  onChange,
}: {
  item: RenderFileData;
  onChange: (change: Partial<PanelItem>) => void;
}) {
  const supportsPreviewPresentation = supportsFilePreviewPresentation(item);
  return (
    <>
      <TextField
        label="Nombre visible"
        onChange={(fileName) => onChange({ fileName })}
        value={item.fileName}
      />
      <TextField
        label="Nombre de descarga"
        onChange={(downloadName) => onChange({ downloadName })}
        value={item.downloadName}
      />
      <TextField
        label="Descripción"
        onChange={(description) => onChange({ description })}
        value={item.description}
      />
      {supportsPreviewPresentation ? (
        <>
          <SelectField
            label="Ajuste de imagen"
            onChange={(fit) => onChange({ fit: fit as RenderFileData["fit"] })}
            options={FIT_OPTIONS}
            value={item.fit}
          />
          <ColorPickerField
            label="Color de fondo"
            onChange={(background) => onChange({ background })}
            value={item.background ?? "transparent"}
          />
          <PaddingSlider
            label="Padding interno"
            onChange={(padding) => onChange({ padding })}
            value={item.padding}
          />
        </>
      ) : null}
      <SwitchField
        checked={item.visible}
        label="Mostrar archivo"
        onCheckedChange={(visible) => onChange({ visible })}
      />
      <SwitchField
        checked={item.allowDownload ?? true}
        label="Permitir descarga"
        onCheckedChange={(allowDownload) => onChange({ allowDownload })}
      />
    </>
  );
}
function FontFields({
  item,
  onChange,
}: {
  item: RenderFontData;
  onChange: (change: Partial<PanelItem>) => void;
}) {
  return (
    <>
      <TextField
        label="Nombre visible"
        onChange={(name) => onChange({ name })}
        value={item.name}
      />
      <TextField
        label="Nombre de descarga"
        onChange={(downloadName) => onChange({ downloadName })}
        value={item.downloadName}
      />
      <TextField
        label="Familia"
        onChange={(family) => onChange({ family })}
        value={item.family}
      />
      <TextField
        label="Texto de muestra"
        onChange={(sample) => onChange({ sample })}
        value={item.sample}
      />
      <SwitchField
        checked={item.visible}
        label="Mostrar fuente"
        onCheckedChange={(visible) => onChange({ visible })}
      />
    </>
  );
}
