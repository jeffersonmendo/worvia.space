import { describe, expect, test } from "bun:test";
import type { PortalDocument, PortalSection } from "@/domain/portal/document";
import {
  addPortalSection,
  applyPortalSectionHeadingPatch,
  movePortalImage,
  movePortalItem,
  reindexPortalSections,
  removePortalSection,
} from "./portal-editor-operations";

function section(
  id: string,
  position: number,
  type: PortalSection["type"] = "text",
) {
  return {
    content: type === "text" ? {} : undefined,
    description: `Description ${id}`,
    id,
    layout: {},
    position,
    title: `Title ${id}`,
    type,
    visible: true,
  } as PortalSection;
}

function documentWithSections(...sections: PortalSection[]): PortalDocument {
  return {
    portal: { description: "", name: "Portal", theme: "auto" },
    sections,
    version: 1,
  };
}

describe("reindexPortalSections", () => {
  test.each([
    { input: [] as PortalSection[], expected: [] as (string | number)[][] },
    {
      input: [section("b", 8), section("a", 20)],
      expected: [
        ["b", 0],
        ["a", 1],
      ] as (string | number)[][],
    },
  ])(
    "reindexes positions without mutating the input",
    ({ input, expected }) => {
      const result = reindexPortalSections(input);

      expect(result.map(({ id, position }) => [id, position])).toEqual(
        expected,
      );
      expect(result).not.toBe(input);
    },
  );
});

describe("section editor operations", () => {
  test.each([
    {
      name: "patches only the requested heading fields",
      operation: () =>
        applyPortalSectionHeadingPatch(
          documentWithSections(section("section", 0)),
          "section",
          { title: "New title" },
        ),
      assert: (result: PortalDocument) => {
        expect(result.sections[0]).toMatchObject({
          description: "Description section",
          title: "New title",
        });
      },
    },
    {
      name: "does not change an unknown section",
      operation: () =>
        applyPortalSectionHeadingPatch(
          documentWithSections(section("section", 0)),
          "missing",
          { description: "New description" },
        ),
      assert: (result: PortalDocument) => {
        expect(result).toEqual(documentWithSections(section("section", 0)));
      },
    },
    {
      name: "removes a section and reindexes the remainder",
      operation: () =>
        removePortalSection(
          documentWithSections(
            section("a", 0),
            section("b", 1),
            section("c", 2),
          ),
          "b",
        ),
      assert: (result: PortalDocument) => {
        expect(
          result.sections.map(({ id, position }) => [id, position]),
        ).toEqual([
          ["a", 0],
          ["c", 1],
        ]);
      },
    },
  ])("$name", ({ operation, assert }) => {
    const result = operation();
    assert(result);
  });

  test("adds a section with the requested type at the end", () => {
    const document = documentWithSections(section("existing", 0));

    const result = addPortalSection(document, "gallery");

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]).toBe(document.sections[0]);
    expect(result.sections[1]).toMatchObject({
      content: { images: [] },
      layout: { columns: 3, gap: "md", mode: "grid" },
      position: 1,
      type: "gallery",
    });
    expect(result).not.toBe(document);
  });
});

