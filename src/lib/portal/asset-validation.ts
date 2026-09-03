import type { PortalAssetCategory } from "@/infrastructure/portal/portal-assets-client";

const mimeByExtension: Record<string, readonly string[]> = {
  ai: [
    "application/illustrator",
    "application/vnd.adobe.illustrator",
    "application/x-illustrator",
    "application/postscript",
    "application/pdf",
  ],
  ait: [
    "application/illustrator",
    "application/vnd.adobe.illustrator",
    "application/x-illustrator",
    "application/postscript",
    "application/pdf",
  ],
  avif: ["image/avif"],
  eps: ["application/postscript"],
  gif: ["image/gif"],
  idml: ["application/vnd.adobe.indesign-idml-package", "application/zip"],
  indd: ["application/x-indesign", "application/vnd.adobe.indesign"],
  indt: ["application/x-indesign", "application/vnd.adobe.indesign"],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg"],
  markdown: ["text/markdown", "text/x-markdown", "text/plain"],
  md: ["text/markdown", "text/x-markdown", "text/plain"],
  otf: ["font/otf", "font/sfnt"],
  pdf: ["application/pdf"],
  png: ["image/png"],
  psd: [
    "image/vnd.adobe.photoshop",
    "image/x-photoshop",
    "application/vnd.adobe.photoshop",
    "application/x-photoshop",
  ],
  psb: [
    "image/vnd.adobe.photoshop",
    "image/x-photoshop",
    "application/vnd.adobe.photoshop",
    "application/x-photoshop",
  ],
  svg: ["image/svg+xml"],
  txt: ["text/plain"],
  tif: ["image/tiff", "image/x-tiff"],
  tiff: ["image/tiff", "image/x-tiff"],
  ttf: ["font/ttf", "font/sfnt"],
  webp: ["image/webp"],
  woff: ["font/woff"],
  woff2: ["font/woff2"],
};

export function inferAssetMimeType(name: string, provided?: string) {
  const normalizedProvided = normalizeAssetMimeType(provided);
  const allowed = mimeByExtension[extension(name)];
  if (
    normalizedProvided &&
    normalizedProvided !== "application/octet-stream" &&
    allowed?.includes(normalizedProvided)
  )
    return normalizedProvided;
  return allowed?.[0] ?? "";
}

