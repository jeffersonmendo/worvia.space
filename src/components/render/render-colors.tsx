import { cn } from "@/lib/utils";
import { RenderActions } from "./render-actions";
import { RenderCollectionAddTile } from "./render-collection-add-tile";
import {
  RenderSortableCollection,
  RenderSortableItem,
} from "./render-sortable-collection";
import { layoutClass, ordered } from "./render-utils";
import type {
  RenderActions as RenderActionsData,
  RenderColorData,
  RenderLayout,
} from "./visual-model";

export function RenderColors({
  actions,
  items,
  layout = {},
  tools,
  policy,
  visibility,
  editable,
  addAction,
  sectionId,
}: {
  actions?: (color: RenderColorData) => RenderActionsData;
  items: RenderColorData[];
  layout?: RenderLayout;
  tools?: import("./visual-model").RenderActionTools;
  policy?: import("./visual-model").RenderActionStyle;
  visibility?: "always" | "hover";
  editable?: boolean;
  addAction?: RenderActionsData[number];
  sectionId?: string;
}) {
  const stack = layout.mode === "stack";
  const showName = layout.showColorName ?? true;
  const showCode = layout.showColorCode ?? true;
  return (
    <RenderSortableCollection
      className={cn(
        layoutClass({ ...layout, columns: stack ? 1 : (layout.columns ?? 4) }),
        stack && "flex flex-col",
      )}
      enabled={Boolean(editable)}
      kind="color"
      sectionId={sectionId}
      style={{ background: layout.background, padding: layout.padding }}
      tag="div"
    >
      {ordered(items).map((color, index) => (
        <RenderSortableItem
          className={cn(
            "relative flex flex-col gap-1",
            stack && "flex-row items-center gap-3",
            editable && !color.visible && "opacity-40",
          )}
          enabled={Boolean(editable)}
          index={index}
          itemId={color.id}
          key={color.id}
          kind="color"
          sectionId={sectionId}
          tag="div"
        >
          <div
            className={cn(
              "aspect-square flex-col flex rounded-lg border",
              stack ? "size-14 shrink-0" : "w-full",
            )}
            style={{ backgroundColor: color.code }}
          />
          <div className="flex flex-col gap-1">
            {showName ? (
              <span className="truncate text-sm font-medium">{color.name}</span>
            ) : null}
            {showCode ? (
              <span className="truncate text-muted-foreground text-sm">
                {color.code}
              </span>
            ) : null}
          </div>
          <RenderActions
            actions={actions?.(color)}
            policy={policy}
            scope="item"
            tools={tools}
            visibility={visibility}
          />
        </RenderSortableItem>
      ))}
      {editable && addAction ? (
        <RenderCollectionAddTile
          action={addAction}
          kind="color"
          tools={tools ?? { pickAssets() {} }}
        />
      ) : null}
    </RenderSortableCollection>
  );
}
