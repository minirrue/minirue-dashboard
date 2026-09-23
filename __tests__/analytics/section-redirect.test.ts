import { describe, expect, it } from '@jest/globals';
import { sectionHref } from '@/app/dashboard/analytics/_ui/section-redirect';

/** Old Analytics links keep working (dashboard#128): they land on their section with every parameter. */
describe('sectionHref', () => {
  it('keeps dates, scope and the visitor to open', () => {
    expect(sectionHref({ from: '2026-09-01', to: '2026-09-10', traffic: 'all', visitor: 'v1' }, 'people')).toBe(
      '/analytics?from=2026-09-01&to=2026-09-10&traffic=all&visitor=v1&section=people',
    );
  });

  it('repeats multi-valued params and replaces a stale section', () => {
    expect(sectionHref({ source: ['paid', 'social'], section: 'overview' }, 'flow')).toBe('/analytics?source=paid&source=social&section=flow');
    expect(sectionHref({}, 'sources')).toBe('/analytics?section=sources');
  });
});
