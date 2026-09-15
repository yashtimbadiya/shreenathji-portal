export function sortByDateDesc<T>(items: T[], getDate: (item: T) => string | undefined): T[] {
  return items
    .map((item, index) => ({ item, index, timestamp: Date.parse(getDate(item) ?? '') }))
    .sort((a, b) => {
      const aHasDate = Number.isFinite(a.timestamp);
      const bHasDate = Number.isFinite(b.timestamp);
      if (aHasDate && bHasDate && a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
      if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
