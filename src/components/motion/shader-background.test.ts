import { describe, expect, test } from "bun:test";
import { getReducedMotionShaderProps } from "./shader-background";

describe("ShaderBackground reduced motion", () => {
  test("freezes continuous shaders when reduced motion is requested", () => {
    expect(
      getReducedMotionShaderProps(true, { speed: 0.52, swirl: 0.8 }),
    ).toEqual({
      speed: 0,
    });
  });

  test("keeps the configured speed without reduced motion", () => {
    expect(getReducedMotionShaderProps(false, { speed: 0.52 })).toEqual({});
  });

  test("does not add unsupported speed props to static shaders", () => {
    expect(getReducedMotionShaderProps(true, { color: "red" })).toEqual({});
  });
});
