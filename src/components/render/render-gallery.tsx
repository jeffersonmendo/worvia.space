"use client";

import { cn } from "@/lib/utils";
import { RenderCollectionAddTile } from "./render-collection-add-tile";
import { RenderImage } from "./render-image";
import {
  RenderSortableCollection,
  RenderSortableItem,
} from "./render-sortable-collection";
import { layoutClass, ordered } from "./render-utils";
import type {
  RenderActions as RenderActionsData,
  RenderImageData,
  RenderLayout,
} from "./visual-model";

export function RenderGallery({
  actions,
  items,
  layout = {},
  tools,
  policy,
  previewable = true,
  visibility,
  editable,
  addAction,
  onItemDescriptionChange,
  sectionId,
}: {
  actions?: (image: RenderImageData) => RenderActionsData;
  items: RenderImageData[];
  layout?: RenderLayout;
  tools?: import("./visual-model").RenderActionTools;
  policy?: import("./visual-model").RenderActionStyle;
  previewable?: boolean;
  visibility?: "always" | "hover";
  editable?: boolean;
  addAction?: RenderActionsData[number];
  onItemDescriptionChange?: (itemId: string, description: string) => void;
  sectionId?: string;
}) {
  const comparison = layout.mode === "comparison";
  return (
    <RenderSortableCollection
      className={cn(
        layoutClass({
          ...layout,
          columns: comparison ? 2 : (layout.columns ?? 3),
        }),
        "items-start",
      )}
      enabled={Boolean(editable)}
      kind="image"
      sectionId={sectionId}
      style={{ background: layout.background, padding: layout.padding }}
      tag="ul"
    >
      {ordered(items).map((image, index) => (
        <RenderSortableItem
          className="h-fit self-start"
          enabled={Boolean(editable)}
          index={index}
          itemId={image.id}
          key={image.id}
          kind="image"
          sectionId={sectionId}
          tag="li"
        >
          <RenderImage
            editable={editable}
            actions={actions?.(image)}
            image={{
              ...image,
            }}
            layout={layout}
            onDescriptionChange={(description) =>
              onItemDescriptionChange?.(image.id, description)
            }
            tools={tools}
            policy={policy}
            previewable={previewable}
            visibility={visibility}
          />
        </RenderSortableItem>
      ))}
      {editable && addAction ? (
        <li key="render-add-image-tile">
          <RenderCollectionAddTile
            action={addAction}
            kind="image"
            tools={tools ?? { pickAssets() {} }}
          />
        </li>
      ) : null}
    </RenderSortableCollection>
  );
}
