import { describe, expect, test } from "bun:test";
import {
  createDefaultPortalDocument,
  createPortalSection,
} from "@/domain/portal/document";
import {
  mergePersistedPortalAsset,
  reconcilePersistedPortalAssets,
} from "@/infrastructure/portal/portal-assets-client";

const baseAsset = {
  assetId: "asset-1",
  category: "image" as const,
  mimeType: "image/png",
  name: "hero.png",
  path: "portal/asset-1/hero.png",
  sizeBytes: 12,
};

describe("persisted portal asset reconciliation", () => {
  test("coalesces concurrent reconciliation for the same portal and fetcher", async () => {
    let resolveResponse!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return pending;
    }) as unknown as typeof fetch;

    const first = reconcilePersistedPortalAssets({
      fetcher,
      portalId: "portal-1",
    });
    const second = reconcilePersistedPortalAssets({
      fetcher,
      portalId: "portal-1",
    });
    expect(calls).toBe(1);
    resolveResponse(Response.json({ assets: [] }));
    expect(await first).toEqual(await second);
  });

  test("finalizes a reserved asset whose bytes survived a reload", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = (async (input, init) => {
      calls.push(`${init?.method ?? "GET"}:${String(input)}`);
      if (init?.method === "GET") {
        return Response.json({
          assets: [{ ...baseAsset, state: "reserved" }],
        });
      }
      return Response.json({
        asset: { ...baseAsset, id: baseAsset.assetId, state: "ready" },
        previewUrl: "https://signed.example/hero.png",
      });
    }) as typeof fetch;

    const result = await reconcilePersistedPortalAssets({
      fetcher,
      portalId: "portal-1",
    });

    expect(calls).toEqual([
      "GET:/api/portal-assets?portalId=portal-1",
      "PATCH:/api/portal-assets",
    ]);
    expect(result.assets).toEqual([
      expect.objectContaining({
        assetId: "asset-1",
        previewUrl: "https://signed.example/hero.png",
      }),
    ]);
  });

  test("deletes a reservation when Storage has no bytes", async () => {
    const methods: string[] = [];
    const fetcher: typeof fetch = (async (_input, init) => {
      methods.push(init?.method ?? "GET");
      if (init?.method === "GET") {
        return Response.json({ assets: [{ ...baseAsset, state: "reserved" }] });
      }
      if (init?.method === "PATCH") {
        return Response.json({ error: "upload_not_found" }, { status: 409 });
      }
      return Response.json({ deleted: true });
    }) as typeof fetch;

    const result = await reconcilePersistedPortalAssets({
      fetcher,
      portalId: "portal-1",
    });

    expect(methods).toEqual(["GET", "PATCH", "DELETE"]);
    expect(result.assets).toEqual([]);
    expect(result.discardedIds).toEqual(["asset-1"]);
  });

  test("does not rehydrate an already referenced ready asset twice", () => {
    const document = createDefaultPortalDocument({
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    });
    const section = createPortalSection("image", 0);
    section.content.image = {
      allow_download: true,
      alt_text: "",
      aspect_ratio: "auto",
      asset_id: "asset-1",
      fit: "cover",
      id: "img-1",
      image_url: "https://signed.example/hero.png",
      position: 0,
      storage_path: baseAsset.path,
      visible: true,
    };
    document.sections = [section];

    const merged = mergePersistedPortalAsset(document, {
      ...baseAsset,
      previewUrl: "https://signed.example/new-url.png",
      state: "ready",
    });

    expect(merged).toBe(document);
  });

  test("does not return expired reservations for rehydration", async () => {
    const fetcher: typeof fetch = (async () =>
      Response.json({ assets: [] })) as unknown as typeof fetch;

    const result = await reconcilePersistedPortalAssets({
      fetcher,
      portalId: "portal-1",
    });

    expect(result.assets).toEqual([]);
    expect(result.discardedIds).toEqual([]);
  });
});
