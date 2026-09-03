import { afterEach, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

let asset: Record<string, unknown> | null = {
  category: "gallery",
  file_path: "portal-1/asset-1/image.svg",
  id: "asset-1",
  mime_type: "image/svg+xml",
  name: "image.svg",
  portal_id: "portal-1",
  state: "reserved",
};
let canEdit = true;
let infoError: unknown = null;
let downloadError: unknown = null;
let downloadData: Blob | null = new Blob(["not an SVG"]);
let finalizedError: unknown = null;

const maybeSingle = mock(async () => ({ data: asset, error: null }));
const assetEq = mock(() => ({ maybeSingle }));
const assetSelect = mock(() => ({ eq: assetEq }));
const adminFrom = mock(() => ({ select: assetSelect }));
const adminRpc = mock(async (name: string) => {
  if (name === "finalize_portal_asset_deletion") {
    return { data: true, error: null };
  }
  return {
    data: finalizedError ? null : { id: "asset-1", state: "ready" },
    error: finalizedError,
  };
});
const storage = {
  from: () => ({
    createSignedUrl: async () => ({
      data: { signedUrl: "https://signed.example/asset-1" },
      error: null,
    }),
    download: async () => ({ data: downloadData, error: downloadError }),
    info: async () => ({
      data: { contentType: "image/svg+xml", size: 12 },
      error: infoError,
    }),
    remove: async () => ({ error: null }),
  }),
};

mock.module("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFrom, rpc: adminRpc, storage }),
}));
mock.module("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    rpc: async (name: string) => {
      if (name === "can_edit_portal") return { data: canEdit };
      return { data: "portal-1/asset-1/image.svg", error: null };
    },
  }),
}));

const { PATCH } = await import("./route");

afterEach(() => {
  asset = {
    category: "gallery",
    file_path: "portal-1/asset-1/image.svg",
    id: "asset-1",
    mime_type: "image/svg+xml",
    name: "image.svg",
    portal_id: "portal-1",
    state: "reserved",
  };
  canEdit = true;
  infoError = null;
  downloadError = null;
  downloadData = new Blob(["not an SVG"]);
  finalizedError = null;
});

async function finalize() {
  return PATCH(
    new Request("https://example.com/api/portal-assets", {
      body: JSON.stringify({ assetId: "asset-1" }),
      method: "PATCH",
    }),
  );
}

test("keeps missing and unauthorized assets indistinguishable", async () => {
  asset = null;
  let response = await finalize();
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "asset_not_found" });

  asset = {
    category: "gallery",
    file_path: "portal-1/asset-1/image.svg",
    id: "asset-1",
    mime_type: "image/svg+xml",
    name: "image.svg",
    portal_id: "portal-1",
    state: "reserved",
  };
  canEdit = false;
  response = await finalize();
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "asset_not_found" });
});

test("maps storage and RPC finalization failures to a stable safe error", async () => {
  infoError = { code: "StorageError", message: "storage internals" };
  let response = await finalize();
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "asset_finalization_failed" });

  infoError = null;
  downloadError = { code: "StorageError", message: "download internals" };
  response = await finalize();
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "asset_finalization_failed" });

  downloadError = null;
  if (!asset) throw new Error("Expected test asset to be available");
  asset = { ...asset, category: "file" };
  downloadData = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>']);
  finalizedError = { code: "P0001", message: "RPC internals" };
  response = await finalize();
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "asset_finalization_failed" });
});

test("keeps failed byte validation separate from infrastructure finalization", async () => {
  const response = await finalize();

  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ error: "invalid_asset" });
});
