import { describe, expect, test } from "bun:test";
import {
  deleteManagedPortalAsset,
  releaseManagedPortalAsset,
  shouldUseServerOwnedUpload,
  uploadManagedPortalAsset,
  uploadManagedPortalAssetServerOwned,
} from "@/infrastructure/portal/portal-assets-client";
import { subscribePortalAssetUsageChanges } from "@/lib/portal/asset-usage-events";

test("routes files above the hosting multipart limit to direct Storage", () => {
  expect(shouldUseServerOwnedUpload(4 * 1024 * 1024)).toBe(true);
  expect(shouldUseServerOwnedUpload(4 * 1024 * 1024 + 1)).toBe(false);
});

describe("managed portal asset upload", () => {
  test("sends bytes to the server-owned upload endpoint", async () => {
    let body: FormData | null = null;
    const methods: string[] = [];
    const fetcher: typeof fetch = (async (_input, init) => {
      methods.push(init?.method ?? "GET");
      if (init?.body instanceof FormData) body = init.body;
      if (init?.method === "PATCH") {
        return Response.json({
          asset: { id: "asset-server", size_bytes: 3, state: "ready" },
          previewUrl: "https://signed.example/a-ready.png",
        });
      }
      return Response.json(
        {
          asset: { size_bytes: 3 },
          assetId: "asset-server",
          path: "portal/asset-server/a.png",
          previewUrl: "https://signed.example/a.png",
        },
        { status: 202 },
      );
    }) as typeof fetch;

    const result = await uploadManagedPortalAssetServerOwned({
      category: "image",
      file: new File(["abc"], "a.png", { type: "image/png" }),
      fetcher,
      portalId: "portal-1",
    });

    const submitted = body as unknown as FormData;
    expect(submitted.get("portalId")).toBe("portal-1");
    expect(submitted.get("category")).toBe("image");
    expect((submitted.get("file") as File).name).toBe("a.png");
    expect(result.assetId).toBe("asset-server");
    expect(result.previewUrl).toBe("https://signed.example/a-ready.png");
    expect(methods).toEqual(["POST", "PATCH"]);
  });

  test("deletes a server-owned reservation when finalization fails", async () => {
    const methods: string[] = [];
    const fetcher: typeof fetch = (async (_input, init) => {
      methods.push(init?.method ?? "GET");
      if (init?.method === "PATCH") {
        return Response.json({ error: "finalization_failed" }, { status: 500 });
      }
      if (init?.method === "DELETE") return Response.json({ deleted: true });
      return Response.json(
        {
          asset: { size_bytes: 3 },
          assetId: "asset-server",
          path: "portal/asset-server/a.png",
          previewUrl: "https://signed.example/a.png",
        },
        { status: 202 },
      );
    }) as typeof fetch;

    await expect(
      uploadManagedPortalAssetServerOwned({
        category: "image",
        file: new File(["abc"], "a.png", { type: "image/png" }),
        fetcher,
        portalId: "portal-1",
      }),
    ).rejects.toThrow("finalization_failed");
    expect(methods).toEqual(["POST", "PATCH", "DELETE"]);
  });

  test.each([
    ["brand.ai", "", "application/illustrator"],
    ["guide.pdf", "application/octet-stream", "application/pdf"],
    ["notes.txt", "", "text/plain"],
    ["README.md", "application/octet-stream", "text/markdown"],
    ["mockup.psd", "", "image/vnd.adobe.photoshop"],
    ["mark.eps", "application/octet-stream", "application/postscript"],
    ["template.ait", "", "application/illustrator"],
    ["large.psb", "", "image/vnd.adobe.photoshop"],
    ["layout.indd", "", "application/x-indesign"],
    ["template.indt", "application/octet-stream", "application/x-indesign"],
    ["book.idml", "", "application/vnd.adobe.indesign-idml-package"],
    ["scan.tiff", "", "image/tiff"],
  ])(
    "reserves and uploads %s as a canonical File with the inferred MIME",
    async (name, providedMime, expectedMime) => {
      let reservationMime = "";
      let uploadMime = "";
      let uploadedFile: File | undefined;
      const fetcher: typeof fetch = (async (_input, init) => {
        if (init?.method === "POST") {
          reservationMime = JSON.parse(String(init.body)).mimeType;
          return Response.json({
            assetId: "asset-1",
            path: `portal/asset/${name}`,
            token: "signed",
          });
        }
        return Response.json({
          asset: { id: "asset-1", size_bytes: 17 },
          previewUrl: "https://server.example/signed",
        });
      }) as typeof fetch;

      const original = new File(["canonical-content"], name, {
        lastModified: 123456,
        type: providedMime,
      });
      await uploadManagedPortalAsset({
        category: "file",
        file: original,
        fetcher,
        portalId: "portal-1",
        storage: {
          from: () => ({
            uploadToSignedUrl: async (_path, _token, file, options) => {
              uploadedFile = file;
              uploadMime = options?.contentType ?? "";
              return { error: null };
            },
          }),
        },
      });

      expect(reservationMime).toBe(expectedMime);
      expect(uploadMime).toBe(expectedMime);
      expect(uploadedFile).toBeInstanceOf(File);
      expect(uploadedFile?.type.split(";", 1)[0]).toBe(expectedMime);
      expect(uploadedFile?.name).toBe(name);
      expect(uploadedFile?.size).toBe(original.size);
      expect(uploadedFile?.lastModified).toBe(original.lastModified);
      expect(await uploadedFile?.text()).toBe(await original.text());
    },
  );

  test("reserves, uploads with the signed token, then finalizes", async () => {
    const calls: string[] = [];
    const usageEvents = new EventTarget();
    let usageRefreshes = 0;
    subscribePortalAssetUsageChanges(
      "portal-1",
      () => usageRefreshes++,
      usageEvents,
    );
    const fetcher: typeof fetch = (async (_input, init) => {
      calls.push(`${init?.method ?? "GET"}:${String(_input)}`);
      if (init?.method === "POST") {
        return Response.json({
          assetId: "asset-1",
          path: "u/p/a.png",
          token: "signed",
        });
      }
      return Response.json({
        asset: { id: "asset-1", file_path: "u/p/a.png", size_bytes: 17 },
        previewUrl: "https://signed.example/a.png",
      });
    }) as typeof fetch;
    const storage = {
      from: () => ({
        uploadToSignedUrl: async (path: string, token: string) => {
          calls.push(`UPLOAD:${path}:${token}`);
          return { error: null };
        },
      }),
    };

    const asset = await uploadManagedPortalAsset({
      category: "gallery",
      file: new File(["x"], "a.png", { type: "image/png" }),
      fetcher,
      portalId: "portal-1",
      storage,
      usageEventTarget: usageEvents,
    });

    expect(calls).toEqual([
      "POST:/api/portal-assets",
      "UPLOAD:u/p/a.png:signed",
      "PATCH:/api/portal-assets",
    ]);
    expect(asset).toEqual({
      assetId: "asset-1",
      path: "u/p/a.png",
      previewUrl: "https://signed.example/a.png",
      sizeBytes: 17,
    });
    expect(usageRefreshes).toBe(2);
    releaseManagedPortalAsset(asset.assetId);
  });

  test("uses the server preview and never asks the browser for a read URL", async () => {
    let browserSigningAttempted = false;
    const fetcher: typeof fetch = (async (_input, init) =>
      init?.method === "POST"
        ? Response.json({ assetId: "asset-1", path: "p/a", token: "token" })
        : Response.json({
            asset: { id: "asset-1" },
            previewUrl: "https://server.example/signed",
          })) as typeof fetch;
    const asset = await uploadManagedPortalAsset({
      category: "image",
      file: new File(["x"], "a.png", { type: "image/png" }),
      fetcher,
      portalId: "portal-1",
      storage: {
        from: () => ({
          uploadToSignedUrl: async () => ({ error: null }),
          createSignedUrl: async () => {
            browserSigningAttempted = true;
            return { data: null, error: null };
          },
        }),
      } as never,
    });
    expect(browserSigningAttempted).toBe(false);
    expect(asset.previewUrl).toBe("https://server.example/signed");
  });

  test("deletes the reservation when finalization fails", async () => {
    const methods: string[] = [];
    const fetcher: typeof fetch = (async (_input, init) => {
      methods.push(init?.method ?? "GET");
      if (init?.method === "POST") {
        return Response.json({
          assetId: "asset-1",
          path: "p/a",
          token: "token",
        });
      }
      if (init?.method === "DELETE") return Response.json({ deleted: true });
      return Response.json({ error: "finalization_failed" }, { status: 500 });
    }) as typeof fetch;

    await expect(
      uploadManagedPortalAsset({
        category: "image",
        file: new File(["x"], "a.png", { type: "image/png" }),
        fetcher,
        portalId: "portal-1",
        storage: {
          from: () => ({
            uploadToSignedUrl: async () => ({ error: null }),
          }),
        },
      }),
    ).rejects.toThrow("finalization_failed");
    expect(methods).toEqual(["POST", "PATCH", "DELETE"]);
  });

  test.each(["upload", "finalize"])(
    "deletes the reservation when %s rejects at the network boundary",
    async (failure) => {
      const methods: string[] = [];
      const fetcher: typeof fetch = (async (_input, init) => {
        methods.push(init?.method ?? "GET");
        if (init?.method === "POST") {
          return Response.json({
            assetId: "asset-network",
            path: "p/network",
            token: "token",
          });
        }
        if (init?.method === "DELETE") return Response.json({ deleted: true });
        if (failure === "finalize") throw new Error("network_down");
        return Response.json({ asset: {}, previewUrl: "https://preview" });
      }) as typeof fetch;

      await expect(
        uploadManagedPortalAsset({
          category: "image",
          file: new File(["x"], "network.png", { type: "image/png" }),
          fetcher,
          portalId: "portal-1",
          storage: {
            from: () => ({
              uploadToSignedUrl: async () => {
                if (failure === "upload") throw new Error("network_down");
                return { error: null };
              },
            }),
          },
        }),
      ).rejects.toThrow("network_down");
      expect(methods).toEqual(
        failure === "upload" ? ["POST", "DELETE"] : ["POST", "PATCH", "DELETE"],
      );
    },
  );

  test("refreshes usage after an existing asset is deleted", async () => {
    const usageEvents = new EventTarget();
    let usageRefreshes = 0;
    subscribePortalAssetUsageChanges(
      "portal-1",
      () => usageRefreshes++,
      usageEvents,
    );

    await deleteManagedPortalAsset(
      "asset-1",
      (async () => Response.json({ deleted: true })) as unknown as typeof fetch,
      "portal-1",
      usageEvents,
    );

    expect(usageRefreshes).toBe(1);
  });
});
