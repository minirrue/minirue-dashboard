import fs from 'fs';
import path from 'path';

/**
 * dashboard#55 — every video an admin sees goes through DashboardVideoViewer
 * (or its VideoStill thumbnail), so no screen falls back to the browser's own
 * controls or forgets the Converting / Failed / source-error states.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const OWNER = path.join('components', 'dashboard', 'DashboardVideoViewer.tsx');

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (/\.(tsx|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

it('renders <video> only inside DashboardVideoViewer', () => {
  const offenders = ['app', 'components']
    .flatMap((d) => sources(path.join(ROOT, d)))
    .filter((file) => path.relative(ROOT, file) !== OWNER)
    .filter((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        // Prose in comments ("never a `<video src>`") is not a render.
        .some((line) => !/^\s*(\*|\/\/)/.test(line) && /(?<!`)<video[\s>/]/.test(line)),
    )
    .map((file) => path.relative(ROOT, file));
  expect(offenders).toEqual([]);
});
