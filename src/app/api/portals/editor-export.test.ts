import { expect, test } from "bun:test";
import { flushThenExport } from "@/lib/portal/editor-export";

const route = await Bun.file(
  new URL("./[slug]/export/route.ts", import.meta.url),
).text();
const editorPage = await Bun.file(
  new URL(
    "../../[locale]/(workspace)/create/[portalId]/page.tsx",
    import.meta.url,
  ),
).text();

test("editor export is authenticated and reads the current portal document", () => {
  expect(editorPage).toContain("PortalProjectController");
  expect(editorPage).not.toContain("assetsSectionId");
  expect(route).toContain('source === "editor"');
  expect(route).toContain('rpc("can_edit_portal"');
  expect(route).toContain('.from("portal_documents")');
  expect(route).toContain("selectPortalExportDocument");
});

test("editor export flushes the current draft before navigation", async () => {
  const events: string[] = [];

  await flushThenExport({
    flush: async () => {
      events.push("flush");
    },
    href: "/api/portals/acme/export?source=editor",
    navigate: (href) => events.push(`navigate:${href}`),
  });

  expect(events).toEqual([
    "flush",
    "navigate:/api/portals/acme/export?source=editor",
  ]);
});