export function normalizeAssetMimeType(value?: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function isRenderableImageMimeType(mimeType: string) {
  return (
    mimeType.startsWith("image/") &&
    ![
      "image/svg+xml",
      "image/tiff",
      "image/x-tiff",
      "image/vnd.adobe.photoshop",
      "image/x-photoshop",
    ].includes(mimeType)
  );
}

export function portalAssetCategoryForFile(file: Pick<File, "name" | "type">) {
  const mimeType = inferAssetMimeType(file.name, file.type);
  return isRenderableImageMimeType(mimeType)
    ? "image"
    : mimeType.startsWith("font/")
      ? "font"
      : "file";
}

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function areAssetMimeTypesCompatible(
  name: string,
  reservedMimeType?: string | null,
  storedMimeType?: string | null,
) {
  const reserved = normalizeAssetMimeType(reservedMimeType);
  const stored = normalizeAssetMimeType(storedMimeType);
  if (
    !reserved ||
    !stored ||
    reserved === "application/octet-stream" ||
    stored === "application/octet-stream"
  )
    return false;
  const allowed = mimeByExtension[extension(name)];
  return Boolean(allowed?.includes(reserved) && allowed.includes(stored));
}

export function validateAssetDeclaration(input: {
  category: PortalAssetCategory;
  mimeType: string;
  name: string;
}) {
  const allowed = mimeByExtension[extension(input.name)];
  if (!allowed?.includes(input.mimeType)) return false;
  if (["cover", "gallery", "icon", "image"].includes(input.category)) {
    return (
      input.mimeType.startsWith("image/") &&
      (input.category === "gallery" || input.mimeType !== "image/svg+xml") &&
      input.mimeType !== "image/tiff" &&
      input.mimeType !== "image/x-tiff" &&
      input.mimeType !== "image/vnd.adobe.photoshop" &&
      input.mimeType !== "image/x-photoshop"
    );
  }
  if (input.category === "font") return input.mimeType.startsWith("font/");
  return true;
}

/** A picker hint only. Server declaration and byte validation remain authoritative. */
export function portalAssetInputAccept(category: PortalAssetCategory) {
  return Object.entries(mimeByExtension)
    .filter(([name, mimeTypes]) =>
      mimeTypes.some((mimeType) =>
        validateAssetDeclaration({ category, mimeType, name: `asset.${name}` }),
      ),
    )
    .flatMap(([name, mimeTypes]) => [`.${name}`, ...mimeTypes])
    .join(",");
}

export async function preflightPortalAssetSelection(
  category: PortalAssetCategory,
  file: Pick<File, "arrayBuffer" | "name" | "type">,
) {
  const mimeType = inferAssetMimeType(file.name, file.type);
  if (!validateAssetDeclaration({ category, mimeType, name: file.name }))
    return false;

  // SVG previews are rendered in the editor, so inspect them before a draft,
  // reservation, or upload is created. The server repeats this validation.
  if (mimeType === "image/svg+xml") {
    try {
      return validateAssetBytes(
        new Uint8Array(await file.arrayBuffer()),
        mimeType,
        file.name,
      );
    } catch {
      return false;
    }
  }

  return true;
}

export async function preflightPortalAssetBatch(
  category: PortalAssetCategory,
  files: readonly File[],
) {
  const results = await Promise.all(
    files.map(async (file) => ({
      file,
      valid: await preflightPortalAssetSelection(category, file),
    })),
  );
  const acceptedFiles = results
    .filter(({ valid }) => valid)
    .map(({ file }) => file);

  return {
    acceptedFiles,
    rejectedFileCount: results.length - acceptedFiles.length,
  };
}

/** Preflight the mixed attachment batch used by AI project creation. */
export async function preflightAiPortalAssetBatch(files: readonly File[]) {
  const results = await Promise.all(
    files.map(async (file) => ({
      file,
      valid: await preflightPortalAssetSelection(
        portalAssetCategoryForFile(file),
        file,
      ),
    })),
  );
  const acceptedFiles = results
    .filter(({ valid }) => valid)
    .map(({ file }) => file);

  return {
    acceptedFiles,
    rejectedFileCount: results.length - acceptedFiles.length,
  };
}

function starts(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function isUtf16Text(bytes: Uint8Array) {
  const hasLittleEndianBom = starts(bytes, [0xff, 0xfe]);
  const hasBigEndianBom = starts(bytes, [0xfe, 0xff]);
  let littleEndian = hasLittleEndianBom;
  let bigEndian = hasBigEndianBom;
  if (!littleEndian && !bigEndian) {
    const sample = bytes.slice(0, Math.min(bytes.length, 64 * 1024));
    let evenNulls = 0;
    let oddNulls = 0;
    for (let index = 0; index < sample.length; index++) {
      if (sample[index] !== 0) continue;
      if (index % 2 === 0) evenNulls++;
      else oddNulls++;
    }
    const pairs = Math.floor(sample.length / 2);
    littleEndian = oddNulls >= Math.max(2, pairs * 0.2);
    bigEndian = evenNulls >= Math.max(2, pairs * 0.2);
  }
  if (!littleEndian && !bigEndian) return false;
  try {
    const text = new TextDecoder(bigEndian ? "utf-16be" : "utf-16le", {
      fatal: true,
    }).decode(bytes);
    return [...text].every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return !(
        (code >= 0 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31)
      );
    });
  } catch {
    return false;
  }
}

function isExecutable(bytes: Uint8Array) {
  return [
    [0x4d, 0x5a],
    [0x7f, 0x45, 0x4c, 0x46],
    [0xfe, 0xed, 0xfa, 0xce],
    [0xfe, 0xed, 0xfa, 0xcf],
    [0xce, 0xfa, 0xed, 0xfe],
    [0xcf, 0xfa, 0xed, 0xfe],
    [0xca, 0xfe, 0xba, 0xbe],
    [0xbe, 0xba, 0xfe, 0xca],
  ].some((signature) => starts(bytes, signature));
}

function littleEndian16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function littleEndian32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function matchesAt(bytes: Uint8Array, offset: number, signature: number[]) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

const unsafeArchiveExtension =
  /\.(?:app|bat|cmd|com|dll|dmg|exe|html?|jar|js|msi|pkg|ps1|scr|sh)$/i;
const MAX_IDML_CENTRAL_DIRECTORY_BYTES = 4 * 1024 * 1024;
const MAX_IDML_ENTRY_NAME_BYTES = 1024;
const MAX_IDML_TOTAL_NAME_BYTES = 1024 * 1024;

