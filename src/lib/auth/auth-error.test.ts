import { describe, expect, test } from "bun:test";
import { getSignUpErrorKey, isAuthenticationRequiredError } from "./auth-error";

describe("auth error classification", () => {
  test("maps Supabase email rate limits to a safe client error key", () => {
    expect(
      getSignUpErrorKey({ message: "Email rate limit exceeded", status: 429 }),
    ).toBe("emailRateLimit");
    expect(getSignUpErrorKey({ code: "over_email_send_rate_limit" })).toBe(
      "emailRateLimit",
    );
  });

  test("does not expose arbitrary provider errors", () => {
    expect(getSignUpErrorKey({ message: "database exploded" })).toBe("failed");
  });

  test("recognizes the portal authentication error", () => {
    expect(
      isAuthenticationRequiredError(new Error("Authentication required")),
    ).toBe(true);
    expect(isAuthenticationRequiredError(new Error("Portal not found"))).toBe(
      false,
    );
  });
});
