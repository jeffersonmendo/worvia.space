import { describe, expect, mock, test } from "bun:test";
import type { PortalDocument } from "@/domain/portal/document";
import { applyLocalDocumentUpdate } from "./local-editor";

const document = {
  portal: { name: "Initial" },
  sections: [],
  version: 1,
} as unknown as PortalDocument;

describe("applyLocalDocumentUpdate", () => {
  test("composes consecutive updates against the latest local document", () => {
    const current = { current: document };
    const onChange = mock(() => undefined);

    applyLocalDocumentUpdate(current, onChange, (value) => ({
      ...value,
      portal: { ...value.portal, name: "First" },
    }));
    applyLocalDocumentUpdate(current, onChange, (value) => ({
      ...value,
      portal: { ...value.portal, description: "Second" },
    }));

    expect(current.current.portal.name).toBe("First");
    expect(current.current.portal.description).toBe("Second");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  test("only reports the controlled document and invokes no side effects", () => {
    const current = { current: document };
    const onChange = mock(() => undefined);
    const update = mock((value: PortalDocument) => value);

    applyLocalDocumentUpdate(current, onChange, update);

    expect(update).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(document);
  });
});

describe("contained demo overlay state", () => {
  test("keeps Base UI dismissal attempts open while allowing the walkthrough to open", async () => {
    const { applyContainedDemoOverlayOpenChange } = await import(
      "./local-editor"
    );
    const onOpenChange = mock(() => undefined);

    applyContainedDemoOverlayOpenChange(true, true, onOpenChange);
    applyContainedDemoOverlayOpenChange(true, false, onOpenChange);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  test("consumes an explicitly armed walkthrough dismissal exactly once", async () => {
    const {
      applyContainedDemoOverlayOpenChange,
      armContainedDemoOverlayDismissal,
    } = await import("./local-editor");
    const calls: boolean[] = [];
    const onOpenChange = (open: boolean) => calls.push(open);
    const container = {} as HTMLElement;

    applyContainedDemoOverlayOpenChange(true, false, onOpenChange, {
      container,
      event: { isTrusted: false },
      reason: "outside-press",
    });
    armContainedDemoOverlayDismissal(container);
    applyContainedDemoOverlayOpenChange(true, false, onOpenChange, {
      container,
      event: { isTrusted: false },
      reason: "outside-press",
    });
    applyContainedDemoOverlayOpenChange(true, false, onOpenChange, {
      container,
      event: { isTrusted: false },
      reason: "outside-press",
    });
    armContainedDemoOverlayDismissal(container);
    applyContainedDemoOverlayOpenChange(true, false, onOpenChange, {
      container,
      event: { isTrusted: true },
      reason: "outside-press",
    });

    expect(calls).toEqual([false]);
  });

  test("preserves production open and dismissal behavior", async () => {
    const { applyContainedDemoOverlayOpenChange } = await import(
      "./local-editor"
    );
    const onOpenChange = mock(() => undefined);

    applyContainedDemoOverlayOpenChange(false, true, onOpenChange);
    applyContainedDemoOverlayOpenChange(false, false, onOpenChange);

    expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
  });
});
