import { expect, test } from "bun:test";

const routeSource = await Bun.file(`${import.meta.dir}/route.ts`).text();

test("serves a reduced-quality preview with a crown watermark", () => {
  expect(routeSource).not.toContain(".blur(");
  expect(routeSource).toContain(".resize(640, 400");
  expect(routeSource).toContain(".modulate({ brightness: 1 })");
  expect(routeSource).toContain(".jpeg({ quality: 65");
  expect(routeSource).not.toContain("Portals Design");
  expect(routeSource).toContain('width="52" height="52"');
  expect(routeSource).toContain('d="M19 19h-14c-.5 0-.9-.3-1-.8l-2-10');
  expect(routeSource).toContain('opacity="0.7"');
  expect(routeSource).toContain('gravity: "center"');
  expect(routeSource).toContain('searchParams.get("image_index")');
  expect(routeSource).toContain('searchParams.get("asset_id")');
  expect(routeSource).toContain("images[imageIndex]");
  expect(routeSource).toContain("images.find((asset) => asset.id === assetId)");
  expect(routeSource).toContain('.order("position", { ascending: true })');
});
