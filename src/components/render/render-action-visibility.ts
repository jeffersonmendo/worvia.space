export type RenderActionInteractionScope = "always" | "item" | "section";
export type RenderActionStyleOwner = "portal" | "project";

const responsiveClasses: Record<RenderActionStyleOwner, string> = {
  portal:
    "opacity-100 transition-opacity sm:opacity-0 group-data-[style-mode=desktop]/portal:opacity-0! group-data-[style-mode=mobile]/portal:opacity-100!",
  project:
    "opacity-100 transition-opacity sm:opacity-0 group-data-[style-mode=desktop]/project:opacity-0! group-data-[style-mode=mobile]/project:opacity-100!",
};

const hoverClasses: Record<
  `${RenderActionStyleOwner}:${Exclude<RenderActionInteractionScope, "always">}`,
  string
> = {
  "portal:item":
    "sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100 group-data-[style-mode=desktop]/portal:group-hover/item:opacity-100! group-data-[style-mode=desktop]/portal:group-focus-within/item:opacity-100! group-data-[style-mode=desktop]/portal:[&:has([data-demo-hovered=true])]:opacity-100!",
  "portal:section":
    "sm:group-hover/section:opacity-100 sm:group-focus-within/section:opacity-100 group-data-[style-mode=desktop]/portal:group-hover/section:opacity-100! group-data-[style-mode=desktop]/portal:group-focus-within/section:opacity-100! group-data-[style-mode=desktop]/portal:[&:has([data-demo-hovered=true])]:opacity-100!",
  "project:item":
    "sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100 group-data-[style-mode=desktop]/project:group-hover/item:opacity-100! group-data-[style-mode=desktop]/project:group-focus-within/item:opacity-100! group-data-[style-mode=desktop]/project:[&:has([data-demo-hovered=true])]:opacity-100!",
  "project:section":
    "sm:group-hover/section:opacity-100 sm:group-focus-within/section:opacity-100 group-data-[style-mode=desktop]/project:group-hover/section:opacity-100! group-data-[style-mode=desktop]/project:group-focus-within/section:opacity-100! group-data-[style-mode=desktop]/project:[&:has([data-demo-hovered=true])]:opacity-100!",
};

export function renderActionVisibilityClass(
  scope: RenderActionInteractionScope,
  styleOwner: RenderActionStyleOwner,
) {
  if (scope === "always") return "";

  return [
    responsiveClasses[styleOwner],
    hoverClasses[`${styleOwner}:${scope}`],
    "sm:[&:has([data-demo-hovered=true])]:opacity-100",
  ].join(" ");
}
