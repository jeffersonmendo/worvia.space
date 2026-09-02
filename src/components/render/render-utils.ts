import { cn } from "@/lib/utils";
import type { RenderLayout } from "./visual-model";

export function ordered<T extends { id: string; position: number }>(
  items: T[],
) {
  return [...items].sort((left, right) => left.position - right.position);
}

export function columnsClass(columns = 3) {
  return cn(
    "grid",
    columns === 1 && "grid-cols-1",
    columns === 2 && "grid-cols-2",
    columns === 3 &&
      "grid-cols-2 lg:grid-cols-3 group-data-[style-mode=desktop]/project:grid-cols-3! group-data-[style-mode=mobile]/project:grid-cols-2!",
    columns === 4 &&
      "grid-cols-3 lg:grid-cols-4 group-data-[style-mode=desktop]/project:grid-cols-4! group-data-[style-mode=mobile]/project:grid-cols-3!",
    columns === 5 &&
      "grid-cols-4 lg:grid-cols-5 group-data-[style-mode=desktop]/project:grid-cols-5! group-data-[style-mode=mobile]/project:grid-cols-4!",
    columns === 6 &&
      "grid-cols-5 lg:grid-cols-6 group-data-[style-mode=desktop]/project:grid-cols-6! group-data-[style-mode=mobile]/project:grid-cols-5!",
  );
}

export function layoutClass(layout: RenderLayout = {}) {
  return cn(
    layout.mode === "stack" ? "flex flex-col" : columnsClass(layout.columns),
    layout.mode !== "stack" && "gap-4",
    layout.gap === "sm" && "gap-2",
    layout.gap === "md" && "gap-4",
    layout.gap === "lg" && "gap-6",
    layout.width === "container" && "max-w-3xl",
    layout.width === "wide" && "max-w-6xl",
    layout.width === "full" && "w-full",
  );
}

export function aspectClass(aspect: string) {
  return cn(
    aspect === "1/1" && "aspect-square",
    aspect === "4/3" && "aspect-[4/3]",
    aspect === "16/9" && "aspect-video",
    aspect === "21/9" && "aspect-[21/9]",
    (aspect === "auto" || !aspect) && "aspect-[4/3]",
  );
}

export function fitClass(fit: string) {
  return cn(
    fit === "contain" && "object-contain",
    fit === "fill" && "object-fill",
    fit === "auto" && "object-scale-down",
    (fit === "cover" || !fit) && "object-cover",
  );
}

export function presentationStyle(
  background?: string,
  padding?: number,
  transparent = false,
) {
  return {
    ...presentationBackgroundStyle(background, transparent),
    ...presentationPaddingStyle(padding),
  };
}

export function presentationBackgroundStyle(
  background?: string,
  transparent = false,
) {
  return transparent
    ? {}
    : { backgroundColor: background || "var(--secondary)" };
}

export function presentationPaddingStyle(padding?: number) {
  return { padding: padding ?? 0 };
}
