import { describe, expect, test } from "bun:test";
import {
  areAssetMimeTypesCompatible,
  inferAssetMimeType,
  isRenderableImageMimeType,
  normalizeAssetMimeType,
  portalAssetInputAccept,
  preflightAiPortalAssetBatch,
  preflightPortalAssetBatch,
  preflightPortalAssetSelection,
  validateAssetBytes,
  validateAssetDeclaration,
} from "./asset-validation";

describe("portal asset validation", () => {
  test("keeps Photoshop work files out of the renderable image category", () => {
    expect(isRenderableImageMimeType("image/jpeg")).toBe(true);
    expect(isRenderableImageMimeType("image/vnd.adobe.photoshop")).toBe(false);
    expect(isRenderableImageMimeType("image/svg+xml")).toBe(false);
  });

  const indesignSignature = new Uint8Array([
    0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7,
    0xfe, 0x74, 0xb7, 0x1d,
  ]);

  function idmlCentralDirectory(entries: string[]) {
    const encoder = new TextEncoder();
    const localChunks = entries.map((name) => {
      const encoded = encoder.encode(name);
      const chunk = new Uint8Array(30 + encoded.length);
      chunk.set([0x50, 0x4b, 0x03, 0x04]);
      chunk[26] = encoded.length & 0xff;
      chunk[27] = encoded.length >> 8;
      chunk.set(encoded, 30);
      return chunk;
    });
    let localOffset = 0;
    const centralChunks = entries.map((name, index) => {
      const encoded = new TextEncoder().encode(name);
      const chunk = new Uint8Array(46 + encoded.length);
      chunk.set([0x50, 0x4b, 0x01, 0x02]);
      chunk[28] = encoded.length & 0xff;
      chunk[29] = encoded.length >> 8;
      chunk[42] = localOffset & 0xff;
      chunk[43] = (localOffset >> 8) & 0xff;
      chunk[44] = (localOffset >> 16) & 0xff;
      chunk[45] = (localOffset >> 24) & 0xff;
      chunk.set(encoded, 46);
      localOffset += localChunks[index]?.length ?? 0;
      return chunk;
    });
    const centralSize = centralChunks.reduce(
      (total, chunk) => total + chunk.length,
      0,
    );
    const zip = new Uint8Array(localOffset + centralSize + 22);
    let offset = 0;
    for (const chunk of localChunks) {
      zip.set(chunk, offset);
      offset += chunk.length;
    }
    const centralOffset = offset;
    for (const chunk of centralChunks) {
      zip.set(chunk, offset);
      offset += chunk.length;
    }
    zip.set([0x50, 0x4b, 0x05, 0x06], offset);
    zip[offset + 8] = entries.length & 0xff;
    zip[offset + 9] = entries.length >> 8;
    zip[offset + 10] = entries.length & 0xff;
    zip[offset + 11] = entries.length >> 8;
    for (let byte = 0; byte < 4; byte++) {
      zip[offset + 12 + byte] = (centralSize >>> (byte * 8)) & 0xff;
      zip[offset + 16 + byte] = (centralOffset >>> (byte * 8)) & 0xff;
    }
    return zip;
  }

  function oversizedIdmlCentralDirectory() {
    const entries = [
      "designmap.xml",
      "META-INF/container.xml",
      "Stories/Story_u1.xml",
      ...Array.from({ length: 797 }, (_, index) => `Resources/item-${index}`),
    ];
    const encoder = new TextEncoder();
    const extraLength = 60 * 1024;
    const localSize = entries.reduce(
      (total, name) => total + 30 + encoder.encode(name).length,
      0,
    );
    const centralSize = entries.reduce(
      (total, name) => total + 46 + encoder.encode(name).length + extraLength,
      0,
    );
    const zip = new Uint8Array(localSize + centralSize + 22);
    let localOffset = 0;
    const localOffsets: number[] = [];
    for (const name of entries) {
      const encoded = encoder.encode(name);
      localOffsets.push(localOffset);
      zip.set([0x50, 0x4b, 0x03, 0x04], localOffset);
      zip[localOffset + 26] = encoded.length & 0xff;
      zip[localOffset + 27] = encoded.length >> 8;
      zip.set(encoded, localOffset + 30);
      localOffset += 30 + encoded.length;
    }
    let offset = localOffset;
    entries.forEach((name, index) => {
      const encoded = encoder.encode(name);
      zip.set([0x50, 0x4b, 0x01, 0x02], offset);
      zip[offset + 28] = encoded.length & 0xff;
      zip[offset + 29] = encoded.length >> 8;
      zip[offset + 30] = extraLength & 0xff;
      zip[offset + 31] = extraLength >> 8;
      const targetLocalOffset = localOffsets[index] ?? 0;
      for (let byte = 0; byte < 4; byte++)
        zip[offset + 42 + byte] = (targetLocalOffset >>> (byte * 8)) & 0xff;
      zip.set(encoded, offset + 46);
      offset += 46 + encoded.length + extraLength;
    });
    zip.set([0x50, 0x4b, 0x05, 0x06], offset);
    zip[offset + 8] = entries.length & 0xff;
    zip[offset + 9] = entries.length >> 8;
    zip[offset + 10] = entries.length & 0xff;
    zip[offset + 11] = entries.length >> 8;
    for (let byte = 0; byte < 4; byte++) {
      zip[offset + 12 + byte] = (centralSize >>> (byte * 8)) & 0xff;
      zip[offset + 16 + byte] = (localSize >>> (byte * 8)) & 0xff;
    }
    return zip;
  }

  test("normalizes MIME casing and parameters before finalization checks", () => {
    expect(normalizeAssetMimeType(" Text/Plain;Charset=UTF-8 ")).toBe(
      "text/plain",
    );
    expect(normalizeAssetMimeType("APPLICATION/OCTET-STREAM")).toBe(
      "application/octet-stream",
    );
  });

  test.each([
    ["art.ai", "application/illustrator", "application/vnd.adobe.illustrator"],
    ["template.ait", "application/pdf", "application/illustrator"],
    ["mark.eps", "application/postscript", "application/postscript"],
    ["mockup.psd", "image/vnd.adobe.photoshop", "application/x-photoshop"],
    ["large.psb", "application/vnd.adobe.photoshop", "image/x-photoshop"],
    ["layout.indd", "application/x-indesign", "application/vnd.adobe.indesign"],
    [
      "template.indt",
      "application/vnd.adobe.indesign",
      "application/x-indesign",
    ],
    [
      "book.idml",
      "application/vnd.adobe.indesign-idml-package",
      "application/zip",
    ],
  ])(
    "treats allowlisted Storage MIME aliases as compatible for %s",
    (name, reservedMime, storedMime) => {
      expect(areAssetMimeTypesCompatible(name, reservedMime, storedMime)).toBe(
        true,
      );
      expect(
        areAssetMimeTypesCompatible(
          name,
          reservedMime,
          "application/octet-stream",
        ),
      ).toBe(false);
      expect(areAssetMimeTypesCompatible(name, reservedMime, "image/png")).toBe(
        false,
      );
    },
  );

  test("rejects generic MIME and extension/category mismatches", () => {
    expect(
      validateAssetDeclaration({
        category: "image",
        mimeType: "application/octet-stream",
        name: "photo.png",
      }),
    ).toBe(false);
    expect(
      validateAssetDeclaration({
        category: "image",
        mimeType: "application/pdf",
        name: "photo.pdf",
      }),
    ).toBe(false);
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType: "application/pdf",
        name: "brief.pdf",
      }),
    ).toBe(true);
  });

  test("falls back to the extension when the browser reports an unknown MIME", () => {
    expect(inferAssetMimeType("mockup.psd", "image/psd")).toBe(
      "image/vnd.adobe.photoshop",
    );
  });

  test("allows SVG declarations only for galleries and scans their content", () => {
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType: "image/svg+xml",
        name: "logo.svg",
      }),
    ).toBe(true);
    expect(
      validateAssetDeclaration({
        category: "gallery",
        mimeType: "image/svg+xml",
        name: "logo.svg",
      }),
    ).toBe(true);
    expect(
      validateAssetDeclaration({
        category: "image",
        mimeType: "image/svg+xml",
        name: "logo.svg",
      }),
    ).toBe(false);
    for (const category of ["cover", "icon"] as const) {
      expect(
        validateAssetDeclaration({
          category,
          mimeType: "image/svg+xml",
          name: "logo.svg",
        }),
      ).toBe(false);
    }
    expect(
      validateAssetBytes(
        new TextEncoder().encode('<svg><path d="M0 0" /></svg>'),
        "image/svg+xml",
        "logo.svg",
      ),
    ).toBe(true);
    expect(
      validateAssetBytes(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      validateAssetBytes(new TextEncoder().encode("not png"), "image/png"),
    ).toBe(false);
    expect(
      validateAssetBytes(
        new TextEncoder().encode("<svg><script>alert(1)</script></svg>"),
        "image/svg+xml",
      ),
    ).toBe(false);
    for (const activeContent of [
      "<foreignObject><div>unsafe</div></foreignObject>",
      '<a href="javascript:alert(1)">x</a>',
      '<path onclick="alert(1)" />',
    ]) {
      expect(
        validateAssetBytes(
          new TextEncoder().encode(`<svg>${activeContent}</svg>`),
          "image/svg+xml",
        ),
      ).toBe(false);
    }

    const delayedScript = `<svg>${" ".repeat(65 * 1024)}<script>alert(1)</script></svg>`;
    expect(
      validateAssetBytes(
        new TextEncoder().encode(delayedScript),
        "image/svg+xml",
      ),
    ).toBe(false);
  });

  test("preflights plain gallery SVGs but rejects external-DOCTYPE SVGs before upload", async () => {
    const plainSvg = new File(['<svg><path d="M0 0" /></svg>'], "logo.svg", {
      type: "image/svg+xml",
    });
    const externalDoctypeSvg = new File(
      [
        '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg />',
      ],
      "external.svg",
      { type: "image/svg+xml" },
    );

    await expect(
      preflightPortalAssetSelection("gallery", plainSvg),
    ).resolves.toBe(true);
    await expect(
      preflightPortalAssetSelection("gallery", externalDoctypeSvg),
    ).resolves.toBe(false);
  });

  test("preflights File selections from the server declaration allowlist", async () => {
    const supportedFile = new File(["%PDF-1.7"], "guide.pdf", {
      type: "application/pdf",
    });
    const unsupportedFile = new File(["binary"], "payload.zip", {
      type: "application/zip",
    });

    expect(portalAssetInputAccept("file")).toContain(".pdf");
    expect(portalAssetInputAccept("file")).toContain(".woff2");
    expect(portalAssetInputAccept("file")).toContain(".png");
    await expect(
      preflightPortalAssetSelection("file", supportedFile),
    ).resolves.toBe(true);
    await expect(
      preflightPortalAssetSelection("file", unsupportedFile),
    ).resolves.toBe(false);
  });

  test("keeps valid Gallery batch files in order while skipping an external-DOCTYPE SVG", async () => {
    const first = new File(["<svg><path /></svg>"], "first.svg", {
      type: "image/svg+xml",
    });
    const rejected = new File(
      ['<!DOCTYPE svg SYSTEM "https://example.com/svg.dtd"><svg />'],
      "external.svg",
      { type: "image/svg+xml" },
    );
    const last = new File(["<svg><circle /></svg>"], "last.svg", {
      type: "image/svg+xml",
    });

    await expect(
      preflightPortalAssetBatch("gallery", [first, rejected, last]),
    ).resolves.toEqual({ acceptedFiles: [first, last], rejectedFileCount: 1 });
  });

  test("keeps valid Files batch files in order while skipping invalid SVGs and unsupported files", async () => {
    const first = new File(["%PDF-1.7"], "first.pdf", {
      type: "application/pdf",
    });
    const rejectedSvg = new File(
      ['<!DOCTYPE svg SYSTEM "https://example.com/svg.dtd"><svg />'],
      "external.svg",
      { type: "image/svg+xml" },
    );
    const rejectedFile = new File(["binary"], "payload.zip", {
      type: "application/zip",
    });
    const last = new File(["Notes"], "last.txt", { type: "text/plain" });

    await expect(
      preflightPortalAssetBatch("file", [
        first,
        rejectedSvg,
        rejectedFile,
        last,
      ]),
    ).resolves.toEqual({ acceptedFiles: [first, last], rejectedFileCount: 2 });
  });

  test("returns no accepted Files when every selected file is unsupported", async () => {
    const unsupportedFile = new File(["binary"], "payload.zip", {
      type: "application/zip",
    });

    await expect(
      preflightPortalAssetBatch("file", [unsupportedFile]),
    ).resolves.toEqual({ acceptedFiles: [], rejectedFileCount: 1 });
  });

  test("keeps accepted AI creation attachments in order and rejects external SVGs", async () => {
    const first = new File(["%PDF-1.7"], "brief.pdf", {
      type: "application/pdf",
    });
    const rejected = new File(
      ['<!DOCTYPE svg SYSTEM "https://example.com/svg.dtd"><svg />'],
      "external.svg",
      { type: "image/svg+xml" },
    );
    const last = new File(["Notes"], "notes.txt", { type: "text/plain" });

    await expect(
      preflightAiPortalAssetBatch([first, rejected, last]),
    ).resolves.toEqual({ acceptedFiles: [first, last], rejectedFileCount: 1 });
  });

  test("returns no AI creation attachments when every file is rejected", async () => {
    const rejectedSvg = new File(
      ['<!DOCTYPE svg SYSTEM "https://example.com/svg.dtd"><svg />'],
      "external.svg",
      { type: "image/svg+xml" },
    );
    const unsupportedFile = new File(["binary"], "payload.zip", {
      type: "application/zip",
    });

    await expect(
      preflightAiPortalAssetBatch([rejectedSvg, unsupportedFile]),
    ).resolves.toEqual({ acceptedFiles: [], rejectedFileCount: 2 });
  });

  test.each([
    ["photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff]],
    ["animation.gif", "image/gif", [0x47, 0x49, 0x46, 0x38]],
    [
      "image.webp",
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    ],
    [
      "image.avif",
      "image/avif",
      [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
    ],
  ])(
    "keeps validating the current raster format %s",
    (name, mimeType, bytes) => {
      expect(
        validateAssetDeclaration({ category: "image", mimeType, name }),
      ).toBe(true);
      expect(validateAssetBytes(new Uint8Array(bytes), mimeType, name)).toBe(
        true,
      );
    },
  );

  test.each([
    "application/illustrator",
    "application/vnd.adobe.illustrator",
    "application/x-illustrator",
    "application/postscript",
    "application/pdf",
  ])("accepts the legitimate Illustrator MIME variant %s", (mimeType) => {
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType,
        name: "brand.ai",
      }),
    ).toBe(true);
    expect(inferAssetMimeType("brand.ai", mimeType)).toBe(mimeType);
  });

  test("recognizes known PostScript and PDF-compatible Illustrator signatures", () => {
    expect(
      validateAssetBytes(
        new TextEncoder().encode("%!PS-Adobe-3.0"),
        "application/postscript",
      ),
    ).toBe(true);
    expect(
      validateAssetBytes(
        new TextEncoder().encode("%PDF-1.7"),
        "application/pdf",
      ),
    ).toBe(true);
    expect(
      validateAssetBytes(
        new TextEncoder().encode("not an Illustrator file"),
        "application/x-illustrator",
      ),
    ).toBe(false);
  });

  test("accepts a PDF-compatible .ai when the browser omits MIME", () => {
    const mimeType = inferAssetMimeType("brand.ai", "");

    expect(mimeType).toBe("application/illustrator");
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType,
        name: "brand.ai",
      }),
    ).toBe(true);
    expect(
      validateAssetBytes(
        new TextEncoder().encode("%PDF-1.7"),
        mimeType,
        "brand.ai",
      ),
    ).toBe(true);
  });

  test.each([
    {
      bytes: "%PDF-1.7",
      expectedMime: "application/pdf",
      name: "guide.pdf",
      providedMime: "",
    },
    {
      bytes: "Plain UTF-8 notes",
      expectedMime: "text/plain",
      name: "notes.txt",
      providedMime: "application/octet-stream",
    },
    {
      bytes: "# Brand guide\n\nSafe markdown.",
      expectedMime: "text/markdown",
      name: "README.md",
      providedMime: "",
    },
    {
      bytes: "8BPS\u0000\u0001",
      expectedMime: "image/vnd.adobe.photoshop",
      name: "mockup.psd",
      providedMime: "application/octet-stream",
    },
    {
      bytes: "%!PS-Adobe-3.0 EPSF-3.0",
      expectedMime: "application/postscript",
      name: "mark.eps",
      providedMime: "application/octet-stream",
    },
  ])(
    "infers, declares, and validates $name without trusting a generic MIME",
    ({ bytes, expectedMime, name, providedMime }) => {
      const mimeType = inferAssetMimeType(name, providedMime);
      expect(mimeType).toBe(expectedMime);
      expect(
        validateAssetDeclaration({ category: "file", mimeType, name }),
      ).toBe(true);
      expect(
        validateAssetBytes(new TextEncoder().encode(bytes), mimeType),
      ).toBe(true);
    },
  );

  test("rejects binary content disguised as text or Markdown", () => {
    const binary = new Uint8Array([0x00, 0xff, 0x00, 0x10]);
    expect(validateAssetBytes(binary, "text/plain")).toBe(false);
    expect(validateAssetBytes(binary, "text/markdown")).toBe(false);

    const lateNull = new Uint8Array(70 * 1024).fill(0x41);
    lateNull[lateNull.length - 1] = 0;
    expect(validateAssetBytes(lateNull, "text/markdown")).toBe(false);
  });

  test("accepts UTF-16 text files", () => {
    const utf16 = new Uint8Array([
      0xff, 0xfe, 0x46, 0x00, 0x6f, 0x00, 0x6e, 0x00, 0x74, 0x00, 0x73, 0x00,
      0x2e, 0x00, 0x74, 0x00, 0x78, 0x00, 0x74, 0x00,
    ]);
    expect(validateAssetBytes(utf16, "text/plain", "Fonts.txt")).toBe(true);
  });

  test("accepts UTF-16 text files without a BOM", () => {
    const utf16WithoutBom = new Uint8Array([
      0x46, 0x00, 0x6f, 0x00, 0x6e, 0x00, 0x74, 0x00, 0x73, 0x00, 0x2e, 0x00,
      0x74, 0x00, 0x78, 0x00, 0x74, 0x00,
    ]);
    expect(validateAssetBytes(utf16WithoutBom, "text/plain", "Fonts.txt")).toBe(
      true,
    );
  });

  test("accepts the legacy browser Markdown MIME without treating it as binary", () => {
    const mimeType = inferAssetMimeType("README.md", "text/x-markdown");
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType,
        name: "README.md",
      }),
    ).toBe(true);
    expect(
      validateAssetBytes(new TextEncoder().encode("# Safe"), mimeType),
    ).toBe(true);
  });

  test("accepts an empty text file", () => {
    expect(
      validateAssetBytes(new Uint8Array(), "text/plain", "Fonts.txt"),
    ).toBe(true);
  });

  test.each([
    ["template.ait", "application/illustrator", "%PDF-1.7"],
    ["large.psb", "image/vnd.adobe.photoshop", "8BPS\u0000\u0002"],
  ])("accepts the known signature for %s", (name, mimeType, content) => {
    expect(validateAssetDeclaration({ category: "file", mimeType, name })).toBe(
      true,
    );
    expect(
      validateAssetBytes(new TextEncoder().encode(content), mimeType, name),
    ).toBe(true);
  });

  test.each([
    ["opaque.ai", "application/illustrator"],
    ["opaque.ait", "application/illustrator"],
    ["opaque.eps", "application/postscript"],
    ["opaque.psd", "image/vnd.adobe.photoshop"],
    ["opaque.psb", "image/vnd.adobe.photoshop"],
    ["opaque.indd", "application/x-indesign"],
    ["opaque.indt", "application/x-indesign"],
  ])(
    "accepts non-executable opaque Adobe work content for %s",
    (name, mimeType) => {
      const bytes = new TextEncoder().encode("opaque proprietary work data");
      expect(
        validateAssetDeclaration({ category: "file", mimeType, name }),
      ).toBe(true);
      expect(validateAssetBytes(bytes, mimeType, name)).toBe(true);
    },
  );

  test.each(["layout.indd", "template.indt"])(
    "accepts native InDesign signature for %s",
    (name) => {
      const mimeType = "application/x-indesign";
      expect(
        validateAssetDeclaration({ category: "file", mimeType, name }),
      ).toBe(true);
      expect(validateAssetBytes(indesignSignature, mimeType, name)).toBe(true);
    },
  );

  test("accepts IDML only when the ZIP central directory has InDesign structure", () => {
    const mimeType = "application/vnd.adobe.indesign-idml-package";
    const valid = idmlCentralDirectory([
      "designmap.xml",
      "META-INF/container.xml",
      "Stories/Story_u1.xml",
    ]);
    const genericZip = idmlCentralDirectory(["notes.txt"]);
    const executableZip = idmlCentralDirectory([
      "designmap.xml",
      "META-INF/container.xml",
      "Stories/Story_u1.xml",
      "payload.exe",
    ]);
    const forgedPayload = new TextEncoder().encode(
      "PK designmap.xml META-INF/container.xml Stories/Story_u1.xml",
    );
    const invalidCentralOffset = valid.slice();
    const invalidEntryCount = valid.slice();
    const invalidLocalOffset = valid.slice();
    const inconsistentCrc = valid.slice();
    const inconsistentCompressedSize = valid.slice();
    const inconsistentUncompressedSize = valid.slice();
    const dataDescriptor = valid.slice();
    const oversizedName = idmlCentralDirectory([
      "designmap.xml",
      "META-INF/container.xml",
      "Stories/Story_u1.xml",
      `Resources/${"a".repeat(1_025)}.xml`,
    ]);
    const oversizedTotalNames = idmlCentralDirectory([
      "designmap.xml",
      "META-INF/container.xml",
      "Stories/Story_u1.xml",
      ...Array.from(
        { length: 1_100 },
        (_, index) => `Resources/${index}-${"a".repeat(970)}`,
      ),
    ]);
    const eocdOffset = valid.length - 22;
    invalidCentralOffset[eocdOffset + 16] = 0xff;
    invalidEntryCount[eocdOffset + 10]++;
    const centralOffset = new DataView(
      valid.buffer,
      valid.byteOffset,
      valid.byteLength,
    ).getUint32(eocdOffset + 16, true);
    invalidLocalOffset[centralOffset + 42] = 1;
    inconsistentCrc[centralOffset + 16] = 1;
    inconsistentCompressedSize[18] = 1;
    inconsistentUncompressedSize[centralOffset + 24] = 1;
    dataDescriptor[6] = 8;
    dataDescriptor[centralOffset + 8] = 8;

    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType,
        name: "book.idml",
      }),
    ).toBe(true);
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType: "application/zip",
        name: "payload.zip",
      }),
    ).toBe(false);
    expect(validateAssetBytes(valid, mimeType, "book.idml")).toBe(true);
    expect(validateAssetBytes(genericZip, mimeType, "book.idml")).toBe(false);
    expect(validateAssetBytes(forgedPayload, mimeType, "book.idml")).toBe(
      false,
    );
    expect(
      validateAssetBytes(invalidCentralOffset, mimeType, "book.idml"),
    ).toBe(false);
    expect(validateAssetBytes(invalidEntryCount, mimeType, "book.idml")).toBe(
      false,
    );
    expect(validateAssetBytes(invalidLocalOffset, mimeType, "book.idml")).toBe(
      false,
    );
    expect(validateAssetBytes(inconsistentCrc, mimeType, "book.idml")).toBe(
      false,
    );
    expect(
      validateAssetBytes(inconsistentCompressedSize, mimeType, "book.idml"),
    ).toBe(false);
    expect(
      validateAssetBytes(inconsistentUncompressedSize, mimeType, "book.idml"),
    ).toBe(false);
    expect(validateAssetBytes(dataDescriptor, mimeType, "book.idml")).toBe(
      false,
    );
    expect(validateAssetBytes(oversizedName, mimeType, "book.idml")).toBe(
      false,
    );
    expect(validateAssetBytes(oversizedTotalNames, mimeType, "book.idml")).toBe(
      false,
    );
    expect(validateAssetBytes(executableZip, mimeType, "book.idml")).toBe(
      false,
    );
  });

  test("bounds invalid IDML inspection to the ZIP metadata regions", () => {
    const bytes = new Uint8Array(50 * 1024 * 1024);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    const eocdOffset = bytes.length - 22;
    bytes.set([0x50, 0x4b, 0x05, 0x06], eocdOffset);
    bytes[eocdOffset + 8] = 1;
    bytes[eocdOffset + 10] = 1;
    const centralSize = eocdOffset;
    for (let byte = 0; byte < 4; byte++)
      bytes[eocdOffset + 12 + byte] = (centralSize >>> (byte * 8)) & 0xff;

    const startedAt = performance.now();
    expect(
      validateAssetBytes(
        bytes,
        "application/vnd.adobe.indesign-idml-package",
        "forged.idml",
      ),
    ).toBe(false);
    expect(performance.now() - startedAt).toBeLessThan(250);
  });

  test("rejects an oversized coherent IDML central directory quickly", () => {
    const bytes = oversizedIdmlCentralDirectory();
    expect(bytes.length).toBeGreaterThan(45 * 1024 * 1024);
    expect(bytes.length).toBeLessThan(50 * 1024 * 1024);

    const startedAt = performance.now();
    expect(
      validateAssetBytes(
        bytes,
        "application/vnd.adobe.indesign-idml-package",
        "oversized.idml",
      ),
    ).toBe(false);
    expect(performance.now() - startedAt).toBeLessThan(250);
  });

  test.each([
    ["scan.tif", "image/tiff", [0x49, 0x49, 0x2a, 0x00]],
    ["scan.tiff", "image/tiff", [0x4d, 0x4d, 0x00, 0x2a]],
  ])("accepts TIFF signature for %s", (name, mimeType, signature) => {
    const bytes = new Uint8Array(signature as number[]);
    expect(validateAssetDeclaration({ category: "file", mimeType, name })).toBe(
      true,
    );
    expect(validateAssetBytes(bytes, mimeType, name)).toBe(true);
    expect(
      validateAssetDeclaration({ category: "image", mimeType, name }),
    ).toBe(false);
  });

  test.each([
    ["fake.tif", "image/tiff", "MZfake"],
    ["fake.pdf", "application/pdf", "8BPS\u0000\u0001"],
    ["fake.png", "image/png", "%PDF-1.7"],
  ])("rejects a signature mismatch for %s", (name, mimeType, content) => {
    expect(
      validateAssetBytes(new TextEncoder().encode(content), mimeType, name),
    ).toBe(false);
  });

  test.each([
    new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
    new Uint8Array([0x7f, 0x45, 0x4c, 0x46]),
    new Uint8Array([0xfe, 0xed, 0xfa, 0xcf]),
  ])("rejects renamed executable signatures", (bytes) => {
    expect(validateAssetBytes(bytes, "text/plain", "notes.txt")).toBe(false);
    expect(validateAssetBytes(bytes, "image/tiff", "scan.tif")).toBe(false);
  });

  test.each([
    ["payload.ai", "application/illustrator"],
    ["payload.ait", "application/illustrator"],
    ["payload.eps", "application/postscript"],
    ["payload.psd", "image/vnd.adobe.photoshop"],
    ["payload.psb", "image/vnd.adobe.photoshop"],
    ["payload.indd", "application/x-indesign"],
    ["payload.indt", "application/x-indesign"],
  ])("still rejects an executable renamed as %s", (name, mimeType) => {
    expect(
      validateAssetBytes(
        new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
        mimeType,
        name,
      ),
    ).toBe(false);
  });
});
