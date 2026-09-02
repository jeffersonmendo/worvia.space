"use client";

import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RenderActions } from "./render-actions";
import {
  aspectClass,
  fitClass,
  presentationBackgroundStyle,
  presentationPaddingStyle,
  presentationStyle,
} from "./render-utils";
import type {
  RenderActions as RenderActionsData,
  RenderImageData,
  RenderLayout,
} from "./visual-model";

export function RenderImage({
  actions,
  editable,
  image,
  onDescriptionChange,
  tools,
  policy,
  previewable = true,
  showDescription = false,
  visibility,
  layout,
}: {
  actions?: RenderActionsData;
  tools?: import("./visual-model").RenderActionTools;
  policy?: import("./visual-model").RenderActionStyle;
  /** Image lightbox is a view affordance; editor clicks must not open it. */
  previewable?: boolean;
  /** Enables the optional image description outside comparison layouts. */
  showDescription?: boolean;
  visibility?: "always" | "hover";
  image: RenderImageData;
  editable?: boolean;
  onDescriptionChange?: (description: string) => void;
  layout?: RenderLayout;
}) {
  if (!image.visible || !image.src.trim()) return null;
  const label = image.displayName || image.alt || "image";
  const imageElement = (
    // biome-ignore lint/performance/noImgElement: visual renderer accepts arbitrary asset URLs.
    <img
      alt={label}
      className={cn("size-full", fitClass(image.fit))}
      draggable={false}
      src={image.src}
    />
  );
  const media = (
    <div
      className={cn(
        "relative overflow-hidden border-border/50 border rounded-xl bg-muted",
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
        {previewable ? (
          <DialogTrigger
            render={
              <button
                aria-label={`Open ${label}`}
                className="block size-full cursor-zoom-in text-left"
                type="button"
              />
            }
          >
            {imageElement}
          </DialogTrigger>
        ) : (
          imageElement
        )}
      </div>
      <RenderActions
        actions={actions}
        policy={policy}
        scope="item"
        tools={tools}
        visibility={visibility}
      />
    </div>
  );

  return (
    <figure
      className="group/item relative flex flex-col gap-2"
      style={{ order: image.position }}
    >
      {previewable ? (
        <Dialog>
          {media}
          <DialogContent
            className="max-w-[min(96vw,1200px)] gap-4 p-2"
            showCloseButton={false}
          >
            <DialogHeader className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
              <span aria-hidden="true" />
              <DialogTitle
                className={cn(
                  "truncate text-center",
                  !image.displayName && "sr-only",
                )}
              >
                {image.displayName || label}
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    aria-label="Close"
                    className="justify-self-end"
                    size="icon"
                    variant="ghost"
                  />
                }
              >
                <IconX />
              </DialogClose>
            </DialogHeader>
            <DialogDescription className="sr-only">
              Full-size image preview
            </DialogDescription>
            <div
              className="flex border-border/50 border max-h-[78vh] min-h-[40vh] items-center justify-center overflow-auto rounded-lg"
              style={presentationStyle(
                image.background,
                image.padding,
                image.backgroundTransparent,
              )}
            >
              {/* biome-ignore lint/performance/noImgElement: visual renderer accepts arbitrary asset URLs. */}
              <img
                alt={label}
                className="block max-h-[74vh] max-w-full object-contain"
                draggable={false}
                src={image.src}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        media
      )}

      {layout?.mode === "comparison" || showDescription ? (
        editable ? (
          <Textarea
            aria-label="Image description"
            className="resize-none border-none bg-transparent! px-0 text-balance text-muted-foreground text-sm shadow-none outline-none focus-visible:ring-0"
            maxLength={380}
            onChange={(event) =>
              onDescriptionChange?.(event.currentTarget.value)
            }
            placeholder="Description"
            value={image.alt}
          />
        ) : image.alt ? (
          <figcaption className="text-muted-foreground text-balance text-sm">
            {image.alt}
          </figcaption>
        ) : null
      ) : null}
    </figure>
  );
}
