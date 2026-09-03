import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-creation-questionnaire.tsx", import.meta.url),
).text();
const english = await Bun.file(
  new URL("../../../../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../../../../messages/es.json", import.meta.url),
).json();

describe("portal creation files step", () => {
  test("uses the optional 500 MB multi-file upload flow with scroll fading", () => {
    expect(source).toContain("maxSize: 500 * 1024 * 1024");
    expect(source).toContain('id="creation-files"');
    expect(source).toContain("multiple");
    expect(source).toContain("scroll-fade-y max-h-[34rem] overflow-y-auto");
    expect(source).toContain("<Attachment");
    expect(source).toContain("justify-between");
    expect(source).not.toContain(
      '<Badge className="w-fit" variant="secondary">',
    );
    expect(source).not.toContain('t("aiPriceDescription")');
    expect(source).toContain('<Attachment className="w-full"');
    expect(source).not.toContain('t("reviewAiPrice")');
    expect(english.Home.create.create).toBe("Create project");
    expect(spanish.Home.create.create).toBe("Crear proyecto");
    expect(source).toContain("filesReviewEmpty");
    expect(source).toContain('key: t("filesForAi")');
    expect(english.Home.create.filesForAi).toBe("Files for AI");
    expect(spanish.Home.create.filesForAi).toBe("Archivos para IA");
    expect(english.Home.create.filesReviewEmpty).toContain(
      "without file analysis",
    );
    expect(spanish.Home.create.filesReviewEmpty).toContain(
      "sin analizar archivos",
    );
  });

  test("localizes the optional title and upload limit", () => {
    expect(english.Home.create.project).toBe("Create project");
    expect(spanish.Home.create.project).toBe("Crear proyecto");
    expect(english.Home.create.filesTitle).toBe(
      "Build with AI from your files (optional)",
    );
    expect(english.Home.create.uploadDetails).toContain("100 MB of storage");
    expect(spanish.Home.create.filesTitle).toBe(
      "Crea con IA desde tus archivos (opcional)",
    );
    expect(spanish.Home.create.uploadDetails).toContain(
      "100 MB de almacenamiento",
    );
  });

  test("preflights attachments before previews and sends AI only accepted files", () => {
    expect(source).toContain("preflightFiles: preflightAiPortalAssetBatch");
    expect(source).toContain('toast.warning(uploadT("skippedAssets"');
    expect(source).toContain("for (const file of files)");
    expect(source).toContain("assets: uploadedAssets");
    expect(source).toContain("if (files.length === 0)");
    expect(source).toContain("mutation.isPending || isPreflighting");
  });
});
