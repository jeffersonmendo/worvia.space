import { NextResponse } from "next/server";
import { getConnectAccountStatus } from "@/lib/billing/connect-account";
import { getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const portalId = new URL(request.url).searchParams.get("portalId");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const portal = portalId
    ? (
        await supabase
          .from("portals")
          .select("id")
          .eq("id", portalId)
          .eq("owner_id", userData.user.id)
          .maybeSingle()
      ).data
    : null;
  if (portalId && !portal)
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  const { data: account } = (await supabase
    .from("creator_stripe_accounts" as never)
    .select(
      "stripe_account_id,account_email,country,display_name,charges_enabled,details_submitted,payouts_enabled,onboarding_status,requirements_pending,verification_state,last_synced_at",
    )
    .eq("owner_id", userData.user.id)
    .maybeSingle()) as {
    data: {
      stripe_account_id: string;
      account_email: string | null;
      country: string | null;
      display_name: string | null;
      charges_enabled: boolean;
      details_submitted: boolean;
      payouts_enabled: boolean;
      onboarding_status: string;
      requirements_pending: number;
      verification_state: string;
      last_synced_at: string | null;
    } | null;
  };
  if (!account) {
    return NextResponse.json({
      accountExists: false,
      connected: false,
      requirementsPending: 0,
      verificationState: "not_started",
      needsSync: false,
    });
  }
  const projectionIsComplete = Boolean(
    account.account_email &&
      account.country &&
      account.display_name &&
      account.last_synced_at,
  );
  const projectionIsFresh = account.last_synced_at
    ? Date.now() - new Date(account.last_synced_at).getTime() <
      24 * 60 * 60 * 1000
    : false;
  if (projectionIsComplete && projectionIsFresh) {
    return NextResponse.json({
      accountEmail: account.account_email,
      accountExists: true,
      accountId: account.stripe_account_id,
      chargesEnabled: account.charges_enabled,
      connected:
        account.onboarding_status === "complete" &&
        account.details_submitted &&
        account.charges_enabled &&
        account.payouts_enabled,
      country: account.country,
      detailsSubmitted: account.details_submitted,
      displayName: account.display_name,
      payoutsEnabled: account.payouts_enabled,
      requirementsPending: account.requirements_pending,
      verificationState: account.verification_state,
      lastSyncedAt: account.last_synced_at,
      needsSync: false,
    });
  }
  const stripeAccount = await getStripe().v2.core.accounts.retrieve(
    account.stripe_account_id,
    { include: ["configuration.merchant", "identity", "requirements"] },
  );
  const {
    detailsSubmitted,
    chargesEnabled,
    payoutsEnabled,
    verificationState,
  } = getConnectAccountStatus(stripeAccount);
  const onboardingStatus =
    detailsSubmitted && chargesEnabled && payoutsEnabled
      ? "complete"
      : "pending";
  const { error } = await supabase.rpc(
    "upsert_creator_stripe_account_projection",
    {
      account_charges_enabled: chargesEnabled,
      account_details_submitted: detailsSubmitted,
      account_id: account.stripe_account_id,
      account_onboarding_status: onboardingStatus,
      account_payouts_enabled: payoutsEnabled,
      account_email: stripeAccount.contact_email ?? null,
      account_country: stripeAccount.identity?.country ?? null,
      account_display_name: stripeAccount.display_name ?? null,
      account_requirements_pending:
        stripeAccount.requirements?.entries?.length ?? 0,
      account_verification_state: verificationState,
      account_last_synced_at: new Date().toISOString(),
    } as never,
  );
  if (error)
    return NextResponse.json(
      { error: "connect_status_failed" },
      { status: 503 },
    );
  return NextResponse.json({
    accountId: account.stripe_account_id,
    accountEmail: stripeAccount.contact_email ?? null,
    accountExists: true,
    chargesEnabled,
    connected: onboardingStatus === "complete",
    country: stripeAccount.identity?.country ?? null,
    detailsSubmitted,
    displayName: stripeAccount.display_name ?? null,
    payoutsEnabled,
    requirementsPending: stripeAccount.requirements?.entries?.length ?? 0,
    verificationState,
    lastSyncedAt: new Date().toISOString(),
    needsSync: false,
  });
}
