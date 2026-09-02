import { describe, expect, test } from "bun:test";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalSection } from "@/domain/portal/document";
import en from "../../../messages/en.json";
import { FontsEditor } from "./portal-workspace-controls";

const section: PortalSection = {
  allow_download: true,
  content: {
    fonts: [
      {
        font_name: "Raleway",
        id: "regular",
        position: 0,
        sample_description: "Editorial description",
        sample_text: "Editorial sample",
        visible: true,
        weight: 400,
      },
    ],
    type_scale_settings: { base_size: 24, ratio: 1.1 },
  },
  description: "",
  id: "typography",
  layout: {},
  position: 0,
  title: "Typography",
  type: "fonts",
  visible: true,
};

describe("FontsEditor typography presentation", () => {
  test("keeps persisted scale settings internal without rendering controls", () => {
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        messages={en}
        onError={() => undefined}
      >
        <FontsEditor
          portalId="portal"
          section={section}
          updateSection={() => undefined}
        />
      </NextIntlClientProvider>,
    );

    expect(markup).not.toContain(">Base<");
    expect(markup).not.toContain(">Ratio<");
    expect(markup).not.toContain('role="slider"');
    expect(markup).not.toContain('type="range"');
    expect(markup).not.toContain("font-size:24px");
    expect(markup).toContain("font-size:2.25rem");
    expect(markup.match(/data-slot="typography-style-row"/g)).toHaveLength(6);
    expect(markup).toContain("Heading 4");
    expect(markup).toContain("Caption");
    expect(markup).not.toContain("Editorial sample");
    expect(markup).not.toContain("Editorial description");
  });
});
