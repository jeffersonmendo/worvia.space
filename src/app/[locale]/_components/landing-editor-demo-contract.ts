export const LANDING_EDITOR_DEMO_SEQUENCE = [
  "project-description",
  "colors-section",
  "add-color",
  "color-code",
  "save-color",
  "gallery-section",
  "first-image-settings",
  "first-image-name",
  "first-image-download",
  "first-image-picker",
  "first-image-black",
  "popover-dismiss-arm",
  "editor-canvas",
  "publish",
] as const;

export type LandingEditorDemoTarget =
  (typeof LANDING_EDITOR_DEMO_SEQUENCE)[number];

export function assertUniqueDemoTarget(
  root: ParentNode,
  target: LandingEditorDemoTarget,
) {
  const matches = root.querySelectorAll(`[demo-id="${target}"]`);
  if (matches.length !== 1) {
    throw new Error(
      `Demo target ${target} expected once, found ${matches.length}`,
    );
  }
  return matches[0] as HTMLElement;
}
