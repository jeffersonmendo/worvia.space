type RandomSource = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
};

const fallbackRandomSource: RandomSource =
  typeof globalThis.crypto === "undefined" ? {} : globalThis.crypto;

/** Creates an identifier without requiring `crypto.randomUUID`. */
export function createRandomId(
  prefix?: string,
  source: RandomSource = fallbackRandomSource,
) {
  const uuid = source.randomUUID?.();
  if (uuid) return prefix ? `${prefix}_${uuid}` : uuid;

  if (source.getRandomValues) {
    const bytes = source.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = [...bytes]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const uuidValue = `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
    return prefix ? `${prefix}_${uuidValue}` : uuidValue;
  }

  const value = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}_${value}` : value;
}
