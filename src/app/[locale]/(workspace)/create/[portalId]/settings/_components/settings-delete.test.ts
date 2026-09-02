import { describe, expect, test } from "bun:test";

const settingsSource = await Bun.file(
  new URL("./settings-view.tsx", import.meta.url),
).text();
const routeSource = await Bun.file(
  new URL("../page.tsx", import.meta.url),
).text();
const workspacePortalSource = await Bun.file(
  new URL(
    "../../../../../../../lib/portal/workspace-portal.ts",
    import.meta.url,
  ),
).text();
const english = await Bun.file(
  new URL("../../../../../../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../../../../../../messages/es.json", import.meta.url),
).json();

describe("paid portal deletion protection", () => {
  test("loads purchase state for the settings modal", () => {
    expect(workspacePortalSource).toContain('from("paid_portal_purchases")');
    expect(routeSource).toContain("hasPortalPurchase");
    expect(settingsSource).toContain("hasPortalPurchase");
    expect(settingsSource).toContain("deleteBlockedDescription");
    expect(settingsSource).toContain("deleteUnderstand");
  });

  test("has localized copy for the blocked modal state", () => {
    for (const messages of [
      english.PortalEditor.settings,
      spanish.PortalEditor.settings,
    ]) {
      expect(messages.deleteBlockedDescription).toBeString();
      expect(messages.deleteUnderstand).toBeString();
    }
  });
});
