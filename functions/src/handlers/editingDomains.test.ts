import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/logger');
vi.mock('../database.js');

import { getDb } from '../database.js';
import { editingDomainsHandler } from './editingDomains.js';

const mockPolyRows = [
  { category: 'terrestrial treatment area', action: 'Herbicide Application', treatment: 'Aerial (helicopter)' },
  { category: 'terrestrial treatment area', action: 'Herbicide Application', treatment: 'Aerial (fixed wing)' },
  { category: 'terrestrial treatment area', action: 'Mechanical treatment', treatment: 'Roller/crusher' },
  { category: 'affected area', action: 'N/A', treatment: 'N/A' },
];

const mockPointLineRows = [
  { category: 'guzzler', subtype: 'Horizontal' },
  { category: 'guzzler', subtype: 'Vertical' },
  { category: 'fence', subtype: 'Barbed wire' },
  { category: 'fence', subtype: 'Buck and pole' },
  { category: 'other point feature', subtype: null },
];

const mockHerbicideRows = [{ HerbicideDescription: 'Imazapic' }, { HerbicideDescription: 'Clopyralid' }];

const mockActionRows = [{ action: 'Initial' }, { action: 'Maintenance' }];

const mockFeatureTypeRows = [
  { description: 'terrestrial treatment area', featureClass: 'POLY' },
  { description: 'affected area', featureClass: 'POLY' },
  { description: 'guzzler', featureClass: 'POINT' },
  { description: 'fence', featureClass: 'LINE' },
];

const createMockDb = () => {
  const mockQueryChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  };

  let callCount = 0;

  // Return different data for each of the 5 parallel queries
  const resolvingChain = {
    ...mockQueryChain,
    then: (resolve: (val: unknown) => unknown) => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockPolyRows).then(resolve);
      if (callCount === 2) return Promise.resolve(mockPointLineRows).then(resolve);
      if (callCount === 3) return Promise.resolve(mockHerbicideRows).then(resolve);
      if (callCount === 4) return Promise.resolve(mockActionRows).then(resolve);
      return Promise.resolve(mockFeatureTypeRows).then(resolve);
    },
  };

  return {
    select: vi.fn(() => resolvingChain),
    raw: vi.fn(),
  };
};

describe('editingDomainsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correctly structured featureAttributes for poly categories', async () => {
    vi.mocked(getDb).mockResolvedValue(createMockDb() as never);

    const result = await editingDomainsHandler();

    expect(result.featureAttributes['terrestrial treatment area']).toEqual({
      'Herbicide Application': ['Aerial (helicopter)', 'Aerial (fixed wing)'],
      'Mechanical treatment': ['Roller/crusher'],
    });
  });

  it('returns correctly structured featureAttributes for point/line categories', async () => {
    vi.mocked(getDb).mockResolvedValue(createMockDb() as never);

    const result = await editingDomainsHandler();

    expect(result.featureAttributes['guzzler']).toEqual(['Horizontal', 'Vertical']);
    expect(result.featureAttributes['fence']).toEqual(['Barbed wire', 'Buck and pole']);
  });

  it('handles point/line categories with no subtypes (null subtype row)', async () => {
    vi.mocked(getDb).mockResolvedValue(createMockDb() as never);

    const result = await editingDomainsHandler();

    // 'other point feature' has a null subtype — should result in an empty array
    expect(result.featureAttributes['other point feature']).toEqual([]);
  });

  it('returns flat herbicide list', async () => {
    vi.mocked(getDb).mockResolvedValue(createMockDb() as never);

    const result = await editingDomainsHandler();

    expect(result.herbicides).toEqual(['Imazapic', 'Clopyralid']);
  });

  it('returns flat pointLineActions list', async () => {
    vi.mocked(getDb).mockResolvedValue(createMockDb() as never);

    const result = await editingDomainsHandler();

    expect(result.pointLineActions).toEqual(['Initial', 'Maintenance']);
  });

  it('returns featureTypes map with correct table associations', async () => {
    vi.mocked(getDb).mockResolvedValue(createMockDb() as never);

    const result = await editingDomainsHandler();

    expect(result.featureTypes).toEqual({
      'terrestrial treatment area': 'POLY',
      'affected area': 'POLY',
      guzzler: 'POINT',
      fence: 'LINE',
    });
  });

  it('wraps unexpected DB errors in an internal HttpsError', async () => {
    vi.mocked(getDb).mockRejectedValue(new Error('DB connection failed'));

    await expect(editingDomainsHandler()).rejects.toMatchObject({ code: 'internal' });
  });
});