function findZipEndOfCentralDirectory(bytes: Uint8Array) {
  const minimumEocdSize = 22;
  if (bytes.length < minimumEocdSize) return -1;
  const minimumOffset = Math.max(0, bytes.length - minimumEocdSize - 65_535);
  for (
    let offset = bytes.length - minimumEocdSize;
    offset >= minimumOffset;
    offset--
  ) {
    if (!matchesAt(bytes, offset, [0x50, 0x4b, 0x05, 0x06])) continue;
    const commentLength = littleEndian16(bytes, offset + 20);
    if (offset + minimumEocdSize + commentLength === bytes.length)
      return offset;
  }
  return -1;
}

function idmlEntries(bytes: Uint8Array, eocdOffset: number) {
  const diskNumber = littleEndian16(bytes, eocdOffset + 4);
  const centralDisk = littleEndian16(bytes, eocdOffset + 6);
  const entriesOnDisk = littleEndian16(bytes, eocdOffset + 8);
  const entryCount = littleEndian16(bytes, eocdOffset + 10);
  const centralSize = littleEndian32(bytes, eocdOffset + 12);
  const centralOffset = littleEndian32(bytes, eocdOffset + 16);
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0 ||
    entryCount > 10_000 ||
    centralSize > MAX_IDML_CENTRAL_DIRECTORY_BYTES ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    centralOffset + centralSize !== eocdOffset
  )
    return null;

  const centralEnd = centralOffset + centralSize;
  if (centralOffset >= eocdOffset || centralEnd > bytes.length) return null;
  const entries = new Set<string>();
  const localRanges: Array<[number, number]> = [];
  let totalNameBytes = 0;
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index++) {
    if (
      offset + 46 > centralEnd ||
      !matchesAt(bytes, offset, [0x50, 0x4b, 0x01, 0x02])
    )
      return null;
    const flags = littleEndian16(bytes, offset + 8);
    const method = littleEndian16(bytes, offset + 10);
    const crc = littleEndian32(bytes, offset + 16);
    const compressedSize = littleEndian32(bytes, offset + 20);
    const uncompressedSize = littleEndian32(bytes, offset + 24);
    const nameLength = littleEndian16(bytes, offset + 28);
    const extraLength = littleEndian16(bytes, offset + 30);
    const commentLength = littleEndian16(bytes, offset + 32);
    const diskStart = littleEndian16(bytes, offset + 34);
    const localOffset = littleEndian32(bytes, offset + 42);
    const end = offset + 46 + nameLength;
    const next = end + extraLength + commentLength;
    if (
      !nameLength ||
      nameLength > MAX_IDML_ENTRY_NAME_BYTES ||
      next > centralEnd ||
      diskStart !== 0 ||
      (flags & 1) !== 0 ||
      // InDesign writes sized ZIP entries. Data descriptors (bit 3) are
      // intentionally unsupported so central/local integrity stays explicit.
      (flags & 8) !== 0 ||
      ![0, 8].includes(method) ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff ||
      localOffset + 30 > centralOffset ||
      !matchesAt(bytes, localOffset, [0x50, 0x4b, 0x03, 0x04])
    )
      return null;
    totalNameBytes += nameLength;
    if (totalNameBytes > MAX_IDML_TOTAL_NAME_BYTES) return null;
    let name: string;
    try {
      name = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(offset + 46, end),
      );
    } catch {
      return null;
    }
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..") ||
      unsafeArchiveExtension.test(name) ||
      entries.has(name)
    )
      return null;

    const localFlags = littleEndian16(bytes, localOffset + 6);
    const localMethod = littleEndian16(bytes, localOffset + 8);
    const localCrc = littleEndian32(bytes, localOffset + 14);
    const localCompressedSize = littleEndian32(bytes, localOffset + 18);
    const localUncompressedSize = littleEndian32(bytes, localOffset + 22);
    const localNameLength = littleEndian16(bytes, localOffset + 26);
    const localExtraLength = littleEndian16(bytes, localOffset + 28);
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    const dataStart = localNameEnd + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (
      localFlags !== flags ||
      localMethod !== method ||
      localNameLength !== nameLength ||
      localNameEnd > centralOffset ||
      dataEnd > centralOffset ||
      localCrc !== crc ||
      localCompressedSize !== compressedSize ||
      localUncompressedSize !== uncompressedSize
    )
      return null;
    let localName: string;
    try {
      localName = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(localNameStart, localNameEnd),
      );
    } catch {
      return null;
    }
    if (localName !== name) return null;

    entries.add(name);
    localRanges.push([localOffset, dataEnd]);
    offset = next;
  }
  if (offset !== centralEnd) return null;
  localRanges.sort((left, right) => left[0] - right[0]);
  if (
    localRanges.some(
      (range, index) =>
        index > 0 && range[0] < (localRanges[index - 1]?.[1] ?? 0),
    )
  )
    return null;
  return entries;
}

