import { describe, expect, test } from "bun:test";
import {
  accessCookieName,
  canExportPublishedSnapshot,
  hashOpaqueToken,
  resolveAccessDecision,
} from "./access";

describe("portal access", () => {
  test("allows published public portals and owners", () => {
    expect(
      resolveAccessDecision({
        ownerId: "a",
        status: "published",
        userId: null,
        visibility: "public",
        unlocked: false,
      }),
    ).toBe("allowed");
    expect(
      resolveAccessDecision({
        ownerId: "a",
        status: "draft",
        userId: "a",
        visibility: "private",
        unlocked: false,
      }),
    ).toBe("allowed");
  });

  test("hides private and drafts while gating published password portals", () => {
    expect(
      resolveAccessDecision({
        ownerId: "a",
        status: "published",
        userId: "b",
        visibility: "private",
        unlocked: false,
      }),
    ).toBe("not_found");
    expect(
      resolveAccessDecision({
        ownerId: "a",
        status: "draft",
        userId: null,
        visibility: "public",
        unlocked: false,
      }),
    ).toBe("not_found");
    expect(
      resolveAccessDecision({
        ownerId: "a",
        status: "published",
        userId: null,
        visibility: "password",
        unlocked: false,
      }),
    ).toBe("password_required");
  });

  test("returns a preview decision for unpaid paid portals", () => {
    expect(
      resolveAccessDecision({
        ownerId: "a",
        status: "published",
        userId: "b",
        visibility: "paid",
        unlocked: false,
        hasActivePaidAccess: false,
      }),
    ).toBe("preview_required");
    expect(
      resolveAccessDecision({
        ownerId: "a",
        status: "published",
        userId: "b",
        visibility: "paid",
        unlocked: false,
        hasActivePaidAccess: true,
      }),
    ).toBe("allowed");
  });

  test("uses scoped cookie names and one-way token hashes", async () => {
    expect(accessCookieName("portal-id")).toBe("portal_access_portal-id");
    expect(await hashOpaqueToken("secret")).toHaveLength(64);
    expect(await hashOpaqueToken("secret")).not.toBe(
      await hashOpaqueToken("other"),
    );
  });

  test("fails closed when an export has no published snapshot", () => {
    expect(
      canExportPublishedSnapshot({
        decision: "allowed",
        hasSnapshot: false,
        publishedPublicationId: null,
        status: "published",
      }),
    ).toBe(false);
    expect(
      canExportPublishedSnapshot({
        decision: "allowed",
        hasSnapshot: true,
        publishedPublicationId: "publication-a",
        status: "draft",
      }),
    ).toBe(false);
    expect(
      canExportPublishedSnapshot({
        decision: "allowed",
        hasSnapshot: true,
        publishedPublicationId: "publication-a",
        status: "published",
      }),
    ).toBe(true);
  });
});
