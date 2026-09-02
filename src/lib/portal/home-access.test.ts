import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

type UserResult = {
  data: { user: { id: string } | null };
  error: { code: string; name: string } | null;
};

let userResult: UserResult = {
  data: { user: { id: "user-1" } },
  error: null,
};
let portalsResult: {
  data: Array<{
    id: string;
    name: string;
    slug: string;
    updated_at: string;
    visibility: "private" | "public";
    hasPurchasedPlan: boolean;
    isPurchased: boolean;
  }>;
  error: null;
} = { data: [], error: null };
let entitlementsResult: { data: Array<{ portal_id: string }>; error: null } = {
  data: [],
  error: null,
};
let grantsResult: { data: Array<{ portal_id: string }>; error: null } = {
  data: [],
  error: null,
};
const homeSummary = {
  portals: [
    {
      id: "portal-1",
      name: "Brand",
      slug: "brand",
      updatedAt: "2026-07-24T00:00:00.000Z",
      visibility: "private",
      hasPurchasedPlan: false,
      isPurchased: false,
      plan: "free",
      storageUsedBytes: 0,
      canDelete: true,
    },
  ],
};

const order = mock(async () => portalsResult);
const eq = mock(() => ({ order }));
const select = mock(() => ({ eq }));
const entitlementIn = mock(async () => entitlementsResult);
const entitlementSelect = mock(() => ({ in: entitlementIn }));
const grantEq = mock((column: string) =>
  column === "status" ? grantsResult : { eq: grantEq },
);
const grantSelect = mock(() => ({ eq: grantEq }));
const from = mock((table: string) =>
  table === "portal_entitlements"
    ? { select: entitlementSelect }
    : table === "paid_portal_access_grants"
      ? { select: grantSelect }
      : { select },
);

mock.module("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => userResult },
    rpc: async () => ({ data: homeSummary, error: null }),
    from,
  }),
}));

const { getHomePortals } = await import("../../app/[locale]/_actions/portals");

afterEach(() => {
  userResult = {
    data: { user: { id: "user-1" } },
    error: null,
  };
  portalsResult = { data: [], error: null };
  entitlementsResult = { data: [], error: null };
  grantsResult = { data: [], error: null };
  from.mockClear();
  select.mockClear();
  eq.mockClear();
  order.mockClear();
  grantEq.mockClear();
  grantSelect.mockClear();
});

describe("home portal access", () => {
  test("loads portals owned by the authenticated user without memberships", async () => {
    portalsResult = {
      data: [
        {
          id: "portal-1",
          name: "Brand",
          slug: "brand",
          updated_at: "2026-07-24T00:00:00.000Z",
          visibility: "private",
          hasPurchasedPlan: false,
          isPurchased: false,
        },
      ],
      error: null,
    };

    await expect(getHomePortals("en")).resolves.toEqual({
      error: null,
      portals: [
        {
          id: "portal-1",
          name: "Brand",
          slug: "brand",
          updated_at: "2026-07-24T00:00:00.000Z",
          visibility: "private",
          hasPurchasedPlan: false,
          isPurchased: false,
          plan: "free",
          storageUsedBytes: 0,
          canDelete: true,
          totalColorCount: 0,
          isFavorite: false,
          purchasedAt: undefined,
          colors: [],
          fileTypes: [],
          images: [],
          totalFileCount: 0,
          totalImageCount: 0,
        },
      ],
    });
    expect(from).not.toHaveBeenCalled();
  });

  test("redirects to sign-in for auth errors before loading portals", async () => {
    userResult = {
      data: { user: null },
      error: { code: "auth_service_unavailable", name: "AuthError" },
    };
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    try {
      await expect(getHomePortals("en")).rejects.toThrow();
      expect(from).not.toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });
});
