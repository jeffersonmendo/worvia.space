"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RenderAction, RenderActionTools } from "./visual-model";

/**
 * Editor-only collection affordance. Its action is supplied by the consumer;
 * the renderer only supplies the visual tile and the generic picker tools.
 */
export function RenderCollectionAddTile({
  action,
  className,
  kind,
  tools,
}: {
  action?: RenderAction;
  className?: string;
  kind: "image" | "color" | "font" | "file";
  tools: RenderActionTools;
}) {
  if (!action) return null;
  const Icon = action.icon;
  return (
    <Button
      aria-label={action.label}
      className={cn(
        "flex min-h-32 w-full flex-col gap-2 rounded-xl border-border border-dashed text-muted-foreground hover:bg-transparent! hover:border-foreground/20",
        className,
      )}
      data-render-add-tile={kind}
      disabled={action.disabled || action.pending}
      onClick={(event) =>
        action.onClick?.({
          anchor: event.currentTarget,
          context: undefined,
          tools,
        })
      }
      type="button"
      variant="ghost"
    >
      <Icon aria-hidden data-icon="inline-start" />
      <span>{action.label}</span>
    </Button>
  );
}
