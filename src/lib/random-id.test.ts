import { describe, expect, test } from "bun:test";
import { createRandomId } from "./random-id";

describe("createRandomId", () => {
  test("uses randomUUID when the browser exposes it", () => {
    expect(createRandomId("color", { randomUUID: () => "uuid-1" })).toBe(
      "color_uuid-1",
    );
  });

  test("falls back to getRandomValues when randomUUID is unavailable", () => {
    const id = createRandomId("font", {
      getRandomValues: (bytes) => {
        bytes.fill(0);
        return bytes;
      },
    });

    expect(id).toMatch(/^font_00000000-0000-4000-8000-000000000000$/);
  });

  test("still creates an id without Web Crypto", () => {
    expect(createRandomId("file", {})).toMatch(/^file_[a-z0-9_]+$/);
  });
});
