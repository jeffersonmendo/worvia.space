import { describe, expect, test } from "bun:test";
import {
  buildHomeMetadata,
  buildPortalMetadata,
  getSiteUrl,
  resolvePortalSharePresentation,
} from "./public-metadata";

describe("public metadata", () => {
  test("builds localized home metadata with canonical and social previews", () => {
    const metadata = buildHomeMetadata({
      description: "Presenta tu trabajo con claridad.",
      locale: "es",
      title: "Diseña la marca. Entrega la experiencia.",
    });

    expect(metadata.title).toBe(
      "Diseña la marca. Entrega la experiencia. | Worvia",
    );
    expect(metadata.alternates?.canonical).toBe("/es");
    expect(metadata.openGraph).toMatchObject({
      description: "Presenta tu trabajo con claridad.",
      locale: "es_ES",
      siteName: "Worvia",
      title: "Diseña la marca. Entrega la experiencia. | Worvia",
      type: "website",
      url: "/es",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/es/opengraph-image"],
    });
  });

  test("uses the portal route and project copy in portal metadata", () => {
    const metadata = buildPortalMetadata({
      description: "The complete identity system.",
      locale: "en",
      name: "Acme Brand",
      slug: "acme-brand",
    });

    expect(metadata.title).toBe("Acme Brand | Worvia");
    expect(metadata.alternates?.canonical).toBe("/en/p/acme-brand");
    expect(metadata.openGraph).toMatchObject({
      description: "The complete identity system.",
      images: [
        {
          alt: "Acme Brand | Worvia",
          height: 630,
          url: "/en/p/acme-brand/opengraph-image",
          width: 1200,
        },
      ],
      title: "Acme Brand | Worvia",
      url: "/en/p/acme-brand",
    });
  });

  test("normalizes configured deployment URLs and keeps a local fallback", () => {
    expect(getSiteUrl("portals.design").href).toBe("https://portals.design/");
    expect(getSiteUrl("https://preview.portals.design/").href).toBe(
      "https://preview.portals.design/",
    );
    expect(getSiteUrl()).toEqual(new URL("http://localhost:3000"));
  });

  test("reveals portal copy only when access is allowed", () => {
    const fallback = {
      description: "Portal created with Worvia.",
      title: "Portal unavailable | Worvia",
    };
    const portal = {
      description: "Confidential launch system.",
      fallbackDescription: "Discover Atlas",
      name: "Atlas",
    };

    expect(
      resolvePortalSharePresentation({ decision: "allowed", fallback, portal }),
    ).toEqual({
      description: "Confidential launch system.",
      indexable: true,
      title: "Atlas",
    });

    expect(
      resolvePortalSharePresentation({
        decision: "preview_required",
        fallback,
        portal,
      }),
    ).toEqual({
      description: "Confidential launch system.",
      indexable: false,
      title: "Atlas",
    });

    for (const decision of ["password_required", "not_found"] as const) {
      const presentation = resolvePortalSharePresentation({
        decision,
        fallback,
        portal,
      });
      expect(presentation).toEqual({ ...fallback, indexable: false });
      expect(JSON.stringify(presentation)).not.toContain("Atlas");
      expect(JSON.stringify(presentation)).not.toContain("Confidential");
    }
  });

  test("uses the safe generated description when an allowed portal has no summary", () => {
    expect(
      resolvePortalSharePresentation({
        decision: "allowed",
        fallback: { description: "Generic", title: "Unavailable" },
        portal: {
          description: null,
          fallbackDescription: "Discover Atlas",
          name: "Atlas",
        },
      }),
    ).toEqual({
      description: "Discover Atlas",
      indexable: true,
      title: "Atlas",
    });
  });
});
