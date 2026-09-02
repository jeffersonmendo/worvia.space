import { describe, expect, mock, test } from "bun:test";
import type { PortalDocument } from "@/domain/portal/document";
import fixture from "./landing-editor-demo.fixture.json";
import {
  applyLandingEditorDemoAction,
  createLandingDemoReplayController,
  createLandingEditorDemoState,
} from "./landing-editor-demo-state";

describe("landing editor demo local walkthrough", () => {
  test("publishes only the document produced by real controlled editor updates", () => {
    const persist = mock(() => undefined);
    const initial = fixture as unknown as PortalDocument;
    const edited = {
      ...initial,
      portal: { ...initial.portal, description: "Logos de martpos" },
    };
    let state = applyLandingEditorDemoAction(
      { document: initial, published: false },
      { type: "sync-document", document: edited },
    );
    state = applyLandingEditorDemoAction(state, { type: "publish" });

    expect(state.document).toBe(edited);
    expect(state.published).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  test("preserves controlled description edits without rewriting the project name", () => {
    const initial = fixture as unknown as PortalDocument;
    const state = applyLandingEditorDemoAction(
      { document: initial, published: false },
      {
        type: "sync-document",
        document: {
          ...initial,
          portal: { ...initial.portal, description: "Logos de martpos" },
        },
      },
    );
    expect(state.document.portal.name).toBe("Mart POS");
    expect(state.document.portal.description).toBe("Logos de martpos");
  });

  test("creates a fresh pristine fixture for every replay iteration", () => {
    const first = createLandingEditorDemoState();
    first.document.portal.description = "edited";
    first.published = true;

    const replay = createLandingEditorDemoState();
    const gallery = replay.document.sections.find(
      (section) => section.type === "gallery",
    );
    const firstImage =
      gallery?.type === "gallery"
        ? (gallery.content.images ?? []).toSorted(
            (left, right) => left.position - right.position,
          )[0]
        : undefined;
    const colors = replay.document.sections.find(
      (section) => section.type === "colors",
    );

    expect(replay).not.toBe(first);
    expect(replay.document).not.toBe(first.document);
    expect(replay.document.portal.description).toBe("");
    expect(replay.published).toBe(false);
    expect(firstImage?.display_name).toBe("");
    expect(firstImage?.allow_download).toBe(false);
    expect(firstImage?.background_color).not.toBe("#000000");
    expect(
      colors?.type === "colors"
        ? (colors.content.colors ?? []).map((color) => color.color_code)
        : [],
    ).not.toContain("#000000");
  });

  test("restarts playback only after the completed frame hold and schedules once", () => {
    let now = 0;
    let id = 0;
    const timers = new Map<number, { at: number; run: () => void }>();
    const events: string[] = [];
    const controller = createLandingDemoReplayController({
      holdMs: 1800,
      onActivate: () => events.push("activate"),
      onDeactivate: () => events.push("deactivate"),
      onReset: () => events.push("reset"),
      setTimer: (run, delay) => {
        id += 1;
        timers.set(id, { at: now + delay, run });
        return id;
      },
      clearTimer: (timer) => timers.delete(timer as number),
    });
    const advance = (milliseconds: number) => {
      now += milliseconds;
      for (const [timerId, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(timerId);
          timer.run();
        }
      }
    };

    controller.onStatus("completed");
    controller.onStatus("completed");
    advance(1799);
    expect(events).toEqual([]);
    advance(1);
    expect(events).toEqual(["deactivate", "reset"]);
    advance(0);
    expect(events).toEqual(["deactivate", "reset", "activate"]);

    controller.onStatus("completed");
    advance(1800);
    expect(events).toHaveLength(3);
    controller.onStatus("playing");
    controller.onStatus("completed");
    controller.dispose();
    advance(1800);
    expect(events).toHaveLength(3);
  });
});
