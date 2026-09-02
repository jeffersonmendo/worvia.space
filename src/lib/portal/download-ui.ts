import {
  type RenderActionInteractionScope,
  renderActionVisibilityClass,
} from "@/components/render/render-action-visibility";

export type DownloadInteractionScope = RenderActionInteractionScope;

export function downloadControlClass(scope: DownloadInteractionScope) {
  return ["rounded-full", renderActionVisibilityClass(scope, "portal")]
    .filter(Boolean)
    .join(" ");
}
