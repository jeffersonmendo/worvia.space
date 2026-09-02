import { describe, expect, test } from "bun:test";

const controlsSource = await Bun.file(
  new URL("../../_components/portal-settings-dialog.tsx", import.meta.url),
).text();
const settingsPageSource = await Bun.file(
  new URL("./settings-view.tsx", import.meta.url),
).text();
const pageSource = await Bun.file(
  new URL("../../page.tsx", import.meta.url),
).text();
const english = await Bun.file(
  new URL("../../../../../../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../../../../../../messages/es.json", import.meta.url),
).json();

describe("portal settings dialog", () => {
  test("groups general and security settings in one tabbed dialog", () => {
    const settingsDialog = controlsSource.slice(
      controlsSource.indexOf("export function SettingsDialog"),
    );

    expect(settingsDialog).toContain("<Tabs");
    expect(settingsDialog).toContain("<TabsList");
    expect(settingsDialog).toContain('<TabsTrigger value="general">');
    expect(settingsDialog).toContain('<TabsTrigger value="security">');
    expect(settingsDialog).toContain('<TabsContent value="general">');
    expect(settingsDialog).toContain('<TabsContent value="security">');
    expect(settingsDialog).toContain("savePrivacySettings");
    expect(settingsDialog).toMatch(
      /activeTab === "security"\s*\? t\("privacyDescription"\)\s*: t\("generalDescription"\)/,
    );
    expect(settingsDialog).toContain("value={activeTab}");
    expect(settingsDialog).toContain("onValueChange={setActiveTab}");
  });

  test("removes the dedicated privacy action from the floating toolbar", () => {
    expect(pageSource).not.toContain("PrivacySettingsDialog");
    expect(pageSource).toContain("<SettingsDialog");
  });

  test("localizes both tab labels", () => {
    expect(english.PortalEditor.settings.generalTab).toBe("General");
    expect(english.PortalEditor.settings.securityTab).toBe("Security");
    expect(spanish.PortalEditor.settings.generalTab).toBe("General");
    expect(spanish.PortalEditor.settings.securityTab).toBe("Seguridad");
    expect(controlsSource).toContain('portal.visibility === "paid"');
    expect(controlsSource).toContain('name="visibility"');
    expect(controlsSource).toContain('type="hidden"');
    expect(controlsSource).toContain('value="paid"');
    expect(english.PortalEditor.settings.paidImmutable).not.toContain(
      "permanent",
    );
    expect(spanish.PortalEditor.settings.paidImmutable).not.toContain(
      "permanente",
    );
    expect(controlsSource).toContain("<output");
    expect(controlsSource).toContain('id="paid-visibility-label"');
    expect(controlsSource).toContain("setPendingFormData(null);");
    expect(controlsSource).toContain("onPaidConfirmationClose?.();");
    expect(controlsSource).toContain("paidConfirmation");
    expect(controlsSource).toContain("event.preventDefault()");
    expect(controlsSource).toContain('get("visibility") === "paid"');
    expect(english.PortalEditor.settings.paidConfirmationDescription).toContain(
      "permanent",
    );
    expect(spanish.PortalEditor.settings.paidConfirmationDescription).toContain(
      "permanente",
    );
  });

  test("explains that the content language controls AI-generated copy", () => {
    expect(english.PortalEditor.settings.aiLanguageDescription).toContain("AI");
    expect(english.PortalEditor.settings.aiLanguageDescription).toContain(
      "does not change",
    );
    expect(spanish.PortalEditor.settings.aiLanguageDescription).toContain("IA");
    expect(spanish.PortalEditor.settings.aiLanguageDescription).toContain(
      "no cambia",
    );
    expect(settingsPageSource).toContain('name="content_language"');
  });
});
