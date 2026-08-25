import { expect, test } from "bun:test";

const routeSource = await Bun.file(`${import.meta.dir}/route.ts`).text();

test("serves a format-preserving preview with a crown watermark", () => {
  expect(routeSource).not.toContain(".blur(");
  expect(routeSource).toContain('fit: "contain"');
  expect(routeSource).toContain("withoutEnlargement: true");
  expect(routeSource).toContain("background: { r: 0, g: 0, b: 0, alpha: 0 }");
  expect(routeSource).toContain(".modulate({ brightness: 1 })");
  expect(routeSource).toContain("metadata.format");
  expect(routeSource).toContain(".png({ compressionLevel: 9");
  expect(routeSource).toContain("quality: 90");
  expect(routeSource).not.toContain("quality: 80");
  expect(routeSource).toContain('"Content-Type": contentType');
  expect(routeSource).toContain('width="64" height="64"');
  expect(routeSource).toContain('fill="#f5c542"');
  expect(routeSource).toContain('gravity: "southeast"');
  expect(routeSource).not.toContain("Worvia");
  expect(routeSource).toContain('width="64" height="64"');
  expect(routeSource).toContain('d="M19 19h-14c-.5 0-.9-.3-1-.8l-2-10');
  expect(routeSource).toContain('opacity="0.82"');
  expect(routeSource).toContain('searchParams.get("image_index")');
  expect(routeSource).toContain('searchParams.get("asset_id")');
  expect(routeSource).toContain("images[imageIndex]");
  expect(routeSource).toContain("images.find((asset) => asset.id === assetId)");
  expect(routeSource).toContain('.order("position", { ascending: true })');
});
