import { emptySourceFor } from '@/app/dashboard/storefront-appearance/editors/ProductGridEditor';

describe('emptySourceFor', () => {
  it('starts a manual source with an empty pick list', () => {
    expect(emptySourceFor('manual')).toEqual({ kind: 'manual', productIds: [] });
  });

  it('starts a category source with no category chosen', () => {
    expect(emptySourceFor('category')).toEqual({ kind: 'category', categoryId: '' });
  });

  it('starts a brand source with no brand chosen', () => {
    expect(emptySourceFor('brand')).toEqual({ kind: 'brand', brandId: '' });
  });
});
