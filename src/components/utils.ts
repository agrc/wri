import { composeRenderProps } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

export const randomize = <T>(items: T[]): { item: T; index: number } => {
  if (items.length === 0) {
    throw new Error('The items array must not be empty');
  }
  const index = Math.floor(Math.random() * items.length);

  return { item: items[index] as T, index };
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

export const titleCase = (str: string | undefined) => {
  if (!str) {
    return str;
  }

  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function composeTailwindRenderProps<T>(
  className: string | ((v: T) => string) | undefined,
  tw: string,
): string | ((v: T) => string) {
  return composeRenderProps(className, (className) => twMerge(tw, className));
}
