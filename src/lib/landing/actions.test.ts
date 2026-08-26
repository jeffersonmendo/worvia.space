import { describe, expect, test } from "bun:test";
import { getLandingActionCopyKeys, getLandingActionHrefs } from "./actions";

describe("getLandingActionHrefs", () => {
  test("keeps anonymous entry and creation as distinct actions", () => {
    expect(getLandingActionHrefs("/auth/sign-up")).toEqual({
      create: "/auth/sign-up",
      enter: "/auth/sign-in",
    });
  });

  test("sends authenticated entry home while keeping account creation public", () => {
    expect(getLandingActionHrefs("/home")).toEqual({
      create: "/auth/sign-up",
      enter: "/home",
    });
  });
});

describe("getLandingActionCopyKeys", () => {
  test("uses creation copy for anonymous visitors", () => {
    expect(getLandingActionCopyKeys(false)).toEqual({
      primary: "cta",
      secondary: "header.signIn",
    });
  });

  test("uses home copy for every authenticated action", () => {
    expect(getLandingActionCopyKeys(true)).toEqual({
      primary: "header.enter",
      secondary: "header.enter",
    });
  });
});
