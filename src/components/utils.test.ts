import { describe, expect, it } from 'vitest';
import { isVisible, randomize } from './utils';

describe('utils', () => {
  describe('isVisible', () => {
    it('should return true if there is no min or max scale', () => {
      expect(isVisible(25)).toBe(true);
    });

    it('should return true if the scale is between the minScale and maxScale', () => {
      expect(isVisible(5, 10, 0)).toBe(true);
    });

    it('should return true if the scale is equals the the minScale', () => {
      expect(isVisible(20, 20, 10)).toBe(true);
    });

    it('should return true if the scale is equals the the maxScale', () => {
      expect(isVisible(10, 20, 10)).toBe(true);
    });

    it('should return false if the scale is less than the maxScale', () => {
      expect(isVisible(5, 20, 10)).toBe(false);
    });

    it('should return false if the scale is greater than the minScale', () => {
      expect(isVisible(21, 20, 10)).toBe(false);
    });
  });

  describe('randomize', () => {
    it('should return an object with item and index properties', () => {
      const items = [1, 2, 3, 4, 5];
      const result = randomize(items);
      expect(result).toHaveProperty('item');
      expect(result).toHaveProperty('index');
    });

    it('should return an index within the valid range', () => {
      const items = [1, 2, 3, 4, 5];
      const result = randomize(items);
      expect(result.item).toBeGreaterThanOrEqual(1);
      expect(result.item).toBeLessThanOrEqual(5);
      expect(result.index).toBeLessThan(items.length);
    });

    it('should return an item that corresponds to the index in the original array', () => {
      const items = [1, 2, 3, 4, 5];
      const result = randomize(items);
      expect(result.item).toBe(items[result.index]);
    });
  });
});
