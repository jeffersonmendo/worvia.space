import { describe, expect, test } from "bun:test";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalBrandFooter } from "./portal-brand-footer";

const english = await Bun.file(
  new URL("../../../../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../../../../messages/es.json", import.meta.url),
).json();

function renderFooter(
  locale: "en" | "es",
  messages: typeof english,
  props: { styleMode?: "auto" | "desktop" | "mobile" },
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
      copy: "Created with ",
      href: "/en",
      locale: "en" as const,
      messages: english,
    },
    {
      copy: "Creado con ",
      href: "/es",
      locale: "es" as const,
      messages: spanish,
    },
  ])(
    "renders the $locale linked brand after an allowed portal's content",
    ({ copy, href, locale, messages }) => {
      const html = renderFooter(locale, messages, {});

      expect(html).toContain(
        `<footer class="flex justify-center lg:col-start-2"><p class="text-sm text-muted-foreground">${copy}<a class="underline underline-offset-4 transition-colors hover:text-blue-600" href="${href}">Worvia</a></p></footer>`,
      );
      expect(html.indexOf("Portal content")).toBeLessThan(
        html.indexOf(copy.trim()),
      );
    },
  );

  test("does not render outside the allowed public viewer", () => {
    expect(renderFooter("es", spanish, {})).toContain("Worvia");
  });

  test("places branding according to the explicit presentation mode", () => {
    expect(
      renderFooter("en", english, {
        styleMode: "desktop",
      }),
    ).toContain('<footer class="flex justify-center col-start-2">');
    expect(
      renderFooter("en", english, {
        styleMode: "mobile",
      }),
    ).toContain('<footer class="flex justify-center">');
  });
});
