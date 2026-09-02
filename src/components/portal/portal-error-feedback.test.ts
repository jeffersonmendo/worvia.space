import { describe, expect, test } from "bun:test";

const controls = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const planProvider = await Bun.file(
  new URL("./portal-plan-provider.tsx", import.meta.url),
).text();
const publishButton = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/_components/publish-portal-button.tsx",
    import.meta.url,
  ),
).text();

describe("portal operation error feedback", () => {
  test("never sends caught technical error messages to upload toasts", () => {
    expect(controls).not.toMatch(
      /toast\.error\([\s\S]{0,120}instanceof Error[\s\S]{0,80}\.message/,
    );
    expect(controls).toContain('toast.error(t("uploadError")');
  });

  test("keeps actionable file-format validation next to the input", () => {
    expect(controls).toContain('setFileValidationError(t("invalidFormat"))');
    expect(controls).toContain(
      "<FieldError>{fileValidationError}</FieldError>",
    );
    expect(controls).not.toContain('toast.error(t("invalidFormat"))');
  });

  test("does not render publication failures as technical text", () => {
    expect(publishButton).not.toContain("error.message");
    expect(controls).not.toContain("{publishError}</p>");
  });

  test("reports plan and checkout failures with localized toasts, not red text", () => {
    expect(planProvider).toContain('toast.error(t("unavailable")');
    expect(planProvider).toContain('t("checkoutUnavailable",');
    expect(planProvider).toContain("reason: error instanceof Error");
    expect(planProvider).not.toContain("checkoutError");
    expect(planProvider).not.toContain('className="text-destructive text-sm"');
  });
});
