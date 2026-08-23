import { describe, expect, test } from "bun:test";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicPortalShell } from "./public-portal-header";

describe("PublicPortalShell", () => {
  test("renders a floating header aligned to the public portal content width", () => {
    const markup = renderToStaticMarkup(
      <PublicPortalShell
        downloadHref="/api/portals/northstar/export?source=published"
        downloadLabel="Download"
      >
        <main>Portal content</main>
      </PublicPortalShell>,
    );

    expect(markup).toContain('aria-label="Portals Design"');
    expect(markup).toContain('href="/"');
    expect(markup).not.toContain(">Portals Design<");
    expect(markup).not.toContain("Ada Lovelace");
    expect(markup).toContain('aria-label="Download"');
    expect(markup).toContain(
      'href="/api/portals/northstar/export?source=published"',
    );
    expect(markup).toContain("tabler-icon-download");
    expect(markup).toContain("</svg>Download</a>");
    expect(markup).toContain("bg-primary text-primary-foreground");
    expect(markup).not.toContain("size-9");
    expect(markup).toContain("fixed");
    expect(markup).toContain("max-w-[900px]");
    expect(markup).toContain("-translate-x-1/2");
    expect(markup).toContain("[--portal-sidebar-offset:5rem]");
    expect(markup).toContain("Portal content");
  });

  test("disables download when the current portal view cannot be downloaded", () => {
    const markup = renderToStaticMarkup(
      <PublicPortalShell downloadLabel="Download">Content</PublicPortalShell>,
    );

    expect(markup).toContain("disabled");
    expect(markup).toContain("tabler-icon-download");
    expect(markup).toContain("</svg>Download</button>");
    expect(markup).toContain("bg-primary text-primary-foreground");
    expect(markup).not.toContain("size-9");
    expect(markup).not.toContain("creatorName");
  });

  test("renders a purchase action with the portal price for paid previews", () => {
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="es"
        messages={{
          PublicPortal: { preview: { checkoutUnavailable: "Unavailable" } },
        }}
      >
        <PublicPortalShell
          downloadLabel="Download"
          purchaseAction={{
            label: "Comprar $12",
            locale: "es",
            portalId: "portal-123",
            price: "$12",
            slug: "northstar",
          }}
        >
          Content
        </PublicPortalShell>
      </NextIntlClientProvider>,
    );

    expect(markup).toContain("Comprar $12");
    expect(markup).toContain('data-slot="button"');
    expect(markup).not.toContain("Download</button>");
  });
});
