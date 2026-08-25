export type LandingEntryHref = "/auth/sign-up" | "/home";

export function getLandingActionHrefs(entryHref: LandingEntryHref) {
  return entryHref === "/home"
    ? ({ create: "/home", enter: "/home" } as const)
    : ({ create: "/auth/sign-up", enter: "/auth/sign-in" } as const);
}

export function getLandingActionCopyKeys(isAuthenticated: boolean) {
  return isAuthenticated
    ? ({ primary: "header.enter", secondary: "header.enter" } as const)
    : ({ primary: "cta", secondary: "header.signIn" } as const);
}