function isIdml(bytes: Uint8Array) {
  const eocdOffset = findZipEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) return false;
  const entries = idmlEntries(bytes, eocdOffset);
  if (!entries) return false;
  return (
    entries.has("designmap.xml") &&
    entries.has("META-INF/container.xml") &&
    [...entries].some(
      (name) =>
        /^Stories\/[^/]+\.xml$/i.test(name) ||
        /^Spreads\/[^/]+\.xml$/i.test(name),
    )
  );
}

const indesignSignature = [
  0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7, 0xfe,
  0x74, 0xb7, 0x1d,
];

// Proprietary Adobe work files are private, attachment-only downloads. Their
// internal signatures vary by version/export settings, so extension + an
// allowlisted MIME + the global executable denylist is the validation contract.
const opaqueAdobeWorkExtensions = new Set([
  "ai",
  "ait",
  "eps",
  "psd",
  "psb",
  "indd",
  "indt",
]);

export function validateAssetBytes(
  bytes: Uint8Array,
  mimeType: string,
  name?: string,
) {
  if (!bytes.length) {
    return (
      mimeType === "text/plain" ||
      mimeType === "text/markdown" ||
      mimeType === "text/x-markdown"
    );
  }
  if (mimeType === "application/octet-stream") return false;
  if (isExecutable(bytes)) return false;
  const fileExtension = name ? extension(name) : "";
  if (opaqueAdobeWorkExtensions.has(fileExtension))
    return Boolean(mimeByExtension[fileExtension]?.includes(mimeType));
  if (mimeType === "image/png")
    return starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/jpeg") return starts(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/gif") return starts(bytes, [0x47, 0x49, 0x46, 0x38]);
  if (mimeType === "image/webp")
    return (
      starts(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  if (mimeType === "image/avif")
    return String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif");
  if (mimeType === "image/tiff" || mimeType === "image/x-tiff")
    return (
      starts(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
      starts(bytes, [0x4d, 0x4d, 0x00, 0x2a]) ||
      starts(bytes, [0x49, 0x49, 0x2b, 0x00]) ||
      starts(bytes, [0x4d, 0x4d, 0x00, 0x2b])
    );
  if (mimeType === "application/pdf")
    return starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mimeType === "application/vnd.adobe.indesign-idml-package")
    return fileExtension === "idml" && isIdml(bytes);
  if (mimeType === "application/zip")
    return fileExtension === "idml"
      ? isIdml(bytes)
      : starts(bytes, [0x50, 0x4b]);
  if (
    mimeType === "application/x-indesign" ||
    mimeType === "application/vnd.adobe.indesign"
  )
    return (
      ["indd", "indt"].includes(fileExtension) &&
      starts(bytes, indesignSignature)
    );
  if (mimeType === "font/woff") return starts(bytes, [0x77, 0x4f, 0x46, 0x46]);
  if (mimeType === "font/woff2") return starts(bytes, [0x77, 0x4f, 0x46, 0x32]);
  if (["font/otf", "font/sfnt"].includes(mimeType))
    return (
      starts(bytes, [0x4f, 0x54, 0x54, 0x4f]) ||
      starts(bytes, [0x00, 0x01, 0x00, 0x00])
    );
  if (mimeType === "font/ttf") return starts(bytes, [0x00, 0x01, 0x00, 0x00]);
  if (mimeType.includes("photoshop")) {
    if (!starts(bytes, [0x38, 0x42, 0x50, 0x53])) return false;
    const version = ((bytes[4] ?? 0) << 8) | (bytes[5] ?? 0);
    if (fileExtension === "psd") return version === 1;
    if (fileExtension === "psb") return version === 2;
    return version === 1 || version === 2;
  }
  const prefixText = new TextDecoder().decode(bytes.slice(0, 64 * 1024));
  if (mimeType === "image/svg+xml") {
    const svgText = new TextDecoder().decode(bytes);
    return (
      /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svgText) &&
      !/(?:<script|<foreignObject|\son\w+\s*=|javascript:)/i.test(svgText)
    );
  }
  if (mimeType === "application/postscript") return prefixText.startsWith("%!");
  if (mimeType.includes("illustrator")) {
    return (
      prefixText.startsWith("%!") ||
      starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
    );
  }
  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/x-markdown"
  ) {
    return isUtf16Text(bytes) || !bytes.includes(0);
  }
  return false;
}
