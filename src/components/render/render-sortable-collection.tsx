"use client";

import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RenderSortableKind = "image" | "color" | "file";

function sortableType(kind: RenderSortableKind, sectionId: string) {
  return kind === "image"
    ? "render-gallery-image"
    : `render-${kind}:${sectionId}`;
}

type CollectionElementProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  tag: "div" | "ul";
};

function CollectionElement({
  children,
  className,
  style,
  tag: Component,
}: CollectionElementProps) {
  return (
    <Component className={className} style={style}>
      {children}
    </Component>
  );
}

function EnabledSortableCollection({
  children,
  className,
  kind,
  sectionId,
  style,
  tag: Component,
}: CollectionElementProps & {
  kind: RenderSortableKind;
  sectionId: string;
}) {
  const { isDropTarget, ref } = useDroppable({
    accept: sortableType(kind, sectionId),
    collisionPriority: CollisionPriority.Low,
    id: sectionId,
    type: "render-collection",
  });

  return (
    <Component
      className={cn(className, isDropTarget && "ring-2 ring-primary")}
      data-render-sortable-collection={kind}
      ref={ref}
      style={style}
    >
      {children}
    </Component>
  );
}

export function RenderSortableCollection({
  enabled,
  kind,
  sectionId,
  ...props
}: CollectionElementProps & {
  enabled: boolean;
  kind: RenderSortableKind;
  sectionId?: string;
}) {
  return enabled && sectionId ? (
    <EnabledSortableCollection {...props} kind={kind} sectionId={sectionId} />
  ) : (
    <CollectionElement {...props} />
  );
}

function EnabledSortableItem({
  children,
  className,
  index,
  itemId,
  kind,
  sectionId,
  tag: Component,
}: {
  children: ReactNode;
  className?: string;
  index: number;
  itemId: string;
  kind: RenderSortableKind;
  sectionId: string;
  tag: "div" | "li";
}) {
  const { isDragging, ref } = useSortable({
    accept: sortableType(kind, sectionId),
    data: { itemId, kind },
    group: sectionId,
    id: `render-item:${kind}:${itemId}`,
    index,
    type: sortableType(kind, sectionId),
  });

  return (
    <Component
      className={cn("group/item", className, isDragging && "opacity-50")}
      data-render-sortable-item={kind}
      ref={ref}
    >
      {children}
    </Component>
  );
}

export function RenderSortableItem({
  enabled,
  ...props
}: {
  children: ReactNode;
  className?: string;
  enabled: boolean;
  index: number;
  itemId: string;
  kind: RenderSortableKind;
  sectionId?: string;
  tag: "div" | "li";
}) {
  if (enabled && props.sectionId) {
    return <EnabledSortableItem {...props} sectionId={props.sectionId} />;
  }

  const Component = props.tag;
  return (
    <Component className={cn("group/item", props.className)}>
      {props.children}
    </Component>
  );
}
