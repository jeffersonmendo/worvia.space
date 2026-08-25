import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("requires an authenticated buyer and delegates all portal gates to the server RPC", () => {
  expect(source).toContain('"authentication_required"');
  expect(source).toContain("begin_paid_portal_checkout");
  expect(source).toContain("target_portal_id: body.portalId");
});

test("uses persisted offer amount/currency and never accepts a body price", () => {
  expect(source).toContain("attempt.amount_total");
  expect(source).toContain("attempt.currency");
  expect(source).not.toContain("body.price");
  expect(source).not.toContain("body.currency");
});

test("keeps buyer metadata separate and uses the tiered direct-charge application fee", () => {
  expect(source).toContain('product: "paid_portal_purchase_v1"');
  expect(source).toContain("amountTotal <= 10_000 ? 0.05 : 0.08");
  expect(source).toContain("Math.floor(amountTotal * rate)");
  expect(source).toContain("managed_payments: { enabled: false }");
  expect(source).not.toContain("transfer_data");
  expect(source).not.toContain("on_behalf_of");
});

test("creates the Checkout Session on the connected account for a direct charge", () => {
  expect(source).toContain("stripeAccount: account.stripe_account_id");
});
