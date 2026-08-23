import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalShell } from "./portal-shell";

describe("PortalShell", () => {
  test("keeps a sidebar fixed inside the viewport below the shell header", () => {
    const markup = renderToStaticMarkup(
      <PortalShell sidebar={<nav>Sections</nav>}>
        <section>Content</section>
      </PortalShell>,
    );

    expect(markup).toContain("min-h-0");
    expect(markup).toContain(
      "fixed top-[calc(var(--portal-sidebar-offset,2rem)+2rem)] bottom-8 left-[max(1.5rem,calc((100vw-900px)/2))]",
    );
  });
});
