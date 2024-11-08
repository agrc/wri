export const randomize = <T>(items: T[]): { item: T; index: number } => {
  const index = Math.floor(Math.random() * items.length);

  return { item: items[index], index };
};

export const isVisible = (scale: number, minScale: number = Infinity, maxScale: number = 0) => {
  if (maxScale > minScale) {
    throw new Error('maxScale must be less than minScale');
  } else if (minScale === 0 && maxScale === 0) {
    minScale = Infinity;
  } else if (maxScale === minScale) {
    throw new Error('maxScale and minScale cannot be equal');
  }

  return scale <= minScale && scale >= maxScale;
};

export const areSetsEqual = <T>(a: Set<T>, b: Set<T>) => a.size === b.size && [...a].every((value) => b.has(value));
