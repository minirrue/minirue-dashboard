import { describe, expect, it } from '@jest/globals';
import { placeLabel, realOrNull } from '@/lib/api/story';

const name = (code: string) => ({ EG: 'Egypt', US: 'United States' })[code] ?? code;

/**
 * The collector stores the literal "unknown" when MaxMind can't resolve a city
 * (backend#177), which used to print "unknown" over good country data.
 */
describe('place labels never print "unknown" over real data', () => {
  it('prefers a real city, then the country name', () => {
    expect(placeLabel('Cairo', 'EG', name)).toBe('Cairo · Egypt');
    expect(placeLabel('unknown', 'EG', name)).toBe('Egypt');
    expect(placeLabel(null, 'US', name)).toBe('United States');
    expect(placeLabel('unknown', 'unknown', name)).toBe('Country unknown');
    expect(placeLabel(null, null, name)).toBe('Country unknown');
  });

  it('treats placeholder strings as missing', () => {
    expect(realOrNull('unknown')).toBeNull();
    expect(realOrNull(' N/A ')).toBeNull();
    expect(realOrNull('')).toBeNull();
    expect(realOrNull('Cairo')).toBe('Cairo');
  });
});
