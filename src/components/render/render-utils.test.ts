import { expect, test } from "bun:test";
import { columnsClass } from "./render-utils";

test("uses one fewer column on mobile for configurable collection grids", () => {
  expect(columnsClass(3)).toContain(
    "group-data-[style-mode=mobile]/project:grid-cols-2!",
  );
  expect(columnsClass(4)).toContain(
    "group-data-[style-mode=mobile]/project:grid-cols-3!",
  );
  expect(columnsClass(5)).toContain(
    "group-data-[style-mode=mobile]/project:grid-cols-4!",
  );
  expect(columnsClass(6)).toContain(
    "group-data-[style-mode=mobile]/project:grid-cols-5!",
  );
});
