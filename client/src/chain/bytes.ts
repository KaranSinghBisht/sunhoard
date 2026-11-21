export function asNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return null;
    }
  }
  return null;
}

export function asBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) return Uint8Array.from(value);
  if (typeof value === "object" && value && "length" in value) {
    try {
      return Uint8Array.from(value as ArrayLike<number>);
    } catch {
      return null;
    }
  }
  return null;
}

export function field(record: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (name in record) return record[name];
  }
  return undefined;
}
