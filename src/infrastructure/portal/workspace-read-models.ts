import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

export const workspaceQueryKeys = {
  home: (locale: string) => ["workspace", "home", locale] as const,
  favorites: (locale: string) => ["workspace", "favorites", locale] as const,
  usage: (portalId: string) => ["workspace", "usage", portalId] as const,
  connect: (accountId?: string) =>
    ["billing", "connect", "summary", accountId ?? "unresolved"] as const,
};

export type ConnectStatusSummary = {
  accountExists: boolean;
  accountId?: string;
  accountEmail: string | null;
  chargesEnabled?: boolean;
  connected: boolean;
  country: string | null;
  detailsSubmitted?: boolean;
  displayName: string | null;
  payoutsEnabled?: boolean;
  requirementsPending: number;
  verificationState:
    | "active"
    | "needs_information"
    | "not_started"
    | "processing";
  lastSyncedAt: string | null;
  needsSync: boolean;
};

export function normalizeConnectStatusSummary(
  value: Json,
): ConnectStatusSummary {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Json>)
      : {};
  const verificationState = record.verificationState;
  const normalizedVerificationState =
    verificationState === "active" ||
    verificationState === "needs_information" ||
    verificationState === "processing"
      ? verificationState
      : "not_started";

  return {
    accountExists: record.accountExists === true,
    accountId:
      typeof record.accountId === "string" ? record.accountId : undefined,
    accountEmail:
      typeof record.accountEmail === "string" ? record.accountEmail : null,
    chargesEnabled: record.chargesEnabled === true,
    connected: record.connected === true,
    country: typeof record.country === "string" ? record.country : null,
    detailsSubmitted: record.detailsSubmitted === true,
    displayName:
      typeof record.displayName === "string" ? record.displayName : null,
    payoutsEnabled: record.payoutsEnabled === true,
    requirementsPending:
      typeof record.requirementsPending === "number"
        ? record.requirementsPending
        : 0,
    verificationState: normalizedVerificationState,
    lastSyncedAt:
      typeof record.lastSyncedAt === "string" ? record.lastSyncedAt : null,
    needsSync: record.needsSync === true,
  };
}

export async function getHomeWorkspaceSummary(
  supabase: SupabaseClient<Database>,
) {
  const { data, error } = await supabase.rpc("get_home_workspace_summary");
  if (error) throw error;
  return (data ?? { portals: [], connect: null }) as Json;
}

export type WorkspaceFavorite = {
  id: string;
  portalId: string;
  name: string;
  slug: string;
  createdAt: string;
  isPurchased: boolean;
};

export function normalizeWorkspaceFavorites(value: Json): WorkspaceFavorite[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, Json>;
    if (
      typeof row.id !== "string" ||
      typeof row.portalId !== "string" ||
      typeof row.name !== "string" ||
      typeof row.slug !== "string"
    )
      return [];
    return [
      {
        id: row.id,
        portalId: row.portalId,
        name: row.name,
        slug: row.slug,
        createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
        isPurchased: row.isPurchased === true,
      },
    ];
  });
}

export async function getRecentWorkspaceFavorites(
  supabase: SupabaseClient<Database>,
  limit = 5,
) {
  const { data, error } = await supabase.rpc("get_recent_workspace_favorites", {
    target_limit: Math.min(Math.max(Math.trunc(limit), 1), 5),
  });
  if (error) throw error;
  return normalizeWorkspaceFavorites(data ?? []);
}

export async function getPortalUsageSummary(
  supabase: SupabaseClient<Database>,
  portalId: string,
) {
  const { data, error } = await supabase.rpc("get_portal_usage_summary", {
    target_portal_id: portalId,
  });
  if (error) throw error;
  return data as Json;
}

export async function getConnectStatusSummary(
  supabase: SupabaseClient<Database>,
) {
  const { data, error } = await supabase.rpc("get_connect_status_summary");
  if (error) throw error;
  return data as Json;
}
