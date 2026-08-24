import { describe, expect, test } from "bun:test";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PortalBrandFooter,
  type PortalBrandFooterProps,
} from "./render-portal";

const english = await Bun.file(
  new URL("../../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../../messages/es.json", import.meta.url),
).json();

const publicActionConfig: NonNullable<PortalBrandFooterProps["actionConfig"]> =
  {
    public: {
      slug: "design-system",
      slots: {},
    },
  };

function renderFooter(
  locale: "en" | "es",
  messages: typeof english,
  props: Pick<PortalBrandFooterProps, "actionConfig" | "editor">,
) {
  const t = createTranslator({ locale, messages });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div>
        <section data-testid="portal-content">Portal content</section>
        <PortalBrandFooter
          brand={t("PortalViewer.branding.brand")}
          credit={t("PortalViewer.branding.credit")}
          {...props}
        />
      </div>
    </NextIntlClientProvider>,
  );
}

describe("PortalBrandFooter", () => {
  test.each([
    {
      copy: "This portal was created or powered by ",
      href: "/en",
      locale: "en" as const,
      messages: english,
    },
    {
      copy: "Este portal ha sido creado o potenciado por ",
      href: "/es",
      locale: "es" as const,
      messages: spanish,
    },
  ])(
    "renders the $locale linked brand after an allowed portal's content",
    ({ copy, href, locale, messages }) => {
      const html = renderFooter(locale, messages, {
        actionConfig: publicActionConfig,
      });

      expect(html).toContain(
        `<footer class="flex justify-center lg:col-start-2"><p class="text-sm text-muted-foreground">${copy}<a class="underline underline-offset-4 transition-colors hover:text-blue-600" href="${href}">Worvia</a></p></footer>`,
      );
      expect(html.indexOf("Portal content")).toBeLessThan(
        html.indexOf(copy.trim()),
      );
    },
  );

  test("does not render outside the allowed public viewer", () => {
    expect(renderFooter("es", spanish, {})).not.toContain(
      "Este portal ha sido creado",
    );
    expect(
      renderFooter("es", spanish, {
        actionConfig: publicActionConfig,
        editor: { locale: "es", portalId: "portal-1" },
      }),
    ).not.toContain("Este portal ha sido creado");
  });
});
