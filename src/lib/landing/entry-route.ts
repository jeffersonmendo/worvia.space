export function getLandingEntryHref(isAuthenticated: boolean) {
  return isAuthenticated ? "/home" : "/auth/sign-up";
}
