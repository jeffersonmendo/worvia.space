import {
  FileTypeIcon,
  fileTypeFromName,
  fileTypePreviewBackground,
} from "@/components/file-type-icon";
import { cn } from "@/lib/utils";
import { RenderActions } from "./render-actions";
import { RenderCollectionAddTile } from "./render-collection-add-tile";
import {
  RenderSortableCollection,
  RenderSortableItem,
} from "./render-sortable-collection";
import {
  aspectClass,
  fitClass,
  layoutClass,
  ordered,
  presentationStyle,
} from "./render-utils";
import type {
  RenderActions as RenderActionsData,
  RenderFileData,
  RenderLayout,
} from "./visual-model";

/** A domain-neutral file card. Portal-specific preview policy stays outside render. */
function RenderFilePreview({
  file,
  fit,
}: {
  file: RenderFileData;
  fit: RenderFileData["fit"];
}) {
  const type = file.fileType ?? fileTypeFromName(file.fileName);
  const image = type === "image" || type === "svg";
  return image ? (
    // biome-ignore lint/performance/noImgElement: renderer accepts arbitrary asset URLs.
    <img
      alt=""
      className={cn("w-full h-full rounded-2xl", fitClass(fit ?? "contain"))}
      data-render-file-preview="image"
      draggable={false}
      src={file.src}
    />
  ) : (
    <div
      className="flex aspect-square w-full items-center justify-center rounded-2xl text-muted-foreground"
      data-render-file-preview={type ?? "document"}
      style={{ backgroundColor: fileTypePreviewBackground(type) }}
    >
      <FileTypeIcon
        className="size-16!"
        fallback={{ file: type?.toUpperCase() ?? "FILE", image: "IMAGE" }}
        type={type ?? undefined}
      />
      <span className="sr-only">{file.fileName}</span>
    </div>
  );
}

export function RenderFile({
  actions,
  className,
  file,
  policy,
  tools,
  visibility,
  editable,
}: {
  actions?: RenderActionsData;
  className?: string;
  file: RenderFileData;
  policy?: import("./visual-model").RenderActionStyle;
  tools?: import("./visual-model").RenderActionTools;
  visibility?: "always" | "hover";
  editable?: boolean;
}) {
  const type = file.fileType ?? fileTypeFromName(file.fileName);
  const image = type === "image" || type === "svg";
  const aspectRatio = file.aspectRatio ?? "1/1";
  const fit = file.fit ?? "contain";
  return (
    <div
      className={cn(
        "group/item min-w-0 rounded-xl dark:bg-secondary/20 bg-secondary",
        editable && !file.visible && "opacity-40",
      )}
    >
      <div
        className={cn("relative flex min-w-0 flex-col rounded-2xl", className)}
      >
        <div className="p-2 w-full">
          <div
            className={cn(
              "flex w-full items-center justify-center rounded-lg",
              cn("h-full", aspectClass(aspectRatio)),
            )}
            style={
              image
                ? presentationStyle(file.background, file.padding)
                : undefined
            }
          >
            <RenderFilePreview file={file} fit={fit} />
          </div>
        </div>
        <span
          className="line-clamp-2 min-h-10 pb-1 px-2 text-balance min-w-0 w-full break-all text-center text-sm text-muted-foreground"
          title={file.fileName}
        >
          {file.fileName}
        </span>
        <RenderActions
          actions={actions}
          policy={policy}
          scope="item"
          tools={tools}
          visibility={visibility}
        />
      </div>
    </div>
  );
}

export function RenderFiles({
  actions,
  items,
  layout = {},
  tools,
  policy,
  visibility,
  editable,
  editorGridGaps: _editorGridGaps,
  addAction,
  sectionId,
}: {
  actions?: (file: RenderFileData) => RenderActionsData;
  items: RenderFileData[];
  layout?: RenderLayout;
  tools?: import("./visual-model").RenderActionTools;
  policy?: import("./visual-model").RenderActionStyle;
  visibility?: "always" | "hover";
  editable?: boolean;
  editorGridGaps?: boolean;
  addAction?: RenderActionsData[number];
  sectionId?: string;
}) {
  return (
    <RenderSortableCollection
      className={cn(layoutClass({ ...layout, columns: layout.columns ?? 3 }))}
      enabled={Boolean(editable)}
      kind="file"
      sectionId={sectionId}
      style={{ background: layout.background, padding: layout.padding }}
      tag="div"
    >
      {ordered(items).map((file, index) => (
        <RenderSortableItem
          enabled={Boolean(editable)}
          index={index}
          itemId={file.id}
          key={file.id}
          kind="file"
          sectionId={sectionId}
          tag="div"
        >
          <RenderFile
            actions={actions?.(file)}
            editable={editable}
            file={file}
            policy={policy}
            tools={tools}
            visibility={visibility}
          />
        </RenderSortableItem>
      ))}
      {editable && addAction ? (
        <RenderCollectionAddTile
          action={addAction}
          kind="file"
          tools={tools ?? { pickAssets() {} }}
        />
      ) : null}
    </RenderSortableCollection>
  );
}
