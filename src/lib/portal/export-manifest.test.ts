import { describe, expect, test } from "bun:test";
import type { PortalDocument } from "@/domain/portal/document";
import {
  buildColorsText,
  buildExportManifest,
  isCanonicalPortalAssetPath,
  parsePortalStorageReference,
  portalExportHref,
  sanitizeAssetName,
  selectManifestScope,
  selectPortalExportDocument,
} from "./export-manifest";

test("builds one encoded portal export URL for every export control", () => {
  expect(portalExportHref("brand system/2026")).toBe(
    "/api/portals/brand%20system%2F2026/export",
  );
  expect(portalExportHref("brand system/2026", "editor")).toBe(
    "/api/portals/brand%20system%2F2026/export?source=editor",
  );
});

test("selects current editor content while public exports keep the snapshot", () => {
  const current = { version: "draft-current" };
  const published = { version: "published-old" };

  expect(
    selectPortalExportDocument({ current, published: null, source: "editor" }),
  ).toBe(current);
  expect(
    selectPortalExportDocument({ current, published, source: "editor" }),
  ).toBe(current);
  expect(
    selectPortalExportDocument({ current, published, source: "published" }),
  ).toBe(published);
});

const document: PortalDocument = {
  portal: { description: "", name: "Acme", theme: "auto" },
  sections: [
    {
      allow_download: true,
      content: {
        colors: [
          {
            color_code: "#fff",
            color_name: "Primary",
            id: "c1",
            position: 0,
            rgb: "255 255 255",
            visible: true,
          },
        ],
      },
      description: "",
      id: "colors",
      layout: {},
      position: 0,
      title: "Palette",
      type: "colors",
      visible: true,
    },
    {
      allow_download: true,
      content: {
        images: [
          {
            allow_download: true,
            alt_text: "Hero",
            aspect_ratio: "auto",
            fit: "cover",
            id: "i1",
            image_url:
              "https://project.supabase.co/storage/v1/object/public/portal-assets/u/p/a.png",
            position: 0,
            visible: true,
          },
          {
            allow_download: false,
            alt_text: "Private",
            aspect_ratio: "auto",
            fit: "cover",
            id: "i2",
            image_url:
              "https://project.supabase.co/storage/v1/object/public/portal-assets/u/p/b.png",
            position: 1,
            visible: true,
          },
        ],
      },
      description: "",
      id: "gallery",
      layout: {},
      position: 1,
      title: "Hero / shots",
      type: "gallery",
      visible: true,
    },
  ],
  version: 1,
};

