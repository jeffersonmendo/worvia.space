import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalShell } from "./portal-shell";

function render(styleMode?: "auto" | "desktop" | "mobile") {
  return renderToStaticMarkup(
    <PortalShell sidebar={<nav>Sidebar</nav>} styleMode={styleMode}>
      <article>Content</article>
    </PortalShell>,
  );
}

describe("PortalShell presentation modes", () => {
  test("keeps auto responsive and default", () => {
    const html = render();
    expect(html).toContain('data-style-mode="auto"');
    expect(html).toContain("lg:grid-cols-[240px_1fr]");
    expect(html).toMatch(
      /<aside class="[^"]*(?:hidden[^"]*lg:block|lg:block[^"]*hidden)/,
    );
    expect(html).not.toContain("min-w-[900px]");
  });

  test("forces desktop composition without overflowing its parent canvas", () => {
    const html = render("desktop");
    expect(html).toContain('data-style-mode="desktop"');
    expect(html).not.toContain("overflow-x-auto");
    expect(html).not.toContain("min-w-[900px]");
    expect(html).toContain("grid-cols-[240px_1fr]");
    expect(html).toMatch(/<aside class="[^"]*block/);
  });

  test("forces the mobile composition even on a wide viewport", () => {
    const html = render("mobile");
    expect(html).toContain('data-style-mode="mobile"');
    expect(html).not.toContain("lg:grid-cols-[240px_1fr]");
    expect(html).toMatch(/<aside class="[^"]*hidden/);
  });
});
