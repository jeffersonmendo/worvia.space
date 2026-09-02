import { describe, expect, test } from "bun:test";
import type { PortalDocument } from "@/domain/portal/document";
import { portalAssetIds } from "./portal-asset-lifecycle";

const document: PortalDocument = {
  portal: { description: "", name: "Project", theme: "light" },
  sections: [
    {
      allow_download: true,
      content: {
        files: [
          {
            asset_id: "file-asset",
            allow_download: true,
            file_name: "source.pdf",
            file_url: "https://example.com/source.pdf",
            id: "file",
            position: 0,
            visible: true,
          },
        ],
        image: {
          asset_id: "image-asset",
          allow_download: true,
          alt_text: "",
          aspect_ratio: "auto",
          fit: "cover",
          id: "image",
          image_url: "https://example.com/image.png",
          position: 0,
          visible: true,
        },
      },
      description: "",
      id: "section",
      layout: {},
      position: 0,
      title: "",
      type: "image",
      visible: true,
    },
  ],
  version: 1,
};

describe("portalAssetIds", () => {
  test("collects asset references across supported section content", () => {
    expect([...portalAssetIds(document)]).toEqual([
      "image-asset",
      "file-asset",
    ]);
  });
});
