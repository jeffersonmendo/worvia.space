import { expect, test } from "bun:test";

const routeSource = await Bun.file(`${import.meta.dir}/route.ts`).text();

test("serves a reduced-quality preview with a larger logo watermark", () => {
  expect(routeSource).not.toContain(".blur(");
  expect(routeSource).toContain(".resize(640, 400");
  expect(routeSource).toContain(".modulate({ brightness: 0.95 })");
  expect(routeSource).toContain(".jpeg({ quality: 65");
  expect(routeSource).not.toContain("Portals Design");
  expect(routeSource).toContain('width="52" height="52"');
  expect(routeSource).toContain("scale(1.5)");
  expect(routeSource).toContain('opacity="0.7"');
  expect(routeSource).toContain('gravity: "southeast"');
  expect(routeSource).toContain('searchParams.get("image_index")');
  expect(routeSource).toContain("images[imageIndex]");
  expect(routeSource).toContain('.order("position", { ascending: true })');
});
