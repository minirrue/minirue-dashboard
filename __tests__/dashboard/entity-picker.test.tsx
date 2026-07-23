import { moveInList } from '@/app/dashboard/storefront-appearance/pickers/EntityPicker';

describe('moveInList', () => {
  it('moves an item up', () => {
    expect(moveInList(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
  });

  it('moves an item down', () => {
    expect(moveInList(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('refuses to move past either end', () => {
    expect(moveInList(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveInList(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});
