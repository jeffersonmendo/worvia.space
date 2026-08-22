import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-home.tsx", import.meta.url),
).text();
const creationSource = await Bun.file(
  new URL("./portal-creation-questionnaire.tsx", import.meta.url),
).text();
const pageSource = await Bun.file(
  new URL("../../app/[locale]/(workspace)/home/page.tsx", import.meta.url),
).text();
const usagePageSource = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/usage/page.tsx",
    import.meta.url,
  ),
).text();
const planProviderSource = await Bun.file(
  new URL("./portal-plan-provider.tsx", import.meta.url),
).text();
const globalStyles = await Bun.file(
  new URL("../../app/globals.css", import.meta.url),
).text();
const english = await Bun.file(
  new URL("../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../messages/es.json", import.meta.url),
).json();

describe("PortalHome", () => {
  test("loads complete localized workspace copy on the server", () => {
    expect(pageSource).toContain(
      'getTranslations({ locale, namespace: "Home" })',
    );
    expect(pageSource).toContain("copy={");
    expect(pageSource).toContain("searchParams");
    expect(pageSource).toContain('query?.connect === "onboarding"');
    expect(source).toContain("portalId");

    for (const messages of [english.Home, spanish.Home]) {
      expect(messages).toBeDefined();
      expect(messages.create.title).toBeString();
      expect(messages.create.visibilityLabel).toBeString();
      expect(messages.create.visibilityPrivate).toBeString();
      expect(messages.create.visibilityPublic).toBeString();
      expect(messages.delete.title).toContain("{name}");
      expect(messages.delete.description).toContain("{name}");
      expect(messages.delete.confirm).toBeString();
      expect(messages.settings.title).toContain("{name}");
      expect(messages.portal.lastEdited).toBeString();
      expect(messages.portal.usage).toBeString();
      expect(messages.portal.fileTypesLabel).toBeString();
      expect(messages.portal.filesCount).toContain("{count, plural,");
      expect(messages.portal.filesCount).toStartWith("+ ");
      expect(messages.portal.colorsLabel).toBeString();
      expect(messages.portal.colorsCount).toContain("{count, plural,");
      expect(messages.portal.colorsCount).toStartWith("+ ");
      expect(messages.portal.noFiles).toBeString();
      expect(messages.portal.noColors).toBeString();
      expect(messages.portal.imagesLabel).toBeString();
      expect(messages.portal.imagesCount).toStartWith("+ ");
      expect(messages.portal.noImages).toBeString();
      expect(messages.portal.visibility.password).toBeString();
      expect(messages.empty.title).toBeString();
      expect(messages.backendDisabled.title).toBeString();
    }

    expect(english.Home.header.createPortal).toBe("Create project");
    expect(english.Home.portal.visibility.public).toBe("Public");
    expect(english.Home.portal.visibility.private).toBe("Private");
    expect(spanish.Home.header.createPortal).toBe("Crear proyecto");
    expect(spanish.Home.portal.visibility.public).toBe("Público");
    expect(spanish.Home.portal.visibility.private).toBe("Privado");
    expect(english.Home.intro).toBeUndefined();
    expect(spanish.Home.intro).toBeUndefined();
    expect(pageSource).toContain('t.raw("delete.description")');
    expect(pageSource).toContain('t.raw("delete.title")');
    expect(pageSource).toContain('t.raw("delete.trigger")');
  });

  test("does not render the Stripe Connect trigger above the projects title", () => {
    const homeDialog = source.slice(
      source.indexOf("{backendEnabled ? ("),
      source.indexOf('<div className="relative mx-auto'),
    );

    expect(homeDialog).toContain("<ConnectAccountDialog");
    expect(homeDialog).toContain("hideTrigger");
  });

  test("uses the official Base UI Combobox for explicit country selection", () => {
    expect(source).toContain('from "@/components/ui/combobox"');
    expect(source).toContain("<Combobox");
    expect(source).toContain("<ComboboxInput");
    expect(source).toContain("<ComboboxList>");
    expect(source).toContain("itemToStringValue");
    expect(source).toContain("useState<string | null>(null)");
    expect(source).toContain("placeholder={copy.country}");
    expect(source).toContain("!country");
    expect(source).toContain(
      "body: JSON.stringify({ country, locale, mode, portalId })",
    );
    expect(source).toContain("shouldOpen");
    expect(source).toContain("/api/billing/connect/status$" + "{query}");
    expect(source).toContain(
      "queryKey: workspaceQueryKeys.connect(initialStatus?.accountId)",
    );
    expect(source).toContain("initialData: initialStatus");
    expect(source).toContain("/api/billing/connect/status${query}");
    expect(source).toContain("staleTime: 30_000");
    expect(source).not.toContain("useState<ConnectStatus | null>");
    expect(source).not.toContain("<Popover");
    expect(source).not.toContain("aria-label={copy.countrySearch}");
  });

  test("uses aggregated initial reads without unconditional home refetches", () => {
    expect(source).toContain(
      "initialDataUpdatedAt: initialError ? 0 : Date.now()",
    );
    expect(source).toContain("staleTime: 30_000");
    expect(source).not.toContain('refetchOnMount: "always"');
    expect(source).not.toContain("staleTime: 0");
    expect(source).toContain("queryClient.invalidateQueries");
  });

  test("keeps usage on its aggregated read while the editor can refresh plans", () => {
    expect(usagePageSource).toContain("getPortalUsageSummary");
    expect(usagePageSource).toContain("initialSnapshot");
    expect(planProviderSource).toContain("if (initialSnapshot) return;");
    expect(planProviderSource).toContain("fetchPortalPlan(portalId)");
  });

  test("creates a wide editorial hierarchy consistent with the landing", () => {
    const workspaceTitleSectionStart = source.indexOf(
      '<section\n          aria-labelledby="portal-workspace-title"',
    );
    expect(source).toContain("const { open: sidebarOpen } = useSidebar();");
    expect(source).toContain('"md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2"');
    expect(source).toContain('"md:grid-cols-1 lg:grid-cols-2"');
    expect(source).toContain("bg-background");
    expect(workspaceTitleSectionStart).toBe(-1);
    expect(source).not.toContain("copy.intro");
    expect(source).not.toContain("bg-brand/10");
    expect(source).toContain("href={");
    expect(source).toContain("/create/");
    expect(creationSource).toContain("<Questionnaire");
    expect(creationSource).toContain("<QuestionnaireInput");
    expect(creationSource).toContain('<SelectItem value="private">');
    expect(creationSource).toContain('<SelectItem value="public">');
    expect(creationSource).toContain("<IconLock />");
    expect(creationSource).toContain("<IconWorld />");
    expect(source).not.toContain('className="dark"');
    expect(source).not.toContain("bg-black");
    expect(source).not.toContain("bg-[#");
    expect(source).toContain("lg:grid-cols-2");
  });

  test("uses a centralized brand purple in both themes", () => {
    const rootTheme = globalStyles.slice(
      globalStyles.indexOf(":root {"),
      globalStyles.indexOf(".dark {"),
    );
    const darkTheme = globalStyles.slice(globalStyles.indexOf(".dark {"));

    expect(globalStyles).toContain("--color-brand: var(--brand);");
    expect(globalStyles).toContain(
      "--color-brand-surface: var(--brand-surface);",
    );
    expect(rootTheme).toContain("--brand: oklch(0.56 0.16 292);");
    expect(rootTheme).toContain("--brand-surface: oklch(0.56 0.18 292 / 18%);");
    expect(darkTheme).toContain("--brand: oklch(0.72 0.14 292);");
    expect(darkTheme).toContain("--brand-surface: oklch(0.72 0.14 292 / 10%);");
    expect(source).not.toContain("bg-primary/5");
    expect(source).not.toContain("bg-[#");
    expect(source).not.toContain('className="dark"');
  });

  test("uses cards that navigate to edit while the slug opens the public portal", () => {
    for (const slot of [
      "CardHeader",
      "CardTitle",
      "CardDescription",
      "Empty",
    ]) {
      expect(source).toContain(`<${slot}`);
    }

    expect(source).toContain("router.push(");
    expect(source).toContain("/create/${" + "portal.id}");
    expect(source).toContain(
      "href={`/p/${" + "encodeURIComponent(portal.slug)}`}",
    );
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain('className="hover:underline"');
    expect(source).not.toContain("buttonVariants(");
    expect(source).not.toMatch(
      /<Link[\s\S]*?<Button[\s\S]*?<\/Button>[\s\S]*?<\/Link>/,
    );
    expect(source).not.toMatch(
      /<a[\s\S]*?<Button[\s\S]*?<\/Button>[\s\S]*?<\/a>/,
    );
  });

  test("keeps portal cards focused on navigation and project status", () => {
    const portalCard = source.slice(
      source.indexOf("function PortalCard"),
      source.indexOf("export function PortalHome"),
    );
    expect(portalCard).not.toContain("deletePortalFromHome");
    expect(portalCard).not.toContain("copy.delete.paidProtected");
    expect(portalCard).not.toContain('<IconTrash data-icon="inline-start" />');
    expect(portalCard).not.toContain("PortalSettingsDialog");
    expect(portalCard).not.toContain("DeletePortalDialog");
    expect(portalCard).not.toContain("copy.portal.edit");
    expect(portalCard).not.toContain("copy.portal.view");
    expect(portalCard).toContain("cursor-pointer");
    expect(portalCard).toContain('className="h-fit');
    expect(portalCard).toContain("flex min-w-0 flex-col items-start");
    expect(portalCard).toContain("storagePercent");
    expect(source).toContain("function UsageCircle");
    expect(source).toContain("text-chart-2");
    expect(portalCard).toContain("IconCreditCardFilled");
    expect(portalCard).toContain("IconWorldFilled");
    expect(portalCard).toContain("IconLockFilled");
    expect(portalCard).toContain("IconKeyFilled");
    expect(portalCard).toContain("copy.portal.plan");
    expect(portalCard).toContain('plan === "free"');
    expect(source).toContain("portal.canDelete");
    expect(source).toContain("copy.delete.paidProtected");
    expect(portalCard).toContain("portal.isPurchased");
    expect(portalCard).toContain("copy.portal.purchasedAt");
    expect(portalCard).toContain("IconCalendarFilled");
    expect(portalCard).toContain("IconCalendarEventFilled");
    expect(portalCard).toContain("copy.portal.lastEdited");
    expect(portalCard).toContain("IconCrownFilled");
    expect(portalCard).toContain("bg-amber-400/20");
    expect(portalCard).toContain("bg-green-500/10");
    expect(portalCard).toContain("text-primary");
    expect(portalCard).toContain("text-muted-foreground");
    expect(portalCard).toContain("PortalFileTypeBadges");
    expect(portalCard).toContain("PortalColorStack");
    expect(portalCard).toContain("portal.fileTypes");
    expect(portalCard).toContain("portal.totalFileCount");
    expect(portalCard).toContain("portal.totalImageCount");
    expect(portalCard).toContain('portalTranslations("filesCount"');
    expect(portalCard).toContain("portal.totalFileCount ?? 0");
    expect(portalCard).toContain('portalTranslations("colorsCount"');
    expect(portalCard).toContain('portalTranslations("imagesCount"');
    expect(portalCard).toContain("portal.images?.length ?? 0");
    expect(portalCard).toContain("portal.colors");
    expect(portalCard).toContain("copy.portal.fileTypesLabel");
    expect(portalCard).toContain("copy.portal.colorsLabel");
    expect(portalCard).toContain("copy.portal.noFiles");
    expect(portalCard).toContain("copy.portal.noColors");
    expect(portalCard).toContain("grid grid-cols-1");
    expect(portalCard).toContain("sm:grid-cols-2");
    expect(portalCard).toContain("PortalImageStack");
    expect(portalCard).toContain("portal.images");
  });

  test("places the plan badge before the favorite action in both card variants", () => {
    const portalCard = source.slice(
      source.indexOf("function PortalCard"),
      source.indexOf("export function PortalHome"),
    );
    const purchasedAction = portalCard.slice(
      portalCard.indexOf("{portal.isPurchased ? ("),
      portalCard.indexOf(
        ") : (",
        portalCard.indexOf("{portal.isPurchased ? ("),
      ),
    );
    const ownedAction = portalCard.slice(
      portalCard.indexOf(
        ") : (",
        portalCard.indexOf("{portal.isPurchased ? ("),
      ),
      portalCard.indexOf("</CardHeader>"),
    );

    for (const action of [purchasedAction, ownedAction]) {
      expect(action.indexOf("<Badge")).toBeGreaterThan(-1);
      expect(action.indexOf("<Button")).toBeGreaterThan(-1);
      expect(action.indexOf("<Badge")).toBeLessThan(action.indexOf("<Button"));
    }
  });

  test("keeps every workspace action pill-shaped or circular", () => {
    const settingsDialog = source.slice(
      source.indexOf("function PortalSettingsDialog"),
      source.indexOf("function DeletePortalDialog"),
    );
    const portalCard = source.slice(
      source.indexOf("function PortalCard"),
      source.indexOf("export function PortalHome"),
    );
    expect(source).not.toContain("function CreatePortalDialog");
    expect(source).toContain("href={");
    expect(source).toContain("/create/");
    expect(settingsDialog.match(/rounded-full/g)).toHaveLength(2);
    expect(portalCard.match(/rounded-full/g)).toBeNull();
    expect(settingsDialog).toContain('size="icon-sm"');
  });
});
