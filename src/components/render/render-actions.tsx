"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderActionVisibilityClass } from "./render-action-visibility";
import type {
  RenderActions as RenderActionsData,
  RenderActionTools,
} from "./visual-model";
export function RenderActions({
  actions,
  context,
  tools,
  policy,
  scope = "item",
  visibility = "always",
  layout = "overlay",
  className,
}: {
  actions?: RenderActionsData;
  context?: unknown;
  tools?: RenderActionTools;
  policy?: import("./visual-model").RenderActionStyle;
  scope?: "item" | "section";
  visibility?: "always" | "hover";
  layout?: "inline" | "overlay";
  className?: string;
}) {
  if (!actions?.length) return null;
  const resolvedVisibility = policy?.visibility ?? visibility;
  const position = policy?.position ?? "top-right";
  const positionClass = {
    "top-right": "top-2.5 right-2.5",
    "top-left": "top-2.5 left-2.5",
    "bottom-right": "bottom-2.5 right-2.5",
    "bottom-left": "bottom-2.5 left-2.5",
  }[position];
  const radius = policy?.radius ?? "rounded-full text-muted-foreground!";
  const variant = policy?.variant ?? "ghost";
  return (
    <div
      className={cn(
        "flex shrink-0 gap-2",
        layout === "overlay" && "absolute",
        layout === "overlay" && positionClass,
        renderActionVisibilityClass(
          resolvedVisibility === "always" ? "always" : scope,
          "project",
        ),
      )}
      data-layout={layout}
      data-render-actions
      data-position={position}
      data-radius={radius}
      data-variant={variant}
      data-visibility={resolvedVisibility}
    >
      {actions.map(({ attributes, icon: Icon, ...action }) =>
        action.href ? (
          <Button
            aria-label={action.label}
            {...attributes}
            className={cn(
              radius,
              {
                "opacity-50": action.disabled || action.pending,
                "bg-secondary/90! hover:bg-secondary/90!":
                  variant === "outline",
              },

              className,
            )}
            disabled={action.disabled || action.pending}
            key={action.id}
            nativeButton={false}
            render={
              <a download={action.download} href={action.href}>
                <Icon aria-hidden className="size-3.5" />
              </a>
            }
            size="icon-sm"
            variant={variant}
          />
        ) : (
          <Button
            aria-label={action.label}
            {...attributes}
            className={cn(
              radius,
              {
                "opacity-50": action.disabled || action.pending,
                "bg-secondary/90! hover:bg-secondary/90!":
                  variant === "outline",
              },

              className,
            )}
            disabled={action.disabled || action.pending}
            key={action.id}
            onClick={(event) =>
              action.onClick?.({
                context,
                anchor: event.currentTarget,
                tools: tools ?? { pickAssets() {} },
              })
            }
            size="icon-sm"
            type="button"
            variant={variant}
          >
            <Icon aria-hidden className="size-3.5" />
          </Button>
        ),
      )}
    </div>
  );
}