describe("movePortalImage", () => {
  const image = (id: string, position: number) => ({
    allow_download: true,
    alt_text: id,
    aspect_ratio: "auto" as const,
    fit: "cover" as const,
    id,
    image_url: `${id}.png`,
    position,
    visible: true,
  });

  const moveDocument = documentWithSections(
    {
      ...section("source", 0, "gallery"),
      content: { images: [image("one", 0), image("two", 1)] },
    },
    {
      ...section("target", 1, "gallery"),
      content: { images: [image("three", 0)] },
    },
  );

  test.each([
    {
      name: "moves a valid image",
      input: {
        imageId: "two",
        sourceSectionId: "source",
        targetIndex: 0,
        targetSectionId: "target",
      },
      expected: ["two", "three"] as string[],
    },
    {
      name: "rejects an unknown source section",
      input: {
        imageId: "two",
        sourceSectionId: "missing",
        targetIndex: 0,
        targetSectionId: "target",
      },
      expected: ["three"] as string[],
    },
    {
      name: "rejects a non-gallery target",
      input: {
        imageId: "two",
        sourceSectionId: "source",
        targetIndex: 0,
        targetSectionId: "text-target",
      },
      expected: undefined as string[] | undefined,
      document: documentWithSections(
        moveDocument.sections[0] as PortalSection,
        section("text-target", 1),
      ),
    },
    {
      name: "rejects a cross-section move at maxTargetImages",
      input: {
        imageId: "two",
        maxTargetImages: 1,
        sourceSectionId: "source",
        targetIndex: 0,
        targetSectionId: "target",
      },
      expected: ["three"] as string[],
    },
  ])("$name", ({ input, expected, document = moveDocument }) => {
    const result = movePortalImage(document, input);

    expect(
      result.sections
        .find(({ id }) => id === "target")
        ?.content.images?.map(({ id }) => id),
    ).toEqual(expected);
  });
});

describe("movePortalItem", () => {
  const image = (id: string, position: number) => ({
    allow_download: true,
    alt_text: id,
    aspect_ratio: "auto" as const,
    fit: "cover" as const,
    id,
    image_url: `${id}.png`,
    position,
    visible: true,
  });
  const color = (id: string, position: number) => ({
    color_code: "#000000",
    color_name: id,
    id,
    position,
    visible: true,
  });
  const file = (id: string, position: number) => ({
    allow_download: true,
    file_name: `${id}.pdf`,
    file_url: `${id}.pdf`,
    id,
    position,
    visible: true,
  });

  test.each([
    {
      kind: "color" as const,
      section: {
        ...section("colors", 0, "colors"),
        content: { colors: [color("one", 0), color("two", 1)] },
      } as PortalSection,
      contentKey: "colors" as const,
    },
    {
      kind: "file" as const,
      section: {
        ...section("files", 0, "files"),
        content: { files: [file("one", 0), file("two", 1)] },
      } as PortalSection,
      contentKey: "files" as const,
    },
  ])(
    "reorders $kind items inside their section",
    ({ kind, section, contentKey }) => {
      const result = movePortalItem(documentWithSections(section), {
        itemId: "two",
        kind,
        sourceSectionId: section.id,
        targetIndex: 0,
        targetSectionId: section.id,
      });

      expect(
        result.sections[0]?.content[contentKey]?.map(({ id }) => id),
      ).toEqual(["two", "one"]);
      expect(
        result.sections[0]?.content[contentKey]?.map(
          ({ position }) => position,
        ),
      ).toEqual([0, 1]);
    },
  );

  test("rejects moving files between sections", () => {
    const source = {
      ...section("source", 0, "files"),
      content: { files: [file("one", 0)] },
    } as PortalSection;
    const target = {
      ...section("target", 1, "files"),
      content: { files: [] },
    } as PortalSection;
    const document = documentWithSections(source, target);

    expect(
      movePortalItem(document, {
        itemId: "one",
        kind: "file",
        sourceSectionId: "source",
        targetIndex: 0,
        targetSectionId: "target",
      }),
    ).toBe(document);
  });

  test("moves an image between gallery sections", () => {
    const source = {
      ...section("source", 0, "gallery"),
      content: { images: [image("one", 0)] },
    } as PortalSection;
    const target = {
      ...section("target", 1, "gallery"),
      content: { images: [image("two", 0)] },
    } as PortalSection;

    const result = movePortalItem(documentWithSections(source, target), {
      itemId: "one",
      kind: "image",
      sourceSectionId: "source",
      targetIndex: 1,
      targetSectionId: "target",
    });

    expect(result.sections[0]?.content.images).toEqual([]);
    expect(result.sections[1]?.content.images?.map(({ id }) => id)).toEqual([
      "two",
      "one",
    ]);
  });
});
