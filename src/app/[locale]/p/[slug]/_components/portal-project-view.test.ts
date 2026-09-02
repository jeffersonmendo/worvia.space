import { expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-project-view.tsx", import.meta.url),
).text();

test("maps public global actions to RenderProject project actions", () => {
  expect(source).toContain("project: () => adaptActions(source.global?.() ?? [])");
});
