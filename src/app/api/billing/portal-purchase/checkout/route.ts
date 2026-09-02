import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { resolveSiteOrigin } from "@/lib/billing/site-origin";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CheckoutAttempt = {
  amount_total: number;
  buyer_id: string;
  currency: string;
  idempotency_key: string;
  portal_id: string;
};
type PaidQuery = {
  eq(column: string, value: string): PaidQuery;
  maybeSingle(): Promise<{ data: unknown }>;
  select(columns: string): PaidQuery;
  update(values: Record<string, string>): PaidQuery;
};

function validLocale(value: unknown) {
  return typeof value === "string" && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value)
    ? value
    : "en";
}

function paidPortalApplicationFee(amountTotal: number) {
  const rate = amountTotal <= 10_000 ? 0.05 : 0.08;
  return Math.floor(amountTotal * rate);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    locale?: string;
    portalId?: string;
  } | null;
  if (!body?.portalId)
    return NextResponse.json({ error: "portal_id_required" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );

  const { data: rawAttempt, error: attemptError } = await supabase.rpc(
    "begin_paid_portal_checkout" as never,
    { target_portal_id: body.portalId } as never,
  );
  const attempt = rawAttempt as unknown as CheckoutAttempt | null;
  if (attemptError || !attempt) {
    const reason = attemptError?.message.includes("Connect")
      ? "connect_onboarding_required"
      : attemptError?.message.includes("available")
        ? "portal_not_available"
        : "checkout_attempt_failed";
    return NextResponse.json(
      { error: reason },
      { status: reason === "portal_not_available" ? 404 : 409 },
    );
  }

  let origin: string;
  try {
    origin = resolveSiteOrigin(
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.NODE_ENV,
    );
  } catch {
    return NextResponse.json({ error: "site_url_invalid" }, { status: 503 });
  }

  const admin = createAdminClient();
  const paidAdmin = admin as unknown as { from: (table: string) => PaidQuery };
  const { data: portal } = await admin
    .from("portals")
    .select("name,slug,owner_id")
    .eq("id", attempt.portal_id)
    .maybeSingle();
  const { data: account } = (await paidAdmin
    .from("creator_stripe_accounts")
    .select(
      "stripe_account_id,onboarding_status,details_submitted,charges_enabled,payouts_enabled",
    )
    .eq("owner_id", portal?.owner_id ?? "")
    .maybeSingle()) as {
    data: {
      stripe_account_id: string;
      onboarding_status: string;
      details_submitted: boolean;
      charges_enabled: boolean;
      payouts_enabled: boolean;
    } | null;
  };
  if (
    !portal ||
    !account ||
    account.onboarding_status !== "complete" ||
    !account.details_submitted ||
    !account.charges_enabled ||
    !account.payouts_enabled
  ) {
    return NextResponse.json(
      { error: "connect_onboarding_required" },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        cancel_url: `${origin}/${validLocale(body.locale)}/p/${portal.slug}?purchase=cancelled`,
        client_reference_id: attempt.portal_id,
        customer_email: userData.user.email,
        line_items: [
          {
            price_data: {
              currency: attempt.currency,
              product_data: { name: `Access to ${portal.name}` },
              unit_amount: attempt.amount_total,
            },
            quantity: 1,
          },
        ],
        metadata: {
          buyer_id: attempt.buyer_id,
          checkout_attempt_id: attempt.idempotency_key,
          portal_id: attempt.portal_id,
          product: "paid_portal_purchase_v1",
        },
        // Stripe Managed Payments is incompatible with Connect charges and
        // application fees for this marketplace checkout.
        managed_payments: { enabled: false } as never,
        mode: "payment",
        payment_intent_data: {
          application_fee_amount: paidPortalApplicationFee(
            attempt.amount_total,
          ),
          metadata: {
            buyer_id: attempt.buyer_id,
            checkout_attempt_id: attempt.idempotency_key,
            portal_id: attempt.portal_id,
            product: "paid_portal_purchase_v1",
          },
        },
        success_url: `${origin}/${validLocale(body.locale)}/p/${portal.slug}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      },
      {
        idempotencyKey: attempt.idempotency_key,
        // Direct charge: the connected merchant is the Stripe account of
        // record, while application_fee_amount retains the platform's
        // 5% fee up to $100 and 8% above $100.
        stripeAccount: account.stripe_account_id,
      },
    );
  } catch (error) {
    console.error("Paid portal checkout session creation failed", {
      code: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
      portalId: attempt.portal_id,
    });
    await paidAdmin
      .from("paid_portal_checkout_attempts")
      .update({ status: "expired" })
      .eq("idempotency_key", attempt.idempotency_key);
    return NextResponse.json(
      { error: "stripe_session_failed" },
      { status: 503 },
    );
  }
  if (!session.url)
    return NextResponse.json(
      { error: "stripe_session_missing_url" },
      { status: 502 },
    );
  await paidAdmin
    .from("paid_portal_checkout_attempts")
    .update({ stripe_checkout_session_id: session.id })
    .eq("idempotency_key", attempt.idempotency_key);
  return NextResponse.json({ checkoutUrl: session.url });
}
