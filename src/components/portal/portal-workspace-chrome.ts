import { cn } from "@/lib/utils";

/** Shared presentation contracts for production and local-only editor chrome. */
export const WORKSPACE_HEADER_POSITION_CLASS = {
  inset: "absolute top-2 right-2 left-0",
  viewport:
    "fixed top-2 right-[var(--portal-right-sidebar-width,0.5rem)] left-2 pl-2 lg:left-[calc(var(--sidebar-offset))]",
} as const;

export const WORKSPACE_HEADER_SURFACE_CLASS =
  "z-40 flex items-center justify-between gap-4 overflow-hidden rounded-3xl bg-sidebar/70 px-4 py-3 ring-1 ring-sidebar-border backdrop-blur-xl";

// top-2 + py-3 + size-9 controls + a 3-unit breathing gap = 5rem.
export const WORKSPACE_EMBEDDED_HEADER_CANVAS_OFFSET_CLASS = "pt-20";

export function workspaceHeaderClass(positionClass: string) {
  // Position comes last so its axis-specific padding can refine the surface.
  return cn(WORKSPACE_HEADER_SURFACE_CLASS, positionClass);
}

export const WORKSPACE_BOTTOM_TOOLBAR_SURFACE_CLASS =
  "z-50 flex w-fit max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-center gap-1 rounded-3xl border border-border/60 bg-sidebar/70 p-2 shadow-lg backdrop-blur-xl";
