import { blankTab } from '@/app/dashboard/storefront-appearance/editors/CollabShowcaseEditor';

describe('blankTab', () => {
  it('defaults to the collaborator name and their newest four items', () => {
    const tab = blankTab('c1');
    expect(tab).toEqual({ collaboratorId: 'c1', label: null, productIds: [], limit: 4 });
  });
});
