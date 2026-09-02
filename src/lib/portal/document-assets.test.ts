import { expect, test } from "bun:test";
import {
  createDefaultPortalDocument,
  createImageItem,
  createPortalSection,
  portalDocumentToJson,
} from "@/domain/portal/document";

test("serializes managed assets as stable references instead of signed previews", () => {
  const document = createDefaultPortalDocument({
    name: "Portal",
    short_description: null,
    cover_url: null,
    icon_url: null,
    theme: "auto",
  });
  const section = createPortalSection("image", 0);
  section.content.image = {
    ...createImageItem("https://storage.example/signed?token=short-lived", 0),
    asset_id: "asset-1",
    storage_path: "portal/asset-1/photo.png",
  };
  document.sections = [section];
  const json = portalDocumentToJson(document) as unknown as {
    sections: Array<{ content: { image: { image_url: string } } }>;
  };
  expect(json.sections[0]?.content.image.image_url).toBe(
    "portal-asset:asset-1",
  );
});
