import { describe, expect, it } from 'vitest';
import { areSetsEqual, isVisible, randomize } from './utils';

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

  it('should throw an error if maxScale is greater than minScale', () => {
    expect(() => isVisible(25, 0, 10)).toThrowError('maxScale must be less than minScale');
  });

  it('should throw an error if maxScale is equal to minScale', () => {
    expect(() => isVisible(25, 10, 10)).toThrowError('maxScale and minScale cannot be equal');
  });

  it('should set minScale to Infinity if both minScale and maxScale are 0', () => {
    expect(isVisible(25, 0, 0)).toBe(true);
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

describe('areSetsEqual', () => {
  it('should return true if the sets are equal', () => {
    const a = new Set([1, 2, 3]);
    const b = new Set([1, 2, 3]);
    expect(areSetsEqual(a, b)).toBe(true);
  });

  it('should return true if the sets are equal with strings', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['a', 'b', 'c']);
    expect(areSetsEqual(a, b)).toBe(true);
  });

  it('should return false if the sets are not equal', () => {
    const a = new Set([1, 2, 3]);
    const b = new Set([1, 2, 4]);
    expect(areSetsEqual(a, b)).toBe(false);
  });

  it('should return false if the sets are not the same size', () => {
    const a = new Set([1, 2, 3]);
    const b = new Set([1, 2, 3, 4]);
    expect(areSetsEqual(a, b)).toBe(false);
  });
});
