import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-ai-dialog.tsx", import.meta.url),
).text();

describe("portal AI upload sheet", () => {
  test("matches the creation upload interaction without using a dialog", () => {
    expect(source).toContain("SheetContent");
    expect(source).toContain("SheetTitle");
    expect(source).toContain("SheetDescription");
    expect(source).not.toContain("DialogContent");
    expect(source).toContain("useFileUpload");
    expect(source).toContain("maxSize: 500 * 1024 * 1024");
    expect(source).toContain("handleDrop");
    expect(source).toContain("<Attachment");
    expect(source).toContain("scroll-fade-y max-h-72 overflow-y-auto");
    expect(source).toContain("getInputProps");
    expect(source).toContain("removeFile");
  });
});
