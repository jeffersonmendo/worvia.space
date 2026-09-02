import type { PortalDocument } from "@/domain/portal/document";
import fixture from "./landing-editor-demo.fixture.json";

export type LandingEditorDemoState = {
  document: PortalDocument;
  published: boolean;
};

export type LandingEditorDemoAction =
  | { type: "sync-document"; document: PortalDocument }
  | { type: "publish" };

export function createLandingEditorDemoState(): LandingEditorDemoState {
  return {
    document: structuredClone(fixture) as unknown as PortalDocument,
    published: false,
  };
}

export function createLandingDemoReplayController({
  clearTimer,
  holdMs,
  onActivate,
  onDeactivate,
  onReset,
  setTimer,
}: {
  clearTimer: (timer: unknown) => void;
  holdMs: number;
  onActivate: () => void;
  onDeactivate: () => void;
  onReset: () => void;
  setTimer: (run: () => void, delay: number) => unknown;
}) {
  let holdTimer: unknown;
  let activationTimer: unknown;
  let completedLatched = false;
  return {
    dispose() {
      if (holdTimer !== undefined) clearTimer(holdTimer);
      if (activationTimer !== undefined) clearTimer(activationTimer);
      holdTimer = undefined;
      activationTimer = undefined;
    },
    onStatus(status: string) {
      if (status !== "completed") {
        completedLatched = false;
        return;
      }
      if (completedLatched || holdTimer !== undefined) return;
      completedLatched = true;
      holdTimer = setTimer(() => {
        holdTimer = undefined;
        onDeactivate();
        onReset();
        activationTimer = setTimer(() => {
          activationTimer = undefined;
          onActivate();
        }, 0);
      }, holdMs);
    },
  };
}

export function applyLandingEditorDemoAction(
  state: LandingEditorDemoState,
  action: LandingEditorDemoAction,
): LandingEditorDemoState {
  if (action.type === "publish") return { ...state, published: true };
  if (action.type === "sync-document") {
    return { ...state, document: action.document };
  }
  return state;
}
