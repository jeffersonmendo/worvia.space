export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DESIGNER_MAX_WORDS = 8;
export const DESIGNER_MAX_CHARACTERS = 80;

export type ValidationResult =
  | { valid: true }
  | { error: string; valid: false };

export function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function createUniqueSlugCandidate(value: string, suffix: string) {
  const slug = normalizeSlug(value);
  const normalizedSuffix = normalizeSlug(suffix).slice(0, 12);
  const availableLength = Math.max(1, 80 - normalizedSuffix.length - 1);
  return `${slug.slice(0, availableLength).replace(/-+$/, "")}-${normalizedSuffix}`;
}

export function validateSlug(value: string): ValidationResult {
  if (value.length < 1 || value.length > 80 || !SLUG_RE.test(value)) {
    return {
      error: "Usa solo letras minúsculas, números y guiones.",
      valid: false,
    };
  }
  return { valid: true };
}

export function isValidSlug(value: string) {
  return validateSlug(value).valid;
}

export function normalizeDesignerName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateDesignerName(value: string): ValidationResult {
  const normalized = normalizeDesignerName(value);
  const words = normalized ? normalized.split(" ").length : 0;
  if (normalized.length > DESIGNER_MAX_CHARACTERS) {
    return { error: "Usa un máximo de 80 caracteres.", valid: false };
  }
  if (words > DESIGNER_MAX_WORDS) {
    return { error: "Usa un máximo de 8 palabras.", valid: false };
  }
  return { valid: true };
}

export function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !trimmed.startsWith("https://")) {
    return null;
  }
  try {
    const url = new URL(
      trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== "https:" || !url.hostname) return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** @deprecated Use normalizeWebsiteUrl. */
export const ensureHttps = normalizeWebsiteUrl;
