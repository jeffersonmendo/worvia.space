type ConfigPanelTarget =
  | { kind: "section"; sectionId: string }
  | {
      itemId: string;
      kind: "image" | "color" | "font" | "file";
      sectionId: string;
    };

export function configPanelTargetKey(target: ConfigPanelTarget) {
  return target.kind === "section"
    ? `section:${target.sectionId}`
    : `${target.kind}:${target.sectionId}:${target.itemId}`;
}

export function resetConfigPanelScroll(
  scrollOwner: Pick<HTMLElement, "scrollTop"> | null,
) {
  if (scrollOwner) scrollOwner.scrollTop = 0;
}
