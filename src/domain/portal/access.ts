import type {
  PortalStatus,
  PortalVisibility,
} from "@/lib/supabase/database.types";

export const PORTAL_ACCESS_MAX_AGE_SECONDS = 60 * 60;

export type PortalAccessDecision =
  | "allowed"
  | "not_found"
  | "password_required"
  | "preview_required";

export function canExportPublishedSnapshot(input: {
  decision: PortalAccessDecision;
  hasSnapshot: boolean;
  publishedPublicationId: string | null;
  status: PortalStatus;
}) {
  return (
    input.decision === "allowed" &&
    input.status === "published" &&
    Boolean(input.publishedPublicationId) &&
    input.hasSnapshot
  );
}

export function resolveAccessDecision(input: {
  ownerId: string;
  status: PortalStatus;
  unlocked: boolean;
  userId: string | null;
  visibility: PortalVisibility;
  hasActivePaidAccess?: boolean;
}): PortalAccessDecision {
  if (input.userId === input.ownerId) return "allowed";
  if (input.status !== "published") return "not_found";
  if (input.visibility === "public") return "allowed";
  if (input.visibility === "password") {
    return input.unlocked ? "allowed" : "password_required";
  }
  if (input.visibility === "paid") {
    return input.hasActivePaidAccess ? "allowed" : "preview_required";
  }
  return "not_found";
}

export function accessCookieName(portalId: string) {
  return `portal_access_${portalId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export async function hashOpaqueToken(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createOpaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
