export type DateLike = Date | string | number | null | undefined;

export function toIsoString(value: DateLike) {
  if (value == null) return null;

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();

  return Number.isFinite(time) ? date.toISOString() : null;
}