describe("export manifest", () => {
  test("creates deterministic color and downloadable asset entries", () => {
    const manifest = buildExportManifest(document, {
      portalId: "p",
      ownerId: "u",
      slug: "acme",
      storageOrigin: "https://project.supabase.co",
    });
    expect(manifest.entries.map((entry) => entry.destination)).toEqual([
      "colors/Palette/colors.txt",
      "images/Hero-shots/image-1.png",
    ]);
    expect(buildColorsText(document.sections[0])).toBe(
      "Primary: HEX #fff | RGB 255 255 255\n",
    );
  });

  test("selects only the requested section or item", () => {
    const manifest = buildExportManifest(document, {
      portalId: "p",
      ownerId: "u",
      slug: "acme",
      storageOrigin: "https://project.supabase.co",
    });
    expect(
      selectManifestScope(manifest, { kind: "section", sectionId: "gallery" })
        .entries,
    ).toHaveLength(1);
    expect(
      selectManifestScope(manifest, { itemId: "i1", kind: "item" }).entries[0]
        ?.itemId,
    ).toBe("i1");
  });

  test("keeps source extensions when labels contain punctuation", () => {
    const hero = document.sections[1].content.images?.[0];
    expect(hero).toBeDefined();
    if (!hero) return;

    const manifest = buildExportManifest(
      {
        ...document,
        sections: [
          {
            ...document.sections[1],
            content: {
              images: [
                {
                  ...hero,
                  alt_text: "Un párrafo. Con punto final",
                },
              ],
            },
          },
        ],
      },
      {
        portalId: "p",
        ownerId: "u",
        slug: "acme",
        storageOrigin: "https://project.supabase.co",
      },
    );

    expect(manifest.entries[0]?.name.endsWith(".png")).toBe(true);
  });

  test("uses source-like image names instead of long descriptions", () => {
    const hero = document.sections[1].content.images?.[0];
    expect(hero).toBeDefined();
    if (!hero) return;

    const manifest = buildExportManifest(
      {
        ...document,
        sections: [
          {
            ...document.sections[1],
            content: {
              images: [
                {
                  ...hero,
                  alt_text:
                    "Esta es una descripción larga que no debe convertirse en el nombre del archivo descargado",
                  storage_path:
                    "u/p/123e4567-e89b-12d3-a456-426614174000-original-brand.png",
                },
              ],
            },
          },
        ],
      },
      {
        portalId: "p",
        ownerId: "u",
        slug: "acme",
        storageOrigin: "https://project.supabase.co",
      },
    );

    expect(manifest.entries[0]?.name).toBe("original-brand.png");
  });

  test("selects a complete font family pack", () => {
    const manifest = buildExportManifest(
      {
        portal: { description: "", name: "Acme", theme: "auto" },
        sections: [
          {
            allow_download: true,
            content: {
              fonts: [
                {
                  file_name: "Inter-Bold.woff2",
                  font_name: "Inter",
                  id: "f1",
                  position: 0,
                  storage_path: "u/p/Inter-Bold.woff2",
                  visible: true,
                  weight: 700,
                },
                {
                  file_name: "Inter-Regular.woff2",
                  font_name: "Inter",
                  id: "f2",
                  position: 1,
                  storage_path: "u/p/Inter-Regular.woff2",
                  visible: true,
                  weight: 400,
                },
                {
                  file_name: "Mono-Regular.woff2",
                  font_name: "Mono",
                  id: "f3",
                  position: 2,
                  storage_path: "u/p/Mono-Regular.woff2",
                  visible: true,
                  weight: 400,
                },
              ],
            },
            description: "",
            id: "fonts",
            layout: {},
            position: 0,
            title: "Fuente",
            type: "fonts",
            visible: true,
          },
        ],
        version: 1,
      },
      {
        portalId: "p",
        ownerId: "u",
        slug: "acme",
        storageOrigin: "https://project.supabase.co",
      },
    );

    const pack = selectManifestScope(manifest, {
      fontFamily: "Inter",
      kind: "font-family",
      sectionId: "fonts",
    });

    expect(pack.entries.map((entry) => entry.name).sort()).toEqual([
      "Inter-Bold.woff2",
      "Inter-Regular.woff2",
    ]);
  });

  test("keeps colors.txt in full portal exports", () => {
    const manifest = buildExportManifest(document, {
      portalId: "p",
      ownerId: "u",
      slug: "acme",
      storageOrigin: "https://project.supabase.co",
    });

    expect(
      selectManifestScope(manifest, { kind: "portal" }).entries,
    ).toContainEqual(
      expect.objectContaining({ destination: "colors/Palette/colors.txt" }),
    );
  });

  test("keeps each color section in its own export folder", () => {
    const secondColorsSection = {
      ...document.sections[0],
      id: "colors-secondary",
      position: 2,
      title: "Secondary palette",
    };
    const manifest = buildExportManifest(
      { ...document, sections: [...document.sections, secondColorsSection] },
      {
        portalId: "p",
        ownerId: "u",
        slug: "acme",
        storageOrigin: "https://project.supabase.co",
      },
    );

    expect(
      manifest.entries
        .filter((entry) => entry.category === "colors")
        .map((entry) => entry.destination),
    ).toEqual([
      "colors/Palette/colors.txt",
      "colors/Secondary-palette/colors.txt",
    ]);
  });

  test("sanitizes traversal and deduplicates names", () => {
    expect(sanitizeAssetName("../../Brand / logo?.svg", "asset")).toBe(
      "Brand-logo.svg",
    );
    expect(sanitizeAssetName("   ", "asset")).toBe("asset");
  });

  test("accepts only the configured Supabase origin and bucket", () => {
    expect(
      parsePortalStorageReference(
        "https://project.supabase.co/storage/v1/object/public/portal-assets/u/p/a.png",
        "https://project.supabase.co",
      ),
    ).toEqual({ bucket: "portal-assets", path: "u/p/a.png" });
    expect(
      parsePortalStorageReference(
        "https://evil.test/storage/v1/object/public/portal-assets/u/p/a.png",
        "https://project.supabase.co",
      ),
    ).toBeNull();
    expect(
      parsePortalStorageReference(
        "https://project.supabase.co/storage/v1/object/public/portal-assets/../../secret",
        "https://project.supabase.co",
      ),
    ).toBeNull();
  });

  test("uses stable storage paths when signed URLs are absent", () => {
    const hero = document.sections[1].content.images?.[0];
    expect(hero).toBeDefined();
    if (!hero) return;

    const manifest = buildExportManifest(
      {
        ...document,
        sections: [
          {
            ...document.sections[1],
            content: {
              images: [
                {
                  ...hero,
                  image_url: "",
                  storage_path: "u/p/a.png",
                },
              ],
            },
          },
        ],
      },
      {
        portalId: "p",
        ownerId: "u",
        slug: "acme",
        storageOrigin: "https://project.supabase.co",
      },
    );

    expect(manifest.entries[0]?.storage).toEqual({
      bucket: "portal-assets",
      path: "u/p/a.png",
    });
  });

  test("binds a storage path to the authenticated owner and portal", () => {
    expect(
      isCanonicalPortalAssetPath(
        "portal-a/62e8a330-1787-4bd7-9f6f-0de138ba3512/logo.svg",
        "owner-a",
        "portal-a",
      ),
    ).toBe(true);
    expect(
      isCanonicalPortalAssetPath(
        "owner-a/portal-a/file.png",
        "owner-a",
        "portal-a",
      ),
    ).toBe(true);
    expect(
      isCanonicalPortalAssetPath(
        "owner-b/portal-a/file.png",
        "owner-a",
        "portal-a",
      ),
    ).toBe(false);
    expect(
      isCanonicalPortalAssetPath(
        "owner-a/portal-b/file.png",
        "owner-a",
        "portal-a",
      ),
    ).toBe(false);
    expect(
      isCanonicalPortalAssetPath("owner-a/portal-a", "owner-a", "portal-a"),
    ).toBe(false);
  });
});
