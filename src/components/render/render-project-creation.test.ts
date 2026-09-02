import { describe, expect, test } from "bun:test";
import {
  appendRenderProjectSection,
  createRenderProjectSection,
} from "./render-project-creation";
import type { RenderProjectData } from "./visual-model";

const project: RenderProjectData = {
  description: "A project",
  id: "project-1",
  name: "Project",
  sections: [
    {
      content: { body: "Existing" },
      description: "",
      id: "text-1",
      position: 0,
      title: "Text",
      type: "text",
      visible: true,
    },
  ],
};

describe("external RenderProject section creation", () => {
  test("creates a valid visual section without requiring RenderProject UI", () => {
    const section = createRenderProjectSection("gallery", {
      id: "gallery-1",
      position: 4,
    });

    expect(section).toEqual({
      content: { images: [] },
      description: "",
      id: "gallery-1",
      layout: { columns: 3, gap: "md", mode: "grid", width: "container" },
      position: 4,
      title: "",
      type: "gallery",
      visible: true,
    });
  });

  test("appends an immutable project snapshot a consumer can pass to onChange", () => {
    const next = appendRenderProjectSection(project, "colors", {
      id: "colors-1",
    });

    expect(next).not.toBe(project);
    expect(next.sections).not.toBe(project.sections);
    expect(project.sections).toHaveLength(1);
    expect(next.sections).toHaveLength(2);
    expect(next.sections.at(-1)).toMatchObject({
      content: { colors: [] },
      id: "colors-1",
      position: 1,
      type: "colors",
    });
  });
});
