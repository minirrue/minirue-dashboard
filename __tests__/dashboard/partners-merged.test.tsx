import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Partners is a view of Collaborators, not a second screen.
 *
 * #4: two nav entries covered what is operationally one relationship — you
 * managed a partner on one screen and watched them on another, moving between
 * the two for no reason a user could perceive.
 *
 * The issue's conditions are the test list: one nav entry, nothing lost, old
 * links still resolve, and RBAC unchanged.
 */
describe('Partners merged into Collaborators', () => {
  it('has no Partners entry in the sidebar', () => {
    const sidebar = read('components/dashboard/DashboardSidebar.tsx');
    const code = sidebar
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(code).not.toMatch(/label: 'Partners'/);
  });

  it('still lists Collaborators', () => {
    // The merge must not take both entries with it.
    const sidebar = read('components/dashboard/DashboardSidebar.tsx');

    expect(sidebar).toMatch(/label: 'Collaborators', href: '\/collaborators'/);
  });

  it('redirects /partners instead of 404ing it', () => {
    // The route has been in the sidebar, so it is in bookmarks and in links
    // that have gone out by email. A 404 for a screen that still exists under
    // another name is the worse answer.
    const page = read('app/dashboard/partners/page.tsx');

    expect(page).toMatch(/redirect\('\/collaborators'\)/);
  });

  it('keeps the oversight UI rather than reimplementing it', () => {
    // "Nothing that existed on the Partners screen is lost." The component is
    // rendered as-is by the merged screen, so there is no second copy to drift.
    const collaborators = read(
      'app/dashboard/collaborators/CollaboratorsClient.tsx',
    );

    expect(collaborators).toMatch(/import PartnersOversightClient/);
    expect(collaborators).toMatch(/<PartnersOversightClient \/>/);
  });

  it('groups the two halves behind a switch rather than stacking them', () => {
    // "The merged screen stays usable at laptop width and does not become a
    // wall of controls." Only one view renders at a time.
    const collaborators = read(
      'app/dashboard/collaborators/CollaboratorsClient.tsx',
    );

    expect(collaborators).toMatch(/role="tablist"/);
    expect(collaborators).toMatch(/view === 'oversight' \? \(/);
  });

  it('preserves RBAC — both routes were, and remain, admin only', () => {
    // The condition that would be easiest to break silently: merging an
    // ADMIN_ONLY screen into a more permissive one would expose partner sales
    // figures to a role that could not see them before.
    const roles = read('lib/auth/roles.ts');

    expect(roles).toMatch(/'\/collaborators': ADMIN_ONLY/);
    expect(roles).toMatch(/'\/partners': ADMIN_ONLY/);
  });
});
