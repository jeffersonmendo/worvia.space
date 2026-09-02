import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));

const { Sidebar, SidebarProvider } = await import("./sidebar");

function render(
  desktopOnly: boolean,
  variant: "floating" | "sidebar" = "sidebar",
) {
  return renderToStaticMarkup(
    <SidebarProvider>
      <Sidebar desktopOnly={desktopOnly} variant={variant}>
        Sidebar content
      </Sidebar>
      <main>Canvas</main>
    </SidebarProvider>,
  );
}

describe("Sidebar desktopOnly", () => {
  test("keeps the default mobile Sheet branch", () => {
    const html = render(false);
    expect(html).not.toContain('data-slot="sidebar-gap"');
    expect(html).not.toContain("Sidebar content");
  });

  test("renders the production desktop gap and container in a mobile host", () => {
    const html = render(true);
    expect(html).toContain('data-slot="sidebar-gap"');
    expect(html).toContain('data-slot="sidebar-container"');
    expect(html).toContain("Sidebar content");
    expect(html).toContain("flex");
  });

  test("keeps floating desktop surfaces ringed without shadows", () => {
    const html = render(true, "floating");
    expect(html).toContain("ring-1");
    expect(html).not.toContain("shadow-sm");
  });
});
