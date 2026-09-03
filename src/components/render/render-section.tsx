"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RenderActions } from "./render-actions";
import type {
  RenderActions as RenderActionsData,
  RenderLayout,
  RenderSectionChange,
} from "./visual-model";

export function RenderSection({
  actions,
  actionTools,
  actionPolicy,
  actionVisibility,
  children,
  draggable,
  onDragOver,
  onDragStart,
  onDrop,
  description = "",
  editable = false,
  header,
  id,
  inactive = false,
  layout,
  onChange,
  sectionRef,
  title = "",
}: {
  actions?: RenderActionsData;
  actionTools?: import("./visual-model").RenderActionTools;
  actionPolicy?: import("./visual-model").RenderActionStyle;
  actionVisibility?: "always" | "hover";
  children?: React.ReactNode;
  draggable?: boolean;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDragStart?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  description?: string;
  editable?: boolean;
  header?: React.ReactNode;
  id: string;
  inactive?: boolean;
  layout?: RenderLayout;
  onChange?: (change: RenderSectionChange) => void;
  sectionRef?: React.Ref<HTMLElement>;
  title?: string;
}) {
  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: editor-only native drag-and-drop target. */}
      <section
        className={cn(
          "group/section relative flex flex-col gap-4",
          inactive && "opacity-40",
          layout?.align === "center" && "text-center",
          layout?.align === "right" && "text-right",
        )}
        data-section-id={id}
        draggable={draggable}
        role={draggable ? "region" : undefined}
        tabIndex={draggable ? 0 : undefined}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        onDrop={onDrop}
        id={id}
        ref={sectionRef}
      >
        <header className="relative flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            {editable ? (
              <Textarea
                aria-label="Section title"
                className="min-w-0 flex-1 bg-transparent! text-balance rounded-none! border-0 p-0! ring-0 focus-visible:ring-0! text-base! resize-none placeholder:bg-none!"
                data-portal-editor-field
                rows={10}
                maxLength={80}
                data-portal-section-title
                name="title"
                placeholder="Enter title"
                onChange={(event) =>
                  onChange?.({ field: "title", value: event.target.value })
                }
                value={title}
              />
            ) : (
              <h2 className="min-w-0 text-start flex-1 text-lg text-balance">
                {title}
              </h2>
            )}
            <div className="flex shrink-0 items-center gap-1">
              <RenderActions
                actions={actions}
                layout="inline"
                policy={actionPolicy}
                scope="section"
                tools={actionTools}
                visibility={actionVisibility}
              />
              {header}
            </div>
          </div>
          {editable ? (
            <Textarea
              className="bg-transparent! text-balance rounded-none! border-0 p-0! ring-0 focus-visible:ring-0! text-sm! text-muted-foreground resize-none placeholder:bg-none!"
              data-portal-editor-field
              data-portal-section-description
              maxLength={250}
              placeholder="Enter description"
              name="description"
              onChange={(event) =>
                onChange?.({ field: "description", value: event.target.value })
              }
              value={description}
            />
          ) : description ? (
            <p className="text-muted-foreground text-start text-balance text-sm!">
              {description}
            </p>
          ) : null}
        </header>
        {children}
      </section>
    </>
  );
}
