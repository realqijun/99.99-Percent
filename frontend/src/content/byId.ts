/** Builds a table keyed by id, refusing duplicate ids so one entry can't silently replace another. */
export function byId<T extends { id: string }>(list: readonly T[]): Record<string, T> {
  const table: Record<string, T> = {};
  for (const item of list) {
    if (Object.prototype.hasOwnProperty.call(table, item.id)) throw new Error(`Duplicate content id: ${item.id}`);
    table[item.id] = item;
  }
  return table;
}
